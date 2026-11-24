// Pregunta(s): opción múltiple y respuesta escrita; admite audio y trolleos «todas parecen incorrectas».
import { h, sleep, shuffle } from '../util.js';
import { icon } from '../icons.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';

export async function run(root, task, ctx) {
  let rp = '';
  for (let i = 0; i < task.rounds.length; i++) {
    const res = await ask(root, task, ctx, i, rp);
    if (res.rp) rp = res.rp;
    if (res.done) {
      if (task.rounds.some((r) => r.sound) && ctx.fails === 0) ctx.achieve('oido');
      return res;
    }
  }
}

function ask(root, task, ctx, i, rp) {
  const r = task.rounds[i], total = task.rounds.length, key = 'r' + i;
  return new Promise((resolve) => {
    root.textContent = '';
    const head = h('div', { class: 'q-meta' }, total > 1 ? h('span', { class: 'kicker' }, `Pregunta ${i + 1} de ${total}`) : null);
    const prompt = r.prompt.split('\n'), title = h('h1', { class: 'h-lg q-prompt' }, prompt[0]);
    if (prompt[1]) title.append(h('span', { class: 'q-expr grad-text' }, prompt.slice(1).join(' ')));
    const sub = r.subtitle ? h('p', { class: 'lede' }, r.subtitle) : null;
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } }, head, title, sub);
    if (r.image) wrap.append(h('img', { class: 'q-img', src: r.image, alt: '' }));
    if (r.sound) {
      const btn = h('button', { class: 'sound-btn', 'aria-label': 'Escuchar el sonido' }, h('span', { class: 'play', html: icon('volume-2', 22) }), h('span', { class: 'bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')), h('span', null, 'Escuchar'));
      const play = async () => { if (btn.classList.contains('playing')) return; btn.classList.add('playing'); audio.unlock(); await audio.playRef(r.sound); btn.classList.remove('playing'); };
      btn.addEventListener('click', play); wrap.append(btn);
      if (r.sound.startsWith('synth:')) setTimeout(() => !ctx.disposed && play(), 700);
    }
    root.append(wrap);
    const busy = (b) => body.classList.toggle('busy', b);
    let body;
    const done = async (res, node) => {
      if (node) node.classList.add('ok'); audio.sfx('match'); fx.sparkleAt(node || wrap, 14, '#5eead4');
      await sleep(res.done ? 700 : 1000); resolve(res);
    };
    if (r.kind === 'text') {
      const input = h('input', { class: 'input', type: 'text', placeholder: r.placeholder || 'Escribe tu respuesta…', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Tu respuesta' });
      const btn = h('button', { class: 'btn' }, 'Comprobar', h('span', { html: icon('check', 20) }));
      body = h('div', { class: 'field' }, input, btn);
      const send = async () => {
        const v = input.value.trim(); if (!v) { fx.shake(input); return; }
        busy(true); const res = await ctx.submit({ round: i, answer: v, rp }, key); busy(false);
        if (!res) return; if (!res.ok) { fx.shake(input); input.select(); return; }
        input.disabled = true; await done(res, input);
      };
      btn.addEventListener('click', send); input.addEventListener('keydown', (e) => e.key === 'Enter' && send());
      root.append(body); setTimeout(() => input.focus({ preventScroll: true }), 350);
    } else {
      const opts = task.shuffle ? shuffle(r.options) : r.options;
      body = h('div', { class: 'opts', role: 'group', 'aria-label': 'Opciones' });
      opts.forEach((o, k) => {
        const b = h('button', { class: 'opt' }, h('span', { class: 'opt-key' }, 'ABCDEF'[k]), h('span', { class: 'opt-text' }, o.text));
        b.addEventListener('click', async () => {
          audio.sfx('tap'); busy(true);
          const res = await ctx.submit({ round: i, answer: o.id, rp }, key); busy(false);
          if (!res) return;
          if (!res.ok) { b.classList.add('no'); fx.shake(b); setTimeout(() => b.classList.remove('no'), 900); return; }
          body.classList.add('busy'); await done(res, b);
        });
        body.append(b);
      });
      root.append(body);
    }
  });
}
