/* ============================================================
   EZRoutine — Statistics (local data only)
   ============================================================ */
import { getAll } from './database.js';
import { buildInstances } from './schedule.js';
import { toYMD, addDays, startOfWeek, fromYMD, dayShort, monthShort, pad2 } from './utils.js';
import { escapeHtml } from './utils.js';
import { icon, setAppBar, themeToggleButton } from './ui.js';

function pct(done, total) { return total ? Math.round((done / total) * 100) : 0; }

function weekBuckets() {
  const end = startOfWeek(toYMD());
  const buckets = [];
  for (let i = 7; i >= 0; i--) {
    const start = addDays(end, -i * 7);
    const days = Array.from({ length: 7 }, (_, j) => addDays(start, j));
    buckets.push({ start, days, label: `${fromYMD(start).getDate()}/${fromYMD(start).getMonth() + 1}` });
  }
  return buckets;
}

function monthBuckets() {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, j) => `${ym}-${pad2(j + 1)}`);
    buckets.push({ ym, days, label: monthShort[d.getMonth()] });
  }
  return buckets;
}

function barChart(items, { maxValue, valueKey = 'pct', labelKey = 'label', color = 'var(--accent)' } = {}) {
  const max = maxValue || Math.max(1, ...items.map(i => i[valueKey] || 0));
  return `<div class="chart" role="img" aria-label="Grafik">
    ${items.map(i => {
      const v = i[valueKey] || 0;
      const h = Math.max(3, (v / max) * 100);
      return `<div class="chart__col">
        <div class="chart__value">${escapeHtml(String(i.display ?? v))}</div>
        <div class="chart__bar ${v === 0 ? 'chart__bar--zero' : ''}" style="height:${h}%;${v ? `background:linear-gradient(180deg,${color},color-mix(in srgb, ${color} 35%, transparent))` : ''}" title="${escapeHtml(i.label)}: ${v}"></div>
        <div class="chart__label">${escapeHtml(i[labelKey])}</div>
      </div>`;
    }).join('')}
  </div>`;
}

