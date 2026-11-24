// Desbloqueo del regalo: caja que se abre, celebración propia de cada capítulo y, en el último, el final romántico.
import { h, sleep, skipper, typewriter } from '../util.js';
import { icon } from '../icons.js';
import { giftSVG } from '../art.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import { addInventory, addHistory } from '../store.js';
import { achieve } from '../achievements.js';
import { refreshHUD } from '../progress.js';

const btn = (label, cb, cls = '') => h('button', { class: 'btn ' + cls, onclick: cb }, label, h('span', { html: icon('arrow-right', 20) }));
const waitClick = (label, cls) => new Promise((res) => { const b = btn(label, () => { audio.sfx('click'); res(); }, cls); waitClick.last = b; });

export async function revealStage(c) {
  const r = c.reveal;
  if (r.keyItem) addInventory({ ...r.keyItem, kind: 'item' });
  addHistory({ chapter: c.meta.n, title: 'Regalo: ' + r.gift.title });
  if (c.meta.n === 1) achieve('superviviente');
  if (c.hints === 0) achieve('sin_ayuda');
  refreshHUD();
  return r.gift.celebration === 'romance' ? romance(c, r) : opening(c, r);
}

function opening(c, r) {
  return new Promise((resolve) => {
    const safari = r.gift.celebration === 'safari', theme = c.meta.theme;
    const box = h('div', { class: 'giftbox', html: giftSVG(theme) });
    const info = h('div', { class: 'unlock-card' });
    const open = h('button', { class: 'btn' }, h('span', { html: icon('gift', 20) }), 'Desenvolver el regalo');
    const head = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, h('p', { class: 'kicker' }, r.gift.label), h('h1', { class: 'h-lg' }, 'Lo has encontrado'), h('p', { class: 'lede' }, 'Código correcto. Ahora toca lo mejor.'));
    const el = ui.screen('center reveal' + (safari ? ' reveal-safari' : ''), head, box, open, info);
    if (safari) el.append(h('div', { class: 'sun-rise', 'aria-hidden': 'true' }));
    ui.show(el); audio.sfx('reveal');
    open.addEventListener('click', async () => {
      open.hidden = true; audio.sfx('drum'); box.classList.add('shaking'); await sleep(650); box.classList.remove('shaking'); box.classList.add('open'); audio.sfx('unlock');
      head.querySelector('h1').textContent = r.gift.revealTitle; head.querySelector('.lede').textContent = '';
      fx.confetti({ count: 140, y: innerHeight * .45 }); setTimeout(() => fx.confettiRain(1800), 500); if (safari) { fx.embers(5000); audio.sfx('rustle'); }
      await sleep(900);
      if (safari) { const paws = h('div', { class: 'paws', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4].map((i) => h('span', { style: { left: 8 + i * 19 + '%', animationDelay: i * .35 + 's' }, html: icon('paw-print', 22) }))); info.append(paws); }
      const card = safari
        ? h('div', { class: 'ticket' }, h('div', { class: 't1' }, r.gift.label + ' · vale especial'), h('div', { class: 't2' }, r.gift.title), h('p', { style: { margin: 0 } }, r.gift.revealText))
        : h('div', { class: 'panel tint' }, h('h2', { class: 'h-md' }, r.gift.title), h('p', { class: 'lede', style: { marginTop: '8px' } }, r.gift.revealText));
      info.append(card);
      if (r.keyItem) info.append(h('div', { class: 'inv-item fade-up', style: { animationDelay: '1s', width: '100%', textAlign: 'left' } }, h('span', { class: 'inv-ic', html: icon('key', 20) }), h('div', null, h('b', null, `${r.keyItem.label}: ${r.keyItem.text}`), h('div', { class: 'small muted' }, 'Guardada en tu mochila. La necesitarás más adelante.'))));
      const go = btn('Continuar', () => { audio.sfx('click'); resolve(); }); go.classList.add('fade-up'); go.style.animationDelay = '1.4s'; info.append(go);
      el.parentElement && (el.parentElement.scrollTop = el.parentElement.scrollHeight);
    }, { once: true });
  });
}

