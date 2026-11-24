// Pruebas de descubrir: foto pixelada, rascar para revelar y objetos ocultos en una escena.
import { h, sleep, clamp, typewriter } from '../util.js';
import { icon } from '../icons.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';

// ── Foto pixelada que se aclara progresivamente ──
export function runPixel(root, task, ctx) {
  return new Promise((resolve) => {
    const LEVELS = [5, 8, 12, 20, 34, 60, 120, 0];
    let level = 0; const last = LEVELS.length - 1;
    const cv = h('canvas', { class: 'px-canvas', role: 'img', 'aria-label': 'Foto pixelada' });
    const lab = h('span', { class: 'small muted' });
    const more = h('button', { class: 'btn btn-ghost btn-sm' }, h('span', { html: icon('eye', 18) }), 'Aclarar');
    const input = h('input', { class: 'input', type: 'text', placeholder: task.placeholder || '¿Qué es?', autocomplete: 'off', autocapitalize: 'none', 'aria-label': 'Tu respuesta' });
    const send = h('button', { class: 'btn' }, 'Comprobar', h('span', { html: icon('check', 20) }));
    const img = new Image(); img.src = task.image;
    const draw = () => {
      const W = cv.width, Hh = cv.height, g = cv.getContext('2d'), n = LEVELS[level];
      g.imageSmoothingEnabled = !!(n === 0);
      if (!n) { g.drawImage(img, 0, 0, W, Hh); }
      else { const t = document.createElement('canvas'); t.width = n; t.height = Math.max(1, Math.round(n * Hh / W)); t.getContext('2d').drawImage(img, 0, 0, t.width, t.height); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, W, Hh); }
      lab.textContent = `Nitidez ${level + 1}/${LEVELS.length}`; more.disabled = level >= last;
    };
    const setup = () => { const w = Math.min(root.clientWidth || 360, 440), r = (img.naturalHeight || 1) / (img.naturalWidth || 1); cv.width = Math.round(w); cv.height = Math.round(clamp(w * r, 140, innerHeight * .5)); draw(); };
    img.addEventListener('load', setup); if (img.complete) setup();
    img.addEventListener('error', () => { lab.textContent = 'No se pudo cargar la foto'; });
    more.addEventListener('click', () => { if (level < last) { level++; audio.sfx('pop'); draw(); } });
    ctx.onAssist((a) => { level = clamp(Math.max(level, a * 2), 0, last - 1); draw(); });
    const check = async () => {
      const v = input.value.trim(); if (!v) { fx.shake(input); return; }
      const res = await ctx.submit({ answer: v }, 'pixel'); if (!res) return;
      if (!res.ok) { fx.shake(input); return; }
      level = last; draw(); audio.sfx('match'); fx.sparkleAt(cv, 24); await sleep(1100); resolve(res);
    };
    send.addEventListener('click', check); input.addEventListener('keydown', (e) => e.key === 'Enter' && check());
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), h('div', { class: 'px-frame' }, cv), h('div', { class: 'px-bar' }, lab, more), h('div', { class: 'field' }, input, send)));
  });
}

// ── Rascar para descubrir un mensaje ──
export function runScratch(root, task, ctx) {
  return new Promise((resolve) => {
    let threshold = .5, done = false; const GW = 22, GH = 12, seen = new Set();
    const cv = h('canvas', { class: 'sc-canvas', 'aria-label': 'Zona para rascar' });
    const under = h('div', { class: 'sc-under', 'aria-live': 'polite' }, h('span', { class: 'sc-q' }, '? ? ?'));
    const card = h('div', { class: 'sc-card' }, under, cv);
    const bar = h('div', { class: 'mini-bar', 'aria-hidden': 'true' }, h('b', { style: { width: '0%' } }));
    const g = cv.getContext('2d'); let W = 0, Hh = 0;
    const cover = () => {
      W = cv.width = card.clientWidth || 340; Hh = cv.height = card.clientHeight || 210;
      const gr = g.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, '#9aa0b4'); gr.addColorStop(.5, '#d9dcea'); gr.addColorStop(1, '#8d92a8'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      g.globalAlpha = .18; for (let i = 0; i < 700; i++) { g.fillStyle = i % 2 ? '#fff' : '#445'; g.fillRect(Math.random() * W, Math.random() * Hh, 2, 2); } g.globalAlpha = 1;
      g.fillStyle = 'rgba(40,40,70,.55)'; g.font = '700 22px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.fillText('RASCA AQUÍ', W / 2, Hh / 2 + 8);
    };
    requestAnimationFrame(cover);
    const scratch = (x, y) => {
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, 24, 0, 6.283); g.fill(); g.globalCompositeOperation = 'source-over';
      const r = 1.6; for (let dx = -r; dx <= r; dx += .8) for (let dy = -r; dy <= r; dy += .8) { const cx = Math.floor((x / W + dx / GW) * GW), cy = Math.floor((y / Hh + dy / GH) * GH); if (cx >= 0 && cy >= 0 && cx < GW && cy < GH && Math.hypot(dx, dy) <= r) seen.add(cx * 100 + cy); }
      const p = seen.size / (GW * GH); bar.firstChild.style.width = Math.min(100, Math.round(p / threshold * 100)) + '%';
      if (p >= threshold && !done) finish();
    };
    let down = false, lastSfx = 0;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); scratch(...pos(e)); });
    cv.addEventListener('pointermove', (e) => { if (!down) return; scratch(...pos(e)); if (performance.now() - lastSfx > 90) { audio.sfx('rustle'); lastSfx = performance.now(); } });
    ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, () => (down = false)));
    ctx.onAssist((a) => { threshold = [.5, .38, .26, .16][a] || .16; });
    async function finish() {
      done = true; const res = await ctx.claim({}); if (!res) { done = false; return; } if (!res.ok) { done = false; seen.clear(); cover(); return; }
      audio.sfx('reveal'); cv.classList.add('gone'); under.textContent = ''; res.revealShown = true;
      const t = h('p', { class: 'sc-text' }); under.append(t); await typewriter(t, res.reveal, { speed: 24 });
      fx.sparkleAt(card, 24); await sleep(1500); resolve(res);
    }
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), card, bar, h('p', { class: 'small muted', style: { margin: 0, textAlign: 'center' } }, 'Pasa el dedo por encima. No hace falta rascarlo todo.')));
  });
}

