// Pruebas de integración de la API: partida completa, bloqueo de saltos, no-filtración de secretos, panel y medios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { createApp } from '../server/index.js';

let app, base, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'venganza-'));
  app = createApp({ dataDir: dir, adminPassword: 'clave-de-prueba-1' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + app.server.address().port;
});
after(() => { app.server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const post = async (p, body, headers = {}) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null), r }; };
const get = async (p, headers = {}) => { const r = await fetch(base + p, { headers }); return { s: r.status, j: await r.json().catch(() => null), r }; };

// Estado de un "jugador" simulado
const P = { tds: {}, cd: {} };
async function playChapter(chId, { wrongFirst = true } = {}) {
  const prev = P.cd[Object.keys(P.cd).slice(-1)[0]] || '';
  const o = await post('/api/chapter/open', { chapterId: chId, proof: prev });
  assert.equal(o.s, 200, 'abrir ' + chId);
  let proof = o.j.co; const tasks = o.j.chapter.tasks; P.tds = {};
  const frags = [];
  for (const t of tasks) {
    const g = await post('/api/task', { taskId: t.id, proof }); assert.equal(g.s, 200, 'task ' + t.id);
    const task = g.j.task; let res;
    const sol = SOLUTIONS[t.id];
    if (['quiz'].includes(task.type)) {
      let rp = '';
      for (let i = 0; i < task.rounds.length; i++) {
        const r = task.rounds[i], ans = sol[i];
        if (wrongFirst) { const wrong = r.kind === 'text' ? 'zzz' : r.options.find((x) => x.id !== ans)?.id; const w = await post('/api/answer', { taskId: t.id, proof, round: i, answer: wrong, attempt: 0, rp }); assert.equal(w.j.ok, false); assert.ok(w.j.msg.title); }
        res = await post('/api/answer', { taskId: t.id, proof, round: i, answer: ans, attempt: 5, rp });
        assert.equal(res.j.ok, true, 'ronda ' + t.id + ':' + i); rp = res.j.rp;
      }
    } else if (['safe', 'order', 'pixel'].includes(task.type)) {
      res = await post('/api/answer', { taskId: t.id, proof, answer: sol }); assert.equal(res.j.ok, true, 'respuesta ' + t.id);
    } else {
      // Minijuegos: reclamación con token de inicio antiguo (el servidor exige un mínimo de tiempo)
      const st = app.game.tok({ k: 'st', t: t.id, ts: Date.now() - 60000 });
      const claim = task.type === 'hidden' ? { found: task.hotspots.map((h) => h.id) } : {};
      res = await post('/api/answer', { taskId: t.id, proof, st, claim }); assert.equal(res.j.ok, true, 'claim ' + t.id + JSON.stringify(res.j));
    }
    assert.ok(res.j.token); proof = res.j.token; P.tds[t.id] = res.j.token;
    frags.push(...(res.j.reward.fragments || []));
  }
  return { opened: o.j, frags };
}
const SOLUTIONS = {
  c1t1: ['b'], c1t3: ['a'], c1t6: ['c'],
  c2t1: ['a', 'b', 'c', 'edita esta respuesta'], c2t2: ['i1', 'i2', 'i3', 'i4'], c2t3: 'corazón', c2t4: '0702',
  c3t1: ['b', 'a', 'b', 'a'], c3t2: ['a', 'b', 'a'],
  c4t1: ['a', 'b', 'c'], c4t3: ['Hugo siempre tiene razón'], c4t5: '739',
};

test('la información pública no filtra secretos ni capítulos ocultos', async () => {
  const { j } = await get('/api/public'); const s = JSON.stringify(j);
  for (const bad of ['HUGO01', '40.1995', 'correct', 'anillo', 'La última venganza', 'Instinto', 'Demuestra que me conoces']) assert.ok(!s.includes(bad), 'filtra: ' + bad);
  assert.equal(j.visibleChapters, 3); assert.equal(j.totalChapters, 4);
});

