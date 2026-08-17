import fs from 'node:fs';
import path from 'node:path';

async function fromGithub(){
  const owner=process.env.SORTIR_GITHUB_OWNER||process.env.VERCEL_GIT_REPO_OWNER;
  const repo=process.env.SORTIR_GITHUB_REPO||process.env.VERCEL_GIT_REPO_SLUG;
  const branch=process.env.SORTIR_DATA_BRANCH||'main';
  if(!owner||!repo)return null;
  const url=`https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/public/events-snapshot.json?ts=${Date.now()}`;
  const r=await fetch(url,{cache:'no-store',headers:{'user-agent':'SORTIR.BE-live-api/18.3','accept':'application/json'}});
  if(!r.ok)throw new Error(`GitHub snapshot HTTP ${r.status}`);
  return await r.json();
}
function localFallback(){
  for(const p of [path.join(process.cwd(),'public/events-snapshot.json'),path.join(process.cwd(),'dist/events-snapshot.json')]){
    try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{}
  }
  return null;
}
export default async function handler(req,res){
  try{
    let payload=null,origin='deployment';
    try{payload=await fromGithub(); if(payload)origin='github-live-snapshot';}catch(e){console.warn(e.message);}
    payload ||= localFallback();
    if(!payload)return res.status(503).json({error:'No event snapshot available'});
    const ageMs=Date.now()-Date.parse(payload.generatedAt||0);
    const fresh=Number.isFinite(ageMs)&&ageMs<=45*60_000;
    payload={...payload,stats:{...(payload.stats||{}),fresh,ageMs,dataOrigin:origin}};
    if(!fresh){
      // The current frontend uses productiveSources to decide whether it may display the LIVE state.
      payload.stats.productiveSources=0;
      payload.stats.successfulSources=0;
    }
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-Sortir-Data-Fresh',fresh?'1':'0');
    res.status(200).json(payload);
  }catch(e){res.status(500).json({error:e.message||String(e)});}
}
