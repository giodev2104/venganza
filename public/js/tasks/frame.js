// Marco común de las pruebas: cabecera, ayudas progresivas, fallos con troleo, entrega de recompensas.
import { h, sleep, pick, vibrate } from '../util.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { online } from '../net.js';
import { state, save, addInventory, addHistory } from '../store.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import * as B from '../bouncers.js';
import { achieve, achieveDef } from '../achievements.js';
import { rt } from '../rt.js';
import { refreshHUD } from '../progress.js';

export async function runTask(c, stub, proof, idx, total, REG) {
  const info = await online(() => api('/api/task', { taskId: stub.id, proof }), 'cargar la prueba');
  const task = info.task, mod = REG[task.type];
  if (!mod) throw new Error('Tipo de prueba desconocido: ' + task.type);
  const ctx = makeCtx(c, task, info, proof);
  const f = buildFrame(task, idx, total, ctx);
  await ui.show(f.el);
  rt.currentCtx = ctx; ctx.f = f; ctx.armHelpTimer();
  let res;
  try { res = await Promise.race([mod.run(f.main, task, ctx), ctx.skipP]); }
  finally { ctx.dispose(); rt.currentCtx = null; }
  await present(c, task, res, f, ctx);
  return res;
}

function makeCtx(c, task, info, proof) {
  const S = state(), pub = rt.pub;
  let skipRes; const skipP = new Promise((r) => (skipRes = r));
  const diff = pub.settings.difficulty, mult = diff === 'easy' ? .5 : diff === 'hard' ? 2 : 1;
  const ctx = {
    task, st: info.st, proof, fails: 0, hintLevel: 0, assist: 0, attempts: {}, t0: Date.now(), f: null, listeners: new Set(), helpTimer: 0, skipP, disposed: false,
    onAssist(fn) { ctx.listeners.add(fn); },
    sfx: audio.sfx,
    achieve,
    async submit(payload, key = '') {
      const attempt = ctx.attempts[key] || 0;
      let res;
      try { res = await api('/api/answer', { taskId: task.id, proof, st: info.st, attempt, ...payload }); }
      catch (e) {
        if (e.offline) { ui.toast('Sin conexión: tu respuesta no se ha podido comprobar. Reintenta en cuanto tengas señal.', { icn: 'wifi-off', kind: 'bad', ms: 4200 }); return null; }
        throw e;
      }
      if (res.tooFast) return res;
      if (!res.ok) { ctx.attempts[key] = attempt + 1; await ctx.reportFail(res); }
      return res;
    },
    /** Reclama una prueba de minijuego; si el servidor pide esperar un poco (anti-trampas), reintenta en silencio. */
    async claim(extra) {
      for (let i = 0; i < 4; i++) {
        const r = await ctx.submit({ claim: extra }, 'claim');
        if (!r || !r.tooFast) return r;
        await sleep(Math.min(8000, r.wait || 800));
      }
      return null;
    },
    async reportFail(res) {
      ctx.fails++; c.fails++; S.stats.fails++; save();
      if (S.stats.fails === 1) achieve('primera_derrota'); if (S.stats.fails >= 12) achieve('experta');
      audio.sfx('fail'); vibrate(70);
      const every = Math.max(1, pub.settings.wrongOverlayEvery || 3);
      if (res.msg) {
        if ((ctx.fails - 1) % every === 0) { S.overlayN = (S.overlayN || 0) + 1; if (S.overlayN % 4 === 1) B.burst(3200, 5); save(); await ui.wrongOverlay(res.msg); }
        else ui.toast(`${res.msg.title}: ${res.msg.text}`, { kind: 'bad', ms: 3600 });
      }
      if (res.suggestHint || ctx.fails >= Math.max(1, Math.round(pub.settings.hintAfterFails * (diff === 'hard' ? 1.5 : diff === 'easy' ? .5 : 1)))) ctx.nudgeHelp();
    },
    nudgeHelp() { const b = ctx.f && ctx.f.help; if (b && !b.disabled) b.classList.add('pulse'); },
    armHelpTimer() { const ms = Math.max(8, pub.settings.hintDelaySec * mult) * 1000; ctx.helpTimer = setTimeout(ctx.nudgeHelp, ms); },
    async requestHint() {
      const level = Math.min(ctx.hintLevel + 1, task.hintCount);
      let text = '';
      try { text = (await api('/api/hint', { taskId: task.id, proof, level })).hint; }
      catch (e) { if (!e.offline) throw e; text = 'Sin conexión: respira, relee con calma y prueba otra vez. En cuanto vuelva la señal tendrás más pistas.'; }
      ctx.hintLevel = level; ctx.assist = level; c.hints++; S.stats.hints++; save();
      ctx.f.hints.append(h('div', { class: 'hint' }, h('b', null, 'Ayuda ' + level), h('span', null, text)));
      audio.sfx('pop');
      ctx.f.help.classList.remove('pulse'); ctx.updateHelpLabel();
      ctx.listeners.forEach((fn) => fn(level));
    },
    updateHelpLabel() {
      const b = ctx.f.help, left = task.hintCount - ctx.hintLevel;
      b.lastChild.textContent = left <= 0 ? 'Ya no hay más ayudas' : ctx.hintLevel ? `Otra ayuda (${left})` : 'Necesito ayuda';
      b.disabled = left <= 0;
    },
    dispose() { ctx.disposed = true; clearTimeout(ctx.helpTimer); audio.stopClip(); audio.duck(false); ctx.listeners.clear(); },
    skip: async () => { skipRes(await api('/api/answer', { taskId: task.id, proof, skip: true })); },
  };
  return ctx;
}

