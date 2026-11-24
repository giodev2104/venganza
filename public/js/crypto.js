// Descifrado local del paquete de revelación con el código físico (PBKDF2 + AES-GCM, Web Crypto).
// Permite validar el código sin cobertura. Un código incorrecto falla la autenticación de AES-GCM.
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const normCode = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s\-_.]/g, '');
export async function decryptBlob(code, blob) {
  if (!blob || !crypto.subtle) throw new Error('no_crypto');
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(normCode(code)), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(blob.s), iterations: blob.it, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
