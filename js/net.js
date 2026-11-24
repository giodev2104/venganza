// Reintentos amables cuando no hay cobertura: el progreso siempre está a salvo en el dispositivo.
import { h } from './util.js';
import { icon } from './icons.js';
import { modal } from './ui.js';

export async function online(fn, what = 'continuar') {
  for (;;) {
    try { return await fn(); }
    catch (e) { if (!e.offline) throw e; await offlinePrompt(what); }
  }
}
function offlinePrompt(what) {
  return new Promise((resolve) => {
    const retry = () => { off(); m.close(); resolve(); };
    const m = modal({ title: 'Sin conexión', dismissable: false, cls: 'center-sheet',
      body: [h('div', { class: 'panel', style: { textAlign: 'center' } }, h('span', { html: icon('wifi-off', 34), style: { color: 'var(--a2)' } }), h('p', { class: 'lede', style: { marginTop: '10px' } }, `Ahora mismo no llega la señal, así que no puedo ${what}. Tu progreso está guardado en el móvil. Muévete a un sitio con cobertura y reintenta.`))],
      actions: [h('button', { class: 'btn', onclick: retry }, 'Reintentar')] });
    const onl = () => setTimeout(retry, 600); addEventListener('online', onl, { once: true });
    const off = () => removeEventListener('online', onl);
  });
}
export function fatal(message, onReset) {
  return new Promise(() => {
    modal({ title: 'Algo no cuadra', dismissable: false, body: [h('p', { class: 'lede' }, message || 'El servidor no reconoce tu progreso (puede que Hugo haya cambiado algo). Lo más seguro es empezar de nuevo.')], actions: [h('button', { class: 'btn', onclick: onReset }, 'Empezar de nuevo')] });
  });
}
