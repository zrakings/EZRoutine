/* ============================================================
   EZRoutine — Dashboard / Home
   ============================================================ */
import { getAll } from './database.js';
import { buildInstances, openActivityEditor, toggleActivityDone, resetScheduleView } from './schedule.js';
import { getAlarms, openAlarmEditor } from './alarm.js';
import { getCategory } from './constants.js';
import {
  toYMD, fmtTime, timeToMinutes, greet, formatDate, escapeHtml, dayNames, pad2
} from './utils.js';
import { icon, setAppBar, toast, themeToggleButton, emptyState } from './ui.js';
import { getSettings } from './storage.js';
import { dataChanged } from './events.js';
import { navigate } from './router.js';

let clockTimer = null;
let boundRoot = null;

function clearClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }

export async function renderHome(root) {
  clearClock();
  const today = toYMD();
  const [activities, alarms] = await Promise.all([getAll('activities'), getAlarms()]);
  const items = buildInstances(activities, today);
  const done = items.filter(i => i.done).length;
  const pending = items.length - done;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const nextActivity = items.find(i => !i.done && timeToMinutes(i.startTime) >= nowMin) || items.find(i => !i.done);
  const enabledAlarms = alarms.filter(a => a.enabled).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const nextAlarm = enabledAlarms.find(a => timeToMinutes(a.time) >= nowMin) || enabledAlarms[0] || null;

  const settings = getSettings();
  const now = new Date();
  const dateLabel = formatDate(today, { withDay: true });

  setAppBar({
    title: 'EZRoutine',
    subtitle: dateLabel,
    actions: `${themeToggleButton()}`
  });

  const circumference = 2 * Math.PI * 54;
  const dash = circumference * (1 - pct / 100);

  root.innerHTML = `<div class="page">
    <section class="card card--pad card--accent" style="overflow:hidden">
      <div class="row" style="align-items:flex-start;gap:14px">
        <div style="flex:1;min-width:0">
          <div class="eyebrow">${greet()}</div>
          <div style="font-size:clamp(22px,6vw,30px);font-weight:850;letter-spacing:-.8px;margin-top:2px;overflow-wrap:anywhere">${escapeHtml(settings.name || 'Pengguna')}</div>
          <div class="muted small" style="margin-top:4px">${dateLabel}</div>
          <div class="mono" id="home-clock" style="font-size:clamp(30px,8vw,44px);font-weight:850;letter-spacing:-2px;margin-top:10px;line-height:1">${pad2(now.getHours())}:${pad2(now.getMinutes())}<span style="font-size:.45em;letter-spacing:-.5px;color:var(--text-2);margin-left:4px">:${pad2(now.getSeconds())}</span></div>
        </div>
        <div class="progress-ring" aria-label="Progress harian ${pct}%">
          <svg viewBox="0 0 120 120">
            <defs><linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--accent-2)"/></linearGradient></defs>
            <circle class="progress-ring__track" cx="60" cy="60" r="54" fill="none" stroke-width="10"/>
            <circle class="progress-ring__bar" cx="60" cy="60" r="54" fill="none" stroke-width="10" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dash.toFixed(1)}"/>
          </svg>
          <div class="progress-ring__inner"><div class="progress-ring__value">${pct}%</div><div class="progress-ring__label">hari ini</div></div>
        </div>
      </div>
      <div class="grid grid--3" style="margin-top:16px;gap:8px">
        <div class="stat-tile" style="background:rgba(255,255,255,.06)"><div class="stat-tile__label">Selesai</div><div class="stat-tile__value" style="font-size:20px">${done}</div></div>
        <div class="stat-tile" style="background:rgba(255,255,255,.06)"><div class="stat-tile__label">Belum</div><div class="stat-tile__value" style="font-size:20px">${pending}</div></div>
        <div class="stat-tile" style="background:rgba(255,255,255,.06)"><div class="stat-tile__label">Total</div><div class="stat-tile__value" style="font-size:20px">${items.length}</div></div>
      </div>
    </section>

    <div class="grid grid--2">
      <div class="card card--pad">
        <div class="card__head"><div class="card__title">${icon('calendar', 16)} Jadwal berikutnya</div></div>
        ${nextActivity ? `
          <div style="font-size:15px;font-weight:750">${escapeHtml(nextActivity.title)}</div>
          <div class="small muted" style="margin-top:5px">${fmtTime(nextActivity.startTime, { withSuffix: true })} – ${fmtTime(nextActivity.endTime, { withSuffix: true })}</div>
          <div style="margin-top:8px"><span class="tag" style="color:${nextActivity.color || getCategory(nextActivity.category).color}"><i class="tag__dot"></i>${escapeHtml(getCategory(nextActivity.category).name)}</span></div>
        ` : `<div class="small muted">Tidak ada aktivitas tersisa hari ini.</div>`}
        <div class="card__foot"><button type="button" class="btn btn--sm btn--soft" data-home="open-schedule">Lihat Jadwal</button></div>
      </div>
      <div class="card card--pad">
        <div class="card__head"><div class="card__title">${icon('bell', 16)} Alarm berikutnya</div></div>
        ${nextAlarm ? `
          <div style="font-size:24px;font-weight:850;letter-spacing:-1px" class="mono">${escapeHtml(fmtTime(nextAlarm.time, { withSuffix: true }))}</div>
          <div class="small muted" style="margin-top:4px">${escapeHtml(nextAlarm.name || 'Alarm')}</div>
          <div class="tiny dim" style="margin-top:4px">${escapeHtml(nextAlarm.repeatType === 'daily' ? 'Setiap hari' : nextAlarm.repeatType === 'weekly' ? (nextAlarm.days||[]).map(d=>dayNames[d]).join(', ') : 'Sekali')}</div>
        ` : `<div class="small muted">Belum ada alarm aktif.</div>`}
        <div class="card__foot"><button type="button" class="btn btn--sm btn--soft" data-home="open-alarm">Buka Alarm</button></div>
      </div>
    </div>

    <div class="row" style="gap:8px">
      <button type="button" class="btn btn--primary" style="flex:1" data-home="add-activity">${icon('plus', 17)} Tambah Aktivitas</button>
      <button type="button" class="btn btn--soft" style="flex:1" data-home="add-alarm">${icon('bell', 17)} Buat Alarm</button>
    </div>

    <section>
      <div class="page-head" style="margin-bottom:10px">
        <div>
          <div class="eyebrow">Today's Overview</div>
          <h2 style="margin:4px 0 0">Aktivitas hari ini</h2>
        </div>
        <span class="tag">${items.length} aktivitas</span>
      </div>
      ${items.length ? `<div class="timeline" id="home-timeline">${items.map(item => homeItemCard(item)).join('')}</div>`
        : emptyState({ iconName: 'sparkle', title: 'Hari ini masih kosong', text: 'Mulai rencanakan harimu dengan menambah aktivitas pertama.', action: `<button type="button" class="btn btn--primary btn--sm" data-home="add-activity">${icon('plus',16)} Tambah Aktivitas</button>` })}
    </section>
  </div>`;

  bindHomeEvents(root);
  startClock();
}

