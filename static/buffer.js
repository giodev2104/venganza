
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
