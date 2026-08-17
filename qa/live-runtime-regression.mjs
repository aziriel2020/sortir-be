import http from 'node:http';
import assert from 'node:assert/strict';
import {runLiveScan} from '../collector/live-runtime.mjs';

const base={
  generatedAt:'2026-08-15T18:34:18.058Z',
  events:[],
  stats:{registeredSources:623,automaticSources:100,productiveSources:95,successfulSources:95,publicSources:478,protectedSources:45}
};

const server=http.createServer((req,res)=>{
  const n=Number((req.url.match(/s(\d+)/)||[])[1]||1);
  const events=[1,2].map(i=>({
    '@type':'Event',
    name:`Mock event ${n}-${i}`,
    startDate:`2026-08-${20+n}T1${i}:00:00+02:00`,
    location:{'@type':'Place',name:`Venue ${n}`,address:{addressLocality:'Bruxelles'}},
    url:`http://127.0.0.1:${server.address().port}/event/${n}/${i}`
  }));
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><script type="application/ld+json">${JSON.stringify(events)}</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const sources=Array.from({length:4},(_,i)=>({id:`mock-${i+1}`,name:`Mock ${i+1}`,url:`http://127.0.0.1:${port}/s${i+1}`,format:'jsonld',access:'direct',city:'Bruxelles'}));
const ok=await runLiveScan(base,{sources,concurrency:4,mode:'qa'});
assert.equal(ok.accepted,true);
assert.equal(ok.payload.stats.fresh,true);
assert.equal(ok.payload.stats.productiveSources,4);
assert.ok(ok.payload.events.length>=8);
server.close();

const dead=Array.from({length:4},(_,i)=>({id:`dead-${i+1}`,name:`Dead ${i+1}`,url:`http://127.0.0.1:9/nope`,format:'jsonld',access:'direct',city:'Bruxelles'}));
const fail=await runLiveScan(base,{sources:dead,concurrency:4,mode:'qa-fail'});
assert.equal(fail.accepted,false);
assert.equal(fail.payload.stats.fresh,false);
assert.equal(fail.payload.stats.productiveSources,95); // historic real stat preserved
assert.equal(fail.payload.stats.liveScanProductiveSources,0);
console.log(JSON.stringify({acceptedScan:{events:ok.payload.events.length,productive:ok.payload.stats.productiveSources,fresh:ok.payload.stats.fresh},failedScan:{historicProductive:fail.payload.stats.productiveSources,liveAttemptProductive:fail.payload.stats.liveScanProductiveSources,fresh:fail.payload.stats.fresh}},null,2));
