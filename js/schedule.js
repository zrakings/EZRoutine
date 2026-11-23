/* ============================================================
   EZRoutine — Daily schedule, calendar, templates & reminders
   ============================================================ */
import { getAll, put, remove } from './database.js';
import { CATEGORIES, getCategory, REMINDER_OPTIONS, REPEAT_OPTIONS } from './constants.js';
import {
  $, $$, escapeHtml, uid, toYMD, fromYMD, addDays, startOfWeek, weekDates, formatDate,
  formatDayLabel, fmtTime, timeToMinutes, sortByTime, isSameDayInstance, instanceId,
  isInstanceDone, dayShort, dayNames, monthNames, pad2
} from './utils.js';
import { icon, toast, showModal, confirmDialog, choiceDialog, emptyState, setAppBar, themeToggleButton } from './ui.js';
import { showNotification } from './notifications.js';
import { dataChanged } from './events.js';

export const COLOR_PALETTE = [
  '#ff6b6b', '#f472b6', '#a78bfa', '#7c8cff', '#38bdf8', '#2dd4bf',
  '#34d399', '#a3e635', '#fbbf24', '#fb923c', '#94a3b8', '#e2e8f0'
];

const state = {
  view: 'day',
  date: toYMD(),
  week: startOfWeek(),
  month: toYMD().slice(0, 7),
  calendarDate: toYMD()
};

let cache = [];
let boundRoot = null;

/* --------------------------- Data helpers --------------------------- */

export async function getActivities() {
  cache = await getAll('activities');
  return cache;
}

export function buildInstances(list, date) {
  return sortByTime(list
    .filter(item => isSameDayInstance(item, date))
    .map(item => ({
      ...item,
      instanceDate: date,
      instanceId: instanceId(item, date),
      done: isInstanceDone(item, date)
    })));
}

export async function getDayInstances(date = toYMD()) {
  return buildInstances(await getAll('activities'), date);
}

export function reminderLabel(mins) {
  if (!mins) return 'Tanpa pengingat';
  const found = REMINDER_OPTIONS.find(o => o.value === Number(mins));
  return found ? found.label : `${mins} menit sebelum`;
}

export function repeatLabel(repeat) {
  if (!repeat || repeat.type === 'none' || repeat.type === 'date') return '';
  if (repeat.type === 'daily') return 'Setiap hari';
  return (repeat.days || []).map(d => dayShort[d]).join(', ');
}

function repeatBadge(item) {
  const label = repeatLabel(item.repeat);
  return label ? `<span class="tag">${icon('repeat', 11)} ${escapeHtml(label)}</span>` : '';
}

/* --------------------------- Completion --------------------------- */

export async function toggleActivityDone(master, date) {
  const fresh = (await getAll('activities')).find(a => a.id === master.id);
  if (!fresh) return null;
  const recurring = fresh.repeat && fresh.repeat.type !== 'none' && fresh.repeat.type !== 'date';
  if (recurring) {
    fresh.completions = { ...(fresh.completions || {}) };
    if (fresh.completions[date]) delete fresh.completions[date];
    else fresh.completions[date] = Date.now();
  } else {
    fresh.completed = !fresh.completed;
    fresh.completedAt = fresh.completed ? Date.now() : null;
  }
  fresh.updatedAt = Date.now();
  await put('activities', fresh);
  dataChanged('activities');
  return fresh;
}

/* --------------------------- Editor --------------------------- */

function colorSwatches(selected) {
  return COLOR_PALETTE.map(c => `<button type="button" class="color-swatch ${c === selected ? 'is-active' : ''}" style="--c:${c}" data-color="${c}" aria-label="Warna ${c}"></button>`).join('');
}

function dayPicker(selected = []) {
  return dayShort.map((d, i) => `<button type="button" data-day="${i}" class="${selected.includes(i) ? 'is-active' : ''}" aria-label="${dayNames[i]}" aria-pressed="${selected.includes(i)}">${d}</button>`).join('');
}

