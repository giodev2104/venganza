// Corazón volador: fondo con paralaje y estrellas, columnas que se estrechan, estela de partículas y medallas.
import { fit, loop, heartPath, Parts, onKeys, hint, roundRect } from './kit.js';
import * as audio from '../audio.js';

const W = 320, PW = 54, X = 88;
export function flappy(box, ui) {
  const bw = box.clientWidth || 360, bh = box.clientHeight || 640; const H = Math.round(Math.max(440, Math.min(660, W * bh / bw))), GROUND = H - 40;
  const g = fit(box, W, H), c = g.c, P = new Parts();
  const stars = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * GROUND * .8, s: .5 + Math.random() * 1.4, p: Math.random() * 6 }));
  let y, vy, state, pipes, score, dist, shake = 0, flash = 0, tr = 0;
  const gap = () => Math.max(108, 150 - score * .9), speed = () => 108 + Math.min(50, score * 1.7);
  function reset() { y = H * .48; vy = 0; state = 'ready'; pipes = []; score = 0; dist = 0; ui.score(0); }
  function flap() { if (state === 'dead') return; if (state === 'ready') { state = 'play'; spawn(W + 40); } vy = -295; audio.sfx('tap'); P.burst(X - 8, y + 6, 5, '#f9a8d4', 60, .4); }
  const spawn = (x) => { const gp = gap(), top = 70 + Math.random() * (GROUND - gp - 140); pipes.push({ x, top, gp, passed: false }); };
  function die() { if (state === 'dead') return; state = 'dead'; shake = .4; flash = 1; vy = -120; audio.sfx('crash'); P.burst(X, y, 24, '#f472b6', 200, .9); const medal = score >= 50 ? 'Medalla de oro' : score >= 25 ? 'Medalla de plata' : score >= 10 ? 'Medalla de bronce' : ''; setTimeout(() => ui.over(score, medal), 800); }
  g.cv.style.touchAction = 'none'; g.cv.addEventListener('pointerdown', flap);
  const offK = onKeys({ ' ': flap, ArrowUp: flap, w: flap });
  reset();
  const mountain = (off, hgt, col, k) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, GROUND); for (let x = 0; x <= W + 10; x += 10) c.lineTo(x, GROUND - hgt * (.55 + .45 * Math.sin((x + off * k) * .021) * Math.cos((x + off * k) * .0087 + 1))); c.lineTo(W, GROUND); c.fill(); };

  const stop = loop((dt, t) => {
    P.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2.2);
    if (state !== 'ready') { vy += 880 * dt; y += vy * dt; } else y = H * .48 + Math.sin(t * 4) * 7;
    if (state === 'play') {
      const sp = speed(); dist += sp * dt; for (const p of pipes) p.x -= sp * dt;
      if (!pipes.length || pipes[pipes.length - 1].x < W - 178) spawn(W + 30);
      pipes = pipes.filter((p) => p.x > -PW - 4);
      tr -= dt; if (tr <= 0) { tr = .05; P.a.push({ x: X - 10, y: y + 4, vx: -40, vy: 0, l: .35, m: .35, col: 'rgba(244,114,182,.7)', r: 3 }); }
      for (const p of pipes) {
        if (!p.passed && p.x + PW < X - 10) { p.passed = true; score++; ui.score(score); audio.sfx(score % 10 === 0 ? 'success' : 'coin'); }
        if (X + 11 > p.x && X - 11 < p.x + PW && (y - 10 < p.top || y + 10 > p.top + p.gp)) die();
      }
      if (y + 10 > GROUND || y - 10 < -20) die();
    } else if (state === 'dead') { if (y + 10 > GROUND) { y = GROUND - 10; vy = 0; } }
    c.save(); if (shake) c.translate((Math.random() - .5) * shake * 12, (Math.random() - .5) * shake * 12);
    const sky = c.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, '#120a2a'); sky.addColorStop(.6, '#3b1a5c'); sky.addColorStop(1, '#c2417b'); c.fillStyle = sky; c.fillRect(-10, -10, W + 20, H + 20);
    for (const s of stars) { c.globalAlpha = .35 + .5 * Math.abs(Math.sin(t * 1.5 + s.p)); c.fillStyle = '#fff'; c.beginPath(); c.arc((s.x - dist * .03 * s.s + 1000 * W) % W, s.y, s.s, 0, 6.283); c.fill(); } c.globalAlpha = 1;
    c.fillStyle = '#fff3c4'; c.shadowColor = '#fde68a'; c.shadowBlur = 30; c.beginPath(); c.arc(250, 110, 22, 0, 6.283); c.fill(); c.shadowBlur = 0;
    mountain(dist, 120, 'rgba(46,20,80,.85)', .15); mountain(dist + 300, 80, 'rgba(24,10,48,.95)', .35);
    for (const p of pipes) {
      const grad = c.createLinearGradient(p.x, 0, p.x + PW, 0); grad.addColorStop(0, '#6d28d9'); grad.addColorStop(.5, '#a78bfa'); grad.addColorStop(1, '#5b21b6');
      c.fillStyle = grad; c.shadowColor = 'rgba(167,139,250,.5)'; c.shadowBlur = 10;
      c.fillRect(p.x + 4, -4, PW - 8, p.top - 12); roundRect(c, p.x, p.top - 22, PW, 22, 6); c.fill();
      c.fillRect(p.x + 4, p.top + p.gp + 12, PW - 8, GROUND - p.top - p.gp - 12); roundRect(c, p.x, p.top + p.gp, PW, 22, 6); c.fill(); c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(p.x + 9, 0, 4, p.top - 22); c.fillRect(p.x + 9, p.top + p.gp + 22, 4, GROUND);
    }
    P.draw(c);
    const gg = c.createLinearGradient(0, GROUND, 0, H); gg.addColorStop(0, '#2a1250'); gg.addColorStop(1, '#0f0720'); c.fillStyle = gg; c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = '#f472b6'; c.fillRect(0, GROUND, W, 3); c.fillStyle = 'rgba(244,114,182,.25)'; for (let x = -((dist * 1) % 24); x < W; x += 24) c.fillRect(x, GROUND + 10, 12, 4);
    c.save(); c.translate(X, y); c.rotate(Math.max(-.5, Math.min(1.1, vy / 420))); c.shadowColor = '#f472b6'; c.shadowBlur = 18; c.fillStyle = state === 'dead' ? '#9ca3af' : '#fb7185'; heartPath(c, 0, 0, 14); c.fill(); c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-5, -5, 4, 2.5, -.5, 0, 6.283); c.fill(); c.restore();
    c.fillStyle = '#fff'; c.font = '800 44px system-ui'; c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10; if (state === 'play') c.fillText(score, W / 2, 70); c.shadowBlur = 0;
    if (state === 'ready') hint(c, W, H, ['Toca para volar', 'Pasa entre las columnas'], t);
    if (flash) { c.fillStyle = `rgba(255,255,255,${flash * .5})`; c.fillRect(0, 0, W, H); }
    c.restore();
  });
  return () => { stop(); offK(); g.destroy(); };
}
