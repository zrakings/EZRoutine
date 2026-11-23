/* ============================================================
   EZRoutine — Smart alarm (in-app) + custom audio + volume
   Browser PWA limitation: alarm ringing sound plays while app is
   open/visible or resumed. Notification API is used when possible.
   No background audio is promised from service worker.
   ============================================================ */
import { getAll, put, remove, get as dbGet } from './database.js';
import { $, $$, escapeHtml, uid, toYMD, fmtTime, pad2, dayShort, dayNames, timeToMinutes } from './utils.js';
import { BUILTIN_SOUNDS, playSound, stopSound, soundLabel } from './audio.js';
import { icon, toast, showModal, confirmDialog, emptyState, setAppBar, themeToggleButton } from './ui.js';
import { showNotification, requestNotificationPermission, permissionStatus, clearNotifications } from './notifications.js';
import { dataChanged } from './events.js';
import { getSettings, saveSettings } from './storage.js';

const ALARM_LAST_KEY = 'ezroutine.alarm.last.v1';
const MISSED_KEY = 'ezroutine.alarm.missed.v1';
const SNOOZE_KEY = 'ezroutine.alarm.snooze.v1';

let boundRoot = null;
let ringing = null; // { alarm, firedAt, audio, snoozeTimer, type: 'alarm'|'snooze' }
let customSoundsCache = [];

export async function getCustomSounds() {
  customSoundsCache = await getAll('audio');
  return customSoundsCache;
}