export async function openActivityEditor({ activity = null, date = toYMD(), prefill = null } = {}) {
  const categories = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const reminders = REMINDER_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  const repeats = REPEAT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  const it = activity || prefill || {};
  const repeat = it.repeat || { type: 'none', days: [] };
  const selectedDays = repeat.days && repeat.days.length ? repeat.days : [fromYMD(date).getDay()];
  const cat = getCategory(it.category || 'personal');
  const color = it.color || cat.color;

  const html = `
    <form class="form-stack" id="activity-form" novalidate>
      <div class="field">
        <label for="af-title">Nama aktivitas</label>
        <input id="af-title" class="input" maxlength="80" placeholder="Contoh: Latihan pagi" value="${escapeHtml(it.title || '')}" required>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="af-category">Kategori</label>
          <select id="af-category" class="select">${categories}</select>
        </div>
        <div class="field">
          <span class="field-label">Warna</span>
          <div class="color-grid" id="af-colors">${colorSwatches(color)}</div>
          <input type="hidden" id="af-color" value="${color}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="af-date">Tanggal</label>
          <input type="date" id="af-date" class="input" value="${escapeHtml(it.date || date)}" required>
        </div>
        <div class="field">
          <label for="af-reminder">Pengingat</label>
          <select id="af-reminder" class="select">${reminders}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="af-start">Jam mulai</label>
          <input type="time" id="af-start" class="input" value="${escapeHtml(it.startTime || '08:00')}" required>
        </div>
        <div class="field">
          <label for="af-end">Jam selesai</label>
          <input type="time" id="af-end" class="input" value="${escapeHtml(it.endTime || '09:00')}" required>
        </div>
      </div>
      <div class="field">
        <label for="af-repeat">Pengulangan</label>
        <select id="af-repeat" class="select">${repeats}</select>
      </div>
      <div class="field hidden" id="af-days-wrap">
        <span class="field-label">Ulangi pada hari</span>
        <div class="day-picker" id="af-days">${dayPicker(selectedDays)}</div>
      </div>
      <div class="field">
        <label for="af-desc">Deskripsi <span class="dim">(opsional)</span></label>
        <textarea id="af-desc" class="textarea" maxlength="300" placeholder="Catatan singkat...">${escapeHtml(it.description || '')}</textarea>
      </div>
      ${!activity ? `<label class="row small muted" style="gap:10px;padding:2px 0">
        <input type="checkbox" id="af-template"> Simpan juga sebagai template
      </label>` : ''}
      ${activity && (activity.repeat?.type === 'daily' || activity.repeat?.type === 'weekly')
        ? `<div class="info-note">${icon('info', 18)}<div>Perubahan akan berlaku untuk <strong>seluruh pengulangan</strong>. Gunakan tombol hapus untuk menghapus hanya satu tanggal.</div></div>` : ''}
    </form>`;

  await showModal({
    title: activity ? 'Edit Aktivitas' : 'Aktivitas Baru',
    content: html,
    buttons: [
      { label: 'Batal', className: 'btn--outline', value: false },
      {
        label: activity ? 'Simpan Perubahan' : 'Simpan',
        className: 'btn--primary',
        onClick: async (finish, wrap) => {
          const form = $('#activity-form', wrap);
          const title = $('#af-title', form).value.trim();
          const startTime = $('#af-start', form).value;
          const endTime = $('#af-end', form).value;
          const chosenDate = $('#af-date', form).value;
          const repeatType = $('#af-repeat', form).value;
          const days = $$('#af-days [data-day].is-active', form).map(b => Number(b.dataset.day));

          if (!title) { toast('Nama aktivitas wajib diisi', 'error'); return; }
          if (!chosenDate || !startTime || !endTime) { toast('Tanggal dan jam wajib diisi', 'error'); return; }
          if (startTime === endTime) { toast('Jam mulai dan selesai tidak boleh sama', 'error'); return; }
          if (repeatType === 'weekly' && !days.length) { toast('Pilih minimal satu hari pengulangan', 'error'); return; }

          const category = $('#af-category', form).value;
          const record = {
            id: activity?.id || uid('act'),
            title,
            description: $('#af-desc', form).value.trim(),
            category,
            color: $('#af-color', form).value || getCategory(category).color,
            date: chosenDate,
            startTime,
            endTime,
            reminderMinutes: Number($('#af-reminder', form).value) || 0,
            repeat: repeatType === 'none'
              ? { type: 'none', days: [] }
              : { type: repeatType, days: repeatType === 'weekly' ? days : [], excludedDates: activity?.repeat?.excludedDates || [] },
            completed: activity?.completed || false,
            completedAt: activity?.completedAt || null,
            completions: activity?.completions || {},
            createdAt: activity?.createdAt || Date.now(),
            updatedAt: Date.now()
          };

          const asTemplate = $('#af-template', form)?.checked;
          await put('activities', record);
          if (asTemplate) {
            const duration = Math.max(1, timeToMinutes(endTime) - timeToMinutes(startTime));
            await put('templates', {
              id: uid('tpl'), name: title, title, description: record.description, category, color: record.color,
              durationMin: duration > 0 ? duration : 60, reminderMinutes: record.reminderMinutes, createdAt: Date.now()
            });
            toast('Aktivitas & template tersimpan');
          } else {
            toast(activity ? 'Aktivitas diperbarui' : 'Aktivitas ditambahkan');
          }
          dataChanged('activities');
          finish(true);
        }
      }
    ],
    onMount(wrap) {
      const catSelect = $('#af-category', wrap);
      const repeatSelect = $('#af-repeat', wrap);
      const daysWrap = $('#af-days-wrap', wrap);
      catSelect.value = it.category || 'personal';
      $('#af-reminder', wrap).value = String(it.reminderMinutes || 0);
      repeatSelect.value = repeat.type || 'none';
      const syncDays = () => daysWrap.classList.toggle('hidden', repeatSelect.value !== 'weekly');
      syncDays();
      repeatSelect.addEventListener('change', syncDays);

      catSelect.addEventListener('change', () => {
        const c = getCategory(catSelect.value);
        $('#af-color', wrap).value = c.color;
        $$('#af-colors .color-swatch', wrap).forEach(s => s.classList.toggle('is-active', s.dataset.color === c.color));
      });
      $('#af-colors', wrap).addEventListener('click', e => {
        const btn = e.target.closest('.color-swatch');
        if (!btn) return;
        $('#af-color', wrap).value = btn.dataset.color;
        $$('#af-colors .color-swatch', wrap).forEach(s => s.classList.toggle('is-active', s === btn));
      });
      $('#af-days', wrap).addEventListener('click', e => {
        const btn = e.target.closest('[data-day]');
        if (!btn) return;
        btn.classList.toggle('is-active');
        btn.setAttribute('aria-pressed', String(btn.classList.contains('is-active')));
      });
    }
  });
}

