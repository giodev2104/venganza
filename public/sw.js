// Service worker de LA VENGANZA 2.0. El servidor sustituye __BUILD__ y __PRECACHE__ al servirlo,
// de modo que cada cambio en los ficheros genera una caché nueva y coherente.
const BUILD = '__BUILD__';
const PRECACHE = "__PRECACHE__";
const SHELL = 'venganza-shell-' + BUILD;
const MEDIA = 'venganza-media-v1';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    const list = Array.isArray(PRECACHE) ? PRECACHE : ['/'];
    await Promise.all(list.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('venganza-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/api/') || p.startsWith('/admin') || p === '/sw.js') return; // nunca se cachean: validación y panel
  if (p.startsWith('/media/')) { e.respondWith(mediaStrategy(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(navStrategy(req)); return; }
  e.respondWith(shellStrategy(req));
});

async function shellStrategy(req) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { return new Response('', { status: 504 }); }
}
async function navStrategy(req) {
  const c = await caches.open(SHELL);
  try { const r = await fetch(req); if (r.ok) c.put('/', r.clone()); return r; }
  catch { return (await c.match('/')) || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
}
// Medios firmados: la URL cambia (firma/caducidad) pero el fichero no; se cachean ignorando la query.
async function mediaStrategy(req) {
  const c = await caches.open(MEDIA), key = new Request(new URL(req.url).pathname);
  const hit = await c.match(key);
  if (hit && !req.headers.get('range')) return hit;
  try {
    const r = await fetch(req);
    if (r.status === 200) c.put(key, r.clone());
    return r;
  } catch { return hit || new Response('', { status: 504 }); }
}