export async function renderStats(root) {
  const [activities, history] = await Promise.all([getAll('activities'), getAll('workoutHistory')]);
  const today = toYMD();
  const weekStart = startOfWeek(today);

  // Activity stats over last 30 days
  let totalDone = 0;
  let totalPending = 0;
  for (let i = 0; i < 30; i++) {
    const day = addDays(today, -i);
    const items = buildInstances(activities, day);
    totalDone += items.filter(x => x.done).length;
    totalPending += items.filter(x => !x.done).length;
  }
  const totalAll = totalDone + totalPending;
  const consistency = pct(totalDone, totalAll);

  const workoutSessions = history.length;
  const totalWorkoutMin = Math.round(history.reduce((s, h) => s + (h.durationSec || 0), 0) / 60);
  const thisWeekWorkout = history.filter(h => h.date >= weekStart).length;

  // Weekly chart (last 8 weeks) - activity completion %
  const weekly = weekBuckets().map(b => {
    let done = 0, total = 0;
    b.days.forEach(day => {
      const items = buildInstances(activities, day);
      done += items.filter(x => x.done).length;
      total += items.length;
    });
    const p = pct(done, total);
    return { label: b.label, pct: p, display: total ? `${p}%` : '—', total, done };
  });

  // Monthly chart (last 6 months)
  const monthly = monthBuckets().map(b => {
    let done = 0, total = 0;
    b.days.filter(d => d <= today).forEach(day => {
      const items = buildInstances(activities, day);
      done += items.filter(x => x.done).length;
      total += items.length;
    });
    const p = pct(done, total);
    return { label: b.label, pct: p, display: total ? `${p}%` : '—', total };
  });

  // Workout weekly chart (last 8 weeks, minutes)
  const woWeekly = weekBuckets().map(b => {
    const mins = Math.round(history.filter(h => h.date >= b.start && h.date <= addDays(b.start, 6)).reduce((s, h) => s + (h.durationSec || 0), 0) / 60);
    return { label: b.label, value: mins, display: mins || '' };
  });
  const woMonthly = monthBuckets().map(b => {
    const mins = Math.round(history.filter(h => h.date.startsWith(b.ym)).reduce((s, h) => s + (h.durationSec || 0), 0) / 60);
    return { label: b.label, value: mins, display: mins || '' };
  });
  const woMax = Math.max(10, ...woWeekly.map(w => w.value));
  const woMonthMax = Math.max(10, ...woMonthly.map(w => w.value));

  setAppBar({
    title: 'Statistik',
    subtitle: 'Pantau konsistensi dari data lokal',
    actions: themeToggleButton()
  });

  root.innerHTML = `<div class="page">
    <div class="grid grid--2" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="stat-tile"><div class="stat-tile__label">${icon('check', 14)} Selesai (30 hari)</div><div class="stat-tile__value">${totalDone}</div></div>
      <div class="stat-tile"><div class="stat-tile__label">${icon('clock', 14)} Tertunda (30 hari)</div><div class="stat-tile__value">${totalPending}</div></div>
      <div class="stat-tile"><div class="stat-tile__label">${icon('dumbbell', 14)} Sesi olahraga</div><div class="stat-tile__value">${workoutSessions}</div></div>
      <div class="stat-tile"><div class="stat-tile__label">${icon('timer', 14)} Durasi olahraga</div><div class="stat-tile__value">${totalWorkoutMin}<span class="stat-tile__unit">mnt</span></div></div>
    </div>

    <div class="card card--pad">
      <div class="card__head">
        <div>
          <div class="card__title">Konsistensi aktivitas</div>
          <div class="card__sub">Berdasarkan 30 hari terakhir</div>
        </div>
        <div style="font-size:28px;font-weight:850;color:var(--accent)">${consistency}%</div>
      </div>
      <div class="progress-bar" style="height:10px"><i style="width:${consistency}%"></i></div>
      <div class="row" style="justify-content:space-between;margin-top:8px">
        <span class="tiny dim">${totalDone} selesai dari ${totalAll} aktivitas</span>
        <span class="tiny dim">${thisWeekWorkout} sesi olahraga minggu ini</span>
      </div>
    </div>

    <div class="card card--pad">
      <div class="card__head"><div><div class="card__title">Aktivitas mingguan</div><div class="card__sub">Persentase selesai, 8 minggu terakhir</div></div></div>
      ${barChart(weekly, { maxValue: 100, valueKey: 'pct', color: 'var(--accent)' })}
      <div class="chart-legend"><span><i style="background:var(--accent)"></i>Persentase selesai</span></div>
    </div>

    <div class="card card--pad">
      <div class="card__head"><div><div class="card__title">Aktivitas bulanan</div><div class="card__sub">Persentase selesai, 6 bulan terakhir</div></div></div>
      ${barChart(monthly, { maxValue: 100, valueKey: 'pct', color: 'var(--accent-2)' })}
      <div class="chart-legend"><span><i style="background:var(--accent-2)"></i>Persentase selesai</span></div>
    </div>

    <div class="card card--pad">
      <div class="card__head"><div><div class="card__title">Durasi olahraga mingguan</div><div class="card__sub">Total menit, 8 minggu terakhir</div></div></div>
      ${barChart(woWeekly, { maxValue: woMax, valueKey: 'value', color: '#ff8a5b' })}
      <div class="chart-legend"><span><i style="background:#ff8a5b"></i>Menit olahraga</span></div>
    </div>

    <div class="card card--pad">
      <div class="card__head"><div><div class="card__title">Durasi olahraga bulanan</div><div class="card__sub">Total menit, 6 bulan terakhir</div></div></div>
      ${barChart(woMonthly, { maxValue: woMonthMax, valueKey: 'value', color: '#ff8a5b' })}
      <div class="chart-legend"><span><i style="background:#ff8a5b"></i>Menit olahraga</span></div>
    </div>

    <div class="info-note">${icon('info', 18)}<div>Semua statistik dihitung dari data lokal di perangkat ini. Tidak ada data yang dikirim ke server.</div></div>
  </div>`;
}
