// Motor de audio con Web Audio API: efectos, animales sintetizados y música generativa por capítulo.
// Todo se sintetiza en el dispositivo: sin ficheros ni dependencias. Los sonidos de animales son aproximaciones:
// para grabaciones reales, súbelas desde el panel y asígnalas a cada pregunta.
let ctx = null, master, sfxBus, musBus, delay, fb, wet;
let on = { sound: true, music: false };
let timer = null, theme = null, step = 0, nextT = 0, musicEl = null;

export function configure(o) { on = { ...on, ...o }; if (master) { master.gain.setTargetAtTime(on.sound ? 1 : 0, ctx.currentTime, .05); } if (!on.music) stopMusic(); else if (theme && !timer) startTheme(theme); }
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on.sound ? 1 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .55; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = .0; musBus.connect(master);
    delay = ctx.createDelay(1.2); delay.delayTime.value = .33; fb = ctx.createGain(); fb.gain.value = .38; wet = ctx.createGain(); wet.gain.value = .35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musBus);
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* no soportado */ }
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return true;
}
const ok = () => ctx && on.sound && ctx.state !== 'closed';
const T = () => ctx.currentTime;

function tone({ f = 440, t = .2, type = 'sine', v = .2, a = .005, r = .08, slide = 0, at = 0, det = 0, bus = sfxBus, lp = 0, vib = 0, vibRate = 6 }) {
  const t0 = T() + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + t); o.detune.value = det;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.setValueAtTime(v, t0 + Math.max(a, t - r)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + .02);
  let n = o; if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
  n.connect(g); g.connect(bus);
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + t + .05); }
  o.start(t0); o.stop(t0 + t + .05);
  return o;
}
let noiseBuf = null;
function noise({ t = .2, v = .2, f = 1000, q = 1, type = 'bandpass', at = 0, f2 = 0, a = .005, bus = sfxBus }) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t0 = T() + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t0, Math.random()); s.stop(t0 + t + .05);
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SFX = {
  click: () => tone({ f: 1100, t: .035, type: 'triangle', v: .12 }),
  tap: () => tone({ f: 560, t: .06, v: .14, slide: 380 }),
  pop: () => tone({ f: 420, t: .09, v: .18, slide: 900 }),
  flip: () => { noise({ t: .05, v: .15, f: 3000, q: .6 }); tone({ f: 300, t: .07, type: 'triangle', v: .1, slide: 500 }); },
  match: () => { tone({ f: mtof(76), t: .12, type: 'triangle', v: .16 }); tone({ f: mtof(83), t: .2, type: 'triangle', v: .16, at: .09 }); },
  success: () => [72, 76, 79, 84].forEach((m, i) => tone({ f: mtof(m), t: .22, type: 'triangle', v: .17, at: i * .075 })),
  fail: () => { tone({ f: 190, t: .28, type: 'sawtooth', v: .12, slide: 95, lp: 700 }); },
  boing: () => { tone({ f: 380, t: .45, v: .2, slide: 110, vib: 40, vibRate: 14 }); },
  whoosh: () => noise({ t: .6, v: .22, f: 260, f2: 2600, q: .8, a: .15 }),
  unlock: () => { [67, 71, 74, 79, 83, 86, 91].forEach((m, i) => tone({ f: mtof(m), t: .5, type: 'sine', v: .12, at: i * .06 })); noise({ t: .9, v: .06, f: 6000, type: 'highpass', a: .2 }); },
  reveal: () => { [60, 64, 67, 72].forEach((m) => tone({ f: mtof(m), t: 1.2, type: 'triangle', v: .09, a: .08 })); [84, 88, 91, 96].forEach((m, i) => tone({ f: mtof(m), t: .5, v: .07, at: .25 + i * .09 })); },
  glitch: () => { for (let i = 0; i < 9; i++) { noise({ t: .05, v: .18, f: 400 + Math.random() * 4000, q: 2, at: i * .06 }); tone({ f: 80 + Math.random() * 600, t: .05, type: 'square', v: .06, at: i * .06 }); } },
  scratchrec: () => { noise({ t: .55, v: .3, f: 3200, f2: 180, q: 1.2 }); tone({ f: 900, t: .5, type: 'sawtooth', v: .1, slide: 70, lp: 2400 }); },
  drum: () => { tone({ f: 150, t: .25, v: .5, slide: 45 }); noise({ t: .04, v: .12, f: 1800 }); },
  heart: () => { tone({ f: mtof(79), t: .14, v: .13 }); tone({ f: mtof(86), t: .22, v: .13, at: .07 }); },
  honk: () => { tone({ f: 392, t: .22, type: 'square', v: .06, lp: 1800 }); tone({ f: 494, t: .22, type: 'square', v: .06, lp: 1800 }); },
  crash: () => { noise({ t: .35, v: .35, f: 900, f2: 120, type: 'lowpass' }); tone({ f: 110, t: .3, type: 'sawtooth', v: .12, slide: 50 }); },
  safeclick: () => { noise({ t: .03, v: .25, f: 4500, type: 'highpass' }); tone({ f: 200, t: .04, v: .1 }); },
  safeopen: () => { tone({ f: 90, t: .5, type: 'sawtooth', v: .08, slide: 160, lp: 500 }); noise({ t: .12, v: .3, f: 700, type: 'lowpass', at: .02 }); tone({ f: mtof(79), t: .7, type: 'triangle', v: .1, at: .35 }); },
  coin: () => { tone({ f: mtof(83), t: .07, type: 'square', v: .06 }); tone({ f: mtof(88), t: .22, type: 'square', v: .06, at: .07 }); },
  chime: () => [88, 95].forEach((m, i) => tone({ f: mtof(m), t: 1.1, v: .08, at: i * .12 })),
  rustle: () => noise({ t: .25, v: .12, f: 5000, q: .4, type: 'highpass' }),
};
const PAD = [[261.6, 'triangle', 1.0], [329.6, 'sine', 1.4], [392, 'square', .55], [523.3, 'sawtooth', .5]];
export function pad(i) { if (!ok()) return; const [f, type, v] = PAD[i % 4]; try { tone({ f, t: .38, type, v: .16 * v, lp: 1800, a: .01, r: .2 }); } catch { /* ok */ } }
export function sfx(name) { if (!ok() || !SFX[name]) return; try { SFX[name](); } catch { /* audio no disponible */ } }

