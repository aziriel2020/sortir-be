import fs from 'node:fs';
import crypto from 'node:crypto';

const UA = 'SORTIR.BE/18.3 (+https://sortir.be; public-event-indexer)';
const DEFAULT_TIMEOUT = 12000;
const TODAY = new Date();
const EVENT_WORDS = /(?:agenda|event|events|evenement|evenementen|activit|calendar|programme|program|concert|festival|party|soir|expo|show|meetup|ticket|spectacle|manifestation|uitagenda|uit-in|what.?s.?on)/i;
const IGNORE_HREF = /(?:login|signin|account|privacy|terms|cookie|facebook\.com\/sharer|twitter\.com\/intent|mailto:|javascript:|#)/i;

export function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
export function cleanText(v='') {
  return String(v)
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ').trim();
}
export function slug(v='') {
  return cleanText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
}
export function normalizeTitle(v='') {
  return slug(v).replace(/\b(the|le|la|les|de|du|des|een|het|de|a|an)\b/g,'').replace(/-+/g,'-');
}
export function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = new Date(v < 1e12 ? v*1000 : v);
    return Number.isNaN(+d) ? null : d.toISOString();
  }
  const s = cleanText(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d.toISOString();
}
function first(obj, keys) {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return null;
}
function asArray(v){ return v == null ? [] : Array.isArray(v) ? v : [v]; }

export function provinceFor(city='', address='') {
  const x = `${city} ${address}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const map = [
    ['Bruxelles-Capitale', /brux|ixelles|elsene|etterbeek|schaerbeek|schaarbeek|molenbeek|uccle|ukkel|jette|auderghem|oudergem|ganshoren|koekelberg|evere|forest|vorst|woluwe|saint-gilles|sint-gillis|saint-josse/],
    ['Anvers', /antwerp|antwerpen|mechelen|malines|turnhout|sint-niklaas/],
    ['Flandre-Orientale', /gent|ghent|gand|aalst|alost|lokeren|dendermonde/],
    ['Flandre-Occidentale', /brugge|bruges|kortrijk|courtrai|oostende|ostende|roeselare|roulers/],
    ['Brabant flamand', /leuven|louvain|vilvoorde|halle|diest/],
    ['Limbourg', /hasselt|genk|tongeren|sint-truiden/],
    ['Hainaut', /charleroi|mons|bergen|tournai|doornik|la louviere/],
    ['Liège', /liege|luik|verviers|eupen|malmedy|spa|stavelot/],
    ['Namur', /namur|namen|dinant|ciney/],
    ['Luxembourg', /arlon|aarlen|marche-en-famenne|bastogne|libramont/],
    ['Brabant wallon', /wavre|nivelles|waterloo|ottignies|louvain-la-neuve/],
  ];
  for (const [p,re] of map) if (re.test(x)) return p;
  return 'Province à confirmer';
}

export async function fetchText(url, {timeout=DEFAULT_TIMEOUT, maxBytes=6_000_000, headers={}}={}) {
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      redirect:'follow', signal:ctrl.signal,
      headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8','accept-language':'fr-BE,fr;q=0.9,nl;q=0.8,en;q=0.7',...headers}
    });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`),{status:r.status});
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > maxBytes) throw new Error(`too large ${buf.length}`);
    return {text:buf.toString('utf8'), contentType:r.headers.get('content-type')||'', finalUrl:r.url, status:r.status};
  } finally { clearTimeout(timer); }
}

function locationFrom(ld) {
  let loc = ld?.location;
  if (Array.isArray(loc)) loc = loc[0];
  if (typeof loc === 'string') return {venue:loc,address:'',city:''};
  const addr = loc?.address || ld?.address || {};
  const address = typeof addr === 'string' ? addr : [addr.streetAddress,addr.postalCode,addr.addressLocality,addr.addressRegion,addr.addressCountry].filter(Boolean).join(', ');
  const city = typeof addr === 'object' ? (addr.addressLocality||'') : '';
  return {venue:cleanText(loc?.name||ld?.venue?.name||''),address:cleanText(address),city:cleanText(city)};
}
function imagesFrom(v) {
  const out=[];
  for (const x of asArray(v)) {
    const u = typeof x==='string' ? x : x?.url || x?.contentUrl;
    if (u && /^https?:/i.test(u) && !out.includes(u)) out.push(u);
  }
  return out.slice(0,8);
}

