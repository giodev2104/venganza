// Las fotos rebotantes del HTML original, ahora solo en momentos puntuales (y con fin).
import { rand, reduceMotion } from './util.js';

let urls = [], stopper = null;
export function setPhotos(list) { urls = list || []; }
export function burst(ms = 4200, n = 6) {
  if (!urls.length || document.hidden) return Promise.resolve();
  if (stopper) stopper();
  const box = document.getElementById('bouncers'); box.textContent = '';
  const W = innerWidth, H = innerHeight, size = Math.round(Math.min(96, Math.max(64, W * .2)));
  const items = Array.from({ length: reduceMotion() ? 3 : n }, (_, i) => {
    const img = new Image(); img.src = urls[i % urls.length]; img.alt = ''; img.decoding = 'async'; img.className = 'bouncer'; img.style.width = img.style.height = size + 'px'; box.append(img);
    const a = rand(0, 6.283), s = rand(1.6, 3.2);
    return { img, x: rand(0, W - size), y: rand(0, H - size), vx: Math.cos(a) * s * 1.6, vy: Math.sin(a) * s * 1.6, rot: rand(-12, 12) };
  });
  let raf = 0, done = false;
  return new Promise((resolve) => {
    const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); box.classList.add('out'); setTimeout(() => { box.textContent = ''; box.classList.remove('out'); resolve(); }, 450); stopper = null; };
    stopper = end; setTimeout(end, ms);
    if (reduceMotion()) { items.forEach((it, i) => { it.img.style.transform = `translate3d(${W * (.2 + i * .3) - size / 2}px, ${H * .3}px, 0) rotate(${it.rot}deg)`; }); return; }
    const loop = () => { for (const it of items) { it.x += it.vx; it.y += it.vy; if (it.x <= 0) { it.x = 0; it.vx *= -1; } else if (it.x + size >= W) { it.x = W - size; it.vx *= -1; } if (it.y <= 0) { it.y = 0; it.vy *= -1; } else if (it.y + size >= H) { it.y = H - size; it.vy *= -1; } it.img.style.transform = `translate3d(${it.x}px, ${it.y}px, 0)`; } raf = requestAnimationFrame(loop); };
    loop();
  });
}
export const stop = () => stopper && stopper();
