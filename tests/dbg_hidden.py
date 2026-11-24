import json, re, time
from playwright.sync_api import sync_playwright
URL='http://localhost:3111/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=ctx.new_page()
    pg.on('console',lambda m:print('C',m.type,m.text) if m.type in('error','warning') else None); pg.on('pageerror',lambda e:print('PE',e))
    ctx.request.post(URL+'api/admin/login',data=json.dumps({'password':'testpass123'}),headers={'content-type':'application/json','x-requested-with':'venganza'})
    pg.goto(URL+'?test=3'); pg.wait_for_timeout(1500)
    def click(rx):
        loc=pg.locator('#stage button').filter(has_text=re.compile(rx))
        for i in range(loc.count()):
            e=loc.nth(i)
            if e.is_visible() and e.is_enabled():
                try: e.click(timeout=1500); return True
                except Exception: pass
        return False
    click('Empezar'); pg.wait_for_timeout(1500)
    for _ in range(30):
        if pg.locator('.title-card').count(): pg.wait_for_timeout(500); continue
        pg.mouse.click(200,300)
        if click('Vamos'): break
        pg.wait_for_timeout(300)
    for k in range(4):
        pg.wait_for_timeout(1500); pg.locator('#testbar button',has_text='Saltar prueba').click(); pg.wait_for_timeout(800); click('^Seguir')
    pg.wait_for_timeout(1500)
    print(pg.evaluate("(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return s+' none';const b=e.getBoundingClientRect();return s+' top='+Math.round(b.top)+' h='+Math.round(b.height)+' w='+Math.round(b.width)};return [r('.hunt'),r('.help-btn'),r('.task-main'),r('.task-foot'),getComputedStyle(document.querySelector('.hunt')).position, innerHeight, document.querySelector('#stage').scrollHeight]})()"))
    pg.screenshot(path='/tmp/shots/hidden_dbg.png')
    b.close()
