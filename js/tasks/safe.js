// Caja fuerte numérica (validada en el servidor) y ordenar elementos (línea del tiempo).
import { h, sleep, vibrate } from '../util.js';
import { icon } from '../icons.js';
import * as audio from '../audio.js';
import * as fx from '../fx.js';
import { rt } from '../rt.js';

export function run(root, task, ctx) {
  return new Promise((resolve) => {
    let code = '';
    const n = task.digits;
    const slots = Array.from({ length: n }, () => h('span', { class: 'sf-digit' }));
    const led = h('i', { class: 'sf-led' });
    const handle = h('div', { class: 'sf-handle', 'aria-hidden': 'true' }, ...[0, 60, 120].map((a) => h('i', { style: { transform: `rotate(${a}deg)` } })));
    const open = h('button', { class: 'sf-key sf-go is-off', 'aria-label': 'Abrir' }, 'Abrir');
    const upd = () => { slots.forEach((s, i) => { s.textContent = code[i] || ''; s.classList.toggle('on', i === code.length); }); open.classList.toggle('is-off', code.length !== n); };
    const press = (d) => { if (code.length < n && !door.classList.contains('opened')) { code += d; audio.sfx('safeclick'); vibrate(8); upd(); } };
    const keys = '123456789'.split('').map((d) => h('button', { class: 'sf-key', onclick: () => press(d), 'aria-label': 'Cifra ' + d }, d));
    const del = h('button', { class: 'sf-key sf-del', 'aria-label': 'Borrar', onclick: () => { code = code.slice(0, -1); audio.sfx('safeclick'); upd(); } }, h('span', { html: icon('x', 20) }));
    const zero = h('button', { class: 'sf-key', onclick: () => press('0'), 'aria-label': 'Cifra 0' }, '0');
    const door = h('div', { class: 'safe' }, h('div', { class: 'sf-top' }, h('div', { class: 'sf-screen', 'aria-live': 'polite' }, slots), led, handle), h('div', { class: 'sf-pad' }, keys, del, zero, open));
    open.addEventListener('click', async () => {
      if (code.length !== n) return; door.classList.add('busy');
      const res = await ctx.submit({ answer: code }, 'safe'); door.classList.remove('busy');
      if (!res) return;
      if (!res.ok) { led.classList.add('bad'); fx.shake(door.querySelector('.sf-screen')); await sleep(700); led.classList.remove('bad'); code = ''; upd(); return; }
      led.classList.add('good'); door.classList.add('opened'); audio.sfx('safeopen'); vibrate([30, 40, 30]); fx.sparkleAt(handle, 26, '#5eead4'); await sleep(1500); resolve(res);
    });
    document.addEventListener('keydown', function kd(e) { if (ctx.disposed) return document.removeEventListener('keydown', kd); if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') { code = code.slice(0, -1); upd(); } else if (e.key === 'Enter') open.click(); });
    root.append(
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },
        h('h1', { class: 'h-lg q-prompt' }, task.prompt),
        door,
        h('button', { class: 'btn btn-ghost btn-sm', style: { alignSelf: 'center' }, onclick: () => rt.openBag && rt.openBag() }, h('span', { html: icon('backpack', 18) }), 'Abrir mi mochila')));
    upd();
  });
}

export function runOrder(root, task, ctx) {
  return new Promise((resolve) => {
    let items = task.items.slice();
    const list = h('ol', { class: 'ord' });
    const check = h('button', { class: 'btn' }, 'Comprobar el orden', h('span', { html: icon('check', 20) }));
    const render = (flash) => {
      list.textContent = '';
      items.forEach((it, i) => {
        const mv = (d) => { const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; audio.sfx('tap'); render(items[j].id); };
        list.append(h('li', { class: 'ord-item' + (it.id === flash ? ' flash' : '') },
          h('span', { class: 'ord-n' }, i + 1), h('span', { class: 'ord-t' }, it.text),
          h('span', { class: 'ord-btns' },
            h('button', { 'aria-label': 'Subir', disabled: i === 0, onclick: () => mv(-1) }, h('span', { html: icon('chevron-up', 20) })),
            h('button', { 'aria-label': 'Bajar', disabled: i === items.length - 1, onclick: () => mv(1) }, h('span', { html: icon('chevron-down', 20) })))));
      });
    };
    check.addEventListener('click', async () => {
      const res = await ctx.submit({ answer: items.map((x) => x.id) }, 'order'); if (!res) return;
      if (!res.ok) { fx.shake(list); return; }
      audio.sfx('match'); list.classList.add('ok'); await sleep(900); resolve(res);
    });
    root.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } }, h('h1', { class: 'h-lg q-prompt' }, task.prompt), h('p', { class: 'lede' }, 'Usa las flechas para mover cada recuerdo a su sitio.'), list, check));
    render();
  });
}
