/* ============================================================
   EZRoutine — Tiny app event bus (keeps modules decoupled)
   ============================================================ */
export function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}
export function on(name, handler) {
  document.addEventListener(name, handler);
  return () => document.removeEventListener(name, handler);
}
export function dataChanged(scope = 'all') {
  emit('ez:data-changed', { scope });
}
