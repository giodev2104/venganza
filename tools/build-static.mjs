// Genera una versión 100 % estática (para GitHub Pages u otro hosting de archivos).
// El motor del juego (server/game.js) se ejecuta DENTRO del navegador. ATENCIÓN: sin servidor no hay secretos:
// las respuestas y los códigos viajan en la propia web (cualquiera que abra las herramientas del navegador podría verlos).
// Uso: node tools/build-static.mjs [--config data/config.json] [--out dist-static]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../server/default-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const cfgPath = path.resolve(arg('config', path.join(ROOT, 'data/config.json')));
const mediaDir = path.resolve(arg('media', path.join(path.dirname(cfgPath), 'media')));
const OUT = path.resolve(arg('out', path.join(ROOT, 'dist-static')));

const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : defaultConfig();
console.log(fs.existsSync(cfgPath) ? `Configuración: ${cfgPath}` : 'Sin data/config.json: se usa la configuración por defecto (con contenido provisional).');

fs.rmSync(OUT, { recursive: true, force: true });
const copy = (from, to, skip = () => false) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip(e.name, from)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    e.isDirectory() ? copy(a, b, skip) : fs.copyFileSync(a, b);
  }
};
copy(path.join(ROOT, 'public'), OUT, (n, dir) => (dir.endsWith('public') && (n === 'admin' || n === 'sw.js')));

// Medios subidos (no integrados)
let nMedia = 0;
for (const m of cfg.media || []) {
  if (m.builtin) continue;
  const src = path.join(mediaDir, m.file);
  if (!fs.existsSync(src)) { console.warn('  Falta el archivo de medio:', m.file); continue; }
  fs.mkdirSync(path.join(OUT, 'media'), { recursive: true }); fs.copyFileSync(src, path.join(OUT, 'media', m.file)); nMedia++;
  m.visibility = 'public';
}

