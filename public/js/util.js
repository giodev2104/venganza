// Utilidades de DOM y generales (sin dependencias).
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Hiperscript mínimo: h('div', {class:'x', onclick}, ...hijos). `html` solo para cadenas de confianza (iconos). */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* sin vibración */ } };
export const fmtTime = (ms) => { const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? `${m} min ${s % 60} s` : `${s} s`; };

/** Espera que se puede acelerar con un toque (accesibilidad y paciencia). */
export function skipper(root = document) {
  let skipped = false; const subs = new Set();
  const fire = () => { skipped = true; subs.forEach((f) => f()); subs.clear(); };
  root.addEventListener('pointerdown', fire, { once: true });
  return {
    get skipped() { return skipped; },
    sleep(ms) { if (skipped) return Promise.resolve(); return new Promise((res) => { const t = setTimeout(() => { subs.delete(fin); res(); }, ms); const fin = () => { clearTimeout(t); res(); }; subs.add(fin); }); },
    stop() { root.removeEventListener('pointerdown', fire); },
  };
}

/** Escribe texto como máquina de escribir. Devuelve una promesa; `sk` permite saltarlo. */
export async function typewriter(el, text, { speed = 28, sk = null, onTick = null } = {}) {
  el.textContent = '';
  if (reduceMotion() || (sk && sk.skipped)) { el.textContent = text; return; }
  for (let i = 0; i < text.length; i++) {
    if (sk && sk.skipped) { el.textContent = text; return; }
    el.textContent += text[i]; if (onTick && text[i].trim()) onTick();
    await sleep(/[.,;:!?…]/.test(text[i]) ? speed * 5 : speed);
  }
}

export function animate(el, cls, ms = 600) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); return new Promise((r) => setTimeout(() => { el.classList.remove(cls); r(); }, ms)); }
export function copyText(t) { try { return navigator.clipboard.writeText(t).then(() => true, () => fallbackCopy(t)); } catch { return Promise.resolve(fallbackCopy(t)); } }
function fallbackCopy(t) { const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = t; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* no soportado */ } ta.remove(); return ok; }
export const cssVar = (n, el = document.getElementById('app')) => getComputedStyle(el).getPropertyValue(n).trim();
export function safeJSON(s, d) { try { return JSON.parse(s); } catch { return d; } }
