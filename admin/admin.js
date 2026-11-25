// Panel de administración. Todo se edita sobre una copia de la configuración y solo se publica al pulsar «Guardar».
const _ap = Element.prototype.append;
Element.prototype.append = function (...a) { return _ap.apply(this, a.filter((x) => x != null && x !== false)); };
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const root = $('#root');

// ───────── API ─────────
import { api as rawApi, MODE, LOGIN, exportCfg } from './backend.js';
async function api(path, opts) {
  try { return await rawApi(path, opts); }
  catch (e) { if (e.status === 401 && !String(path).includes('/login')) showLogin(); throw e; }
}
function toast(text, kind = 'ok', ms = 3200) { const t = h('div', { class: 'toast ' + kind, role: 'status' }, text); document.body.append(t); setTimeout(() => t.remove(), ms); }
function modal(title, body, actions) {
  const bg = h('div', { class: 'modal-bg', onclick: (e) => e.target === bg && bg.remove() }), m = h('div', { class: 'modal', role: 'dialog', 'aria-label': title }, h('h3', null, title), body, h('div', { class: 'row end' }, actions));
  bg.append(m); document.body.append(bg); return { close: () => bg.remove() };
}
const confirmBox = (title, text, okLabel = 'Aceptar') => new Promise((res) => { const mo = modal(title, h('p', null, text), [h('button', { class: 'btn', onclick: () => { mo.close(); res(false); } }, 'Cancelar'), h('button', { class: 'btn pri', onclick: () => { mo.close(); res(true); } }, okLabel)]); });

// ───────── Estado ─────────
const S = { cfg: null, snap: '', defaults: null, validation: { errors: [], warnings: [], pending: [] }, tab: 'resumen', ch: 0, open: new Set() };
const isDirty = () => S.cfg && JSON.stringify(S.cfg) !== S.snap;
let touchT = 0;
function touch() { clearTimeout(touchT); touchT = setTimeout(updateBar, 120); }
function updateBar() { const c = $('#dirtychip'); if (!c) return; const d = isDirty(); c.textContent = d ? 'Cambios sin guardar' : 'Todo guardado'; c.className = 'chip ' + (d ? 'dirty' : 'clean'); $('#savebtn').disabled = !d; }
addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

async function load() {
  const d = await api('/api/admin/config');
  S.cfg = d.config; S.snap = JSON.stringify(d.config); S.defaults = d.defaults; S.validation = d.validation;
}
async function save() {
  try {
    const r = await api('/api/admin/config', { method: 'PUT', body: { config: S.cfg } });
    S.snap = JSON.stringify(S.cfg); S.validation = r.validation; toast('Guardado en GitHub: se verá en el juego en 1–2 minutos.', 'ok', 6000); render();
  } catch (e) {
    if (e.data && e.data.validation) { S.validation = e.data.validation; S.tab = 'resumen'; render(); toast('No se ha guardado: hay errores', 'bad', 5000); } else toast(e.message, 'bad');
  }
}

// ───────── Constructores de campos ─────────
const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 7);
function field(label, input, hint) { return h('div', { class: 'fld' }, h('label', null, label), input, hint ? h('span', { class: 'hint' }, hint) : null); }
function text(o, k, label, { hint, ph, area, rows = 3, mono, type = 'text' } = {}) {
  const el = area ? h('textarea', { rows, placeholder: ph || '' }) : h('input', { type, placeholder: ph || '', autocomplete: 'off', spellcheck: 'false' });
  el.value = o[k] ?? ''; if (mono) el.classList.add('mono');
  el.addEventListener('input', () => { o[k] = type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; touch(); });
  return field(label, el, hint);
}
const num = (o, k, label, opts = {}) => text(o, k, label, { ...opts, type: 'number' });
function check(o, k, label, hint) {
  const el = h('input', { type: 'checkbox', checked: !!o[k] }); el.addEventListener('change', () => { o[k] = el.checked; touch(); });
  return h('div', { class: 'fld' }, h('label', { class: 'chk' }, el, label), hint ? h('span', { class: 'hint' }, hint) : null);
}
function select(o, k, label, options, { hint, onchange } = {}) {
  const el = h('select', null, options.map(([v, t]) => h('option', { value: v, selected: String(o[k] ?? '') === String(v) }, t)));
  el.addEventListener('change', () => { o[k] = el.value; touch(); onchange && onchange(); }); return field(label, el, hint);
}
/** Lista de cadenas editable. */
function strList(arr, { label, ph, area, min = 0, hint, add = 'Añadir' } = {}) {
  const box = h('div', { class: 'list' });
  const draw = () => {
    box.textContent = '';
    arr.forEach((v, i) => {
      const el = area ? h('textarea', { rows: 2, placeholder: ph || '' }) : h('input', { type: 'text', placeholder: ph || '' }); el.value = v;
      el.addEventListener('input', () => { arr[i] = el.value; touch(); });
      box.append(h('div', { class: 'srow' }, el, h('button', { class: 'btn sm', title: 'Subir', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); touch(); } }, '↑'), h('button', { class: 'btn sm danger', title: 'Quitar', disabled: arr.length <= min, onclick: () => { arr.splice(i, 1); draw(); touch(); } }, '✕')));
    });
    box.append(h('div', null, h('button', { class: 'btn sm', onclick: () => { arr.push(''); draw(); touch(); } }, '+ ' + add)));
  };
  draw(); return h('div', { class: 'fld' }, label ? h('span', { class: 'lab' }, label) : null, box, hint ? h('span', { class: 'hint' }, hint) : null);
}
/** Lista de objetos con tarjetas desplegables. */
function objList(arr, { title, make, render, tags, min = 0, add = 'Añadir', open = false, key }) {
  const box = h('div', { class: 'list' });
  const draw = () => {
    box.textContent = '';
    arr.forEach((it, i) => {
      const id = key ? key(it, i) : null, isOpen = id ? S.open.has(id) : open;
      const det = h('div', { class: 'ib', hidden: !isOpen }), head = h('div', { class: 'ih' });
      const toggle = () => { det.hidden = !det.hidden; if (id) det.hidden ? S.open.delete(id) : S.open.add(id); if (!det.hidden && !det.childElementCount) det.append(...render(it, i, draw)); };
      if (isOpen) det.append(...render(it, i, draw));
      head.append(h('button', { class: 'btn sm', onclick: toggle, 'aria-label': 'Abrir o cerrar' }, '▾'), h('span', { class: 't' }, title(it, i)), ...(tags ? tags(it) : []),
        h('button', { class: 'btn sm', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); touch(); } }, '↑'),
        h('button', { class: 'btn sm', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); touch(); } }, '↓'),
        h('button', { class: 'btn sm danger', disabled: arr.length <= min, onclick: async () => { if (await confirmBox('Quitar elemento', '¿Seguro que quieres quitarlo?', 'Quitar')) { arr.splice(i, 1); draw(); touch(); } } }, '✕'));
      box.append(h('div', { class: 'item' }, head, det));
    });
    box.append(h('div', null, h('button', { class: 'btn sm', onclick: () => { arr.push(make()); draw(); touch(); } }, '+ ' + add)));
  };
  draw(); return box;
}
const sec = (title, lead, ...kids) => h('section', { class: 'sec' }, h('h2', null, title), lead ? h('p', { class: 'lead' }, lead) : null, ...kids);

