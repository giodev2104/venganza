// «A ver cómo conduces»: minijuego de carriles. Sin game over ni castigos: chocar solo te frena y te regaña Hugo.
import { h, sleep, rand, clamp, vibrate, cssVar, reduceMotion } from '../util.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';

export function runRunner(root, task, ctx) {
  return new Promise((resolve) => {
    const cv = h('canvas', { class: 'rn-canvas', role: 'img', 'aria-label': 'Minijuego de conducción: toca a la izquierda o a la derecha para cambiar de carril' });
    const hudCount = h('span', { class: 'rn-count' }), hudMsg = h('span', { class: 'rn-msg' });
    const wrap = h('div', { class: 'rn-wrap' }, cv, h('div', { class: 'rn-hud' }, hudCount, hudMsg));
    const g = cv.getContext('2d'); let W = 0, H = 0, D = 1;
    const size = () => { D = Math.min(devicePixelRatio || 1, 2); const r = wrap.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * D; cv.height = H * D; g.setTransform(D, 0, 0, D, 0, 0); };
    const LANES = 3, laneC = (i) => (W / LANES) * (i + .5);
    let lane = 1, carX = 0, items = [], spawnIn = .8, dash = 0, got = 0, hits = 0, slow = 0, over = false, last = 0, wob = 0, raf = 0, msgT = 0;
    const speed = () => H * (.5 - ctx.assist * .07) * (slow > 0 ? .45 : 1);
    const say = (t) => { hudMsg.textContent = t; msgT = 1.6; };
    const upd = () => { hudCount.textContent = `♥ ${got} / ${task.target}`; };
    const move = (d) => { const n = clamp(lane + d, 0, LANES - 1); if (n !== lane) { lane = n; audio.sfx('click'); } };
    // Controles: toque en mitades, deslizar o flechas
    let sx = null;
    cv.addEventListener('pointerdown', (e) => { sx = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 34) { move(e.clientX > sx ? 1 : -1); sx = e.clientX; sx = null; } });
    cv.addEventListener('pointerup', (e) => { if (sx !== null) { const r = cv.getBoundingClientRect(); move(e.clientX - r.left < r.width / 2 ? -1 : 1); } sx = null; });
    const key = (e) => { if (!cv.isConnected) return document.removeEventListener('keydown', key); if (e.key === 'ArrowLeft') move(-1); if (e.key === 'ArrowRight') move(1); };
    document.addEventListener('keydown', key);
    function spawn() {
      const cones = ctx.assist >= 3 ? 0 : ctx.assist >= 2 ? .22 : .42;
      const l = Math.floor(Math.random() * LANES), isCone = Math.random() < cones;
      if (isCone && items.some((it) => it.type === 'cone' && it.y < H * .22 && it.lane !== l)) return; // nunca se bloquean los tres carriles
      items.push({ lane: l, y: -40, type: isCone ? 'cone' : 'heart' });
    }
    function drawCar(x, y, w) {
      const hh = w * 1.75; g.save(); g.translate(x, y); g.rotate(Math.sin(wob) * .09 * (wob > 0 ? 1 : 0));
      const a1 = cssVar('--a1'), a2 = cssVar('--a2');
      g.shadowColor = a2; g.shadowBlur = 18; const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, a1); gr.addColorStop(1, a2); g.fillStyle = gr;
      g.beginPath(); g.roundRect(-w / 2, -hh / 2, w, hh, w * .28); g.fill(); g.shadowBlur = 0;
      g.fillStyle = 'rgba(8,6,20,.82)'; g.beginPath(); g.roundRect(-w * .36, -hh * .18, w * .72, hh * .26, w * .1); g.fill(); g.fillRect(-w * .3, hh * .22, w * .6, hh * .14);
      g.fillStyle = '#fff7c2'; g.beginPath(); g.arc(-w * .3, -hh * .46, w * .08, 0, 6.28); g.arc(w * .3, -hh * .46, w * .08, 0, 6.28); g.fill(); g.restore();
    }
    function drawHeart(x, y, s) { g.save(); g.translate(x, y); g.fillStyle = '#fb7185'; g.shadowColor = '#fb7185'; g.shadowBlur = 14; g.beginPath(); g.moveTo(0, s * .38); g.bezierCurveTo(-s, -s * .2, -s * .5, -s * .95, 0, -s * .4); g.bezierCurveTo(s * .5, -s * .95, s, -s * .2, 0, s * .38); g.fill(); g.restore(); }
    function drawCone(x, y, s) { g.save(); g.translate(x, y); g.fillStyle = '#f97316'; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .75, s * .7); g.lineTo(-s * .75, s * .7); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(-s * .42, -s * .1, s * .84, s * .22); g.fillStyle = '#7c2d12'; g.fillRect(-s * .9, s * .7, s * 1.8, s * .2); g.restore(); }
    function frame(t) {
      if (over || !cv.isConnected || ctx.disposed) return;
      if (document.hidden) { last = 0; raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
      const sp = speed(), laneW = W / LANES, carW = Math.min(laneW * .5, 58), carY = H * .8;
      carX += (laneC(lane) - carX) * Math.min(1, dt * 12); dash = (dash + sp * dt) % 60; if (slow > 0) slow -= dt; if (wob > 0) wob = Math.max(0, wob - dt * 5); if (msgT > 0 && (msgT -= dt) <= 0) hudMsg.textContent = '';
      spawnIn -= dt; if (spawnIn <= 0) { spawn(); spawnIn = rand(.55, .95) * (ctx.assist ? 1.1 : 1); }
      for (const it of items) { it.y += sp * dt; const x = laneC(it.lane);
        if (!it.dead && Math.abs(it.y - carY) < carW * .8 && Math.abs(x - carX) < laneW * .36) {
          it.dead = true;
          if (it.type === 'heart') { got++; audio.sfx('heart'); fx.sparkle(x, carY, 8, '#fb7185'); upd(); } else { hits++; slow = .9; wob = 1.4; audio.sfx('crash'); vibrate(80); say(['¡Cuidado, Nixi!', 'Eso era un cono…', 'Hugo no paga las multas', 'Frena, frena'][hits % 4]); }
        } }
      items = items.filter((it) => !it.dead && it.y < H + 60);
      // dibujo
      g.clearRect(0, 0, W, H); const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0818'); bg.addColorStop(1, '#1b1033'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.setLineDash([22, 38]); g.lineDashOffset = -dash;
      for (let i = 1; i < LANES; i++) { g.beginPath(); g.moveTo(laneW * i, -60); g.lineTo(laneW * i, H + 60); g.stroke(); } g.setLineDash([]);
      g.strokeStyle = cssVar('--a1'); g.lineWidth = 3; g.globalAlpha = .6; g.strokeRect(1.5, -5, W - 3, H + 10); g.globalAlpha = 1;
      for (const it of items) (it.type === 'heart' ? drawHeart : drawCone)(laneC(it.lane), it.y, Math.min(laneW * .22, 22));
      drawCar(carX, carY, carW);
      if (got >= task.target) { over = true; finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    async function finish() {
      audio.sfx('success'); fx.confetti({ count: 70 }); say('¡Llegaste!'); await sleep(900);
      const res = await ctx.claim({ hits }); if (!res || !res.ok) { over = false; last = 0; raf = requestAnimationFrame(frame); return; }
      if (hits === 0) ctx.achieve('piloto'); resolve(res);
    }
    ctx.onAssist(() => say('Hugo te lo pone más fácil'));
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), wrap));
    requestAnimationFrame(() => { size(); carX = laneC(1); upd(); say('Toca izquierda o derecha'); raf = requestAnimationFrame(frame); });
    addEventListener('resize', size);
  });
}
