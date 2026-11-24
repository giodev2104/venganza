
// Sustituto del servidor: expone la misma API que el cliente ya usa, ejecutando el motor del juego en local.
import './buffer.js';
import { CONFIG, SECRET } from './config.js';
const { Game } = await import('./game.js');
export class ApiError extends Error { constructor(msg, status, code, offline) { super(msg); this.status = status; this.code = code; this.offline = !!offline; } }
const game = new Game({ config: CONFIG, secret: SECRET });
const BASE = new URL('.', document.baseURI).href;
const fix = (v) => Array.isArray(v) ? v.map(fix) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : typeof v === 'string' && /^\/(media|assets)\//.test(v) ? BASE + v.slice(1) : v;
const isAdmin = () => { try { return localStorage.getItem('venganza.admin') === '1'; } catch { return false; } };
export async function api(path, body) {
  const p = new URL(path, 'http://x').pathname, b = body || {};
  try {
    let r;
    switch (p) {
      case '/api/public': r = game.publicInfo(); break;
      case '/api/chapter/open': r = game.openChapter(b); break;
      case '/api/task': r = game.getTask(b); break;
      case '/api/answer': r = game.answer(b, { admin: isAdmin() }); break;
      case '/api/admin/me': if (!isAdmin()) throw Object.assign(new Error('no'), { status: 401 }); r = { ok: true }; break;
      case '/api/test/start': if (!isAdmin()) throw Object.assign(new Error('no'), { status: 401 }); r = game.testStart(new URL(path, 'http://x').searchParams.get('n')); break;
      case '/api/test/codes': if (!isAdmin()) throw Object.assign(new Error('no'), { status: 401 }); r = game.testCodes(); break;
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
