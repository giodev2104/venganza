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
    for k in range(2):
        pg.wait_for_timeout(1500); pg.locator('#testbar button',has_text='Saltar prueba').click(); pg.wait_for_timeout(800); click('^Seguir')
    pg.wait_for_timeout(1500)
    print(pg.inner_text('#stage')[:200].replace('\n',' | '))
    pg.evaluate("""()=>{window.__seq=[];window.__log=[];const g=document.querySelector('.sq-grid');const pads=[...g.children];
      new MutationObserver(ms=>{ms.forEach(m=>{const e=m.target;window.__log.push([pads.indexOf(e),m.oldValue,e.className,document.body.innerText.includes('Escucha')])})}).observe(g,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});}""")
    click('Repetir secuencia'); pg.wait_for_timeout(6000)
    print(pg.evaluate('window.__log').__repr__()[:600])
    print(pg.inner_text('#stage')[:200].replace('\n',' | '))
    b.close()
