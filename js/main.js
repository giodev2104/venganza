// Arranque: carga del estado, época remota, modo pruebas, PWA, flujo principal (intro → mapa → capítulos).
import './nopull.js';
import { h, $, sleep } from './util.js';
import { icon } from './icons.js';
import { get, api } from './api.js';
import { fatal } from './net.js';
import * as store from './store.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as fx from './fx.js';
import * as B from './bouncers.js';
import * as clock from './clock.js';
import { waitScreen } from './screens/wait.js';
import { rt } from './rt.js';
import { syncPending } from './achievements.js';
import { refreshHUD, currentId, visibleIds } from './progress.js';
import { soundGate, intro } from './screens/intro.js';
import { hub } from './screens/hub.js';
import { playChapter } from './screens/chapter.js';
import { openBag, openAch, openSettings } from './screens/panels.js';

let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

function hardReset() { store.reset(); store.flush(); location.href = location.pathname; }

async function setupTest(params) {
  const n = Number(params.get('test')); if (!n) return false;
  try { await get('/api/admin/me'); } catch { return false; }       // solo con sesión de administrador
  rt.test = true; store.useKey('venganza2.test');
  return n;
}

async function applyTest(n) {
  const S = store.state(), res = await get('/api/test/start?n=' + n);
  store.reset(S.epoch); const T = store.state(); T.introDone = true; T.settings.sound = true;
  res.prev.forEach((p) => {
    const c = store.cs(p.id); Object.assign(c, { id: p.id, opened: true, done: true, stage: 'done', meta: { id: p.id, n: p.n, theme: 'c' + p.n, title: p.reveal.gift.title }, location: p.location, reveal: p.reveal });
    c.tokens.cd = p.cd; if (p.reveal.keyItem) store.addInventory({ ...p.reveal.keyItem, kind: 'item' });
  });
  if (res.prev.length >= rt.pub.visibleChapters) T.showFinal = true;
  store.save(); store.flush();
}

function testbar() {
  const bar = $('#testbar'); bar.hidden = false;
  const btn = (t, f) => h('button', { onclick: f }, t);
  bar.append(h('b', null, 'PRUEBAS'),
    btn('Códigos', async () => { const list = await get('/api/test/codes'); ui.modal({ title: 'Códigos físicos', body: [h('div', { class: 'panel' }, list.map((x) => h('p', { class: 'mono', style: { margin: '4px 0' } }, `Cap. ${x.n}: ${x.code}`)))] }); }),
    btn('Saltar prueba', async () => { if (rt.currentCtx) await rt.currentCtx.skip(); else ui.toast('No hay prueba activa'); }),
    ...[1, 2, 3, 4].map((n) => btn('Cap ' + n, () => { location.href = `/?test=${n}`; })),
    btn('Salir', () => { store.useKey('venganza2.test'); store.reset(); store.flush(); location.href = '/'; }));
}

function freebar() {
  const bar = $('#testbar'); bar.hidden = false; document.body.classList.add('testing');
  bar.append(h('b', null, 'PRUEBAS · sin esperas'), h('button', { onclick: () => { if (confirm('¿Borrar esta partida de pruebas y empezar de cero?')) hardReset(); } }, 'Reiniciar'));
}

async function main() {
  const params = new URLSearchParams(location.search);
  let testN = false;
  try { testN = await setupTest(params); } catch { /* sin pruebas */ }
  if (rt.free && !testN) store.useKey('venganza2.free'); // /test/: partida aparte, sin tocar la de verdad
  store.load();
  let pub;
  try { pub = await get('/api/public'); try { localStorage.setItem('venganza2.pub', JSON.stringify(pub)); } catch { /* ok */ } }
  catch (e) {
    try { pub = JSON.parse(localStorage.getItem('venganza2.pub') || 'null'); } catch { pub = null; }
    if (!pub) { document.body.append(h('div', { class: 'boot-error' }, h('h1', null, 'Sin conexión'), h('p', null, 'No se puede cargar la aventura. Conéctate una vez para descargarla; después funciona con poca cobertura.'), h('button', { class: 'btn', onclick: () => location.reload() }, 'Reintentar'))); return; }
  }
  rt.pub = pub; window.__pn = (pub.meta && pub.meta.playerName) || 'Nixi'; await clock.sync(); let S = store.state();
  if (!rt.test && S.epoch !== pub.epoch) { store.reset(pub.epoch); S = store.state(); }
  if (testN) { await applyTest(testN); S = store.state(); }
  const k = params.get('k'); if (k) { rt.pendingCode = k.slice(0, 40); history.replaceState(null, '', location.pathname); }
  document.title = pub.meta.title;
  B.setPhotos(pub.bouncers); fx.init(); audio.configure(S.settings);
  document.body.classList.toggle('lowfx', !!S.settings.lowfx); if (S.settings.lowfx) fx.setLow(true);
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  addEventListener('online', () => syncPending());
  ui.HUD.init({ bag: openBag, ach: openAch, settings: () => openSettings({ onReset: hardReset, install: installEvt ? async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; } : null }) });
  rt.openBag = openBag;
  if (rt.test) { document.body.classList.add('testing'); testbar(); }
  else if (rt.free) freebar();
  if ('serviceWorker' in navigator && !rt.test && !rt.free) navigator.serviceWorker.register('sw.js').catch(() => {});
  syncPending();

  ui.setTheme(currentId() ? (store.cs(currentId()).meta ? store.cs(currentId()).meta.theme : 'c1') : 'c1', { quiet: true });
  if (clock.enabled() && clock.now() < clock.startAt()) { ui.HUD.hide && ui.HUD.hide(); await waitScreen(clock.startAt()); }
  if (!S.introDone) { await soundGate(); await intro(pub); S.introDone = true; S.startedAt = Date.now(); store.save(); }
  else if (!rt.test) { await soundGate(); }
  ui.HUD.show(); refreshHUD();

  let justUnlocked = null;
  for (;;) {
    try {
      const prevIds = pub.chapterIds, id = await hub({ justUnlocked });
      if (!id) { ui.setTheme('c4'); return; }
      const i = prevIds.indexOf(id), prevCd = i > 0 ? store.cs(prevIds[i - 1]).tokens.cd : '';
      const before = visibleIds().length;
      await playChapter(id, prevCd);
      justUnlocked = visibleIds().length > before ? visibleIds()[before] : null;
    } catch (e) {
      console.error(e);
      if (e && e.status === 403) { await fatal(null, hardReset); return; }
      ui.toast('Algo ha fallado: ' + (e && e.message || 'error'), { kind: 'bad', ms: 4500 }); await sleep(800);
    }
  }
}
main();