export function eventFromObject(obj, source, pageUrl) {
  if (!obj || typeof obj !== 'object') return null;
  const type = asArray(obj['@type']||obj.type).join(' ');
  const startRaw = first(obj,['startDate','start','start_time','startTime','date_start','dateStart','startsAt','starts_at','begin','from','date']);
  const endRaw = first(obj,['endDate','end','end_time','endTime','date_end','dateEnd','endsAt','ends_at','until','to']);
  const title = cleanText(first(obj,['name','title','eventName','event_name','label','summary'])||'');
  const start = isoDate(startRaw);
  if (!title || !start) return null;
  if (type && !/event|festival|concert|exhibition|screening|theater|social/i.test(type) && !obj.location && !obj.url) return null;
  const end = isoDate(endRaw);
  const st = new Date(start), en = end ? new Date(end) : null;
  if (Number.isNaN(+st)) return null;
  if ((en ? +en : +st) < Date.now()-36*3600_000) return null;
  const loc = locationFrom(obj);
  const city = cleanText(loc.city || source.city || inferCityFromText(`${loc.address} ${title}`));
  const address = cleanText(loc.address || source.address || (city ? `${city}, Belgique` : 'Belgique'));
  const venue = cleanText(loc.venue || source.venue || '');
  const url = first(obj,['url','eventUrl','event_url','link']) || pageUrl || source.url;
  let finalUrl;
  try { finalUrl = new URL(url,pageUrl||source.url).href; } catch { finalUrl=pageUrl||source.url; }
  const status = String(first(obj,['eventStatus','status'])||'');
  if (/cancel/i.test(status)) return null;
  const dateOnly = typeof startRaw==='string' && /^\d{4}-\d{2}-\d{2}$/.test(startRaw.trim());
  const id = slug(first(obj,['identifier','id','@id']) || `${title}-${start.slice(0,10)}-${city}-${finalUrl}`) || crypto.createHash('sha1').update(`${title}|${start}|${finalUrl}`).digest('hex').slice(0,20);
  return {
    id, title, start, ...(end?{end}:{}), venue, address, city,
    province:provinceFor(city,address), images:imagesFrom(obj.image||obj.images||obj.photo||obj.thumbnail),
    dateOnly, url:finalUrl, sourceName:source.name,
    collectedAt:new Date().toISOString(), sourceId:source.id
  };
}

export function extractJsonLd(html, source, pageUrl) {
  const out=[];
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const visit=(v)=>{
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v!=='object') return;
    const ev=eventFromObject(v,source,pageUrl); if(ev) out.push(ev);
    if (v['@graph']) visit(v['@graph']);
    if (v.itemListElement) visit(v.itemListElement.map(x=>x?.item||x));
  };
  while((m=re.exec(html))){
    let raw=m[1].trim();
    try { visit(JSON.parse(raw)); } catch {
      try { visit(JSON.parse(raw.replace(/\n/g,' '))); } catch {}
    }
  }
  return out;
}

