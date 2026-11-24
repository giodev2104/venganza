import sys, json
from playwright.sync_api import sync_playwright
URL = 'http://localhost:3111/'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(('console.' + m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    pg.on('requestfailed', lambda r: errs.append(('reqfail', r.url)))
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.screenshot(path='/tmp/shots/01_gate.png')
    pg.get_by_text('Solo efectos').click(); pg.wait_for_timeout(800)
    pg.screenshot(path='/tmp/shots/02_intro.png')
    pg.mouse.click(200, 400); pg.wait_for_timeout(1500)
    pg.screenshot(path='/tmp/shots/03_intro2.png')
    pg.mouse.click(200, 400); pg.wait_for_timeout(1500)
    pg.screenshot(path='/tmp/shots/04_intro3.png')
    print(json.dumps(errs, ensure_ascii=False, indent=1))
    b.close()