function homeItemCard(item) {
  const cat = getCategory(item.category);
  const color = item.color || cat.color;
  return `<article class="timeline-item ${item.done ? 'is-done' : ''}" style="--item-color:${color}">
    <div class="timeline-card ${item.done ? 'is-done' : ''}">
      <div class="timeline-card__top">
        <div style="flex:1;min-width:0">
          <div class="timeline-card__title">${escapeHtml(item.title)}</div>
          <div class="timeline-card__meta">
            <span class="mono">${fmtTime(item.startTime)} – ${fmtTime(item.endTime)}</span>
            <span class="tag" style="color:${color}"><i class="tag__dot"></i>${escapeHtml(cat.name)}</span>
            ${item.done ? `<span style="color:var(--success);font-weight:700">Selesai</span>` : `<span>Belum selesai</span>`}
          </div>
        </div>
        <button type="button" class="done-toggle ${item.done ? 'is-done' : ''}" data-home-action="toggle" data-id="${item.id}" data-date="${item.instanceDate}" aria-label="${item.done ? 'Tandai belum selesai' : 'Tandai selesai'}">${icon('check', 18)}</button>
      </div>
      <div class="timeline-card__actions">
        <button type="button" class="btn btn--sm btn--outline" data-home-action="edit" data-id="${item.id}">${icon('edit', 14)} Edit</button>
        <button type="button" class="btn btn--sm btn--danger" data-home-action="delete" data-id="${item.id}" data-date="${item.instanceDate}">${icon('trash', 14)} Hapus</button>
      </div>
    </div>
  </article>`;
}

