/* ============================================================
   EZRoutine — Web Audio engine (built-in tones + custom files)
   ============================================================ */
import { get as dbGet } from './database.js';
import { clamp } from './utils.js';

export const BUILTIN_SOUNDS = [
  { id: 'builtin:rise', name: 'Rise', desc: 'Nada naik lembut' },
  { id: 'builtin:bell', name: 'Bell', desc: 'Loncceng klasik' },
  { id: 'builtin:pulse', name: 'Pulse', desc: 'Pulsa berulang' },
  { id: 'builtin:sunrise', name: 'Sunrise', desc: 'Arpeggio cerah' },
  { id: 'builtin:digital', name: 'Digital', desc: 'Beep digital' }
];

let ctx = null;
let active = null;

function context() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('Web Audio API tidak didukung browser');
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(audioCtx, destination, { freq, at, dur, type = 'sine', gain = .25, attack = .01 }) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g); g.connect(destination);
  osc.start(at);
  osc.stop(at + dur + .03);
  return osc;
}

function scheduleBuiltin(soundId, audioCtx, out, loop, nodes = []) {
  const base = audioCtx.currentTime + .04;
  const seq = (notes, step, dur, type = 'sine', gain = .25) => {
    notes.forEach((f, i) => nodes.push(tone(audioCtx, out, { freq: f, at: base + i * step, dur, type, gain })));
  };
  switch (soundId) {
    case 'builtin:bell':
      seq([784, 1046, 784], .32, 1.1, 'sine', .28);
      seq([392, 523, 392], .32, 1.1, 'triangle', .1);
      break;
    case 'builtin:pulse':
      for (let i = 0; i < 6; i++) {
        nodes.push(tone(audioCtx, out, { freq: 880, at: base + i * .34, dur: .13, type: 'square', gain: .17 }));
        nodes.push(tone(audioCtx, out, { freq: 660, at: base + i * .34 + .15, dur: .12, type: 'square', gain: .12 }));
      }
      break;
    case 'builtin:sunrise':
      seq([523, 659, 784, 1046, 784, 1046], .19, .42, 'triangle', .22);
      seq([262, 330, 392, 523], .19, .5, 'sine', .1);
      break;
    case 'builtin:digital':
      for (let i = 0; i < 4; i++) nodes.push(tone(audioCtx, out, { freq: i % 2 ? 988 : 740, at: base + i * .24, dur: .18, type: 'square', gain: .16 }));
      break;
    case 'builtin:rise':
    default:
      seq([440, 554, 659, 880], .22, .55, 'sine', .25);
      seq([220, 277, 330, 440], .22, .6, 'triangle', .09);
      break;
  }
  if (loop) {
    const repeatMs = 2600;
    const timer = setInterval(() => {
      if (!active || active.id !== controllerId) return clearInterval(timer);
      scheduleBuiltin(soundId, audioCtx, out, false, nodes);
    }, repeatMs);
    return timer;
  }
  return null;
}

let controllerId = 0;

function stopActive() {
  if (!active) return;
  const a = active;
  active = null;
  if (a.timer) clearInterval(a.timer);
  if (a.audio) {
    try { a.audio.pause(); a.audio.currentTime = 0; } catch {}
    if (a.objectUrl) setTimeout(() => URL.revokeObjectURL(a.objectUrl), 500);
  }
  if (a.nodes) a.nodes.forEach(n => { try { n.stop(); } catch {} });
  if (a.gain) { try { a.gain.disconnect(); } catch {} }
}

export function stopSound() { stopActive(); }

/** Play a built-in or custom alarm sound. Returns { id, stop } */
export async function playSound(soundId, { volume = 70, loop = false } = {}) {
  stopActive();
  const id = ++controllerId;
  const level = clamp(Number(volume) / 100, 0, 1);
  if (level <= 0) return { id, stop: () => {} };

  if (String(soundId).startsWith('builtin:')) {
    const audioCtx = context();
    const gain = audioCtx.createGain();
    gain.gain.value = level * .85;
    gain.connect(audioCtx.destination);
    const nodes = [];
    const timer = scheduleBuiltin(soundId, audioCtx, gain, loop, nodes);
    active = { id, nodes, gain, timer };
    return { id, stop: () => { if (active && active.id === id) stopActive(); } };
  }

  const customId = String(soundId).replace(/^custom:/, '');
  const record = await dbGet('audio', customId);
  if (!record || !record.blob) throw new Error('Suara kustom tidak ditemukan');
  const objectUrl = URL.createObjectURL(record.blob);
  const audio = new Audio(objectUrl);
  audio.loop = loop;
  audio.volume = level;
  audio.preload = 'auto';
  active = { id, audio, objectUrl };
  try { await audio.play(); }
  catch (err) {
    if (active && active.id === id) stopActive();
    throw new Error('Browser memblokir pemutaran audio. Ketuk tombol sekali lagi atau izinkan suara.');
  }
  audio.onended = () => { if (active && active.id === id) stopActive(); };
  return { id, stop: () => { if (active && active.id === id) stopActive(); } };
}

/** Short feedback chime for workout / UI events. */
export function chime(kind = 'done') {
  try {
    const audioCtx = context();
    const gain = audioCtx.createGain();
    gain.gain.value = .26;
    gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime + .03;
    if (kind === 'done') {
      [659, 880, 1175].forEach((f, i) => tone(audioCtx, gain, { freq: f, at: t + i * .13, dur: .32, type: 'sine', gain: .22 }));
    } else {
      tone(audioCtx, gain, { freq: 880, at: t, dur: .16, type: 'triangle', gain: .2 });
    }
    setTimeout(() => { try { gain.disconnect(); } catch {} }, 1400);
  } catch {}
}

export function soundLabel(soundId, customSounds = []) {
  if (String(soundId).startsWith('builtin:')) {
    return BUILTIN_SOUNDS.find(s => s.id === soundId)?.name || 'Rise';
  }
  const id = String(soundId).replace(/^custom:/, '');
  return customSounds.find(s => s.id === id)?.name || 'Suara kustom';
}
