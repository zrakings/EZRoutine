/* ============================================================
   EZRoutine — Workout plans, library, session timer & history
   ============================================================ */
import { getAll, put, remove } from './database.js';
import { WORKOUT_LIBRARY, getLibraryItem, WORKOUT_CATEGORIES } from './constants.js';
import {
  $, $$, escapeHtml, uid, toYMD, addDays, startOfWeek, formatDate, fmtTime, dayShort,
  dayNames, durationText, clamp, pad2
} from './utils.js';
import { icon, toast, showModal, confirmDialog, emptyState, setAppBar, themeToggleButton } from './ui.js';
import { chime } from './audio.js';
import { dataChanged } from './events.js';
import { getSettings } from './storage.js';
import { showNotification } from './notifications.js';

const state = { tab: 'plans' };
let boundRoot = null;
let session = null;

/* --------------------------- Page --------------------------- */

export async function renderWorkout(root) {
  const [plans, history] = await Promise.all([getAll('workoutPlans'), getAll('workoutHistory')]);
  setAppBar({
    title: 'Olahraga',
    subtitle: 'Rencana, sesi, dan riwayat latihan',
    actions: `<button type="button" class="icon-btn" data-wo-action="new-plan" aria-label="Rencana baru" title="Rencana baru">${icon('plus', 21)}</button>${themeToggleButton()}`
  });

  const weekStart = startOfWeek();
  const weekEnd = addDays(weekStart, 6);
  const weekHistory = history.filter(h => h.date >= weekStart && h.date <= weekEnd);
  const weekMin = Math.round(weekHistory.reduce((sum, h) => sum + (h.durationSec || 0), 0) / 60);
  const totalMin = Math.round(history.reduce((sum, h) => sum + (h.durationSec || 0), 0) / 60);
  const today = toYMD();
  const todayPlans = plans.filter(p => (p.days || []).includes(new Date().getDay()) && p.active !== false);

  const tabBtn = (id, label) => `<button type="button" data-action="tab" data-tab="${id}" class="${state.tab === id ? 'is-active' : ''}">${label}</button>`;

  root.innerHTML = `<div class="page">
    <div class="card card--pad card--accent">
      <div class="row">
        <div style="flex:1">
          <div class="eyebrow">Ringkasan olahraga</div>
          <div class="row" style="gap:18px;margin-top:10px;align-items:flex-end">
            <div><div style="font-size:26px;font-weight:850;letter-spacing:-1px">${weekHistory.length}</div><div class="tiny dim">sesi minggu ini</div></div>
            <div><div style="font-size:26px;font-weight:850;letter-spacing:-1px">${weekMin}</div><div class="tiny dim">menit minggu ini</div></div>
            <div><div style="font-size:26px;font-weight:850;letter-spacing:-1px">${history.length}</div><div class="tiny dim">total sesi</div></div>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:14px;gap:8px">
        <span class="tag">${icon('target', 12)} Target ${getSettings().weeklyGoal}× / minggu</span>
        <span class="tag">${icon('timer', 12)} Total ${totalMin} menit</span>
      </div>
    </div>

    ${todayPlans.length ? `<div class="card card--pad">
      <div class="card__head"><div class="card__title">Jadwal olahraga hari ini</div><span class="tag">${todayPlans.length} rencana</span></div>
      <div class="stack">${todayPlans.map(p => `<div class="list-row" style="padding:8px 0">
        <div class="list-row__icon">${icon('dumbbell', 20)}</div>
        <div class="list-row__body"><div class="list-row__title">${escapeHtml(p.name)}</div><div class="list-row__sub">${fmtTime(p.time)} · ${p.durationMin} menit</div></div>
        <button type="button" class="btn btn--sm btn--primary" data-action="start-plan" data-id="${p.id}">Mulai</button>
      </div>`).join('')}</div>
    </div>` : ''}

    <div class="segmented" role="tablist" aria-label="Bagian olahraga">
      ${tabBtn('plans', 'Rencana')}${tabBtn('library', 'Library')}${tabBtn('history', 'Riwayat')}
    </div>

    ${state.tab === 'plans' ? plansHtml(plans) : state.tab === 'library' ? libraryHtml() : historyHtml(history)}
  </div>`;

  const newBtn = document.querySelector('[data-wo-action="new-plan"]');
  if (newBtn) newBtn.onclick = () => openPlanEditor();

  if (!boundRoot) {
    boundRoot = root;
    root.addEventListener('click', onWorkoutClick);
  }
}

