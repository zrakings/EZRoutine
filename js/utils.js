/* ============================================================
   EZRoutine — Utilities
   ============================================================ */
import { getSettings } from './storage.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const pad2 = n => String(n).padStart(2, '0');
export const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const dayShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function toYMD(date = new Date()) {
  if (date instanceof Date) return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return String(date).slice(0, 10);
}

export function fromYMD(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(ymd, count) {
  const d = fromYMD(ymd);
  d.setDate(d.getDate() + count);
  return toYMD(d);
}

export function diffDays(a, b) {
  return Math.round((fromYMD(a) - fromYMD(b)) / 86400000);
}

export function startOfWeek(ymd = toYMD()) {
  const d = fromYMD(ymd);
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex);
  return toYMD(d);
}

export function weekDates(ymd = toYMD()) {
  const start = startOfWeek(ymd);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDate(ymd, opts = {}) {
  if (!ymd) return '—';
  const d = fromYMD(ymd);
  if (opts.short) return `${d.getDate()} ${monthShort[d.getMonth()]} ${d.getFullYear()}`;
  if (opts.withDay) return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayLabel(ymd) {
  const today = toYMD();
  if (ymd === today) return 'Hari ini';
  if (ymd === addDays(today, 1)) return 'Besok';
  if (ymd === addDays(today, -1)) return 'Kemarin';
  return formatDate(ymd, { withDay: true });
}

/** Format 'HH:MM' to 12/24h according to settings. */
export function fmtTime(time, opts = {}) {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return '—';
  const [h, m] = time.split(':').map(Number);
  const use24 = opts.force24 ?? getSettings().timeFormat === '24';
  if (use24) return `${pad2(h)}:${pad2(m)}`;
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 || 12;
  return opts.withSuffix ? `${hour12}:${pad2(m)} ${suffix}` : `${hour12}:${pad2(m)}`;
}

export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function durationText(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}j ${pad2(m)}m`;
  if (m > 0) return `${m} menit${sec ? ` ${pad2(sec)}d` : ''}`;
  return `${sec} detik`;
}

export function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Selamat malam';
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [124, 140, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
}

export function safeParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

export function sortByTime(items) {
  return [...items].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || (a.title || '').localeCompare(b.title || ''));
}

export function isSameDayInstance(item, ymd) {
  const r = item.repeat || { type: 'none' };
  if (r.type === 'none' || r.type === 'date') return item.date === ymd;
  if (r.type === 'daily') return ymd >= item.date && !(r.excludedDates || []).includes(ymd);
  if (r.type === 'weekly') {
    const dow = fromYMD(ymd).getDay();
    return ymd >= item.date && (r.days || []).includes(dow) && !(r.excludedDates || []).includes(ymd);
  }
  return false;
}

export function instanceId(item, ymd) {
  return item.repeat && item.repeat.type !== 'none' && item.repeat.type !== 'date'
    ? `${item.id}::${ymd}` : item.id;
}

export function isInstanceDone(item, ymd) {
  if (!item.repeat || item.repeat.type === 'none' || item.repeat.type === 'date') return !!item.completed;
  return !!(item.completions || {})[ymd];
}
