// Genera recursos SVG provisionales (fotos de relleno) e iconos PWA. Todo es propio, sin copyright.
import fs from 'node:fs';
const A = 'public/assets/', I = 'public/icons/';
fs.mkdirSync(A, { recursive: true }); fs.mkdirSync(I, { recursive: true });

const avatar = (letter, c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="78" r="34" fill="rgba(255,255,255,.88)"/><path d="M34 190c4-44 32-66 66-66s62 22 66 66z" fill="rgba(255,255,255,.88)"/><text x="100" y="94" text-anchor="middle" font-family="Georgia,serif" font-size="46" font-weight="700" fill="${c2}">${letter}</text></svg>`;
fs.writeFileSync(A + 'bounce-hugo.svg', avatar('H', '#7c3aed', '#be185d'));
fs.writeFileSync(A + 'bounce-nixi.svg', avatar('N', '#f472b6', '#6d28d9'));

// Foto "de los dos" provisional: escena con rasgos distintivos para que el puzzle se pueda resolver visualmente.
fs.writeFileSync(A + 'placeholder-us.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".55" stop-color="#7e22ce"/><stop offset=".85" stop-color="#f472b6"/><stop offset="1" stop-color="#fdba74"/></linearGradient>
<radialGradient id="sun"><stop offset="0" stop-color="#fff7ed"/><stop offset="1" stop-color="#fb923c" stop-opacity="0"/></radialGradient></defs>
<rect width="900" height="900" fill="url(#sky)"/>
<circle cx="640" cy="520" r="210" fill="url(#sun)"/><circle cx="640" cy="520" r="78" fill="#fff1d6"/>
${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 197) % 880 + 10}" cy="${(i * 113) % 380 + 15}" r="${1.4 + (i % 3)}" fill="#fff" opacity="${0.4 + (i % 5) / 10}"/>`).join('')}
<path d="M0 640 L140 470 L260 600 L400 420 L560 640 L700 520 L900 660 L900 900 L0 900Z" fill="#2b1352"/>
<path d="M0 740 Q220 660 450 730 T900 700 L900 900 L0 900Z" fill="#150a2e"/>
<g fill="#0b0618"><circle cx="300" cy="560" r="46"/><path d="M215 790c6-92 44-150 85-150s79 58 85 150z"/><circle cx="470" cy="578" r="42"/><path d="M392 790c6-86 40-140 78-140s72 54 78 140z"/></g>
<path d="M382 700q18 26 36 0" fill="none" stroke="#f472b6" stroke-width="7" stroke-linecap="round"/>
<text x="450" y="860" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="34" fill="#fde7f3" opacity=".9">foto provisional · súbid la vuestra desde el panel</text></svg>`);

// Foto misteriosa provisional (corazón)
fs.writeFileSync(A + 'placeholder-mystery.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><radialGradient id="b" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#4c1d95"/><stop offset="1" stop-color="#0f0a24"/></radialGradient><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb7185"/><stop offset="1" stop-color="#be123c"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#b)"/>
${Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 331) % 780 + 10}" cy="${(i * 207) % 780 + 10}" r="${3 + (i % 4) * 2}" fill="#c4b5fd" opacity=".35"/>`).join('')}
<path d="M400 640C230 520 150 430 150 330c0-70 52-120 118-120 56 0 104 32 132 82 28-50 76-82 132-82 66 0 118 50 118 120 0 100-80 190-250 310z" fill="url(#h)"/>
<path d="M290 290c-40 0-70 28-70 64" fill="none" stroke="#ffe4e6" stroke-width="14" stroke-linecap="round" opacity=".7"/>
<rect x="60" y="690" width="680" height="6" rx="3" fill="#fda4af" opacity=".5"/></svg>`);

// Fotos de galería provisionales (estilo polaroid, 3 variantes)
[['#6d28d9', '#f472b6', 1], ['#be185d', '#fbbf24', 2], ['#0e7490', '#a78bfa', 3]].forEach(([c1, c2, n]) => {
  fs.writeFileSync(A + `placeholder-photo-${n}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="400" r="${150 + n * 20}" fill="rgba(255,255,255,.16)"/><circle cx="400" cy="400" r="${90 + n * 10}" fill="rgba(255,255,255,.24)"/><text x="400" y="440" text-anchor="middle" font-family="Georgia,serif" font-size="150" fill="rgba(255,255,255,.9)">${n}</text><text x="400" y="900" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="38" fill="rgba(255,255,255,.85)">foto provisional</text></svg>`);
});

// Icono de la app: estrella de cuatro puntas (guiño al ✨ del original) sobre degradado morado → rosa
const star = (cx, cy, r, ir) => { const p = []; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? ir : r; p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); } return p.join(' '); };
const icon = (pad, rx) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b21b6"/><stop offset=".6" stop-color="#9d174d"/><stop offset="1" stop-color="#be185d"/></linearGradient><radialGradient id="l" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" rx="${rx}" fill="#0f0a24"/><rect width="512" height="512" rx="${rx}" fill="url(#g)"/><rect width="512" height="512" rx="${rx}" fill="url(#l)"/><polygon points="${star(256, 250, 150 - pad, 40 - pad / 4)}" fill="#fff7fb"/><polygon points="${star(372, 142, 46 - pad / 3, 13)}" fill="#fbcfe8"/><polygon points="${star(150, 372, 30 - pad / 4, 9)}" fill="#c4b5fd"/></svg>`;
fs.writeFileSync(I + 'icon.svg', icon(0, 112));
fs.writeFileSync(I + 'icon-maskable.svg', icon(24, 0));
console.log('assets ok');