function buildFrame(task, idx, total, ctx) {
  const dots = Array.from({ length: total }, (_, i) => h('i', { class: i < idx ? 'done' : i === idx ? 'now' : '' }));
  const main = h('div', { class: 'task-main' }), hints = h('div', { class: 'hints', 'aria-live': 'polite' });
  const help = h('button', { class: 'help-btn', onclick: () => ctx.requestHint() }, h('span', { html: icon('lightbulb', 18) }), h('span', null, 'Necesito ayuda'));
  const noHelp = task.type === 'troll' || task.type === 'media';
  const el = ui.screen('task',
    h('header', { class: 'task-head' }, h('p', { class: 'kicker' }, `Prueba ${idx + 1}/${total}` + (task.kicker ? ' · ' + task.kicker : '')), h('div', { class: 'task-dots', 'aria-hidden': 'true' }, dots)),
    task.callout ? h('div', { class: 'callout', role: 'note' }, h('span', { html: icon('triangle-alert', 20) }), h('span', null, task.callout)) : null,
    task.intro ? h('p', { class: 'lede' }, task.intro) : null,
    main,
    noHelp ? null : h('footer', { class: 'task-foot' }, help, hints));
  return { el, main, hints, help };
}

async function present(c, task, res, f, ctx) {
  const S = state(), rw = res.reward || {}, frags = rw.fragments || [];
  for (const fr of frags) {
    c.frags[fr.slot] = { label: fr.label, value: fr.value };
    addInventory({ id: `${c.id}:f${fr.slot}`, kind: 'fragment', label: `${fr.label} · Capítulo ${c.meta.n}`, text: fr.value, chapter: c.meta.n });
  }
  if (rw.item) addInventory({ ...rw.item, kind: 'item' });
  if (rw.achievement) achieveDef(rw.achievement);
  if (task.type !== 'troll') addHistory({ chapter: c.meta.n, taskId: task.id, title: task.kicker || task.title, type: task.type });
  save(); refreshHUD();
  const revealText = res.revealShown ? '' : res.reveal;
  const extra = frags.length || rw.item || rw.text || revealText || res.explain;
  if (!extra) { if (task.type !== 'troll') { audio.sfx('success'); ui.toast(ui.cheer(rt.pub.trolls.cheer), { icn: 'check', kind: 'good', ms: 1500 }); await sleep(650); } return; }

  audio.sfx(frags.length ? 'unlock' : 'success');
  f.main.textContent = ''; if (f.help) f.help.parentElement.hidden = true;
  const box = h('div', { class: 'reward screen-enter' });
  if (revealText) box.append(h('p', { class: 'reveal-line' }, revealText));
  if (res.explain) box.append(h('p', { class: 'reveal-line' }, res.explain));
  frags.forEach((fr, i) => {
    const card = h('div', { class: 'reward-card', style: { animationDelay: i * .25 + 's' } }, h('span', { class: 'tag' }, `${fr.label} obtenida`), h('div', { class: 'reward-val shimmer' }, fr.value), h('p', { class: 'small muted', style: { margin: 0 } }, 'Guárdala: está en tu mochila y la necesitarás al final del capítulo.'));
    box.append(card); setTimeout(() => fx.sparkleAt(card, 22), 250 + i * 250);
  });
  if (rw.item) box.append(h('div', { class: 'inv-item' }, h('span', { class: 'inv-ic', html: icon('key', 20) }), h('div', null, h('b', null, rw.item.label), h('div', { class: 'small muted' }, rw.item.text))));
  if (rw.text) box.append(h('div', { class: 'callout' }, h('span', { html: icon('lightbulb', 20) }), h('span', null, rw.text)));
  const go = h('button', { class: 'btn' }, 'Seguir', h('span', { html: icon('arrow-right', 20) }));
  box.append(go); f.main.append(box); fx.confetti({ count: 50, y: innerHeight * .4 });
  await new Promise((r) => go.addEventListener('click', () => { audio.sfx('click'); r(); }, { once: true }));
}
