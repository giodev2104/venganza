// Lógica del juego en el servidor: solo aquí viven respuestas, códigos, ubicaciones y textos de los regalos.
// El cliente recibe cada pieza únicamente cuando ha superado la anterior (tokens firmados encadenados).
import { sign, verify, hmac, safeEq, norm, matchText, normCode, normCoord, parseFloats, encryptWithCode, hashStr, rid } from './util.js';

const CLAIM_TYPES = new Set(['memory', 'jigsaw', 'runner', 'sequence', 'hidden', 'runaway', 'scratch', 'troll', 'media']);
const MIN_MS = { memory: 5000, jigsaw: 3000, runner: 6000, sequence: 3500, hidden: 1200, runaway: 1500, scratch: 1000, troll: 600, media: 800 };
const MEDIA_TTL = 14 * 24 * 3600 * 1000;

export class Game {
  constructor(store) { this.store = store; this.codeFails = new Map(); }
  get cfg() { return this.store.config; }
  get secret() { return this.store.secret; }
  tok(p) { return sign(this.secret, p); }
  chk(token, k, props = {}) {
    const p = verify(this.secret, token);
    if (!p || p.k !== k) return null;
    for (const [a, b] of Object.entries(props)) if (p[a] !== b) return null;
    return p;
  }

  // ── Estructura ──
  chapters() { return [...this.cfg.chapters].sort((a, b) => a.n - b.n); }
  chapter(id) { return this.chapters().find((c) => c.id === id); }
  minigameOn(type) { const m = this.cfg.settings.minigames || {}; return m[type] !== false; }
  tasksOf(ch) { return ch.tasks.filter((t) => t.enabled !== false && this.minigameOn(t.type)); }
  find(taskId) {
    for (const ch of this.chapters()) {
      const list = this.tasksOf(ch), idx = list.findIndex((t) => t.id === taskId);
      if (idx >= 0) return { ch, list, idx, task: list[idx] };
    }
    return null;
  }
  proofFor(ch, list, idx) { return idx === 0 ? { k: 'co', c: ch.id } : { k: 'td', t: list[idx - 1].id }; }
  proofOk(token, ch, list, idx) { const need = this.proofFor(ch, list, idx); return !!this.chk(token, need.k, need.k === 'co' ? { c: need.c } : { t: need.t }); }
  err(status, code, message) { const e = new Error(message || code); e.status = status; e.code = code; return e; }

  // ── Medios ──
  mediaItem(id) { return (this.cfg.media || []).find((m) => m.id === id); }
  mediaUrl(id, exp) {
    const m = this.mediaItem(id);
    if (!m) return null;
    if (m.builtin) return '/assets/' + m.file;
    if (m.visibility === 'public') return '/media/' + m.file;
    const e = Date.now() + (exp || MEDIA_TTL);
    return '/media/' + m.file + '?e=' + e + '&s=' + hmac(this.secret, m.file + '.' + e);
  }
  mediaSigOk(file, e, s) {
    if (!(Number(e) > Date.now())) return false;
    return safeEq(hmac(this.secret, file + '.' + e), String(s || ''));
  }
  soundRef(s) { if (!s) return ''; if (s.startsWith('synth:')) return s; const u = this.mediaUrl(s); return u || ''; }

  // ── Público ──
  publicInfo() {
    const cfg = this.cfg, all = this.chapters();
    const visible = all.filter((c) => !(c.hidden && cfg.settings.hideFinalChapterUntilFakeEnding));
    const s = cfg.settings;
    return {
      meta: cfg.meta, intro: cfg.intro, epoch: cfg.epoch,
      first: all[0]?.id, visibleChapters: visible.length, totalChapters: all.length,
      chapterIds: all.map((c) => c.id),
      settings: { hintAfterFails: s.hintAfterFails, hintDelaySec: s.hintDelaySec, wrongOverlayEvery: s.wrongOverlayEvery, geolocation: s.geolocation, difficulty: s.difficulty, hideFinal: s.hideFinalChapterUntilFakeEnding },
      schedule: s.schedule && s.schedule.enabled ? { enabled: true, timezone: s.schedule.timezone || 'Europe/Madrid', startAt: s.schedule.startAt, dailyTime: s.schedule.dailyTime || '18:30', finalAt: s.schedule.finalAt || '', secretId: all.find((c) => c.hidden)?.id || '' } : null,
      bouncers: (s.bouncerMedia || []).map((id) => this.mediaUrl(id)).filter(Boolean),
      trolls: { cheer: cfg.trolls.cheer }, achievements: (cfg.achievements || []).map((a) => ({ id: a.id, icon: a.icon })),
    };
  }

