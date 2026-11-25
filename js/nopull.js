// Evita «tirar para recargar» (Chrome Android): se cancela el arrastre hacia abajo cuando no hay nada que desplazar o el contenido ya está arriba del todo.
let y0 = 0;
function scrollerOf(el) {
  for (; el && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
  }
  return null;
}
addEventListener('touchstart', (e) => { if (e.touches.length === 1) y0 = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (e.touches.length !== 1 || !e.cancelable) return;
  const dy = e.touches[0].clientY - y0, s = scrollerOf(e.target);
  if (!s || (dy > 0 && s.scrollTop <= 0)) e.preventDefault();
}, { passive: false });
