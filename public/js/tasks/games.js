// Minijuegos táctiles: memoria, puzzle de foto, botón escurridizo y secuencia de sonidos (tipo Simon).
import { h, sleep, shuffle, rand, clamp, vibrate, reduceMotion } from '../util.js';
import { icon } from '../icons.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';

// ───────── Memoria ─────────
export function runMemory(root, task, ctx) {
  return new Promise((resolve) => {
    const cards = shuffle(task.pairs.flatMap((p) => [{ ...p, k: p.id + 'a' }, { ...p, k: p.id + 'b' }]));
    let first = null, lock = true, moves = 0; const matched = new Set();
    const info = h('p', { class: 'kicker', style: { textAlign: 'center' } }, 'Memoriza…');
    const grid = h('div', { class: 'mem-grid', style: { gridTemplateColumns: `repeat(${cards.length <= 12 ? 3 : 4}, 1fr)` } });
    const els = cards.map((c) => {
      const face = c.image ? h('img', { src: c.image, alt: '', draggable: 'false' }) : h('span', { html: icon(c.icon || 'star', 34) });
      const b = h('button', { class: 'mem-card', 'aria-label': 'Carta boca abajo' }, h('span', { class: 'mem-in' }, h('span', { class: 'mem-back' }, h('i')), h('span', { class: 'mem-front' }, face)));
      b.addEventListener('click', () => flip(b, c)); grid.append(b); return b;
    });
    const showAll = async (ms) => { lock = true; els.forEach((e) => e.classList.add('up')); await sleep(ms); els.forEach((e, i) => { if (!matched.has(cards[i].k)) e.classList.remove('up'); }); lock = false; info.textContent = `Parejas ${matched.size / 2} de ${cards.length / 2}`; };
    async function flip(b, c) {
      if (lock || b.classList.contains('up')) return; b.classList.add('up'); audio.sfx('flip'); vibrate(8);
      if (!first) { first = { b, c }; return; }
      moves++; const a = first; first = null;
      if (a.c.id === c.id) {
        matched.add(a.c.k); matched.add(c.k); audio.sfx('match'); a.b.classList.add('ok'); b.classList.add('ok'); fx.sparkleAt(b, 12);
        info.textContent = `Parejas ${matched.size / 2} de ${cards.length / 2}`;
        if (matched.size === cards.length) { lock = true; await sleep(700); const res = await ctx.claim({ moves }); if (!res) { lock = false; return; } if (res.ok) { audio.sfx('success'); resolve(res); } else lock = false; }
      } else { lock = true; await sleep(750); a.b.classList.remove('up'); b.classList.remove('up'); lock = false; }
    }
    ctx.onAssist(async (lv) => { if (lv >= 3) { const left = cards.map((c, i) => [c, i]).filter(([c]) => !matched.has(c.k)); const id = left.length && left[0][0].id; const pair = left.filter(([c]) => c.id === id).map(([, i]) => els[i]); pair.forEach((e) => e.classList.add('glow')); setTimeout(() => pair.forEach((e) => e.classList.remove('glow')), 3500); } else await showAll(lv === 1 ? 1700 : 3200); });
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), info, grid));
    showAll(1300);
  });
}