/* --------------------------- Delete / templates --------------------------- */

async function deleteActivity(master, dateLabel) {
  const recurring = master.repeat && master.repeat.type !== 'none' && master.repeat.type !== 'date';
  if (!recurring) {
    const ok = await confirmDialog({ title: 'Hapus aktivitas?', message: `"${master.title}" akan dihapus permanen.`, confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    await remove('activities', master.id);
    toast('Aktivitas dihapus');
    dataChanged('activities');
    return;
  }
  const choice = await choiceDialog({
    title: 'Hapus aktivitas berulang',
    message: `"${master.title}" diulang. Pilih cakupan penghapusan.`,
    choices: [
      { label: 'Hapus hanya tanggal ini', value: 'day', icon: 'calendar' },
      { label: 'Hapus seluruh pengulangan', value: 'all', icon: 'trash', className: 'btn--danger' }
    ]
  });
  if (!choice) return;
  if (choice === 'day') {
    const fresh = (await getAll('activities')).find(a => a.id === master.id);
    if (!fresh) return;
    fresh.repeat = { ...fresh.repeat, excludedDates: [...new Set([...(fresh.repeat.excludedDates || []), dateLabel])] };
    fresh.updatedAt = Date.now();
    await put('activities', fresh);
    toast('Aktivitas dilewati untuk tanggal ini');
  } else {
    await remove('activities', master.id);
    toast('Seluruh pengulangan dihapus');
  }
  dataChanged('activities');
}

async function openTemplateForm(existing = null) {
  const categories = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const reminders = REMINDER_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  await showModal({
    title: existing ? 'Edit Template' : 'Template Baru',
    content: `<form class="form-stack" id="tpl-form" novalidate>
      <div class="field"><label for="tf-name">Nama template</label>
        <input id="tf-name" class="input" maxlength="60" value="${escapeHtml(existing?.name || '')}" placeholder="Contoh: Rutinitas pagi" required></div>
      <div class="field"><label for="tf-title">Nama aktivitas</label>
        <input id="tf-title" class="input" maxlength="80" value="${escapeHtml(existing?.title || '')}" placeholder="Contoh: Stretching" required></div>
      <div class="field-row">
        <div class="field"><label for="tf-category">Kategori</label><select id="tf-category" class="select">${categories}</select></div>
        <div class="field"><label for="tf-duration">Durasi (menit)</label><input id="tf-duration" class="input" type="number" min="5" max="720" step="5" value="${existing?.durationMin || 30}"></div>
      </div>
      <div class="field"><label for="tf-reminder">Pengingat</label><select id="tf-reminder" class="select">${reminders}</select></div>
      <div class="field"><label for="tf-desc">Deskripsi</label><textarea id="tf-desc" class="textarea" maxlength="300">${escapeHtml(existing?.description || '')}</textarea></div>
    </form>`,
    buttons: [
      { label: 'Batal', className: 'btn--outline', value: false },
      {
        label: 'Simpan Template', className: 'btn--primary',
        onClick: async (finish, wrap) => {
          const name = $('#tf-name', wrap).value.trim();
          const title = $('#tf-title', wrap).value.trim();
          if (!name || !title) { toast('Nama template dan aktivitas wajib diisi', 'error'); return; }
          const category = $('#tf-category', wrap).value;
          await put('templates', {
            id: existing?.id || uid('tpl'),
            name, title,
            description: $('#tf-desc', wrap).value.trim(),
            category,
            color: getCategory(category).color,
            durationMin: Math.max(5, Number($('#tf-duration', wrap).value) || 30),
            reminderMinutes: Number($('#tf-reminder', wrap).value) || 0,
            createdAt: existing?.createdAt || Date.now(),
            updatedAt: Date.now()
          });
          toast(existing ? 'Template diperbarui' : 'Template dibuat');
          dataChanged('templates');
          finish(true);
        }
      }
    ],
    onMount(wrap) {
      $('#tf-category', wrap).value = existing?.category || 'personal';
      $('#tf-reminder', wrap).value = String(existing?.reminderMinutes || 0);
    }
  });
}

export async function openTemplateManager(targetDate = toYMD()) {
  const templates = await getAll('templates');
  const list = templates.length ? templates.map(t => `
    <div class="list-row">
      <div class="list-row__icon" style="color:${t.color || getCategory(t.category).color}">${icon('copy', 20)}</div>
      <div class="list-row__body">
        <div class="list-row__title">${escapeHtml(t.name)}</div>
        <div class="list-row__sub">${escapeHtml(t.title)} · ${t.durationMin} menit · ${escapeHtml(getCategory(t.category).name)}</div>
      </div>
      <div class="list-row__actions">
        <button type="button" class="icon-btn" data-tpl-use="${t.id}" aria-label="Gunakan template" title="Gunakan">${icon('plus', 18)}</button>
        <button type="button" class="icon-btn" data-tpl-edit="${t.id}" aria-label="Edit template" title="Edit">${icon('edit', 18)}</button>
        <button type="button" class="icon-btn" data-tpl-del="${t.id}" aria-label="Hapus template" title="Hapus">${icon('trash', 18)}</button>
      </div>
    </div>`).join('') : emptyState({ iconName: 'copy', title: 'Belum ada template', text: 'Template mempercepat pembuatan jadwal yang berulang.' });

  await showModal({
    title: 'Template Aktivitas',
    content: `<div class="stack">${list}</div>`,
    buttons: [{ label: 'Tutup', className: 'btn--outline', value: false }, { label: '+ Template Baru', className: 'btn--primary', value: 'new' }],
    onMount(wrap, finish) {
      wrap.addEventListener('click', async e => {
        const useBtn = e.target.closest('[data-tpl-use]');
        const editBtn = e.target.closest('[data-tpl-edit]');
        const delBtn = e.target.closest('[data-tpl-del]');
        if (useBtn) {
          const t = (await getAll('templates')).find(x => x.id === useBtn.dataset.tplUse);
          if (!t) return;
          finish('use');
          const start = '08:00';
          const end = `${pad2(Math.floor((timeToMinutes(start) + t.durationMin) / 60) % 24)}:${pad2((timeToMinutes(start) + t.durationMin) % 60)}`;
          openActivityEditor({
            date: targetDate,
            prefill: {
              title: t.title, description: t.description, category: t.category, color: t.color,
              startTime: start, endTime: end, reminderMinutes: t.reminderMinutes,
              date: targetDate, repeat: { type: 'none', days: [] }
            }
          });
        } else if (editBtn) {
          const t = (await getAll('templates')).find(x => x.id === editBtn.dataset.tplEdit);
          if (t) { finish('edit'); openTemplateForm(t); }
        } else if (delBtn) {
          const ok = await confirmDialog({ title: 'Hapus template?', message: 'Template ini akan dihapus permanen.', confirmLabel: 'Hapus', danger: true });
          if (ok) {
            await remove('templates', delBtn.dataset.tplDel);
            toast('Template dihapus');
            finish('deleted');
            openTemplateManager(targetDate);
          }
        }
      });
    }
  }).then(async res => {
    if (res === 'new') openTemplateForm();
    if (res === 'deleted') openTemplateManager(targetDate);
  });
}

/* --------------------------- Page rendering --------------------------- */

function instanceCard(item) {
  const cat = getCategory(item.category);
  const overdue = !item.done && timeToMinutes(item.endTime) < (new Date().getHours() * 60 + new Date().getMinutes()) && item.instanceDate === toYMD();
  return `<article class="timeline-item ${item.done ? 'is-done' : ''}" style="--item-color:${item.color || cat.color}">
    <div class="timeline-card ${item.done ? 'is-done' : ''}">
      <div class="timeline-card__top">
        <div style="flex:1;min-width:0">
          <div class="timeline-card__title">${escapeHtml(item.title)}</div>
          <div class="timeline-card__meta">
            <span class="mono">${fmtTime(item.startTime)} – ${fmtTime(item.endTime)}</span>
            <span class="tag" style="color:${item.color || cat.color}"><i class="tag__dot"></i>${escapeHtml(cat.name)}</span>
            ${repeatBadge(item)}
            ${item.reminderMinutes ? `<span>${icon('bell', 12)} ${escapeHtml(reminderLabel(item.reminderMinutes))}</span>` : ''}
            ${overdue ? `<span style="color:var(--warning);font-weight:700">Belum selesai</span>` : ''}
          </div>
          ${item.description ? `<div class="small muted" style="margin-top:8px;line-height:1.5">${escapeHtml(item.description)}</div>` : ''}
        </div>
        <button type="button" class="done-toggle ${item.done ? 'is-done' : ''}" data-action="toggle" data-id="${item.id}" data-date="${item.instanceDate}" aria-label="${item.done ? 'Tandai belum selesai' : 'Tandai selesai'}" aria-pressed="${item.done}">
          ${icon('check', 18)}
        </button>
      </div>
      <div class="timeline-card__actions">
        <button type="button" class="btn btn--sm btn--outline" data-action="edit" data-id="${item.id}">${icon('edit', 14)} Edit</button>
        <button type="button" class="btn btn--sm btn--danger" data-action="delete" data-id="${item.id}">${icon('trash', 14)} Hapus</button>
      </div>
    </div>
  </article>`;
}

function dayListHtml(items) {
  if (!items.length) {
    return emptyState({
      iconName: 'calendar', title: 'Belum ada aktivitas',
      text: 'Tambahkan aktivitas pertamamu untuk tanggal ini.',
      action: `<button type="button" class="btn btn--primary btn--sm" data-action="add">${icon('plus', 16)} Tambah Aktivitas</button>`
    });
  }
  return `<div class="timeline">${items.map(instanceCard).join('')}</div>`;
}

function daySummary(items) {
  const done = items.filter(i => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  return `<div class="card card--pad">
    <div class="row">
      <div style="flex:1">
        <div class="eyebrow">Ringkasan hari</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px">${done}<span class="dim" style="font-size:13px;font-weight:600"> / ${items.length} selesai</span></div>
        <div class="progress-bar" style="margin-top:10px"><i style="width:${pct}%"></i></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:24px;font-weight:800;color:var(--accent)">${pct}%</div>
        <div class="tiny dim">selesai</div>
      </div>
    </div>
  </div>`;
}

function dayView(items) {
  const d = state.date;
  return `<div class="row" style="justify-content:space-between">
      <button type="button" class="icon-btn" data-action="day-prev" aria-label="Hari sebelumnya">${icon('chevronLeft')}</button>
      <button type="button" class="stack" data-action="pick-day" style="background:none;border:0;gap:2px;align-items:center" aria-label="Pilih tanggal">
        <span style="font-weight:750;font-size:14px">${formatDate(d, { withDay: true })}</span>
        <span class="tiny dim">${d === toYMD() ? 'Hari ini' : 'Ketuk untuk ganti tanggal'}</span>
      </button>
      <button type="button" class="icon-btn" data-action="day-next" aria-label="Hari berikutnya">${icon('chevronRight')}</button>
    </div>
    <input type="date" id="schedule-date-input" class="hidden" value="${d}" aria-label="Pilih tanggal">
    ${daySummary(items)}
    ${dayListHtml(items)}`;
}

function weekView() {
  const days = weekDates(state.week);
  return `<div class="row" style="justify-content:space-between">
      <button type="button" class="icon-btn" data-action="week-prev" aria-label="Minggu sebelumnya">${icon('chevronLeft')}</button>
      <div style="text-align:center">
        <div style="font-weight:750;font-size:14px">${formatDate(days[0], { short: true })} – ${formatDate(days[6], { short: true })}</div>
        <button type="button" class="tiny dim" data-action="week-today" style="background:none;border:0;padding:2px">Minggu ini</button>
      </div>
      <button type="button" class="icon-btn" data-action="week-next" aria-label="Minggu berikutnya">${icon('chevronRight')}</button>
    </div>
    <div class="week-grid" id="week-grid">${days.map(day => {
      const items = buildInstances(cache, day);
      const done = items.filter(i => i.done).length;
      return `<div class="week-day ${day === toYMD() ? 'is-today' : ''}">
        <button type="button" class="week-day__head" data-action="goto-day" data-date="${day}">
          <span class="week-day__dow">${dayShort[fromYMD(day).getDay()]}</span>
          <span class="week-day__num">${fromYMD(day).getDate()}</span>
          <span class="tiny dim">${items.length ? `${done}/${items.length}` : '—'}</span>
        </button>
        <div class="week-day__items">
          ${items.length ? items.map(i => `<div class="week-item ${i.done ? 'is-done' : ''}" style="--item-color:${i.color || getCategory(i.category).color}">
              <span class="dot"></span>
              <span class="week-item__time mono">${fmtTime(i.startTime)}</span>
              <span class="week-item__title">${escapeHtml(i.title)}</span>
              <button type="button" class="mini-check ${i.done ? 'is-done' : ''}" data-action="toggle" data-id="${i.id}" data-date="${i.instanceDate}" aria-label="Tandai selesai">${icon('check', 12)}</button>
            </div>`).join('') : `<div class="week-day__empty">Kosong</div>`}
        </div>
      </div>`;
    }).join('')}</div>`;
}

function monthCells(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ ymd: toYMD(d), inMonth: d.getMonth() === m - 1, day: d.getDate() });
  }
  return cells;
}

