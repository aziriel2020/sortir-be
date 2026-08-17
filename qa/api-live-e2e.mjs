import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const projectRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(projectRoot);

const sourceServer=http.createServer((req,res)=>{
  const n=Number((req.url.match(/s(\d+)/)||[])[1]||1);
  const events=[1,2].map(i=>({
    '@type':'Event',name:`API live mock ${n}-${i}`,
    startDate:`2026-08-${20+n}T1${i}:00:00+02:00`,
    location:{'@type':'Place',name:`Venue ${n}`,address:{addressLocality:'Bruxelles'}},
    url:`http://127.0.0.1:${sourceServer.address().port}/event/${n}/${i}`
  }));
  res.writeHead(200,{'content-type':'text/html'});
  res.end(`<script type="application/ld+json">${JSON.stringify(events)}</script>`);
});
await new Promise(r=>sourceServer.listen(0,'127.0.0.1',r));
const port=sourceServer.address().port;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sortir-live-e2e-'));
const cfg=path.join(dir,'sources.json');
fs.writeFileSync(cfg,JSON.stringify(Array.from({length:4},(_,i)=>({id:`mock-${i+1}`,name:`Mock ${i+1}`,url:`http://127.0.0.1:${port}/s${i+1}`,format:'jsonld',access:'direct',city:'Bruxelles'}))));
process.env.SORTIR_SOURCE_CONFIG=cfg;
delete process.env.VERCEL_GIT_REPO_OWNER;
delete process.env.VERCEL_GIT_REPO_SLUG;
const {default:handler}=await import('../api/live.js?test='+Date.now());
let code=0, body=null, headers={};
const req={query:{refresh:'1'},headers:{}};
const res={
  setHeader(k,v){headers[k.toLowerCase()]=v;},
  status(c){code=c;return this;},
  json(v){body=v;return this;}
};
await handler(req,res);
assert.equal(code,200);
assert.equal(body.stats.fresh,true);
assert.equal(body.stats.productiveSources,4);
assert.ok(body.events.length>=8);
assert.equal(headers['x-sortir-data-fresh'],'1');
console.log(JSON.stringify({status:code,fresh:body.stats.fresh,productiveSources:body.stats.productiveSources,events:body.events.length,origin:body.stats.dataOrigin},null,2));
sourceServer.close();
