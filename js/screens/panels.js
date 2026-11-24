// Mochila (pistas, historial), logros, ajustes y recuerdos de regalos desbloqueados.
import { h, copyText } from '../util.js';
import { icon } from '../icons.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import { state, save, cs, reset, canPersist } from '../store.js';
import { rt } from '../rt.js';

function tabs(defs) {
  const bar = h('div', { class: 'tabs', role: 'tablist' }), pane = h('div'); const btns = [];
  const sel = (i) => { btns.forEach((b, k) => b.setAttribute('aria-selected', k === i)); pane.textContent = ''; pane.append(defs[i].render()); };
  defs.forEach((d, i) => { const b = h('button', { class: 'tab', role: 'tab', onclick: () => sel(i) }, d.label); btns.push(b); bar.append(b); });
  sel(0); return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, bar, pane);
}

export function openBag() {
  const S = state();
  const pistas = () => {
    const box = h('div');
    const byCh = {}; S.inventory.forEach((it) => (byCh[it.chapter] ||= []).push(it));
    const nums = Object.keys(byCh).sort((a, b) => a - b);
    if (!nums.length) box.append(h('p', { class: 'lede' }, 'Todavía no tienes pistas. Superando pruebas irás llenando esta mochila.'));
    for (const n of nums) {
      const g = h('section', { class: 'inv-group' }, h('h3', { class: 'kicker' }, `Capítulo ${n}`));
      byCh[n].forEach((it) => g.append(h('div', { class: 'inv-item' }, h('span', { class: 'inv-ic', html: icon(it.kind === 'fragment' ? 'compass' : 'key', 20) }), h('div', null, h('div', { class: 'small muted' }, it.label), h('div', { class: 'mono' }, it.text)))));
      Object.values(S.chapters).filter((c) => c.meta && c.meta.n === Number(n) && c.location).forEach((c) => g.append(h('a', { class: 'inv-item', href: c.location.mapsUrl, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit', textDecoration: 'none' } }, h('span', { class: 'inv-ic', html: icon('map-pin', 20) }), h('div', null, h('div', { class: 'small muted' }, 'Ubicación revelada'), h('div', null, c.location.name), h('div', { class: 'small muted' }, 'Abrir en Google Maps')))));
      box.append(g);
    }
    return box;
  };
  const hist = () => S.history.length ? h('ul', { class: 'hist' }, S.history.slice().reverse().map((e) => h('li', null, h('span', { html: icon('check', 18) }), h('span', null, `Cap. ${e.chapter} · ${e.title}`)))) : h('p', { class: 'lede' }, 'Aún no has superado ninguna prueba.');
  ui.HUD.badge(false);
  ui.modal({ title: 'Tu mochila', body: tabs([{ label: 'Pistas', render: pistas }, { label: 'Historial', render: hist }]) });
}

export function openAch() {
  const S = state(), all = rt.pub.achievements || [], got = all.filter((a) => S.achievements[a.id]).length;
  const grid = h('div', { class: 'ach-grid' }, all.map((a) => { const g = S.achievements[a.id], def = g && g.def; return h('div', { class: 'ach ' + (g ? 'got' : 'locked') }, h('span', { class: 'ach-ic', html: icon(g ? (def && def.icon) || a.icon || 'trophy' : 'lock', 22) }), h('b', null, g && def ? def.title : '???'), h('span', { class: 'small muted' }, g && def ? def.desc : 'Sigue jugando para descubrirlo')); }));
  ui.modal({ title: `Logros · ${got}/${all.length}`, body: [grid] });
}

export function showMemory(id) {
  const c = cs(id), r = c.reveal; if (!r) return;
  const body = [h('div', { class: 'panel tint' }, h('p', { class: 'kicker' }, r.gift.label), h('h3', { class: 'h-md' }, r.gift.title), h('p', { class: 'lede' }, r.gift.revealText))];
  if (c.location) body.push(h('a', { class: 'btn btn-ghost', href: c.location.mapsUrl, target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('map-pin', 18) }), c.location.name));
  if (r.letter) body.push(h('button', { class: 'btn', onclick: () => { audio.sfx('reveal'); showLetter(r); } }, h('span', { html: icon('mail-open', 18) }), 'Releer la carta'));
  ui.modal({ title: 'Recuerdo', body });
}
export function showLetter(r) {
  ui.modal({ title: r.letter.title || 'Carta', body: [h('div', { class: 'paper' }, r.letter.paragraphs.map((p) => h('p', null, p)), r.letter.signature ? h('p', { class: 'sign' }, r.letter.signature) : null)] });
}

export function openSettings({ onReset, install }) {
  const S = state();
  const sw = (label, key, on) => { const b = h('button', { role: 'switch', 'aria-checked': String(!!S.settings[key]), 'aria-label': label }); b.addEventListener('click', () => { S.settings[key] = !S.settings[key]; b.setAttribute('aria-checked', String(S.settings[key])); save(); on(S.settings[key]); audio.sfx('click'); }); return h('div', { class: 'switch' }, h('span', null, label), b); };
  const body = [
    sw('Efectos de sonido', 'sound', () => audio.configure({ sound: S.settings.sound })),
    sw('Música ambiental', 'music', () => { audio.configure({ music: S.settings.music }); if (S.settings.music) audio.music(document.getElementById('app').dataset.theme); }),
    sw('Ahorro de batería (menos animaciones)', 'lowfx', (v) => { document.body.classList.toggle('lowfx', v); document.getElementById('app').classList.toggle('lowfx', v); fx.setLow(v); }),
  ];
  if (!canPersist()) body.push(h('div', { class: 'notice' }, h('span', { html: icon('triangle-alert', 18) }), h('span', null, 'Tu navegador no permite guardar el progreso. No cierres esta pestaña o perderás lo avanzado.')));
  const actions = [];
  if (install) actions.push(h('button', { class: 'btn btn-ghost', onclick: install }, h('span', { html: icon('smartphone', 18) }), 'Instalar en el móvil'));
  else body.push(h('div', { class: 'notice' }, h('span', { html: icon('smartphone', 18) }), h('span', null, 'Para usarla a pantalla completa: en iPhone, Compartir → «Añadir a pantalla de inicio»; en Android, menú ⋮ → «Instalar aplicación».')));
  const reset_ = h('button', { class: 'btn btn-ghost' }, 'Mantén pulsado para reiniciar la partida');
  ui.holdToConfirm(reset_, 1600, () => { onReset(); });
  body.push(reset_);
  body.push(h('p', { class: 'small muted', style: { textAlign: 'center', margin: 0 } }, 'LA VENGANZA 2.0 · hecha con (mucha) paciencia por Hugo'));
  ui.modal({ title: 'Ajustes', body, actions });
}
