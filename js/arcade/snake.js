// Serpiente neón: corazones, corazón dorado con cuenta atrás, velocidad creciente y movimiento suave.
import { fit, loop, swipe, heartPath, Parts, onKeys, hint, roundRect } from './kit.js';
import * as audio from '../audio.js';

const COLS = 16, CS = 20, W = COLS * CS;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export function snake(box, ui) {
  const bw = box.clientWidth || 360, bh = box.clientHeight || 640; const ROWS = Math.max(18, Math.min(30, Math.floor(COLS * bh / bw))), H = ROWS * CS;
  const HC = Math.max(H, Math.round(W * bh / bw)), OY = (HC - H) / 2, g = fit(box, W, HC), c = g.c, P = new Parts();
  let body, from, dir, q, food, gold, goldT, score, tick, acc, state, eaten, shake = 0, flash = 0;
  const free = (x, y) => !body.some((s) => s.x === x && s.y === y) && !(food && food.x === x && food.y === y) && !(gold && gold.x === x && gold.y === y);
  const spot = () => { for (let i = 0; i < 400; i++) { const x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS); if (free(x, y)) return { x, y }; } return { x: 0, y: 0 }; };
  const reset = () => { body = [{ x: 8, y: ROWS >> 1 }, { x: 7, y: ROWS >> 1 }, { x: 6, y: ROWS >> 1 }]; from = body.map((s) => ({ ...s })); dir = DIRS.right; q = []; score = 0; eaten = 0; gold = null; goldT = 0; acc = 0; tick = .15; state = 'ready'; food = null; food = spot(); ui.score(0); };
  const turn = (d) => {
    if (state === 'dead') return; const v = DIRS[d], last = q.length ? q[q.length - 1] : dir;
    if ((v.x === -last.x && v.y === -last.y) || (v.x === last.x && v.y === last.y)) return;
    if (q.length < 3) q.push(v); if (state === 'ready') state = 'play';
  };
  const die = () => { state = 'dead'; shake = .5; flash = 1; audio.sfx('crash'); body.forEach((s) => P.burst(s.x * CS + CS / 2, s.y * CS + CS / 2, 3, '#f472b6', 150)); setTimeout(() => ui.over(score, eaten + ' corazones'), 750); };
  const step = () => {
    dir = q.shift() || dir; const old = body.map((s) => ({ ...s })), head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return die();
    const eatsFood = food.x === head.x && food.y === head.y, eatsGold = gold && gold.x === head.x && gold.y === head.y;
    if (body.some((s, i) => s.x === head.x && s.y === head.y && (i < body.length - 1 || eatsFood || eatsGold))) return die();
    body.unshift(head);
    if (eatsFood) { eaten++; score += 10; audio.sfx('heart'); P.burst(head.x * CS + 10, head.y * CS + 10, 14, '#f472b6'); tick = Math.max(.07, tick * .975); food = null; food = spot(); if (eaten % 5 === 0) { gold = null; gold = spot(); goldT = 7; } }
    else if (eatsGold) { score += 30; audio.sfx('coin'); P.burst(head.x * CS + 10, head.y * CS + 10, 22, '#fde047', 170); gold = null; }
    else body.pop();
    from = body.map((_, i) => ({ ...old[Math.min(Math.max(0, i - 1), old.length - 1)] })); ui.score(score);
  };
  swipe(g.cv, turn);
  const offKeys = onKeys({ ArrowUp: () => turn('up'), ArrowDown: () => turn('down'), ArrowLeft: () => turn('left'), ArrowRight: () => turn('right'), w: () => turn('up'), s: () => turn('down'), a: () => turn('left'), d: () => turn('right') });
  g.cv.addEventListener('pointerdown', () => { if (state === 'ready') { state = 'play'; } });
  reset();

  const stop = loop((dt, t) => {
    P.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2.5);
    if (state === 'play') { acc += dt; if (gold) { goldT -= dt; if (goldT <= 0) gold = null; } while (acc >= tick && state === 'play') { acc -= tick; step(); } }
    // ── dibujo ──
    c.save(); if (shake) c.translate((Math.random() - .5) * shake * 14, (Math.random() - .5) * shake * 14);
    const bg = c.createLinearGradient(0, 0, 0, HC); bg.addColorStop(0, '#140b2b'); bg.addColorStop(1, '#0a0716'); c.fillStyle = bg; c.fillRect(-20, -20, W + 40, HC + 40); c.translate(0, OY);
    c.fillStyle = 'rgba(167,139,250,.14)'; for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) { c.beginPath(); c.arc(x * CS + CS / 2, y * CS + CS / 2, 1.1, 0, 6.283); c.fill(); }
    const pulse = 1 + Math.sin(t * 6) * .08;
    c.shadowColor = '#f472b6'; c.shadowBlur = 14; c.fillStyle = '#f472b6'; heartPath(c, food.x * CS + 10, food.y * CS + 10, 8.5 * pulse); c.fill();
    if (gold) { c.shadowColor = '#fde047'; c.fillStyle = '#fde047'; heartPath(c, gold.x * CS + 10, gold.y * CS + 10, 9.5 * (1 + Math.sin(t * 9) * .1)); c.fill(); c.shadowBlur = 0; c.strokeStyle = 'rgba(253,224,71,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(gold.x * CS + 10, gold.y * CS + 10, 15, -Math.PI / 2, -Math.PI / 2 + 6.283 * (goldT / 7)); c.stroke(); }
    c.shadowBlur = 0;
    const k = state === 'play' ? Math.min(1, acc / tick) : 1, n = body.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = body[i], f = from[i] || s, x = (f.x + (s.x - f.x) * k) * CS, y = (f.y + (s.y - f.y) * k) * CS, u = n > 1 ? i / (n - 1) : 0;
      const col = `hsl(${268 + (1 - u) * 60} 85% ${58 + (1 - u) * 6}%)`; c.fillStyle = state === 'dead' ? '#6b5b95' : col;
      if (i === 0) { c.shadowColor = '#f472b6'; c.shadowBlur = 16; } else c.shadowBlur = 6; c.shadowColor = state === 'dead' ? 'transparent' : col;
      roundRect(c, x + 1.5, y + 1.5, CS - 3, CS - 3, i === 0 ? 7 : 6); c.fill();
      if (i === 0) { c.shadowBlur = 0; c.fillStyle = '#fff'; for (const sg of [-1, 1]) { c.beginPath(); c.arc(x + 10 + dir.x * 3 - dir.y * 4 * sg, y + 10 + dir.y * 3 + dir.x * 4 * sg, 2.6, 0, 6.283); c.fill(); } }
    }
    c.shadowBlur = 0; P.draw(c);
    if (flash) { c.fillStyle = `rgba(251,113,133,${flash * .35})`; c.fillRect(0, 0, W, H); }
    if (state === 'ready') hint(c, W, H, ['Desliza para empezar', 'Come corazones. Los dorados valen 30.'], t);
    c.restore();
  });
  return () => { stop(); offKeys(); g.destroy(); };
}
