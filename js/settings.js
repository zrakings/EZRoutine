/* ============================================================
   EZRoutine — Settings
   ============================================================ */
import { getSettings, saveSettings, resetSettings, ACCENTS } from './storage.js';
import { exportData, importData, clearAllData, storageEstimate } from './database.js';
import { escapeHtml, $, downloadJSON, readTextFile, safeParse, hexToRgb } from './utils.js';
import { BUILTIN_SOUNDS, playSound, stopSound, soundLabel } from './audio.js';
import { icon, toast, showModal, confirmDialog, setAppBar, themeToggleButton } from './ui.js';
import { requestNotificationPermission, permissionStatus } from './notifications.js';
import { openSoundManager, getCustomSounds } from './alarm.js';
import { APP_VERSION } from './constants.js';
import { dataChanged } from './events.js';

export function applyTheme() {
  const s = getSettings();
  const html = document.documentElement;
  html.setAttribute('data-theme', s.theme === 'light' ? 'light' : 'dark');
  const accent = s.accent || '#7c8cff';
  const accent2 = s.accent2 || '#00d4b1';
  const [r, g, b] = hexToRgb(accent);
  const [r2, g2, b2] = hexToRgb(accent2);
  html.style.setProperty('--accent', accent);
  html.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  html.style.setProperty('--accent-2', accent2);
  html.style.setProperty('--accent-2-rgb', `${r2}, ${g2}, ${b2}`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', s.theme === 'light' ? '#f4f6fd' : '#0b1020');
}

export function updateUserChrome() {
  const s = getSettings();
  const name = s.name || 'Pengguna';
  const avatar = document.getElementById('drawer-avatar');
  const drawerName = document.getElementById('drawer-name');
  if (avatar) avatar.textContent = name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2) || 'EZ';
  if (drawerName) drawerName.textContent = name;
}

function settingsSection(title, iconName, body) {
  return `<section class="card card--pad">
    <div class="card__head" style="margin-bottom:4px">
      <div class="list-row__icon" style="width:36px;height:36px;border-radius:12px">${icon(iconName, 18)}</div>
      <div class="card__title">${escapeHtml(title)}</div>
    </div>
    ${body}
  </section>`;
}

function row(label, hint, control) {
  return `<div class="setting-row">
    <div class="setting-row__body"><div class="setting-row__label">${label}</div>${hint ? `<div class="setting-row__hint">${hint}</div>` : ''}</div>
    <div>${control}</div>
  </div>`;
}