function readMap(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
function writeMap(key, obj) {
  const keys = Object.keys(obj).sort().slice(-500);
  const trimmed = {};
  keys.forEach(k => { trimmed[k] = obj[k]; });
  try { localStorage.setItem(key, JSON.stringify(trimmed)); } catch {}
}

/* --------------------------- Data --------------------------- */

export async function getAlarms() {
  return (await getAll('alarms')).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function alarmShouldFireToday(alarm, now = new Date()) {
  if (!alarm.enabled) return false;
  const day = now.getDay();
  const date = toYMD(now);
  switch (alarm.repeatType) {
    case 'daily': return true;
    case 'weekly': return (alarm.days || []).includes(day);
    case 'date': return alarm.date === date;
    case 'once':
    default:
      // once: fire on its created/target day; we use date field if present else always eligible once
      return alarm.date ? alarm.date === date : true;
  }
}

function nextFireKey(alarm, now = new Date()) {
  return `${alarm.id}|${toYMD(now)}|${alarm.time}`;
}

function repeatText(alarm) {
  if (alarm.repeatType === 'daily') return 'Setiap hari';
  if (alarm.repeatType === 'weekly') return (alarm.days || []).length === 7 ? 'Setiap hari' : (alarm.days || []).map(d => dayShort[d]).join(', ') || 'Hari tertentu';
  if (alarm.repeatType === 'date') return `Tanggal ${alarm.date || '—'}`;
  if (alarm.date) return `Sekali · ${alarm.date}`;
  return 'Sekali';
}

/* --------------------------- Ringing --------------------------- */

function stopRingingAudio() {
  stopSound();
}

export function stopCurrentRinging() {
  if (!ringing) return;
  if (ringing.snoozeTimer) clearTimeout(ringing.snoozeTimer);
  stopRingingAudio();
  const root = document.getElementById('ring-root');
  if (root) root.innerHTML = '';
  ringing = null;
  clearNotifications('alarm-ring');
}

async function showRinging(alarm, { label = 'Alarm aktif', snooze = true } = {}) {
  stopCurrentRinging();
  const settings = getSettings();
  const volume = Number.isFinite(Number(alarm.volume)) ? Number(alarm.volume) : settings.defaultVolume;
  const soundId = alarm.soundId || settings.defaultSound || 'builtin:rise';
  ringing = { alarm, startedAt: Date.now(), type: label };
  const root = document.getElementById('ring-root');

  root.innerHTML = `<div class="ring-overlay" role="dialog" aria-modal="true" aria-label="Alarm berbunyi">
    <div class="ring-overlay__label">⏰ ${escapeHtml(label)}</div>
    <div class="ring-overlay__clock mono" id="ring-clock">${fmtTime(new Date().toTimeString().slice(0, 5), { withSuffix: true })}</div>
    <div class="ring-overlay__name">${escapeHtml(alarm.name || 'Alarm')}</div>
    <div class="ring-overlay__label">${escapeHtml(repeatText(alarm))} · ${escapeHtml(soundLabel(soundId, customSoundsCache))}</div>
    <div class="ring-overlay__actions">
      ${snooze ? `<button type="button" class="btn btn--soft btn--lg" id="ring-snooze">${icon('snooze', 18)} Tunda ${settings.snoozeMin} mnt</button>` : ''}
      <button type="button" class="btn btn--primary btn--lg" id="ring-stop">${icon('stop', 18)} Matikan</button>
    </div>
    <div class="tiny dim" style="position:relative;max-width:360px;line-height:1.5">Tombol Tunda akan mengingatkan lagi dalam ${settings.snoozeMin} menit.</div>
  </div>`;

  const tick = () => {
    const el = document.getElementById('ring-clock');
    if (el) el.textContent = fmtTime(new Date().toTimeString().slice(0, 5), { withSuffix: true });
  };
  const clockTimer = setInterval(() => { if (!ringing) { clearInterval(clockTimer); return; } tick(); }, 1000);
  tick();

  try {
    await playSound(soundId, { volume, loop: true });
  } catch (err) {
    toast('Audio alarm tidak bisa diputar otomatis. Ketuk layar atau tombol untuk mencoba lagi.', 'error');
  }

  const snoozeBtn = document.getElementById('ring-snooze');
  if (snoozeBtn) snoozeBtn.onclick = () => snoozeAlarm(alarm);
  const stopBtn = document.getElementById('ring-stop');
  if (stopBtn) stopBtn.onclick = () => {
    stopCurrentRinging();
    toast('Alarm dimatikan');
    if (alarm.repeatType === 'once') disableOnceAlarm(alarm.id);
  };
}

async function disableOnceAlarm(id) {
  const alarm = await dbGet('alarms', id);
  if (!alarm || alarm.repeatType !== 'once') return;
  alarm.enabled = false;
  alarm.updatedAt = Date.now();
  await put('alarms', alarm);
  dataChanged('alarms');
}

function snoozeAlarm(alarm) {
  const settings = getSettings();
  const min = Number(settings.snoozeMin) || 5;
  const until = Date.now() + min * 60000;
  const snoozes = readMap(SNOOZE_KEY);
  snoozes[alarm.id] = { until, alarmId: alarm.id, name: alarm.name, soundId: alarm.soundId, volume: alarm.volume };
  writeMap(SNOOZE_KEY, snoozes);
  stopCurrentRinging();
  toast(`Ditunda ${min} menit`);
  showNotification({ title: `Alarm ditunda: ${alarm.name}`, body: `Akan berbunyi lagi dalam ${min} menit.`, tag: `snooze-${alarm.id}` });
}

/* --------------------------- Checking --------------------------- */

export async function checkAlarms() {
  if (ringing) return;
  await getCustomSounds();
  const now = new Date();
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const alarms = await getAlarms();
  const last = readMap(ALARM_LAST_KEY);
  const snoozes = readMap(SNOOZE_KEY);

  // Snoozes first
  for (const [id, snz] of Object.entries(snoozes)) {
    if (!snz || !snz.until) continue;
    if (Date.now() >= snz.until) {
      delete snoozes[id];
      writeMap(SNOOZE_KEY, snoozes);
      const alarm = alarms.find(a => a.id === id) || { id, name: snz.name || 'Alarm', soundId: snz.soundId, volume: snz.volume, repeatType: 'once' };
      await fireAlarm(alarm, { isSnooze: true });
      return;
    }
  }

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    if (alarm.time !== hhmm) continue;
    if (!alarmShouldFireToday(alarm, now)) continue;
    const key = nextFireKey(alarm, now);
    if (last[key]) continue;
    last[key] = Date.now();
    writeMap(ALARM_LAST_KEY, last);
    await fireAlarm(alarm);
    return;
  }
}

async function fireAlarm(alarm, { isSnooze = false } = {}) {
  const visible = document.visibilityState === 'visible';
  const title = isSnooze ? `Snooze: ${alarm.name || 'Alarm'}` : (alarm.name || 'Alarm');
  await showNotification({ title, body: `Sekarang pukul ${fmtTime(alarm.time, { withSuffix: true })}. Buka EZRoutine untuk mematikan atau menunda.`, tag: 'alarm-ring', silent: false });
  if (visible) {
    await showRinging(alarm, { label: isSnooze ? 'Snooze selesai' : 'Alarm aktif', snooze: true });
  } else {
    // Mark as missed/pending so it rings when app is opened
    const missed = readMap(MISSED_KEY);
    missed[alarm.id] = { alarmId: alarm.id, at: Date.now(), name: alarm.name, time: alarm.time };
    writeMap(MISSED_KEY, missed);
  }
}

export async function checkMissedAlarmsOnOpen() {
  const missed = readMap(MISSED_KEY);
  const ids = Object.keys(missed);
  if (!ids.length) return;
  const alarms = await getAlarms();
  for (const id of ids) {
    const alarm = alarms.find(a => a.id === id);
    delete missed[id];
    writeMap(MISSED_KEY, missed);
    if (alarm && alarm.enabled) {
      toast(`Alarm terlewat: ${alarm.name} (${fmtTime(alarm.time)})`, 'error');
      await showRinging(alarm, { label: 'Alarm terlewat — buka aplikasi terlambat', snooze: true });
      return;
    }
  }
}

/* --------------------------- CRUD / UI --------------------------- */

function volumeSliderHtml(value, id = 'af-vol') {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="field">
    <div class="row" style="justify-content:space-between"><label for="${id}">Volume</label><span class="tiny dim mono" id="${id}-val">${v}%</span></div>
    <div class="row" style="gap:8px">
      <button type="button" class="icon-btn" data-vol-mute="${id}" aria-label="Mute" title="Mute">${icon(v === 0 ? 'mute' : 'volume', 19)}</button>
      <input type="range" min="0" max="100" step="1" value="${v}" id="${id}" class="range" style="flex:1;--fill:${v}%">
    </div>
  </div>`;
}

function soundOptions(selected, customSounds) {
  const builtin = BUILTIN_SOUNDS.map(s => `<option value="${s.id}" ${selected === s.id ? 'selected' : ''}>${s.name} — ${s.desc}</option>`).join('');
  const custom = customSounds.length ? `<optgroup label="Suara kustom">${customSounds.map(s => `<option value="custom:${s.id}" ${selected === `custom:${s.id}` ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</optgroup>` : '';
  return `<optgroup label="Suara bawaan">${builtin}</optgroup>${custom}`;
}

export async function openAlarmEditor(existing = null) {
  await getCustomSounds();
  const settings = getSettings();
  const alarm = existing || {
    name: 'Alarm', time: '07:00', repeatType: 'daily', days: [1,2,3,4,5], date: toYMD(),
    soundId: settings.defaultSound || 'builtin:rise', volume: settings.defaultVolume ?? 70,
    snoozeMin: settings.snoozeMin || 5, enabled: true
  };
  const days = alarm.days || [];

  await showModal({
    title: existing ? 'Edit Alarm' : 'Alarm Baru',
    content: `<form class="form-stack" id="alarm-form" novalidate>
      <div class="field-row">
        <div class="field"><label for="al-time">Jam</label><input id="al-time" type="time" class="input" value="${escapeHtml(alarm.time || '07:00')}" required style="font-size:20px;font-weight:700"></div>
        <div class="field"><label for="al-name">Nama alarm</label><input id="al-name" class="input" maxlength="60" value="${escapeHtml(alarm.name || '')}" placeholder="Contoh: Bangun pagi"></div>
      </div>
      <div class="field"><label for="al-repeat">Pengulangan</label>
        <select id="al-repeat" class="select">
          <option value="once">Sekali</option>
          <option value="daily">Setiap hari</option>
          <option value="weekly">Hari tertentu</option>
          <option value="date">Tanggal tertentu</option>
        </select>
      </div>
      <div class="field hidden" id="al-days-wrap"><span class="field-label">Hari aktif</span>
        <div class="day-picker" id="al-days">${dayShort.map((d, i) => `<button type="button" data-day="${i}" class="${days.includes(i) ? 'is-active' : ''}" aria-pressed="${days.includes(i)}" aria-label="${dayNames[i]}">${d}</button>`).join('')}</div>
      </div>
      <div class="field hidden" id="al-date-wrap"><label for="al-date">Tanggal</label><input id="al-date" type="date" class="input" value="${escapeHtml(alarm.date || toYMD())}"></div>
      <div class="field"><label for="al-sound">Suara alarm</label>
        <select id="al-sound" class="select">${soundOptions(alarm.soundId, customSoundsCache)}</select>
      </div>
      ${volumeSliderHtml(alarm.volume, 'al-vol')}
      <div class="field-row">
        <div class="field"><label for="al-snooze">Snooze</label>
          <select id="al-snooze" class="select">${[5,10,15,20,30].map(m => `<option value="${m}" ${Number(alarm.snoozeMin)===m?'selected':''}>${m} menit</option>`).join('')}</select>
        </div>
        <div class="field"><span class="field-label">Aktif</span>
          <div style="min-height:44px;display:flex;align-items:center"><label class="switch" aria-label="Aktifkan alarm"><input type="checkbox" id="al-enabled" ${alarm.enabled !== false ? 'checked' : ''}><i></i></label></div>
        </div>
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn--soft btn--sm" id="al-preview">${icon('play', 15)} Preview</button>
        <button type="button" class="btn btn--outline btn--sm" id="al-preview-stop">${icon('stop', 15)} Stop</button>
        <button type="button" class="btn btn--outline btn--sm" id="al-upload">${icon('upload', 15)} Upload Suara</button>
        <input type="file" id="al-upload-input" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/*" class="hidden">
      </div>
      <div class="tiny dim">Suara kustom disimpan di perangkat (IndexedDB). Format umum: MP3, WAV, OGG.</div>
    </form>`,
    buttons: [
      { label: 'Batal', className: 'btn--outline', value: false },
      {
        label: existing ? 'Simpan' : 'Tambah Alarm',
        className: 'btn--primary',
        onClick: async (finish, wrap) => {
          const time = $('#al-time', wrap).value;
          const name = $('#al-name', wrap).value.trim() || 'Alarm';
          const repeatType = $('#al-repeat', wrap).value;
          const daysSel = $$('#al-days [data-day].is-active', wrap).map(b => Number(b.dataset.day));
          if (!time) { toast('Jam alarm wajib diisi', 'error'); return; }
          if (repeatType === 'weekly' && !daysSel.length) { toast('Pilih minimal satu hari', 'error'); return; }
          if (repeatType === 'date' && !$('#al-date', wrap).value) { toast('Pilih tanggal alarm', 'error'); return; }
          const record = {
            id: existing?.id || uid('al'),
            name, time, repeatType,
            days: repeatType === 'weekly' ? daysSel : (repeatType === 'daily' ? [0,1,2,3,4,5,6] : []),
            date: (repeatType === 'date' || repeatType === 'once') ? $('#al-date', wrap).value : (existing?.date || toYMD()),
            soundId: $('#al-sound', wrap).value,
            volume: Number($('#al-vol', wrap).value),
            snoozeMin: Number($('#al-snooze', wrap).value) || 5,
            enabled: $('#al-enabled', wrap).checked,
            createdAt: existing?.createdAt || Date.now(),
            updatedAt: Date.now()
          };
          await put('alarms', record);
          stopSound();
          toast(existing ? 'Alarm diperbarui' : 'Alarm ditambahkan');
          dataChanged('alarms');
          finish(true);
        }
      }
    ],
    onMount(wrap) {
      $('#al-repeat', wrap).value = alarm.repeatType || 'once';
      const syncRepeat = () => {
        const v = $('#al-repeat', wrap).value;
        $('#al-days-wrap', wrap).classList.toggle('hidden', v !== 'weekly');
        $('#al-date-wrap', wrap).classList.toggle('hidden', !(v === 'date' || v === 'once'));
      };
      syncRepeat();
      $('#al-repeat', wrap).addEventListener('change', syncRepeat);

      $('#al-days', wrap).addEventListener('click', e => {
        const b = e.target.closest('[data-day]'); if (!b) return;
        b.classList.toggle('is-active'); b.setAttribute('aria-pressed', String(b.classList.contains('is-active')));
      });

      bindVolumeControl(wrap, 'al-vol');
      bindSoundPreview(wrap, '#al-preview', '#al-preview-stop', () => $('#al-sound', wrap).value, () => Number($('#al-vol', wrap).value));
      bindUpload(wrap, '#al-upload', '#al-upload-input', '#al-sound');
    }
  });
  stopSound();
}

function bindVolumeControl(wrap, inputId) {
  const range = $(`#${inputId}`, wrap);
  const val = $(`#${inputId}-val`, wrap);
  const muteBtn = $(`[data-vol-mute="${inputId}"]`, wrap);
  if (!range) return;
  const sync = () => {
    const v = Number(range.value);
    range.style.setProperty('--fill', `${v}%`);
    if (val) val.textContent = `${v}%`;
    if (muteBtn) muteBtn.innerHTML = icon(v === 0 ? 'mute' : 'volume', 19);
  };
  range.addEventListener('input', sync);
  muteBtn?.addEventListener('click', () => {
    range.value = Number(range.value) > 0 ? '0' : '70';
    sync();
  });
  sync();
}

function bindSoundPreview(wrap, playSel, stopSel, getSound, getVol) {
  $(playSel, wrap)?.addEventListener('click', async () => {
    try { await playSound(getSound(), { volume: getVol(), loop: false }); }
    catch (err) { toast(err.message || 'Gagal memutar suara', 'error'); }
  });
  $(stopSel, wrap)?.addEventListener('click', () => stopSound());
}

function bindUpload(wrap, btnSel, inputSel, soundSelectSel) {
  const btn = $(btnSel, wrap);
  const input = $(inputSel, wrap);
  const select = $(soundSelectSel, wrap);
  if (!btn || !input) return;
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      toast('Pilih file audio yang didukung (MP3/WAV/OGG)', 'error'); return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Ukuran file terlalu besar (maks 8 MB)', 'error'); return;
    }
    const record = { id: uid('snd'), name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Suara Kustom', blob: file, type: file.type || 'audio/mpeg', size: file.size, createdAt: Date.now() };
    await put('audio', record);
    await getCustomSounds();
    if (select) {
      select.innerHTML = soundOptions(`custom:${record.id}`, customSoundsCache);
      select.value = `custom:${record.id}`;
    }
    toast('Suara kustom berhasil ditambahkan');
    dataChanged('audio');
  });
}

/* --------------------------- Custom audio manager --------------------------- */

export async function openSoundManager() {
  await getCustomSounds();
  const render = () => {
    const items = customSoundsCache.length ? customSoundsCache.map(s => `
      <div class="audio-item">
        <div class="list-row__icon">${icon('music', 20)}</div>
        <div class="audio-item__body">
          <div class="list-row__title">${escapeHtml(s.name)}</div>
          <div class="list-row__sub">${escapeHtml(s.type || 'audio')} · ${Math.max(1, Math.round((s.size || 0) / 1024))} KB</div>
        </div>
        <div class="row" style="gap:2px">
          <button type="button" class="icon-btn" data-snd-play="${s.id}" aria-label="Putar">${icon('play', 18)}</button>
          <button type="button" class="icon-btn" data-snd-del="${s.id}" aria-label="Hapus">${icon('trash', 18)}</button>
        </div>
      </div>`).join('') : emptyState({ iconName: 'music', title: 'Belum ada suara kustom', text: 'Upload file audio dari perangkat untuk digunakan sebagai alarm.' });
    return `<div class="stack" style="gap:0">${items}</div>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
        <button type="button" class="btn btn--primary btn--sm" id="sm-upload">${icon('upload', 15)} Upload Suara</button>
        <button type="button" class="btn btn--outline btn--sm" id="sm-stop">${icon('stop', 15)} Stop</button>
        <input type="file" id="sm-input" accept="audio/*" class="hidden">
      </div>`;
  };

  await showModal({
    title: 'Suara Alarm Kustom',
    content: `<div id="sm-body">${render()}</div>`,
    buttons: [{ label: 'Tutup', className: 'btn--outline', value: true }],
    onMount(wrap) {
      const refresh = async () => { await getCustomSounds(); $('#sm-body', wrap).innerHTML = render(); bind(); };
      const bind = () => {
        $('#sm-upload', wrap)?.addEventListener('click', () => $('#sm-input', wrap).click());
        $('#sm-stop', wrap)?.addEventListener('click', () => stopSound());
        $('#sm-input', wrap)?.addEventListener('change', async e => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file) return;
          if (file.size > 8 * 1024 * 1024) { toast('Maks 8 MB', 'error'); return; }
          await put('audio', { id: uid('snd'), name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Suara', blob: file, type: file.type || 'audio/mpeg', size: file.size, createdAt: Date.now() });
          toast('Suara ditambahkan');
          dataChanged('audio');
          await refresh();
        });
        wrap.querySelectorAll('[data-snd-play]').forEach(btn => btn.addEventListener('click', async () => {
          try { await playSound(`custom:${btn.dataset.sndPlay}`, { volume: getSettings().defaultVolume, loop: false }); }
          catch (err) { toast(err.message, 'error'); }
        }));
        wrap.querySelectorAll('[data-snd-del]').forEach(btn => btn.addEventListener('click', async () => {
          const s = customSoundsCache.find(x => x.id === btn.dataset.sndDel);
          const ok = await confirmDialog({ title: 'Hapus suara?', message: `"${s?.name || 'Suara'}" akan dihapus. Alarm yang memakai suara ini akan kembali ke suara bawaan.`, confirmLabel: 'Hapus', danger: true });
          if (!ok) return;
          await remove('audio', btn.dataset.sndDel);
          // Reassign alarms using this sound
          const alarms = await getAlarms();
          for (const a of alarms) {
            if (a.soundId === `custom:${btn.dataset.sndDel}`) { a.soundId = 'builtin:rise'; a.updatedAt = Date.now(); await put('alarms', a); }
          }
          stopSound();
          toast('Suara dihapus');
          dataChanged('audio');
          await refresh();
        }));
      };
      bind();
    }
  });
  stopSound();
}

/* --------------------------- Alarm page --------------------------- */

export async function renderAlarm(root) {
  const alarms = await getAlarms();
  await getCustomSounds();
  const settings = getSettings();
  const notif = permissionStatus();
  const caps = [];

  setAppBar({
    title: 'Alarm',
    subtitle: `${alarms.filter(a => a.enabled).length} alarm aktif`,
    actions: `<button type="button" class="icon-btn" data-alarm-action="sounds" aria-label="Suara kustom" title="Suara kustom">${icon('music', 21)}</button>
      <button type="button" class="icon-btn" data-alarm-action="add" aria-label="Tambah alarm" title="Tambah alarm">${icon('plus', 21)}</button>
      ${themeToggleButton()}`
  });

  root.innerHTML = `<div class="page">
    <div class="info-note info-note--warn">
      ${icon('warn', 18)}
      <div><strong>Batasan PWA:</strong> Alarm berbunyi paling andal saat EZRoutine sedang terbuka. Notifikasi bisa membantu mengingatkan, tetapi browser/OS dapat menunda atau membatasi alarm saat aplikasi ditutup penuh. Saat aplikasi dibuka kembali, EZRoutine memeriksa alarm yang terlewat.</div>
    </div>

    <div class="card card--pad">
      <div class="row" style="justify-content:space-between;gap:12px">
        <div>
          <div class="bold small">Izin notifikasi</div>
          <div class="tiny dim" style="margin-top:3px">Status: ${escapeHtml(notif === 'granted' ? 'Diizinkan' : notif === 'denied' ? 'Ditolak browser' : notif === 'unsupported' ? 'Tidak didukung' : 'Belum diminta')}</div>
        </div>
        ${notif !== 'granted' && notif !== 'unsupported' ? `<button type="button" class="btn btn--sm btn--soft" data-alarm-action="notif">${icon('bell', 14)} Izinkan</button>` : notif === 'granted' ? `<span class="tag" style="color:var(--success)">Aktif</span>` : ''}
      </div>
    </div>

    ${alarms.length ? `<div class="stack">${alarms.map(a => alarmCardHtml(a)).join('')}</div>` : emptyState({
      iconName: 'bell', title: 'Belum ada alarm',
      text: 'Buat alarm untuk pengingat bangun, olahraga, belajar, atau aktivitas penting.',
      action: `<button type="button" class="btn btn--primary btn--sm" data-alarm-action="add">${icon('plus', 16)} Tambah Alarm</button>`
    })}

    <div class="card card--pad card--soft">
      <div class="bold small" style="margin-bottom:8px">Cara alarm EZRoutine bekerja</div>
      <div class="tiny dim" style="line-height:1.7">
        • Saat aplikasi terbuka/aktif: alarm berbunyi dengan layar alarm.<br>
        • Saat aplikasi di latar belakang: notifikasi dikirim bila izin tersedia.<br>
        • Saat aplikasi dibuka kembali: alarm terlewat diperiksa dan ditampilkan.<br>
        • Tidak ada klaim audio otomatis dari Service Worker saat browser ditutup.
      </div>
    </div>
  </div>`;

  document.querySelector('[data-alarm-action="add"]')?.addEventListener('click', () => openAlarmEditor());
  document.querySelectorAll('[data-alarm-action="add"]').forEach(b => b.onclick = () => openAlarmEditor());
  document.querySelector('[data-alarm-action="sounds"]')?.addEventListener('click', openSoundManager);
  document.querySelector('[data-alarm-action="notif"]')?.addEventListener('click', async () => {
    const ok = await requestNotificationPermission();
    toast(ok ? 'Notifikasi diizinkan' : 'Izin notifikasi belum diberikan', ok ? 'success' : 'error');
    renderAlarm(root);
  });

  if (!boundRoot) {
    boundRoot = root;
    root.addEventListener('click', onAlarmClick);
    root.addEventListener('change', onAlarmChange);
  }
}

function alarmCardHtml(a) {
  const time12 = fmtTime(a.time, { withSuffix: true, force24: false });
  const use24 = getSettings().timeFormat === '24';
  const displayTime = use24 ? a.time : time12.replace(/\s?(AM|PM)$/i, '');
  const ampm = use24 ? '' : (time12.match(/(AM|PM)/i)?.[1] || '');
  return `<div class="alarm-card ${a.enabled ? '' : 'is-off'}" data-alarm-id="${a.id}">
    <div style="flex:1;min-width:0">
      <div><span class="alarm-card__time mono">${escapeHtml(displayTime)}</span>${ampm ? `<span class="alarm-card__ampm">${ampm}</span>` : ''}</div>
      <div class="alarm-card__name">${escapeHtml(a.name || 'Alarm')}</div>
      <div class="alarm-card__meta">
        <span>${escapeHtml(repeatText(a))}</span>
        <span>·</span>
        <span>${icon('music', 11)} ${escapeHtml(soundLabel(a.soundId, customSoundsCache))}</span>
        <span>·</span>
        <span>${icon('volume', 11)} ${Number(a.volume)}%</span>
      </div>
    </div>
    <div class="alarm-card__actions">
      <label class="switch" aria-label="Aktifkan/nonaktifkan alarm">
        <input type="checkbox" data-action="toggle-alarm" data-id="${a.id}" ${a.enabled ? 'checked' : ''}>
        <i></i>
      </label>
      <div class="row" style="gap:0">
        <button type="button" class="icon-btn" data-action="edit-alarm" data-id="${a.id}" aria-label="Edit alarm">${icon('edit', 18)}</button>
        <button type="button" class="icon-btn" data-action="delete-alarm" data-id="${a.id}" aria-label="Hapus alarm">${icon('trash', 18)}</button>
      </div>
    </div>
  </div>`;
}

async function onAlarmClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'edit-alarm') {
    const alarms = await getAlarms();
    const a = alarms.find(x => x.id === id);
    if (a) openAlarmEditor(a);
  } else if (action === 'delete-alarm') {
    const alarms = await getAlarms();
    const a = alarms.find(x => x.id === id);
    const ok = await confirmDialog({ title: 'Hapus alarm?', message: `"${a?.name || 'Alarm'}" akan dihapus permanen.`, confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    await remove('alarms', id);
    toast('Alarm dihapus');
    dataChanged('alarms');
  }
}

async function onAlarmChange(e) {
  const toggle = e.target.closest('[data-action="toggle-alarm"]');
  if (!toggle) return;
  const alarms = await getAlarms();
  const a = alarms.find(x => x.id === toggle.dataset.id);
  if (!a) return;
  a.enabled = toggle.checked;
  a.updatedAt = Date.now();
  await put('alarms', a);
  toast(a.enabled ? 'Alarm diaktifkan' : 'Alarm dinonaktifkan');
  dataChanged('alarms');
}

export function getRinging() { return ringing; }
