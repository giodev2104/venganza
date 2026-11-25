// Pantalla de espera: cuenta atrás hasta que se abre la aventura.
import { h } from '../util.js';
import * as ui from '../ui.js';
import * as clock from '../clock.js';
import { icon } from '../icons.js';
import { openArcade } from './arcade.js';

export function waitScreen(target) {
  return new Promise((resolve) => {
    const cells = ['d', 'h', 'm', 's'].map((k) => [k, h('b', null, '00'), h('small', null, { d: 'días', h: 'horas', m: 'min', s: 'seg' }[k])]);
    const box = h('div', { class: 'cd-grid', role: 'timer', 'aria-live': 'off' }, cells.map(([, b, s]) => h('div', { class: 'cd-cell' }, b, s)));
    ui.show(ui.screen('center wait', h('p', { class: 'kicker' }, 'Todavía no'), h('h1', { class: 'h-lg' }, 'Paciencia, ' + (window.__pn || 'Nixi')), h('p', { class: 'lede' }, 'Tu aventura empieza el ' + clock.fmt(target) + '.'), box, h('button', { class: 'btn btn-games', onclick: () => openArcade({ onClose: () => { if (clock.now() >= target) { clearInterval(iv); resolve(); } } }) }, h('span', { html: icon('gamepad-2', 20) }), 'Juegos'), h('p', { class: 'small muted' }, 'Mientras esperas, echa unas partidas. La cuenta atrás se actualiza sola.')));
    const tick = () => { const left = target - clock.now(); if (left <= 0) { clearInterval(iv); resolve(); return; } const p = clock.split(left); cells.forEach(([k, b]) => { b.textContent = String(p[k]).padStart(2, '0'); }); };
    const iv = setInterval(tick, 500); tick();
  });
}
