#!/usr/bin/env node
// Punto de entrada. Variables: PORT, HOST, DATA_DIR, ADMIN_PASSWORD, TRUST_PROXY=1, COOKIE_SECURE=1
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createApp } from './server/index.js';
import { pendingItems } from './server/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0';
const { server, store } = createApp({
  dataDir: process.env.DATA_DIR || path.join(here, 'data'),
  adminPassword: process.env.ADMIN_PASSWORD,
  trustProxy: process.env.TRUST_PROXY === '1',
  secureCookie: process.env.COOKIE_SECURE === '1',
});
server.listen(port, host, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  LA VENGANZA 2.0 — servidor en marcha');
  console.log(`  Juego:  http://localhost:${port}/`);
  console.log(`  Panel:  http://localhost:${port}/admin/`);
  lan.forEach((a) => console.log(`  (red local) http://${a}:${port}/`));
  if (store.newAdminPassword) {
    console.log('\n  ┌──────────────────────────────────────────────┐');
    console.log(`  │  CONTRASEÑA DEL PANEL (solo se muestra ahora) │`);
    console.log(`  │  ${store.newAdminPassword.padEnd(44)}│`);
    console.log('  └──────────────────────────────────────────────┘');
    console.log('  Cámbiala desde el panel → Ajustes. Si la pierdes: borra data/admin.json y reinicia.');
  }
  const pend = pendingItems(store.config);
  if (pend.length) console.log(`\n  ⚠  Quedan ${pend.length} elementos provisionales por revisar (panel → Resumen).`);
  console.log('  Nota: los medios y la configuración viven en la carpeta data/ (privada).\n');
});
