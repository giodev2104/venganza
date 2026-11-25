// Rompecorazones: 4 niveles con formas, ladrillos resistentes, 4 potenciadores, vidas y bola con efecto según dónde golpee la pala.
import { fit, loop, heartPath, Parts, onKeys, hint, roundRect, lerp } from './kit.js';
import * as audio from '../audio.js';

const W = 320, BW = 36, BH = 14, GAP = 3, OX = (W - (8 * BW + 7 * GAP)) / 2, OY = 58, R = 5.5;
const LEVELS = [
  ['22222222', '11111111', '11111111', '11111111', '11111111'],
  ['.11..11.', '11221122', '12222221', '12222221', '.122221.', '..1221..', '...11...'],
  ['12121212', '21212121', '12121212', '21212121', '12121212', '21212121'],
  ['22222222', '2......2', '2.1111.2', '2.1..1.2', '2.1111.2', '2......2', '22222222'],
];
const PW = { W: ['#f472b6', 'Ancha'], M: ['#a78bfa', 'Multi'], S: ['#67e8f9', 'Lenta'], L: ['#fde047', 'Vida'] };

export function breakout(box, ui) {
  const bw = box.clientWidth || 360, bh = box.clientHeight || 640; const H = Math.round(Math.max(480, Math.min(680, W * bh / bw))), PY = H - 30;
  const g = fit(box, W, H), c = g.c, P = new Parts();
  let bricks, balls, caps, pad, lives, score, level, state, wideT, slowT, banner, shake = 0, combo = 0;
  const speedBase = () => 255 + (level - 1) * 22;
  function load() {
    const pat = LEVELS[(level - 1) % LEVELS.length]; bricks = [];
    pat.forEach((row, r) => [...row].forEach((ch, col) => { if (ch !== '.') bricks.push({ x: OX + col * (BW + GAP), y: OY + r * (BH + GAP), hp: +ch, max: +ch, r }); }));
    caps = []; wideT = 0; slowT = 0; pad.w = 64; stick(); banner = { t: 1.6, s: 'Nivel ' + level };
  }
  function stick() { balls = [{ x: pad.x, y: PY - 11, vx: 0, vy: 0, st: true }]; state = 'ready'; combo = 0; }
  function launch() { if (state !== 'ready') return; state = 'play'; const b = balls[0]; b.st = false; const a = -Math.PI / 2 + (Math.random() - .5) * .5; b.vx = Math.cos(a) * speedBase(); b.vy = Math.sin(a) * speedBase(); audio.sfx('tap'); }
  function reset() { pad = { x: W / 2, w: 64 }; lives = 3; score = 0; level = 1; load(); ui.score(0); }
  const col = (b) => b.hp === 2 ? '#7c3aed' : ['#f472b6', '#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#5eead4', '#67e8f9'][b.r % 7];
  function hitBrick(b) {
    b.hp--; combo++; const x = b.x + BW / 2, y = b.y + BH / 2;
    if (b.hp <= 0) {
      bricks.splice(bricks.indexOf(b), 1); score += 10 * Math.min(4, 1 + Math.floor(combo / 6)); ui.score(score); audio.sfx(combo % 5 === 0 ? 'coin' : 'pop'); P.burst(x, y, 12, col(b), 150);
      if (Math.random() < .13) caps.push({ x, y, t: 'WMSL'[Math.floor(Math.random() * 4)] });
    } else { audio.sfx('tap'); P.burst(x, y, 4, '#c4b5fd', 80); }
    if (!bricks.length) { score += 100 * level; ui.score(score); audio.sfx('success'); level++; load(); }
  }
  function moveBall(b, dt) {
    const sp = Math.hypot(b.vx, b.vy), steps = Math.max(1, Math.ceil(sp * dt / 3.5)), d = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * d; b.y += b.vy * d;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); audio.sfx('click'); } if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); audio.sfx('click'); } if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); audio.sfx('click'); }
      if (b.vy > 0 && b.y + R >= PY && b.y - R <= PY + 10 && b.x >= pad.x - pad.w / 2 - 3 && b.x <= pad.x + pad.w / 2 + 3) {
        const u = Math.max(-1, Math.min(1, (b.x - pad.x) / (pad.w / 2))), a = -Math.PI / 2 + u * 1.05, v = Math.min(430, Math.max(speedBase() * (slowT > 0 ? .7 : 1), sp * 1.012));
        b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = PY - R; combo = 0; audio.sfx('flip');
      }
      for (const k of bricks) {
        const nx = Math.max(k.x, Math.min(b.x, k.x + BW)), ny = Math.max(k.y, Math.min(b.y, k.y + BH)), dx = b.x - nx, dy = b.y - ny;
        if (dx * dx + dy * dy <= R * R) { if (Math.abs(dx) > Math.abs(dy)) { b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx); } else { b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy); } hitBrick(k); break; }
      }
    }
  }
  function power(t) {
    audio.sfx(t === 'L' ? 'success' : 'coin');
    if (t === 'W') { wideT = 10; } else if (t === 'S') { slowT = 8; balls.forEach((b) => { b.vx *= .7; b.vy *= .7; }); }
    else if (t === 'L') lives = Math.min(5, lives + 1);
    else if (t === 'M') { const src = balls.find((b) => !b.st) || balls[0]; if (!src.st) for (const da of [-.45, .45]) { const a = Math.atan2(src.vy, src.vx) + da, v = Math.hypot(src.vx, src.vy); balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, st: false }); } }
    banner = { t: 1, s: PW[t][1] };
  }
  let drag = null;
  g.cv.style.touchAction = 'none';
  g.cv.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX }; try { g.cv.setPointerCapture(e.pointerId); } catch { /* ok */ } launch(); });
  g.cv.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId) return; const k = W / g.cv.getBoundingClientRect().width; pad.x += (e.clientX - drag.x) * k * 1.35; drag.x = e.clientX; });
  const up = () => { drag = null; }; g.cv.addEventListener('pointerup', up); g.cv.addEventListener('pointercancel', up);
  let kl = 0, kr = 0;
  const offK = onKeys({ ArrowLeft: () => { kl = .09; }, ArrowRight: () => { kr = .09; }, a: () => { kl = .09; }, d: () => { kr = .09; }, ' ': launch, ArrowUp: launch });
  reset();

  const stop = loop((dt, t) => {
    P.update(dt); shake = Math.max(0, shake - dt); if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (kl > 0) { pad.x -= 340 * dt; kl -= dt; } if (kr > 0) { pad.x += 340 * dt; kr -= dt; }
    if (state !== 'dead') {
      wideT = Math.max(0, wideT - dt); slowT = Math.max(0, slowT - dt); pad.w = lerp(pad.w, wideT > 0 ? 100 : 64, Math.min(1, dt * 10)); pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, pad.x));
      if (state === 'ready') { balls[0].x = pad.x; balls[0].y = PY - 11; }
      for (const b of balls) if (!b.st) moveBall(b, dt);
      balls = balls.filter((b) => b.st || b.y < H + 20);
      if (!balls.length && state === 'play') { lives--; audio.sfx('fail'); shake = .35; if (lives <= 0) { state = 'dead'; setTimeout(() => ui.over(score, 'Llegaste al nivel ' + level), 600); } else stick(); }
      for (const p of caps) { p.y += 95 * dt; if (p.y > PY - 6 && p.y < PY + 14 && Math.abs(p.x - pad.x) < pad.w / 2 + 10 && !p.got) { p.got = true; power(p.t); } }
      caps = caps.filter((p) => !p.got && p.y < H + 20);
    }
    c.save(); if (shake) c.translate((Math.random() - .5) * shake * 10, (Math.random() - .5) * shake * 10);
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#190d33'); bg.addColorStop(1, '#0a0716'); c.fillStyle = bg; c.fillRect(-10, -10, W + 20, H + 20);
    c.fillStyle = 'rgba(167,139,250,.07)'; for (let i = 0; i < 14; i++) c.fillRect(0, 40 + i * 32, W, 1);
    for (const k of bricks) {
      const cc = col(k); c.fillStyle = cc; c.shadowColor = cc; c.shadowBlur = 7; roundRect(c, k.x, k.y, BW, BH, 4); c.fill(); c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.28)'; roundRect(c, k.x + 2, k.y + 2, BW - 4, 4, 2); c.fill();
      if (k.max === 2 && k.hp === 2) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; roundRect(c, k.x + 1, k.y + 1, BW - 2, BH - 2, 4); c.stroke(); }
    }
    for (const p of caps) { c.fillStyle = PW[p.t][0]; c.shadowColor = PW[p.t][0]; c.shadowBlur = 10; roundRect(c, p.x - 13, p.y - 8, 26, 16, 8); c.fill(); c.shadowBlur = 0; c.fillStyle = '#1b1238'; c.font = '800 11px system-ui'; c.textAlign = 'center'; c.fillText(p.t, p.x, p.y + 4); }
    const pg = c.createLinearGradient(pad.x - pad.w / 2, 0, pad.x + pad.w / 2, 0); pg.addColorStop(0, '#a78bfa'); pg.addColorStop(1, '#f472b6'); c.fillStyle = pg; c.shadowColor = '#c084fc'; c.shadowBlur = 14; roundRect(c, pad.x - pad.w / 2, PY, pad.w, 10, 5); c.fill(); c.shadowBlur = 0;
    for (const b of balls) { c.fillStyle = '#fff'; c.shadowColor = slowT > 0 ? '#67e8f9' : '#f9a8d4'; c.shadowBlur = 16; c.beginPath(); c.arc(b.x, b.y, R, 0, 6.283); c.fill(); } c.shadowBlur = 0;
    P.draw(c);
    for (let i = 0; i < lives; i++) { c.fillStyle = '#f472b6'; heartPath(c, 14 + i * 20, 22, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '700 12px system-ui'; c.textAlign = 'right'; c.fillText('Nivel ' + level, W - 12, 26);
    if (wideT > 0 || slowT > 0) { c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 11px system-ui'; c.fillText([wideT > 0 ? 'ANCHA ' + Math.ceil(wideT) : '', slowT > 0 ? 'LENTA ' + Math.ceil(slowT) : ''].filter(Boolean).join('  '), W / 2, 26); }
    if (banner) { c.save(); c.globalAlpha = Math.min(1, banner.t * 2); c.textAlign = 'center'; c.fillStyle = '#fff'; c.shadowColor = '#c084fc'; c.shadowBlur = 20; c.font = '800 32px system-ui'; c.fillText(banner.s, W / 2, H * .5); c.restore(); }
    if (state === 'ready' && !banner) hint(c, W, H, ['Toca para lanzar', 'Arrastra para mover la pala'], t);
    c.restore();
  });
  return () => { stop(); offK(); g.destroy(); };
}