// ── Objetos ocultos en una escena ──
const star = (i) => ({ x: (i * 37 + (i * i * 11)) % 100, y: (i * 53 + (i * 7)) % 100, r: .4 + (i % 4) * .22, o: .3 + (i % 5) * .13 });
function sceneSVG(scene) {
  if (scene === 'savanna') return `<svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1a4d"/><stop offset=".45" stop-color="#be3a52"/><stop offset=".7" stop-color="#fb923c"/><stop offset="1" stop-color="#fde68a"/></linearGradient></defs><rect width="100" height="125" fill="url(#sv)"/><circle cx="68" cy="66" r="13" fill="#fff3c4" opacity=".92"/><path d="M0 84q25-12 50-4t50-6v51H0z" fill="#2a1226"/><path d="M0 98q30-10 60-3t40-3v33H0z" fill="#190a1c"/><g fill="#12060f"><path d="M14 98V70m0 0c-8-3-13-1-17 3m17-3c7-4 14-3 18 1m-18 2c-5-6-9-6-14-5"/><path d="M14 70c-9-2-14 0-18 4h36c-4-4-10-6-18-4z"/><rect x="13" y="70" width="2" height="30"/><path d="M76 96V78m0 0c-6-2-10-1-13 2h26c-3-3-7-4-13-2z"/><rect x="75" y="78" width="2" height="20"/></g><g stroke="#0c040b" stroke-width=".7" fill="none">${Array.from({ length: 46 }, (_, i) => `<path d="M${i * 2.2 + 1} 125q${i % 2 ? -1.5 : 1.5}-${14 + (i * 7) % 12} ${i % 3 - 1}-${22 + (i * 5) % 14}"/>`).join('')}</g></svg>`;
  return `<svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="nt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070620"/><stop offset=".6" stop-color="#241046"/><stop offset="1" stop-color="#5a1d57"/></linearGradient></defs><rect width="100" height="125" fill="url(#nt)"/>${Array.from({ length: 70 }, (_, i) => { const s = star(i); return `<circle cx="${s.x}" cy="${s.y * 1.1}" r="${s.r * .6}" fill="#e9e5ff" opacity="${s.o}"/>`; }).join('')}<path d="M0 118q30-14 60-6t40-8v21H0z" fill="#0a0716"/></svg>`;
}
export function runHidden(root, task, ctx) {
  return new Promise((resolve) => {
    const found = new Set(), total = task.hotspots.length, savanna = task.scene === 'savanna';
    const counter = h('p', { class: 'kicker', style: { textAlign: 'center' } });
    const scene = h('div', { class: 'hunt', 'data-scene': task.scene, html: sceneSVG(task.scene) });
    const upd = () => { counter.textContent = `Encontrados ${found.size} de ${total}`; };
    const spots = task.hotspots.map((s) => {
      const b = h('button', { class: 'spot', style: { left: s.x + '%', top: s.y + '%' }, 'aria-label': `${s.label || 'Objeto oculto'} (toca para encontrarlo)` }, h('span', { class: savanna ? 'eyes' : 'twinkle' }, savanna ? [h('i'), h('i')] : null));
      b.addEventListener('click', async () => {
        if (found.has(s.id)) return; found.add(s.id); b.classList.add('found'); audio.sfx('coin'); fx.sparkleAt(b, 14, savanna ? '#fde047' : '#c4b5fd'); upd(); b.classList.remove('assist');
        if (found.size === total) { await sleep(500); const res = await ctx.claim({ found: [...found] }); if (!res) { found.delete(s.id); b.classList.remove('found'); upd(); return; } if (!res.ok) return; audio.sfx('unlock'); await sleep(800); resolve(res); }
      });
      b.dataset.id = s.id; scene.append(b); return b;
    });
    ctx.onAssist((a) => { const left = spots.filter((b) => !b.classList.contains('found')); left.forEach((b, i) => b.classList.toggle('assist', a >= 3 || (a >= 2) || (a === 1 && i === 0))); scene.dataset.assist = a; });
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), counter, scene));
    upd();
  });
}
