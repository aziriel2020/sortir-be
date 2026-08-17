function absolute(u,base){try{return new URL(u,base).href}catch{return null}}
function uniq(xs){return [...new Set(xs.filter(Boolean))]}
export async function sourceImages(sourceUrl){
  if(!sourceUrl||!/^https?:/i.test(sourceUrl))return [];
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),7000);
  try{
    const r=await fetch(sourceUrl,{redirect:'follow',signal:ctrl.signal,headers:{'user-agent':'Mozilla/5.0 SORTIR.BE/18.5','accept':'text/html,*/*','accept-language':'fr-BE,fr;q=0.9,en;q=0.7'}});
    if(!r.ok)return [];
    const html=await r.text();
    const out=[];
    for(const re of [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/gi,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/gi
    ]){let m;while((m=re.exec(html)))out.push(absolute(m[1],r.url));}
    for(const m of html.matchAll(/["']image["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi))out.push(m[1].replace(/\\\//g,'/'));
    return uniq(out).slice(0,8);
  }catch{return [];}finally{clearTimeout(timer)}
}
