import json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'public/index.html').read_text(encoding='utf-8')
css=(ROOT/'public/assets/index--25enLfP.css').read_text(encoding='utf-8')
# Remove all scripts, preload/modulepreload/style links, and external image loads. Keep SSR DOM.
html=re.sub(r'<script[\s\S]*?</script>','',html,flags=re.I)
html=re.sub(r'<link[^>]+rel="(?:stylesheet|modulepreload|preload)"[^>]*>','',html,flags=re.I)
html=re.sub(r'<style[\s\S]*?</style>','',html,flags=re.I)
html=re.sub(r'\s(?:src|poster)="https?://[^"]*"','',html,flags=re.I)
html=re.sub(r'\ssrcset="[^"]*"','',html,flags=re.I)
html=html.replace('</head>',f'<style>{css}</style></head>')
WIDTHS=[320,360,375,390,412,430,480,540,600,640,641,720,768,800,820,834,900,1024,1080,1180,1181,1280,1366,1440,1536,1600,1728,1920,2048,2560,3440,3840]
HEIGHTS=[500,600,700,800]
res=[]; fails=[]
def check(ok,name,detail=''):
 res.append({'name':name,'pass':bool(ok),'detail':detail})
 if not ok:fails.append(f'{name}: {detail}')
def metrics(page):
 return page.evaluate('''() => {const d=document.documentElement,b=document.body,g=document.querySelector('.event-grid');const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const off=[...document.querySelectorAll('body *')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,100),left:+r.left.toFixed(1),right:+r.right.toFixed(1),width:+r.width.toFixed(1)}}).filter(x=>x.right>d.clientWidth+2||x.left<-2).slice(0,30);return{cw:d.clientWidth,sw:Math.max(d.scrollWidth,b?.scrollWidth||0),cards:document.querySelectorAll('.event-card').length,cols:g?getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length:null,off}}''')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844})
 for w in WIDTHS:
  page.set_viewport_size({'width':w,'height':780 if w<=430 else 900})
  page.set_content(html,wait_until='domcontentloaded')
  m=metrics(page)
  check(m['cards']>0,f'{w}px SSR cards present',f"cards={m['cards']}")
  check(m['sw']<=m['cw']+2,f'{w}px no global horizontal overflow',json.dumps(m['off'],ensure_ascii=True))
  exp=1 if w<=640 else 2 if w<=1180 else 3
  check(m['cols']==exp,f'{w}px event-grid columns={exp}',f"actual={m['cols']}")
 # height tests
 for h in HEIGHTS:
  page.set_viewport_size({'width':390,'height':h}); page.set_content(html); m=metrics(page)
  check(m['sw']<=m['cw']+2,f'390x{h} no overflow',json.dumps(m['off'],ensure_ascii=True))
 # landscape
 page.set_viewport_size({'width':844,'height':390}); page.set_content(html);m=metrics(page)
 check(m['sw']<=m['cw']+2,'844x390 landscape no overflow',json.dumps(m['off'],ensure_ascii=True))
 # low width plus long content
 page.set_viewport_size({'width':320,'height':700});page.set_content(html)
 page.evaluate('''() => {const c=document.querySelector('.event-card');if(!c)return;for(const sel of ['h3','p','span']){const el=c.querySelector(sel);if(el)el.textContent='EXTREME-'+('UNBROKENCONTENT'.repeat(100));}}''')
 m=metrics(page);check(m['sw']<=m['cw']+2,'320px extreme unbroken content no overflow',json.dumps(m['off'],ensure_ascii=True))
 # touch target sample at mobile
 touch=page.evaluate('''() => [...document.querySelectorAll('button,a[href],select,input')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName,cls:String(el.className||'').slice(0,80),w:Math.round(r.width),h:Math.round(r.height),text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,50)}}).filter(x=>x.w<44||x.h<44).slice(0,50)''')
 # Don't hard-fail text links in navigation; fail buttons/select/input under 44px on coarse pointer intent.
 bad=[x for x in touch if x['tag'] in ('BUTTON','SELECT','INPUT')]
 check(len(bad)==0,'mobile primary controls >=44px',json.dumps(bad,ensure_ascii=True))
 # reduced motion computed check
 page.emulate_media(reduced_motion='reduce');page.set_content(html)
 anim=page.evaluate('''() => {const c=document.querySelector('.event-card');const s=getComputedStyle(c);return{animationDuration:s.animationDuration,transitionDuration:s.transitionDuration}}''')
 check(anim['animationDuration'] in ('0s','0.001ms','1e-06s') or '0.001' in anim['animationDuration'],'reduced-motion animation suppressed',json.dumps(anim))
 # screenshots for audit evidence
 shots=ROOT/'qa/screenshots';shots.mkdir(exist_ok=True)
 for w,h,name in [(320,700,'mobile-320'),(390,844,'mobile-390'),(820,1180,'tablet-820'),(1440,900,'desktop-1440')]:
  page.set_viewport_size({'width':w,'height':h});page.set_content(html);page.screenshot(path=str(shots/f'{name}.png'),full_page=False)
 browser.close()
report={'total':len(res),'passed':sum(x['pass'] for x in res),'failed':sum(not x['pass'] for x in res),'failures':fails,'results':res}
(ROOT/'qa/render-qa-report.json').write_text(json.dumps(report,ensure_ascii=True,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['total','passed','failed','failures']},indent=2,ensure_ascii=True))
sys.exit(1 if report['failed'] else 0)