export async function renderSettings(root) {
  const s = getSettings();
  await getCustomSounds();
  const customSounds = await import('./database.js').then(m => m.getAll('audio'));
  const est = await storageEstimate();
  const used = est ? `${(est.usage / (1024 * 1024)).toFixed(1)} MB dipakai` : 'Estimasi tidak tersedia';
  const notif = permissionStatus();

  setAppBar({
    title: 'Pengaturan',
    subtitle: 'Personalisasi EZRoutine',
    actions: themeToggleButton()
  });

  const accentOptions = ACCENTS.map(a => `<button type="button" class="color-swatch ${s.accent === a.value ? 'is-active' : ''}" style="--c:${a.value}" data-accent="${a.value}" data-accent2="${a.second}" aria-label="${escapeHtml(a.name)}" title="${escapeHtml(a.name)}"></button>`).join('');
  const soundOpts = BUILTIN_SOUNDS.map(o => `<option value="${o.id}" ${s.defaultSound === o.id ? 'selected' : ''}>${o.name}</option>`).join('')
    + (customSounds.length ? `<optgroup label="Kustom">${customSounds.map(c => `<option value="custom:${c.id}" ${s.defaultSound === `custom:${c.id}` ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</optgroup>` : '');

  root.innerHTML = `<div class="page">
    ${settingsSection('Umum', 'user', `
      ${row('Nama pengguna', 'Ditampilkan di sapaan dan drawer.', `<input id="set-name" class="input" style="width:min(180px,42vw)" maxlength="30" value="${escapeHtml(s.name || '')}">`)}
      ${row('Bahasa', 'Saat ini bahasa Indonesia.', `<select id="set-lang" class="select" style="width:150px"><option value="id" selected>Indonesia</option></select>`)}
      ${row('Format waktu', 'Tampilan jam 12 atau 24 jam.', `<select id="set-timefmt" class="select" style="width:130px"><option value="24" ${s.timeFormat==='24'?'selected':''}>24 jam</option><option value="12" ${s.timeFormat==='12'?'selected':''}>12 jam</option></select>`)}
      ${row('Tema', 'Pilih mode gelap atau terang.', `<select id="set-theme" class="select" style="width:130px"><option value="dark" ${s.theme==='dark'?'selected':''}>Gelap</option><option value="light" ${s.theme==='light'?'selected':''}>Terang</option></select>`)}
      <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:10px">
        <div class="setting-row__body"><div class="setting-row__label">Warna aksen</div><div class="setting-row__hint">Mengubah nuansa warna aplikasi.</div></div>
        <div class="color-grid">${accentOptions}</div>
      </div>
    `)}

    ${settingsSection('Alarm', 'bell', `
      ${row('Volume default', `Volume awal alarm baru: <span id="set-vol-val">${s.defaultVolume}%</span>`, `<input id="set-vol" type="range" min="0" max="100" value="${s.defaultVolume}" class="range" style="width:min(180px,42vw);--fill:${s.defaultVolume}%">`)}
      ${row('Suara default', 'Digunakan saat membuat alarm baru.', `<select id="set-sound" class="select" style="width:min(200px,46vw)">${soundOpts}</select>`)}
      ${row('Durasi snooze', 'Tunda alarm saat berbunyi.', `<select id="set-snooze" class="select" style="width:130px">${[5,10,15,20,30].map(m=>`<option value="${m}" ${Number(s.snoozeMin)===m?'selected':''}>${m} menit</option>`).join('')}</select>`)}
      ${row('Notifikasi', `Status browser: ${escapeHtml(notif)}.`, `<label class="switch"><input type="checkbox" id="set-notif" ${s.notifications?'checked':''}><i></i></label>`)}
      ${row('Getar (jika didukung)', 'Untuk notifikasi di perangkat yang mendukung.', `<label class="switch"><input type="checkbox" id="set-vib" ${s.vibration?'checked':''}><i></i></label>`)}
      <div class="row" style="gap:8px;flex-wrap:wrap;padding-top:12px">
        <button type="button" class="btn btn--soft btn--sm" id="set-preview">${icon('play',15)} Preview</button>
        <button type="button" class="btn btn--outline btn--sm" id="set-preview-stop">${icon('stop',15)} Stop</button>
        <button type="button" class="btn btn--outline btn--sm" id="set-sounds">${icon('music',15)} Kelola Suara Kustom</button>
        <button type="button" class="btn btn--outline btn--sm" id="set-notif-req">${icon('bell',15)} Minta Izin Notifikasi</button>
      </div>
    `)}

    ${settingsSection('Olahraga', 'dumbbell', `
      ${row('Target mingguan', 'Berapa sesi per minggu yang kamu inginkan.', `<input id="set-goal" type="number" min="1" max="21" class="input" style="width:90px" value="${s.weeklyGoal || 5}">`)}
      ${row('Durasi default', 'Durasi awal saat membuat rencana baru.', `<div class="row" style="gap:6px"><input id="set-wo-dur" type="number" min="5" max="240" step="5" class="input" style="width:90px" value="${s.defaultWorkoutMin || 30}"><span class="tiny dim">menit</span></div>`)}
    `)}

    ${settingsSection('Data', 'database', `
      <div class="info-note" style="margin:8px 0 4px">${icon('info',18)}<div>Data disimpan lokal di perangkat ini. Export JSON untuk backup atau pindah perangkat. <span class="dim">${escapeHtml(used)}.</span></div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;padding-top:10px">
        <button type="button" class="btn btn--primary btn--sm" id="set-export">${icon('download',15)} Export JSON</button>
        <button type="button" class="btn btn--soft btn--sm" id="set-import-btn">${icon('upload',15)} Import JSON</button>
        <input type="file" id="set-import" accept="application/json,.json" class="hidden">
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap;padding-top:8px">
        <button type="button" class="btn btn--danger btn--sm" id="set-reset">${icon('trash',15)} Reset Aplikasi</button>
      </div>
    `)}

    ${settingsSection('Tentang', 'infoCircle', `
      <div class="stack" style="gap:0">
        <div class="setting-row"><div class="setting-row__body"><div class="setting-row__label">Aplikasi</div></div><div class="small muted">EZRoutine</div></div>
        <div class="setting-row"><div class="setting-row__body"><div class="setting-row__label">Versi</div></div><div class="small muted mono">v${APP_VERSION}</div></div>
        <div class="setting-row"><div class="setting-row__body"><div class="setting-row__label">Developer</div></div><div class="small muted">EZRoutine Team</div></div>
        <div class="setting-row" style="border:0"><div class="setting-row__body"><div class="setting-row__label">Privasi</div><div class="setting-row__hint">Tidak ada akun, tidak ada server, tidak ada tracking. Semua data tetap di perangkat Anda.</div></div></div>
      </div>
    `)}
  </div>`;

  bindSettingsEvents(root);
}

function bindSettingsEvents(root) {
  const on = (sel, ev, fn) => { const el = $(sel, root); if (el) el.addEventListener(ev, fn); };
  const persist = patch => { saveSettings(patch); applyTheme(); updateUserChrome(); dataChanged('settings'); };

  on('#set-name', 'change', e => { persist({ name: e.target.value.trim() || 'Pengguna' }); toast('Nama disimpan'); });
  on('#set-lang', 'change', e => persist({ language: e.target.value }));
  on('#set-timefmt', 'change', e => { persist({ timeFormat: e.target.value }); toast('Format waktu diperbarui'); });
  on('#set-theme', 'change', e => { persist({ theme: e.target.value }); toast('Tema diperbarui'); });
  on('#set-vol', 'input', e => {
    const v = Number(e.target.value);
    e.target.style.setProperty('--fill', `${v}%`);
    $('#set-vol-val', root).textContent = `${v}%`;
  });
  on('#set-vol', 'change', e => persist({ defaultVolume: Number(e.target.value) }));
  on('#set-sound', 'change', e => persist({ defaultSound: e.target.value }));
  on('#set-snooze', 'change', e => persist({ snoozeMin: Number(e.target.value) }));
  on('#set-notif', 'change', e => persist({ notifications: e.target.checked }));
  on('#set-vib', 'change', e => persist({ vibration: e.target.checked }));
  on('#set-goal', 'change', e => persist({ weeklyGoal: Math.max(1, Math.min(21, Number(e.target.value) || 5)) }));
  on('#set-wo-dur', 'change', e => persist({ defaultWorkoutMin: Math.max(5, Math.min(240, Number(e.target.value) || 30)) }));

  root.querySelectorAll('[data-accent]').forEach(btn => btn.addEventListener('click', () => {
    persist({ accent: btn.dataset.accent, accent2: btn.dataset.accent2 });
    root.querySelectorAll('[data-accent]').forEach(b => b.classList.toggle('is-active', b === btn));
    toast('Warna aksen diperbarui');
  }));

  on('#set-preview', 'click', async () => {
    const s = getSettings();
    try { await playSound($('#set-sound', root)?.value || s.defaultSound, { volume: Number($('#set-vol', root)?.value ?? s.defaultVolume), loop: false }); }
    catch (err) { toast(err.message, 'error'); }
  });
  on('#set-preview-stop', 'click', () => stopSound());
  on('#set-sounds', 'click', () => openSoundManager());
  on('#set-notif-req', 'click', async () => {
    const ok = await requestNotificationPermission();
    toast(ok ? 'Notifikasi diizinkan' : 'Izin tidak diberikan / tidak didukung', ok ? 'success' : 'error');
  });

  on('#set-export', 'click', async () => {
    try {
      const data = await exportData();
      downloadJSON(data, `ezroutine-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Backup JSON berhasil diunduh');
    } catch (err) { toast(err.message || 'Gagal export', 'error'); }
  });

  on('#set-import-btn', 'click', () => $('#set-import', root).click());
  on('#set-import', 'change', async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const parsed = safeParse(text);
      if (!parsed) { toast('File JSON tidak valid', 'error'); return; }
      const choice = await (await import('./ui.js')).choiceDialog({
        title: 'Import Data',
        message: 'Pilih cara import. "Ganti semua data" akan menghapus data lama sebelum import. "Gabungkan" mempertahankan data lokal yang sudah ada.',
        choices: [
          { label: 'Ganti semua data', value: 'replace', icon: 'refresh', className: 'btn--danger' },
          { label: 'Gabungkan data', value: 'merge', icon: 'layers', className: 'btn--soft' }
        ]
      });
      if (!choice) return;
      const ok = await confirmDialog({ title: 'Lanjutkan import?', message: choice === 'replace' ? 'Semua data lokal saat ini akan diganti dengan data dari file backup.' : 'Data dari backup akan digabungkan. Item dengan ID sama tidak ditimpa.', confirmLabel: 'Import', danger: choice === 'replace' });
      if (!ok) return;
      const counts = await importData(parsed, choice);
      applyTheme(); updateUserChrome();
      toast(`Import berhasil (${Object.values(counts).reduce((a,b)=>a+b,0)} item)`);
      dataChanged('all');
      renderSettings(root);
    } catch (err) { toast(err.message || 'Gagal import', 'error'); }
  });

  on('#set-reset', 'click', async () => {
    const ok = await confirmDialog({
      title: 'Reset seluruh aplikasi?',
      message: 'Semua jadwal, alarm, riwayat olahraga, suara kustom, dan pengaturan akan dihapus permanen dari perangkat ini. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Ya, hapus semua',
      danger: true
    });
    if (!ok) return;
    await clearAllData({ keepSettings: false });
    stopSound();
    applyTheme(); updateUserChrome();
    toast('Aplikasi direset');
    dataChanged('all');
    location.hash = '#/home';
    setTimeout(() => location.reload(), 300);
  });
}
