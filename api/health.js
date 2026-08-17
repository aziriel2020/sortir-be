export default async function handler(req,res){
  try{
    const origin=`${req.headers['x-forwarded-proto']||'https'}://${req.headers.host}`;
    const r=await fetch(`${origin}/api/live?health=${Date.now()}`,{cache:'no-store'});
    const p=await r.json();
    const ageMs=Date.now()-Date.parse(p.generatedAt||0);
    res.setHeader('Cache-Control','no-store');
    res.status(r.ok?200:503).json({ok:r.ok,fresh:Number.isFinite(ageMs)&&ageMs<=45*60_000,generatedAt:p.generatedAt||null,ageMinutes:Number.isFinite(ageMs)?Math.round(ageMs/60000):null,events:Array.isArray(p.events)?p.events.length:0,stats:p.stats||null});
  }catch(e){res.status(503).json({ok:false,error:e.message||String(e)});}
}
