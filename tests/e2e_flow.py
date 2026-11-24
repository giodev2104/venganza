"""Recorrido completo en modo pruebas: capítulos 1→4 con salto de pruebas, ensamblado, código físico, regalo, falso final y final romántico."""
import sys, json, re, time
from playwright.sync_api import sync_playwright
URL = 'http://localhost:3111/'; PW = 'testpass123'
import os
STOP = os.environ.get('STOP', ''); VW = int(os.environ.get('VW', 390)); VH = int(os.environ.get('VH', 844))
errs = []; seen = []
def log(*a): print(*a, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('response', lambda r: log('API', r.status, r.url.split('3111')[1]) if '/api/assemble' in r.url else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    H = {'content-type': 'application/json', 'x-requested-with': 'venganza'}
    ctx.request.post(URL + 'api/admin/login', data=json.dumps({'password': PW}), headers=H)
    codes = {c['n']: c['code'] for c in ctx.request.get(URL + 'api/test/codes').json()}
    log('codes', codes)
    pg.goto(URL + '?test=' + os.environ.get('TESTN', '1')); pg.wait_for_timeout(1500)
    def cls():
        return pg.evaluate("(document.querySelector('#stage .screen')||{}).className||''")
    def clickbtn(rx):
        loc = pg.locator('#stage button, #stage a.btn').filter(has_text=re.compile(rx))
        for i in range(loc.count()):
            e = loc.nth(i)
            if e.is_visible() and e.is_enabled():
                try: e.click(timeout=1500); return True
                except Exception: continue
        return False
    last = ''; stuck = 0; shot = 0
    for step in range(400):
        if pg.locator('.title-card').count(): pg.wait_for_timeout(500); continue
        c = cls(); txt = pg.inner_text('#stage')[:60].replace('\n', ' ')
        key = c + '|' + txt
        stuck = stuck + 1 if key == last else 0; last = key
        if not seen or seen[-1] != c.split()[1] if len(c.split()) > 1 else False: pass
        tag = (c.split() + ['', ''])[1:3]
        if not seen or seen[-1] != tag: seen.append(tag); shot += 1; pg.screenshot(path=f'/tmp/shots/e{shot:02d}_{"_".join(tag)}.png'); log(step, tag, txt)
        if 'hub' in c:
            if pg.inner_text('#stage').count('Misión cumplida') or 'Lo has conseguido' in pg.inner_text('#stage'): log('FIN: hub completo'); break
            clickbtn('Empezar|Continuar')
        elif 'task' in c:
            if clickbtn('^Seguir'): pg.wait_for_timeout(400); continue
            try: pg.locator('#testbar button', has_text='Saltar prueba').click(timeout=1500)
            except Exception: pass
            pg.wait_for_timeout(500)
        elif 'assemble' in c:
            for s in ('1', '2'):
                pg.locator(f'.chip[data-slot="{s}"]:not(.used)').click(timeout=3000)
            pg.get_by_role('button', name=re.compile('Unir')).click()
            try: pg.wait_for_selector('.screen.location', timeout=9000)
            except Exception: log('assemble no avanza', errs); pg.screenshot(path='/tmp/shots/assemble_fail.png')
        elif 'location' in c and STOP == 'location':
            pg.wait_for_timeout(2500); pg.screenshot(path='/tmp/shots/loc.png')
            log(pg.evaluate("(()=>{const out=[];document.querySelectorAll('#stage *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>innerWidth+1||r.left<-1)out.push(e.tagName+'.'+e.className+' '+Math.round(r.left)+'-'+Math.round(r.right))});return [document.documentElement.scrollWidth,innerWidth,document.querySelector('#stage').scrollWidth,out.slice(0,12)]})()"))
            log(pg.evaluate("(()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return e+' '+Math.round(b.left)+'..'+Math.round(b.right)};return [scrollX, document.querySelector('#stage').scrollLeft, document.documentElement.scrollLeft, document.body.scrollLeft, r('#app'), r('#stage'), r('#hud'), r('#stage .body'), r('.code-box'), r('.btn-row')]})()"))
            break
        elif 'location' in c:
            n = int(re.search(r'Capítulo|', '').group() == '' and 0) if False else None
            ch = int(re.search(r'REGALO (\d)', pg.inner_text('.hud-label').upper()).group(1))
            code = codes[ch]
            pg.fill('.code-box input', code); clickbtn('Abrir el regalo'); pg.wait_for_timeout(1500)
        elif not clickbtn('Desenvolver|Abrir$|Vamos|Seguir|Continuar|Ver los créditos|Ay, no|Ver mi mapa|Empezar|Reconsiderar|Probar'):
            if 'story' in c or 'credits' in txt.lower(): pg.mouse.click(200, 400)
            if pg.locator('.credits-wrap').count(): pg.mouse.click(200, 400)
            if pg.locator('.interrupt button').count(): pg.locator('.interrupt button').click(force=True)
        if os.environ.get('PERIODIC') and step % 6 == 0: pg.screenshot(path=f'/tmp/shots/p_{step:03d}.png')
        pg.wait_for_timeout(350)
        if stuck > 60: log('STUCK', key, pg.evaluate("(()=>{const s=document.querySelector('#stage');return [s.scrollHeight,s.clientHeight,getComputedStyle(s).overflowY, getComputedStyle(document.querySelector('#stage .body')).paddingBottom]})()")); pg.screenshot(path='/tmp/shots/stuck.png'); break
    log('errors:', json.dumps(errs, ensure_ascii=False)[:2000])
    b.close()
