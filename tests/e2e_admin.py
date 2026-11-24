"""Panel de administración en navegador real: login, edición, guardado, validación, subida de medios, QR, exportación."""
import json, re, os
from playwright.sync_api import sync_playwright
URL = 'http://localhost:3111/'; PW = os.environ.get('PW', 'testpass123')
errs = []; fails = []
def log(*a): print(*a, flush=True)
def check(cond, msg):
    log(('  ok   ' if cond else '  FALLA'), msg)
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type, m.text)) if m.type in ('error', 'warning') and '401' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    pg.goto(URL + 'admin/'); pg.wait_for_selector('.login'); pg.screenshot(path='/tmp/shots/a_login.png')
    check(pg.locator('.login').count() == 1, 'sin sesión → pantalla de login')
    # el panel no debe filtrar la config sin sesión
    r = ctx.request.get(URL + 'api/admin/config'); check(r.status == 401, f'API config sin sesión → {r.status}')
    pg.fill('.login input', 'incorrecta'); pg.click('.login button'); pg.wait_for_timeout(800)
    check('incorrecta' in pg.inner_text('.login .err').lower() or len(pg.inner_text('.login .err')) > 3, 'contraseña errónea → mensaje')
    pg.fill('.login input', PW); pg.click('.login button'); pg.wait_for_selector('.top', timeout=5000)
    check(pg.locator('.top').count() == 1, 'login correcto → panel')
    pg.screenshot(path='/tmp/shots/a_resumen.png', full_page=True)
    check(pg.locator('canvas').count() >= 4, 'QR: un canvas por capítulo')
    data = pg.evaluate("[...document.querySelectorAll('canvas')].map(c=>{const d=c.getContext('2d').getImageData(0,0,150,150).data;let dark=0;for(let i=0;i<d.length;i+=4)if(d[i]<80)dark++;return dark})")
    check(all(x > 800 for x in data), f'QR con contenido real {data}')
    for tab in ('General', 'Humor y textos', 'Capítulos', 'Medios'):
        pg.get_by_role('button', name=re.compile(tab)).first.click(); pg.wait_for_timeout(300)
        pg.screenshot(path=f'/tmp/shots/a_{tab[:4]}.png', full_page=True)
    # edición + guardado
    pg.get_by_role('button', name=re.compile('General')).first.click()
    sub = pg.locator('label:text("Subtítulo") + input'); import time; VAL = 'Subtítulo ' + str(int(time.time())); sub.fill(VAL)
    pg.wait_for_timeout(300)
    check(pg.inner_text('#dirtychip') == 'Cambios sin guardar', 'editar → «Cambios sin guardar»')
    pg.click('#savebtn'); pg.wait_for_selector('.toast'); pg.wait_for_timeout(300)
    check(pg.inner_text('#dirtychip') == 'Todo guardado', 'guardar → «Todo guardado»')
    pub = ctx.request.get(URL + 'api/public').json(); check(pub['meta']['subtitle'] == VAL, 'el cambio llega al juego')
    # añadir una prueba, abrirla y editarla
    pg.get_by_role('button', name=re.compile('Capítulos')).first.click(); pg.wait_for_timeout(300)
    n0 = pg.locator('section:has(h2:text("Pruebas")) .item').count()
    pg.locator('section:has(h2:text("Pruebas")) select').first.select_option('scratch')
    pg.get_by_role('button', name=re.compile('Añadir prueba')).click(); pg.wait_for_timeout(300)
    check(pg.locator('section:has(h2:text("Pruebas")) .item').count() == n0 + 1, 'añadir prueba')
    pg.click('#savebtn'); pg.wait_for_selector('.toast'); pg.wait_for_timeout(400)
    cfg = ctx.request.get(URL + 'api/admin/config').json()['config']
    check(any(t['type'] == 'scratch' and t['id'].startswith('c1t') for t in cfg['chapters'][0]['tasks'][-1:]), 'la prueba nueva se guarda en el servidor')
    # validación: borrar el código físico → error y no guarda
    code = pg.locator('label:text("Código físico") + input'); old = code.input_value(); code.fill('')
    pg.click('#savebtn'); pg.wait_for_timeout(800)
    check('falta el código físico' in pg.inner_text('main').lower() or 'error' in pg.inner_text('.toast').lower(), 'validación: código vacío rechazado')
    check(ctx.request.get(URL + 'api/admin/config').json()['config']['chapters'][0]['physicalCode'] == old, 'el servidor conserva el código anterior')
    pg.get_by_role('button', name=re.compile('Capítulos')).first.click(); pg.wait_for_timeout(300)
    pg.locator('label:text("Código físico") + input').fill(old)
    # subida de medios
    pg.get_by_role('button', name=re.compile('Medios')).first.click(); pg.wait_for_timeout(300)
    n_media = pg.locator('.mcard').count()
    pg.set_input_files('input[type=file]', '/tmp/test_upload.png'); pg.wait_for_timeout(1500)
    check(pg.locator('.mcard').count() == n_media + 1, 'subir imagen → aparece en la biblioteca')
    item = [m for m in ctx.request.get(URL + 'api/admin/config').json()['config']['media'] if not m['builtin']][-1]
    r = ctx.request.get(URL + 'media/' + item['file']); check(r.status == 200, 'admin ve el medio privado')
    r2 = b.new_context().request.get(URL + 'media/' + item['file']); check(r2.status in (403, 404), f'anónimo NO ve el medio privado ({r2.status})')
    # exportación
    with pg.expect_download() as d:
        pg.get_by_role('button', name=re.compile('Resumen')).first.click(); pg.get_by_role('link', name='Exportar configuración').click()
    exp = json.load(open(d.value.path())); check('config' in exp and len(exp['config']['chapters']) == 4, 'exportar configuración')
    # móvil
    m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); mp = m.new_page()
    m.request.post(URL + 'api/admin/login', data=json.dumps({'password': PW}), headers={'content-type': 'application/json', 'x-requested-with': 'venganza'})
    mp.goto(URL + 'admin/'); mp.wait_for_selector('.top'); mp.get_by_role('button', name=re.compile('Capítulos')).first.click(); mp.wait_for_timeout(300)
    mp.screenshot(path='/tmp/shots/a_mobile.png')
    ov = mp.evaluate('document.documentElement.scrollWidth > innerWidth'); check(not ov, 'panel sin desbordamiento horizontal en móvil')
    log('errores de consola:', errs); log('FALLOS:', fails)
    b.close()