export function extractHtmlFallback(html, source, pageUrl) {
  const title = cleanText((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)||[])[1] || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1] || '');
  const start = (html.match(/itemprop=["']startDate["'][^>]+content=["']([^"']+)/i)||[])[1] || (html.match(/<time[^>]+datetime=["']([^"']+)/i)||[])[1];
  const end = (html.match(/itemprop=["']endDate["'][^>]+content=["']([^"']+)/i)||[])[1];
  const image = (html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i)||[])[1];
  const obj={name:title,startDate:start,endDate:end,image};
  return eventFromObject(obj,source,pageUrl);
}

export function extractLinks(html, baseUrl, source, limit=30) {
  const out=[];
  const pat = source.eventLinkPattern ? new RegExp(source.eventLinkPattern,'i') : null;
  const re=/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html)) && out.length<limit*4){
    const href=m[2], attrs=`${m[1]} ${m[3]}`, txt=cleanText(m[4]);
    if (!href || IGNORE_HREF.test(href)) continue;
    let u; try{u=new URL(href,baseUrl);}catch{continue;}
    let b; try{b=new URL(baseUrl);}catch{continue;}
    if (u.hostname!==b.hostname && !source.allowCrossOrigin) continue;
    const required=source.requiredLinkAttribute;
    if (required) { try{ if(!new RegExp(required,'i').test(attrs)) continue; }catch{} }
    const match = pat ? pat.test(u.pathname) : EVENT_WORDS.test(`${u.pathname} ${txt}`);
    if (!match) continue;
    u.hash='';
    const val=u.href;
    if(!out.includes(val)) out.push(val);
  }
  return out.slice(0,limit);
}

