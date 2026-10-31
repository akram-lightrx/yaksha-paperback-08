// Run the compiled source against public Asura endpoints. Native iOS canvas is device-only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cheerio=require('cheerio');
require('@paperback/runtime-polyfills');
const {AsuraScans}=require('../bundles/AsuraScans/source.js').Sources;
const s=new AsuraScans(cheerio),checks=[];
let lastRequest=0;
async function request(url,headers={}){
  const delay=Math.max(0,550-(Date.now()-lastRequest));
  if(delay)await new Promise(r=>setTimeout(r,delay));
  lastRequest=Date.now();
  const r=await fetch(url.split('#')[0],{headers:{'User-Agent':'Paperback-iOS',...headers},signal:AbortSignal.timeout(30000)});
  assert.equal(r.status,200,'HTTP '+r.status+' for '+url.split('#')[0]);
  return r;
}
s.requestManager.schedule=async raw=>{
  const req=await s.requestManager.interceptor.interceptRequest(raw);
  const r=await request(req.url,req.headers);
  const data=await r.text();
  if(req.url.includes('zzzzqnoresult'))console.log('ASURA_EMPTY_RESPONSE '+data.slice(0,1000));
  return s.requestManager.interceptor.interceptResponse({status:r.status,headers:Object.fromEntries(r.headers),data,request:req});
};
async function image(url,label){
  const req=await s.requestManager.interceptor.interceptRequest({url,method:'GET'});
  const r=await request(req.url,req.headers),bytes=Buffer.from(await r.arrayBuffer());
  assert.match(r.headers.get('content-type')||'',/^image\//);
  const kind=bytes.subarray(0,3).toString('hex')==='ffd8ff'?'jpeg':bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'png':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'webp':'unknown';
  assert.notEqual(kind,'unknown','Image response has no known binary signature');assert(bytes.length>100);
  checks.push({check:label,format:kind,bytes:bytes.length});
}
(async()=>{
  const browse1=await s.getSearchResults({title:''},undefined);
  const browse2=await s.getSearchResults({title:''},browse1.metadata);
  assert.equal(browse1.results.length,20);assert.equal(browse2.results.length,20);
  assert(browse2.results.some(x=>!browse1.results.some(y=>y.mangaId===x.mangaId)));
  checks.push({check:'browse pagination',pages:2,counts:[20,20]});
  const search1=await s.getSearchResults({title:'the'},undefined);
  assert(search1.metadata);const search2=await s.getSearchResults({title:'the'},search1.metadata);
  assert(search2.results.length);assert.notEqual(search1.results[0].mangaId,search2.results[0].mangaId);
  checks.push({check:'keyword pagination',counts:[search1.results.length,search2.results.length]});
  const empty=await s.getSearchResults({title:'zzzzqnoresultpbdemo123456'},undefined);
  assert.equal(empty.results.length,0);assert.equal(empty.metadata,undefined);checks.push({check:'empty search terminates'});
  for(const title of ['Overgeared','SSS-Class Suicide Hunter']){
    const found=await s.getSearchResults({title},undefined);
    const tile=found.results.find(x=>x.title.toLowerCase()===title.toLowerCase());
    assert(tile,'Search did not find '+title);
    const details=await s.getMangaDetails(tile.mangaId);
    assert.equal(details.mangaInfo.titles[0],title);assert(details.mangaInfo.desc.length>20);
    await image(details.mangaInfo.image,title+' cover');
    const chapters=await s.getChapters(tile.mangaId);
    assert(chapters.length>10);
    checks.push({check:'series',title,id:tile.mangaId,chapters:chapters.length});
    for(const c of [chapters[0],chapters.at(-1)]){
      const reader=await s.getChapterDetails(tile.mangaId,c.id);
      assert(reader.pages.length>1);
      let tiled=0;
      for(const url of reader.pages){
        assert.match(url,/^https:\/\//);
        if(url.includes('#')){
          const m=JSON.parse(decodeURIComponent(url.split('#')[1]));assert.equal(m.tiles.length,m.tileCols*m.tileRows);
          assert.equal(new Set(m.tiles).size,m.tiles.length);tiled++;
        }
      }
      checks.push({check:'reader',title,chapter:c.chapNum,pages:reader.pages.length,tiled});
      await image(reader.pages[0],title+' '+c.chapNum+' first image');
      await image(reader.pages.at(-1),title+' '+c.chapNum+' last image');
    }
  }
  const report={testedAt:new Date().toISOString(),sourceVersion:'1.0.0',transport:'Node fetch through compiled-source request and response interceptors',nativeCanvas:'Tile mapping unit-tested; native iPhone rendering remains unverified.',checks};
  fs.writeFileSync('docs/asura-live-test-results.json',JSON.stringify(report,null,2)+'\n');
  console.log('ASURA_LIVE_RESULT '+JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