// Selector de medios con subida
const mediaUrl = (m) => (m.builtin ? '../assets/' + m.file : '../media/' + m.file);
function mediaPick(o, k, label, kinds, { hint } = {}) {
  const wrap = h('div', { class: 'pick' }), file = h('input', { type: 'file', hidden: true });
  const draw = () => {
    wrap.textContent = '';
    const list = S.cfg.media.filter((m) => kinds.includes(m.kind));
    const sel = h('select', null, h('option', { value: '' }, '— ninguno —'), list.map((m) => h('option', { value: m.id, selected: o[k] === m.id }, m.label + (m.builtin ? ' · provisional' : ''))));
    sel.addEventListener('change', () => { o[k] = sel.value; touch(); draw(); });
    const cur = S.cfg.media.find((m) => m.id === o[k]);
    wrap.append(cur && cur.kind === 'image' ? h('img', { src: mediaUrl(cur), alt: '' }) : null, sel, h('button', { class: 'btn sm', onclick: () => file.click() }, 'Subir…'), file);
  };
  file.accept = kinds.includes('image') ? 'image/*' : kinds.includes('video') ? 'audio/*,video/*' : 'audio/*';
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    try { const item = await uploadMedia(f); o[k] = item.id; touch(); draw(); toast('Archivo subido'); } catch (e) { toast(e.message, 'bad', 5000); } file.value = '';
  });
  draw(); return field(label, wrap, hint);
}
async function uploadMedia(f, visibility = 'gated') {
  const r = await api(`/api/admin/media?name=${encodeURIComponent(f.name)}&label=${encodeURIComponent(f.name.replace(/\.[^.]+$/, ''))}&visibility=${visibility}`, { method: 'POST', raw: f, headers: { 'content-type': 'application/octet-stream' } });
  S.cfg.media.push(clone(r.item)); const snap = JSON.parse(S.snap); snap.media.push(clone(r.item)); S.snap = JSON.stringify(snap); return r.item;
}

// ───────── Pestañas ─────────
const dms = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), s = ((mf - m) * 60).toFixed(1); return `${d}°${m}'${s}"${v >= 0 ? p : n}`; };

