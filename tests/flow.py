import sys, json, re
from playwright.sync_api import sync_playwright
URL = 'http://localhost:3111/'
errs = []
n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(('console.' + m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    ctx.request.post(URL + 'api/admin/login', data=json.dumps({'password': 'testpass123'}), headers={'content-type': 'application/json', 'x-requested-with': 'venganza'})
    pg.goto(URL + f'?test={n}'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'/tmp/shots/f{n}_00.png')
    print(pg.inner_text('#stage')[:400])
    pg.get_by_role('button', name=re.compile('Empezar|Continuar')).first.click(); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'/tmp/shots/f{n}_01.png')
    pg.mouse.click(200, 300); pg.wait_for_timeout(5000)
    pg.screenshot(path=f'/tmp/shots/f{n}_02.png')
    print('---'); print(pg.inner_text('#stage')[:400]); print(errs)
    b.close()