// Rutas absolutas → relativas (funciona en usuario.github.io/repositorio/)
const rw = (f, fn) => fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8')));
rw(path.join(OUT, 'index.html'), (s) => s.replace(/(href|src)="\//g, '$1="').replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">'));
for (const f of fs.readdirSync(path.join(OUT, 'css'))) rw(path.join(OUT, 'css', f), (s) => s.replace(/url\((['"]?)\//g, 'url($1../'));
rw(path.join(OUT, 'js/main.js'), (s) => s.replace("register('/sw.js')", "register('sw.js')"));
const mf = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.webmanifest'), 'utf8'));
mf.start_url = './'; mf.scope = './'; mf.id = './'; (mf.icons || []).forEach((i) => (i.src = i.src.replace(/^\//, '')));
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(mf, null, 1));

// Motor en el navegador
const S = path.join(OUT, 'static'); fs.mkdirSync(S, { recursive: true });
for (const f of ['util.js', 'game.js']) fs.writeFileSync(path.join(S, f), fs.readFileSync(path.join(ROOT, 'server', f), 'utf8').replace("'node:crypto'", "'./crypto-shim.js'"));
fs.writeFileSync(path.join(S, 'buffer.js'), String.raw`
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8, url) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); let r = btoa(s); return url ? r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : r; };
const unb64 = (str) => { str = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
export class B extends Uint8Array {
  static from(x, e) {
    let u;
    if (typeof x === 'string') u = e === 'base64' || e === 'base64url' ? unb64(x) : e === 'hex' ? Uint8Array.from(x.match(/../g) || [], (h) => parseInt(h, 16)) : enc.encode(x);
    else u = Uint8Array.from(x);
    const b = new B(u.length); b.set(u); return b;
  }
  static alloc(n) { return new B(n); }
  static concat(list) { const n = list.reduce((a, x) => a + x.length, 0), b = new B(n); let o = 0; for (const x of list) { b.set(x, o); o += x.length; } return b; }
  toString(e) { if (e === 'base64') return b64(this); if (e === 'base64url') return b64(this, true); if (e === 'hex') return [...this].map((v) => v.toString(16).padStart(2, '0')).join(''); return dec.decode(this); }
}
globalThis.Buffer = B;
`);
fs.writeFileSync(path.join(S, 'crypto-shim.js'), String.raw`
// SHA-256 / HMAC síncronos en JS puro. El cifrado con código físico (modo sin conexión del servidor) no se usa en la versión estática.
import { B } from './buffer.js';
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));
function sha256(msg) {
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const l = msg.length, n = ((l + 9 + 63) >> 6) << 6, p = new Uint8Array(n); p.set(msg); p[l] = 0x80;
  const dv = new DataView(p.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const w = new Uint32Array(64);
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new B(32), o2 = new DataView(out.buffer); h.forEach((v, i) => o2.setUint32(i * 4, v)); return out;
}
function hmac(key, data) {
  let k = B.from(key); if (k.length > 64) k = sha256(k);
  const ip = new Uint8Array(64 + data.length), op = new Uint8Array(96);
  for (let i = 0; i < 64; i++) { const v = k[i] || 0; ip[i] = v ^ 0x36; op[i] = v ^ 0x5c; }
  ip.set(data, 64); op.set(sha256(ip), 64); return sha256(op);
}
const crypto = {
  randomBytes(n) { const b = new B(n); globalThis.crypto.getRandomValues(b); return b; },
  createHmac(_alg, key) { const parts = []; const o = { update(d) { parts.push(B.from(d)); return o; }, digest(e) { const r = hmac(key, B.concat(parts)); return e ? r.toString(e) : r; } }; return o; },
  timingSafeEqual(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; },
  scryptSync() { throw new Error('no disponible'); },
  pbkdf2Sync() { return new B(32); },
  createCipheriv() { return { update: () => new B(0), final: () => new B(0), getAuthTag: () => new B(16) }; },
  createDecipheriv() { throw new Error('no disponible'); },
};
export default crypto;
`);
fs.writeFileSync(path.join(S, 'config.js'), 'export const CONFIG = ' + JSON.stringify(cfg) + ';\nexport const SECRET = ' + JSON.stringify(crypto.randomBytes(32).toString('hex')) + ';\n');
fs.writeFileSync(path.join(S, 'engine.js'), String.raw`
// Sustituto del servidor: expone la misma API que el cliente ya usa, ejecutando el motor del juego en local.
import './buffer.js';
import { CONFIG, SECRET } from './config.js';
const { Game } = await import('./game.js');
export class ApiError extends Error { constructor(msg, status, code, offline) { super(msg); this.status = status; this.code = code; this.offline = !!offline; } }
const game = new Game({ config: CONFIG, secret: SECRET });
const BASE = new URL('.', document.baseURI).href;
const fix = (v) => Array.isArray(v) ? v.map(fix) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : typeof v === 'string' && /^\/(media|assets)\//.test(v) ? BASE + v.slice(1) : v;
export async function api(path, body) {
  const p = new URL(path, 'http://x').pathname, b = body || {};
  try {
    let r;
    switch (p) {
      case '/api/public': r = game.publicInfo(); break;
      case '/api/chapter/open': r = game.openChapter(b); break;
      case '/api/task': r = game.getTask(b); break;
      case '/api/answer': r = game.answer({ ...b, skip: false }, { admin: false }); break;
      case '/api/hint': r = game.hint(b); break;
      case '/api/assemble': r = game.assemble(b); break;
      case '/api/chapter/complete': r = game.complete(b, 'static'); break;
      case '/api/achievement': r = CONFIG.achievements.find((a) => a.id === b.id); if (!r) throw Object.assign(new Error('not_found'), { status: 404, code: 'not_found' }); break;
      default: throw Object.assign(new Error('No disponible en la versión estática'), { status: 404, code: 'not_found' });
    }
    return fix(JSON.parse(JSON.stringify(r)));
  } catch (e) { throw e instanceof ApiError ? e : new ApiError(e.message || 'Error', e.status || 500, e.code, false); }
}
export const get = (p) => api(p, null);
`);
fs.writeFileSync(path.join(OUT, 'js/api.js'), "// Versión estática: la API se resuelve en el propio navegador.\nexport { ApiError, api, get } from '../static/engine.js';\n");

// Service worker (caché de todo el juego)
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(path.relative(OUT, p).split(path.sep).join('/')); } })(OUT);
const build = crypto.createHash('sha1').update(files.join() + Date.now()).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sw.js'), `const C = 'venganza-static-${build}', FILES = ${JSON.stringify(['./', ...files.filter((f) => f !== 'sw.js')])};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() => caches.match('./')))); });
`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'LEEME.txt'), 'Versión estática de LA VENGANZA 2.0.\nSube TODO el contenido de esta carpeta a un repositorio de GitHub y activa Pages (Settings → Pages → Deploy from a branch → main / root).\nAdvertencia: sin servidor, las respuestas y códigos van dentro de la web.\n');
console.log(`Listo: ${OUT}\n  ${files.length} archivos, ${nMedia} medios propios. Sube el contenido de esa carpeta a GitHub Pages.`);