export function parseIcs(text,source,url){
  const unfolded=text.replace(/\r?\n[ \t]/g,'');
  const blocks=unfolded.split('BEGIN:VEVENT').slice(1).map(x=>x.split('END:VEVENT')[0]);
  const get=(b,k)=>{const m=b.match(new RegExp(`^${k}(?:;[^:]*)?:(.*)$`,'mi')); return m?.[1]?.trim()||''};
  const dt=v=>{
    if(!v)return null;
    if(/^\d{8}T\d{6}Z$/.test(v))return isoDate(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}Z`);
    if(/^\d{8}T\d{6}$/.test(v))return isoDate(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}+02:00`);
    if(/^\d{8}$/.test(v))return isoDate(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`);
    return isoDate(v);
  };
  return blocks.map(b=>eventFromObject({
    identifier:get(b,'UID'), name:get(b,'SUMMARY'), startDate:dt(get(b,'DTSTART')), endDate:dt(get(b,'DTEND')),
    location:get(b,'LOCATION'), url:get(b,'URL')||url
  },source,url)).filter(Boolean);
}

function inferCityFromText(t='') {
  const cities=['Bruxelles','Antwerpen','Anvers','Gent','Gand','Brugge','Bruges','Leuven','Louvain','Hasselt','Mechelen','Malines','Kortrijk','Courtrai','Oostende','Ostende','Liège','Liege','Namur','Charleroi','Mons','Tournai','Verviers','Wavre','Arlon','Nivelles','Dinant','Eupen','Genk','Aalst'];
  const s=t.toLowerCase();
  return cities.find(c=>s.includes(c.toLowerCase()))||'';
}

export function parseJsonApi(data,source,url){
  const out=[]; const seen=new Set();
  const visit=(v,depth=0)=>{
    if(depth>8||v==null)return;
    if(Array.isArray(v)){for(const x of v)visit(x,depth+1);return;}
    if(typeof v!=='object')return;
    const ev=eventFromObject(v,source,url);
    if(ev&&!seen.has(ev.id)){seen.add(ev.id);out.push(ev);}
    for(const [k,x] of Object.entries(v)) if(/events|items|results|data|hits|records|entries|nodes|edges/i.test(k)) visit(x,depth+1);
  }; visit(data); return out;
}

export function dedupe(events){
  const map=new Map();
  for(const e of events){
    if(!e?.title||!e?.start)continue;
    const day=e.start.slice(0,10), key=`${normalizeTitle(e.title)}|${day}|${slug(e.city||e.venue||'belgium')}`;
    const old=map.get(key);
    if(!old){map.set(key,e);continue;}
    const score=x=>(x.images?.length||0)*3+(x.address?2:0)+(x.venue?2:0)+(x.url?1:0)+(x.sourceId?1:0);
    const best=score(e)>score(old)?e:old, other=best===e?old:e;
    best.images=[...new Set([...(best.images||[]),...(other.images||[])])].slice(0,8);
    map.set(key,best);
  }
  return [...map.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}

export function loadSources(path='config/sources.generated.json') { return JSON.parse(fs.readFileSync(path,'utf8')); }

export async function collectSource(source,{deep=false}={}){
  const maxBytes=source.maxPageBytes||6_000_000;
  const ret={source,events:[],ok:false,error:null,rateLimited:false,reachable:false,pages:0};
  if(source.access==='protected') return {...ret,error:'protected'};
  try{
    if(source.format==='discord') return {...ret,error:'protected'};
    const pages=[];
    const pageCount=deep?(source.listingPages||1):(source.liveListingPages||1);
    if(source.listingPageTemplate){
      for(let i=1;i<=pageCount;i++)pages.push(source.listingPageTemplate.replace('{page}',i));
    } else if(source.listingPageParam && pageCount>1){
      pages.push(source.url);
      for(let i=1;i<pageCount;i++){
        const u=new URL(source.url); u.searchParams.set(source.listingPageParam,String(i)); pages.push(u.href);
      }
    } else pages.push(source.url);
    let listingEvents=[]; const detailLinks=[];
    for(const page of pages){
      const r=await fetchText(page,{maxBytes}); ret.pages++; ret.reachable=true;
      const ct=r.contentType.toLowerCase();
      if(source.format==='ics'||ct.includes('text/calendar')||/BEGIN:VCALENDAR/.test(r.text)) listingEvents.push(...parseIcs(r.text,source,r.finalUrl));
      else if(ct.includes('json')||source.format==='api'){
        try{listingEvents.push(...parseJsonApi(JSON.parse(r.text),source,r.finalUrl));}catch{}
      } else if(source.format==='reddit'||ct.includes('rss')||ct.includes('xml')){
        const links=[...r.text.matchAll(/<link>(?:<!\[CDATA\[)?([^<\]]+)/gi)].map(m=>cleanText(m[1])).filter(x=>/^https?:/.test(x));
        detailLinks.push(...links.slice(0,deep?30:12));
      } else {
        listingEvents.push(...extractJsonLd(r.text,source,r.finalUrl));
        const fb=extractHtmlFallback(r.text,source,r.finalUrl); if(fb)listingEvents.push(fb);
        let lim=source.liveMaxLinks||source.maxLinks||((source.format==='jsonld'||source.format==='visitbrussels')?16:8);
        if(!deep) lim=Math.min(lim,source.liveMaxLinks||16);
        else lim=Math.min(lim,source.access==='public'?4:(source.maxLinks||40));
        // Structured listing pages (Eventbrite/Meetup/Luma etc.) normally expose the events directly.
        // Only open detail pages when the listing did not already yield enough structured events.
        if(source.format!=='jsonld' || listingEvents.length<2) detailLinks.push(...extractLinks(r.text,r.finalUrl,source,lim));
      }
    }
    const uniqueLinks=[...new Set(detailLinks)].slice(0,deep?(source.maxLinks||50):(source.liveMaxLinks||20));
    for(const link of uniqueLinks){
      try{
        const r=await fetchText(link,{maxBytes:Math.min(maxBytes,4_000_000)}); ret.pages++;
        let evs=extractJsonLd(r.text,source,r.finalUrl);
        if(!evs.length){const fb=extractHtmlFallback(r.text,source,r.finalUrl); if(fb)evs=[fb];}
        listingEvents.push(...evs);
      }catch{}
    }
    ret.events=dedupe(listingEvents);
    ret.ok=true;
    return ret;
  }catch(err){
    ret.error=err?.message||String(err); ret.rateLimited=err?.status===429; return ret;
  }
}

export async function pool(items, concurrency, fn){
  const out=new Array(items.length); let idx=0;
  async function worker(){while(true){const i=idx++; if(i>=items.length)return; out[i]=await fn(items[i],i);}}
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},worker)); return out;
}