function calendarView(itemsForSelected) {
  const [y, m] = state.month.split('-').map(Number);
  const cells = monthCells(state.month);
  const selectedItems = itemsForSelected;
  return `<div class="row" style="justify-content:space-between">
      <button type="button" class="icon-btn" data-action="cal-prev" aria-label="Bulan sebelumnya">${icon('chevronLeft')}</button>
      <div style="text-align:center">
        <div style="font-weight:750;font-size:14px">${monthNames[m - 1]} ${y}</div>
        <button type="button" class="tiny dim" data-action="cal-today" style="background:none;border:0;padding:2px">Bulan ini</button>
      </div>
      <button type="button" class="icon-btn" data-action="cal-next" aria-label="Bulan berikutnya">${icon('chevronRight')}</button>
    </div>
    <div class="calendar-grid" role="grid" aria-label="Kalender">
      ${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => `<div class="calendar-grid__dow">${d}</div>`).join('')}
      ${cells.map(c => {
        const items = c.inMonth ? buildInstances(cache, c.ymd) : [];
        return `<button type="button" class="calendar-day ${c.inMonth ? '' : 'is-empty'} ${c.ymd === state.calendarDate ? 'is-selected' : ''} ${c.ymd === toYMD() ? 'is-today' : ''}" ${c.inMonth ? `data-action="select-calendar-day" data-date="${c.ymd}"` : ''} aria-label="${formatDate(c.ymd)}">
          <span>${c.day}</span>
          <span class="calendar-day__dots">${items.slice(0, 3).map(() => '<i></i>').join('')}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="row" style="justify-content:space-between;margin-top:4px">
      <div class="card__title">${formatDayLabel(state.calendarDate)}</div>
      <button type="button" class="btn btn--sm btn--soft" data-action="add">${icon('plus', 14)} Tambah</button>
    </div>
    ${dayListHtml(selectedItems)}`;
}

export async function renderSchedule(root) {
  cache = await getAll('activities');
  const items = buildInstances(cache, state.date);
  const selectedItems = buildInstances(cache, state.calendarDate);
  setAppBar({
    title: 'Jadwal Harian',
    subtitle: 'Kelola aktivitas & pengingat',
    actions: `<button type="button" class="icon-btn" data-sched-action="templates" aria-label="Template" title="Template">${icon('copy', 21)}</button>
      <button type="button" class="icon-btn" data-sched-action="add" aria-label="Tambah aktivitas" title="Tambah">${icon('plus', 21)}</button>
      ${themeToggleButton()}`
  });

  const viewBtn = (v, label) => `<button type="button" data-action="view" data-view="${v}" class="${state.view === v ? 'is-active' : ''}">${label}</button>`;
  root.innerHTML = `<div class="page">
    <div class="segmented" role="tablist" aria-label="Tampilan jadwal">
      ${viewBtn('day', 'Harian')}${viewBtn('week', 'Mingguan')}${viewBtn('calendar', 'Kalender')}
    </div>
    ${state.view === 'day' ? dayView(items) : state.view === 'week' ? weekView() : calendarView(selectedItems)}
  </div>`;

  const barAdd = document.querySelector('[data-sched-action="add"]');
  const barTpl = document.querySelector('[data-sched-action="templates"]');
  if (barAdd) barAdd.onclick = () => openActivityEditor({ date: state.calendarDate && state.view === 'calendar' ? state.calendarDate : state.date });
  if (barTpl) barTpl.onclick = () => openTemplateManager(state.view === 'calendar' ? state.calendarDate : state.date);

  if (!boundRoot) {
    boundRoot = root;
    root.addEventListener('click', onScheduleClick);
    root.addEventListener('change', e => {
      if (e.target.id === 'schedule-date-input') {
        state.date = e.target.value || toYMD();
        renderSchedule(root);
      }
    });
  }
}

async function onScheduleClick(e) {
  const viewBtn = e.target.closest('[data-action="view"]');
  if (viewBtn) {
    state.view = viewBtn.dataset.view;
    if (state.view === 'calendar') state.month = state.date.slice(0, 7);
    if (state.view === 'week') state.week = startOfWeek(state.date);
    renderSchedule(boundRoot);
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const date = btn.dataset.date;
  const findMaster = async aid => (await getAll('activities')).find(a => a.id === aid);

  switch (action) {
    case 'add':
      openActivityEditor({ date: state.view === 'calendar' ? state.calendarDate : state.date });
      break;
    case 'pick-day': {
      const input = $('#schedule-date-input');
      if (input) { if (typeof input.showPicker === 'function') { try { input.showPicker(); } catch { input.click(); } } else input.click(); }
      break;
    }
    case 'day-prev': state.date = addDays(state.date, -1); state.week = startOfWeek(state.date); renderSchedule(boundRoot); break;
    case 'day-next': state.date = addDays(state.date, 1); state.week = startOfWeek(state.date); renderSchedule(boundRoot); break;
    case 'week-prev': state.week = addDays(state.week, -7); renderSchedule(boundRoot); break;
    case 'week-next': state.week = addDays(state.week, 7); renderSchedule(boundRoot); break;
    case 'week-today': state.week = startOfWeek(); renderSchedule(boundRoot); break;
    case 'goto-day': state.date = date; state.week = startOfWeek(date); state.view = 'day'; renderSchedule(boundRoot); break;
    case 'cal-prev': state.month = shiftMonth(state.month, -1); state.calendarDate = `${state.month}-01`; renderSchedule(boundRoot); break;
    case 'cal-next': state.month = shiftMonth(state.month, 1); state.calendarDate = `${state.month}-01`; renderSchedule(boundRoot); break;
    case 'cal-today': state.month = toYMD().slice(0, 7); state.calendarDate = toYMD(); renderSchedule(boundRoot); break;
    case 'select-calendar-day': state.calendarDate = date; state.date = date; renderSchedule(boundRoot); break;
    case 'toggle': {
      const master = await findMaster(id);
      if (!master) return;
      const updated = await toggleActivityDone(master, date);
      if (updated) {
        const done = isInstanceDone(updated, date);
        toast(done ? 'Aktivitas selesai 🎉' : 'Ditandai belum selesai');
        renderSchedule(boundRoot);
      }
      break;
    }
    case 'edit': {
      const master = await findMaster(id);
      if (master) openActivityEditor({ activity: master, date: date || master.date });
      break;
    }
    case 'delete': {
      const master = await findMaster(id);
      if (master) await deleteActivity(master, date || master.date);
      break;
    }
    default: break;
  }
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/* --------------------------- Activity reminders --------------------------- */

const NOTIFIED_KEY = 'ezroutine.notified.v1';

function readNotified() {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY)) || {}; } catch { return {}; }
}
function writeNotified(obj) {
  const keys = Object.keys(obj).sort();
  const trimmed = {};
  keys.slice(-400).forEach(k => { trimmed[k] = obj[k]; });
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(trimmed)); } catch {}
}

export async function checkActivityReminders() {
  const today = toYMD();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items = buildInstances(await getAll('activities'), today);
  const notified = readNotified();
  for (const item of items) {
    if (item.done || !item.reminderMinutes) continue;
    const trigger = timeToMinutes(item.startTime) - Number(item.reminderMinutes);
    const key = `${today}|${item.instanceId}`;
    if (nowMin >= trigger && nowMin < timeToMinutes(item.startTime) && !notified[key]) {
      notified[key] = Date.now();
      const when = item.reminderMinutes === 0 ? 'sekarang' : `${item.reminderMinutes} menit lagi`;
      showNotification({
        title: `Pengingat: ${item.title}`,
        body: `Mulai ${fmtTime(item.startTime, { withSuffix: true })} (${when}).`,
        tag: `activity-${item.instanceId}`
      });
      window.dispatchEvent(new CustomEvent('ez:activity-reminder', { detail: { item } }));
    }
  }
  writeNotified(notified);
}

export function resetScheduleView() {
  state.date = toYMD();
  state.week = startOfWeek();
  state.month = toYMD().slice(0, 7);
  state.calendarDate = toYMD();
}
