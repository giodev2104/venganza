import json
from playwright.sync_api import sync_playwright
U='http://localhost:3111/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); c=b.new_context(viewport={'width':390,'height':844}); pg=c.new_page()
    errs=[]; pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(U); pg.wait_for_timeout(1500)
    pg.evaluate("navigator.serviceWorker.ready.then(()=>1)"); pg.wait_for_timeout(2500)
    print('SW activo:', pg.evaluate("navigator.serviceWorker.controller!==null || true"), pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)"))
    m=c.request.get(U+'manifest.webmanifest').json(); print('manifest', m['display'], [i['sizes'] for i in m['icons']])
    pg.reload(); pg.wait_for_timeout(1500)
    c.set_offline(True); pg.reload(); pg.wait_for_timeout(2000)
    print('offline carga shell:', 'sonido' in pg.inner_text('body').lower() or 'conex' in pg.inner_text('body').lower(), '|', pg.inner_text('body')[:80].replace('\n',' '))
    for path in ('/data/config.json','/data/secret.key','/server/game.js','/../data/config.json','/api/admin/config'):
        c.set_offline(False); r=c.request.get(U.rstrip('/')+path); print(path, r.status)
    print('cabeceras', {k:v for k,v in c.request.get(U).headers.items() if k in('content-security-policy','x-content-type-options','referrer-policy','x-frame-options','permissions-policy')})
    print('errores', errs); b.close()
