// Sala de juegos: panel a pantalla completa (se abre sobre cualquier pantalla) con 5 juegos, récords y pausa al salir.
import { h } from '../util.js';
import * as audio from '../audio.js';
import { best } from '../arcade/kit.js';

const svg = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
const GAMES = [
  { id: 'snake', name: 'Serpiente neón', desc: 'Come corazones sin chocar. Los dorados valen más.', load: () => import('../arcade/snake.js').then((m) => m.snake), a: '#7c3aed', b: '#f472b6',
    art: svg('<g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 44h16V26h20V14"/></g><circle cx="48" cy="14" r="5" fill="#fff"/><path d="M52 40c4-2 7 3 3 6l-3 3-3-3c-4-3-1-8 3-6z" fill="#fde047"/>') },
  { id: '2048', name: '2048 corazón', desc: 'Desliza y une fichas iguales. Con deshacer.', load: () => import('../arcade/g2048.js').then((m) => m.g2048), a: '#ec4899', b: '#fb923c',
    art: svg('<rect x="8" y="8" width="21" height="21" rx="6" fill="#fff" opacity=".95"/><rect x="35" y="8" width="21" height="21" rx="6" fill="#fff" opacity=".55"/><rect x="8" y="35" width="21" height="21" rx="6" fill="#fff" opacity=".55"/><rect x="35" y="35" width="21" height="21" rx="6" fill="#fff" opacity=".95"/>') },
  { id: 'breakout', name: 'Rompecorazones', desc: '4 niveles, potenciadores y bola con efecto.', load: () => import('../arcade/breakout.js').then((m) => m.breakout), a: '#0ea5e9', b: '#a78bfa',
    art: svg('<g fill="#fff"><rect x="6" y="10" width="16" height="8" rx="3"/><rect x="24" y="10" width="16" height="8" rx="3" opacity=".6"/><rect x="42" y="10" width="16" height="8" rx="3"/><rect x="15" y="21" width="16" height="8" rx="3" opacity=".6"/><rect x="33" y="21" width="16" height="8" rx="3"/></g><circle cx="36" cy="42" r="4" fill="#fde047"/><rect x="20" y="53" width="26" height="6" rx="3" fill="#fff"/>') },
  { id: 'flappy', name: 'Corazón volador', desc: 'Toca para volar entre las columnas.', load: () => import('../arcade/flappy.js').then((m) => m.flappy), a: '#be185d', b: '#6d28d9',
    art: svg('<rect x="44" y="0" width="14" height="22" rx="4" fill="#fff" opacity=".6"/><rect x="44" y="40" width="14" height="24" rx="4" fill="#fff" opacity=".6"/><path d="M24 44c-10-6-14-13-9-19 3-4 8-3 9 1 1-4 6-5 9-1 5 6 1 13-9 19z" fill="#fff"/>') },
  { id: 'whack', name: 'Pilla a Hugo', desc: '40 segundos de reflejos. ¡A Nixi no!', load: () => import('../arcade/whack.js').then((m) => m.whack), a: '#16a34a', b: '#14b8a6',
    art: svg('<ellipse cx="32" cy="50" rx="22" ry="7" fill="#052e2b" opacity=".6"/><circle cx="32" cy="30" r="15" fill="#fff"/><text x="32" y="37" text-anchor="middle" font-size="20" font-weight="800" fill="#0f766e" font-family="system-ui">H</text>') },
];

export function openArcade({ onClose } = {}) {
  const host = document.getElementById('overlay-root'); if (!host || host.querySelector('.arcade')) return;
  const root = h('div', { class: 'arcade', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sala de juegos' }); host.append(root);
  let destroy = null, gen = 0, cur = null;
  const stopGame = () => { if (cur && cur.n > 0) best.set(cur.id, cur.n); cur = null; gen++; if (destroy) { try { destroy(); } catch { /* ya cerrado */ } destroy = null; } };
  const close = () => { stopGame(); removeEventListener('keydown', onEsc); root.remove(); if (onClose) onClose(); };
  const onEsc = (e) => { if (e.key === 'Escape') { if (root.querySelector('.ar-game')) menu(); else close(); } };
  addEventListener('keydown', onEsc);

  function menu() {
    stopGame(); audio.sfx('click'); root.textContent = '';
    root.append(h('header', { class: 'ar-head' }, h('h2', null, 'Sala de juegos'), h('button', { class: 'ar-x', 'aria-label': 'Cerrar', onclick: close }, '✕')),
      h('p', { class: 'ar-sub' }, 'Para hacer más corta la espera. Tus récords se guardan en este móvil.'),
      h('div', { class: 'ar-list' }, GAMES.map((g) => h('button', { class: 'ar-card', style: { '--a': g.a, '--b': g.b }, onclick: () => play(g) },
        h('span', { class: 'ar-art', html: g.art }), h('span', { class: 'ar-txt' }, h('b', null, g.name), h('small', null, g.desc)), h('span', { class: 'ar-best' }, best.get(g.id) ? ['Récord', h('em', null, String(best.get(g.id)))] : 'Nuevo')))));
  }

  async function play(g) {
    stopGame(); const my = gen; audio.sfx('unlock'); root.textContent = '';
    const scoreEl = h('b', null, '0'), bestEl = h('b', null, String(best.get(g.id))), stage = h('div', { class: 'ar-stage' }), over = h('div', { class: 'ar-over', hidden: true });
    root.append(h('div', { class: 'ar-game', style: { '--a': g.a, '--b': g.b } },
      h('header', { class: 'ar-head' }, h('button', { class: 'ar-back', 'aria-label': 'Volver al menú', onclick: menu }, '‹ Juegos'), h('div', { class: 'ar-score' }, h('span', null, 'Puntos ', scoreEl), h('span', null, 'Récord ', bestEl))), stage, over));
    let hi = best.get(g.id); cur = { id: g.id, n: 0 }; const ui = {
      score: (n) => { cur.n = n; scoreEl.textContent = n; if (n > hi) { hi = n; bestEl.textContent = n; } },
      toast: (t) => { const el = h('div', { class: 'ar-toast' }, t); stage.append(el); setTimeout(() => el.remove(), 2600); },
      over: (n, note) => {
        if (my !== gen) return; const rec = best.set(g.id, n); audio.sfx(rec ? 'success' : 'fail'); over.hidden = false; over.textContent = '';
        over.append(h('div', { class: 'ar-panel' }, h('p', { class: 'kicker' }, rec && n > 0 ? '¡Nuevo récord!' : 'Fin de la partida'), h('h3', null, n + ' puntos'), note ? h('p', { class: 'ar-note' }, note) : null, h('div', { class: 'ar-btns' }, h('button', { class: 'btn', onclick: () => play(g) }, 'Otra vez'), h('button', { class: 'btn btn-ghost', onclick: menu }, 'Menú'))));
      },
    };
    const fn = await g.load(); if (my !== gen) return; await new Promise((r) => requestAnimationFrame(r)); if (my !== gen) return;
    destroy = fn(stage, ui);
  }
  menu();
  return close;
}
