// Componentes de interfaz compartidos: escenario, HUD, toasts, hojas modales y pantalla de fallo.
import { h, $, sleep, pick, reduceMotion } from './util.js';
import { icon } from './icons.js';
import * as audio from './audio.js';
import * as fx from './fx.js';

// ── Escenario ──
let showSeq = 0;
export async function show(node, { leave = true } = {}) {
  const my = ++showSeq, st = $('#stage'), old = st.firstElementChild;
  if (old && leave && !reduceMotion()) { old.classList.add('screen-leave'); await sleep(190); if (my !== showSeq) return; }
  st.textContent = ''; node.classList.add('screen-enter'); st.append(node); st.scrollTop = 0;
  try { st.focus({ preventScroll: true }); } catch { /* ok */ }
}
export function screen(cls, ...kids) { return h('section', { class: 'screen ' + (cls || '') }, h('div', { class: 'body' }, ...kids)); }

export function setTheme(id, { quiet = false } = {}) {
  const app = $('#app'); if (app.dataset.theme === id) return;
  app.dataset.theme = id; fx.setTheme(id);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = { c1: '#0b0818', c2: '#16091a', c3: '#150a0e', c4: '#07060d' }[id] || '#0b0a14';
  if (!quiet) audio.sfx('whoosh');
}

// ── HUD ──
let hudHandlers = {};
export const HUD = {
  init(handlers) {
    hudHandlers = handlers; const el = $('#hud');
    el.append(
      h('div', { class: 'hud-prog', id: 'hud-prog', role: 'progressbar', 'aria-label': 'Progreso general', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { class: 'hud-segs' }), h('div', { class: 'hud-label' })),
      h('div', { class: 'hud-btns' },
        h('button', { class: 'hud-btn', 'aria-label': 'Mochila: pistas e historial', onclick: () => hudHandlers.bag() }, h('span', { html: icon('backpack', 21) }), h('i', { class: 'dot', id: 'bag-dot', hidden: true })),
        h('button', { class: 'hud-btn', 'aria-label': 'Logros', onclick: () => hudHandlers.ach() }, h('span', { html: icon('trophy', 21) })),
        h('button', { class: 'hud-btn', 'aria-label': 'Ajustes', onclick: () => hudHandlers.settings() }, h('span', { html: icon('settings', 21) }))));
  },
  show() { $('#hud').hidden = false; document.body.classList.add('has-hud'); },
  hide() { $('#hud').hidden = true; document.body.classList.remove('has-hud'); },
  render({ segs, label, pct }) {
    const box = $('.hud-segs'); if (!box) return;
    while (box.children.length < segs.length) box.append(h('i', { class: 'seg' }, h('b')));
    while (box.children.length > segs.length) box.lastChild.remove();
    segs.forEach((p, i) => { const b = box.children[i].firstChild; b.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`; box.children[i].classList.toggle('full', p >= 1); });
    $('.hud-label').textContent = label; $('#hud-prog').setAttribute('aria-valuenow', Math.round(pct * 100));
  },
  badge(on) { const d = $('#bag-dot'); if (d) d.hidden = !on; },
};

// ── Toasts ──
export function toast(msg, { icn = '', kind = '', ms = 3200 } = {}) {
  const box = $('#toasts');
  const t = h('div', { class: 'toast ' + kind }, icn ? h('span', { html: icon(icn, 18) }) : null, h('span', null, msg));
  box.append(t); requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms);
  while (box.children.length > 3) box.firstChild.remove();
}
export function achievementToast(def) {
  const box = $('#toasts'); audio.sfx('chime');
  const t = h('div', { class: 'toast ach' }, h('span', { class: 'ach-ic', html: icon(def.icon || 'trophy', 22) }), h('div', null, h('b', null, 'Logro desbloqueado'), h('span', { class: 'ach-name' }, def.title)));
  box.append(t); requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 4200);
}

// ── Hoja modal ──
let openModals = [];
export function modal({ title, body, actions = [], cls = '', onClose, dismissable = true }) {
  const root = $('#overlay-root'), prevFocus = document.activeElement;
  const sheet = h('div', { class: 'sheet ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Diálogo' },
    h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    title ? h('div', { class: 'sheet-head' }, h('h2', { class: 'h-md' }, title), dismissable ? h('button', { class: 'hud-btn', 'aria-label': 'Cerrar', onclick: () => close() }, h('span', { html: icon('x', 20) })) : null) : null,
    h('div', { class: 'sheet-body' }, body),
    actions.length ? h('div', { class: 'sheet-actions btn-row' }, actions) : null);
  const back = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === back && dismissable) close(); } }, sheet);
  root.append(back); requestAnimationFrame(() => back.classList.add('in'));
  const keyh = (e) => { if (e.key === 'Escape' && dismissable) close(); };
  document.addEventListener('keydown', keyh);
  const rec = { close }; openModals.push(rec);
  setTimeout(() => (sheet.querySelector('button, input') || sheet).focus?.({ preventScroll: true }), 60);
  function close() {
    document.removeEventListener('keydown', keyh); openModals = openModals.filter((m) => m !== rec);
    back.classList.remove('in'); setTimeout(() => back.remove(), 300); try { prevFocus && prevFocus.focus({ preventScroll: true }); } catch { /* ok */ }
    onClose && onClose();
  }
  return { close, el: sheet };
}
export const closeAllModals = () => openModals.slice().forEach((m) => m.close());

// ── Pantalla de fallo (la del HTML original, con más estilo) ──
let overlayCount = 0;
export function wrongOverlay({ title, text, button = 'Reconsiderar mi respuesta', face = '🙄' }) {
  audio.sfx('boing'); overlayCount++;
  return new Promise((resolve) => {
    const root = $('#overlay-root');
    const done = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); resolve(); };
    const el = h('div', { class: 'wrong', role: 'alertdialog', 'aria-label': title },
      h('div', { class: 'wrong-in' },
        h('div', { class: 'wrong-face', 'aria-hidden': 'true' }, face),
        h('h2', { class: 'wrong-title' }, title),
        h('p', { class: 'wrong-text' }, text),
        h('button', { class: 'btn', onclick: done }, button)));
    root.append(el); requestAnimationFrame(() => el.classList.add('in'));
    el.querySelector('button').focus({ preventScroll: true });
  });
}
export const overlaysShown = () => overlayCount;

// ── Mantener pulsado para confirmar (reiniciar partida, etc.) ──
export function holdToConfirm(btn, ms, onDone) {
  let t = 0, raf = 0, start = 0;
  const fill = h('i', { class: 'hold-fill' }); btn.append(fill); btn.classList.add('hold');
  const step = () => { const p = Math.min(1, (performance.now() - start) / ms); fill.style.transform = `scaleX(${p})`; if (p >= 1) { cancel(); onDone(); } else raf = requestAnimationFrame(step); };
  const begin = (e) => { e.preventDefault(); start = performance.now(); raf = requestAnimationFrame(step); };
  const cancel = () => { cancelAnimationFrame(raf); fill.style.transform = 'scaleX(0)'; };
  btn.addEventListener('pointerdown', begin); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, cancel));
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toast('Mantén pulsado el botón con el dedo para confirmar'); } });
}

export function spinner(text = 'Un momento…') { return h('div', { class: 'loading' }, h('i', { class: 'spin' }), h('span', null, text)); }
export const cheer = (list) => pick(list && list.length ? list : ['¡Bien!']);