// ── Animales sintetizados (aproximaciones) ──
const ANIMALS = {
  leon: () => { tone({ f: 95, t: 1.5, type: 'sawtooth', v: .22, a: .25, r: .7, slide: 55, vib: 14, vibRate: 24, lp: 520 }); tone({ f: 190, t: 1.4, type: 'sawtooth', v: .08, a: .25, r: .7, slide: 100, vib: 18, vibRate: 26, lp: 900 }); noise({ t: 1.5, v: .16, f: 380, q: .8, type: 'lowpass', a: .2 }); return 1.6; },
  elefante: () => { [0, 1].forEach((k) => { tone({ f: 330, t: 1.1, type: 'sawtooth', v: .1, a: .1, r: .4, slide: 520, vib: 12, vibRate: 9, lp: 1700, det: k * 12 }); }); tone({ f: 520, t: .5, type: 'sawtooth', v: .07, at: 1.0, slide: 280, lp: 1400 }); noise({ t: 1.4, v: .06, f: 1200, q: 2, a: .15 }); return 1.6; },
  mono: () => { for (let i = 0; i < 8; i++) { const f = 650 + (i % 2 ? 380 : 0) + i * 60; tone({ f, t: .07, type: 'square', v: .06, at: i * .11, slide: f * 1.35, lp: 2200 }); noise({ t: .06, v: .05, f: 1700, q: 3, at: i * .11 }); } return 1; },
  lobo: () => { tone({ f: 280, t: 2.3, v: .16, a: .5, r: 1, slide: 560, vib: 7, vibRate: 5 }); tone({ f: 285, t: 2.3, type: 'triangle', v: .08, a: .5, r: 1, slide: 520, vib: 9, vibRate: 5.5 }); noise({ t: 2.2, v: .03, f: 1500, q: 3, a: .6 }); return 2.4; },
  loro: () => { for (let i = 0; i < 3; i++) { tone({ f: 750, t: .13, type: 'sawtooth', v: .09, at: i * .22, slide: 1700, lp: 3000 }); noise({ t: .1, v: .06, f: 2400, q: 4, at: i * .22 }); } return .8; },
  serpiente: () => { noise({ t: 1.3, v: .2, f: 6500, type: 'highpass', a: .3 }); return 1.3; },
  pajaro: () => { for (let i = 0; i < 6; i++) tone({ f: 2200 + (i % 3) * 600, t: .07, v: .09, at: i * .13, slide: 3400 - (i % 2) * 1200 }); return .85; },
  hiena: () => { for (let i = 0; i < 9; i++) tone({ f: 700 - i * 38, t: .08, type: 'sawtooth', v: .09, at: i * .1, slide: 480 - i * 28, lp: 2000, vib: 60, vibRate: 40 }); return 1; },
};
export const ANIMAL_IDS = Object.keys(ANIMALS);
export function animal(id) { if (!ok() || !ANIMALS[id]) return 0; try { return ANIMALS[id](); } catch { return 0; } }

/** Reproduce una referencia de sonido: «synth:leon» o una URL de fichero subido. */
let clip = null;
export function playRef(ref) {
  if (!ref) return Promise.resolve();
  if (ref.startsWith('synth:')) { unlock(); const d = animal(ref.slice(6)); return new Promise((r) => setTimeout(r, d * 1000)); }
  if (!on.sound) return Promise.resolve();
  try { if (clip) clip.pause(); clip = new Audio(ref); clip.play().catch(() => {}); return new Promise((r) => { clip.onended = r; clip.onerror = r; }); } catch { return Promise.resolve(); }
}
export function stopClip() { try { clip && clip.pause(); } catch { /* ok */ } }

