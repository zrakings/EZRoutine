/* ============================================================
   EZRoutine — Static catalogs
   ============================================================ */

export const CATEGORIES = [
  { id: 'sport', name: 'Olahraga', color: '#ff6b6b', icon: 'dumbbell' },
  { id: 'school', name: 'Sekolah', color: '#38bdf8', icon: 'layers' },
  { id: 'work', name: 'Pekerjaan', color: '#a78bfa', icon: 'briefcase' },
  { id: 'rest', name: 'Istirahat', color: '#34d399', icon: 'moon' },
  { id: 'study', name: 'Belajar', color: '#fbbf24', icon: 'book' },
  { id: 'worship', name: 'Ibadah', color: '#2dd4bf', icon: 'sparkle' },
  { id: 'personal', name: 'Pribadi', color: '#f472b6', icon: 'user' },
  { id: 'other', name: 'Lainnya', color: '#94a3b8', icon: 'tag' }
];

export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

export const REMINDER_OPTIONS = [
  { value: 0, label: 'Tepat waktu' },
  { value: 5, label: '5 menit sebelum' },
  { value: 10, label: '10 menit sebelum' },
  { value: 15, label: '15 menit sebelum' },
  { value: 30, label: '30 menit sebelum' },
  { value: 60, label: '1 jam sebelum' }
];

export const REPEAT_OPTIONS = [
  { value: 'none', label: 'Sekali (tanggal tertentu)' },
  { value: 'daily', label: 'Setiap hari' },
  { value: 'weekly', label: 'Hari tertentu setiap minggu' }
];

export const SNOOZE_OPTIONS = [5, 10, 15, 20, 30];

export const WORKOUT_LIBRARY = [
  {
    id: 'walking', name: 'Walking', category: 'Cardio ringan', durationSec: 1800, calories: 120,
    description: 'Jalan santai dengan postur tegak. Cocok untuk pemanasan atau hari pemulihan.'
  },
  {
    id: 'jogging', name: 'Jogging', category: 'Cardio', durationSec: 1500, calories: 230,
    description: 'Lari pelan dengan napas stabil. Jaga ritme yang nyaman dan hentikan jika nyeri.'
  },
  {
    id: 'jumping-jacks', name: 'Jumping Jacks', category: 'Cardio', durationSec: 600, calories: 90,
    description: 'Lompat membuka kaki dan mengangkat tangan. Latihan ringan untuk detak jantung.'
  },
  {
    id: 'squats', name: 'Squats', category: 'Kekuatan', durationSec: 900, calories: 110,
    description: 'Tekuk lutut seperti duduk, dada tegak. Latihan kaki dan inti tubuh.'
  },
  {
    id: 'push-up', name: 'Push Up', category: 'Kekuatan', durationSec: 600, calories: 75,
    description: 'Turunkan dada dengan siku tertekuk, lalu dorong kembali. Bisa versi lutut.'
  },
  {
    id: 'plank', name: 'Plank', category: 'Inti tubuh', durationSec: 300, calories: 40,
    description: 'Tahan posisi papan dengan tubuh lurus. Fokus pada pernapasan dan inti tubuh.'
  },
  {
    id: 'stretching', name: 'Stretching', category: 'Mobilitas', durationSec: 720, calories: 45,
    description: 'Peregangan lembut leher, bahu, punggung, dan kaki. Tahan tiap gerakan 20–30 detik.'
  },
  {
    id: 'rest-day', name: 'Rest Day', category: 'Pemulihan', durationSec: 0, calories: 0,
    description: 'Hari istirahat aktif. Cukup jalan ringan dan cukupi kebutuhan cairan.'
  }
];

export function getLibraryItem(id) {
  return WORKOUT_LIBRARY.find(w => w.id === id) || null;
}

export const WORKOUT_CATEGORIES = ['Cardio', 'Cardio ringan', 'Kekuatan', 'Inti tubuh', 'Mobilitas', 'Pemulihan', 'Lainnya'];

export const APP_VERSION = '1.0.0';
