# Informe de mejoras y limitaciones

## Fallos del original corregidos
| Original | Ahora |
|---|---|
| Cualquier par de textos valía como pista | Validación real en servidor; las coordenadas deben ensamblarse bien |
| «Autocompletar» saltaba las pruebas | Ayudas progresivas en 3 niveles; saltar no existe |
| Pista con dígitos/símbolo corruptos y distinta del enlace de Maps | Pistas generadas desde decimales (DMS) y enlace coherente |
| Imágenes de Discord (caducan) | Medios locales, privados con URL firmada |
| Contraseñas/respuestas en el JS (base64) | Todo en servidor |
| Bloqueo de F12 | Eliminado |
| Progreso perdido al recargar | Autoguardado en el dispositivo + recuperación |
| CDNs | Todo local (fuentes, iconos, QR) |
| Animaciones permanentes | Motor propio que solo corre cuando hace falta; modo ahorro; `prefers-reduced-motion` |
| `overflow:hidden` en móvil | Pantallas con scroll, safe-areas, objetivos táctiles ≥ 44 px |

## Verificado en navegador real (Chrome, 390×844 y 360×640)
- Partida real completa sin modo pruebas, resolviendo con la interfaz los 13 tipos de prueba, 4 capítulos, falso final y final romántico. Código físico erróneo rechazado; recarga a mitad de capítulo recuperada. 0 errores de consola.
- Panel: login, errores, edición, guardado, validación, subida de medios (privado a anónimos), QR con contenido, exportación, móvil sin desbordes.
- PWA: service worker, manifest, shell offline (con la configuración cacheada). Cabeceras de seguridad; `/data`, `/server` no accesibles.
- API: 9 pruebas automáticas (sin fugas, gating encadenado, anti-fuerza bruta, CSRF, rangos, traversal).

## Limitaciones (honestas)
- **No probado en iPhone/Android físicos** ni con instalación PWA real; solo emulación Chrome móvil. Pruébalo en tu móvil antes del día.
- Los minijuegos se superan en el cliente: el servidor exige un tiempo mínimo y valida los objetos, pero un jugador técnico podría reclamar la prueba. Lo protegido de verdad son el contenido y la ubicación.
- Hace falta conexión para comprobar respuestas y abrir cada capítulo; el código físico final sí se valida sin cobertura (cifrado con el propio código; usa ≥ 6 caracteres).
- Sonidos de animales **sintetizados** (aproximados): sube grabaciones reales en Medios.
- iPhone: la app instalada y Safari tienen almacenamiento separado; el QR abre Safari. Si usa la app instalada, que teclee el código.
- Radar GPS: dirección aproximada, no sustituye al mapa. Tras añadir una geolocalización, no hay interacción necesaria con el móvil al conducir (aviso incluido).
- Sin pruebas de carga ni auditoría externa de seguridad. El panel está pensado para un solo administrador.

## Pendiente de personalizar (todo marcado `[EDITAR]`/provisional)
Regalos 1 y 2, ubicaciones de los 4 regalos (ahora puntos de relleno de Madrid), preguntas personales y fotos, audio/vídeo del capítulo 4, carta final, fecha del safari y los 4 códigos físicos (ahora HUGO01–04).
