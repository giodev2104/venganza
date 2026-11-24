// Utilidades criptográficas y de normalización del servidor (sin dependencias).
import crypto from 'node:crypto';

export const rid = (n = 8) => crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, 'x').slice(0, n);

/** Token firmado: base64url(json).hmac. Sin estado: solo prueba que el servidor lo emitió. */
export function sign(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + mac;
}
export function verify(secret, token) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const i = token.indexOf('.');
  if (i < 1) return null;
  const body = token.slice(0, i), mac = token.slice(i + 1);
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
export function hmac(secret, text) { return crypto.createHmac('sha256', secret).update(text).digest('base64url'); }
export function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Texto libre → forma comparable: minúsculas, sin tildes ni puntuación, espacios colapsados. */
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
}
/** ¿Coincide la respuesta con alguna aceptada? Prefijo «*» = «contiene». */
export function matchText(answer, accepted) {
  const a = norm(answer);
  if (!a) return false;
  return (accepted || []).some((x) => {
    const loose = String(x).startsWith('*');
    const t = norm(loose ? String(x).slice(1) : x);
    if (!t) return false;
    return loose ? (' ' + a + ' ').includes(' ' + t + ' ') : a === t;
  });
}
/** Código físico: mayúsculas, sin espacios/guiones ni tildes. */
export const normCode = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s\-_.]/g, '');

/** Coordenadas/pistas: compara ignorando espacios y variantes de comillas. */
export function normCoord(s) {
  return String(s ?? '').normalize('NFKC').replace(/[′’‘`´]/g, "'").replace(/[″”“]/g, '"').replace(/''/g, '"').replace(/[ºo˚](?=\d)/gi, '°').replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
}
export function parseFloats(s) {
  const m = String(s ?? '').replace(/,(?=\d)/g, (c, off, str) => c).match(/-?\d+(?:[.,]\d+)?/g) || [];
  return m.map((x) => parseFloat(x.replace(',', '.')));
}

/** Decimal → grados/minutos/segundos con 1 decimal (formato del HTML original). */
export function toDMS(lat, lng) {
  const f = (v, pos, neg) => {
    const hemi = v >= 0 ? pos : neg; v = Math.abs(v);
    let d = Math.floor(v), mFull = (v - d) * 60, m = Math.floor(mFull), s = Math.round((mFull - m) * 60 * 10) / 10;
    if (s >= 60) { s = 0; m += 1; } if (m >= 60) { m = 0; d += 1; }
    return `${d}°${m}'${s.toFixed(1)}"${hemi}`;
  };
  return { lat: f(lat, 'N', 'S'), lng: f(lng, 'E', 'W') };
}

/** Contraseñas del panel: scrypt con sal propia. */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}
export function checkPassword(pw, rec) {
  if (!rec) return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(rec.salt, 'base64'), 64);
  const want = Buffer.from(rec.hash, 'base64');
  return hash.length === want.length && crypto.timingSafeEqual(hash, want);
}

/**
 * Cifrado del "paquete de revelación" con una clave derivada del código físico (PBKDF2 + AES-256-GCM).
 * Permite validar el código SIN cobertura (el cliente descifra con Web Crypto) sin que el contenido viaje en claro.
 * Seguridad real = entropía del código: recomendado ≥ 6 caracteres alfanuméricos.
 */
export const KDF_ITER = 150000;
export function encryptWithCode(code, obj) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(normCode(code), salt, KDF_ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()]);
  return { v: 1, it: KDF_ITER, s: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
}
export function decryptWithCode(code, blob) {
  const key = crypto.pbkdf2Sync(normCode(code), Buffer.from(blob.s, 'base64'), blob.it, 32, 'sha256');
  const raw = Buffer.from(blob.ct, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString('utf8'));
}

export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const clone = (o) => JSON.parse(JSON.stringify(o));
