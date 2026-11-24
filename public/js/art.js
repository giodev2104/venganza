// Ilustraciones SVG propias (regalos, estrella de la marca).
const PAL = { c1: ['#6d28d9', '#a78bfa', '#f472b6'], c2: ['#be123c', '#fb7185', '#fcd34d'], c3: ['#c2410c', '#fb923c', '#fde047'], c4: ['#9a6b2a', '#ecd08f', '#f4a9c4'] };
let uid = 0;
export function giftSVG(theme = 'c1', { open = false, locked = false, orb = false } = {}) {
  const [a, b, c] = locked ? ['#3b3558', '#544c78', '#6d6590'] : PAL[theme] || PAL.c1, id = 'g' + ++uid;
  if (orb) return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient></defs><g class="rays"><path d="M50 4v14M50 82v14M4 50h14M82 50h14M18 18l10 10M72 72l10 10M82 18L72 28M28 72L18 82" stroke="${c}" stroke-width="3" stroke-linecap="round"/></g><circle cx="50" cy="50" r="28" fill="url(#${id})"/><ellipse cx="40" cy="38" rx="9" ry="5" fill="#fff" opacity=".5" transform="rotate(-30 40 38)"/>${locked ? lock() : ''}</svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
<g class="rays"><path d="M50 8v10M20 20l7 7M80 20l-7 7M8 46h10M82 46h10" stroke="${c}" stroke-width="3" stroke-linecap="round"/></g>
<rect x="18" y="50" width="64" height="38" rx="6" fill="url(#${id})"/><rect x="45" y="50" width="10" height="38" fill="${c}"/>
<g class="lid" ${open ? 'transform="translate(-6 -16) rotate(-18 20 50)"' : ''}><rect x="13" y="38" width="74" height="16" rx="5" fill="url(#${id})"/><rect x="45" y="38" width="10" height="16" fill="${c}"/><path d="M50 38c-6-14-22-14-20-5 1 6 14 5 20 5zM50 38c6-14 22-14 20-5-1 6-14 5-20 5z" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/></g>
${locked ? lock() : ''}</svg>`;
}
const lock = () => '<g transform="translate(35 52)"><rect x="0" y="12" width="30" height="24" rx="5" fill="#0b0a14" stroke="#9a91b8" stroke-width="2.5"/><path d="M6 12V8a9 9 0 0 1 18 0v4" fill="none" stroke="#9a91b8" stroke-width="3" stroke-linecap="round"/></g>';
export const sparkSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.3 7.2 7.2 2.3-7.2 2.3L12 20.5l-2.3-7.2L2.5 11l7.2-2.3z"/><path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" opacity=".8"/></svg>';
