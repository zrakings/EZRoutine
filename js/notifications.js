/* ============================================================
   EZRoutine — Notification API helpers
   ============================================================ */
import { getSettings } from './storage.js';

const ICON = './assets/icons/icon-192.png';

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionStatus() {
  return isNotificationSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; }
  catch { return false; }
}

export async function showNotification({ title, body = '', tag = 'ezroutine', silent = false, vibrate = true } = {}) {
  if (!getSettings().notifications || !isNotificationSupported() || Notification.permission !== 'granted') return false;
  const options = {
    body,
    tag,
    icon: ICON,
    badge: ICON,
    silent,
    vibrate: vibrate && getSettings().vibration ? [220, 90, 220] : undefined,
    data: { url: '#/alarm', openedAt: Date.now() }
  };
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    try { new Notification(title, options); return true; } catch { return false; }
  }
}

export async function clearNotifications(tag) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const list = await registration.getNotifications();
    list.filter(n => !tag || n.tag === tag).forEach(n => n.close());
  } catch {}
}

export function browserCapabilities() {
  return {
    notification: isNotificationSupported(),
    notificationPermission: permissionStatus(),
    serviceWorker: 'serviceWorker' in navigator,
    audio: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
    periodicSync: 'serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype,
    backgroundSync: 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype,
    vibration: typeof navigator !== 'undefined' && !!navigator.vibrate,
    wakeLock: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    installPrompt: false
  };
}