function tabResumen() {
  const V = S.validation, nodes = [];
  const pend = V.pending || [];
  nodes.push(sec('Estado', 'Esto es lo que falta para que el juego esté listo.',
    V.errors.length ? h('div', { class: 'msg bad' }, h('b', null, `${V.errors.length} error(es) que impiden guardar`), h('ul', null, V.errors.map((e) => h('li', null, e)))) : h('div', { class: 'msg ok' }, 'Sin errores de configuración.'),
    V.warnings.length ? h('div', { class: 'msg warn' }, h('b', null, `${V.warnings.length} aviso(s)`), h('ul', null, V.warnings.map((e) => h('li', null, e)))) : null,
    pend.length ? h('div', { class: 'msg warn' }, h('b', null, `${pend.length} elemento(s) provisional(es) por personalizar`), h('ul', null, pend.map((e) => h('li', null, e)))) : h('div', { class: 'msg ok' }, 'No quedan elementos provisionales.')));
  nodes.push(sec('Probar el juego', 'El modo pruebas solo funciona con tu sesión de administrador: salta pruebas, ve los códigos y empieza en cualquier capítulo. No toca la partida real.',
    h('div', { class: 'row' }, [1, 2, 3, 4].filter((n) => S.cfg.chapters.some((c) => c.n === n)).map((n) => h('a', { class: 'btn', href: `../?test=${n}`, target: '_blank', rel: 'noopener' }, `Probar capítulo ${n}`)), h('a', { class: 'btn pri', href: '../', target: '_blank', rel: 'noopener' }, 'Abrir el juego'))));
  // QR
  const qrList = h('div', { class: 'list' });
  S.cfg.chapters.forEach((c) => {
    const cv = h('canvas', { width: 150, height: 150, 'aria-label': 'QR del capítulo ' + c.n });
    const url = `${new URL("../", location.href).href}?k=${encodeURIComponent(c.physicalCode)}`;
    const draw = () => { try { const q = qrcode(0, 'M'); q.addData(`${new URL("../", location.href).href}?k=${encodeURIComponent(c.physicalCode)}`); q.make(); const n = q.getModuleCount(), g = cv.getContext('2d'), s = 150 / n; g.fillStyle = '#fff'; g.fillRect(0, 0, 150, 150); g.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(k * s, r * s, Math.ceil(s), Math.ceil(s)); } catch { /* texto demasiado largo */ } };
    draw();
    qrList.append(h('div', { class: 'item' }, h('div', { class: 'ib', style: { borderTop: 0 } }, h('div', { class: 'qr-box' }, cv, h('div', { class: 'list' }, h('b', null, `Capítulo ${c.n} · ${c.title}`), h('span', { class: 'small muted mono', style: { wordBreak: 'break-all' } }, url), h('div', { class: 'row' }, h('a', { class: 'btn sm', href: '#', onclick: (e) => { e.preventDefault(); const a = h('a', { href: cv.toDataURL('image/png'), download: `qr-capitulo-${c.n}.png` }); a.click(); } }, 'Descargar PNG')))))));
  });
  nodes.push(sec('Códigos QR (opcional)', 'Imprímelos y pégalos junto a cada regalo: al escanearlos, el móvil abre el juego con el código ya escrito. Quien tenga el QR tiene el código: ponlo solo en el sitio físico. Ojo: en iPhone, si ella usa la app instalada en la pantalla de inicio, el QR abre Safari (otro almacenamiento) y el progreso no se comparte; en ese caso basta con teclear el código.', qrList));
  // Datos
  const imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  imp.addEventListener('change', async () => {
    const f = imp.files[0]; if (!f) return; if (!await confirmBox('Importar configuración', 'Esto reemplaza TODA la configuración actual (se guarda antes una copia automática). ¿Continuar?', 'Importar')) return;
    try { const body = JSON.parse(await f.text()); await api('/api/admin/import', { method: 'POST', body }); await load(); render(); toast('Importado'); } catch (e) { toast(e.message || 'Archivo no válido', 'bad', 5000); } imp.value = '';
  });
  nodes.push(sec('Copias y reinicio', 'La configuración vive en la carpeta data/ del servidor, con copias automáticas. Aquí puedes exportarla o restaurarla.',
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => exportCfg(S.cfg, false) }, 'Exportar configuración'), MODE === 'static' ? null : h('button', { class: 'btn', onclick: () => exportCfg(S.cfg, true) }, 'Exportar con archivos'), h('button', { class: 'btn', onclick: () => imp.click() }, 'Importar…'), imp,
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Reiniciar el progreso de TODOS los dispositivos', 'Ella empezará desde cero en cuanto abra el juego. Úsalo después de probar. ¿Seguro?', 'Reiniciar')) { await api('/api/admin/reset-progress', { method: 'POST', body: {} }); toast('Progreso reiniciado'); } } }, 'Reiniciar progreso'))));
  // Contraseña
  const cur = h('input', { type: 'password', autocomplete: 'current-password' }), nw = h('input', { type: 'password', autocomplete: 'new-password' });
  if (MODE === 'static') nodes.push(sec('Cuenta', 'Tu acceso es el token de GitHub guardado solo en este navegador.', h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { await api('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {}); showLogin(); } }, 'Cerrar sesión y olvidar el token'))));
  else nodes.push(sec('Cuenta', 'La contraseña se guarda cifrada en el servidor (nunca en el navegador).', h('div', { class: 'grid2' }, field('Contraseña actual', cur), field('Nueva contraseña (mín. 8)', nw)),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { try { await api('/api/admin/password', { method: 'POST', body: { current: cur.value, next: nw.value } }); cur.value = nw.value = ''; toast('Contraseña cambiada'); } catch (e) { toast(e.message, 'bad'); } } }, 'Cambiar contraseña'), h('button', { class: 'btn', onclick: async () => { await api('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {}); showLogin(); } }, 'Cerrar sesión'))));
  return nodes;
}

function tabGeneral() {
  const c = S.cfg, s = c.settings;
  return [
    sec('Identidad', null, h('div', { class: 'grid2' }, text(c.meta, 'title', 'Título'), text(c.meta, 'subtitle', 'Subtítulo'), text(c.meta, 'playerName', 'Nombre de ella'), text(c.meta, 'hostName', 'Tu nombre'))),
    sec('Introducción', 'Primero aparecen las líneas cortas, luego el título y por último los párrafos.',
      strList(c.intro.lines, { label: 'Líneas iniciales (aparecen una a una)', ph: 'Una línea corta' }),
      strList(c.intro.paragraphs, { label: 'Párrafos', area: true, ph: 'Texto' }),
      h('div', { class: 'grid2' }, text(c.intro, 'button', 'Texto del botón'), text(c.intro, 'small', 'Letra pequeña'))),
    (() => { const sch = s.schedule || (s.schedule = { enabled: false, timezone: 'Europe/Madrid', startAt: '', dailyTime: '18:30' });
      return sec('Calendario de desbloqueo', 'Hora de Madrid. Antes de la fecha de inicio solo se ve una cuenta atrás. Después de terminar un regalo, el siguiente se abre al día siguiente a la hora indicada. Tú, en modo pruebas, no tienes esperas.',
        check(sch, 'enabled', 'Activar calendario'), h('div', { class: 'grid2' }, text(sch, 'startAt', 'Se abre el primer regalo (fecha y hora)', { type: 'datetime-local' }), text(sch, 'dailyTime', 'Cada regalo siguiente se abre a las', { type: 'time' }))); })(),
    sec('Dificultad y ayudas', 'Nada bloquea nunca: las ayudas suben de nivel hasta que la última da la respuesta.',
      h('div', { class: 'grid2' },
        select(s, 'difficulty', 'Dificultad', [['easy', 'Fácil (ayudas antes)'], ['normal', 'Normal'], ['hard', 'Difícil (ayudas más tarde)']]),
        num(s, 'hintAfterFails', 'Sugerir ayuda tras N fallos'), num(s, 'hintDelaySec', 'Sugerir ayuda tras N segundos'), num(s, 'wrongOverlayEvery', 'Pantalla de «fallo» a pantalla completa cada N fallos', { hint: 'El resto de fallos se avisan con un mensaje corto.' }))),
    sec('Opciones', null,
      check(s, 'geolocation', 'Permitir radar de distancia (con permiso explícito de ella)', 'Se calcula en su móvil; la ubicación no se envía a ningún sitio.'),
      check(s, 'hideFinalChapterUntilFakeEnding', 'Ocultar el último capítulo hasta el falso final', 'Si lo desactivas, verá desde el principio que hay un cuarto regalo.'),
      check(s, 'ringReferenceEnabled', 'Mostrar el texto del último regalo (campo «Texto extra del final» del capítulo 4)', 'Desactivado por defecto: la aplicación NUNCA sugiere nada hasta que tú lo actives.')),
    sec('Minijuegos activos', 'Si desactivas un tipo, sus pruebas se saltan automáticamente.',
      h('div', { class: 'grid2' }, Object.keys(s.minigames).map((k) => check(s.minigames, k, ({ memory: 'Memoria', jigsaw: 'Puzzle de foto', runner: 'Conducción', runaway: 'Botón escurridizo', sequence: 'Secuencia de sonidos', hidden: 'Objetos ocultos', scratch: 'Rascar', pixel: 'Foto pixelada', order: 'Ordenar', safe: 'Caja fuerte' })[k] || k)))),
    sec('Fotos rebotantes', 'Aparecen solo en momentos concretos (intro, trolleos, la interrupción del falso final).', bounceEditor(s)),
  ];
}
function bounceEditor(s) {
  const imgs = S.cfg.media.filter((m) => m.kind === 'image'), box = h('div', { class: 'media-grid' });
  imgs.forEach((m) => { const on = (s.bouncerMedia || []).includes(m.id); const ck = h('input', { type: 'checkbox', checked: on }); ck.addEventListener('change', () => { s.bouncerMedia = (s.bouncerMedia || []).filter((x) => x !== m.id); if (ck.checked) s.bouncerMedia.push(m.id); touch(); }); box.append(h('label', { class: 'mcard', style: { cursor: 'pointer' } }, h('div', { class: 'pv' }, h('img', { src: mediaUrl(m), alt: '' })), h('div', { class: 'mb' }, h('span', { class: 'chk' }, ck, m.label)))); });
  return box;
}

function tabTextos() {
  const c = S.cfg, t = c.trolls, f = c.fakeEnding;
  return [
    sec('Mensajes de fallo (trolleo)', 'Se eligen al azar cuando se falla una respuesta. Mantén el tono: gracioso, nunca cruel.', objList(t.wrong, { title: (m) => m.title || 'Mensaje', make: () => ({ title: 'NI DE COÑA', text: 'Eso no era.' }), min: 1, add: 'Añadir mensaje', render: (m) => [h('div', { class: 'grid2' }, text(m, 'title', 'Título'), text(m, 'text', 'Texto', { area: true }))], key: (m) => 'w' + t.wrong.indexOf(m) })),
    sec('Mensaje de ayuda tras varios fallos', null, h('div', { class: 'grid2' }, text(t.helper, 'title', 'Título'), text(t.helper, 'text', 'Texto', { area: true }))),
    sec('Frases al acertar', null, strList(t.cheer, { ph: '¡Eso es!', min: 1 })),
    sec('Ayudas genéricas', 'Se usan cuando una prueba no tiene ayudas propias.', strList(t.hintGeneric, { area: true, ph: 'Pista' })),
    sec('Logros', 'Se desbloquean automáticamente (los identificadores no se pueden cambiar). El icono es un nombre de la biblioteca (trophy, heart, key…).', objList(c.achievements, { title: (a) => a.title, make: () => ({ id: uid('a_'), title: 'Nuevo logro', desc: '', icon: 'trophy' }), render: (a) => [h('div', { class: 'grid2' }, text(a, 'title', 'Título'), text(a, 'icon', 'Icono'), text(a, 'desc', 'Descripción', { area: true })), h('span', { class: 'small muted mono' }, 'id: ' + a.id)], key: (a) => 'a' + a.id })),
    sec('Falso final', 'Despedida y créditos de mentira; después viene la interrupción.',
      h('div', { class: 'grid2' }, text(f, 'title', 'Título'), text(f, 'end', 'Texto final de los créditos')), text(f, 'farewell', 'Despedida', { area: true }),
      objList(f.credits, { title: (x) => `${x.role}: ${x.name}`, make: () => ({ role: 'Rol', name: 'Nombre' }), add: 'Añadir crédito', render: (x) => [h('div', { class: 'grid2' }, text(x, 'role', 'Rol'), text(x, 'name', 'Nombre'))], key: (x) => 'cr' + f.credits.indexOf(x) }),
      h('div', { class: 'grid2' }, text(f.interrupt, 'line1', 'Interrupción · línea 1'), text(f.interrupt, 'line2', 'Interrupción · línea 2', { area: true }), text(f.interrupt, 'button', 'Botón'))),
  ];
}

// ───────── Capítulos y pruebas ─────────
const ICONS = ['heart', 'star', 'key', 'car', 'paw-print', 'moon', 'sun', 'coffee', 'camera', 'music', 'gift', 'flame', 'crown', 'cat', 'bird', 'rabbit', 'trophy', 'ticket'];
const SYNTH = [['', '— ninguno —'], ...['leon', 'elefante', 'mono', 'lobo', 'loro', 'serpiente', 'pajaro', 'hiena'].map((a) => ['synth:' + a, 'Sonido sintetizado: ' + a])];
const TYPE_NAMES = { quiz: 'Preguntas', troll: 'Trolleo', runner: 'Conducción', runaway: 'Botón escurridizo', order: 'Ordenar', pixel: 'Foto pixelada', safe: 'Caja fuerte', memory: 'Memoria', jigsaw: 'Puzzle de foto', sequence: 'Secuencia de sonidos', scratch: 'Rascar', hidden: 'Objetos ocultos', media: 'Audio / vídeo' };
const TEMPLATES = {
  quiz: () => ({ rounds: [newRound()] }),
  troll: () => ({ kind: 'fakeError', heading: 'ERROR CRÍTICO', text: 'Algo ha ido mal. Probablemente tú.', twist: 'Era broma.', button: 'Continuar', photo: false }),
  runner: () => ({ prompt: 'Recoge corazones y esquiva los conos.', target: 8, revealText: '' }),
  runaway: () => ({ prompt: 'Pulsa el botón.', buttonText: 'Pulsar', dodges: 5, taunts: ['Casi…', 'Vale, me cansé'], revealText: '' }),
  order: () => ({ prompt: '[EDITAR] Ordena estos recuerdos.', items: [{ id: 'i1', text: 'Primero' }, { id: 'i2', text: 'Segundo' }, { id: 'i3', text: 'Tercero' }] }),
  pixel: () => ({ prompt: '[EDITAR] ¿Qué es esta foto?', image: 'mystery', accepted: ['respuesta'], placeholder: '¿Qué es?' }),
  safe: () => ({ prompt: '[EDITAR] Introduce el código.', digits: 4, code: '0000', codeSource: 'fixed' }),
  memory: () => ({ prompt: 'Encuentra las parejas.', pairs: ['heart', 'star', 'key', 'moon', 'sun', 'coffee'].map((i, k) => ({ id: 'p' + (k + 1), icon: i })), revealText: '' }),
  jigsaw: () => ({ prompt: 'Recompón la foto.', image: 'photo-us', grid: 3, revealText: '' }),
  sequence: () => ({ prompt: 'Repite la secuencia.', length: 5, pads: ['leon', 'elefante', 'mono', 'lobo'].map((a) => ({ id: a, label: a[0].toUpperCase() + a.slice(1), sound: 'synth:' + a })), revealText: '' }),
  scratch: () => ({ prompt: 'Rasca para descubrir el mensaje.', revealText: 'Mensaje oculto' }),
  hidden: () => ({ prompt: 'Encuentra los objetos ocultos.', scene: 'night', hotspots: [{ id: 'h1', x: 20, y: 30, label: 'Estrella' }, { id: 'h2', x: 60, y: 50, label: 'Estrella' }, { id: 'h3', x: 80, y: 20, label: 'Estrella' }], revealText: '' }),
  media: () => ({ prompt: 'Dale al play.', media: '', requirePlay: false, caption: '' }),
};
function newRound() { return { id: uid('r'), kind: 'choice', prompt: '[EDITAR] Pregunta', subtitle: '', options: [{ id: 'a', text: 'Respuesta correcta', correct: true }, { id: 'b', text: 'Otra opción', correct: false }, { id: 'c', text: 'Otra más', correct: false }], accepted: [], placeholder: '', allWrongFirst: 0, sound: '', image: '', explain: '' }; }

function roundEditor(r, redraw) {
  const nodes = [select(r, 'kind', 'Tipo de respuesta', [['choice', 'Opción múltiple'], ['text', 'Texto escrito']], { onchange: redraw }), text(r, 'prompt', 'Pregunta', { area: true, hint: 'Con salto de línea, la segunda línea se muestra destacada (útil para acertijos).' }), text(r, 'subtitle', 'Subtítulo (opcional)')];
  if (r.kind === 'choice') nodes.push(field('Opciones (marca la correcta)', objListOptions(r)));
  else nodes.push(strList(r.accepted, { label: 'Respuestas aceptadas', ph: 'corazon', hint: 'Se ignoran mayúsculas, tildes y signos. Empieza con * para aceptar cualquier respuesta que lo contenga.', min: 1 }), text(r, 'placeholder', 'Texto de ejemplo en el campo'));
  nodes.push(h('div', { class: 'grid2' }, mediaPick(r, 'image', 'Imagen (opcional)', ['image']), soundPick(r)), h('div', { class: 'grid2' }, num(r, 'allWrongFirst', 'Troleo «todo parece mal»: nº de intentos en que se rechaza aunque sea correcta', { hint: '0 = desactivado. Con 1, el primer intento se rechaza con un mensaje gracioso aunque acierte.' }), text(r, 'explain', 'Texto tras acertar (opcional)', { area: true })));
  return nodes;
}
function soundPick(r) { const wrap = h('div'), draw = () => { wrap.textContent = ''; const synth = !r.sound || String(r.sound).startsWith('synth:'); wrap.append(select(r, 'sound', 'Sonido de la pregunta', [...SYNTH, ...S.cfg.media.filter((m) => m.kind === 'audio').map((m) => [m.id, 'Audio: ' + m.label])], { hint: 'Los sonidos sintetizados son aproximaciones; sube grabaciones reales en la pestaña Medios para algo más realista.' })); void synth; }; draw(); return wrap; }
function objListOptions(r) {
  const box = h('div', { class: 'list' }), draw = () => {
    box.textContent = '';
    r.options.forEach((o, i) => {
      const rad = h('input', { type: 'radio', name: 'c' + r.id, checked: !!o.correct, title: 'Correcta' }); rad.addEventListener('change', () => { r.options.forEach((x) => (x.correct = x === o)); touch(); });
      const inp = h('input', { type: 'text', value: o.text }); inp.addEventListener('input', () => { o.text = inp.value; touch(); });
      box.append(h('div', { class: 'opt' }, rad, inp, h('button', { class: 'btn sm danger', disabled: r.options.length <= 2, onclick: () => { r.options.splice(i, 1); if (!r.options.some((x) => x.correct)) r.options[0].correct = true; draw(); touch(); } }, '✕')));
    });
    box.append(h('div', null, h('button', { class: 'btn sm', onclick: () => { r.options.push({ id: String.fromCharCode(97 + r.options.length) + uid(''), text: 'Nueva opción', correct: false }); draw(); touch(); } }, '+ Opción')));
  }; draw(); return box;
}

const TYPE_EDITORS = {
  quiz: (t) => [objList(t.rounds, { title: (r, i) => `Pregunta ${i + 1}: ${(r.prompt || '').split('\n')[0].slice(0, 60)}`, make: newRound, min: 1, add: 'Añadir pregunta', render: (r, i, redraw) => roundEditor(r, redraw), key: (r) => 'q' + r.id })],
  troll: (t, redraw) => [select(t, 'kind', 'Clase de trolleo', [['fakeVictory', 'Falsa victoria'], ['fakeError', 'Falso error'], ['fakeGift', 'Falso regalo'], ['photo', 'Foto sorpresa'], ['message', 'Mensaje']]), h('div', { class: 'grid2' }, text(t, 'heading', 'Titular'), text(t, 'button', 'Botón')), text(t, 'text', 'Texto', { area: true }), text(t, 'twist', 'Giro final', { area: true }), check(t, 'photo', 'Lanzar fotos rebotantes')],
  runner: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), num(t, 'target', 'Corazones a recoger'), text(t, 'revealText', 'Texto al terminar', { area: true })],
  runaway: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), h('div', { class: 'grid2' }, text(t, 'buttonText', 'Texto del botón'), num(t, 'dodges', 'Veces que se escapa')), strList(t.taunts, { label: 'Burlas (una por escapada; la última, al rendirse)', min: 1 }), text(t, 'revealText', 'Texto al terminar', { area: true })],
  order: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), field('Elementos en el ORDEN CORRECTO (en el juego aparecen mezclados)', objList(t.items, { title: (i) => i.text, make: () => ({ id: uid('i'), text: 'Nuevo' }), min: 2, add: 'Añadir elemento', open: true, render: (i) => [text(i, 'text', 'Texto')], key: (i) => 'it' + i.id }))],
  pixel: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), mediaPick(t, 'image', 'Foto misteriosa', ['image']), strList(t.accepted, { label: 'Respuestas aceptadas', min: 1, hint: 'Sin tildes ni mayúsculas.' }), text(t, 'placeholder', 'Texto de ejemplo')],
  safe: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), h('div', { class: 'grid2' }, num(t, 'digits', 'Nº de cifras'), select(t, 'codeSource', 'Origen del código', [['fixed', 'Código fijo'], ['keyDigits', 'Cifras-llave de los regalos 1, 2 y 3 (en orden)']])), text(t, 'code', 'Código fijo', { mono: true, hint: 'Solo si el origen es «fijo».' })],
  memory: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), field('Parejas (icono de la biblioteca o foto propia)', objList(t.pairs, { title: (p) => p.image ? 'Foto: ' + p.image : p.icon, make: () => ({ id: uid('p'), icon: 'heart' }), min: 2, add: 'Añadir pareja', render: (p) => [h('datalist', { id: 'icons' }, ICONS.map((i) => h('option', { value: i }))), h('div', { class: 'grid2' }, field('Icono', Object.assign(h('input', { type: 'text', list: 'icons', value: p.icon || '' }), { oninput() { p.icon = this.value; touch(); } })), mediaPick(p, 'image', 'Foto (sustituye al icono)', ['image']))], key: (p) => 'pr' + p.id })), text(t, 'revealText', 'Texto al terminar', { area: true })],
  jigsaw: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), mediaPick(t, 'image', 'Foto del puzzle', ['image']), select(t, 'grid', 'Tamaño', [[2, '2×2'], [3, '3×3'], [4, '4×4']]), text(t, 'revealText', 'Texto al terminar', { area: true })],
  sequence: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), num(t, 'length', 'Longitud de la secuencia'), field('Botones (máx. 4)', objList(t.pads, { title: (p) => p.label, make: () => ({ id: uid('p'), label: 'Botón', sound: '' }), min: 2, add: 'Añadir botón', render: (p) => [text(p, 'label', 'Etiqueta'), soundPick(p)], key: (p) => 'pd' + p.id })), text(t, 'revealText', 'Texto al terminar', { area: true })],
  scratch: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), text(t, 'revealText', 'Mensaje oculto', { area: true })],
  hidden: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), select(t, 'scene', 'Escena', [['night', 'Noche estrellada'], ['savanna', 'Sabana']]), field('Puntos ocultos (posición en % de la imagen)', objList(t.hotspots, { title: (p) => `${p.label} (${p.x}%, ${p.y}%)`, make: () => ({ id: uid('h'), x: 50, y: 50, label: 'Objeto' }), min: 1, add: 'Añadir punto', render: (p) => [h('div', { class: 'grid2' }, text(p, 'label', 'Nombre'), num(p, 'x', 'X (0–100)'), num(p, 'y', 'Y (0–100)'))], key: (p) => 'hp' + p.id })), text(t, 'revealText', 'Texto al terminar', { area: true })],
  media: (t) => [text(t, 'prompt', 'Enunciado', { area: true }), mediaPick(t, 'media', 'Audio o vídeo', ['audio', 'video'], { hint: 'Si no hay ninguno, el juego muestra un aviso provisional.' }), text(t, 'caption', 'Texto bajo el reproductor'), check(t, 'requirePlay', 'Obligar a reproducirlo entero antes de continuar')],
};

