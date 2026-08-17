import json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'public/index.html').read_text(encoding='utf-8')
css=(ROOT/'public/assets/index--25enLfP.css').read_text(encoding='utf-8')
map_js=(ROOT/'public/assets/sortir-map-v18_2.js').read_text(encoding='utf-8')
html=re.sub(r'<script[\s\S]*?</script>','',html,flags=re.I)
html=re.sub(r'<link[^>]+rel="(?:stylesheet|modulepreload|preload)"[^>]*>','',html,flags=re.I)
html=re.sub(r'<style[\s\S]*?</style>','',html,flags=re.I)
html=re.sub(r'\s(?:src|poster)="https?://[^"]*"','',html,flags=re.I)
html=re.sub(r'\ssrcset="[^"]*"','',html,flags=re.I)
html=html.replace('</head>',f'<style>{css}</style></head>')

results=[]
def check(ok,name,detail=''):
    results.append({'name':name,'pass':bool(ok),'detail':detail})

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(html,wait_until='domcontentloaded')

    geom=page.evaluate('''() => {
      const rr=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
      return {hero:rr('.hero'),map:rr('.map-panel'),agenda:rr('.agenda-section'),dock:rr('.mobile-dock'),vw:innerWidth,vh:innerHeight,sw:document.documentElement.scrollWidth};
    }''')
    check(geom['map']['left']>=-1 and geom['map']['right']<=geom['vw']+1,'mobile map fits viewport',json.dumps(geom))
    check(geom['agenda']['top']>=geom['map']['bottom']-2,'map fully precedes agenda (not clipped/covered)',json.dumps(geom))
    check(abs(geom['dock']['bottom']-geom['vh'])<=1,'mobile dock fixed flush to viewport bottom',json.dumps(geom))
    check(geom['sw']<=geom['vw']+2,'mobile shell has no global horizontal overflow',json.dumps(geom))

    # Real map enhancement integration with a deterministic local mock of MapLibre.
    page.evaluate('''() => {
      window.__markerCoords=[];window.__fitCalls=[];window.__easeCalls=[];window.__origClicks=0;
      const first=document.querySelector('.map-panel > button.map-marker');
      first?.addEventListener('click',()=>window.__origClicks++);
      class Bounds{constructor(a,b){this.a=a;this.b=b}extend(c){return this}}
      class Marker{
        constructor(opts={}){this.el=opts.element||document.createElement('span')}
        setLngLat(c){this.coord=c;window.__markerCoords.push(c);return this}
        addTo(m){m.container.appendChild(this.el);return this}
        remove(){this.el.remove();return this}
      }
      class Map{
        constructor(opts){this.container=opts.container;this._loaded=true;window.__mockMap=this}
        addControl(){return this}
        once(ev,cb){if(ev==='load')setTimeout(cb,0);return this}
        on(){return this}
        loaded(){return this._loaded}
        resize(){window.__resized=(window.__resized||0)+1}
        fitBounds(b,o){window.__fitCalls.push(o||{});return this}
        easeTo(o){window.__easeCalls.push(o||{});return this}
      }
      window.maplibregl={Map,Marker,LngLatBounds:Bounds,NavigationControl:class{}};
    }''')
    page.evaluate(map_js)
    page.wait_for_timeout(120)
    map_state=page.evaluate('''() => ({
      ready:document.querySelector('.map-panel').classList.contains('real-map-ready'),
      canvas:!!document.querySelector('.sortir-real-map'),
      oldMarkers:document.querySelectorAll('.map-panel > button.map-marker').length,
      realMarkers:document.querySelectorAll('.sortir-real-marker').length,
      coords:window.__markerCoords,
      fitCalls:window.__fitCalls.length
    })''')
    check(map_state['ready'],'real map reaches ready state',json.dumps(map_state))
    check(map_state['canvas'],'real map canvas inserted',json.dumps(map_state))
    check(map_state['realMarkers']==map_state['oldMarkers'] and map_state['realMarkers']>0,'real map mirrors filtered React markers',json.dumps(map_state))
    coords_ok=all(2.0<=c[0]<=6.9 and 49.1<=c[1]<=52.0 for c in map_state['coords'])
    check(coords_ok,'converted markers stay inside Belgian geographic envelope',json.dumps(map_state['coords']))
    check(map_state['fitCalls']>=1 or len(map_state['coords'])==1,'map auto-fits visible filtered markers',json.dumps(map_state))
    if map_state['realMarkers']:
        page.eval_on_selector('.sortir-real-marker','el=>el.click()')
        check(page.evaluate('window.__origClicks')==1,'real map marker delegates to original event open action')

    ready_layout=page.evaluate('''() => {
      const panel=document.querySelector('.map-panel'), canvas=document.querySelector('.sortir-real-map'), tiles=document.querySelector('.map-tiles');
      const p=panel.getBoundingClientRect(),c=canvas.getBoundingClientRect();
      return {panel:{w:p.width,h:p.height},canvas:{w:c.width,h:c.height},tilesDisplay:getComputedStyle(tiles).display};
    }''')
    check(abs(ready_layout['panel']['w']-ready_layout['canvas']['w'])<=2.1 and abs(ready_layout['panel']['h']-ready_layout['canvas']['h'])<=2.1,'real map fills entire map panel',json.dumps(ready_layout))
    check(ready_layout['tilesDisplay']=='none','legacy tile mosaic hidden only after real map is ready',json.dumps(ready_layout))

    # Drawer footer regression: emulate an open event drawer, scroll it, and ensure
    # the action bar remains at the physical viewport bottom.
    page.evaluate('''() => {
      const layer=document.createElement('div');layer.className='drawer-layer';
      layer.innerHTML=`<aside class="event-drawer"><button class="drawer-close">×</button><div class="drawer-hero"><h2>Test event</h2></div><div class="drawer-body"><p>${'Long content '.repeat(450)}</p></div><div class="drawer-footer"><button class="icon-action">Save</button><button class="icon-action">Agenda</button><button class="icon-action">Share</button><a class="primary-action">View event</a></div></aside>`;
      document.body.appendChild(layer);
    }''')
    footer_before=page.eval_on_selector('.drawer-footer','el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,vh:innerHeight}}')
    page.eval_on_selector('.event-drawer','el=>el.scrollTop=700')
    page.wait_for_timeout(30)
    footer_after=page.eval_on_selector('.drawer-footer','el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,vh:innerHeight}}')
    check(abs(footer_before['bottom']-footer_before['vh'])<=1,'event action bar starts at viewport bottom',json.dumps(footer_before))
    check(abs(footer_after['bottom']-footer_after['vh'])<=1 and abs(footer_after['top']-footer_before['top'])<=1,'event action bar stays fixed after drawer scroll',json.dumps({'before':footer_before,'after':footer_after}))

    browser.close()

report={'total':len(results),'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results),'results':results}
(ROOT/'qa/mobile-map-shell-v18_2-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(1 if report['failed'] else 0)