test('no se puede saltar: capítulos y pruebas exigen prueba encadenada', async () => {
  assert.equal((await post('/api/chapter/open', { chapterId: 'c2', proof: '' })).s, 403);
  assert.equal((await post('/api/chapter/open', { chapterId: 'c2', proof: 'aaa.bbb' })).s, 403);
  const o = await post('/api/chapter/open', { chapterId: 'c1' }); assert.equal(o.s, 200);
  assert.equal((await post('/api/task', { taskId: 'c1t3', proof: o.j.co })).s, 403, 'segunda prueba sin superar la primera');
  assert.equal((await post('/api/answer', { taskId: 'c1t3', proof: o.j.co, round: 0, answer: 'a' })).s, 403);
  const g = await post('/api/task', { taskId: 'c1t1', proof: o.j.co });
  const s = JSON.stringify(g.j);
  assert.ok(!s.includes('"correct"') && !s.includes('"accepted"') && !s.includes('"reward"'), 'la prueba filtra datos internos');
});

test('respuestas incorrectas dan mensaje troll; la ayuda progresiva funciona; el 3er fallo sugiere ayuda', async () => {
  const o = await post('/api/chapter/open', { chapterId: 'c1' });
  const w0 = await post('/api/answer', { taskId: 'c1t1', proof: o.j.co, round: 0, answer: 'a', attempt: 0 });
  assert.equal(w0.j.ok, false); assert.equal(w0.j.msg.title, '¡VA AHORA EN SERIO!');
  const w2 = await post('/api/answer', { taskId: 'c1t1', proof: o.j.co, round: 0, answer: 'a', attempt: 2 });
  assert.equal(w2.j.suggestHint, true);
  const h1 = await post('/api/hint', { taskId: 'c1t1', proof: o.j.co, level: 1 }), h3 = await post('/api/hint', { taskId: 'c1t1', proof: o.j.co, level: 3 });
  assert.ok(h1.j.hint && h3.j.hint.includes('Hugo') && h1.j.hint !== h3.j.hint);
  const bad = await post('/api/hint', { taskId: 'c1t1', proof: 'x.y', level: 1 }); assert.equal(bad.s, 403);
});

test('minijuegos: reclamar demasiado rápido se rechaza', async () => {
  const o = await post('/api/chapter/open', { chapterId: 'c1' }); let proof = o.j.co;
  for (const [id, sol] of [['c1t1', 'b'], ['c1t3', 'a']]) { const a = await post('/api/answer', { taskId: id, proof, round: 0, answer: sol }); proof = a.j.token; if (id === 'c1t1') { const t2 = await post('/api/task', { taskId: 'c1t2', proof }); const c = await post('/api/answer', { taskId: 'c1t2', proof, st: t2.j.st, claim: {} }); assert.equal(c.j.ok, false, 'troll demasiado rápido'); const c2 = await post('/api/answer', { taskId: 'c1t2', proof, st: app.game.tok({ k: 'st', t: 'c1t2', ts: Date.now() - 5000 }), claim: {} }); proof = c2.j.token; } }
  // proof ahora = token de c1t3; la prueba c1t4 (runner) requiere 6 s
  const t = await post('/api/task', { taskId: 'c1t4', proof }); assert.equal(t.s, 200);
  const fast = await post('/api/answer', { taskId: 'c1t4', proof, st: t.j.st, claim: {} }); assert.equal(fast.j.ok, false);
  assert.equal((await post('/api/answer', { taskId: 'c1t4', proof, st: 'falso.falso', claim: {} })).s, 400);
});