function taskEditor(ch, t) {
  const rw = t.reward || (t.reward = { fragment: 0, item: null, achievement: '', text: '' });
  const frag = select(rw, 'fragment', 'Pista de coordenada que entrega (1 o 2)', [[0, 'Ninguna (la reparte el sistema)'], [1, 'Pista 1'], [2, 'Pista 2']], { hint: 'Las pistas sin asignar se entregan en la última prueba.' });
  frag.querySelector('select').addEventListener('change', (e) => { rw.fragment = Number(e.target.value); });
  const hasItem = h('input', { type: 'checkbox', checked: !!rw.item }), itemBox = h('div', { class: 'grid2', hidden: !rw.item });
  const drawItem = () => { itemBox.textContent = ''; if (rw.item) itemBox.append(text(rw.item, 'label', 'Nombre del objeto'), text(rw.item, 'text', 'Texto del objeto')); itemBox.hidden = !rw.item; };
  hasItem.addEventListener('change', () => { rw.item = hasItem.checked ? { id: uid('it_'), label: 'Objeto', text: '' } : null; drawItem(); touch(); }); drawItem();
  return [
    h('div', { class: 'grid2' }, text(t, 'title', 'Nombre interno'), text(t, 'kicker', 'Etiqueta visible')),
    text(t, 'intro', 'Introducción (opcional)', { area: true }), text(t, 'callout', 'Aviso destacado (opcional)', { area: true }),
    ...TYPE_EDITORS[t.type](t),
    strList(t.hints || (t.hints = []), { label: 'Ayudas progresivas (de más sutil a más clara; la última puede dar la respuesta)', area: true, ph: 'Ayuda', hint: 'Se piden con el botón «Necesito ayuda». Si no pones ninguna se usan las genéricas.' }),
    h('div', { class: 'fld' }, h('span', { class: 'lab' }, 'Recompensa'), h('div', { class: 'grid2' }, frag, select(rw, 'achievement', 'Logro que desbloquea', [['', '— ninguno —'], ...S.cfg.achievements.map((a) => [a.id, a.title])]), text(rw, 'text', 'Mensaje de recompensa (opcional)', { area: true })), h('label', { class: 'chk' }, hasItem, 'Entrega un objeto al inventario'), itemBox),
  ];
}

