export default async function handler(req,res){
  try{
    const origin=`${req.headers['x-forwarded-proto']||'https'}://${req.headers.host}`;
    const r=await fetch(`${origin}/api/live?health=1&window=${Math.floor(Date.now()/900000)}`,{cache:'no-store'});
    const p=await r.json();
    res.setHeader('Cache-Control','no-store');
    return res.status(r.ok?200:503).json({ok:r.ok,fresh:r.ok&&p.stats?.fresh===true,generatedAt:p.generatedAt||null,events:Array.isArray(p.events)?p.events.length:0,stats:p.stats||null,error:p.error||null});
  }catch(e){return res.status(503).json({ok:false,error:e?.message||String(e)});}
}
