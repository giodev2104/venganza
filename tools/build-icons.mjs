// Genera public/js/icons.js a partir de lucide-static (ISC). Uso: node tools/build-icons.mjs <ruta a lucide-static/icons>
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2] || '../_tmp/node_modules/lucide-static/icons';
const names = ['heart','star','key','car','paw-print','moon','sun','coffee','camera','music','gift','flame','lock','backpack','trophy','settings','map-pin','play','pause','volume-2','volume-x','x','check','lightbulb','arrow-right','compass','ticket','rotate-ccw','sparkles','eye','navigation','copy','share-2','download','smartphone','shield-check','lock-open','music-2','radar','cat','bird','rabbit','crown','mail-open','scroll-text','chevron-up','chevron-down','chevron-right','circle-help','history','award','pencil','trash-2','plus','save','upload','qr-code','flask-conical','log-out','external-link','refresh-cw','list-ordered','image','mic','film','triangle-alert','wifi-off','info','gauge','party-popper'];
const out = {};
for (const n of names) {
  const f = path.join(dir, n + '.svg');
  if (!fs.existsSync(f)) { console.error('FALTA', n); continue; }
  const svg = fs.readFileSync(f, 'utf8');
  out[n] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
}
const js = `// Iconos de Lucide (ISC License, https://lucide.dev). Generado por tools/build-icons.mjs
const P = ${JSON.stringify(out)};
export function icon(name, size = 22, cls = '') {
  const inner = P[name] || P['star'];
  return '<svg class="ic ' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
}
export const ICON_NAMES = Object.keys(P);
`;
fs.writeFileSync('public/js/icons.js', js);
console.log('icons.js', Object.keys(out).length, 'iconos');
