// Introducción cinematográfica: puerta de sonido → líneas → título → mensaje → botón.
import { h, $, skipper, sleep } from '../util.js';
import { sparkSVG } from '../art.js';
import { icon } from '../icons.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import * as B from '../bouncers.js';
import { state, save } from '../store.js';

export function soundGate() {
  return new Promise((resolve) => {
    const choose = (sound, music) => { const S = state(); S.settings.sound = sound; S.settings.music = music; save(); audio.configure({ sound, music }); audio.unlock(); audio.sfx('whoosh'); resolve(); };
    const el = ui.screen('center',
      h('div', { class: 'spark-logo', html: sparkSVG }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, h('h1', { class: 'h-lg' }, 'Esta aventura tiene sonido'), h('p', { class: 'lede' }, 'Sube el volumen: habrá animales, sorpresas y alguna que otra putada sonora.')),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('button', { class: 'btn', onclick: () => choose(true, true) }, h('span', { html: icon('volume-2', 20) }), 'Con sonido y música'),
        h('button', { class: 'btn btn-ghost', onclick: () => choose(true, false) }, 'Solo efectos'),
        h('button', { class: 'link-btn', onclick: () => choose(false, false) }, 'Sin sonido')));
    ui.show(el);
  });
}

export function intro(pub, { quick = false } = {}) {
  return new Promise(async (resolve) => {
    const I = pub.intro, lines = h('div', { class: 'cine-lines', 'aria-live': 'polite' });
    const title = h('div', { class: 'title-lockup', hidden: true });
    const story = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    const cta = h('div', { class: 'fade-up', hidden: true, style: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' } },
      h('button', { class: 'btn', onclick: () => { audio.sfx('unlock'); fx.confetti({ count: 80 }); setTimeout(resolve, 450); } }, quick ? 'Continuar' : I.button, h('span', { html: icon('arrow-right', 20) })),
      h('p', { class: 'small muted', style: { margin: 0 } }, I.small));
    const el = ui.screen('center intro', lines, title, story, cta);
    await ui.show(el);
    const sk = skipper(el); el.addEventListener('pointerdown', () => el.classList.add('skipped'), { once: true });
    if (!quick) {
      for (const l of I.lines || []) { lines.append(h('p', { class: 'cine-line' }, l)); audio.sfx('tap'); await sk.sleep(1500); }
      await sk.sleep(500); lines.hidden = true;
    } else lines.hidden = true;
    const word = pub.meta.title.replace(/\s*\d+(\.\d+)?\s*$/, '').trim(), ver = (pub.meta.title.match(/\d+(\.\d+)?\s*$/) || ['2.0'])[0].trim();
    title.hidden = false;
    title.append(h('h1', { class: 't-main', 'aria-label': pub.meta.title }, [...word].map((ch, i) => h('span', { style: { animationDelay: i * .06 + 's' }, 'aria-hidden': 'true' }, ch === ' ' ? ' ' : ch))), h('div', { class: 't-ver', 'aria-hidden': 'true' }, ver), h('p', { class: 't-sub' }, pub.meta.subtitle));
    audio.sfx('reveal'); audio.music('c1'); fx.sparkle(innerWidth / 2, innerHeight * .3, 26);
    if (!quick) {
      await sk.sleep(2300); B.burst(3600, 6); audio.sfx('boing');
      await sk.sleep(1100);
      for (const [i, p] of (I.paragraphs || []).entries()) { story.append(h('p', { class: 'story-p', style: { animationDelay: '0s' } }, p)); audio.sfx('click'); await sk.sleep(1700 + p.length * 12); }
    }
    cta.hidden = false;
  });
}