  // ── Capítulo ──
  openChapter({ chapterId, proof }) {
    const all = this.chapters(), i = all.findIndex((c) => c.id === chapterId);
    if (i < 0) throw this.err(404, 'no_chapter');
    if (i > 0 && !this.chk(proof, 'cd', { c: all[i - 1].id })) throw this.err(403, 'locked', 'Capítulo bloqueado');
    const ch = all[i], list = this.tasksOf(ch);
    return {
      chapter: {
        id: ch.id, n: ch.n, theme: ch.theme, kicker: ch.kicker, title: ch.title, subtitle: ch.subtitle, story: ch.story,
        codePrompt: ch.codePrompt, giftLabel: ch.gift.label, hidden: !!ch.hidden, music: ch.music ? this.mediaUrl(ch.music) : '',
        tasks: list.map((t) => ({ id: t.id, type: t.type, title: t.title })),
      },
      co: this.tok({ k: 'co', c: ch.id }),
    };
  }

  // ── Prueba ──
  getTask({ taskId, proof }) {
    const f = this.find(taskId);
    if (!f) throw this.err(404, 'no_task');
    if (!this.proofOk(proof, f.ch, f.list, f.idx)) throw this.err(403, 'locked', 'Prueba bloqueada');
    return { task: this.sanitize(f.task), index: f.idx, total: f.list.length, st: this.tok({ k: 'st', t: f.task.id, ts: Date.now() }) };
  }

  sanitize(t) {
    const o = { id: t.id, type: t.type, title: t.title, kicker: t.kicker || '', intro: t.intro || '', callout: t.callout || '', hintCount: Math.max(3, (t.hints || []).length) };
    switch (t.type) {
      case 'quiz':
        o.rounds = t.rounds.map((r) => ({
          id: r.id, kind: r.kind, prompt: r.prompt, subtitle: r.subtitle || '', placeholder: r.placeholder || '',
          options: (r.options || []).map((x) => ({ id: x.id, text: x.text })), sound: this.soundRef(r.sound), image: r.image ? this.mediaUrl(r.image) : '',
        }));
        o.shuffle = t.shuffle !== false; break;
      case 'safe': o.prompt = t.prompt; o.digits = this.safeCode(t).length || t.digits || 4; break;
      case 'order': o.prompt = t.prompt; o.items = shuffle(t.items.map((i) => ({ id: i.id, text: i.text }))); break;
      case 'scratch': o.prompt = t.prompt; break;
      case 'hidden': o.prompt = t.prompt; o.scene = t.scene || 'night'; o.hotspots = t.hotspots.map((h) => ({ id: h.id, x: h.x, y: h.y, label: h.label })); break;
      case 'memory': o.prompt = t.prompt; o.pairs = t.pairs.map((p) => ({ id: p.id, icon: p.icon, image: p.image ? this.mediaUrl(p.image) : '' })); break;
      case 'jigsaw': o.prompt = t.prompt; o.image = this.mediaUrl(t.image) || ''; o.grid = t.grid || 3; break;
      case 'pixel': o.prompt = t.prompt; o.image = this.mediaUrl(t.image) || ''; o.placeholder = t.placeholder || ''; break;
      case 'runaway': o.prompt = t.prompt; o.buttonText = t.buttonText; o.dodges = t.dodges; o.taunts = t.taunts; break;
      case 'sequence': o.prompt = t.prompt; o.length = t.length; o.pads = t.pads.map((p) => ({ id: p.id, label: p.label, sound: this.soundRef(p.sound) })); break;
      case 'runner': o.prompt = t.prompt; o.target = t.target; break;
      case 'troll': Object.assign(o, { kind: t.kind, heading: t.heading, text: t.text, twist: t.twist, button: t.button, photo: !!t.photo, items: t.items }); break;
      case 'media': {
        const m = this.mediaItem(t.media);
        Object.assign(o, { prompt: t.prompt, mediaUrl: m ? this.mediaUrl(t.media) : '', mediaKind: m ? m.kind : '', requirePlay: !!t.requirePlay, caption: t.caption || '' });
        break;
      }
    }
    return o;
  }