function tabCapitulos() {
  const chs = S.cfg.chapters.slice().sort((a, b) => a.n - b.n);
  if (S.ch >= chs.length) S.ch = 0;
  const ch = chs[S.ch], nav = h('div', { class: 'row' }, chs.map((c, i) => h('button', { class: 'btn' + (i === S.ch ? ' pri' : ''), onclick: () => { S.ch = i; render(); } }, `Cap. ${c.n}`)));
  const loc = ch.location, g = ch.gift;
  const fragBtn = h('button', { class: 'btn sm', onclick: () => { if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) { loc.fragA = dms(loc.lat, 'N', 'S'); loc.fragB = dms(loc.lng, 'E', 'W'); render(); toast('Pistas generadas desde las coordenadas'); } else toast('Introduce primero latitud y longitud', 'bad'); } }, 'Generar pistas desde lat/lng');
  const mapsBtn = h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: `https://www.google.com/maps?q=${encodeURIComponent(Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? loc.lat + ',' + loc.lng : loc.address || '')}` }, 'Ver en Google Maps');
  const letter = g.letter || null;
  const letterBox = h('div', { class: 'list' });
  const drawLetter = () => {
    letterBox.textContent = '';
    if (!g.letter) { letterBox.append(h('div', null, h('button', { class: 'btn sm', onclick: () => { g.letter = { title: 'Para ti', paragraphs: ['[EDITAR] Querida…'], signature: S.cfg.meta.hostName || 'Hugo' }; drawLetter(); touch(); } }, '+ Añadir carta'))); return; }
    letterBox.append(h('div', { class: 'grid2' }, text(g.letter, 'title', 'Título de la carta'), text(g.letter, 'signature', 'Firma')), strList(g.letter.paragraphs, { label: 'Párrafos', area: true, min: 1 }), h('div', null, h('button', { class: 'btn sm danger', onclick: () => { g.letter = null; drawLetter(); touch(); } }, 'Quitar carta')));
  }; void letter; drawLetter();
  const taskSel = h('select', null, Object.entries(TYPE_NAMES).map(([k, v]) => h('option', { value: k }, v)));
  const tasksBox = objList(ch.tasks, {
    title: (t, i) => `${i + 1}. ${t.title || TYPE_NAMES[t.type]}`, key: (t) => 't' + t.id,
    tags: (t) => [h('span', { class: 'tag' }, TYPE_NAMES[t.type] || t.type), t.provisional ? h('span', { class: 'tag prov' }, 'provisional') : null, t.enabled === false ? h('span', { class: 'tag off' }, 'desactivada') : null,
      h('label', { class: 'chk small', title: 'Activar o desactivar la prueba' }, Object.assign(h('input', { type: 'checkbox', checked: t.enabled !== false }), { onchange() { t.enabled = this.checked; touch(); } }), 'activa')],
    make: () => { const type = taskSel.value, n = ch.tasks.reduce((m, t) => Math.max(m, Number((t.id.match(/t(\d+)$/) || [])[1]) || 0), 0) + 1; return { id: `${ch.id}t${n}`, type, enabled: true, title: TYPE_NAMES[type], kicker: '', intro: '', callout: '', hints: [], reward: { fragment: 0, item: null, achievement: '', text: '' }, provisional: true, ...TEMPLATES[type]() }; },
    add: 'Añadir prueba del tipo seleccionado', render: (t) => taskEditor(ch, t), min: 1,
  });
  const provCheck = (o, label) => check(o, 'provisional', label, 'Márcalo como definitivo cuando lo hayas personalizado.');
  return [
    nav,
    sec(`Capítulo ${ch.n}: ${ch.title}`, 'Identidad del capítulo.',
      h('div', { class: 'grid2' }, text(ch, 'title', 'Título'), text(ch, 'kicker', 'Etiqueta superior'), text(ch, 'subtitle', 'Subtítulo', { area: true }), select(ch, 'theme', 'Tema visual', [['c1', 'Morado (cap. 1)'], ['c2', 'Rosa (cap. 2)'], ['c3', 'Safari (cap. 3)'], ['c4', 'Dorado elegante (cap. 4)']])),
      strList(ch.story, { label: 'Historia de apertura', area: true, ph: 'Párrafo' }), mediaPick(ch, 'music', 'Música del capítulo (opcional)', ['audio'], { hint: 'Si no eliges ninguna se usa la música generada.' })),
    sec('Código físico y cifra-llave', 'El código físico es lo que ella encuentra junto al regalo. Mínimo 6 caracteres recomendado (protege la revelación si no hay cobertura).',
      h('div', { class: 'grid2' }, text(ch, 'physicalCode', 'Código físico', { mono: true }), text(ch, 'codePrompt', 'Pista sobre dónde está el código'), text(ch, 'keyDigit', 'Cifra-llave (un dígito, opcional)', { hint: 'Se entrega como objeto al abrir el regalo; la caja fuerte final las usa.' }))),
    sec('Ubicación', 'Si hay coordenadas, se genera el enlace de Google Maps. Las dos pistas son las partes que ella ensambla.',
      h('div', { class: 'grid2' }, text(loc, 'name', 'Nombre del lugar'), num(loc, 'lat', 'Latitud (decimal)', { ph: '40.416775' }), num(loc, 'lng', 'Longitud (decimal)', { ph: '-3.703790' }), text(loc, 'address', 'Dirección (si no hay coordenadas)')),
      h('div', { class: 'grid2' }, text(loc, 'fragA', 'Pista 1 (p. ej. latitud en grados)', { mono: true }), text(loc, 'fragB', 'Pista 2 (p. ej. longitud en grados)', { mono: true })), h('div', { class: 'row' }, fragBtn, mapsBtn),
      text(loc, 'note', 'Nota al revelar la ubicación', { area: true }), provCheck(loc, 'Ubicación provisional (relleno)')),
    sec('Pruebas', 'Se juegan en este orden. Desactiva una para saltártela sin borrarla.', h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Tipo para «Añadir»:'), taskSel), tasksBox),
    sec('Regalo', 'Lo que ve al abrirlo (la ubicación se desbloquea antes, con las pruebas).',
      h('div', { class: 'grid2' }, text(g, 'label', 'Etiqueta (p. ej. Regalo 2)'), text(g, 'title', 'Título del regalo'), text(g, 'description', 'Descripción corta (se ve en el mapa tras abrirlo)', { area: true }), text(g, 'revealTitle', 'Titular al desbloquear'), select(g, 'celebration', 'Celebración', [['confetti', 'Confeti'], ['safari', 'Safari (entrada y huellas)'], ['romance', 'Romántica (cinematográfica)']])),
      text(g, 'revealText', 'Texto del regalo', { area: true, rows: 4 }),
      ch.n === 4 ? text(g, 'ringText', 'Texto extra del final (solo se muestra si lo activas en General)', { area: true, hint: 'La aplicación no menciona ni insinúa nada más allá de lo que escribas aquí y actives.' }) : null,
      check(g, 'fakeEnding', 'Tras este regalo se produce el falso final', 'Normalmente solo el capítulo 3.'), provCheck(g, 'Regalo provisional')),
    sec('Contenido personal del regalo', 'Se muestra en la secuencia final de los capítulos con celebración romántica.',
      field('Carta', letterBox), mediaPick(g, 'audio', 'Audio personalizado', ['audio']), mediaPick(g, 'video', 'Vídeo personalizado', ['video']),
      field('Fotos', photosEditor(g))),
  ];
}
function photosEditor(g) {
  const box = h('div', { class: 'list' }), draw = () => {
    box.textContent = ''; g.photos = g.photos || [];
    g.photos.forEach((id, i) => { const o = { v: id }; box.append(h('div', { class: 'srow' }, (() => { const w = h('div'); w.append(mediaPick({ get v() { return g.photos[i]; }, set v(x) { g.photos[i] = x; } }, 'v', 'Foto ' + (i + 1), ['image'])); return w; })(), h('button', { class: 'btn sm danger', onclick: () => { g.photos.splice(i, 1); draw(); touch(); } }, '✕'))); void o; });
    box.append(h('div', null, h('button', { class: 'btn sm', onclick: () => { g.photos.push(''); draw(); touch(); } }, '+ Añadir foto')));
  }; draw(); return box;
}

