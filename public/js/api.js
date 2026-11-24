// Cliente de la API. Distingue "sin conexión" de errores del servidor para poder ayudar sin bloquear.
export class ApiError extends Error {
  constructor(msg, status, code, offline) { super(msg); this.status = status; this.code = code; this.offline = !!offline; }
}
export async function api(path, body, { method = 'POST', timeout = 9000 } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(path, {
      method, signal: ctl.signal, credentials: 'same-origin', cache: 'no-store',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    let j = null; try { j = await r.json(); } catch { /* respuesta sin cuerpo */ }
    if (!r.ok) throw new ApiError((j && j.error && j.error.message) || 'Error ' + r.status, r.status, j && j.error && j.error.code, false);
    return j;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Sin conexión con el servidor', 0, 'offline', true);
  } finally { clearTimeout(t); }
}
export const get = (p, o) => api(p, null, { method: 'GET', ...o });
