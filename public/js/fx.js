// Efectos visuales en canvas: partículas ambientales (ligeras, pausables) y celebraciones puntuales.
// El bucle de animación solo corre mientras hay algo que dibujar, para ahorrar batería.
import { rand, pick, reduceMotion, cssVar } from './util.js';

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
let amb, ambCtx, ambItems = [], ambRaf = 0, ambTheme = 'c1', low = false;
let fxc, fxCtx, parts = [], fxRaf = 0, lastT = 0, rockets = [], fwUntil = 0, heartUntil = 0, W = 0, H = 0;

export function init() {
  amb = document.getElementById('ambient'); ambCtx = amb.getContext('2d');
  fxc = document.getElementById('fxcanvas'); fxCtx = fxc.getContext('2d');
  resize(); addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { document.hidden ? stopAmb() : startAmb(); });
}
function resize() {
  const d = dpr(); W = innerWidth; H = innerHeight;
  for (const c of [amb, fxc]) { c.width = W * d; c.height = H * d; }
  ambCtx.setTransform(d, 0, 0, d, 0, 0); fxCtx.setTransform(d, 0, 0, d, 0, 0);
}
const colors = () => [cssVar('--a1'), cssVar('--a2'), cssVar('--a3'), '#ffffff'].filter(Boolean);

// ── Ambiente ──
const AMB = {
  c1: { n: 22, vy: [-.18, -.5], vx: [-.1, .1], r: [1.5, 4.5], a: .5 },
  c2: { n: 16, vy: [-.1, -.3], vx: [-.2, .2], r: [3, 9], a: .25 },
  c3: { n: 26, vy: [-.35, -.9], vx: [-.25, .25], r: [1, 3.2], a: .7 },
  c4: { n: 20, vy: [.06, .22], vx: [-.06, .06], r: [1, 3], a: .55 },
};
export function setTheme(id) { ambTheme = id; seedAmb(); }
export function setLow(v) { low = v; v || reduceMotion() ? stopAmb() : startAmb(); }
function seedAmb() {
  const c = AMB[ambTheme] || AMB.c1, cols = colors(), n = low ? Math.ceil(c.n / 3) : c.n;
  ambItems = Array.from({ length: n }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(...c.vx), vy: rand(...c.vy), r: rand(...c.r), a: rand(.15, c.a), col: pick(cols), ph: rand(0, 6.28) }));
}
function startAmb() { if (ambRaf || low || reduceMotion()) return; seedAmb(); let last = performance.now(); const loop = (t) => { const dt = Math.min(50, t - last) / 16.7; last = t; ambCtx.clearRect(0, 0, W, H); for (const p of ambItems) { p.x += p.vx * dt; p.y += p.vy * dt; p.ph += .02 * dt; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10; if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; ambCtx.globalAlpha = p.a * (.6 + .4 * Math.sin(p.ph)); ambCtx.fillStyle = p.col; ambCtx.shadowColor = p.col; ambCtx.shadowBlur = p.r * 3; ambCtx.beginPath(); ambCtx.arc(p.x, p.y, p.r, 0, 6.283); ambCtx.fill(); } ambRaf = requestAnimationFrame(loop); }; ambRaf = requestAnimationFrame(loop); }
function stopAmb() { cancelAnimationFrame(ambRaf); ambRaf = 0; ambCtx && ambCtx.clearRect(0, 0, W, H); }
export const startAmbient = startAmb;

