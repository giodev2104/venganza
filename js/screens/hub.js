// Mapa de regalos misteriosos: progreso general, estado de cada regalo y acceso a recuerdos ya desbloqueados.
import { h, $ } from '../util.js';
import { icon } from '../icons.js';
import { giftSVG } from '../art.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import { state, cs } from '../store.js';
import { rt } from '../rt.js';
import { visibleIds, chapterPct, currentId, refreshHUD } from '../progress.js';
import { showMemory } from './panels.js';

const THEMES = { c1: 'c1', c2: 'c2', c3: 'c3', c4: 'c4' };

/** Muestra el mapa; resuelve con el id del capítulo que toca jugar, o null si ya está todo hecho. */
export function hub({ justUnlocked = null } = {}) {
  return new Promise((resolve) => {
    refreshHUD(); const ids = visibleIds(), cur = currentId(), allDone = !cur;
    const done = ids.filter((id) => cs(id).done).length;
    const cards = ids.map((id, i) => {
      const c = cs(id), isDone = c.done, isCur = id === cur, theme = c.meta ? c.meta.theme : THEMES['c' + (i + 1)] || 'c1';
      const cls = 'gift-card' + (isDone ? ' done' : isCur ? ' current' : ' locked') + (id === justUnlocked ? ' new' : '');
      const art = h('div', { class: 'gift-art', html: giftSVG(theme, { open: isDone, locked: !isDone && !isCur, orb: theme === 'c4' && !isDone && false }) });
      const gift = isDone && c.reveal ? c.reveal.gift : null;
      const meta = h('div', { class: 'gift-meta' },
        h('p', { class: 'kicker' }, gift ? gift.label : `Regalo ${i + 1}`),
        h('h2', { class: 'h-md' }, isDone && gift ? gift.title : isCur && c.meta ? c.meta.title : isCur ? 'Siguiente misión' : 'Misterio'),
        isDone ? h('p', { class: 'small muted', style: { margin: 0 } }, gift ? gift.description : 'Completado') : isCur ? h('div', { class: 'mini-bar', 'aria-hidden': 'true' }, h('b', { style: { width: Math.round(chapterPct(id) * 100) + '%' } })) : h('p', { class: 'small muted', style: { margin: 0 } }, 'Se desbloquea al terminar el anterior'),
        isCur ? h('button', { class: 'btn', onclick: () => { audio.sfx('unlock'); resolve(id); } }, c.opened ? 'Continuar' : 'Empezar', h('span', { html: icon('arrow-right', 20) })) : null,
        isDone ? h('button', { class: 'btn btn-ghost', onclick: () => showMemory(id) }, h('span', { html: icon('scroll-text', 18) }), 'Ver recuerdo') : null);
      return h('li', { class: cls }, art, meta);
    });
    const head = allDone
      ? [h('p', { class: 'kicker' }, 'Misión cumplida'), h('h1', { class: 'h-lg' }, 'Lo has conseguido, ' + rt.pub.meta.playerName), h('p', { class: 'lede' }, 'Todos los regalos están desbloqueados. Puedes volver a ver tus recuerdos cuando quieras.')]
      : [h('p', { class: 'kicker' }, 'Tu misión'), h('h1', { class: 'h-lg' }, 'Regalos misteriosos'), h('p', { class: 'lede' }, done ? `Llevas ${done} de ${ids.length}. Sigue adelante.` : 'Cada regalo está escondido en un sitio distinto. Para llegar a él tendrás que ganártelo.')];
    ui.show(ui.screen('hub', ...head, h('ol', { class: 'gifts' }, cards)));
    if (allDone) resolve(null);
  });
}
