// Estado y guardado automático. localStorage con respaldo en memoria si el navegador lo bloquea.
import { safeJSON } from './util.js';

const VERSION = 1;
let KEY = 'venganza2.save';
let mem = null, persistOk = true, timer = null, listeners = new Set();

const blank = () => ({
  v: VERSION, epoch: 0, introDone: false, showFinal: false, startedAt: 0,
  settings: { sound: true, music: false, lowfx: false },
  chapters: {}, // por id: ver chapterState()
  inventory: [], history: [], achievements: {}, pendingAch: [],
  stats: { fails: 0, hints: 0 },
});
let S = blank();

export function useKey(k) { KEY = k; }
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { persistOk = false; }
  const d = raw ? safeJSON(raw, null) : null;
  S = d && d.v === VERSION ? Object.assign(blank(), d) : blank();
  S.settings = Object.assign(blank().settings, S.settings);
  if (d && d.v !== VERSION) { try { localStorage.setItem(KEY + '.old', raw); } catch { /* ok */ } }
  return S;
}
export const state = () => S;
export const canPersist = () => persistOk;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 120);
  listeners.forEach((f) => f(S));
}
export function flush() {
  clearTimeout(timer);
  try { localStorage.setItem(KEY, JSON.stringify(S)); persistOk = true; } catch { persistOk = false; }
}
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export function reset(keepEpoch) {
  const e = keepEpoch ?? S.epoch; S = blank(); S.epoch = e; flush(); listeners.forEach((f) => f(S));
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

/** Estado persistente de un capítulo. */
export function cs(id) {
  return (S.chapters[id] ||= { opened: false, stage: 'story', taskIdx: 0, meta: null, tokens: { co: '', td: {}, lc: '', cd: '' }, frags: {}, location: null, blob: null, reveal: null, hints: 0, fails: 0, assembleTries: 0, done: false, startedAt: 0, finishedAt: 0 });
}
export function addInventory(item) {
  if (!item) return false;
  if (S.inventory.some((x) => x.id === item.id)) return false;
  S.inventory.push({ ...item, ts: Date.now() }); save(); return true;
}
export function addHistory(entry) { S.history.push({ ...entry, ts: Date.now() }); save(); }
