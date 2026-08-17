import {runLiveScan} from '../collector/live-runtime.mjs';

export default async function handler(req,res){
  try{
    const force=String(req.query?.refresh||'0')!=='0';
    const scan=await runLiveScan(null,{concurrency:12,mode:force?'manual-refresh':'vercel-live'});
    if(!scan.accepted){
      const st=scan.attemptStats||scan.payload?.stats||{};
      res.setHeader('Cache-Control','private, no-store, max-age=0');
      res.setHeader('X-Sortir-Data-Fresh','0');
      return res.status(503).json({
        error:'Live collection failed or returned insufficient coverage',
        generatedAt:null,
        events:[],
        stats:{...st,fresh:false,dataOrigin:'live-scan-failed'}
      });
    }
    const payload=scan.payload;
    if(force)res.setHeader('Cache-Control','private, no-store, max-age=0');
    else res.setHeader('Cache-Control','public, s-maxage=840, stale-while-revalidate=60');
    res.setHeader('X-Sortir-Data-Fresh','1');
    res.setHeader('X-Sortir-Data-Origin','vercel-live-scan');
    return res.status(200).json(payload);
  }catch(e){
    console.error('[SORTIR live] fatal:',e);
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    return res.status(500).json({error:e?.message||String(e),generatedAt:null,events:[],stats:{fresh:false,dataOrigin:'live-scan-error'}});
  }
}