  safeCode(t) {
    if (t.codeSource === 'keyDigits') return this.chapters().map((c) => String(c.keyDigit || '')).filter(Boolean).join('');
    return String(t.code || '').replace(/\D/g, '');
  }

  failMsg(task, attempt, given) {
    const pool = this.cfg.trolls.wrong, n = attempt | 0;
    const helper = n >= 2 && (n + 1) % 3 === 0;
    const msg = helper ? this.cfg.trolls.helper : given || pool[(hashStr(task.id) + n) % pool.length];
    return { ok: false, msg, suggestHint: helper };
  }

  // ── Responder ──
  answer(body, { admin = false } = {}) {
    const f = this.find(body.taskId);
    if (!f) throw this.err(404, 'no_task');
    const { ch, list, idx, task } = f;
    if (!this.proofOk(body.proof, ch, list, idx)) throw this.err(403, 'locked', 'Prueba bloqueada');
    const attempt = Number(body.attempt) || 0;

    if (admin && body.skip) return this.success(ch, list, task, {});

    switch (task.type) {
      case 'quiz': {
        const i = Number(body.round) || 0, r = task.rounds[i];
        if (!r) throw this.err(400, 'bad_round');
        if (i > 0 && !this.chk(body.rp, 'rd', { t: task.id, i: i - 1 })) throw this.err(403, 'locked');
        let correct = false, given = null;
        if (r.kind === 'text') correct = matchText(body.answer, r.accepted);
        else { const o = (r.options || []).find((x) => x.id === body.answer); correct = !!(o && o.correct); given = o && o.msg; }
        if (correct && r.allWrongFirst && attempt < r.allWrongFirst) {
          return { ...this.failMsg(task, attempt, null), troll: true };
        }
        if (!correct) return this.failMsg(task, attempt, given);
        if (i < task.rounds.length - 1) return { ok: true, done: false, explain: r.explain || '', rp: this.tok({ k: 'rd', t: task.id, i }) };
        return this.success(ch, list, task, { explain: r.explain || '' });
      }
      case 'safe': {
        const want = this.safeCode(task);
        if (!want || String(body.answer || '').replace(/\D/g, '') !== want) return this.failMsg(task, attempt, { title: 'CLAVE INCORRECTA', text: 'La caja fuerte ni se inmuta. Prueba otra combinación.' });
        return this.success(ch, list, task, {});
      }
      case 'order': {
        const want = task.items.map((x) => x.id).join('|'), got = Array.isArray(body.answer) ? body.answer.join('|') : '';
        if (want !== got) return this.failMsg(task, attempt, { title: 'NO ES ESE ORDEN', text: 'La historia no pasó así. Reordena y vuelve a comprobar.' });
        return this.success(ch, list, task, {});
      }
      case 'pixel': {
        if (!matchText(body.answer, task.accepted)) return this.failMsg(task, attempt, { title: 'NO PARECE ESO', text: 'Aclara un poco más la imagen y vuelve a intentarlo.' });
        return this.success(ch, list, task, {});
      }
      default: {
        if (!CLAIM_TYPES.has(task.type)) throw this.err(400, 'bad_type');
        const st = this.chk(body.st, 'st', { t: task.id });
        if (!st) throw this.err(400, 'bad_start');
        if (!admin && Date.now() - st.ts < (MIN_MS[task.type] || 0)) return { ok: false, tooFast: true, wait: (MIN_MS[task.type] || 0) - (Date.now() - st.ts) + 50, msg: { title: 'DEMASIADO RÁPIDO', text: 'Hugo sospecha que has hecho trampas. Hazlo con calma.' } };
        if (task.type === 'hidden') {
          const found = new Set((body.claim && body.claim.found) || []);
          if (!task.hotspots.every((h) => found.has(h.id))) return { ok: false, msg: { title: 'FALTAN COSAS', text: 'Todavía queda algo por encontrar.' } };
        }
        return this.success(ch, list, task, { reveal: task.revealText || '' });
      }
    }
  }

