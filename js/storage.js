/* ============================================================
   EZRoutine — LocalStorage (simple settings & small flags)
   ============================================================ */

const SETTINGS_KEY = 'ezroutine.settings.v1';
const META_KEY = 'ezroutine.meta.v1';

export const ACCENTS = [
  { name: 'Biru Ungu', value: '#7c8cff', second: '#00d4b1' },
  { name: 'Hijau Mint', value: '#00d4b1', second: '#7c8cff' },
  { name: 'Oranye', value: '#ff9f43', second: '#ff6b6b' },
  { name: 'Merah Muda', value: '#f472b6', second: '#8b5cf6' },
  { name: 'Biru Langit', value: '#38bdf8', second: '#6366f1' },
  { name: 'Kuning', value: '#fbbf24', second: '#fb7185' }
];

export const DEFAULT_SETTINGS = Object.freeze({
  name: 'Pengguna',
  language: 'id',
  timeFormat: '24',
  theme: 'dark',
  accent: '#7c8cff',
  accent2: '#00d4b1',
  defaultVolume: 70,
  defaultSound: 'builtin:rise',
  snoozeMin: 5,
  notifications: true,
  vibration: true,
  weeklyGoal: 5,
  defaultWorkoutMin: 30,
  alarmLimitNoticeShown: false,
  installNoticeShown: false
});

const DEFAULT_META = Object.freeze({ lastOpen: null, lastAlarmCheck: null, seenVersion: 1 });

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...fallback, ...parsed }
      : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

let _settings = null;
let _meta = null;

export function getSettings() {
  if (!_settings) _settings = read(SETTINGS_KEY, DEFAULT_SETTINGS);
  return _settings;
}

export function saveSettings(patch) {
  _settings = { ...getSettings(), ...patch };
  write(SETTINGS_KEY, _settings);
  return _settings;
}

export function resetSettings() {
  _settings = { ...DEFAULT_SETTINGS };
  _meta = { ...DEFAULT_META };
  write(SETTINGS_KEY, _settings);
  write(META_KEY, _meta);
}

export function getMeta() {
  if (!_meta) _meta = read(META_KEY, DEFAULT_META);
  return _meta;
}

export function saveMeta(patch) {
  _meta = { ...getMeta(), ...patch };
  write(META_KEY, _meta);
  return _meta;
}

export function replaceSettings(raw) {
  _settings = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  write(SETTINGS_KEY, _settings);
}
