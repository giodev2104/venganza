// Montaje de coordenadas: sustituye al «autocompletar» del original por una prueba real con ayudas progresivas.
import { h, shuffle, sleep } from '../util.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { online } from '../net.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import { state, save, cs } from '../store.js';
import { achieve } from '../achievements.js';
import { refreshHUD } from '../progress.js';

export function assembleStage(c) {
  return new Promise(async (resolve) => {
    const S = state(); let tries = c.assembleTries || 0, hintLv = 0;
    const pieces = [1, 2].map((slot) => ({ slot, ...(c.frags[slot] || { label: 'Pista ' + slot, value: '?' }) }));
    const slots = [h('div', { class: 'slot' }, h('small', null, 'Primera'), h('span', null, '—')), h('div', { class: 'slot' }, h('small', null, 'Segunda'), h('span', null, '—'))];
    let placed = [null, null];
    const chipEls = shuffle(pieces).map((p) => { const b = h('button', { class: 'chip', 'data-slot': p.slot, 'aria-label': `${p.label}: ${p.value}` }, h('small', null, p.label), h('span', null, p.value)); b.addEventListener('click', () => put(p, b)); return b; });
    const go = h('button', { class: 'btn is-off' }, 'Unir y comprobar', h('span', { html: icon('sparkles', 20) }));
    const manual = h('input', { class: 'input mono', type: 'text', placeholder: 'Escríbelas a mano (latitud, longitud)', autocomplete: 'off', 'aria-label': 'Coordenadas escritas a mano' });
    const clear = h('button', { class: 'link-btn' }, 'Borrar y empezar de nuevo');
    const hintBox = h('div', { class: 'hints' });
    const help = h('button', { class: 'help-btn' }, h('span', { html: icon('lightbulb', 18) }), h('span', null, 'Necesito ayuda'));

    function render() {
      placed.forEach((p, i) => { const s = slots[i]; s.classList.toggle('filled', !!p); s.lastChild.textContent = p ? p.value : '—'; });
      chipEls.forEach((b) => b.classList.toggle('used', placed.some((p) => p && String(p.slot) === b.dataset.slot)));
      go.classList.toggle('is-off', !(placed[0] && placed[1]) && manual.value.trim().length < 6);
    }
    function put(p) { const i = placed.findIndex((x) => !x); if (i < 0) return; placed[i] = p; audio.sfx('tap'); render(); }
    clear.addEventListener('click', () => { placed = [null, null]; manual.value = ''; render(); });
    manual.addEventListener('input', render);
    help.addEventListener('click', () => {
      hintLv++; c.hints++; S.stats.hints++; save();
      const t = [
        'Piensa en cómo se escribe un punto en un mapa: primero la latitud (norte/sur) y después la longitud (este/oeste). Mira las etiquetas de cada pista.',
        'Hugo te lo marca: la pieza que brilla va primero, la otra después.',
        'Hugo las coloca por ti. Solo falta que pulses «Unir y comprobar».',
      ][Math.min(hintLv, 3) - 1];
      hintBox.append(h('div', { class: 'hint' }, h('b', null, 'Ayuda ' + Math.min(hintLv, 3)), h('span', null, t))); audio.sfx('pop');
      if (hintLv === 2) { const first = chipEls.find((b) => b.dataset.slot === '1'); first.classList.add('glow'); setTimeout(() => first.classList.remove('glow'), 5000); }
      if (hintLv >= 3) { placed = [pieces[0], pieces[1]]; render(); help.disabled = true; help.lastChild.textContent = 'Ya no hay más ayudas'; }
    });
    async function submit() {
      if (go.classList.contains('is-off')) return; go.classList.add('is-off');
      const body = { chapterId: c.id, tds: c.tokens.td, attempt: tries };
      if (placed[0] && placed[1]) body.parts = [placed[0].value, placed[1].value]; else body.text = manual.value.trim();
      const res = await online(() => api('/api/assemble', body), 'comprobar las coordenadas');
      if (!res.ok) {
        tries++; c.assembleTries = tries; S.stats.fails++; save(); audio.sfx('fail'); fx.shake(slots[0].parentElement); render();
        if (tries === 1) await ui.wrongOverlay({ ...res.msg, button: 'Probar otra combinación' }); else ui.toast(`${res.msg.title}: ${res.msg.text}`, { kind: 'bad', ms: 3800 });
        if (tries >= 2) help.classList.add('pulse'); return;
      }
      c.location = res.location; c.tokens.lc = res.lc; c.blob = res.blob; save();
      if (tries === 0 && hintLv === 0) achieve('cartografa');
      audio.sfx('unlock'); slots.forEach((s) => s.classList.add('filled')); fx.sparkleAt(slots[0].parentElement, 40); fx.confetti({ count: 70, y: innerHeight * .45 });
      slots[0].lastChild.textContent = res.location.coordsText.split(' ')[0] || placed[0]?.value || '✓'; await sleep(1400); resolve();
    }
    go.addEventListener('click', submit);
    const el = ui.screen('assemble',
      h('header', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, h('p', { class: 'kicker' }, 'Último paso del capítulo'), h('h1', { class: 'h-lg' }, 'Junta las pistas'), h('p', { class: 'lede' }, 'Toca las dos pistas que has conseguido, en el orden correcto, para descubrir dónde te espera el regalo.')),
      h('div', { class: 'slots', 'aria-live': 'polite' }, slots),
      h('div', { class: 'chips' }, chipEls),
      go,
      h('details', { class: 'manual' }, h('summary', null, 'Prefiero escribirlas a mano'), h('div', { class: 'field', style: { marginTop: '10px' } }, manual)),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' } }, help, hintBox, clear));
    await ui.show(el); render();
  });
}
