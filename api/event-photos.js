import {sourceImages} from './_source-images.mjs';
export default async function handler(req,res){
  const source=String(req.query?.url||'');
  const images=await sourceImages(source);
  res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({photos:images.map(src=>({url:src,src}))});
}