test('partida completa capítulos 1-4: pistas, montaje, ubicación, código, descifrado sin conexión', async () => {
  let ringSeen = false;
  for (const [i, chId] of ['c1', 'c2', 'c3', 'c4'].entries()) {
    const { frags } = await playChapter(chId);
    assert.deepEqual(frags.map((f) => f.slot).sort(), [1, 2], chId + ': debe entregar las pistas 1 y 2');
    const ch = app.store.config.chapters[i], A = frags.find((f) => f.slot === 1).value, B = frags.find((f) => f.slot === 2).value;
    assert.equal(A, ch.location.fragA);
    // montaje incorrecto (orden invertido) y con pruebas incompletas
    assert.equal((await post('/api/assemble', { chapterId: chId, parts: [A, B], tds: {} })).s, 403);
    const wrong = await post('/api/assemble', { chapterId: chId, parts: [B, A], tds: P.tds }); assert.equal(wrong.j.ok, false); assert.ok(wrong.j.msg.title);
    const ok = await post('/api/assemble', { chapterId: chId, parts: [A, B], tds: P.tds }); assert.equal(ok.j.ok, true);
    assert.ok(ok.j.location.mapsUrl.startsWith('https://www.google.com/maps'));
    // alternativa escrita a mano (decimales)
    const typed = await post('/api/assemble', { chapterId: chId, text: `${ch.location.lat}, ${ch.location.lng}`, tds: P.tds }); assert.equal(typed.j.ok, true, 'coordenadas decimales a mano');
    // el paquete cifrado NO contiene texto en claro
    assert.ok(!JSON.stringify(ok.j).includes(ch.gift.revealTitle) && !JSON.stringify(ok.j).includes(ch.physicalCode));
    // código físico
    const bad = await post('/api/chapter/complete', { chapterId: chId, code: 'MAL', proof: ok.j.lc }); assert.equal(bad.j.ok, false);
    const c = await post('/api/chapter/complete', { chapterId: chId, code: ' ' + ch.physicalCode.toLowerCase().replace(/(..)/, '$1-') + ' ', proof: ok.j.lc });
    assert.equal(c.j.ok, true, 'el código tolera mayúsculas, espacios y guiones'); P.cd[chId] = c.j.token;
    assert.equal((await post('/api/chapter/complete', { chapterId: chId, code: ch.physicalCode, proof: 'x.y' })).s, 403);
    // descifrado offline con Web Crypto (mismo algoritmo que el cliente)
    const b = ok.j.blob, enc = new TextEncoder(), raw = Uint8Array.from(Buffer.from(b.ct, 'base64'));
    const km = await webcrypto.subtle.importKey('raw', enc.encode(ch.physicalCode), 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(b.s, 'base64'), iterations: b.it, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(b.iv, 'base64') }, key, raw)));
    assert.equal(pt.reveal.gift.title, c.j.reveal.gift.title); assert.ok(pt.cd);
    const badKey = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(b.s, 'base64'), iterations: b.it, hash: 'SHA-256' }, await webcrypto.subtle.importKey('raw', enc.encode('OTRO'), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    await assert.rejects(webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(b.iv, 'base64') }, badKey, raw), 'un código incorrecto no descifra');
    if (chId === 'c3') assert.ok(c.j.reveal.fakeEnding && c.j.reveal.fakeEnding.credits.length, 'el capítulo 3 trae el falso final');
    if (chId === 'c4') { ringSeen = !!c.j.reveal.ringText; assert.ok(c.j.reveal.letter && c.j.reveal.photos.length === 3); assert.equal(c.j.reveal.last, true); }
    if (chId !== 'c4') assert.ok(c.j.reveal.keyItem && /^\d$/.test(c.j.reveal.keyItem.text));
  }
  assert.equal(ringSeen, false, 'sin activarlo, nunca se menciona el anillo');
  // Tras tantas peticiones el capítulo 2 se abre solo con el cd del 1
  assert.equal((await post('/api/chapter/open', { chapterId: 'c3', proof: P.cd.c1 })).s, 403, 'el cd del capítulo 1 no abre el 3');
});

test('referencia al anillo: solo si el administrador la activa expresamente', async () => {
  const cfg = JSON.parse(JSON.stringify(app.store.config)); const c4 = cfg.chapters[3];
  c4.gift.ringText = 'TEXTO_ANILLO_DE_PRUEBA'; app.store.save(cfg);
  let c = await post('/api/chapter/complete', { chapterId: 'c4', code: c4.physicalCode, proof: app.game.tok({ k: 'lc', c: 'c4' }) });
  assert.ok(!JSON.stringify(c.j).includes('TEXTO_ANILLO'), 'desactivado → no aparece');
  cfg.settings.ringReferenceEnabled = true; app.store.save(cfg);
  c = await post('/api/chapter/complete', { chapterId: 'c4', code: c4.physicalCode, proof: app.game.tok({ k: 'lc', c: 'c4' }) });
  assert.equal(c.j.reveal.ringText, 'TEXTO_ANILLO_DE_PRUEBA');
});

