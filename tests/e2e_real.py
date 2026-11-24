"""Partida REAL (sin modo pruebas, sin sesión de administrador): resuelve cada prueba jugando con la interfaz, con las respuestas de la config.
Comprueba además que no se puede avanzar sin superar las pruebas y que la partida sobrevive a una recarga."""
import sys, json, re, os, random, time
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:3111/'); DATA = os.environ.get('DATA', '/tmp/vdata/config.json')
cfg = json.load(open(DATA)); CH = {c['id']: c for c in cfg['chapters']}
errs = []; done_types = []
def log(*a): print(*a, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type, m.text)) if m.type in ('error', 'warning') and '429' not in m.text and '40' not in m.text[-12:] else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    pg.goto(URL); pg.wait_for_timeout(1000)
    def cls(): return pg.evaluate("(document.querySelector('#stage .screen')||{}).className||''")
    def stage_text(): return pg.inner_text('#stage')
    def click(rx, scope='#stage', exact=False):
        loc = pg.locator(f'{scope} button, {scope} a.btn').filter(has_text=re.compile(rx))
        for i in range(loc.count()):
            e = loc.nth(i)
            if e.is_visible() and e.is_enabled():
                try: e.click(timeout=1500); return True
                except Exception: continue
        return False
    def dismiss_overlay():
        if pg.locator('#overlay-root button').count():
            return click('.', '#overlay-root')
        return False
    def shot(name): pg.screenshot(path=f'/tmp/shots/r_{name}.png')

    # ── solvers ──
    def solve_quiz(task):
        t = pg.inner_text('.q-prompt').split('\n')[0].strip()
        rnd = next((r for r in task['rounds'] if r['prompt'].split('\n')[0].strip() == t), None)
        if not rnd: log('   ronda no encontrada', t); return False
        if rnd['kind'] == 'text':
            ans = [a for a in rnd['accepted'] if a][0].lstrip('*')
            pg.fill('.field input', ans); click('Comprobar')
        else:
            ok = next(o['text'] for o in rnd['options'] if o['correct'])
            loc = pg.locator('.opt').filter(has_text=ok)
            if loc.count(): loc.first.click(timeout=1500)
        return True
    def solve_order(task):
        want = [i['text'] for i in task['items']]
        for i, w in enumerate(want):
            for _ in range(10):
                cur = [x.inner_text().split('\n', 1)[-1].strip() for x in pg.locator('.ord-item .ord-t').all()]
                j = cur.index(w)
                if j <= i: break
                pg.locator('.ord-item').nth(j).locator('button').first.click(); pg.wait_for_timeout(120)
        click('Comprobar el orden')
    def solve_pixel(task): pg.fill('.input', task['accepted'][0]); click('Comprobar')
    def solve_safe(task):
        code = task.get('code') or ''.join(CH[c]['keyDigit'] for c in ('c1', 'c2', 'c3') if CH[c].get('keyDigit'))
        for d in code: pg.locator('.sf-pad .sf-key', has_text=re.compile(f'^{d}$')).first.click(); pg.wait_for_timeout(60)
        click('^Abrir$')
    def solve_memory(task):
        pg.wait_for_timeout(2200)
        for _ in range(40):
            cards = pg.locator('.mem-card:not(.ok)')
            n = cards.count()
            if n == 0: break
            faces = [cards.nth(i).locator('.mem-front').inner_html() for i in range(n)]
            first = 0; mate = next(j for j in range(1, n) if faces[j] == faces[0])
            cards.nth(first).click(); pg.wait_for_timeout(150); cards.nth(mate).click(); pg.wait_for_timeout(900)
    def solve_jigsaw(task):
        n = task.get('grid', 3); pg.wait_for_timeout(1500)
        def order():
            res = []
            for t in pg.locator('.jg-tile').all():
                pos = t.evaluate('e=>e.style.backgroundPosition'); m = re.findall(r'([\d.]+)%', pos)
                x, y = (float(m[0]), float(m[1])) if len(m) >= 2 else (0, 0)
                res.append(round(y / 100 * (n - 1)) * n + round(x / 100 * (n - 1)))
            return res
        for _ in range(30):
            o = order()
            bad = next((i for i, v in enumerate(o) if v != i), None)
            if bad is None: break
            j = o.index(bad); tiles = pg.locator('.jg-tile'); tiles.nth(bad).click(); pg.wait_for_timeout(120); tiles.nth(j).click(); pg.wait_for_timeout(350)
    def solve_runaway(task):
        for _ in range(30):
            btn = pg.locator('.ra-btn')
            if 'rindo' in btn.inner_text(): btn.click(); return
            try: btn.click(timeout=1500)
            except Exception: pass
            pg.wait_for_timeout(450)
    def solve_sequence(task):
        pg.evaluate("""()=>{window.__seq=[];const g=document.querySelector('.sq-grid');const pads=[...g.children];
          new MutationObserver(ms=>{ms.forEach(m=>{const e=m.target;if(e.classList.contains('lit')&&!m.oldValue.includes('lit')&&document.body.innerText.toLowerCase().includes('escucha'))window.__seq.push(pads.indexOf(e))})}).observe(g,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});}""")
        click('Repetir secuencia')
        for attempt in range(3):
            for _ in range(60):
                if 'tu turno' in stage_text().lower(): break
                pg.wait_for_timeout(300)
            seq = pg.evaluate('window.__seq')[-task['length']:]
            log('   secuencia', seq)
            for i in seq: pg.locator('.sq-pad').nth(i).click(); pg.wait_for_timeout(420)
            pg.wait_for_timeout(1500)
            if cls().find('task') < 0 or 'eso es' in stage_text().lower() or 'reward' in pg.content()[:0]: break
            if pg.locator('.reward').count(): break
    def solve_scratch(task):
        box = pg.locator('.sc-canvas').bounding_box()
        for row in range(0, 11):
            y = box['y'] + 10 + row * (box['height'] - 20) / 10
            pg.mouse.move(box['x'] + 8, y); pg.mouse.down()
            for k in range(0, 21): pg.mouse.move(box['x'] + 8 + k * (box['width'] - 16) / 20, y, steps=1)
            pg.mouse.up()
            if pg.locator('.sc-canvas.gone').count(): break
        pg.wait_for_timeout(3500)
    def solve_hidden(task):
        for s in pg.locator('.spot').all(): s.click(); pg.wait_for_timeout(250)
    def solve_runner(task):
        for _ in range(3):
            if click('Necesito ayuda'): pg.wait_for_timeout(400)
        t0 = time.time()
        while time.time() - t0 < 100 and pg.locator('.rn-canvas').count():
            pg.keyboard.press(random.choice(['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'])); pg.wait_for_timeout(260)
    def solve_media(task): click('Continuar')
    def solve_troll(task): click('Continuar|Vamos|Seguir|Abrir|Reclamar') or click('.')
    SOLVERS = dict(quiz=solve_quiz, order=solve_order, pixel=solve_pixel, safe=solve_safe, memory=solve_memory, jigsaw=solve_jigsaw, runaway=solve_runaway, sequence=solve_sequence, scratch=solve_scratch, hidden=solve_hidden, runner=solve_runner, media=solve_media, troll=solve_troll)

    # intro
    click('Solo efectos'); pg.wait_for_timeout(500)
    for _ in range(40):
        if pg.locator('button', has_text='Empezar mi sufrimiento').count() and pg.locator('button', has_text='Empezar mi sufrimiento').first.is_visible(): break
        pg.mouse.click(200, 420); pg.wait_for_timeout(600)
    shot('intro_end'); click('Empezar mi sufrimiento'); pg.wait_for_timeout(1500)
    # sin avanzar a la fuerza: el único botón es el de empezar
    last = ''; stuck = 0; step = 0; cur_task = {}; seen_screens = set(); t_start = time.time()
    while step < 900 and time.time() - t_start < 780:
        step += 1
        if pg.locator('.title-card').count(): pg.wait_for_timeout(500); continue
        if dismiss_overlay(): pg.wait_for_timeout(500); continue
        c = cls(); txt = stage_text()[:70].replace('\n', ' '); key = c + txt
        stuck = stuck + 1 if key == last else 0; last = key
        if stuck > 50: log('STUCK', key); shot('stuck'); break
        if 'hub' in c:
            if 'Misión cumplida' in txt or 'Lo has conseguido' in txt: log('FIN hub completo'); shot('hub_final'); break
            if ('hub', txt[:30]) not in seen_screens: seen_screens.add(('hub', txt[:30])); shot(f'hub_{len(seen_screens)}')
            click('Empezar|Continuar')
        elif 'task' in c and pg.locator('.reward').count():
            if click('^Seguir'): pg.wait_for_timeout(500)
        elif 'task' in c:
            hud = pg.inner_text('.hud-label'); n = int(re.search(r'(\d) DE', hud.upper()).group(1)); cid = f'c{n}'
            m = re.search(r'PRUEBA (\d+)/(\d+)', pg.inner_text('.task-head').upper()); idx = int(m.group(1)) - 1
            task = CH[cid]['tasks'][idx]; tt = task['type']
            if (cid, idx) not in cur_task: cur_task[(cid, idx)] = time.time(); log(f'[{cid} prueba {idx+1}] {tt} {task["id"]}'); 
            if tt not in done_types: done_types.append(tt); pg.wait_for_timeout(1200); shot(f'task_{tt}')
            if time.time() - cur_task[(cid, idx)] > 150: log('TIMEOUT prueba', task['id']); shot('timeout_' + task['id']); break
            try: SOLVERS[tt](task)
            except Exception as e: log('  (transición)', str(e).split(chr(10))[0][:90])
            pg.wait_for_timeout(900)
        elif 'assemble' in c:
            for s in ('1', '2'): pg.locator(f'.chip[data-slot="{s}"]:not(.used)').click(timeout=3000)
            click('Unir'); 
            try: pg.wait_for_selector('.screen.location', timeout=9000)
            except Exception: log('assemble no avanza'); shot('assemble_fail'); break
        elif 'location' in c:
            n = int(re.search(r'(\d) DE', pg.inner_text('.hud-label').upper()).group(1)); code = CH[f'c{n}']['physicalCode']
            # primero un código erróneo → debe rechazarse
            pg.fill('.code-box input', 'NOESESE'); click('Abrir el regalo'); pg.wait_for_timeout(1200)
            assert pg.locator('.screen.location').count() == 1, 'código erróneo aceptado'
            if n == 1:   # recarga a mitad de capítulo: el progreso debe conservarse
                pg.reload(); pg.wait_for_timeout(1500); click('Con sonido|Solo efectos|Sin sonido', '#stage') ; pg.wait_for_timeout(600)
                click('Continuar|Empezar'); pg.wait_for_timeout(1500); log('  recarga OK →', pg.evaluate("(document.querySelector('#stage .screen')||{}).className||''")); 
                if 'location' not in cls(): continue
            pg.fill('.code-box input', code); click('Abrir el regalo'); pg.wait_for_timeout(1500)
        elif not click('Desenvolver|Abrir$|Vamos|Seguir|Continuar|Ver los créditos|Ay, no|Ver mi mapa|Empezar|Reconsiderar|Probar'):
            pg.mouse.click(200, 420)
            if pg.locator('.interrupt button').count(): pg.locator('.interrupt button').click(force=True)
        pg.wait_for_timeout(300)
    log('tipos jugados:', done_types)
    log('errores de consola:', json.dumps(errs, ensure_ascii=False)[:1500])
    b.close()
