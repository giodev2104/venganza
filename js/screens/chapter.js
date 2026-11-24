// Máquina de estados de un capítulo: tarjeta de título → historia → pruebas → ensamblado → ubicación → revelación → falso final.
import { h, sleep, skipper, typewriter } from '../util.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { online } from '../net.js';
import * as ui from '../ui.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import { state, save, cs } from '../store.js';
import { rt } from '../rt.js';
import { refreshHUD } from '../progress.js';
import { runTask } from '../tasks/frame.js';
import { REGISTRY } from '../tasks/index.js';
import { assembleStage } from './assemble.js';
import { locationStage } from './location.js';
import { revealStage } from './reveal.js';
import { fakeEnding } from './fake.js';

const STAGES = ['story', 'tasks', 'assemble', 'location', 'reveal', 'fake', 'done'];

async function titleCard(m) {
  const el = h('div', { class: 'title-card', 'aria-live': 'polite' }, h('div', null, h('p', { class: 'kicker tc-kicker' }, m.kicker || `Regalo ${m.n}`), h('h1', { class: 'h-xl tc-title' }, m.title), h('div', { class: 'tc-rule' }), h('p', { class: 'tc-sub' }, m.subtitle)));
  document.getElementById('app').append(el); audio.sfx('reveal');
  await new Promise((r) => { const end = () => r(); el.addEventListener('pointerdown', end, { once: true }); setTimeout(end, 3600); });
  el.classList.add('out'); await sleep(650); el.remove();
}

function storyStage(c) {
  return new Promise(async (resolve) => {
    const m = c.meta, box = h('div', { class: 'story' }), go = h('button', { class: 'btn', hidden: true }, 'Vamos', h('span', { html: icon('arrow-right', 20) }));
    go.addEventListener('click', () => { audio.sfx('click'); resolve(); });
    await ui.show(ui.screen('center', h('p', { class: 'kicker' }, m.kicker || `Regalo ${m.n}`), h('h1', { class: 'h-lg' }, m.title), box, go));
    const sk = skipper(document);
    for (const p of m.story || []) { const e = h('p', { class: 'story-p caret' }); box.append(e); await typewriter(e, p, { speed: 22, sk }); e.classList.remove('caret'); await sk.sleep(380); }
    sk.stop(); go.hidden = false; go.classList.add('fade-up');
  });
}

/** Juega (o reanuda) un capítulo. Resuelve cuando el capítulo queda completado. */
export async function playChapter(id, prevCd) {
  const S = state(), c = cs(id); c.id = id;
  if (!c.opened || !c.meta) {
    const res = await online(() => api('/api/chapter/open', { chapterId: id, proof: prevCd || '' }), 'abrir el capítulo');
    c.meta = res.chapter; c.tokens.co = res.co; c.opened = true; c.stage = 'story'; c.startedAt = c.startedAt || Date.now(); save();
  }
  const m = c.meta; rt.chapterCtl = { id };
  ui.setTheme(m.theme, { quiet: false }); audio.music(m.theme, m.music || undefined); refreshHUD(); ui.HUD.show();
  let idx = Math.max(0, STAGES.indexOf(c.stage));
  const go = (s) => { c.stage = s; idx = STAGES.indexOf(s); save(); };
  if (c.stage === 'story' && !c.titleSeen) { await titleCard(m); c.titleSeen = true; save(); }

  while (c.stage !== 'done') {
    switch (c.stage) {
      case 'story': await storyStage(c); go('tasks'); break;
      case 'tasks': {
        for (let i = c.taskIdx || 0; i < m.tasks.length; i++) {
          const stub = m.tasks[i], proof = i === 0 ? c.tokens.co : c.tokens.td[m.tasks[i - 1].id];
          const res = await runTask(c, stub, proof, i, m.tasks.length, REGISTRY);
          if (res && res.token) c.tokens.td[stub.id] = res.token;
          c.taskIdx = i + 1; save(); refreshHUD();
        }
        go('assemble'); break;
      }
      case 'assemble': await assembleStage(c); go('location'); break;
      case 'location': await locationStage(c, { afterRestore: !!c.locationSeen }); c.locationSeen = true; go('reveal'); break;
      case 'reveal': {
        await revealStage(c);
        c.done = true; c.finishedAt = Date.now(); save(); refreshHUD();
        go(c.reveal.fakeEnding ? 'fake' : 'done'); break;
      }
      case 'fake': await fakeEnding(c); go('done'); refreshHUD(); break;
      default: c.stage = 'done';
    }
  }
  rt.chapterCtl = null; fx.clearFx();
}
