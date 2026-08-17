import fs from 'node:fs';
import {collectSource,dedupe,loadSources,pool} from './core.mjs';

function futureEvents(payload){
  const now=Date.now();
  return (payload?.events||[]).filter(e=>{
    const end=Date.parse(e.end||e.start||0);
    return Number.isFinite(end)&&end>=now-36*3600_000;
  });
}

export function loadDirectSources(path=process.env.SORTIR_SOURCE_CONFIG||'config/sources.generated.json'){
  return loadSources(path).filter(s=>s.access==='direct');
}


export async function runLiveScan(previous,{sources=null,concurrency=12,mode='vercel-live'}={}){
  const started=Date.now();
  const all=sources||loadDirectSources();
  const results=await pool(all,concurrency,async source=>{
    try{return await collectSource(source,{deep:false});}
    catch(error){return {source,events:[],ok:false,reachable:false,pages:0,rateLimited:false,error:error?.message||String(error)};}
  });

  const freshEvents=results.flatMap(r=>r.events||[]);
  const prior=futureEvents(previous);
  const merged=dedupe([...freshEvents,...prior]);
  const successful=results.filter(r=>r.ok);
  const productive=successful.filter(r=>(r.events||[]).length>0);
  const attemptedAt=new Date().toISOString();
  const accepted=freshEvents.length>=8&&productive.length>=4;

  const baseStats=previous?.stats||{};
  const scanStats={
    registeredSources:baseStats.registeredSources??623,
    automaticSources:all.length,
    reachableSources:results.filter(r=>r.reachable).length,
    productiveSources:productive.length,
    emptySources:successful.length-productive.length,
    errorSources:results.filter(r=>!r.ok&&!r.rateLimited).length,
    rateLimitedSources:results.filter(r=>r.rateLimited).length,
    successfulSources:successful.length,
    rawEvents:freshEvents.length,
    deduplicatedEvents:merged.length,
    duplicateEventsRemoved:Math.max(0,freshEvents.length+prior.length-merged.length),
    retainedPrevious:prior.length>0,
    recoveredPreviousEvents:Math.max(0,merged.length-dedupe(freshEvents).length),
    coverageRegression:freshEvents.length<Math.max(8,(previous?.events||[]).length*0.15),
    publicSources:baseStats.publicSources??478,
    protectedSources:baseStats.protectedSources??45,
    durationMs:Date.now()-started,
    collectorMode:mode,
    collectorVersion:'18.4.0-live-runtime',
    collectorAttemptedAt:attemptedAt,
    scanAccepted:accepted,
  };

  if(accepted){
    return {
      accepted:true,
      payload:{
        generatedAt:attemptedAt,
        events:merged,
        stats:{...baseStats,...scanStats,fresh:true,ageMs:0,dataOrigin:'vercel-live-scan'}
      },
      results
    };
  }

  // IMPORTANT: failed scan does NOT rewrite the historic productive-source stats.
  // We expose the failed attempt separately so the UI never lies with 0/100.
  return {
    accepted:false,
    payload:{
      ...(previous||{generatedAt:null,events:[]}),
      stats:{
        ...baseStats,
        fresh:false,
        dataOrigin:'stale-snapshot',
        liveScanAttemptedAt:attemptedAt,
        liveScanProductiveSources:productive.length,
        liveScanSuccessfulSources:successful.length,
        liveScanErrorSources:scanStats.errorSources,
        liveScanRateLimitedSources:scanStats.rateLimitedSources,
        liveScanRawEvents:freshEvents.length,
        liveScanDurationMs:scanStats.durationMs,
        liveScanAccepted:false,
      }
    },
    results
  };
}