// ── Música generativa ──
const THEMES = {
  c1: { bpm: 104, root: 57, scale: [0, 3, 5, 7, 10, 12, 15, 17], pattern(s, t, sd) { // A menor pentatónica, juguetona
    if (s % 8 === 0 || s % 8 === 5) tone({ f: mtof(45), t: sd * 1.6, type: 'sine', v: .22, at: t - T(), bus: musBus });
    if (Math.random() < .62) tone({ f: mtof(this.root + 12 + this.scale[(Math.random() * this.scale.length) | 0]), t: sd * .9, type: 'triangle', v: .06, at: t - T(), bus: musBus, lp: 2600, r: .15 });
    if (s % 2) noise({ t: .03, v: .025, f: 7000, type: 'highpass', at: t - T(), bus: musBus });
    if (s % 16 === 0) [0, 7].forEach((i) => tone({ f: mtof(this.root + i), t: sd * 7, type: 'sine', v: .035, a: .6, r: 1.2, at: t - T(), bus: musBus })); } },
  c2: { bpm: 80, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], pattern(s, t, sd) { // acordes cálidos + caja de música
    const ch = this.chords[((s / 16) | 0) % 4];
    if (s % 16 === 0) ch.forEach((m, i) => { tone({ f: mtof(m - 12), t: sd * 15, type: 'triangle', v: .035, a: .9, r: 2, at: t - T(), bus: musBus, det: i * 4 }); });
    if (s % 2 === 0 && Math.random() < .7) tone({ f: mtof(ch[(Math.random() * 4) | 0] + 24), t: sd * 3, type: 'sine', v: .06, at: t - T(), bus: musBus, r: .4 }); } },
  c3: { bpm: 112, scale: [0, 2, 4, 7, 9], pattern(s, t, sd) { // percusión tribal + bordón
    const m = s % 16; const at = t - T();
    if ([0, 6, 8, 11].includes(m)) tone({ f: 160, t: .22, v: .26, slide: 55, at, bus: musBus });
    if ([3, 10, 14].includes(m)) tone({ f: 230, t: .15, v: .14, slide: 100, at, bus: musBus });
    if (s % 2 === 0) noise({ t: .05, v: .035, f: 6500, type: 'highpass', at, bus: musBus });
    if (s % 32 === 0) tone({ f: mtof(38), t: sd * 30, type: 'sawtooth', v: .035, a: 1.2, r: 2, at, bus: musBus, lp: 260 });
    if (m === 4 && Math.random() < .6) tone({ f: mtof(62 + this.scale[(Math.random() * 5) | 0]), t: sd * 4, v: .06, at, bus: musBus, vib: 6, vibRate: 5, a: .06 }); } },
  c4: { bpm: 64, chords: [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 57]], pattern(s, t, sd) { // arpegios suaves, lentos
    const ch = this.chords[((s / 16) | 0) % 4], at = t - T();
    if (s % 16 === 0) ch.slice(0, 3).forEach((m, i) => tone({ f: mtof(m - 12), t: sd * 15, type: 'sine', v: .05, a: 1.1, r: 2.2, at, bus: musBus, det: i * 3 }));
    if (s % 2 === 0) { const n = ch[(s / 2) % 4] + 12 + (((s / 8) | 0) % 2) * 12; tone({ f: mtof(n), t: sd * 5, type: 'sine', v: .075, at, bus: musBus, r: .6 }); tone({ f: mtof(n), t: sd * 2, type: 'triangle', v: .02, at, bus: musBus, r: .2 }); } } },
};
function scheduler() {
  const th = THEMES[theme]; if (!th || !ctx) return;
  const sd = 60 / th.bpm / 4; // semicorchea
  while (nextT < T() + .6) { try { th.pattern(step, nextT, sd); } catch { /* ok */ } nextT += sd; step++; }
}
function startTheme(id) {
  if (!ctx || !on.sound || !on.music || !THEMES[id]) return;
  stopMusicNodes(); theme = id; step = 0; nextT = T() + .1;
  musBus.gain.cancelScheduledValues(T()); musBus.gain.setValueAtTime(0.0001, T()); musBus.gain.linearRampToValueAtTime(.5, T() + 2.2);
  timer = setInterval(scheduler, 180);
}
function stopMusicNodes() { clearInterval(timer); timer = null; if (musicEl) { try { musicEl.pause(); } catch { /* ok */ } musicEl = null; } }
export function music(id, url) {
  theme = id; unlock();
  if (!on.music || !on.sound) return;
  if (url) { stopMusicNodes(); musicEl = new Audio(url); musicEl.loop = true; musicEl.volume = .45; musicEl.play().catch(() => {}); return; }
  startTheme(id);
}
export function stopMusic() { if (musBus && ctx) { musBus.gain.cancelScheduledValues(T()); musBus.gain.setTargetAtTime(0.0001, T(), .25); } setTimeout(() => { if (!on.music) stopMusicNodes(); }, 700); }
export function duck(on_) { if (musBus && ctx && timer) musBus.gain.setTargetAtTime(on_ ? .12 : .5, T(), .15); if (musicEl) musicEl.volume = on_ ? .1 : .45; }
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else if (on.sound) ctx.resume().catch(() => {}); });
