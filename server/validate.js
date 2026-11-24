// Validación de la configuración al guardar desde el panel + lista de elementos pendientes (provisionales).
const TYPES = ['quiz', 'safe', 'order', 'scratch', 'hidden', 'memory', 'jigsaw', 'pixel', 'runaway', 'sequence', 'runner', 'troll', 'media'];

export function validateConfig(cfg) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);
  if (!cfg || typeof cfg !== 'object') return { errors: ['Configuración inválida'], warnings, pending: [] };
  for (const k of ['meta', 'intro', 'settings', 'trolls']) if (!cfg[k] || typeof cfg[k] !== 'object') E(`Falta la sección «${k}»`);
  if (!Array.isArray(cfg.chapters) || cfg.chapters.length < 1) E('Debe haber al menos un capítulo');
  if (!Array.isArray(cfg.media)) E('Falta la lista de medios');
  if (errors.length) return { errors, warnings, pending: [] };

  const media = new Set(cfg.media.map((m) => m.id));
  const needMedia = (id, where) => { if (id && !media.has(id)) E(`${where}: el medio «${id}» no existe`); };
  const chIds = new Set(), taskIds = new Set(), ns = new Set();
  const ach = new Set((cfg.achievements || []).map((a) => a.id));
  const digits = cfg.chapters.slice().sort((a, b) => a.n - b.n).map((c) => c.keyDigit || '');
  if (!Array.isArray(cfg.trolls.wrong) || !cfg.trolls.wrong.length) E('Debe haber al menos un mensaje de fallo (Textos → Trolleos)');
  for (const id of cfg.settings.bouncerMedia || []) needMedia(id, 'Fotos rebotantes');

  for (const ch of cfg.chapters) {
    const W0 = `Capítulo ${ch.n || '?'} (${ch.title || ch.id})`;
    if (!ch.id || chIds.has(ch.id)) E(`${W0}: id repetido o vacío`); chIds.add(ch.id);
    if (ns.has(ch.n)) E(`${W0}: número de capítulo repetido`); ns.add(ch.n);
    if (!['c1', 'c2', 'c3', 'c4'].includes(ch.theme)) E(`${W0}: tema desconocido`);
    if (!String(ch.physicalCode || '').trim()) E(`${W0}: falta el código físico`);
    else if (String(ch.physicalCode).replace(/[\s\-_.]/g, '').length < 6) W(`${W0}: el código físico tiene menos de 6 caracteres; para proteger la revelación sin conexión usa 6 o más.`);
    const loc = ch.location || {};
    if (!String(loc.fragA || '').trim() || !String(loc.fragB || '').trim()) E(`${W0}: la ubicación necesita las dos pistas (pista 1 y pista 2)`);
    const hasCoords = Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
    if (!hasCoords && !String(loc.address || '').trim()) E(`${W0}: la ubicación necesita coordenadas o una dirección`);
    if (hasCoords && (Math.abs(loc.lat) > 90 || Math.abs(loc.lng) > 180)) E(`${W0}: coordenadas fuera de rango`);
    if (ch.keyDigit && !/^\d$/.test(ch.keyDigit)) E(`${W0}: la cifra-llave debe ser un solo dígito`);
    needMedia(ch.music, W0 + ' · música');
    for (const id of ch.gift.photos || []) needMedia(id, W0 + ' · fotos del regalo');
    needMedia(ch.gift.audio, W0 + ' · audio del regalo'); needMedia(ch.gift.video, W0 + ' · vídeo del regalo');

    const tasks = (ch.tasks || []).filter((t) => t.enabled !== false);
    if (!tasks.length) W(`${W0}: no tiene pruebas activas`);
    for (const t of ch.tasks || []) {
      const T = `${W0} › ${t.title || t.id}`;
      if (!t.id || taskIds.has(t.id)) E(`${T}: id de prueba repetido o vacío`); taskIds.add(t.id);
      if (!TYPES.includes(t.type)) { E(`${T}: tipo desconocido «${t.type}»`); continue; }
      if (t.enabled === false) continue;
      if (t.reward && t.reward.achievement && !ach.has(t.reward.achievement)) E(`${T}: el logro «${t.reward.achievement}» no existe`);
      if (!['troll', 'media'].includes(t.type) && !(t.hints || []).filter(Boolean).length) W(`${T}: sin pistas de ayuda (se usarán pistas genéricas)`);
      switch (t.type) {
        case 'quiz':
          if (!t.rounds || !t.rounds.length) E(`${T}: necesita al menos una pregunta`);
          (t.rounds || []).forEach((r, i) => {
            const R = `${T} › pregunta ${i + 1}`;
            if (!String(r.prompt || '').trim()) E(`${R}: falta el enunciado`);
            if (r.kind === 'text') { if (!(r.accepted || []).filter(Boolean).length) E(`${R}: faltan respuestas aceptadas`); }
            else {
              if ((r.options || []).length < 2) E(`${R}: necesita al menos 2 opciones`);
              if (!(r.options || []).some((o) => o.correct)) E(`${R}: ninguna opción está marcada como correcta`);
            }
            if (r.sound && !r.sound.startsWith('synth:')) needMedia(r.sound, R + ' · sonido'); needMedia(r.image, R + ' · imagen');
          }); break;
        case 'safe':
          if (t.codeSource === 'keyDigits') { const code = digits.join(''); if (!code) E(`${T}: ningún capítulo define cifra-llave`); }
          else if (!/^\d{2,8}$/.test(String(t.code || ''))) E(`${T}: el código debe tener entre 2 y 8 cifras`);
          break;
        case 'order': if ((t.items || []).length < 2) E(`${T}: necesita al menos 2 elementos`); break;
        case 'hidden': if (!(t.hotspots || []).length) E(`${T}: necesita al menos un punto oculto`); break;
        case 'memory': if ((t.pairs || []).length < 2) E(`${T}: necesita al menos 2 parejas`); (t.pairs || []).forEach((p) => needMedia(p.image, T)); break;
        case 'jigsaw': if (!t.image) E(`${T}: falta la foto`); needMedia(t.image, T); break;
        case 'pixel': if (!t.image) E(`${T}: falta la foto`); needMedia(t.image, T); if (!(t.accepted || []).filter(Boolean).length) E(`${T}: faltan respuestas aceptadas`); break;
        case 'sequence': if ((t.pads || []).length < 2) E(`${T}: necesita al menos 2 sonidos`); break;
        case 'media': if (t.media) needMedia(t.media, T); else W(`${T}: sin audio/vídeo (se mostrará un aviso en su lugar)`); break;
      }
    }
    const slots = new Set(tasks.map((t) => Number(t.reward && t.reward.fragment)).filter(Boolean));
    if (tasks.length && !(slots.has(1) && slots.has(2))) W(`${W0}: las pistas 1 y 2 no están asignadas a pruebas distintas; las que falten se entregarán en la última prueba.`);
  }
  if (!cfg.chapters.some((c) => c.n === 1)) E('Falta el capítulo 1');
  if (cfg.settings.ringReferenceEnabled) W('Has activado la referencia al anillo/propuesta: se mostrará el texto configurado en la revelación final.');
  if (cfg.chapters.some((c) => c.hidden) && !cfg.chapters.some((c) => c.gift && c.gift.fakeEnding)) W('Hay un capítulo oculto pero ningún regalo activa el falso final, así que el capítulo oculto se mostraría directamente.');
  return { errors, warnings, pending: pendingItems(cfg) };
}

