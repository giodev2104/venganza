// Servidor HTTP sin dependencias: estáticos públicos + API de juego + API de administración + medios privados firmados.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { Game } from './game.js';
import { validateConfig } from './validate.js';
import { checkPassword, rid, clone } from './util.js';
import { defaultConfig } from './default-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8' };
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg']);
const UPLOAD = { image: { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif'], max: 15e6 }, audio: { exts: ['mp3', 'm4a', 'ogg', 'wav'], max: 30e6 }, video: { exts: ['mp4', 'webm'], max: 120e6 } };
const kindOf = (ext) => Object.keys(UPLOAD).find((k) => UPLOAD[k].exts.includes(ext));

export function createApp({ dataDir, adminPassword, trustProxy = false, secureCookie = false } = {}) {
  const store = new Store(dataDir);
  store.initAdmin(adminPassword);
  const game = new Game(store);
  const sessions = new Map(); // sid -> expira
  const loginFails = new Map(); // ip -> {n, until}
  const hits = new Map(); // ip -> {n, t}
  const gz = new Map();

  const ipOf = (req) => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';
  const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, v.join('=')]));
  const isAdmin = (req) => { const sid = cookies(req).vsid; const exp = sessions.get(sid); if (!sid || !exp) return false; if (exp < Date.now()) { sessions.delete(sid); return false; } return true; };

  function headers(extra = {}) {
    return {
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      ...extra,
    };
  }
  const json = (res, status, obj, extra = {}) => { const b = JSON.stringify(obj); res.writeHead(status, headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b), ...extra })); res.end(b); };
  const fail = (res, status, code, message) => json(res, status, { error: { code, message: message || code } });

  function readBody(req, limit = 1e6) {
    return new Promise((resolve, reject) => {
      const chunks = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413, code: 'too_large' })); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  const readJson = async (req, limit) => { const b = await readBody(req, limit); if (!b.length) return {}; try { return JSON.parse(b.toString('utf8')); } catch { throw Object.assign(new Error('JSON inválido'), { status: 400, code: 'bad_json' }); } };

  function limited(ip, max = 240) {
    const now = Date.now(), r = hits.get(ip) || { n: 0, t: now };
    if (now - r.t > 60000) { r.n = 0; r.t = now; }
    r.n++; hits.set(ip, r); return r.n > max;
  }

  // ── Service worker dinámico: inyecta versión de build y lista de precarga (consistencia de caché) ──
  let swCache = { t: 0, body: '' };
  function walk(dir, base = '') { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? (d.name === 'admin' ? [] : walk(path.join(dir, d.name), base + d.name + '/')) : [base + d.name]); }
  function serveSW(req, res) {
    if (Date.now() - swCache.t > 3000) {
      const files = walk(PUBLIC).filter((f) => f !== 'sw.js' && !/^assets\/(placeholder|bounce)/.test(f) && !f.endsWith('.map'));
      const h = crypto.createHash('sha1'); for (const f of files.concat(['sw.js'])) { const st = fs.statSync(path.join(PUBLIC, f)); h.update(f + st.size + Math.floor(st.mtimeMs)); }
      swCache = { t: Date.now(), body: fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8').replace('__BUILD__', h.digest('hex').slice(0, 10)).replace('"__PRECACHE__"', JSON.stringify(['/'].concat(files.map((f) => '/' + f)))) };
    }
    res.writeHead(200, headers({ 'Content-Type': MIME['.js'], 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' })); res.end(swCache.body);
  }

  // ── Estáticos ──
  function serveStatic(req, res, pathname) {
    if (pathname === '/sw.js') return serveSW(req, res);
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return fail(res, 403, 'forbidden');
    let st; try { st = fs.statSync(file); } catch { return fail(res, 404, 'not_found'); }
    if (st.isDirectory()) { res.writeHead(301, { Location: pathname + '/' }); return res.end(); }
    const ext = path.extname(file).toLowerCase(), etag = `"${st.size}-${Math.floor(st.mtimeMs)}"`;
    const cache = ['.html', '.js', '.mjs', '.css', '.webmanifest', '.json'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
    const h = headers({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, ETag: etag });
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let z = gz.get(file); if (!z || z.etag !== etag) { z = { etag, buf: zlib.gzipSync(fs.readFileSync(file)) }; gz.set(file, z); }
      res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': z.buf.length }); return res.end(req.method === 'HEAD' ? undefined : z.buf);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  // ── Medios privados (con soporte de Range para audio/vídeo en iOS) ──
  function serveMedia(req, res, url) {
    const file = path.basename(decodeURIComponent(url.pathname.slice('/media/'.length)));
    const m = (store.config.media || []).find((x) => !x.builtin && x.file === file);
    if (!m) return fail(res, 404, 'not_found');
    const ok = m.visibility === 'public' || isAdmin(req) || game.mediaSigOk(file, url.searchParams.get('e'), url.searchParams.get('s'));
    if (!ok) return fail(res, 403, 'forbidden', 'Enlace caducado o no válido');
    const p = store.mediaPath(file); let st; try { st = fs.statSync(p); } catch { return fail(res, 404, 'not_found'); }
    const ext = path.extname(file).toLowerCase();
    const h = headers({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (rg && (rg[1] || rg[2])) {
      let a = rg[1] ? parseInt(rg[1]) : st.size - parseInt(rg[2]), b = rg[1] && rg[2] ? parseInt(rg[2]) : st.size - 1;
      if (a >= st.size || a > b) { res.writeHead(416, { ...h, 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      b = Math.min(b, st.size - 1);
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(p, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(p).pipe(res);
  }

  function sniff(buf, ext) {
    const s = (a, o = 0) => a.every((b, i) => buf[o + i] === b), t = (x, o = 0) => buf.slice(o, o + x.length).toString('latin1') === x;
    switch (ext) {
      case 'jpg': case 'jpeg': return s([0xff, 0xd8, 0xff]);
      case 'png': return s([0x89, 0x50, 0x4e, 0x47]);
      case 'gif': return t('GIF8');
      case 'webp': return t('RIFF') && t('WEBP', 8);
      case 'mp3': return t('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
      case 'ogg': return t('OggS');
      case 'wav': return t('RIFF') && t('WAVE', 8);
      case 'm4a': case 'mp4': return t('ftyp', 4);
      case 'webm': return s([0x1a, 0x45, 0xdf, 0xa3]);
    }
    return false;
  }

  // ── Rutas ──
  const R = {};
  const route = (method, p, fn, opts = {}) => { R[method + ' ' + p] = { fn, ...opts }; };

  // Juego (público)
  route('GET', '/api/public', async (ctx) => ctx.json(200, game.publicInfo()));
  route('POST', '/api/chapter/open', async (ctx) => ctx.json(200, game.openChapter(await ctx.body())));
  route('POST', '/api/task', async (ctx) => ctx.json(200, game.getTask(await ctx.body())));
  route('POST', '/api/answer', async (ctx) => ctx.json(200, game.answer(await ctx.body(), { admin: isAdmin(ctx.req) })));
  route('POST', '/api/achievement', async (ctx) => { const { id } = await ctx.body(); const a = game.cfg.achievements.find((x) => x.id === id); if (!a) return fail(ctx.res, 404, 'not_found'); ctx.json(200, a); });
  route('POST', '/api/hint', async (ctx) => ctx.json(200, game.hint(await ctx.body())));
  route('POST', '/api/assemble', async (ctx) => ctx.json(200, game.assemble(await ctx.body())));
  route('POST', '/api/chapter/complete', async (ctx) => ctx.json(200, game.complete(await ctx.body(), ctx.ip)));

  // Modo pruebas (solo con sesión de administrador)
  route('GET', '/api/test/start', async (ctx) => ctx.json(200, game.testStart(ctx.url.searchParams.get('n'))), { admin: true });
  route('GET', '/api/test/codes', async (ctx) => ctx.json(200, game.testCodes()), { admin: true });

  // Administración
  route('POST', '/api/admin/login', async (ctx) => {
    const rec = loginFails.get(ctx.ip) || { n: 0, until: 0 };
    if (rec.until > Date.now()) return fail(ctx.res, 429, 'locked', 'Demasiados intentos. Espera unos minutos.');
    const { password } = await ctx.body();
    await new Promise((r) => setTimeout(r, 350));
    if (!checkPassword(password || '', store.admin)) {
      rec.n++; if (rec.n >= 5) { rec.until = Date.now() + 15 * 60000; rec.n = 0; } loginFails.set(ctx.ip, rec);
      return fail(ctx.res, 401, 'bad_password', 'Contraseña incorrecta');
    }
    loginFails.delete(ctx.ip);
    const sid = crypto.randomBytes(24).toString('base64url'); sessions.set(sid, Date.now() + 12 * 3600e3);
    const sec = secureCookie || (trustProxy && ctx.req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
    ctx.json(200, { ok: true }, { 'Set-Cookie': `vsid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${sec}` });
  });
  route('POST', '/api/admin/logout', async (ctx) => { sessions.delete(cookies(ctx.req).vsid); ctx.json(200, { ok: true }, { 'Set-Cookie': 'vsid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }, { admin: true });
  route('GET', '/api/admin/me', async (ctx) => ctx.json(200, { ok: true }), { admin: true });
  route('GET', '/api/admin/config', async (ctx) => ctx.json(200, { config: store.config, validation: validateConfig(store.config), defaults: defaultConfig() }), { admin: true });
  route('POST', '/api/admin/validate', async (ctx) => ctx.json(200, validateConfig((await ctx.body()).config)), { admin: true });
  route('PUT', '/api/admin/config', async (ctx) => {
    const { config } = await ctx.body(4e6);
    const v = validateConfig(config);
    if (v.errors.length) return json(ctx.res, 422, { error: { code: 'invalid', message: 'La configuración tiene errores' }, validation: v });
    config.epoch = store.config.epoch; // el reinicio de progreso solo se hace con su botón
    store.save(config);
    ctx.json(200, { ok: true, validation: v });
  }, { admin: true });
  route('POST', '/api/admin/password', async (ctx) => {
    const { current, next } = await ctx.body();
    if (!checkPassword(current || '', store.admin)) return fail(ctx.res, 401, 'bad_password', 'La contraseña actual no es correcta');
    if (String(next || '').length < 8) return fail(ctx.res, 400, 'weak', 'Usa al menos 8 caracteres');
    store.setAdminPassword(next); ctx.json(200, { ok: true });
  }, { admin: true });
  route('POST', '/api/admin/reset-progress', async (ctx) => { const c = clone(store.config); c.epoch = (c.epoch || 1) + 1; store.save(c); ctx.json(200, { ok: true, epoch: c.epoch }); }, { admin: true });
  route('GET', '/api/admin/export', async (ctx) => {
    const out = { exportedAt: new Date().toISOString(), config: store.config };
    if (ctx.url.searchParams.get('media') === '1') out.files = (store.config.media || []).filter((m) => !m.builtin).map((m) => { try { return { file: m.file, data: fs.readFileSync(store.mediaPath(m.file)).toString('base64') }; } catch { return null; } }).filter(Boolean);
    const b = JSON.stringify(out, null, 1);
    ctx.res.writeHead(200, headers({ 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="venganza-config.json"', 'Cache-Control': 'no-store' })); ctx.res.end(b);
  }, { admin: true });
  route('POST', '/api/admin/import', async (ctx) => {
    const body = await ctx.body(250e6), cfg = body.config;
    const v = validateConfig(cfg);
    if (v.errors.length) return json(ctx.res, 422, { error: { code: 'invalid', message: 'El archivo no es una configuración válida' }, validation: v });
    for (const f of body.files || []) {
      const safe = path.basename(String(f.file || '')), ext = path.extname(safe).slice(1).toLowerCase();
      if (!/^m[\w]{4,}\.\w+$/.test(safe) || !kindOf(ext)) continue;
      const buf = Buffer.from(String(f.data || ''), 'base64'); if (sniff(buf, ext)) fs.writeFileSync(store.mediaPath(safe), buf, { mode: 0o600 });
    }
    cfg.epoch = store.config.epoch; store.save(cfg); ctx.json(200, { ok: true, validation: v });
  }, { admin: true });
  route('POST', '/api/admin/media', async (ctx) => {
    const name = String(ctx.url.searchParams.get('name') || 'archivo'), ext = path.extname(name).slice(1).toLowerCase(), kind = kindOf(ext);
    if (!kind) return fail(ctx.res, 400, 'bad_ext', 'Formato no admitido. Usa jpg, png, webp, gif, mp3, m4a, ogg, wav, mp4 o webm.');
    const buf = await readBody(ctx.req, UPLOAD[kind].max);
    if (!buf.length || !sniff(buf, ext)) return fail(ctx.res, 400, 'bad_file', 'El archivo no parece un ' + kind + ' válido');
    const { id, file } = store.newMediaFile(ext); fs.writeFileSync(store.mediaPath(file), buf, { mode: 0o600 });
    const cfg = clone(store.config), vis = ctx.url.searchParams.get('visibility') === 'public' ? 'public' : 'gated';
    const item = { id, file, kind, visibility: vis, builtin: false, label: String(ctx.url.searchParams.get('label') || name).slice(0, 80) };
    cfg.media.push(item); store.save(cfg); ctx.json(200, { ok: true, item });
  }, { admin: true });
  route('PATCH', '/api/admin/media', async (ctx) => {
    const { id, label, visibility } = await ctx.body(); const cfg = clone(store.config), m = cfg.media.find((x) => x.id === id);
    if (!m) return fail(ctx.res, 404, 'not_found'); if (label != null) m.label = String(label).slice(0, 80); if (visibility && !m.builtin) m.visibility = visibility === 'public' ? 'public' : 'gated';
    store.save(cfg); ctx.json(200, { ok: true, item: m });
  }, { admin: true });
  route('DELETE', '/api/admin/media', async (ctx) => {
    const id = ctx.url.searchParams.get('id'), cfg = clone(store.config), i = cfg.media.findIndex((x) => x.id === id);
    if (i < 0) return fail(ctx.res, 404, 'not_found');
    const used = JSON.stringify({ ...cfg, media: [] }).includes(`"${id}"`);
    if (used) return fail(ctx.res, 409, 'in_use', 'Ese medio está en uso en alguna prueba o regalo. Quítalo de ahí primero.');
    const [m] = cfg.media.splice(i, 1); if (!m.builtin) store.deleteMediaFile(m.file); store.save(cfg); ctx.json(200, { ok: true });
  }, { admin: true });

  async function handler(req, res) {
    const url = new URL(req.url, 'http://x'), p = url.pathname, ip = ipOf(req);
    try {
      if (limited(ip, p.startsWith('/api/') ? 300 : 1500)) return fail(res, 429, 'rate', 'Demasiadas peticiones');
      if (p.startsWith('/api/')) {
        const r = R[req.method + ' ' + p];
        if (!r) return fail(res, 404, 'not_found');
        if (r.admin) {
          if (!isAdmin(req)) return fail(res, 401, 'auth', 'Inicia sesión en el panel');
          if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'venganza') return fail(res, 403, 'csrf', 'Petición no permitida');
        }
        const ctx = { req, res, url, ip, json: (s, o, e) => json(res, s, o, e), body: (limit) => readJson(req, limit) };
        return await r.fn(ctx);
      }
      if (p.startsWith('/media/')) return serveMedia(req, res, url);
      if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method');
      return serveStatic(req, res, p);
    } catch (e) {
      if (!res.headersSent) fail(res, e.status || 500, e.code || 'server_error', e.status ? e.message : 'Error interno');
      if (!e.status) console.error('[error]', e);
    }
  }

  const server = http.createServer(handler);
  server.requestTimeout = 120000;
  setInterval(() => { const n = Date.now(); for (const [k, v] of sessions) if (v < n) sessions.delete(k); for (const [k, v] of hits) if (n - v.t > 120000) hits.delete(k); }, 60000).unref();
  return { server, store, game };
}