  fragmentSlots(ch, list) {
    const map = {}, used = new Set();
    for (const t of list) { const s = Number(t.reward && t.reward.fragment) || 0; if (s === 1 || s === 2) { (map[t.id] ||= []).push(s); used.add(s); } }
    const last = list[list.length - 1];
    for (const s of [1, 2]) if (!used.has(s) && last) (map[last.id] ||= []).push(s);
    return map;
  }

  success(ch, list, task, extra) {
    const out = { ok: true, done: true, token: this.tok({ k: 'td', t: task.id }), reveal: extra.reveal || '', explain: extra.explain || '' };
    const r = task.reward || {}, reward = { fragments: [], item: null, achievement: null, text: r.text || '' };
    for (const s of this.fragmentSlots(ch, list)[task.id] || []) reward.fragments.push({ slot: s, label: 'Pista ' + s, value: s === 1 ? ch.location.fragA : ch.location.fragB, chapter: ch.n, chapterId: ch.id });
    if (r.item && r.item.label) reward.item = { id: ch.id + ':' + task.id, label: r.item.label, text: r.item.text || '', chapter: ch.n };
    if (r.achievement) { const a = this.cfg.achievements.find((x) => x.id === r.achievement); if (a) reward.achievement = a; }
    out.reward = reward;
    return out;
  }

  hint(body) {
    const f = this.find(body.taskId);
    if (!f) throw this.err(404, 'no_task');
    if (!this.proofOk(body.proof, f.ch, f.list, f.idx)) throw this.err(403, 'locked');
    const hints = (f.task.hints || []).filter(Boolean), max = Math.max(3, hints.length);
    const level = Math.min(Math.max(Number(body.level) || 1, 1), max);
    const generic = this.cfg.trolls.hintGeneric;
    return { hint: hints[level - 1] || generic[(level - 1) % generic.length], level, max };
  }