// ───────────── Final romántico ─────────────
function beat(...kids) { const el = ui.screen('center', ...kids); return ui.show(el).then(() => el); }
async function romance(c, r) {
  ui.HUD.hide(); const S = null;
  // 1) La esfera
  await new Promise(async (res) => {
    const orb = h('div', { class: 'giftbox open-ready', html: giftSVG('c4', { orb: true }) }), b = h('button', { class: 'btn' }, 'Abrir');
    await beat(h('p', { class: 'kicker' }, r.gift.label), orb, h('p', { class: 'reveal-line' }, 'Esto es lo último. Respira.'), b);
    b.addEventListener('click', async () => { b.hidden = true; audio.sfx('reveal'); orb.classList.add('open'); fx.hearts(6000); await sleep(1600); res(); }, { once: true });
  });
  // 2) Título y texto
  {
    const sk = skipper(document), t = h('p', { class: 'reveal-line caret', style: { fontSize: '1.3rem', minHeight: '4em' } }), go = btn('Continuar', () => { audio.sfx('click'); done(); }); go.hidden = true; let done; const p = new Promise((x) => (done = x));
    await beat(h('h1', { class: 'h-xl grad-text' }, r.gift.revealTitle), t, go); audio.sfx('chime');
    await typewriter(t, [r.gift.revealText, r.ringText].filter(Boolean).join('\n\n'), { speed: 34, sk }); t.classList.remove('caret'); sk.stop(); go.hidden = false; await p;
  }
  // 3) Audio / vídeo personal
  if (r.video || r.audio) {
    let done; const p = new Promise((x) => (done = x)); const el = h(r.video ? 'video' : 'audio', { src: r.video || r.audio, controls: true, playsinline: true, preload: 'metadata' });
    el.addEventListener('play', () => audio.duck(true)); el.addEventListener('pause', () => audio.duck(false)); el.addEventListener('ended', () => audio.duck(false));
    const go = btn('Continuar', () => { el.pause(); audio.duck(false); done(); });
    await beat(h('h2', { class: 'h-lg' }, 'Un mensaje para ti'), h('div', { class: r.video ? 'media-box' : 'audio-card' }, el), h('p', { class: 'small muted' }, 'Pulsa play cuando estés lista.'), go); await p;
  }
  // 4) La carta
  if (r.letter) {
    const sk = skipper(document), paper = h('div', { class: 'paper' }), go = btn('Continuar', () => { audio.sfx('click'); done(); }); go.hidden = true; let done; const p = new Promise((x) => (done = x));
    await beat(h('p', { class: 'kicker' }, r.letter.title || 'Carta'), paper, go); audio.sfx('rustle');
    for (const para of r.letter.paragraphs) { const pe = h('p', { class: 'caret' }); paper.append(pe); await typewriter(pe, para, { speed: 26, sk }); pe.classList.remove('caret'); await sk.sleep(500); }
    if (r.letter.signature) { const s = h('p', { class: 'sign fade-up' }, r.letter.signature); paper.append(s); await sk.sleep(600); }
    sk.stop(); go.hidden = false; go.classList.add('fade-up'); await p;
  }
  // 5) Fotos
  if (r.photos && r.photos.length) {
    let done; const p = new Promise((x) => (done = x)); const go = btn('Continuar', () => { audio.sfx('click'); done(); });
    await beat(h('h2', { class: 'h-lg' }, 'Nosotros'), h('div', { class: 'polaroids' }, r.photos.map((u, i) => h('figure', { class: 'polaroid', style: { '--r': (i % 2 ? 2.2 : -2.4) + 'deg', animationDelay: i * .25 + 's', margin: 0 } }, h('img', { src: u, alt: `Foto ${i + 1}`, loading: 'lazy' })))), h('p', { class: 'small muted' }, 'Desliza para verlas todas.'), go);
    audio.sfx('chime'); await p;
  }
  // 6) Final
  {
    let done; const p = new Promise((x) => (done = x)); const go = btn('Ver mi mapa de regalos', () => { audio.sfx('click'); done(); });
    await beat(h('p', { class: 'fin grad-text' }, 'Fin'), h('p', { class: 'reveal-line' }, 'Gracias por llegar hasta aquí.'), go);
    audio.sfx('reveal'); fx.fireworks(9000); fx.hearts(9000); achieve('novia_del_ano'); await p; fx.clearFx();
  }
  ui.HUD.show();
}
