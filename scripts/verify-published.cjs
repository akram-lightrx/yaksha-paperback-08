const assert=require('node:assert/strict');
const vm=require('node:vm');
const base='https://akram-lightrx.github.io/yaksha-paperback-08/';
(async()=>{
 let manifest;
 for(let attempt=0;attempt<8;attempt++){
  const r=await fetch(base+'versioning.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(r.ok){const m=await r.json();if(m.sources?.some(s=>s.id==='AsuraScans')){manifest=m;break}}
  await new Promise(r=>setTimeout(r,10000));
 }
 assert(manifest,'Published Asura manifest unavailable');
 assert.equal(manifest.builtWith.types,'0.8.7');assert.equal(manifest.builtWith.toolchain,'0.8.7');
 assert.deepEqual(manifest.sources.map(s=>s.id).sort(),['AsuraScans','YakshaComics']);
 for(const source of manifest.sources){
  const r=await fetch(base+source.id+'/source.js');assert.equal(r.status,200);
  const context=vm.createContext({});vm.runInContext(await r.text(),context);
  assert.equal(typeof context.Sources[source.id],'function');
  assert.equal(context.Sources[source.id+'Info'].version,source.version);
  const icon=await fetch(base+source.id+'/includes/'+source.icon);assert.equal(icon.status,200);
  const bytes=Buffer.from(await icon.arrayBuffer());assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 }
 const home=await fetch(base);assert.equal(home.status,200);
 const html=await home.text();assert(html.includes('paperback://addRepo'));assert(html.includes('Asura Scans'));
 console.log('PUBLIC_REPOSITORY_VERIFIED '+JSON.stringify({url:base,sources:manifest.sources.map(s=>({id:s.id,version:s.version})),builtWith:manifest.builtWith}));
})().catch(e=>{console.error(e);process.exitCode=1});
