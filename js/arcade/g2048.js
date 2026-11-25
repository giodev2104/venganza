// 2048 con fichas que se deslizan, fusiones con rebote, deshacer y récord.
import { h } from '../util.js';
import { swipe, onKeys } from './kit.js';
import * as audio from '../audio.js';

export function g2048(box, ui) {
  const N = 4; let grid, score = 0, undo = null, won = false, locked = false, uid = 0;
  const layer = h('div', { class: 'g48-layer' }), board = h('div', { class: 'g48-board' }, Array.from({ length: 16 }, () => h('i', { class: 'g48-cell' })), layer);
  const undoBtn = h('button', { class: 'btn btn-ghost g48-undo', disabled: true, onclick: () => doUndo() }, 'Deshacer');
  const wrap = h('div', { class: 'g48' }, board, h('div', { class: 'g48-bar' }, undoBtn, h('span', { class: 'g48-tip' }, 'Une fichas iguales hasta llegar a 2048')));
  box.append(wrap);
  const pos = (t) => { t.el.style.setProperty('--r', t.r); t.el.style.setProperty('--c', t.c); };
  const label = (t) => { t.el.className = 'g48-t v' + Math.min(t.v, 4096); t.el.firstChild.textContent = t.v; };
  function mk(r, c, v, spawn) { const t = { id: ++uid, r, c, v, el: h('div', { class: 'g48-t' }, h('span')) }; label(t); pos(t); if (spawn) t.el.classList.add('new'); layer.append(t.el); grid[r][c] = t; return t; }
  function build(vals) { layer.textContent = ''; grid = Array.from({ length: N }, () => Array(N).fill(null)); vals.forEach((row, r) => row.forEach((v, c) => { if (v) mk(r, c, v); })); }
  const snap = () => grid.map((row) => row.map((t) => (t ? t.v : 0)));
  function addRandom() { const e = []; grid.forEach((row, r) => row.forEach((t, c) => { if (!t) e.push([r, c]); })); if (!e.length) return; const [r, c] = e[Math.floor(Math.random() * e.length)]; mk(r, c, Math.random() < .9 ? 2 : 4, true); }
  const canMove = () => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const t = grid[r][c]; if (!t) return true; if (c + 1 < N && grid[r][c + 1] && grid[r][c + 1].v === t.v) return true; if (r + 1 < N && grid[r + 1][c] && grid[r + 1][c].v === t.v) return true; } return false; };
  function move(d) {
    if (locked) return; const [dr, dc] = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[d], rs = [0, 1, 2, 3], cs = [0, 1, 2, 3];
    if (dr === 1) rs.reverse(); if (dc === 1) cs.reverse();
    const before = { vals: snap(), score }; let moved = false, gain = 0; const merged = [], gone = [];
    for (const r of rs) for (const c of cs) {
      const t = grid[r][c]; if (!t) continue; let nr = r, nc = c;
      while (nr + dr >= 0 && nr + dr < N && nc + dc >= 0 && nc + dc < N && !grid[nr + dr][nc + dc]) { nr += dr; nc += dc; }
      const nx = nr + dr >= 0 && nr + dr < N && nc + dc >= 0 && nc + dc < N ? grid[nr + dr][nc + dc] : null;
      if (nx && nx.v === t.v && !nx.m) { grid[r][c] = null; nx.m = true; nx.v *= 2; gain += nx.v; t.r = nx.r; t.c = nx.c; pos(t); gone.push(t); merged.push(nx); moved = true; }
      else if (nr !== r || nc !== c) { grid[r][c] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; pos(t); moved = true; }
    }
    if (!moved) { board.classList.remove('nope'); void board.offsetWidth; board.classList.add('nope'); return; }
    undo = before; undoBtn.disabled = false; score += gain; ui.score(score); locked = true;
    audio.sfx(merged.length ? 'match' : 'tap');
    setTimeout(() => {
      gone.forEach((t) => t.el.remove()); merged.forEach((t) => { t.m = false; label(t); t.el.classList.add('pop'); setTimeout(() => t.el.classList.remove('pop'), 220); });
      addRandom(); locked = false;
      const top = Math.max(...snap().flat());
      if (top >= 2048 && !won) { won = true; audio.sfx('success'); ui.toast('¡Has llegado a 2048! Puedes seguir jugando.'); }
      if (!canMove()) { audio.sfx('fail'); setTimeout(() => ui.over(score, 'Ficha máxima: ' + top), 500); }
    }, 115);
  }
  function doUndo() { if (!undo || locked) return; build(undo.vals); score = undo.score; ui.score(score); undo = null; undoBtn.disabled = true; audio.sfx('flip'); }
  build(Array.from({ length: N }, () => Array(N).fill(0))); addRandom(); addRandom(); ui.score(0);
  swipe(board, move, 24);
  const off = onKeys({ ArrowUp: () => move('up'), ArrowDown: () => move('down'), ArrowLeft: () => move('left'), ArrowRight: () => move('right'), w: () => move('up'), s: () => move('down'), a: () => move('left'), d: () => move('right') });
  return () => { off(); wrap.remove(); };
}
