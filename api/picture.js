import {sourceImages} from './_source-images.mjs';
const GIF=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==','base64');
export default async function handler(req,res){
  const source=String(req.query?.url||'');
  const images=await sourceImages(source);
  if(images[0]){res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');res.setHeader('Location',images[0]);return res.status(302).end();}
  res.setHeader('Content-Type','image/gif');res.setHeader('Cache-Control','public, s-maxage=300');return res.status(200).send(GIF);
}
