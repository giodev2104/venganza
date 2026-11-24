// Logros: se desbloquean en el cliente y su texto lo sirve el servidor en ese momento (los bloqueados siguen siendo un misterio).
import { api } from './api.js';
import { state, save } from './store.js';
import { achievementToast } from './ui.js';

const cache = {};
export async function achieve(id) {
  const S = state(); if (!id || S.achievements[id]) return;
  S.achievements[id] = { ts: Date.now() }; save();
  let def = cache[id];
  if (!def) { try { def = cache[id] = await api('/api/achievement', { id }); } catch { def = { id, title: 'Nuevo logro', desc: 'Se completará cuando vuelva la señal.', icon: 'trophy' }; S.pendingAch.push(id); } }
  S.achievements[id].def = def; save(); achievementToast(def);
}
export function achieveDef(def) {
  const S = state(); if (!def || S.achievements[def.id]) return;
  cache[def.id] = def; S.achievements[def.id] = { ts: Date.now(), def }; save(); achievementToast(def);
}
export async function syncPending() {
  const S = state(); const ids = S.pendingAch.splice(0);
  for (const id of ids) { try { const def = await api('/api/achievement', { id }); if (S.achievements[id]) S.achievements[id].def = def; } catch { S.pendingAch.push(id); } }
  save();
}
