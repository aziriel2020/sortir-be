import fs from 'node:fs';
import path from 'node:path';
import {runLiveScan} from '../collector/live-runtime.mjs';

const FRESH_MS=15*60_000;

async function fromGithub(){
  const owner=process.env.SORTIR_GITHUB_OWNER||process.env.VERCEL_GIT_REPO_OWNER;
  const repo=process.env.SORTIR_GITHUB_REPO||process.env.VERCEL_GIT_REPO_SLUG;
  const branch=process.env.SORTIR_DATA_BRANCH||'main';
  if(!owner||!repo)return null;
  const url=`https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/public/events-snapshot.json?ts=${Date.now()}`;
  const r=await fetch(url,{cache:'no-store',headers:{'user-agent':'SORTIR.BE-live-api/18.4','accept':'application/json'}});
  if(!r.ok)throw new Error(`GitHub snapshot HTTP ${r.status}`);
  return await r.json();
}

function localFallback(){
  for(const p of [path.join(process.cwd(),'public/events-snapshot.json'),path.join(process.cwd(),'dist/events-snapshot.json')]){
    try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{}
  }
  return null;
}

function decorate(payload,origin){
  const ageMs=Date.now()-Date.parse(payload?.generatedAt||0);
  const fresh=Number.isFinite(ageMs)&&ageMs<=FRESH_MS;
  return {...payload,stats:{...(payload?.stats||{}),fresh,ageMs,dataOrigin:origin}};
}

export default async function handler(req,res){
  try{
    let base=null,origin='deployment-snapshot';
    try{base=await fromGithub(); if(base)origin='github-snapshot';}catch(e){console.warn('[SORTIR live] GitHub fallback:',e.message);}
    base ||= localFallback();
    if(!base)return res.status(503).json({error:'No event snapshot available'});

    let payload=decorate(base,origin);
    const force=String(req.query?.refresh||'0')!=='0';
    const passive=String(req.query?.passive||'0')==='1';

    // Real live behavior: stale data or a manual Refresh triggers the 100 direct radars.
    if(!passive&&(force||payload.stats.fresh===false)){
      try{
        const scan=await runLiveScan(base,{concurrency:12,mode:force?'manual-refresh':'window-refresh'});
        payload=scan.payload;
        if(!scan.accepted){
          const ageMs=Date.now()-Date.parse(base.generatedAt||0);
          payload.stats={...payload.stats,fresh:false,ageMs,dataOrigin:origin};
        }
      }catch(error){
        console.error('[SORTIR live] scan failed:',error);
        const ageMs=Date.now()-Date.parse(base.generatedAt||0);
        payload={...base,stats:{...(base.stats||{}),fresh:false,ageMs,dataOrigin:origin,liveScanError:error?.message||String(error)}};
      }
    }

    // Manual refresh must never be cached. Automatic 15-min window requests can be shared by Vercel CDN.
    if(force)res.setHeader('Cache-Control','private, no-store, max-age=0');
    else res.setHeader('Cache-Control','public, s-maxage=840, stale-while-revalidate=60');
    res.setHeader('X-Sortir-Data-Fresh',payload.stats?.fresh?'1':'0');
    res.setHeader('X-Sortir-Data-Origin',payload.stats?.dataOrigin||'unknown');
    return res.status(200).json(payload);
  }catch(e){
    console.error('[SORTIR live] fatal:',e);
    return res.status(500).json({error:e?.message||String(e)});
  }
}
