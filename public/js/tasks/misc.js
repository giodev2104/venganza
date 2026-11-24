// Trolleos de relleno (falsa victoria, falso error, falso regalo, foto-bomba) y reproductor de audio/vídeo personal.
import { h, sleep } from '../util.js';
import { icon } from '../icons.js';
import { giftSVG } from '../art.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import * as B from '../bouncers.js';

export function runTroll(root, task, ctx) {
  return new Promise((resolve) => {
    const finish = async () => { const res = await ctx.claim({}); if (res && res.ok) resolve(res); };
    const go = (label) => h('button', { class: 'btn fade-up', style: { animationDelay: '.2s' }, onclick: () => { audio.sfx('click'); finish(); } }, label || 'Continuar', h('span', { html: icon('arrow-right', 20) }));
    const wrap = h('div', { class: 'troll screen-enter' }); root.append(wrap);
    const k = task.kind;
    if (k === 'fakeVictory') {
      const title = h('h1', { class: 'h-xl grad-text' }, task.heading || '¡ENHORABUENA!'), txt = h('p', { class: 'lede' }, task.text);
      wrap.append(h('div', { class: 'fv-trophy', html: icon('trophy', 64) }), title, txt);
      audio.sfx('success'); fx.confetti({ count: 120 }); setTimeout(() => fx.confettiRain(1800), 400);
      (async () => {
        await sleep(3800); if (ctx.disposed) return; audio.sfx('glitch'); await fx.glitch(root.closest('.screen') || wrap, 1000);
        wrap.textContent = ''; fx.clearFx(); wrap.append(h('div', { class: 'fv-trophy off', html: icon('x', 56) }), h('h1', { class: 'h-lg' }, task.twist || '…ja'), go(task.button));
        audio.sfx('boing'); if (task.photo) B.burst(3600, 5);
      })();
    } else if (k === 'fakeError') {
      const bar = h('i'), pct = h('span', null, '0%');
      wrap.append(h('div', { class: 'fe-box' }, h('div', { class: 'fe-code' }, 'ERROR 0xH0G0'), h('h1', { class: 'h-md' }, task.heading || 'Se ha producido un error crítico'), h('p', { class: 'muted' }, task.text), h('div', { class: 'fe-bar' }, bar), h('p', { class: 'small mono muted' }, 'Recuperando… ', pct)));
      audio.sfx('glitch'); let p = 0;
      (async () => { while (p < 99 && !ctx.disposed) { p += Math.random() * 14; p = Math.min(99, p); bar.style.width = p + '%'; pct.textContent = Math.round(p) + '%'; await sleep(260); } await sleep(700); wrap.append(h('p', { class: 'reveal-line fade-up' }, task.twist || 'Era mentira. Todo funciona. Hugo solo quería ver tu cara.'), go(task.button)); audio.sfx('boing'); })();
    } else if (k === 'fakeGift') {
      const box = h('div', { class: 'giftbox', html: giftSVG('c1') }), prompt = h('p', { class: 'lede' }, task.text || 'Toca el regalo.');
      wrap.append(h('h1', { class: 'h-lg' }, task.heading || '¡Un regalo!'), prompt, h('button', { class: 'giftbtn', 'aria-label': 'Abrir regalo' }, box));
      wrap.querySelector('.giftbtn').addEventListener('click', async function once() {
        this.removeEventListener('click', once); audio.sfx('drum'); box.classList.add('shaking'); await sleep(650); box.classList.remove('shaking'); box.classList.add('open'); audio.sfx('reveal'); fx.sparkleAt(box, 18);
        await sleep(800); wrap.append(h('div', { class: 'panel tint fade-up' }, h('p', { class: 'reveal-line', style: { margin: 0 } }, task.twist || 'Dentro hay… aire. Un aire muy bien envuelto.')), go(task.button));
      });
    } else if (k === 'photo') {
      wrap.append(h('h1', { class: 'h-xl grad-text' }, task.heading || '¡SORPRESA!'), h('p', { class: 'lede' }, task.text)); audio.sfx('boing'); B.burst(5200, 8); setTimeout(() => !ctx.disposed && wrap.append(go(task.button)), 2200);
    } else { wrap.append(h('h1', { class: 'h-lg' }, task.heading || ''), h('p', { class: 'lede' }, task.text), go(task.button)); }
  });
}

export function runMedia(root, task, ctx) {
  return new Promise((resolve) => {
    let played = !task.requirePlay;
    const go = h('button', { class: 'btn' + (played ? '' : ' is-off') }, 'Continuar', h('span', { html: icon('arrow-right', 20) }));
    go.addEventListener('click', async () => { const res = await ctx.claim({}); if (res && res.ok) resolve(res); });
    const enable = () => { played = true; go.classList.remove('is-off'); };
    const title = h('h1', { class: 'h-lg q-prompt' }, task.prompt);
    let box;
    if (!task.mediaUrl) box = h('div', { class: 'panel tint', style: { textAlign: 'center' } }, h('span', { html: icon('mic', 30), style: { color: 'var(--a1)' } }), h('p', { class: 'lede', style: { marginTop: '8px' } }, '[EDITAR] Aquí irá un audio o vídeo personal. Súbelo desde el panel → Medios y asígnalo a esta prueba.'));
    else {
      const el = h(task.mediaKind === 'video' ? 'video' : 'audio', { src: task.mediaUrl, controls: true, preload: 'metadata', playsinline: true });
      el.addEventListener('play', () => audio.duck(true)); el.addEventListener('pause', () => audio.duck(false)); el.addEventListener('ended', () => { audio.duck(false); enable(); });
      el.addEventListener('error', () => { enable(); box.append(h('p', { class: 'small muted', style: { padding: '8px' } }, 'No se pudo cargar el archivo (¿sin cobertura?). Puedes continuar y volver a verlo luego.')); });
      box = h('div', { class: task.mediaKind === 'video' ? 'media-box' : 'audio-card' }, el);
    }
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } }, title, task.caption ? h('p', { class: 'lede' }, task.caption) : null, box, go));
  });
}
