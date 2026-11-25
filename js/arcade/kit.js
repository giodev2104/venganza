// Utilidades comunes de la sala de juegos: récords, lienzo adaptable, bucle, gestos y partículas.
import { h } from '../util.js';

const KEY = 'venganza2.arcade';
const rd = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
export const best = {
  get: (id) => +rd()[id] || 0,
  set(id, v) { const o = rd(); if (v > (+o[id] || 0)) { o[id] = v; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* sin almacenamiento */ } return true; } return false; },
};

export function heartPath(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * .42);
  c.bezierCurveTo(x + s * 1.05, y - s * .12, x + s * .58, y - s * .88, x, y - s * .32);
  c.bezierCurveTo(x - s * .58, y - s * .88, x - s * 1.05, y - s * .12, x, y + s * .42); c.closePath();
}

/** Lienzo con coordenadas lógicas W×H que se escala al hueco disponible (nítido en pantallas densas). */
export function fit(box, W, H) {
  const cv = h('canvas', { class: 'ar-cv' }); box.append(cv); const c = cv.getContext('2d');
  const size = () => {
    const bw = box.clientWidth || W, bh = box.clientHeight || H, k = Math.min(bw / W, bh / H), dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px'; cv.width = Math.max(1, Math.round(W * k * dpr)); cv.height = Math.max(1, Math.round(H * k * dpr)); c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  };
  size(); const ro = new ResizeObserver(size); ro.observe(box);
  return { cv, c, W, H, destroy: () => { ro.disconnect(); cv.remove(); }, local: (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; } };
}

export function loop(fn) {
  let raf = 0, last = 0, on = true;
  const f = (t) => { if (!on) return; const dt = Math.min(.05, (t - (last || t)) / 1000); last = t; if (!document.hidden) fn(dt, t / 1000); raf = requestAnimationFrame(f); };
  raf = requestAnimationFrame(f);
  return () => { on = false; cancelAnimationFrame(raf); };
}

/** Gestos de deslizar: se pueden encadenar sin levantar el dedo. */
export function swipe(el, cb, min = 20) {
  let sx = 0, sy = 0, id = null; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; id = e.pointerId; });
  el.addEventListener('pointermove', (e) => {
    if (id !== e.pointerId) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) < min) return;
    cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); sx = e.clientX; sy = e.clientY;
  });
  const end = (e) => { if (id === e.pointerId) id = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

export class Parts {
  constructor() { this.a = []; }
  burst(x, y, n = 12, col = '#f472b6', spd = 130, life = .6) {
    for (let i = 0; i < n; i++) { const an = Math.random() * 6.283, s = spd * (.4 + Math.random() * .8); this.a.push({ x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, l: life * (.6 + Math.random() * .6), m: life, col, r: 1.4 + Math.random() * 2.2 }); }
  }
  update(dt) { for (const p of this.a) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.l -= dt; } this.a = this.a.filter((p) => p.l > 0); }
  draw(c) { for (const p of this.a) { c.globalAlpha = Math.max(0, p.l / p.m); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); } c.globalAlpha = 1; }
}

export const lerp = (a, b, t) => a + (b - a) * t;
export function onKeys(map) { const f = (e) => { const fn = map[e.key]; if (fn) { e.preventDefault(); fn(e); } }; addEventListener('keydown', f); return () => removeEventListener('keydown', f); }
export function roundRect(c, x, y, w, h2, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h2, r); c.arcTo(x + w, y + h2, x, y + h2, r); c.arcTo(x, y + h2, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
export function hint(c, W, H, lines, t) {
  c.save(); c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.92)'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 8;
  lines.forEach((s, i) => { c.font = (i ? '500 13px' : '700 18px') + ' system-ui, sans-serif'; c.globalAlpha = i ? .75 : .8 + Math.sin(t * 4) * .2; c.fillText(s, W / 2, H * .62 + i * 24); }); c.restore();
}
