/* ============================================================
   EZRoutine — IndexedDB data layer
   Stores: activities, templates, workoutPlans, workoutHistory,
           alarms, audio
   ============================================================ */
import { getSettings, replaceSettings, resetSettings } from './storage.js';
import { uid } from './utils.js';

const DB_NAME = 'ezroutine-db';
const DB_VERSION = 1;
export const STORES = ['activities', 'templates', 'workoutPlans', 'workoutHistory', 'alarms', 'audio'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('Browser tidak mendukung IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error || new Error('Gagal membuka database')); };
    req.onblocked = () => { dbPromise = null; reject(new Error('Database sedang digunakan tab lain')); };
  });
  return dbPromise;
}

async function transaction(storeNames, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Transaksi gagal'));
    tx.onabort = () => reject(tx.error || new Error('Transaksi dibatalkan'));
    try { result = work(tx); } catch (err) { try { tx.abort(); } catch {} reject(err); }
  });
}

const reqPromise = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('Operasi gagal'));
});

export async function getAll(store) {
  return transaction(store, 'readonly', tx => reqPromise(tx.objectStore(store).getAll()));
}
export async function get(store, id) {
  return transaction(store, 'readonly', tx => reqPromise(tx.objectStore(store).get(id)));
}
export async function put(store, value) {
  return transaction(store, 'readwrite', tx => reqPromise(tx.objectStore(store).put(value)));
}
export async function remove(store, id) {
  return transaction(store, 'readwrite', tx => reqPromise(tx.objectStore(store).delete(id)));
}
export async function clearStore(store) {
  return transaction(store, 'readwrite', tx => reqPromise(tx.objectStore(store).clear()));
}
export async function bulkPut(store, values) {
  return transaction(store, 'readwrite', tx => {
    const os = tx.objectStore(store);
    values.forEach(v => os.put(v));
  });
}
export async function count(store) {
  return transaction(store, 'readonly', tx => reqPromise(tx.objectStore(store).count()));
}

/* --------------------------- Export / Import --------------------------- */

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca audio'));
    reader.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportData() {
  const data = {};
  for (const store of STORES) {
    data[store] = store === 'audio'
      ? await Promise.all((await getAll(store)).map(async a => ({
          id: a.id, name: a.name, type: a.type, size: a.size, createdAt: a.createdAt,
          dataUrl: await blobToDataURL(a.blob)
        })))
      : await getAll(store);
  }
  return {
    app: 'EZRoutine',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    data
  };
}

/** mode: 'replace' (hapus data lama) atau 'merge' (gabungkan, data lokal menang untuk id sama) */
export async function importData(payload, mode = 'replace') {
  if (!payload || payload.app !== 'EZRoutine' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('Format file tidak dikenali sebagai backup EZRoutine');
  }
  const imported = {};
  for (const store of STORES) {
    const raw = Array.isArray(payload.data[store]) ? payload.data[store] : [];
    if (store === 'audio') {
      imported[store] = await Promise.all(raw.map(async a => {
        if (!a || !a.dataUrl) return null;
        return {
          id: a.id || uid('snd'), name: a.name || 'Suara', type: a.type || 'audio/mpeg',
          size: a.size || 0, createdAt: a.createdAt || Date.now(), blob: await dataURLToBlob(a.dataUrl)
        };
      }).filter(Boolean));
    } else {
      imported[store] = raw.filter(item => item && item.id);
    }
  }

  for (const store of STORES) {
    if (mode === 'replace') await clearStore(store);
    const existingIds = mode === 'merge' ? new Set((await getAll(store)).map(x => x.id)) : new Set();
    const items = imported[store].filter(x => mode === 'replace' || !existingIds.has(x.id));
    if (items.length) await bulkPut(store, items);
  }

  if (payload.settings && typeof payload.settings === 'object') {
    if (mode === 'replace') replaceSettings(payload.settings);
  }
  return Object.fromEntries(STORES.map(s => [s, imported[s].length]));
}

export async function clearAllData({ keepSettings = true } = {}) {
  for (const store of STORES) await clearStore(store);
  if (!keepSettings) resetSettings();
}

export async function storageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