function plansHtml(plans) {
  if (!plans.length) {
    return emptyState({
      iconName: 'dumbbell', title: 'Belum ada rencana olahraga',
      text: 'Buat rencana sendiri atau mulai dari latihan di Library.',
      action: `<div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn--primary btn--sm" data-action="new-plan">${icon('plus', 16)} Rencana Baru</button>
        <button type="button" class="btn btn--soft btn--sm" data-action="tab" data-tab="library">${icon('layers', 16)} Buka Library</button>
      </div>`
    });
  }
  return `<div class="grid grid--auto">${plans.sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(p => {
    const days = (p.days || []).map(d => dayShort[d]).join(', ');
    return `<div class="card card--pad ${p.active === false ? 'is-off' : ''}" style="${p.active === false ? 'opacity:.6' : ''}">
      <div class="card__head" style="align-items:flex-start">
        <div class="list-row__icon" style="color:var(--accent-2)">${icon('dumbbell', 20)}</div>
        <div style="flex:1;min-width:0">
          <div class="card__title">${escapeHtml(p.name)}</div>
          <div class="card__sub">${escapeHtml(days || 'Tanpa hari')} · ${fmtTime(p.time)} · ${p.durationMin} menit</div>
        </div>
        <label class="switch" aria-label="Aktifkan rencana">
          <input type="checkbox" data-action="toggle-plan" data-id="${p.id}" ${p.active !== false ? 'checked' : ''}>
          <i></i>
        </label>
      </div>
      ${(p.exercises || []).length ? `<div class="chips-scroll" style="flex-wrap:wrap;overflow:visible">${p.exercises.map(e => `<span class="tag">${escapeHtml(e.name)} · ${Math.max(1, Math.round((e.durationSec || 0) / 60))}m</span>`).join('')}</div>` : '<div class="small dim">Belum ada latihan di rencana ini.</div>'}
      ${p.notes ? `<div class="small muted" style="margin-top:10px;line-height:1.5">${escapeHtml(p.notes)}</div>` : ''}
      <div class="card__foot" style="flex-wrap:wrap">
        <button type="button" class="btn btn--sm btn--primary" data-action="start-plan" data-id="${p.id}">${icon('play', 14)} Mulai</button>
        <button type="button" class="btn btn--sm btn--soft" data-action="complete-plan" data-id="${p.id}">${icon('check', 14)} Selesai</button>
        <span class="spacer"></span>
        <button type="button" class="icon-btn" data-action="edit-plan" data-id="${p.id}" aria-label="Edit rencana">${icon('edit', 18)}</button>
        <button type="button" class="icon-btn" data-action="delete-plan" data-id="${p.id}" aria-label="Hapus rencana">${icon('trash', 18)}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function libraryHtml() {
  return `<div class="info-note">${icon('info', 18)}<div>Pilih latihan untuk memulai sesi cepat, atau tambahkan ke rencana olahraga mingguanmu. Kalori adalah estimasi kasar, bukan target wajib.</div></div>
  <div class="grid grid--auto">${WORKOUT_LIBRARY.map(w => `<div class="card card--pad">
    <div class="card__head" style="align-items:flex-start">
      <div class="list-row__icon" style="color:${w.id === 'rest-day' ? 'var(--success)' : 'var(--accent)'}">${icon(w.id === 'rest-day' ? 'moon' : 'activity', 20)}</div>
      <div style="flex:1;min-width:0">
        <div class="card__title">${escapeHtml(w.name)}</div>
        <div class="card__sub">${escapeHtml(w.category)} · ${w.durationSec ? durationText(w.durationSec) : 'Tanpa durasi'}</div>
      </div>
      ${w.calories ? `<span class="tag">${icon('flame', 11)} ±${w.calories} kkal</span>` : ''}
    </div>
    <p class="small muted" style="margin:0 0 12px;line-height:1.55">${escapeHtml(w.description)}</p>
    <div class="row" style="gap:8px">
      <button type="button" class="btn btn--sm btn--primary" data-action="start-library" data-id="${w.id}">${icon(w.id === 'rest-day' ? 'check' : 'play', 14)} ${w.id === 'rest-day' ? 'Catat istirahat' : 'Mulai'}</button>
      <button type="button" class="btn btn--sm btn--outline" data-action="add-to-plan" data-id="${w.id}">${icon('plus', 14)} Rencana</button>
    </div>
  </div>`).join('')}</div>`;
}

function historyHtml(history) {
  const sorted = [...history].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  if (!sorted.length) {
    return emptyState({ iconName: 'clock', title: 'Belum ada riwayat', text: 'Selesaikan sesi olahraga pertama untuk melihat riwayat di sini.' });
  }
  const total = Math.round(sorted.reduce((s, h) => s + (h.durationSec || 0), 0) / 60);
  return `<div class="card card--pad">
    <div class="card__head"><div class="card__title">${sorted.length} sesi tercatat</div><span class="tag">${icon('timer', 12)} ${total} menit</span></div>
    ${sorted.map(h => `<div class="list-row">
      <div class="list-row__icon" style="color:var(--success)">${icon('check', 20)}</div>
      <div class="list-row__body">
        <div class="list-row__title">${escapeHtml(h.title || 'Sesi olahraga')}</div>
        <div class="list-row__sub">${formatDate(h.date, { withDay: true })} · ${durationText(h.durationSec || 0)}</div>
      </div>
      <button type="button" class="icon-btn" data-action="delete-history" data-id="${h.id}" aria-label="Hapus riwayat">${icon('trash', 17)}</button>
    </div>`).join('')}
  </div>`;
}

/* --------------------------- Plan editor --------------------------- */

async function openPlanEditor(existing = null, prefillExercises = null) {
  const settings = getSettings();
  const days = existing?.days || [new Date().getDay()];
  const exercises = (prefillExercises || existing?.exercises || []).map(e => ({ ...e }));
  const customDuration = existing?.durationMin || settings.defaultWorkoutMin || 30;

  const libOptions = WORKOUT_LIBRARY.map(w => `<option value="${w.id}">${w.name}${w.durationSec ? ` (${Math.round(w.durationSec / 60)} mnt)` : ''}</option>`).join('');

  const content = `
    <form class="form-stack" id="plan-form" novalidate>
      <div class="field"><label for="pf-name">Nama rencana</label>
        <input id="pf-name" class="input" maxlength="70" placeholder="Contoh: Latihan pagi" value="${escapeHtml(existing?.name || '')}" required></div>
      <div class="field"><span class="field-label">Hari latihan</span>
        <div class="day-picker" id="pf-days">${dayShort.map((d, i) => `<button type="button" data-day="${i}" class="${days.includes(i) ? 'is-active' : ''}" aria-label="${dayNames[i]}" aria-pressed="${days.includes(i)}">${d}</button>`).join('')}</div>
      </div>
      <div class="field-row">
        <div class="field"><label for="pf-time">Jam mulai</label><input id="pf-time" type="time" class="input" value="${existing?.time || '06:30'}"></div>
        <div class="field"><label for="pf-duration">Durasi (menit)</label><input id="pf-duration" type="number" min="1" max="300" class="input" value="${customDuration}"></div>
      </div>
      <div class="field">
        <span class="field-label">Latihan dalam rencana</span>
        <div id="pf-ex-list" class="card card--soft" style="padding:4px 12px;min-height:44px"></div>
        <div class="row" style="gap:6px;align-items:flex-end;margin-top:2px">
          <div class="field" style="flex:1"><label for="pf-ex-select" class="tiny dim">Pilih latihan</label>
            <select id="pf-ex-select" class="select">${libOptions}<option value="__custom">+ Latihan kustom</option></select>
          </div>
          <button type="button" class="btn btn--soft" id="pf-ex-add" style="min-width:44px">${icon('plus', 17)}</button>
        </div>
        <div id="pf-custom" class="field-row hidden" style="margin-top:6px">
          <div class="field"><label for="pf-custom-name" class="tiny dim">Nama latihan kustom</label><input id="pf-custom-name" class="input" maxlength="50" placeholder="Contoh: Lompat tali"></div>
          <div class="field"><label for="pf-custom-duration" class="tiny dim">Durasi (menit)</label><input id="pf-custom-duration" type="number" class="input" min="1" max="120" value="10"></div>
        </div>
      </div>
      <div class="field"><label for="pf-notes">Catatan <span class="dim">(opsional)</span></label>
        <textarea id="pf-notes" class="textarea" maxlength="250" placeholder="Target atau catatan latihan...">${escapeHtml(existing?.notes || '')}</textarea></div>
    </form>`;

  const renderExList = wrap => {
    const list = $('#pf-ex-list', wrap);
    if (!exercises.length) { list.innerHTML = '<div class="small dim" style="padding:9px 0">Belum ada latihan. Tambahkan dari daftar di bawah.</div>'; return; }
    list.innerHTML = exercises.map((e, i) => `<div class="exercise-row">
      <div class="exercise-row__idx">${i + 1}</div>
      <div class="exercise-row__body"><div class="small bold">${escapeHtml(e.name)}</div><div class="tiny dim">${Math.max(1, Math.round((e.durationSec || 0) / 60))} menit${e.calories ? ` · ±${e.calories} kkal` : ''}</div></div>
      <button type="button" class="icon-btn" data-ex-remove="${i}" aria-label="Hapus latihan">${icon('close', 17)}</button>
    </div>`).join('');
  };

  await showModal({
    title: existing ? 'Edit Rencana Olahraga' : 'Rencana Olahraga Baru',
    content,
    buttons: [
      { label: 'Batal', className: 'btn--outline', value: false },
      {
        label: existing ? 'Simpan Perubahan' : 'Simpan Rencana',
        className: 'btn--primary',
        onClick: async (finish, wrap) => {
          const name = $('#pf-name', wrap).value.trim();
          const time = $('#pf-time', wrap).value;
          const chosenDays = $$('#pf-days [data-day].is-active', wrap).map(b => Number(b.dataset.day));
          if (!name) { toast('Nama rencana wajib diisi', 'error'); return; }
          if (!chosenDays.length) { toast('Pilih minimal satu hari latihan', 'error'); return; }
          if (!time) { toast('Jam mulai wajib diisi', 'error'); return; }
          if (!exercises.length) { toast('Tambahkan minimal satu latihan', 'error'); return; }
          const totalSec = exercises.reduce((s, e) => s + (e.durationSec || 0), 0);
          const durationMin = Math.max(1, Number($('#pf-duration', wrap).value) || Math.round(totalSec / 60));
          const record = {
            id: existing?.id || uid('plan'),
            name, time, days: chosenDays, durationMin,
            exercises,
            notes: $('#pf-notes', wrap).value.trim(),
            active: existing?.active !== false,
            createdAt: existing?.createdAt || Date.now(),
            updatedAt: Date.now()
          };
          await put('workoutPlans', record);
          toast(existing ? 'Rencana diperbarui' : 'Rencana olahraga dibuat');
          dataChanged('workout');
          finish(true);
        }
      }
    ],
    onMount(wrap) {
      renderExList(wrap);
      $('#pf-days', wrap).addEventListener('click', e => {
        const b = e.target.closest('[data-day]');
        if (!b) return;
        b.classList.toggle('is-active');
        b.setAttribute('aria-pressed', String(b.classList.contains('is-active')));
      });
      $('#pf-ex-select', wrap).addEventListener('change', e => {
        $('#pf-custom', wrap).classList.toggle('hidden', e.target.value !== '__custom');
      });
      $('#pf-ex-add', wrap).addEventListener('click', () => {
        const sel = $('#pf-ex-select', wrap).value;
        if (sel === '__custom') {
          const nameInput = $('#pf-custom-name', wrap);
          const nm = nameInput.value.trim();
          const mins = Math.max(1, Number($('#pf-custom-duration', wrap).value) || 10);
          if (!nm) { toast('Isi nama latihan kustom', 'error'); nameInput.focus(); return; }
          exercises.push({ id: uid('ex'), name: nm, durationSec: mins * 60, category: 'Lainnya', calories: 0, description: 'Latihan kustom' });
          nameInput.value = '';
        } else {
          const lib = getLibraryItem(sel);
          if (!lib) return;
          if (exercises.some(e => e.libraryId === lib.id && e.name === lib.name)) { toast('Latihan sudah ada di rencana', 'error'); return; }
          exercises.push({ id: uid('ex'), libraryId: lib.id, name: lib.name, durationSec: lib.durationSec, category: lib.category, calories: lib.calories, description: lib.description });
        }
        renderExList(wrap);
        const total = Math.round(exercises.reduce((s, e) => s + (e.durationSec || 0), 0) / 60);
        if (total > 0) $('#pf-duration', wrap).value = total;
      });
      $('#pf-ex-list', wrap).addEventListener('click', e => {
        const b = e.target.closest('[data-ex-remove]');
        if (!b) return;
        exercises.splice(Number(b.dataset.exRemove), 1);
        renderExList(wrap);
      });
    }
  });
}

/* --------------------------- Actions --------------------------- */

async function onWorkoutClick(e) {
  const tabBtn = e.target.closest('[data-action="tab"]');
  if (tabBtn) { state.tab = tabBtn.dataset.tab; renderWorkout(boundRoot); return; }
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.matches('input')) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action) return;

  if (action === 'new-plan') { openPlanEditor(); return; }
  if (action === 'start-library') {
    const lib = getLibraryItem(id);
    if (!lib) return;
    if (lib.durationSec === 0) {
      const ok = await confirmDialog({ title: 'Catat rest day?', message: 'Rest day akan dicatat sebagai sesi pemulihan tanpa timer.', confirmLabel: 'Catat', danger: false });
      if (ok) {
        await saveHistory({ title: `${lib.name} — Pemulihan`, date: toYMD(), durationSec: 0, completed: true, source: 'manual' });
        toast('Rest day tercatat');
      }
      return;
    }
    startWorkoutSession({ title: lib.name, exercises: [{ name: lib.name, durationSec: lib.durationSec, description: lib.description }] });
    return;
  }
  if (action === 'add-to-plan') {
    const lib = getLibraryItem(id);
    if (lib) openPlanEditor(null, [{ id: uid('ex'), libraryId: lib.id, name: lib.name, durationSec: lib.durationSec, category: lib.category, calories: lib.calories, description: lib.description }]);
    return;
  }
  if (action === 'start-plan') {
    const plans = await getAll('workoutPlans');
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    if (!(plan.exercises || []).length) { toast('Rencana ini belum punya latihan', 'error'); return; }
    startWorkoutSession({ title: plan.name, planId: plan.id, exercises: plan.exercises });
    return;
  }
  if (action === 'complete-plan') {
    const plans = await getAll('workoutPlans');
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    const ok = await confirmDialog({ title: 'Tandai rencana selesai?', message: `"${plan.name}" akan dicatat di riwayat olahraga hari ini (${plan.durationMin} menit).`, confirmLabel: 'Tandai selesai' });
    if (!ok) return;
    await saveHistory({ title: plan.name, planId: plan.id, date: toYMD(), durationSec: plan.durationMin * 60, completed: true, source: 'manual' });
    toast('Rencana dicatat selesai ✓');
    return;
  }
  if (action === 'edit-plan') {
    const plans = await getAll('workoutPlans');
    const plan = plans.find(p => p.id === id);
    if (plan) openPlanEditor(plan);
    return;
  }
  if (action === 'delete-plan') {
    const ok = await confirmDialog({ title: 'Hapus rencana?', message: 'Rencana akan dihapus. Riwayat olahraga tetap tersimpan.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    await remove('workoutPlans', id);
    toast('Rencana dihapus');
    dataChanged('workout');
    return;
  }
  if (action === 'delete-history') {
    const ok = await confirmDialog({ title: 'Hapus riwayat?', message: 'Catatan sesi ini akan dihapus permanen.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    await remove('workoutHistory', id);
    toast('Riwayat dihapus');
    dataChanged('workout');
  }
}

async function onWorkoutToggle(e) {
  const input = e.target.closest('[data-action="toggle-plan"]');
  if (!input) return;
  e.stopPropagation();
  const plans = await getAll('workoutPlans');
  const p = plans.find(x => x.id === input.dataset.id);
  if (!p) return;
  p.active = input.checked;
  p.updatedAt = Date.now();
  await put('workoutPlans', p);
  toast(input.checked ? 'Rencana diaktifkan' : 'Rencana dinonaktifkan');
  dataChanged('workout');
}

document.addEventListener('change', onWorkoutToggle);

/* --------------------------- Session --------------------------- */

async function saveHistory(record) {
  const entry = {
    id: uid('wh'),
    completedAt: Date.now(),
    ...record
  };
  await put('workoutHistory', entry);
  dataChanged('workout');
  return entry;
}

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${pad2(m)}:${pad2(ss)}`;
}

function sessionBodyHtml(s) {
  const ex = s.exercises[s.idx];
  const total = ex.durationSec || 60;
  return `<div class="stack" style="gap:16px">
    <div class="row" style="justify-content:space-between">
      <div style="min-width:0">
        <div class="eyebrow">Sesi ${s.idx + 1} / ${s.exercises.length}</div>
        <div style="font-size:17px;font-weight:750;margin-top:2px">${escapeHtml(ex.name)}</div>
      </div>
      <div class="segmented" style="width:190px">
        <button type="button" data-sess="mode" data-mode="countdown" class="${s.mode === 'countdown' ? 'is-active' : ''}">Mundur</button>
        <button type="button" data-sess="mode" data-mode="stopwatch" class="${s.mode === 'stopwatch' ? 'is-active' : ''}">Stopwatch</button>
      </div>
    </div>
    <div class="timer-wrap">
      <div class="timer-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="timer-ring__track" cx="60" cy="60" r="52" fill="none" stroke-width="9"/>
          <circle class="timer-ring__bar" id="sess-ring" cx="60" cy="60" r="52" fill="none" stroke-width="9" stroke-dasharray="326.7" stroke-dashoffset="0"/>
        </svg>
        <div class="timer-ring__inner">
          <div class="timer-ring__value" id="sess-time">${fmtClock(s.mode === 'countdown' ? total : 0)}</div>
          <div class="timer-ring__label" id="sess-status">${s.running ? 'Berjalan' : 'Siap dimulai'}</div>
        </div>
      </div>
      <div class="timer-controls">
        <button type="button" class="btn btn--primary" id="sess-start">${icon(s.running ? 'pause' : 'play', 16)} ${s.running ? 'Pause' : 'Start'}</button>
        <button type="button" class="btn btn--outline" data-sess="reset">${icon('reset', 16)} Reset</button>
        <button type="button" class="btn btn--soft" data-sess="next">${icon('next', 16)} Next</button>
      </div>
      <div class="tiny dim center">Total sesi aktif: <span id="sess-total">${fmtClock(s.totalElapsed)}</span> · ${s.exercises.length} latihan</div>
    </div>
    ${ex.description ? `<div class="small muted" style="line-height:1.55;margin-top:-4px">${escapeHtml(ex.description)}</div>` : ''}
    <div class="card card--soft" style="padding:4px 12px">
      ${s.exercises.map((x, i) => `<div class="exercise-row" style="opacity:${i < s.idx ? '.5' : '1'}">
        <div class="exercise-row__idx">${i < s.idx ? icon('check', 13) : i + 1}</div>
        <div class="exercise-row__body"><div class="small ${i === s.idx ? 'bold' : ''}">${escapeHtml(x.name)}</div><div class="tiny dim">${x.durationSec ? `${Math.round(x.durationSec / 60)} menit` : 'Tanpa durasi'}</div></div>
        ${i === s.idx ? `<span class="tag" style="color:var(--accent)">Sekarang</span>` : ''}
      </div>`).join('')}
    </div>
    <div class="info-note">${icon('info', 18)}<div>Sesi tetap berjalan selama layar ini terbuka. Jangan tutup/tidurkan perangkat saat latihan agar timer akurat.</div></div>
  </div>`;
}

async function startWorkoutSession({ title, planId = null, exercises }) {
  if (session) return;
  const normalized = exercises.map(ex => ({ ...ex, durationSec: Math.max(1, ex.durationSec || 60) }));
  session = {
    title, planId, exercises: normalized, idx: 0, mode: 'countdown', running: false,
    remaining: normalized[0].durationSec, elapsed: 0, totalElapsed: 0,
    lastTick: 0, timer: null, wrap: null, completed: false, wakeLock: null
  };
  chime('tick');
  const result = await showModal({
    title: 'Sesi Olahraga',
    content: `<div id="sess-ui">${sessionBodyHtml(session)}</div>`,
    buttons: [
      { label: 'Akhiri Sesi', className: 'btn--danger', onClick: finish => { if (session) session.aborted = true; finish('quit'); } },
      { label: 'Tutup', className: 'btn--outline', onClick: finish => finish('close') }
    ],
    onMount(wrap, finish) {
      if (!session) return;
      session.wrap = wrap;
      wrap.__finish = finish;
      wrap.addEventListener('click', e => onSessionClick(e, wrap));
      updateSessionUI();
    }
  });
  const finished = session;
  cleanupSession();
  session = null;
  if (finished && finished.completed) {
    const durationSec = Math.max(1, Math.round(finished.totalElapsed));
    await saveHistory({
      title: finished.title, planId: finished.planId, date: toYMD(), durationSec, completed: true,
      source: 'session', exercises: finished.exercises.map(x => ({ name: x.name, durationSec: x.durationSec }))
    });
    if (document.visibilityState !== 'visible') {
      showNotification({ title: 'Sesi olahraga selesai', body: `${finished.title} — ${durationText(durationSec)}. Kerja bagus!`, tag: 'workout-done' });
    }
    showSessionSummary(finished, durationSec);
  }
  return result;
}

function cleanupSession() {
  if (!session) return;
  if (session.timer) clearInterval(session.timer);
  session.timer = null;
  session.running = false;
  releaseWakeLock();
  chime('tick');
}

async function acquireWakeLock() {
  if (!session || session.wakeLock || !('wakeLock' in navigator)) return;
  try {
    session.wakeLock = await navigator.wakeLock.request('screen');
    session.wakeLock.addEventListener('release', () => { if (session) session.wakeLock = null; });
  } catch {}
}
function releaseWakeLock() {
  if (session?.wakeLock) { try { session.wakeLock.release(); } catch {} session.wakeLock = null; }
}

function startTimer() {
  if (!session) return;
  session.running = true;
  session.lastTick = Date.now();
  acquireWakeLock();
  if (session.timer) clearInterval(session.timer);
  session.timer = setInterval(() => {
    if (!session || !session.running) return;
    const now = Date.now();
    const delta = Math.min(2, (now - session.lastTick) / 1000);
    session.lastTick = now;
    session.totalElapsed += delta;
    if (session.mode === 'countdown') {
      session.remaining -= delta;
      if (session.remaining <= 0) {
        session.remaining = 0;
        updateSessionUI();
        advanceExercise(true);
        return;
      }
    } else {
      session.elapsed += delta;
    }
    updateSessionUI();
  }, 250);
}

function pauseTimer() {
  if (!session) return;
  session.running = false;
  if (session.timer) clearInterval(session.timer);
  session.timer = null;
  releaseWakeLock();
  updateSessionUI();
}

function advanceExercise(auto = false) {
  if (!session) return;
  chime('done');
  session.idx += 1;
  if (session.idx >= session.exercises.length) {
    session.completed = true;
    session.running = false;
    if (session.timer) clearInterval(session.timer);
    session.timer = null;
    const finish = session.wrap?.__finish;
    // finish via close button click fallback
    if (typeof finish === 'function') finish('done');
    else document.querySelector('.modal [data-modal-dismiss]')?.click();
    return;
  }
  session.remaining = session.exercises[session.idx].durationSec;
  session.elapsed = 0;
  session.lastTick = Date.now();
  if (!auto) { session.running = session.running; }
  renderSessionBody();
  if (auto) startTimer();
  toast(`Latihan berikut: ${session.exercises[session.idx].name}`);
}

function resetExercise() {
  if (!session) return;
  session.remaining = session.exercises[session.idx].durationSec;
  session.elapsed = 0;
  session.lastTick = Date.now();
  updateSessionUI();
  toast('Timer direset');
}

function updateSessionUI() {
  if (!session || !session.wrap) return;
  const timeEl = $('#sess-time', session.wrap);
  const statusEl = $('#sess-status', session.wrap);
  const totalEl = $('#sess-total', session.wrap);
  const ring = $('#sess-ring', session.wrap);
  const startBtn = $('#sess-start', session.wrap);
  if (!timeEl) return;
  const ex = session.exercises[session.idx];
  const duration = ex.durationSec || 60;
  let fraction;
  if (session.mode === 'countdown') {
    timeEl.textContent = fmtClock(session.remaining);
    fraction = clamp(session.remaining / duration, 0, 1);
  } else {
    timeEl.textContent = fmtClock(session.elapsed);
    fraction = 1 - ((session.elapsed % 60) / 60);
  }
  const circumference = 326.7;
  if (ring) ring.setAttribute('stroke-dashoffset', String(circumference * (1 - fraction)));
  if (statusEl) statusEl.textContent = session.running ? 'Berjalan' : (session.totalElapsed > 0 ? 'Dijeda' : 'Siap dimulai');
  if (totalEl) totalEl.textContent = fmtClock(session.totalElapsed);
  if (startBtn) startBtn.innerHTML = `${icon(session.running ? 'pause' : 'play', 16)} ${session.running ? 'Pause' : (session.totalElapsed > 0 ? 'Resume' : 'Start')}`;
}

function renderSessionBody() {
  if (!session || !session.wrap) return;
  const holder = $('#sess-ui', session.wrap);
  if (holder) holder.innerHTML = sessionBodyHtml(session);
  updateSessionUI();
  const finish = session.wrap.__finish;
  if (typeof finish === 'function') {
    // nothing; controls are delegated
  }
}

function onSessionClick(e, wrap) {
  if (!session) return;
  const startBtn = e.target.closest('#sess-start');
  if (startBtn) {
    if (session.running) pauseTimer();
    else startTimer();
    updateSessionUI();
    return;
  }
  const modeBtn = e.target.closest('[data-sess="mode"]');
  if (modeBtn) {
    if (session.mode === modeBtn.dataset.mode) return;
    pauseTimer();
    session.mode = modeBtn.dataset.mode;
    session.remaining = session.exercises[session.idx].durationSec;
    session.elapsed = 0;
    session.lastTick = Date.now();
    renderSessionBody();
    toast(session.mode === 'countdown' ? 'Mode hitung mundur' : 'Mode stopwatch');
    return;
  }
  const resetBtn = e.target.closest('[data-sess="reset"]');
  if (resetBtn) { resetExercise(); return; }
  const nextBtn = e.target.closest('[data-sess="next"]');
  if (nextBtn) {
    pauseTimer();
    advanceExercise(true);
    if (session && !session.completed) startTimer();
    return;
  }
}

function showSessionSummary(finished, durationSec) {
  const totalMinutes = Math.round(durationSec / 60);
  showModal({
    title: 'Sesi Selesai 🎉',
    content: `<div class="center stack" style="gap:6px;padding:6px 0 4px">
      <div class="empty__icon" style="background:rgba(74,222,128,.14);color:var(--success);margin-bottom:2px">${icon('check', 34)}</div>
      <div style="font-size:20px;font-weight:800">${escapeHtml(finished.title)}</div>
      <div class="muted small">${finished.exercises.length} latihan · ${durationText(durationSec)}</div>
      <div class="progress-bar" style="margin-top:12px"><i style="width:100%"></i></div>
      <div class="tiny dim" style="margin-top:6px">${totalMinutes} menit tercatat di riwayat olahraga.</div>
    </div>`,
    buttons: [{ label: 'Selesai', className: 'btn--primary', value: true }]
  });
}

/* expose minimal reset for settings resets */
export function resetWorkoutState() { state.tab = 'plans'; }
