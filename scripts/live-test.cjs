// Test the compiled extension with the official Node polyfills, not rewritten parsers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cheerio = require('cheerio');
const axios = require('axios');
require('@paperback/runtime-polyfills');
const {YakshaComics} = require('../bundles/YakshaComics/source.js').Sources;
const source = new YakshaComics(cheerio);
const useCurl = process.argv.includes('--curl');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const run = promisify(execFile);
async function curlRequest(request) {
  const args = ['--silent','--show-error','--location','--max-time','30','--request',request.method || 'GET'];
  for (const [name,value] of Object.entries(request.headers || {})) args.push('--header',name+': '+value);
  args.push('--write-out','\\nYAKSHA_META:%{http_code}:%{content_type}',request.url);
  const {stdout} = await run('curl',args,{encoding:'buffer',maxBuffer:32000000});
  const marker=Buffer.from('\nYAKSHA_META:');
  const index=stdout.lastIndexOf(marker);
  assert(index>=0,'Missing curl response metadata');
  const [status,...contentType]=stdout.subarray(index+marker.length).toString().split(':');
  return {status:Number(status),data:stdout.subarray(0,index),headers:{'content-type':contentType.join(':')}};
}
if (useCurl) {
  // The development network returns 502 for the toolchain's older Axios transport.
  // Exercise the SAME compiled source and interceptor through curl in that environment.
  source.requestManager.schedule = async request => {
    request=await source.requestManager.interceptor.interceptRequest(request);
    const response=await curlRequest(request);
    return source.requestManager.interceptor.interceptResponse({...response,data:response.data.toString('utf8'),request});
  };
}
const report = {checkedAt: new Date().toISOString(), transport:useCurl ? 'Compiled source + official factories; curl HTTP adapter and real interceptor' : 'Official Paperback 0.8 runtime polyfills (Axios)', checks:[]};
function pass(name, data) { report.checks.push({name, ...data}); console.log('PASS',name,JSON.stringify(data)); }
async function image(url, label) {
  const r = useCurl ? await curlRequest({url,headers:{Referer:'https://yakshacomics.com/'}}) : await axios.get(url, {headers:{Referer:'https://yakshacomics.com/'},responseType:'arraybuffer',timeout:30000,maxContentLength:30000000});
  assert.equal(r.status,200);
  assert.match(r.headers['content-type'] || '', /^image\//);
  assert(r.data.length > 100);
  pass(label,{status:r.status,contentType:r.headers['content-type'],bytes:r.data.length});
}
(async () => {
  if (process.argv.includes('--pagination-only')) {
    const a = await source.getSearchResults({title:'the'},undefined);
    assert(a.results.length>0);assert(a.metadata,'Expected enough matches for another search page');
    const b = await source.getSearchResults({title:'the'},a.metadata);
    assert(b.results.length>0);
    assert.notEqual(a.results[0].mangaId,b.results[0].mangaId);
    pass('Search pagination',{query:'the',page1:a.results.length,page2:b.results.length});
    let metadata;const seen=new Set();let pages=0;
    do {
      const result=await source.getSearchResults({title:''},metadata);
      assert(result.results.every(item=>!seen.has(item.mangaId)),'Browse repeated an earlier title');
      result.results.forEach(item=>seen.add(item.mangaId));
      metadata=result.metadata;pages++;
      assert(pages<=15,'Browse failed to terminate');
    } while(metadata);
    pass('Browse termination',{pages,titles:seen.size});
    fs.writeFileSync('docs/live-pagination-results.json',JSON.stringify(report,null,2)+'\n');
    return;
  }
  const first = await source.getSearchResults({title:''},undefined);
  assert(first.results.length > 0);assert(first.metadata);
  pass('Browse page 1',{count:first.results.length,first:first.results[0].title});
  const second = await source.getSearchResults({title:''},first.metadata);
  assert(second.results.length > 0);
  assert.notEqual(second.results[0].mangaId,first.results[0].mangaId);
  pass('Browse page 2',{count:second.results.length,first:second.results[0].title});
  const search = await source.getSearchResults({title:'bone'},undefined);
  assert(search.results.some(x=>x.mangaId==='rebirth-of-the-strongest-white-bone-demon-in-journey-to-the-west'));
  pass('Search bone',{count:search.results.length});
  const empty = await source.getSearchResults({title:'zxqv-no-such-yaksha-title-93841'},undefined);
  assert.equal(empty.results.length,0);assert.equal(empty.metadata,undefined);
  pass('No-result search',{count:0});
  for(const id of ['rebirth-of-the-strongest-white-bone-demon-in-journey-to-the-west','infinite-evolution-starting-from-zero']) {
    const detail=await source.getMangaDetails(id);
    assert(detail.mangaInfo.desc.length>10);
    pass('Manga details',{id,title:detail.mangaInfo.titles[0],status:detail.mangaInfo.status});
    await image(detail.mangaInfo.image,'Cover image');
    const chapters=await source.getChapters(id);
    assert(chapters.length>1);
    assert.equal(new Set(chapters.map(c=>c.id)).size,chapters.length);
    pass('Chapter list',{id,count:chapters.length,first:chapters[0].id,last:chapters.at(-1).id});
    for(const chapter of [chapters[0],chapters.at(-1)]) {
      const details=await source.getChapterDetails(id,chapter.id);
      assert(details.pages.length>0);
      assert(details.pages.every(p=>/^https:\/\//.test(p)));
      pass('Reader pages',{id,chapter:chapter.id,count:details.pages.length});
      await image(details.pages[0],'First reader image');
      if(details.pages.length>1) await image(details.pages.at(-1),'Last reader image');
    }
  }
  fs.mkdirSync('docs',{recursive:true});
  fs.writeFileSync('docs/live-test-results.json',JSON.stringify(report,null,2)+'\n');
  console.log('LIVE TEST PASSED — iPhone validation still required.');
})().catch(error=>{console.error('LIVE TEST FAILED:',error.message);process.exitCode=1;});