  // ── Montaje de coordenadas ──
  locationPayload(ch) {
    const l = ch.location, hasCoords = Number.isFinite(l.lat) && Number.isFinite(l.lng) && !(l.lat === 0 && l.lng === 0);
    const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.name)}`;
    return { name: l.name, lat: hasCoords ? l.lat : null, lng: hasCoords ? l.lng : null, address: l.address || '', note: l.note || '', mapsUrl, coordsText: `${l.fragA} ${l.fragB}`.trim(), geo: hasCoords && this.cfg.settings.geolocation };
  }
  assembleOk(ch, body) {
    const A = normCoord(ch.location.fragA), B = normCoord(ch.location.fragB);
    if (Array.isArray(body.parts) && body.parts.length === 2) return normCoord(body.parts[0]) === A && normCoord(body.parts[1]) === B;
    const t = normCoord(body.text);
    if (!t) return false;
    if (t === A + B || t === A + '.' + B || t === A + ';' + B) return true;
    const l = ch.location;
    if (Number.isFinite(l.lat) && Number.isFinite(l.lng)) {
      const n = parseFloats(body.text);
      if (n.length === 2 && Math.abs(n[0] - l.lat) < 0.0006 && Math.abs(n[1] - l.lng) < 0.0006 && /^[\d\s.,;\-+]+$/.test(String(body.text))) return true;
    }
    return false;
  }
  assemble(body) {
    const ch = this.chapter(body.chapterId);
    if (!ch) throw this.err(404, 'no_chapter');
    const list = this.tasksOf(ch), tds = body.tds || {};
    for (const t of list) if (!this.chk(tds[t.id], 'td', { t: t.id })) throw this.err(403, 'locked', 'Faltan pruebas por superar');
    if (!this.assembleOk(ch, body)) {
      const msgs = [
        { title: 'COORDENADAS MAL MONTADAS', text: 'Esas piezas no encajan así. Primero va la latitud (norte/sur), luego la longitud (este/oeste).' },
        { title: 'GPS AVERIADO', text: 'Tu brújula interior marca otra cosa. Revisa el orden de las pistas.' },
        { title: 'NO ES POR AHÍ', text: 'Hugo no está en ese punto del mapa. Prueba otra combinación.' },
      ];
      return { ok: false, msg: msgs[(hashStr(ch.id) + (Number(body.attempt) || 0)) % msgs.length] };
    }
    const reveal = this.buildReveal(ch, MEDIA_TTL), cd = this.tok({ k: 'cd', c: ch.id });
    return { ok: true, location: this.locationPayload(ch), lc: this.tok({ k: 'lc', c: ch.id }), blob: encryptWithCode(ch.physicalCode, { reveal, cd }) };
  }

  // ── Código físico ──
  complete(body, ip = '') {
    const ch = this.chapter(body.chapterId);
    if (!ch) throw this.err(404, 'no_chapter');
    if (!this.chk(body.proof, 'lc', { c: ch.id })) throw this.err(403, 'locked', 'Primero hay que localizar el punto');
    const rec = this.codeFails.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 600000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 15) throw this.err(429, 'slow_down', 'Demasiados intentos. Espera unos minutos.');
    if (!safeEq(normCode(body.code), normCode(ch.physicalCode)) || !normCode(body.code)) {
      rec.n++; this.codeFails.set(ip, rec);
      return { ok: false, msg: { title: 'CÓDIGO INCORRECTO', text: 'Ese no es el código que hay junto al regalo. Mira bien: puede estar escondido, doblado o debajo de algo.' } };
    }
    return { ok: true, token: this.tok({ k: 'cd', c: ch.id }), reveal: this.buildReveal(ch) };
  }

  buildReveal(ch, ttl) {
    const g = ch.gift, cfg = this.cfg, all = this.chapters(), i = all.findIndex((c) => c.id === ch.id), next = all[i + 1];
    const r = {
      chapter: { id: ch.id, n: ch.n }, next: next ? next.id : null, last: !next,
      gift: { label: g.label, title: g.title, description: g.description, revealTitle: g.revealTitle, revealText: g.revealText, celebration: g.celebration || 'confetti' },
      photos: (g.photos || []).map((id) => this.mediaUrl(id, ttl)).filter(Boolean),
      audio: g.audio ? this.mediaUrl(g.audio, ttl) : '', video: g.video ? this.mediaUrl(g.video, ttl) : '',
      letter: g.letter || null,
      keyItem: ch.keyDigit ? { id: ch.id + ':key', label: 'Llave ' + ch.n, text: ch.keyDigit, chapter: ch.n } : null,
    };
    if (g.fakeEnding) r.fakeEnding = cfg.fakeEnding;
    if (cfg.settings.ringReferenceEnabled && g.ringText) r.ringText = g.ringText;
    return r;
  }

  // ── Modo pruebas (solo administrador) ──
  testStart(n) {
    const all = this.chapters(), i = all.findIndex((c) => c.n === Number(n));
    if (i < 0) throw this.err(404, 'no_chapter');
    const prev = all.slice(0, i).map((c) => ({ id: c.id, n: c.n, cd: this.tok({ k: 'cd', c: c.id }), reveal: this.buildReveal(c), location: this.locationPayload(c) }));
    return { prev, chapterId: all[i].id, proof: i > 0 ? this.tok({ k: 'cd', c: all[i - 1].id }) : '' };
  }
  testCodes() { return this.chapters().map((c) => ({ id: c.id, n: c.n, code: c.physicalCode })); }
}

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export { rid };
