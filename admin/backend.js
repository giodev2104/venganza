// Backend del panel en la versión estática: en vez de un servidor, edita el repositorio de GitHub (la propia web) con tu token personal.
import { validateConfig } from '../static/validate.js';
import { defaultConfig } from '../static/default-config.js';

export const MODE = 'static';
export const LOGIN = { label: 'Token de GitHub', help: 'Pega tu token de GitHub (fine-grained, solo este repositorio, permiso «Contents: Read and write»). Se guarda únicamente en este navegador.' };

const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ok */ } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* ok */ } } };
const repoSlug = () => ls.get('venganza.ghrepo') || `${location.hostname.split('.')[0]}/${location.pathname.split('/')[1]}`;
const API = () => ls.get('venganza.ghapi') || 'https://api.github.com';
const err = (status, message, data) => Object.assign(new Error(message), { status, data });

async function gh(path, { method = 'GET', body } = {}) {
  const token = ls.get('venganza.token');
  if (!token) throw err(401, 'Sin sesión');
  let res;
  try {
    res = await fetch(API() + path, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch { throw err(0, 'Sin conexión con GitHub'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw err(401, 'El token no es válido o ha caducado');
  if (!res.ok) throw err(res.status, data.message || 'GitHub respondió ' + res.status, data);
  return data;
}
let branch = null;
const getBranch = async () => branch || (branch = (await gh(`/repos/${repoSlug()}`)).default_branch || 'main');
const utf8b64 = (s) => { const u = new TextEncoder().encode(s); let r = ''; for (let i = 0; i < u.length; i += 8000) r += String.fromCharCode(...u.subarray(i, i + 8000)); return btoa(r); };
const b64utf8 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
const getFile = async (p) => gh(`/repos/${repoSlug()}/contents/${p}?ref=${encodeURIComponent(await getBranch())}`);
async function putFile(p, content, message, sha) { return gh(`/repos/${repoSlug()}/contents/${p}`, { method: 'PUT', body: { message, content, branch: await getBranch(), ...(sha ? { sha } : {}) } }); }

async function readConfig() {
  const f = await getFile('static/config.js'), text = b64utf8(f.content), m = text.match(/^export const CONFIG = ([\s\S]*?);\nexport const SECRET = ("[^"]*");/);
  if (!m) throw err(500, 'static/config.js no tiene el formato esperado');
  return { cfg: JSON.parse(m[1]), secret: m[2], sha: f.sha };
}
const writeConfig = (cfg, secret, sha, msg) => putFile('static/config.js', utf8b64(`export const CONFIG = ${JSON.stringify(cfg)};\nexport const SECRET = ${secret};\n`), msg, sha);
const KINDS = { jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image', mp3: 'audio', m4a: 'audio', ogg: 'audio', wav: 'audio', mp4: 'video', webm: 'video' };

export async function api(path, { method = 'GET', body, raw } = {}) {
  const u = new URL(path, 'http://x'), p = u.pathname;
  switch (p) {
    case '/api/admin/me': if (!ls.get('venganza.token')) throw err(401, 'Sin sesión'); return { ok: true };
    case '/api/admin/login': {
      ls.set('venganza.token', String((body || {}).password || '').trim());
      try { const r = await gh(`/repos/${repoSlug()}`); if (!r.permissions || !r.permissions.push) throw err(401, 'El token no tiene permiso de escritura en este repositorio'); }
      catch (e) { ls.del('venganza.token'); throw e.status === 404 ? err(401, 'No encuentro el repositorio con ese token') : e; }
      ls.set('venganza.admin', '1'); return { ok: true };
    }
    case '/api/admin/logout': ls.del('venganza.token'); ls.del('venganza.admin'); return { ok: true };
    case '/api/admin/config': {
      if (method === 'GET') { const { cfg } = await readConfig(); return { config: cfg, validation: validateConfig(cfg), defaults: defaultConfig() }; }
      const v = validateConfig(body.config); if (v.errors.length) throw err(422, 'La configuración tiene errores', { validation: v });
      const cur = await readConfig(); body.config.epoch = cur.cfg.epoch;
      await writeConfig(body.config, cur.secret, cur.sha, 'Admin: actualizar configuración'); return { ok: true, validation: v };
    }
    case '/api/admin/validate': return validateConfig(body.config);
    case '/api/admin/reset-progress': { const cur = await readConfig(); cur.cfg.epoch = (cur.cfg.epoch || 1) + 1; await writeConfig(cur.cfg, cur.secret, cur.sha, 'Admin: reiniciar progreso'); return { ok: true, epoch: cur.cfg.epoch }; }
    case '/api/admin/password': throw err(400, 'No aplica: el acceso es tu token de GitHub');
    case '/api/admin/import': {
      const cfg = body.config, v = validateConfig(cfg); if (v.errors.length) throw err(422, 'El archivo no es una configuración válida', { validation: v });
      for (const f of body.files || []) if (/^m\w{4,}\.\w+$/.test(f.file || '') && KINDS[f.file.split('.').pop()]) await putFile('media/' + f.file, f.data, 'Admin: importar medio').catch(() => {});
      const cur = await readConfig(); cfg.epoch = cur.cfg.epoch; await writeConfig(cfg, cur.secret, cur.sha, 'Admin: importar configuración'); return { ok: true, validation: v };
    }
    case '/api/admin/media': {
      if (method === 'POST') {
        const name = u.searchParams.get('name') || 'archivo', ext = (name.split('.').pop() || '').toLowerCase(), kind = KINDS[ext];
        if (!kind) throw err(400, 'Formato no admitido. Usa jpg, png, webp, gif, mp3, m4a, ogg, wav, mp4 o webm.');
        if (raw.size > 40e6) throw err(400, 'El archivo pesa demasiado (máx. 40 MB). Comprímelo antes de subirlo.');
        const id = 'm' + Math.random().toString(36).slice(2, 8), file = `${id}.${ext}`;
        await putFile('media/' + file, await fileToB64(raw), 'Admin: subir ' + file);
        const item = { id, file, kind, visibility: 'public', builtin: false, label: (u.searchParams.get('label') || name).slice(0, 80) };
        const cur = await readConfig(); cur.cfg.media.push(item); await writeConfig(cur.cfg, cur.secret, cur.sha, 'Admin: registrar ' + file); return { ok: true, item };
      }
      if (method === 'DELETE') {
        const id = u.searchParams.get('id'), cur = await readConfig(), i = cur.cfg.media.findIndex((m) => m.id === id);
        if (i < 0) throw err(404, 'No existe');
        if (JSON.stringify({ ...cur.cfg, media: [] }).includes(`"${id}"`)) throw err(409, 'Ese medio está en uso en alguna prueba o regalo. Quítalo de ahí primero (y guarda).');
        const [m] = cur.cfg.media.splice(i, 1); await writeConfig(cur.cfg, cur.secret, cur.sha, 'Admin: quitar ' + m.file);
        if (!m.builtin) { const f = await getFile('media/' + m.file).catch(() => null); if (f) await gh(`/repos/${repoSlug()}/contents/media/${m.file}`, { method: 'DELETE', body: { message: 'Admin: borrar ' + m.file, sha: f.sha, branch: await getBranch() } }); }
        return { ok: true };
      }
      break;
    }
  }
  throw err(404, 'No disponible en la versión estática');
}
export function exportCfg(cfg) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), config: cfg }, null, 1)], { type: 'application/json' })); a.download = 'venganza-config.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