// ───────── Puzzle de foto (tocar dos piezas para intercambiarlas) ─────────
export function runJigsaw(root, task, ctx) {
  return new Promise((resolve) => {
    const n = clamp(task.grid || 3, 2, 5), N = n * n;
    let order = shuffle([...Array(N).keys()]); while (order.every((v, i) => v === i)) order = shuffle(order);
    let sel = -1, busy = false, url = '';
    const grid = h('div', { class: 'jg-grid', style: { gridTemplateColumns: `repeat(${n}, 1fr)` }, role: 'group', 'aria-label': 'Puzzle de foto' });
    const model = h('div', { class: 'jg-model' }); const status = h('p', { class: 'small muted', style: { textAlign: 'center', margin: 0 } });
    const tiles = [...Array(N)].map((_, pos) => { const b = h('button', { class: 'jg-tile', 'aria-label': `Pieza ${pos + 1}` }); b.addEventListener('click', () => tap(pos)); grid.append(b); return b; });
    const correct = () => order.filter((v, i) => v === i).length;
    const paint = () => tiles.forEach((b, pos) => { const t = order[pos], r = Math.floor(t / n), c = t % n; b.style.backgroundImage = url ? `url(${url})` : 'none'; b.style.backgroundSize = `${n * 100}% ${n * 100}%`; b.style.backgroundPosition = `${n > 1 ? c / (n - 1) * 100 : 0}% ${n > 1 ? r / (n - 1) * 100 : 0}%`; b.classList.toggle('sel', pos === sel); b.classList.toggle('placed', ctx.assist >= 1 && order[pos] === pos); });
    const count = () => { status.textContent = ctx.assist >= 1 ? `Piezas bien colocadas: ${correct()} de ${N}` : 'Toca una pieza y luego otra para intercambiarlas.'; };
    async function tap(pos) {
      if (busy) return; audio.sfx('tap');
      if (sel < 0) { sel = pos; paint(); return; }
      if (sel === pos) { sel = -1; paint(); return; }
      [order[sel], order[pos]] = [order[pos], order[sel]]; tiles[pos].classList.add('swap'); tiles[sel].classList.add('swap'); setTimeout(() => tiles.forEach((t) => t.classList.remove('swap')), 300); sel = -1; paint(); count();
      if (order.every((v, i) => v === i)) { busy = true; grid.classList.add('solved'); audio.sfx('success'); fx.sparkleAt(grid, 30); await sleep(1100); const res = await ctx.claim({}); busy = false; if (res && res.ok) resolve(res); }
    }
    ctx.onAssist((lv) => {
      count();
      if (lv === 2) { const wrong = order.map((v, i) => [v, i]).filter(([v, i]) => v !== i); if (wrong.length) { const [v, i] = wrong[0]; tiles[i].classList.add('hintring'); tiles[order.indexOf(i)].classList.add('hintring'); setTimeout(() => tiles.forEach((t) => t.classList.remove('hintring')), 3500); } }
      if (lv >= 3) { for (let k = 0; k < 2; k++) { const i = order.findIndex((v, p) => v !== p); if (i < 0) break; const j = order.indexOf(i); [order[i], order[j]] = [order[j], order[i]]; } paint(); count(); if (order.every((v, i) => v === i)) tap(0); }
      paint();
    });
    const peek = h('button', { class: 'btn btn-ghost btn-sm', style: { alignSelf: 'center' } }, h('span', { html: icon('eye', 18) }), 'Ver modelo');
    const showModel = (on) => model.classList.toggle('on', on);
    peek.addEventListener('pointerdown', () => showModel(true)); ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => peek.addEventListener(e, () => showModel(false)));
    peek.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { showModel(true); setTimeout(() => showModel(false), 2200); } });
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), h('div', { class: 'jg-wrap' }, grid, model), status, peek));
    // Recorte cuadrado centrado de la foto (sirve cualquier proporción)
    const img = new Image(); img.src = task.image;
    img.onload = () => { const s = Math.min(img.naturalWidth || 800, img.naturalHeight || 800, 900) || 800, cv = document.createElement('canvas'); cv.width = cv.height = s; const iw = img.naturalWidth || s, ih = img.naturalHeight || s, m = Math.min(iw, ih); cv.getContext('2d').drawImage(img, (iw - m) / 2, (ih - m) / 2, m, m, 0, 0, s, s); url = cv.toDataURL('image/jpeg', .9); model.style.backgroundImage = `url(${url})`; paint(); };
    img.onerror = () => { status.textContent = 'No se pudo cargar la foto del puzzle.'; };
    count(); paint();
  });
}