function bindHomeEvents(root) {
  if (boundRoot === root) return;
  boundRoot = root;
  root.addEventListener('click', async e => {
    const homeBtn = e.target.closest('[data-home]');
    if (homeBtn) {
      const act = homeBtn.dataset.home;
      if (act === 'add-activity') openActivityEditor({ date: toYMD() });
      if (act === 'add-alarm') openAlarmEditor();
      if (act === 'open-schedule') { resetScheduleView(); navigate('schedule'); }
      if (act === 'open-alarm') navigate('alarm');
      return;
    }
    const actionBtn = e.target.closest('[data-home-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.homeAction;
    const id = actionBtn.dataset.id;
    const date = actionBtn.dataset.date;
    const activities = await getAll('activities');
    const master = activities.find(a => a.id === id);
    if (!master) return;

    if (action === 'toggle') {
      await toggleActivityDone(master, date);
      toast(isDone(master, date) ? 'Ditandai belum selesai' : 'Aktivitas selesai 🎉');
      renderHome(root);
    } else if (action === 'edit') {
      openActivityEditor({ activity: master, date });
    } else if (action === 'delete') {
      const { confirmDialog } = await import('./ui.js');
      // Reuse schedule delete behavior by importing? easier to implement simple recurring-aware delete
      const { choiceDialog } = await import('./ui.js');
      const { remove, put, getAll } = await import('./database.js');
      const recurring = master.repeat && master.repeat.type !== 'none' && master.repeat.type !== 'date';
      if (!recurring) {
        const ok = await confirmDialog({ title: 'Hapus aktivitas?', message: `"${master.title}" akan dihapus.`, confirmLabel: 'Hapus', danger: true });
        if (!ok) return;
        await remove('activities', id);
      } else {
        const choice = await choiceDialog({ title: 'Hapus aktivitas berulang', message: `"${master.title}" berulang. Pilih cakupan.`, choices: [
          { label: 'Hanya tanggal ini', value: 'day', icon: 'calendar' },
          { label: 'Seluruh pengulangan', value: 'all', icon: 'trash', className: 'btn--danger' }
        ]});
        if (!choice) return;
        if (choice === 'all') await remove('activities', id);
        else {
          const fresh = (await getAll('activities')).find(a => a.id === id);
          if (fresh) { fresh.repeat = { ...fresh.repeat, excludedDates: [...new Set([...(fresh.repeat.excludedDates || []), date])] }; fresh.updatedAt = Date.now(); await put('activities', fresh); }
        }
      }
      toast('Aktivitas dihapus');
      dataChanged('activities');
      renderHome(root);
    }
  });
}

function isDone(master, date) {
  if (master.repeat && master.repeat.type !== 'none' && master.repeat.type !== 'date') return !!(master.completions || {})[date];
  return !!master.completed;
}

function startClock() {
  clearClock();
  const tick = () => {
    const el = document.getElementById('home-clock');
    if (!el) { clearClock(); return; }
    const n = new Date();
    el.innerHTML = `${pad2(n.getHours())}:${pad2(n.getMinutes())}<span style="font-size:.45em;letter-spacing:-.5px;color:var(--text-2);margin-left:4px">:${pad2(n.getSeconds())}</span>`;
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}