test('panel de administración: autenticación real, CSRF, validación y copia de seguridad', async () => {
  assert.equal((await get('/api/admin/config')).s, 401);
  assert.equal((await get('/api/test/start?n=1')).s, 401, 'el modo pruebas exige sesión');
  assert.equal((await post('/api/admin/login', { password: 'mal' })).s, 401);
  const l = await post('/api/admin/login', { password: 'clave-de-prueba-1' }); assert.equal(l.s, 200);
  const ck = l.r.headers.get('set-cookie'); assert.match(ck, /HttpOnly/); assert.match(ck, /SameSite=Strict/);
  const H = { cookie: ck.split(';')[0], 'x-requested-with': 'venganza' };
  const cfg = (await get('/api/admin/config', H)); assert.equal(cfg.s, 200);
  assert.equal((await fetch(base + '/api/admin/config', { method: 'PUT', headers: { cookie: H.cookie, 'content-type': 'application/json' }, body: '{}' })).status, 403, 'sin cabecera CSRF');
  const broken = JSON.parse(JSON.stringify(cfg.j.config)); broken.chapters[0].tasks[0].rounds[0].options.forEach((o) => (o.correct = false));
  const bad = await fetch(base + '/api/admin/config', { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ config: broken }) }); assert.equal(bad.status, 422);
  const good = JSON.parse(JSON.stringify(cfg.j.config)); good.chapters[0].gift.title = 'Regalo editado';
  const sv = await fetch(base + '/api/admin/config', { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ config: good }) }); assert.equal(sv.status, 200);
  assert.ok(fs.readdirSync(path.join(dir, 'backups')).length >= 1, 'copia de seguridad creada');
  // modo pruebas con sesión
  const ts = await get('/api/test/start?n=3', H); assert.equal(ts.s, 200); assert.equal(ts.j.prev.length, 2);
  const o = await post('/api/chapter/open', { chapterId: ts.j.chapterId, proof: ts.j.proof }); assert.equal(o.s, 200);
  const sk = await post('/api/answer', { taskId: 'c3t1', proof: o.j.co, skip: true }, H); assert.equal(sk.j.ok, true, 'el administrador puede saltar pruebas');
  const sk2 = await post('/api/answer', { taskId: 'c3t2', proof: sk.j.token, skip: true }); assert.equal(sk2.j.ok, false, 'sin sesión de administrador, skip no vale');
  // contraseña
  assert.equal((await post('/api/admin/password', { current: 'clave-de-prueba-1', next: 'corta' }, H)).s, 400);
  assert.equal((await post('/api/admin/reset-progress', {}, H)).j.epoch, 2);
  assert.equal((await get('/api/public')).j.epoch, 2);
});

test('medios privados: URL firmada, caducidad, Range, validación de archivo', async () => {
  const l = await post('/api/admin/login', { password: 'clave-de-prueba-1' }); const H = { cookie: l.r.headers.get('set-cookie').split(';')[0], 'x-requested-with': 'venganza' };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 7)]);
  const up = await fetch(base + '/api/admin/media?name=foto.png&label=Nuestra', { method: 'POST', headers: H, body: png }); const uj = await up.json(); assert.equal(up.status, 200); assert.equal(uj.item.visibility, 'gated');
  assert.equal((await fetch(base + '/api/admin/media?name=virus.exe', { method: 'POST', headers: H, body: png })).status, 400);
  assert.equal((await fetch(base + '/api/admin/media?name=falsa.png', { method: 'POST', headers: H, body: Buffer.from('<script>alert(1)</script>') })).status, 400, 'contenido que no es imagen');
  assert.equal((await fetch(base + '/media/' + uj.item.file)).status, 403, 'sin firma no se sirve');
  assert.equal((await fetch(base + '/media/' + uj.item.file, { headers: { cookie: H.cookie } })).status, 200, 'el administrador sí lo ve');
  const url = app.game.mediaUrl(uj.item.id); const r = await fetch(base + url); assert.equal(r.status, 200); assert.equal(Buffer.from(await r.arrayBuffer()).length, png.length);
  const rg = await fetch(base + url, { headers: { range: 'bytes=0-9' } }); assert.equal(rg.status, 206); assert.equal(rg.headers.get('content-range'), `bytes 0-9/${png.length}`);
  const bad = url.replace(/s=.{6}/, 's=AAAAAA'); assert.equal((await fetch(base + bad)).status, 403);
  assert.equal((await fetch(base + '/media/..%2F..%2Fconfig.json')).status, 404, 'sin salto de directorio');
  assert.ok([403, 404].includes((await fetch(base + '/%2e%2e/server.js')).status));
  const del1 = await fetch(base + '/api/admin/media?id=' + uj.item.id, { method: 'DELETE', headers: H }); assert.equal(del1.status, 200);
});

test('estáticos: no se sirve nada fuera de /public y hay cabeceras de seguridad', async () => {
  for (const p of ['/server.js', '/data/config.json', '/../server/store.js', '/%2e%2e/package.json', '/.env']) { const r = await fetch(base + p); assert.ok([403, 404].includes(r.status), p + ' → ' + r.status); }
  const r = await fetch(base + '/admin/'); assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'")); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});