// ───────── Botón escurridizo (nunca bloquea: se cansa y se rinde) ─────────
export function runRunaway(root, task, ctx) {
  return new Promise((resolve) => {
    let left = task.dodges, done = false; const rm = reduceMotion();
    const say = h('p', { class: 'ra-say', 'aria-live': 'polite' }, ' ');
    const btn = h('button', { class: 'btn ra-btn' }, task.buttonText || 'Pulsar');
    const arena = h('div', { class: 'ra-arena' }, btn);
    const place = (x, y) => { btn.style.left = x + 'px'; btn.style.top = y + 'px'; };
    const center = () => { const r = arena.getBoundingClientRect(); place((r.width - btn.offsetWidth) / 2, (r.height - btn.offsetHeight) / 2); };
    const dodge = () => {
      if (left <= 0) return false; left--; audio.sfx('whoosh'); vibrate(12);
      say.textContent = task.taunts[(task.dodges - left - 1) % task.taunts.length] || '…'; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop');
      if (left === 0) { btn.classList.add('tired'); btn.textContent = 'Me rindo…'; say.textContent = task.taunts[task.taunts.length - 1] || 'Vale, me cansé'; center(); return true; }
      if (!rm) { const r = arena.getBoundingClientRect(), bw = btn.offsetWidth, bh = btn.offsetHeight; let x, y, t = 0; do { x = rand(0, r.width - bw); y = rand(0, r.height - bh); t++; } while (t < 12 && Math.hypot(x - parseFloat(btn.style.left), y - parseFloat(btn.style.top)) < 90); place(x, y); }
      return true;
    };
    arena.addEventListener('pointerdown', (e) => { if (left <= 0) return; const b = btn.getBoundingClientRect(), d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)); if (d < Math.max(b.width, b.height) * .9) { e.preventDefault(); dodge(); } });
    btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && left > 0 && !rm) dodge(); });
    btn.addEventListener('click', async () => {
      if (left > 0) { dodge(); return; } if (done) return; done = true;
      audio.sfx('success'); fx.sparkleAt(btn, 26); const res = await ctx.claim({ dodges: task.dodges }); if (!res || !res.ok) { done = false; return; }
      ctx.achieve('paciencia'); await sleep(400); resolve(res);
    });
    ctx.onAssist((lv) => { left = Math.max(0, left - 2); if (left <= 0) { btn.classList.add('tired'); btn.textContent = 'Me rindo…'; center(); } });
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), arena, say));
    requestAnimationFrame(center);
  });
}

// ───────── Secuencia de sonidos (Simon, sin castigo) ─────────
export function runSequence(root, task, ctx) {
  return new Promise((resolve) => {
    const pads = task.pads.slice(0, 4); let len = task.length, seq = [], pos = 0, accepting = false, token = 0;
    const gen = () => { seq = Array.from({ length: len }, () => Math.floor(Math.random() * pads.length)); if (new Set(seq).size < 2) seq[0] = (seq[0] + 1) % pads.length; };
    const status = h('p', { class: 'kicker', style: { textAlign: 'center' }, 'aria-live': 'polite' }, 'Escucha…');
    const dots = h('div', { class: 'sq-dots', 'aria-hidden': 'true' });
    const els = pads.map((p, i) => { const b = h('button', { class: 'sq-pad p' + i, 'aria-label': p.label }, h('span', null, p.label)); b.addEventListener('click', () => press(i)); return b; });
    const grid = h('div', { class: 'sq-grid' }, els);
    const sound = (i) => { const p = pads[i]; if (p.sound && !p.sound.startsWith('synth:')) audio.playRef(p.sound); else audio.pad(i); };
    const light = async (i, ms = 420) => { els[i].classList.add('lit'); sound(i); await sleep(ms); els[i].classList.remove('lit'); };
    const drawDots = () => { dots.textContent = ''; seq.forEach((_, k) => dots.append(h('i', { class: k < pos ? 'on' : '' }))); };
    async function play() {
      const my = ++token; accepting = false; pos = 0; drawDots(); status.textContent = 'Escucha…'; await sleep(650);
      for (const i of seq) { if (my !== token || ctx.disposed) return; await light(i); await sleep(170); }
      if (my !== token) return; accepting = true; status.textContent = 'Tu turno'; guide();
    }
    const guide = () => { if (ctx.assist >= 3 && accepting) { els.forEach((e) => e.classList.remove('guide')); els[seq[pos]].classList.add('guide'); } };
    async function press(i) {
      if (!accepting) return; light(i, 260);
      if (i !== seq[pos]) { accepting = false; fx.shake(grid); audio.sfx('fail'); status.textContent = 'Casi… escucha otra vez'; await sleep(1100); play(); return; }
      pos++; drawDots(); els.forEach((e) => e.classList.remove('guide'));
      if (pos === seq.length) { accepting = false; status.textContent = '¡Eso es!'; await sleep(600); const res = await ctx.claim({ length: len }); if (!res || !res.ok) { play(); return; } audio.sfx('success'); resolve(res); } else guide();
    }
    ctx.onAssist((lv) => { if (lv >= 1) len = Math.max(3, task.length - lv); if (lv >= 1 && pos === 0) { gen(); play(); } guide(); });
    const again = h('button', { class: 'btn btn-ghost btn-sm', style: { alignSelf: 'center' }, onclick: () => play() }, h('span', { html: icon('rotate-ccw', 18) }), 'Repetir secuencia');
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), status, dots, grid, again));
    gen(); drawDots(); setTimeout(() => !ctx.disposed && play(), 500);
  });
}
