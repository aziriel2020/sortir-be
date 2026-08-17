(()=>{
  'use strict';
  const MAX_AGE=45*60*1000;
  const texts={
    fr:{snap:'SNAPSHOT · DERNIÈRE COLLECTE {date}',note:'Le collecteur automatique attend un nouveau scan valide.',check:'Vérifier maintenant',short:'snapshot · {date}'},
    nl:{snap:'SNAPSHOT · LAATSTE VERZAMELING {date}',note:'De automatische collector wacht op een nieuwe geldige scan.',check:'Nu controleren',short:'snapshot · {date}'},
    en:{snap:'SNAPSHOT · LAST COLLECTED {date}',note:'The automatic collector is waiting for a new valid scan.',check:'Check latest',short:'snapshot · {date}'},
    de:{snap:'SNAPSHOT · LETZTE ERFASSUNG {date}',note:'Der automatische Collector wartet auf einen neuen gültigen Scan.',check:'Jetzt prüfen',short:'snapshot · {date}'}
  };
  let last=null,observer=null,applying=false;
  const lang=()=>{const x=(document.documentElement.lang||'fr').slice(0,2);return texts[x]?x:'fr'};
  const fmt=iso=>{
    const d=new Date(iso); if(Number.isNaN(+d))return '—';
    return new Intl.DateTimeFormat(lang()==='fr'?'fr-BE':lang()==='nl'?'nl-BE':lang()==='de'?'de-BE':'en-BE',{
      timeZone:'Europe/Brussels',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'
    }).format(d);
  };
  function replaceButtonLabel(btn,label){
    if(!btn)return;
    for(const n of [...btn.childNodes]) if(n.nodeType===Node.TEXT_NODE) n.remove();
    btn.append(document.createTextNode(' '+label));
  }
  function apply(){
    if(applying||!last)return; applying=true;
    try{
      const age=Date.now()-Date.parse(last.generatedAt||0);
      const fresh=Number.isFinite(age)&&age<=MAX_AGE&&last.stats?.fresh!==false;
      if(fresh){document.documentElement.dataset.sortirDataFresh='true';return;}
      document.documentElement.dataset.sortirDataFresh='false';
      const t=texts[lang()],date=fmt(last.generatedAt);
      const bar=document.querySelector('.live-radar-bar');
      if(bar){
        bar.classList.remove('radar-live','radar-loading'); bar.classList.add('radar-fallback','sortir-stale-data');
        const strong=bar.querySelector('.live-radar-state strong'); if(strong)strong.textContent=t.snap.replace('{date}',date);
        const small=bar.querySelector('.live-radar-state small'); if(small)small.textContent=t.note;
        replaceButtonLabel(bar.querySelector(':scope > button'),t.check);
      }
      const head=document.querySelector('.site-header .freshness span');
      if(head)head.textContent=t.short.replace('{date}',date);
    }finally{applying=false;}
  }
  async function refresh(){
    try{
      const r=await fetch('/api/live?freshness='+Date.now(),{cache:'no-store'}); if(!r.ok)return;
      last=await r.json(); apply();
      if(!observer){observer=new MutationObserver(()=>apply());observer.observe(document.body,{subtree:true,childList:true,characterData:true});}
    }catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
  setInterval(refresh,60_000);
})();