// ── Celebraciones ──
function add(p) { parts.push({ life: 0, max: 2, g: 0, vr: 0, rot: 0, alpha: 1, shape: 'rect', size: 6, drag: 1, trail: 0, ...p }); if (!fxRaf) { lastT = performance.now(); fxRaf = requestAnimationFrame(tick); } }
function tick(t) {
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  fxCtx.clearRect(0, 0, W, H);
  const now = performance.now();
  if (now < fwUntil && Math.random() < .045) launchRocket();
  if (now < heartUntil && Math.random() < .25) add({ shape: 'heart', x: rand(0, W), y: H + 20, vx: rand(-14, 14), vy: rand(-90, -160), size: rand(9, 22), max: rand(3.5, 6), col: pick(['#f472b6', '#fb7185', '#fda4af', '#f9a8d4', cssVar('--a1')]), alpha: .85, fade: 1 });
  for (const r of rockets) { r.y += r.vy * dt; r.vy += 60 * dt; add({ shape: 'circle', x: r.x, y: r.y, size: 2, max: .5, col: '#fff', vx: rand(-8, 8), vy: rand(10, 30), alpha: .8 }); if (r.vy >= -40 || r.y < r.top) { r.done = true; explode(r.x, r.y, r.col); } }
  rockets = rockets.filter((r) => !r.done);
  fxCtx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    p.life += dt; if (p.life >= p.max) { p.dead = true; continue; }
    p.vx *= Math.pow(.5, dt * (p.drag - 1) * 2 + 0); p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const k = 1 - p.life / p.max; fxCtx.globalAlpha = Math.max(0, p.alpha * (p.fade ? Math.min(1, k * 3) : Math.min(1, k * 2)));
    fxCtx.fillStyle = p.col; fxCtx.strokeStyle = p.col;
    fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(p.rot);
    if (p.shape === 'rect') { fxCtx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .6); }
    else if (p.shape === 'heart') { const s = p.size; fxCtx.beginPath(); fxCtx.moveTo(0, s * .35); fxCtx.bezierCurveTo(-s, -s * .3, -s * .4, -s, 0, -s * .4); fxCtx.bezierCurveTo(s * .4, -s, s, -s * .3, 0, s * .35); fxCtx.fill(); }
    else if (p.shape === 'star') { const s = p.size; fxCtx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * .3 : s; fxCtx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } fxCtx.closePath(); fxCtx.fill(); }
    else { fxCtx.beginPath(); fxCtx.arc(0, 0, p.size * (p.shrink ? k : 1), 0, 6.283); fxCtx.fill(); }
    fxCtx.restore();
  }
  fxCtx.globalCompositeOperation = 'source-over';
  parts = parts.filter((p) => !p.dead);
  if (parts.length || rockets.length || now < fwUntil || now < heartUntil) fxRaf = requestAnimationFrame(tick);
  else { fxRaf = 0; fxCtx.clearRect(0, 0, W, H); }
}
function launchRocket() { const x = rand(W * .15, W * .85); rockets.push({ x, y: H + 10, vy: rand(-620, -820), top: rand(H * .12, H * .42), col: pick(['#fde68a', '#f9a8d4', '#a5b4fc', '#fb7185', '#fdba74', '#e8c987', '#99f6e4']) }); if (!fxRaf) { lastT = performance.now(); fxRaf = requestAnimationFrame(tick); } }
function explode(x, y, col) { const n = low ? 22 : 46; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rand(-.1, .1), s = rand(90, 220); add({ shape: 'circle', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 120, size: rand(1.5, 3), max: rand(.9, 1.7), col: i % 5 === 0 ? '#fff' : col, drag: 1.8, shrink: 1 }); } }

export function confetti({ x = W / 2, y = H * .55, count = 90, spread = 1, power = 1 } = {}) {
  if (reduceMotion()) return; const cols = colors().concat(['#fde68a', '#f9a8d4']); const n = low ? Math.ceil(count / 2) : count;
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rand(-1, 1) * spread * 1.1, s = rand(260, 640) * power; add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 780, vr: rand(-9, 9), rot: rand(0, 6), size: rand(6, 12), max: rand(1.8, 3), col: pick(cols), drag: 1.5 }); }
}
export function confettiRain(ms = 2200) { if (reduceMotion()) return; const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - t0 > ms) return clearInterval(iv); for (let i = 0; i < 4; i++) add({ x: rand(0, W), y: -10, vx: rand(-40, 40), vy: rand(120, 260), g: 120, vr: rand(-6, 6), size: rand(6, 11), max: 4, col: pick(colors()), drag: 1 }); }, 90); }
export function fireworks(ms = 6000) { if (reduceMotion()) return; fwUntil = performance.now() + ms; launchRocket(); }
export function hearts(ms = 5000) { if (reduceMotion()) return; heartUntil = performance.now() + ms; if (!fxRaf) { lastT = performance.now(); fxRaf = requestAnimationFrame(tick); } }
export function sparkle(x, y, n = 16, col) { if (reduceMotion()) return; for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(40, 180); add({ shape: i % 3 ? 'circle' : 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 160, size: rand(2, 6), max: rand(.5, 1.1), col: col || pick(colors()), drag: 2, shrink: 1, vr: rand(-6, 6) }); } }
export function sparkleAt(el, n, col) { const r = el.getBoundingClientRect(); sparkle(r.left + r.width / 2, r.top + r.height / 2, n, col); }
export function embers(ms = 4000, col = '#fb923c') { if (reduceMotion()) return; const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - t0 > ms) return clearInterval(iv); for (let i = 0; i < 3; i++) add({ shape: 'circle', x: rand(0, W), y: H + 8, vx: rand(-30, 30), vy: rand(-120, -260), size: rand(1.5, 3.5), max: rand(2, 4), col: pick([col, '#fde047', '#f43f5e']), shrink: 1, drag: 1 }); }, 70); }
export function clearFx() { parts = []; rockets = []; fwUntil = 0; heartUntil = 0; }

export function shake(el, ms = 450) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), ms); }
export function glitch(el, ms = 1200) { el.classList.add('glitching'); return new Promise((r) => setTimeout(() => { el.classList.remove('glitching'); r(); }, ms)); }
