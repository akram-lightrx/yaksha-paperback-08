const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
require('@paperback/runtime-polyfills');
const { YakshaComics } = require('../bundles/YakshaComics/source.js').Sources;
const BASE = 'https://yakshacomics.com';
const ID = 'rebirth-of-the-strongest-white-bone-demon-in-journey-to-the-west';
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name + '.html'), 'utf8');
function source(respond) {
  const s = new YakshaComics(cheerio);
  s.requestManager.schedule = async request => ({ data: await respond(request), status: 200, headers: {}, request });
  return s;
}

test('search returns real 0.8 tiles with title, cover and stable ID', async () => {
  const result = await source(() => fixture('search')).getSearchResults({ title: 'bone' }, undefined);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].mangaId, ID);
  assert.equal(result.results[0].title, 'Rebirth Of The Strongest White Bone Demon');
  assert.match(result.results[0].image, /IMG_20260821_103010-193x278.jpg$/);
  assert.equal(result.metadata, undefined);
});
test('empty search browses real page two without repeating page one', async () => {
  const s = source(r => {
    if (r.url === BASE + '/') return fixture('home');
    if (r.url === BASE + '/page/2/') return fixture('home2');
    throw new Error('Unexpected listing URL: ' + r.url);
  });
  const first = await s.getSearchResults({ title: '' }, undefined);
  const second = await s.getSearchResults({ title: '' }, first.metadata);
  assert.equal(first.results.length, 20);
  assert.equal(second.results.length, 20);
  assert.notEqual(first.results[0].mangaId, second.results[0].mangaId);
});
test('details include parsed title, cover, synopsis and status', async () => {
  const result = await source(() => fixture('detail')).getMangaDetails(ID);
  assert.equal(result.id, ID);
  assert.equal(result.mangaInfo.titles[0], 'Rebirth Of The Strongest White Bone Demon');
  assert.match(result.mangaInfo.image, /^https:\/\/yakshacomics.com\/wp-content\//);
  assert.match(result.mangaInfo.desc, /A demonic spirit reborn/);
  assert.equal(result.mangaInfo.author, 'meow anime');
  assert.equal(result.mangaInfo.status, 'ONGOING');
});
test('chapter list excludes other series and preserves decimal chapter numbers', async () => {
  const html = fixture('detail') + '<aside><a href="/manga/unrelated/chapter-900/">Chapter 900</a></aside>';
  const chapters = await source(() => html).getChapters(ID);
  assert.equal(chapters.length, 26);
  assert.equal(chapters[0].id, 'chapter-26');
  assert.equal(chapters[0].chapNum, 26);
  const fractional = await source(() => `<li class="wp-manga-chapter"><a href="/manga/${ID}/chapter-2-5/">Chapter 2.5</a></li>`).getChapters(ID);
  assert.equal(fractional[0].chapNum, 2.5);
});
test('reader returns only chapter images in original order', async () => {
  const html = '<img src="https://yakshacomics.com/cover.jpg">' + fixture('chapter');
  const result = await source(() => html).getChapterDetails(ID, 'chapter-26');
  assert.equal(result.pages.length, 8);
  assert.match(result.pages[0], /\/00\.5.jpg$/);
  assert.match(result.pages[7], /\/006.jpg$/);
});
test('reader resolves lazy and protocol-relative URLs without placeholders', async () => {
  const html = '<div class="reading-content"><img class="wp-manga-chapter-img" data-src="//cdn.example.com/01.webp" src="/placeholder.png"><img class="wp-manga-chapter-img" data-lazy-src="/02.jpg?x=1&amp;y=2" src="/placeholder.png"></div>';
  const result = await source(() => html).getChapterDetails(ID, 'chapter-1');
  assert.deepEqual(result.pages, ['https://cdn.example.com/01.webp', BASE + '/02.jpg?x=1&y=2']);
});
test('missing reader and detail content produces actionable errors', async () => {
  const s = source(() => '<html><h1>Access unavailable</h1></html>');
  await assert.rejects(s.getChapterDetails(ID, 'chapter-1'), /chapter images/i);
  await assert.rejects(s.getMangaDetails(ID), /manga details/i);
});
test('empty search results stop pagination', async () => {
  const result = await source(() => fixture('empty-search')).getSearchResults({title:'zzzz'}, undefined);
  assert.equal(result.results.length, 0);
  assert.equal(result.metadata, undefined);
});

test('Madara image variants choose best srcset and special lazy attributes', async () => {
  const html='<div class="reading-content"><div class="page-break"><img srcset="/small.jpg 300w, /large.jpg 1200w" src="/placeholder.png"></div><li class="blocks-gallery-item"><img data-cfsrc="/cf.jpg" src="/placeholder.png"></li><div class="page-break"><img data-manga-src="/manga.jpg"></div></div>';
  const result=await source(()=>html).getChapterDetails(ID,'chapter-1');
  assert.deepEqual(result.pages,[BASE+'/large.jpg',BASE+'/cf.jpg',BASE+'/manga.jpg']);
});
test('modern Madara AJAX endpoint supplies chapters when not inline', async () => {
  const s=source(r=>{
    if(r.method==='GET')return '<div id="manga-chapters-holder" data-id="467"></div>';
    assert.equal(r.url,BASE+'/manga/'+ID+'/ajax/chapters');
    assert.equal(r.method,'POST');
    return '<li class="wp-manga-chapter"><a href="/manga/'+ID+'/chapter-26/">Chapter 26</a></li>';
  });
  const result=await s.getChapters(ID);
  assert.equal(result.length,1);assert.equal(result[0].chapNum,26);
});
test('single-page Madara reader switches to list style only when needed', async () => {
  const s=source(r=>r.url.endsWith('?style=list') ? fixture('chapter') : '<div id="single-pager"></div><div class="reading-content"><img class="wp-manga-chapter-img" src="/only-first.jpg"></div>');
  const result=await s.getChapterDetails(ID,'chapter-26');
  assert.equal(result.pages.length,8);
});

test('search rejects HTTP 200 access/error pages instead of reporting no matches', async () => {
  const s=source(()=>'<title>Just a moment...</title><h1>Access unavailable</h1>');
  await assert.rejects(s.getSearchResults({title:'bone'},undefined),/search results|listing/i);
});
test('unrelated chapter widgets do not suppress the requested manga AJAX list', async () => {
  const s=source(r=>r.method==='POST' ? '<li class="wp-manga-chapter"><a href="/manga/'+ID+'/chapter-26/">Chapter 26</a></li>' : '<div id="manga-chapters-holder" data-id="467"></div><li class="wp-manga-chapter"><a href="/manga/other/chapter-9/">Chapter 9</a></li>');
  const chapters=await s.getChapters(ID);
  assert.equal(chapters.length,1);assert.equal(chapters[0].chapNum,26);
});