function tabMedios() {
  const file = h('input', { type: 'file', multiple: true, hidden: true, accept: 'image/*,audio/*,video/*' }), vis = h('select', null, h('option', { value: 'gated' }, 'Privado (solo con enlace firmado; recomendado)'), h('option', { value: 'public' }, 'Público'));
  file.addEventListener('change', async () => { for (const f of file.files) { try { await uploadMedia(f, vis.value); toast('Subido: ' + f.name); } catch (e) { toast(f.name + ': ' + e.message, 'bad', 5000); } } file.value = ''; render(); });
  const grid = h('div', { class: 'media-grid' });
  S.cfg.media.forEach((m) => {
    const pv = m.kind === 'image' ? h('img', { src: mediaUrl(m), alt: '', loading: 'lazy' }) : m.kind === 'video' ? h('video', { src: mediaUrl(m), controls: true, preload: 'metadata' }) : h('audio', { src: mediaUrl(m), controls: true, preload: 'none' });
    const lab = h('input', { type: 'text', value: m.label }); lab.addEventListener('input', () => { m.label = lab.value; touch(); });
    grid.append(h('div', { class: 'mcard' }, h('div', { class: 'pv' }, pv), h('div', { class: 'mb' }, lab, h('div', { class: 'row' }, h('span', { class: 'tag' }, m.kind), m.builtin ? h('span', { class: 'tag prov' }, 'provisional') : h('span', { class: 'tag off' }, m.visibility === 'public' ? 'público' : 'privado'), h('span', { class: 'small muted mono' }, m.id)),
      m.builtin ? h('span', { class: 'hint small muted' }, 'Marcador de posición: sube tu archivo y elígelo donde corresponda.') : h('button', { class: 'btn sm danger', onclick: async () => { if (!await confirmBox('Eliminar archivo', `Se borrará «${m.label}» del servidor.`, 'Eliminar')) return; try { await api('/api/admin/media?id=' + encodeURIComponent(m.id), { method: 'DELETE' }); S.cfg.media = S.cfg.media.filter((x) => x.id !== m.id); const sn = JSON.parse(S.snap); sn.media = sn.media.filter((x) => x.id !== m.id); S.snap = JSON.stringify(sn); render(); toast('Eliminado'); } catch (e) { toast(e.message, 'bad', 5000); } } }, 'Eliminar'))));
  });
  return [sec('Subir archivos', 'Formatos: jpg, png, webp, gif, mp3, m4a, ogg, wav, mp4, webm. Se comprueba el contenido real del archivo. Lo privado solo se sirve con un enlace firmado que caduca, así que nadie puede adivinar la URL de tus fotos.', h('div', { class: 'row' }, vis, h('button', { class: 'btn pri', onclick: () => file.click() }, 'Elegir archivos…'), file)),
    sec('Biblioteca', 'Pulsa «Guardar» (arriba) para conservar los cambios de etiquetas. Los archivos subidos ya están en el servidor.', grid)];
}

