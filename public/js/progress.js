// Cálculo del progreso general y por capítulo; el capítulo final permanece oculto hasta el falso final.
import { state, cs } from './store.js';
import { rt } from './rt.js';
import { HUD } from './ui.js';

export function visibleIds() {
  const p = rt.pub, S = state();
  return p.settings.hideFinal && !S.showFinal ? p.chapterIds.slice(0, p.visibleChapters) : p.chapterIds;
}
export function chapterPct(id) {
  const c = cs(id); if (c.done) return 1; if (!c.meta) return 0;
  const total = c.meta.tasks.length + 2, done = Object.keys(c.tokens.td).length + (c.location ? 1 : 0) + (c.reveal ? 1 : 0);
  return Math.min(1, done / total);
}
export function currentId() { return visibleIds().find((id) => !cs(id).done) || null; }
export function refreshHUD() {
  const ids = visibleIds(), segs = ids.map(chapterPct), pct = segs.reduce((a, b) => a + b, 0) / (ids.length || 1);
  const cur = currentId(), idx = cur ? ids.indexOf(cur) + 1 : ids.length;
  HUD.render({ segs, pct, label: cur ? `Regalo ${idx} de ${ids.length}` : `${ids.length} de ${ids.length} · completada` });
}
