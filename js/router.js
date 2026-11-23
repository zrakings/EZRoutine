/* ============================================================
   EZRoutine — Simple hash router
   ============================================================ */
import { $ } from './utils.js';

const routes = new Map();
let current = null;
let rendering = false;

export function register(path, handler) {
  routes.set(path, handler);
}

export function getRoute() {
  const hash = (location.hash || '#/home').replace(/^#\/?/, '');
  const path = hash.split(/[?#]/)[0].trim();
  return routes.has(path) ? path : 'home';
}

export async function navigate(path, { replace = false } = {}) {
  const target = `#/${path}`;
  if (replace) {
    const url = new URL(location.href);
    url.hash = target;
    history.replaceState(null, '', url);
    await render();
  } else {
    location.hash = target;
  }
}

export async function render() {
  if (rendering) return;
  rendering = true;
  try {
    const route = getRoute();
    current = route;
    const handler = routes.get(route) || routes.get('home');
    const main = $('#app-main');
    if (!main) return;
    document.querySelectorAll('.nav-item[data-route]').forEach(btn => {
      const active = btn.dataset.route === route;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    document.querySelectorAll('.drawer-link[data-route]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.route === route);
    });
    main.innerHTML = '<div class="page"><div class="card card--pad muted small">Memuat...</div></div>';
    await handler(main, { route });
    main.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    console.error(err);
    const main = $('#app-main');
    if (main) main.innerHTML = `<div class="page"><div class="card card--pad"><div class="bold">Terjadi kesalahan</div><p class="small muted" style="margin:8px 0 0">${String(err.message || err)}</p></div></div>`;
  } finally {
    rendering = false;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  render();
}

export function currentRoute() { return current; }