// ───────── Estructura ─────────
const TABS = [['resumen', 'Resumen'], ['general', 'General'], ['textos', 'Humor y textos'], ['capitulos', 'Capítulos'], ['medios', 'Medios']];
function render() {
  const V = S.validation; root.textContent = '';
  const nav = h('nav', { class: 'nav', 'aria-label': 'Secciones' }, TABS.map(([k, t]) => h('button', { 'aria-current': String(S.tab === k), onclick: () => { S.tab = k; render(); scrollTo(0, 0); } }, t, k === 'resumen' && V.errors.length ? h('span', { class: 'badge' }, V.errors.length) : k === 'resumen' && (V.pending || []).length ? h('span', { class: 'badge w' }, V.pending.length) : null)));
  const body = { resumen: tabResumen, general: tabGeneral, textos: tabTextos, capitulos: tabCapitulos, medios: tabMedios }[S.tab]();
  root.append(
    h('header', { class: 'top' }, h('h1', null, 'LA VENGANZA 2.0 · Panel'), h('span', { id: 'dirtychip', class: 'chip clean' }, 'Todo guardado'), h('a', { class: 'btn sm', href: '../', target: '_blank', rel: 'noopener' }, 'Ver juego'), h('button', { id: 'savebtn', class: 'btn pri', onclick: save, disabled: true }, 'Guardar')),
    h('div', { class: 'layout' }, nav, h('main', null, ...body)));
  updateBar();
}
function showLogin() {
  root.textContent = ''; const pw = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña', autofocus: true }), err = h('p', { class: 'err', role: 'alert' });
  const go = async (e) => { e.preventDefault(); err.textContent = ''; try { await api('/api/admin/login', { method: 'POST', body: { password: pw.value } }); await start(); } catch (x) { err.textContent = x.message; pw.select(); } };
  root.append(h('div', { class: 'login' }, h('form', { onsubmit: go }, h('h1', null, 'Panel de Hugo'), h('p', { class: 'muted' }, LOGIN.help), h('div', { class: 'fld' }, h('label', null, LOGIN.label), pw), h('button', { class: 'btn pri', type: 'submit' }, 'Entrar'), err)));
}
async function start() { await load(); render(); }
(async () => { try { await api('/api/admin/me'); await start(); } catch { showLogin(); } })();
