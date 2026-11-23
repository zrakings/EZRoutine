/* ============================================================
   EZRoutine — Shared UI helpers (icons, modal, toast, app bar)
   ============================================================ */
import { escapeHtml, $ } from './utils.js';
import { getSettings } from './storage.js';

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
  next: '<path d="m6 5 9 7-9 7ZM18 5v14"/>',
  prev: '<path d="m18 5-9 7 9 7ZM6 5v14"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 18v2h16v-2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-3v-.1A1.7 1.7 0 0 0 10.7 19a1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3h.1A1.7 1.7 0 0 0 7 10.7a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 11.6 5V5h3v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21v3h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-5-4-6-4-11-3 2-4 4-4 6-2-1-3-3-3-5-2 2-3 5-3 10a7 7 0 0 0 7 7Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  bellOff: '<path d="M8.7 4.2A6 6 0 0 1 18 8c0 3 .5 5 1.5 6.5M6 8c0 1.7-.5 3.2-1.2 4.5C4 14 3 15 3 17h12M10 21h4M3 3l18 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M13 16V8M18 16v-7"/>',
  heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/>',
  dumbbell: '<path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  tag: '<path d="M20 12 12 20 4 12V4h8Z"/><circle cx="8" cy="8" r="1.4"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M19 12a7 7 0 0 0-12-5L4 9M5 12a7 7 0 0 0 12 5l3-2"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5Z"/><path d="m9 12 2 2 4-4"/>',
  install: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  save: '<path d="M5 3h12l4 4v14H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  snooze: '<circle cx="12" cy="12" r="9"/><path d="M8 10h4l-4 4h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1-2-1-3 0-1 1-2 2-2h2a4 4 0 0 0 4-4A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  infoCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 0-2 2Z"/><path d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 1 2 2Z"/>'
};

export function icon(name, size = 20, extraClass = '') {
  const path = ICONS[name] || ICONS.info;
  return `<svg class="${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

/* ------------------------------ Toast ------------------------------ */
export function toast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  node.innerHTML = `${icon(type === 'error' ? 'warn' : 'check', 16)}<span>${escapeHtml(message)}</span>`;
  root.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, type === 'error' ? 3800 : 2600);
}

/* ------------------------------ Modal ------------------------------ */
let activeModal = null;

export function showModal({ title = '', content = '', buttons = [], onMount, className = '' } = {}) {
  closeModal();
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__scrim" data-modal-dismiss></div>
      <div class="modal__panel ${className}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="modal__handle"></div>
        ${title ? `<div class="modal__head"><div class="modal__title">${escapeHtml(title)}</div><button type="button" class="icon-btn" data-modal-dismiss aria-label="Tutup">${icon('close', 20)}</button></div>` : ''}
        <div class="modal__body">${content}</div>
        ${buttons.length ? `<div class="modal__foot">
          ${buttons.map((b, i) => `<button type="button" class="btn ${b.className || 'btn--outline'}" data-modal-btn="${i}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}
        </div>` : ''}
      </div>`;
    root.appendChild(wrap);
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      activeModal = null;
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      resolve(value);
    };
    const onKey = e => { if (e.key === 'Escape') finish(undefined); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => {
      if (e.target.closest('[data-modal-dismiss]')) finish(undefined);
      const btn = e.target.closest('[data-modal-btn]');
      if (btn) {
        const b = buttons[Number(btn.dataset.modalBtn)];
        if (!b) return;
        if (typeof b.onClick === 'function') b.onClick(finish, wrap);
        else finish(b.value ?? true);
      }
    });
    activeModal = { finish, wrap };
    if (typeof onMount === 'function') onMount(wrap, finish);
    const focusable = wrap.querySelector('input, textarea, select, button:not([data-modal-dismiss])');
    if (focusable) setTimeout(() => { try { focusable.focus(); } catch {} }, 120);
  });
}

export function closeModal() {
  if (activeModal) activeModal.finish(undefined);
}

export async function confirmDialog({ title = 'Konfirmasi', message = '', confirmLabel = 'Ya, lanjutkan', danger = false, cancelLabel = 'Batal' } = {}) {
  return showModal({
    title,
    content: `<p class="small muted" style="margin:0;line-height:1.6">${escapeHtml(message)}</p>`,
    buttons: [
      { label: cancelLabel, className: 'btn--outline', value: false },
      { label: confirmLabel, className: danger ? 'btn--danger' : 'btn--primary', value: true }
    ]
  });
}

export async function choiceDialog({ title = 'Pilih tindakan', message = '', choices = [] } = {}) {
  return showModal({
    title,
    content: `<p class="small muted" style="margin:0 0 12px;line-height:1.6">${escapeHtml(message)}</p>
      <div class="stack">${choices.map((c, i) => `<button type="button" class="btn ${c.className || 'btn--soft'} btn--block" data-choice="${i}" style="justify-content:flex-start">${icon(c.icon || 'arrowRight', 17)} ${escapeHtml(c.label)}</button>`).join('')}</div>`,
    buttons: [{ label: 'Batal', className: 'btn--outline', value: undefined }],
    onMount(wrap, finish) {
      wrap.addEventListener('click', e => {
        const b = e.target.closest('[data-choice]');
        if (b) finish(choices[Number(b.dataset.choice)].value);
      });
    }
  });
}

/* ------------------------------ App bar ------------------------------ */
export function setAppBar({ title, subtitle = '', actions = '' }) {
  const t = document.getElementById('app-bar-title');
  const s = document.getElementById('app-bar-subtitle');
  const a = document.getElementById('app-bar-actions');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
  if (a) a.innerHTML = actions;
}

export function themeToggleButton() {
  const theme = getSettings().theme;
  return `<button type="button" class="icon-btn" id="quick-theme" aria-label="Ganti tema" title="Ganti tema">${icon(theme === 'dark' ? 'sun' : 'moon', 21)}</button>`;
}

/* ------------------------------ Drawer ------------------------------ */
export function initDrawer() {
  const menu = document.getElementById('btn-menu');
  const drawer = document.getElementById('side-drawer');
  if (!menu || !drawer) return;
  const set = open => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
  };
  menu.addEventListener('click', () => set(true));
  drawer.addEventListener('click', e => {
    if (e.target.closest('[data-action="close-drawer"]') || e.target.closest('.drawer-link')) set(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
}

/* --------------------------- Small builders --------------------------- */
export function emptyState({ iconName = 'list', title, text = '', action = '' }) {
  return `<div class="empty">
    <div class="empty__icon">${icon(iconName, 32)}</div>
    <div class="empty__title">${escapeHtml(title)}</div>
    ${text ? `<div class="empty__text">${escapeHtml(text)}</div>` : ''}
    ${action}
  </div>`;
}

export function toggleSwitch(id, checked, label = '') {
  return `<label class="switch" ${label ? `aria-label="${escapeHtml(label)}"` : ''}>
    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
    <i></i>
  </label>`;
}