/** Recorre toda la configuración y lista lo que sigue siendo provisional ([EDITAR] o marcado como provisional). */
export function pendingItems(cfg) {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') { if (/\[EDITAR/i.test(v)) out.push({ where: path.join(' › '), text: v.length > 90 ? v.slice(0, 90) + '…' : v }); return; }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, path.concat(String(i + 1))));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'provisionalNote') walk(x, path.concat(k));
  };
  for (const ch of cfg.chapters || []) {
    const base = `Capítulo ${ch.n}`;
    if (ch.gift && ch.gift.provisional) out.push({ where: `${base} › Regalo`, text: 'Regalo marcado como provisional' });
    if (ch.location && ch.location.provisional) out.push({ where: `${base} › Ubicación`, text: ch.location.provisionalNote || 'Ubicación provisional' });
    if (/^HUGO0\d$/.test(ch.physicalCode || '')) out.push({ where: `${base} › Código físico`, text: 'Todavía usa el código de ejemplo' });
    for (const t of ch.tasks || []) if (t.provisional) out.push({ where: `${base} › ${t.title}`, text: 'Prueba marcada como provisional' });
    walk({ story: ch.story, gift: ch.gift, tasks: ch.tasks }, [base]);
  }
  walk({ fakeEnding: cfg.fakeEnding, intro: cfg.intro }, ['General']);
  const seen = new Set();
  return out.filter((o) => { const k = o.where + '|' + o.text; if (seen.has(k)) return false; seen.add(k); return true; });
}
