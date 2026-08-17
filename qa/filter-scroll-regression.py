import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'public/assets/index--25enLfP.css').read_text(encoding='utf-8')

def fixture():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head>
    <body><main class="light-experience">
      <div style="height:1200px"></div>
      <section class="agenda-section" style="min-height:2600px;padding-top:0">
        <div class="filter-shell"><div class="date-tabs"><button class="active">Tonight</button></div><div class="filter-row">Filters</div></div>
        <div style="height:2200px"></div>
      </section>
    </main></body></html>'''

results={}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(fixture(),wait_until='domcontentloaded')
    page.evaluate("document.documentElement.style.scrollBehavior='auto'")
    page.evaluate('scrollTo(0,1050)')
    before=page.locator('.filter-shell').evaluate('(e)=>({pos:getComputedStyle(e).position,top:e.getBoundingClientRect().top,y:scrollY})')
    page.evaluate('scrollBy(0,500)')
    after=page.locator('.filter-shell').evaluate('(e)=>({pos:getComputedStyle(e).position,top:e.getBoundingClientRect().top,y:scrollY})')
    mobile_pass=before['pos']=='relative' and after['y']-before['y']>=490 and after['top'] < before['top']-490
    results['mobile390_scrolls_away']={'pass':mobile_pass,'before':before,'after':after}

    page.set_viewport_size({'width':1440,'height':900})
    page.set_content(fixture(),wait_until='domcontentloaded')
    page.evaluate("document.documentElement.style.scrollBehavior='auto'")
    page.evaluate('scrollTo(0,1500)')
    desk=page.locator('.filter-shell').evaluate('(e)=>({pos:getComputedStyle(e).position,top:e.getBoundingClientRect().top,y:scrollY})')
    desktop_pass=desk['pos']=='sticky' and abs(desk['top']-78)<=2
    results['desktop1440_stays_sticky']={'pass':desktop_pass,'state':desk}
    browser.close()

print(json.dumps(results,indent=2))
sys.exit(0 if all(v['pass'] for v in results.values()) else 1)
