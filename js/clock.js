// Calendario de desbloqueo: primer regalo en una fecha/hora fija y cada siguiente al día siguiente a una hora dada (zona horaria configurable).
// La hora se toma de la cabecera «Date» del servidor (no del reloj del móvil) para que cambiar la hora del teléfono no sirva de nada; sin conexión se usa el reloj del dispositivo.
import { rt } from './rt.js';

let offset = 0;
export async function sync() {
  try {
    const t0 = Date.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 3500);
    const r = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store', signal: ctl.signal }); clearTimeout(to);
    const d = Date.parse(r.headers.get('date') || ''); if (d) offset = d - (t0 + Date.now()) / 2;
  } catch { /* sin conexión: reloj del dispositivo */ }
}
export const now = () => Date.now() + offset;

const parts = (t, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).map((p) => [p.type, +p.value]));
const offsetAt = (t, tz) => { const g = parts(t, tz); return Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute, g.second) - Math.floor(t / 1000) * 1000; };
/** «2026-11-27» + «18:30» en la zona tz → milisegundos UTC. */
export function zoned(ymd, hm, tz) {
  const [y, mo, d] = ymd.split('-').map(Number), [h, mi] = hm.split(':').map(Number); let t = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) t = Date.UTC(y, mo - 1, d, h, mi) - offsetAt(t, tz);
  return t;
}
const sched = () => { const s = rt.pub && rt.pub.schedule; return s && s.enabled && !rt.test ? s : null; };
export const enabled = () => !!sched();
export function startAt() { const s = sched(); if (!s) return 0; const [d, hm] = String(s.startAt).split('T'); return zoned(d, hm, s.timezone || 'Europe/Madrid'); }
/** Instante en que se abre el capítulo siguiente a uno terminado en finishedAt: el día siguiente a la hora diaria. */
export function nextDay(finishedAt) {
  const s = sched(); if (!s) return 0; const tz = s.timezone || 'Europe/Madrid', g = parts(finishedAt, tz);
  const nd = new Date(Date.UTC(g.year, g.month - 1, g.day + 1)).toISOString().slice(0, 10);
  return Math.max(startAt(), zoned(nd, s.dailyTime || '18:30', tz));
}
export function fmt(t) {
  const s = sched(); return new Intl.DateTimeFormat('es-ES', { timeZone: (s && s.timezone) || 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(t)).replace(',', '') + ' h';
}
export function split(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 }; }
