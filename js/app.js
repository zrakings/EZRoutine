/* ============================================================
   EZRoutine — App bootstrap
   ============================================================ */
import { register, initRouter, navigate, currentRoute } from './router.js';
import { initDrawer, icon, toast } from './ui.js';
import { applyTheme, updateUserChrome, renderSettings } from './settings.js';
import { renderSchedule, checkActivityReminders, resetScheduleView } from './schedule.js';
import { renderWorkout, resetWorkoutState } from './workout.js';
import { renderAlarm, checkAlarms, checkMissedAlarmsOnOpen } from './alarm.js';
import { renderStats } from './statistics.js';
import { renderHome } from './home.js';
import { openDB } from './database.js';
import { getSettings, saveSettings, saveMeta } from './storage.js';
import { on } from './events.js';
import { toYMD, $, $$ } from './utils.js';
import { stopSound } from './audio.js';

let deferredInstallPrompt = null;

async function boot() {
  applyTheme();
  updateUserChrome();

  // Register routes
  register('home', renderHome);
  register('schedule', renderSchedule);
  register('workout', renderWorkout);
  register('alarm', renderAlarm);
  register('stats', renderStats);
  register('settings', renderSettings);

  initDrawer();
  bindGlobalEvents();
  initPWA();
  registerServiceWorker();

  try { await openDB(); }
  catch (err) { console.error(err); toast('Gagal membuka penyimpanan lokal. Beberapa fitur mungkin terbatas.', 'error'); }

  document.getElementById('app-shell').hidden = false;
  initRouter();
  hideSplash();

  // Periodic checks while app is open
  setInterval(() => { checkAlarms().catch(console.error); }, 20000);
  setInterval(() => { checkActivityReminders().catch(console.error); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAlarms().catch(console.error);
      checkActivityReminders().catch(console.error);
      checkMissedAlarmsOnOpen().catch(console.error);
    }
  });

  // Initial checks
  setTimeout(() => {
    checkAlarms().catch(console.error);
    checkActivityReminders().catch(console.error);
    checkMissedAlarmsOnOpen().catch(console.error);
  }, 1200);

  saveMeta({ lastOpen: Date.now() });
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => splash.classList.add('is-hidden'), 350);
  setTimeout(() => splash.remove(), 750);
}

function bindGlobalEvents() {
  // Bottom nav and drawer route buttons
  document.addEventListener('click', e => {
    const routeBtn = e.target.closest('[data-route]');
    if (routeBtn) {
      const route = routeBtn.dataset.route;
      if (route) { e.preventDefault(); navigate(route); }
      return;
    }
    if (e.target.closest('#quick-theme')) {
      const s = getSettings();
      saveSettings({ theme: s.theme === 'dark' ? 'light' : 'dark' });
      applyTheme();
      // update icon in place
      document.querySelectorAll('#quick-theme').forEach(btn => {
        btn.innerHTML = icon(getSettings().theme === 'dark' ? 'sun' : 'moon', 21);
      });
      toast(getSettings().theme === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif');
    }
  });

  // Re-render on data changes
  on('ez:data-changed', e => {
    const scope = e.detail?.scope || 'all';
    const route = currentRoute();
    const map = {
      activities: ['home', 'schedule', 'stats'],
      templates: ['schedule'],
      alarms: ['alarm', 'home'],
      audio: ['alarm', 'settings'],
      workout: ['workout', 'home', 'stats'],
      settings: ['home', 'schedule', 'workout', 'alarm', 'stats', 'settings'],
      all: ['home', 'schedule', 'workout', 'alarm', 'stats', 'settings']
    };
    const targets = map[scope] || map.all;
    if (targets.includes(route)) {
      // mild debounce by microtask
      clearTimeout(window.__rerenderT);
      window.__rerenderT = setTimeout(() => {
        import('./router.js').then(m => m.render());
      }, 60);
    }
  });

  // Backstop: stop preview sounds when modal closes
  document.addEventListener('click', e => {
    if (e.target.closest('[data-modal-dismiss]')) stopSound();
  });
}

function initPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    removeBanner('install');
    toast('EZRoutine berhasil di-install');
  });

  if (isStandalone()) return;
  // iOS/Safari has no beforeinstallprompt
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) showIosInstallHint();
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function bannerRoot() { return document.getElementById('pwa-banners'); }

function removeBanner(id) {
  document.querySelector(`[data-banner="${id}"]`)?.remove();
}

function showInstallBanner() {
  if (isStandalone() || document.querySelector('[data-banner="install"]')) return;
  const root = bannerRoot();
  const el = document.createElement('div');
  el.className = 'pwa-banner';
  el.dataset.banner = 'install';
  el.innerHTML = `<div class="pwa-banner__grow"><strong>Install EZRoutine</strong><p>Pasang di layar utama agar lebih cepat diakses.</p></div>
    <button type="button" class="btn btn--sm btn--primary" id="pwa-install-btn">Install</button>
    <button type="button" class="icon-btn" id="pwa-install-dismiss" aria-label="Tutup">${icon('close', 18)}</button>`;
  root.appendChild(el);
  el.querySelector('#pwa-install-btn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch {}
    deferredInstallPrompt = null;
    removeBanner('install');
  });
  el.querySelector('#pwa-install-dismiss').addEventListener('click', () => removeBanner('install'));
}

function showIosInstallHint() {
  if (localStorage.getItem('ezroutine.iosHint') === '1') return;
  const root = bannerRoot();
  const el = document.createElement('div');
  el.className = 'pwa-banner';
  el.dataset.banner = 'ios';
  el.innerHTML = `<div class="pwa-banner__grow"><strong>Install di iPhone/iPad</strong><p>Ketuk tombol Share, lalu pilih "Add to Home Screen".</p></div>
    <button type="button" class="icon-btn" id="ios-dismiss" aria-label="Tutup">${icon('close', 18)}</button>`;
  root.appendChild(el);
  el.querySelector('#ios-dismiss').addEventListener('click', () => {
    localStorage.setItem('ezroutine.iosHint', '1');
    removeBanner('ios');
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    // Update flow
    if (reg.waiting) showUpdateBanner(reg);
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(reg);
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__swRefreshing) return;
      window.__swRefreshing = true;
      window.location.reload();
    });
  } catch (err) {
    console.warn('SW registration failed', err);
  }
}

function showUpdateBanner(reg) {
  if (document.querySelector('[data-banner="update"]')) return;
  const root = bannerRoot();
  const el = document.createElement('div');
  el.className = 'pwa-banner';
  el.dataset.banner = 'update';
  el.innerHTML = `<div class="pwa-banner__grow"><strong>Update tersedia</strong><p>Versi baru EZRoutine siap digunakan.</p></div>
    <button type="button" class="btn btn--sm btn--primary" id="sw-update-btn">Perbarui</button>
    <button type="button" class="icon-btn" id="sw-update-dismiss" aria-label="Tutup">${icon('close', 18)}</button>`;
  root.appendChild(el);
  el.querySelector('#sw-update-btn').addEventListener('click', () => {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    removeBanner('update');
  });
  el.querySelector('#sw-update-dismiss').addEventListener('click', () => removeBanner('update'));
}

boot();
