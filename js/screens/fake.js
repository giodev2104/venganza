// Falso final (después del regalo 3): despedida, créditos de mentira e interrupción inesperada.
import { h, $, sleep, fmtTime } from '../util.js';
import { icon } from '../icons.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import * as B from '../bouncers.js';
import { state, save, cs } from '../store.js';
import { achieve } from '../achievements.js';
import { rt } from '../rt.js';

export async function fakeEnding(c) {
  const fe = c.reveal.fakeEnding; ui.HUD.hide();
  // 1) Despedida y resumen
  await new Promise(async (res) => {
    const S = state(), first = cs(rt.pub.first), total = Date.now() - (first.startedAt || c.startedAt);
    const go = h('button', { class: 'btn fade-up', style: { animationDelay: '2.4s' }, onclick: () => { audio.sfx('click'); res(); } }, 'Ver los créditos', h('span', { html: icon('arrow-right', 20) }));
    const stat = (k, v) => h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--line)' } }, h('span', { class: 'muted' }, k), h('b', { class: 'mono' }, v));
    await ui.show(ui.screen('center',
      h('p', { class: 'kicker' }, 'Fin de la gincana'), h('h1', { class: 'h-xl grad-text' }, fe.title), h('p', { class: 'lede' }, fe.farewell),
      h('div', { class: 'panel', style: { textAlign: 'left' } }, stat('Tiempo de sufrimiento', fmtTime(total)), stat('Fallos admirables', String(S.stats.fails)), stat('Ayudas pedidas a Hugo', String(S.stats.hints))), go));
    audio.sfx('success'); fx.fireworks(5000); fx.confetti({ count: 120 });
  });
  fx.clearFx();
  // 2) Créditos de mentira
  const wrap = h('div', { class: 'credits-wrap' }), roll = h('div', { class: 'credits-roll' }), end = h('div', { class: 'cr-end h-xl' }, fe.end || 'FIN');
  roll.append(h('h1', { class: 'h-lg grad-text' }, rt.pub.meta.title));
  (fe.credits || []).forEach((cr) => roll.append(h('div', null, h('p', { class: 'cr-role' }, cr.role), h('p', { class: 'cr-name' }, cr.name))));
  roll.append(h('p', { class: 'lede' }, 'Gracias por jugar.'));
  wrap.append(roll, end); $('#app').append(wrap); audio.music('c4'); audio.sfx('whoosh');
  await new Promise((res) => { let fin = false; const finish = () => { if (fin) return; fin = true; roll.style.display = 'none'; end.classList.add('in'); setTimeout(res, 3200); }; roll.addEventListener('animationend', finish); wrap.addEventListener('pointerdown', finish, { once: true }); });
  // 3) La interrupción
  audio.stopMusic(); audio.sfx('scratchrec'); await sleep(250); audio.sfx('glitch'); await fx.glitch(wrap, 1400);
  wrap.textContent = ''; await sleep(900);
  const l1 = h('h1', { class: 'int-1' }, fe.interrupt.line1), l2 = h('p', { class: 'int-2' }, fe.interrupt.line2);
  const go = h('button', { class: 'btn', style: { maxWidth: '320px', margin: '0 auto' } }, fe.interrupt.button || 'Ay, no…');
  const int = h('div', { class: 'interrupt' }, h('div', null, l1, l2, go)); l2.style.opacity = 0; go.style.opacity = 0; go.disabled = true; wrap.append(int);
  audio.sfx('boing'); l1.classList.add('shake'); await sleep(1700); l2.style.transition = 'opacity .8s'; l2.style.opacity = 1; audio.sfx('glitch'); B.burst(4500, 8); await sleep(1800);
  go.style.transition = 'opacity .6s'; go.style.opacity = 1; go.disabled = false;
  await new Promise((res) => go.addEventListener('click', () => { audio.sfx('whoosh'); res(); }, { once: true }));
  wrap.style.transition = 'opacity .8s'; wrap.style.opacity = 0; await sleep(800); wrap.remove();
  const S = state(); S.showFinal = true; save(); achieve('trampa'); ui.HUD.show();
}
