// Pilla a Hugo: 40 segundos, 9 madrigueras, combos, trampa (Nixi), corazón dorado que da tiempo y dificultad creciente.
import { h, rand } from '../util.js';
import * as audio from '../audio.js';

const TIME = 40;
export function whack(box, ui) {
  let score = 0, combo = 0, left = TIME, running = false, over = false, spawnT = null, clockT = null, t0 = 0;
  const holes = Array.from({ length: 9 }, () => { const mole = h('div', { class: 'wk-mole' }), el = h('div', { class: 'wk-hole' }, h('div', { class: 'wk-clip' }, mole), h('i', { class: 'wk-rim' })); return { el, mole, busy: false, type: null, hit: false, to: null }; });
  const timeBar = h('b', { style: { width: '100%' } }), comboEl = h('span', { class: 'wk-combo' }, ''), msg = h('div', { class: 'wk-msg' }, 'Toca para empezar');
  const wrap = h('div', { class: 'wk' }, h('div', { class: 'wk-top' }, h('div', { class: 'wk-time' }, timeBar), comboEl), h('div', { class: 'wk-grid' }, holes.map((x) => x.el)), h('p', { class: 'wk-tip' }, 'Pilla a ', h('b', null, 'Hugo'), '. ¡A Nixi no! El corazón dorado da tiempo.'), msg);
  box.append(wrap);
  const mult = () => Math.min(4, 1 + Math.floor(combo / 5));
  function float(el, txt, cls) { const f = h('span', { class: 'wk-float ' + cls }, txt); el.append(f); setTimeout(() => f.remove(), 700); }
  function setCombo() { comboEl.textContent = combo >= 5 ? `Combo x${mult()}  ·  ${combo} seguidos` : ''; comboEl.classList.toggle('on', combo >= 5); }
  function pop() {
    if (!running) return; const el = (Date.now() - t0) / 1000, free = holes.filter((x) => !x.busy); if (!free.length) return;
    const H0 = free[Math.floor(Math.random() * free.length)], r = Math.random(), type = el > 6 && r < .1 ? 'gold' : r < .3 ? 'nixi' : 'hugo';
    H0.busy = true; H0.hit = false; H0.type = type; H0.mole.className = 'wk-mole ' + type; H0.mole.innerHTML = type === 'gold' ? '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2 0 3.6 1 5.4 3 1.8-2 3.4-3 5.4-3 3.600 0 5.700 3.700 4.200 7.100C19.500 16.400 12 21 12 21z" fill="currentColor"/></svg>' : `<span>${type === 'hugo' ? 'H' : 'N'}</span>`;
    void H0.mole.offsetWidth; H0.el.classList.add('up'); if (type !== 'nixi') audio.sfx('pop');
    const vis = Math.max(480, 1050 - el * 14) * (type === 'gold' ? .75 : 1);
    H0.to = setTimeout(() => hide(H0, true), vis);
  }
  function hide(x, missed) { clearTimeout(x.to); x.el.classList.remove('up'); if (missed && x.type === 'hugo' && !x.hit && running) { combo = 0; setCombo(); } setTimeout(() => { x.busy = false; }, 180); }
  function tapHole(x) {
    if (!running || !x.busy || x.hit || !x.el.classList.contains('up')) return; x.hit = true; x.el.classList.add('hit'); setTimeout(() => x.el.classList.remove('hit'), 220);
    if (x.type === 'hugo') { combo++; const g = 10 * mult(); score += g; audio.sfx(combo % 5 === 0 ? 'coin' : 'match'); float(x.el, '+' + g, 'good'); }
    else if (x.type === 'gold') { score += 30; left = Math.min(TIME, left + 3); audio.sfx('success'); float(x.el, '+30  +3 s', 'gold'); }
    else { combo = 0; score = Math.max(0, score - 15); audio.sfx('fail'); float(x.el, '−15', 'bad'); wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); }
    ui.score(score); setCombo(); hide(x, false);
  }
  holes.forEach((x) => x.el.addEventListener('pointerdown', (e) => { e.preventDefault(); tapHole(x); }));
  function loopSpawn() { if (!running) return; const el = (Date.now() - t0) / 1000; pop(); if (el > 14 && Math.random() < .5) pop(); spawnT = setTimeout(loopSpawn, Math.max(300, 820 - el * 11) * rand(.8, 1.15)); }
  function start() {
    if (running || over) return; running = true; t0 = Date.now(); msg.hidden = true; audio.sfx('unlock');
    loopSpawn(); clockT = setInterval(() => { left -= .1; timeBar.style.width = Math.max(0, left / TIME * 100) + '%'; timeBar.classList.toggle('low', left < 8); if (left <= 0) end(); }, 100);
  }
  function end() { if (over) return; over = true; running = false; clearInterval(clockT); clearTimeout(spawnT); holes.forEach((x) => hide(x, false)); audio.sfx('chime'); setTimeout(() => ui.over(score, 'Mejor racha: ' + maxCombo + ' seguidos'), 450); }
  let maxCombo = 0; const oc = setCombo; setCombo = () => { maxCombo = Math.max(maxCombo, combo); oc(); };
  wrap.addEventListener('pointerdown', start, { once: false });
  ui.score(0);
  return () => { running = false; over = true; clearInterval(clockT); clearTimeout(spawnT); holes.forEach((x) => clearTimeout(x.to)); wrap.remove(); };
}
