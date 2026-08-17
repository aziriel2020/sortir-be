import {collectSource,dedupe,loadSources,pool} from './core.mjs';

export function loadDirectSources(path=process.env.SORTIR_SOURCE_CONFIG||'config/sources.generated.json'){
  return loadSources(path).filter(s=>s.access==='direct');
}

export async function runLiveScan(_previousIgnored,{sources=null,concurrency=12,mode='vercel-live'}={}){
  const started=Date.now();
  const all=sources||loadDirectSources();
  const results=await pool(all,concurrency,async source=>{
    try{return await collectSource(source,{deep:false});}
    catch(error){return {source,events:[],ok:false,reachable:false,pages:0,rateLimited:false,error:error?.message||String(error)};}
  });
  const freshEvents=results.flatMap(r=>r.events||[]);
  const events=dedupe(freshEvents);
  const successful=results.filter(r=>r.ok);
  const productive=successful.filter(r=>(r.events||[]).length>0);
  const attemptedAt=new Date().toISOString();
  const minProductive=Math.max(4,Math.min(all.length,Math.ceil(all.length*0.04)));
  const accepted=events.length>=8&&productive.length>=minProductive;
  const stats={
    registeredSources:loadSources().length,
    automaticSources:all.length,
    reachableSources:results.filter(r=>r.reachable).length,
    productiveSources:productive.length,
    emptySources:successful.length-productive.length,
    errorSources:results.filter(r=>!r.ok&&!r.rateLimited).length,
    rateLimitedSources:results.filter(r=>r.rateLimited).length,
    successfulSources:successful.length,
    rawEvents:freshEvents.length,
    deduplicatedEvents:events.length,
    duplicateEventsRemoved:Math.max(0,freshEvents.length-events.length),
    publicSources:loadSources().filter(s=>s.access==='public').length,
    protectedSources:loadSources().filter(s=>s.access==='protected').length,
    durationMs:Date.now()-started,
    collectorMode:mode,
    collectorVersion:'18.5.0-live-only',
    collectorAttemptedAt:attemptedAt,
    scanAccepted:accepted,
    minProductiveRequired:minProductive,
    fresh:accepted,
    ageMs:accepted?0:null,
    dataOrigin:accepted?'vercel-live-scan':'live-scan-failed'
  };
  return {
    accepted,
    payload:{generatedAt:accepted?attemptedAt:null,events:accepted?events:[],stats},
    attemptStats:stats,
    results
  };
}
