# LA VENGANZA 2.0 — gincana para Nixi (por Hugo)

PWA móvil (iPhone y Android) con servidor propio **sin dependencias** (solo Node ≥ 18) y panel de administración separado. Sin servicios de pago, sin CDNs: fuentes, iconos y QR van incluidos.

## Arranque rápido
```bash
node server.js            # http://localhost:3000  ·  panel: /admin/
```
La primera vez imprime **una contraseña de administrador aleatoria** (solo se muestra una vez). También puedes fijarla: `ADMIN_PASSWORD=... node server.js`.

Variables: `PORT`, `HOST`, `DATA_DIR` (por defecto `./data`), `ADMIN_PASSWORD`, `TRUST_PROXY=1` y `COOKIE_SECURE=1` (detrás de HTTPS).

## Dónde alojarlo
Necesita un proceso Node **y una carpeta persistente** (`data/`: configuración, fotos, clave, copias).
- **Recomendado:** un PC/Raspberry en casa + túnel gratuito HTTPS (Cloudflare Tunnel o Tailscale Funnel), o un VPS pequeño con Caddy/nginx para HTTPS. Docker: `docker build -t venganza . && docker run -p 3000:3000 -v venganza-data:/data -e ADMIN_PASSWORD=... venganza`.
- **HTTPS es obligatorio** para instalar la PWA, el service worker y la geolocalización.
- Hostings estáticos (GitHub Pages, Netlify) **no sirven**: las respuestas se validan en el servidor.

## Flujo de trabajo para Hugo
1. Abre `/admin/` → **Resumen**: lista exacta de lo provisional (regalos 1 y 2, ubicaciones, preguntas personales, fotos, audio/vídeo, carta, fecha del safari).
2. **Medios**: sube fotos/audio/vídeo (privados por defecto: solo accesibles con enlace firmado que caduca).
3. **Capítulos**: edita textos, pruebas, coordenadas (botón «Generar pistas desde lat/lng»), códigos físicos y regalo.
4. **Probar capítulo N** (modo pruebas, solo con tu sesión): salta pruebas, ve los códigos, empieza donde quieras; no toca la partida real.
5. Cuando termines: **Reiniciar progreso** (borra el avance en todos los dispositivos) y pásale el enlace.
6. **Códigos QR** opcionales para pegar junto a cada regalo (`/?k=CÓDIGO`).

El último regalo **no menciona ni insinúa nada** a menos que actives «Mostrar texto extra» (General) y escribas el texto en el capítulo 4.

## Seguridad y privacidad
- Respuestas, pistas y regalos viven en el servidor; el cliente solo recibe lo que ya ha desbloqueado (tokens HMAC encadenados). No hay contraseñas ni «base64» en el JS.
- Admin: contraseña con scrypt, cookie HttpOnly+SameSite=Strict, bloqueo tras 5 fallos, cabecera anti‑CSRF, CSP estricta.
- `data/` jamás se sirve por HTTP. Geolocalización opcional, local al móvil, con consentimiento.
- Copia de seguridad: `data/backups/` (30 rotativas) + Exportar desde el panel.

## Pruebas
`npm test` (API, 9 pruebas) · `npm run test:e2e` (Playwright + Chrome: partida real completa, panel, PWA).

## Versión estática para GitHub Pages (sin servidor)
```bash
node tools/build-static.mjs --config data/config.json --out dist-static
```
(`--config` es el `config.json` de tu carpeta `data/`, donde el panel guarda lo que editas; las fotos se cogen de `data/media/`.)
Sube el **contenido** de `dist-static/` a un repositorio de GitHub y activa Pages (Settings → Pages → Deploy from a branch → `main` / root). Funciona también en `usuario.github.io/repositorio/`.
**Ojo:** sin servidor no hay secretos. El motor del juego corre en el navegador, así que respuestas, códigos y fotos son accesibles para quien abra las herramientas del navegador o lea el repositorio. Para algo entre vosotros basta; no pongas nada que no quieras que se vea. No hay panel: edita con el panel en local (`node server.js`), y vuelve a ejecutar el comando de arriba para regenerar.
