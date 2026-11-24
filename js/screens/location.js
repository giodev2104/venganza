// Ubicación revelada: mapa, radar opcional con consentimiento, y código físico validable sin cobertura.
import { h, copyText, typewriter, sleep } from '../util.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { decryptBlob } from '../crypto.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import { state, save } from '../store.js';
import { rt } from '../rt.js';
import { fatal } from '../net.js';

const R = 6371e3, rad = (d) => d * Math.PI / 180;
const dist = (a, b, c, d) => { const x = rad(c - a), y = rad(d - b), s = Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const bearing = (a, b, c, d) => { const y = Math.sin(rad(d - b)) * Math.cos(rad(c)), x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b)); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
const fmtDist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km');

export function locationStage(c, { afterRestore = false } = {}) {
  return new Promise(async (resolve) => {
    const loc = c.location; let wrongs = 0, watchId = null;
    const coords = h('div', { class: 'coords-big shimmer', 'aria-live': 'polite' });
    const geo = h('div', { class: 'geo-box' });
    const code = h('input', { class: 'input code', type: 'text', placeholder: 'CÓDIGO', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Código secreto del regalo', maxlength: 40 });
    const open = h('button', { class: 'btn' }, h('span', { html: icon('lock-open', 20) }), 'Abrir el regalo');
    const msg = h('p', { class: 'small', style: { margin: 0, minHeight: '1.3em', color: 'var(--ink-2)' }, 'aria-live': 'polite' });

    function stopGeo() { if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; } }
    function startGeo() {
      if (!navigator.geolocation) { geo.textContent = 'Este dispositivo no permite localizarte. No pasa nada: usa el mapa y el código.'; return; }
      geo.textContent = 'Buscando señal…';
      const arrow = h('span', { class: 'arrow', html: icon('navigation', 40) }), d = h('div', { class: 'geo-dist' }), small = h('p', { class: 'small muted', style: { margin: 0 } });
      watchId = navigator.geolocation.watchPosition((p) => {
        const m = dist(p.coords.latitude, p.coords.longitude, loc.lat, loc.lng), b = bearing(p.coords.latitude, p.coords.longitude, loc.lat, loc.lng);
        d.textContent = m < 30 ? '¡Ya estás aquí!' : fmtDist(m); arrow.style.transform = `rotate(${Math.round(b - 45)}deg)`; small.textContent = m < 30 ? 'Busca el código con calma.' : `Dirección aproximada (norte arriba) · precisión ±${Math.round(p.coords.accuracy)} m`;
        geo.textContent = ''; geo.append(arrow, d, small, h('button', { class: 'link-btn', onclick: () => { stopGeo(); geo.textContent = ''; geo.append(offBtn()); } }, 'Desactivar radar'));
      }, (e) => { geo.textContent = e.code === 1 ? 'Sin permiso de ubicación: perfecto, no la necesitas. Usa el mapa y el código.' : 'No hay señal GPS ahora mismo. Puedes seguir con el mapa y el código.'; stopGeo(); }, { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 });
    }
    const offBtn = () => h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { if (confirm('Tu ubicación solo se usa en este dispositivo, mientras tengas esta pantalla abierta, para calcular la distancia. No se envía a ningún sitio. ¿Activar el radar?')) startGeo(); } }, h('span', { html: icon('radar', 18) }), 'Activar radar (opcional)');
    if (loc.geo) geo.append(offBtn());

    async function submit() {
      const v = code.value.trim(); if (!v) { fx.shake(code); return; }
      open.classList.add('is-off'); msg.textContent = 'Comprobando…';
      let ok = false, reveal = null, cd = '', failMsg = null;
      try {
        const res = await api('/api/chapter/complete', { chapterId: c.id, code: v, proof: c.tokens.lc }, { timeout: 6000 });
        if (res.ok) { ok = true; reveal = res.reveal; cd = res.token; } else failMsg = res.msg;
      } catch (e) {
        if (e.offline) {
          try { const pt = await decryptBlob(v, c.blob); ok = true; reveal = pt.reveal; cd = pt.cd; ui.toast('Código correcto (comprobado sin conexión)', { icn: 'wifi-off', kind: 'good' }); }
          catch { failMsg = { title: 'CÓDIGO INCORRECTO', text: 'No es ese. Mira bien: puede estar escondido, doblado o debajo de algo.' }; }
        } else if (e.status === 429) failMsg = { title: 'CALMA', text: 'Demasiados intentos seguidos. Respira y prueba en unos minutos.' };
        else if (e.status === 403) { await fatal(); return; }
        else throw e;
      }
      open.classList.remove('is-off'); msg.textContent = '';
      if (!ok) { wrongs++; state().stats.fails++; save(); audio.sfx('fail'); fx.shake(code); code.select(); msg.textContent = `${failMsg.title}: ${failMsg.text}`; msg.style.color = 'var(--bad)'; if (wrongs === 3) ui.toast('Pista: el código está físicamente junto al regalo. Búscalo con calma.', { icn: 'lightbulb', ms: 4800 }); return; }
      stopGeo(); c.reveal = reveal; c.tokens.cd = cd; save(); audio.sfx('safeopen'); fx.sparkleAt(open, 36); await sleep(700); resolve();
    }
    open.addEventListener('click', submit); code.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    if (rt.pendingCode) { code.value = rt.pendingCode; rt.pendingCode = ''; setTimeout(() => ui.toast('Código leído del QR', { icn: 'qr-code', kind: 'good' }), 400); }

    const el = ui.screen('location',
      h('header', { style: { display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' } }, h('p', { class: 'kicker' }, 'Ubicación revelada'), h('h1', { class: 'h-lg' }, loc.name), coords, loc.note ? h('p', { class: 'lede' }, loc.note) : null),
      h('div', { class: 'radar', 'aria-hidden': 'true' }, h('i'), h('span', { class: 'pin' })),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn', style: { flexBasis: '100%' }, href: loc.mapsUrl, target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('map-pin', 20) }), 'Abrir en Google Maps'),
        h('button', { class: 'btn btn-ghost', onclick: async () => { await copyText(loc.coordsText + (loc.lat != null ? `\n${loc.lat}, ${loc.lng}` : '')); ui.toast('Coordenadas copiadas', { icn: 'copy', kind: 'good' }); } }, h('span', { html: icon('copy', 18) }), 'Copiar')),
      h('div', { class: 'notice' }, h('span', { html: icon('car', 18) }), h('span', null, 'Si vais en coche: que mire el móvil el copiloto. Nada de móvil al volante.')),
      loc.geo ? geo : null,
      h('div', { class: 'code-box' }, h('h2', { class: 'h-md' }, 'Código secreto'), h('p', { class: 'small muted', style: { margin: 0 } }, c.meta.codePrompt || 'Busca el código junto al regalo.'), h('div', { class: 'field' }, code), open, msg, h('p', { class: 'small muted', style: { margin: 0 } }, 'Si hay un QR, escanéalo con la cámara: te traerá el código.')));
    await ui.show(el);
    if (!afterRestore) { audio.sfx('reveal'); await typewriter(coords, loc.coordsText, { speed: 34 }); } else coords.textContent = loc.coordsText;
  });
}
