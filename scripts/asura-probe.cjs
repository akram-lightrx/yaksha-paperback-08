const cheerio=require('cheerio');
const fs=require('node:fs');
const BASE='https://asurascans.com';
async function fetchText(url){const r=await fetch(url,{headers:{Referer:BASE+'/',Origin:BASE,'User-Agent':'Paperback-iOS'},signal:AbortSignal.timeout(30000)});const t=await r.text();console.log('HTTP',r.status,url);if(!r.ok)throw Error('HTTP '+r.status+': '+t.slice(0,200));return t}
function unwrap(x){if(Array.isArray(x)){if(x.length===1&&Number.isInteger(x[0]))return null;if(x.length===2&&Number.isInteger(x[0]))return unwrap(x[1]);return x.map(unwrap)}if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,unwrap(v)]));return x}
(async()=>{
 const list=JSON.parse(await fetchText('https://api.asurascans.com/api/series?offset=0&limit=2&sort=popular&order=desc'));
 console.log('LIST',JSON.stringify(list));
 const first=list.data[0],slug=(first.public_url||first.slug).split('/').filter(Boolean).pop();
 const html=await fetchText(BASE+'/comics/'+slug),$=cheerio.load(html);
 const props=$('astro-island[props]').toArray().map(e=>{try{return unwrap(JSON.parse($(e).attr('props')))}catch{return {}}});
 console.log('ISLANDS',JSON.stringify(props.map(p=>({keys:Object.keys(p),title:p.title,coverUrl:p.coverUrl,chapterCount:p.chapters?.length,chapters:p.chapters?.slice(-3)}))));
 const chapters=props.find(p=>Array.isArray(p.chapters))?.chapters||[];
 const c=[...chapters].reverse().find(c=>!c.is_premium&&!c.is_locked&&!(Date.parse(c.early_access_until)>Date.now()));
 if(!c)throw Error('No public chapter');
 const reader=cheerio.load(await fetchText(BASE+'/comics/'+slug+'/chapter/'+c.number));
 const pages=reader('astro-island[props]').toArray().map(e=>{try{return unwrap(JSON.parse(reader(e).attr('props')))}catch{return {}}}).find(p=>Array.isArray(p.pages))?.pages;
 console.log('PAGES',JSON.stringify(pages));
})().catch(e=>{console.error(e);process.exitCode=1});
