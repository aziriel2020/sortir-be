#!/usr/bin/env node
import fs from 'node:fs';
import {collectSource,dedupe,loadSources,pool} from '../collector/core.mjs';

const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,v='true']=a.replace(/^--/,'').split('=');return[k,v]}));
const mode=args.mode||process.env.COLLECTOR_MODE||'fast';
const maxSources=Number(args['max-sources']||0);
const concurrency=Number(args.concurrency||(mode==='deep'?10:8));
const sourcePath='config/sources.generated.json';
const outPath='public/events-snapshot.json';
const statusPath='public/collector-status.json';
const started=Date.now();

if(!fs.existsSync(sourcePath)) throw new Error(`${sourcePath} missing; run node tools/extract-source-config.mjs`);
const all=loadSources(sourcePath);
let selected=all.filter(s=>s.access!=='protected');
if(mode==='fast') selected=selected.filter(s=>s.access==='direct');
if(mode==='deep') selected=selected.filter(s=>s.access==='public');
if(maxSources>0)selected=selected.slice(0,maxSources);

let previous={generatedAt:null,events:[],stats:{}};
try{previous=JSON.parse(fs.readFileSync(outPath,'utf8'));}catch{}

console.log(`SORTIR.BE collector mode=${mode} sources=${selected.length} concurrency=${concurrency}`);
let done=0;
const results=await pool(selected,concurrency,async s=>{
  const r=await collectSource(s,{deep:mode!=='fast'});
  done++;
  console.log(`${String(done).padStart(3)}/${selected.length} ${r.ok?'OK':'FAIL'} ${s.id} events=${r.events.length} pages=${r.pages}${r.error?' '+r.error:''}`);
  return r;
});

const fresh=results.flatMap(r=>r.events);
const now=Date.now();
const previousFuture=(previous.events||[]).filter(e=>{
  const end=Date.parse(e.end||e.start||0); return Number.isFinite(end)&&end>=now-36*3600_000;
});
// Keep prior future coverage; newly collected versions win during dedupe because they carry richer/current fields.
const merged=dedupe([...fresh,...previousFuture]);
const successful=results.filter(r=>r.ok), productive=successful.filter(r=>r.events.length>0);
const stats={
  registeredSources:all.length,
  automaticSources:all.filter(s=>s.access==='direct').length,
  reachableSources:results.filter(r=>r.reachable).length,
  productiveSources:productive.length,
  emptySources:successful.length-productive.length,
  errorSources:results.filter(r=>!r.ok&&!r.rateLimited).length,
  rateLimitedSources:results.filter(r=>r.rateLimited).length,
  successfulSources:successful.length,
  rawEvents:fresh.length,
  deduplicatedEvents:merged.length,
  duplicateEventsRemoved:Math.max(0,fresh.length+previousFuture.length-merged.length),
  retainedPrevious:previousFuture.length>0,
  recoveredPreviousEvents:Math.max(0,merged.length-dedupe(fresh).length),
  coverageRegression: fresh.length < Math.max(8,(previous.events||[]).length*0.15),
  publicSources:all.filter(s=>s.access==='public').length,
  protectedSources:all.filter(s=>s.access==='protected').length,
  durationMs:Date.now()-started,
  collectorMode:mode,
  collectorVersion:'18.4.0',
};
const attemptedAt=new Date().toISOString();
const scanIsFresh=fresh.length>=8 && productive.length>=4;
stats.collectorAttemptedAt=attemptedAt;
stats.scanAccepted=scanIsFresh;
// generatedAt means DATA freshness, not merely that the job ran. Never fake a fresh timestamp after a failed scan.
const generatedAt=scanIsFresh ? attemptedAt : (previous.generatedAt || attemptedAt);
const payload={generatedAt,events:merged,stats};
fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');
fs.writeFileSync(statusPath,JSON.stringify({generatedAt:payload.generatedAt,collectorAttemptedAt:attemptedAt,scanAccepted:scanIsFresh,mode,stats,sources:results.map(r=>({id:r.source.id,name:r.source.name,ok:r.ok,reachable:r.reachable,events:r.events.length,pages:r.pages,error:r.error,rateLimited:r.rateLimited}))},null,2)+'\n');
console.log(JSON.stringify({generatedAt:payload.generatedAt,events:merged.length,stats},null,2));
if(!scanIsFresh){
  console.error(`COLLECTOR_REJECTED: productive=${productive.length}, rawEvents=${fresh.length}. Keeping previous generatedAt=${payload.generatedAt}`);
  process.exitCode=2;
}
