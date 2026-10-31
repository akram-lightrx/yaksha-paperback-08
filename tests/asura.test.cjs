const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cheerio=require('cheerio');
require('@paperback/runtime-polyfills');
const BASE='https://asurascans.com';
function source(respond){
  assert(fs.existsSync('bundles/AsuraScans/source.js'),'Asura Scans bundle is missing');
  const {AsuraScans}=require('../bundles/AsuraScans/source.js').Sources;
  const s=new AsuraScans(cheerio);
  s.requestManager.schedule=async req=>({status:200,headers:{},request:req,data:await respond(req)});
  return s;
}
function astro(value){
  if(Array.isArray(value)) return [1,value.map(astro)];
  if(value && typeof value==='object') return [0,Object.fromEntries(Object.entries(value).map(([k,v])=>[k,astro(v)]))];
  return [0,value];
}
function island(value){return '<astro-island props="'+JSON.stringify(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,astro(v)]))).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></astro-island>'}
const listing={data:[{public_url:'/comics/solo-test',title:'Solo Test',cover:'https://cdn.example/cover.jpg'}],meta:{has_more:true}};
test('Asura search uses query and offset and stops on API pagination',async()=>{
  const requests=[];
  const s=source(r=>{requests.push(r.url);return JSON.stringify(requests.length===1?listing:{data:[],meta:{has_more:false}})});
  const a=await s.getSearchResults({title:' solo & test '},undefined);
  assert.equal(a.results[0].mangaId,'solo-test');assert.equal(a.results[0].title,'Solo Test');
  const b=await s.getSearchResults({title:' solo & test '},a.metadata);
  assert.match(requests[0],/search=solo%20%26%20test/);assert.match(requests[1],/offset=20(?:&|$)/);
  assert.equal(b.results.length,0);assert.equal(b.metadata,undefined);
});
test('Asura empty search browses and duplicate cards are removed',async()=>{
  const s=source(r=>{assert(!r.url.includes('search='));return JSON.stringify({...listing,data:[listing.data[0],listing.data[0]]})});
  assert.equal((await s.getSearchResults({title:''},undefined)).results.length,1);
});
test('Asura details select complete Astro series data and strip HTML',async()=>{
  const s=source(()=>island({title:'Unrelated widget'})+island({title:'Solo Test',coverUrl:'//cdn.example/cover.jpg',description:'<p>A hero &amp; a friend.</p>',author:'Author',artist:'Artist',status:'completed'}));
  const m=await s.getMangaDetails('solo-test');assert.equal(m.id,'solo-test');
  assert.deepEqual(m.mangaInfo.titles,['Solo Test']);assert.equal(m.mangaInfo.image,'https://cdn.example/cover.jpg');
  assert.equal(m.mangaInfo.desc,'A hero & a friend.');assert.equal(m.mangaInfo.status,'COMPLETED');
});
test('Asura chapter list retains decimals and excludes all premium variants',async()=>{
  const chapters=[{number:1,created_at:'2026-01-01T00:00:00Z'},{number:2.5,title:'Extra'},{number:3,is_premium:true},{number:4,is_locked:true},{number:5,early_access_until:'2999-01-01T00:00:00Z'},{number:6,early_access_until:'2000-01-01T00:00:00Z'},{number:2.5,title:'Duplicate'}];
  const s=source(()=>island({chapters}));
  const c=await s.getChapters('solo-test');assert.deepEqual(c.map(x=>x.chapNum),[6,2.5,1]);
  assert.equal(c[1].id,'2.5');assert.equal(c[1].name,'Chapter 2.5 - Extra');
});
test('Asura reader keeps two pages in order and excludes unrelated images',async()=>{
  const s=source(r=>{assert.equal(r.url,BASE+'/comics/solo-test/chapter/2.5');return '<img src="/ad.jpg">'+island({pages:[{url:'//cdn.example/first.jpg'},{url:'https://cdn.example/last.jpg'}]})});
  assert.deepEqual((await s.getChapterDetails('solo-test','2.5')).pages,['https://cdn.example/first.jpg','https://cdn.example/last.jpg']);
});
test('Asura reader carries tile metadata for image interceptor',async()=>{
  const s=source(()=>island({pages:[{url:'https://cdn.example/page.jpg',tiles:[1,0,3,2],tile_cols:2,tile_rows:2}]}));
  const c=await s.getChapterDetails('solo-test','1');
  const meta=JSON.parse(decodeURIComponent(c.pages[0].split('#')[1]));
  assert.deepEqual(meta,{tiles:[1,0,3,2],tileCols:2,tileRows:2});
});
test('Asura reports unavailable content and malformed API responses',async()=>{
  const s=source(()=>'<title>Access unavailable</title>');
  await assert.rejects(s.getSearchResults({title:'x'},undefined),/Asura.*(response|search|JSON)/i);
  await assert.rejects(s.getMangaDetails('solo-test'),/Asura.*details/i);
  await assert.rejects(s.getChapterDetails('solo-test','1'),/Asura.*(images|chapter)/i);
  await assert.rejects(source(()=>JSON.stringify({error:'Denied'})).getSearchResults({title:'x'},undefined),/Asura.*(response|search)/i);
});
test('Asura rejects HTTP failures and path traversal before returning results',async()=>{
  const s=source(()=>{throw Error('Network must not be called')});
  await assert.rejects(s.getMangaDetails('../other'),/Invalid.*ID/i);
  await assert.rejects(s.getChapterDetails('solo-test','../1'),/Invalid.*ID/i);
  s.requestManager.schedule=async request=>({status:403,data:'Denied',headers:{},request});
  await assert.rejects(s.getSearchResults({title:''},undefined),/HTTP 403/);
});
test('Asura image requests use site headers and native canvas restores tile order',async()=>{
  const s=source(()=>{});
  const encoded=encodeURIComponent(JSON.stringify({tiles:[1,0,3,2],tileCols:2,tileRows:2}));
  const request=await s.requestManager.interceptor.interceptRequest({url:'https://cdn.example/page.jpg#'+encoded,method:'GET'});
  assert.equal(request.headers.Referer,BASE+'/');assert.equal(request.headers.Origin,BASE);
  const oldImage=App.createPBImage,oldCanvas=App.createPBCanvas;
  try{
    App.createPBImage=({data})=>({width:2,height:2,data});
    App.createPBCanvas=()=>{const pixels=[];return {setSize(w,h){assert.equal(w,2);assert.equal(h,2)},drawImage(img,sx,sy,sw,sh,dx,dy){assert.equal(sw,1);assert.equal(sh,1);pixels[dy*2+dx]=img.data[sy*2+sx]},encode(format){assert.equal(format,'image/jpeg');return pixels}}};
    const response=await s.requestManager.interceptor.interceptResponse({status:200,headers:{},rawData:['B','A','D','C'],request});
    assert.deepEqual(response.rawData,['A','B','C','D']);
  }finally{App.createPBImage=oldImage;App.createPBCanvas=oldCanvas}
});
test('Asura rejects invalid tile maps instead of displaying corrupt pages',async()=>{
  const s=source(()=>island({pages:[{url:'https://cdn.example/page.jpg',tiles:[0,0,2,3],tile_cols:2,tile_rows:2}]}));
  await assert.rejects(s.getChapterDetails('solo-test','1'),/tile|image/i);
});
