/* Headless smoke test using Chrome DevTools Protocol (no npm deps).
   Usage: node tools/test-cdp.js [url] */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:8899/index.html';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const profile = join(tmpdir(), 'ezroutine-cdp-profile');
rmSync(profile, { recursive: true, force: true });

const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=390,844', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let targetWs;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    const list = await res.json();
    const page = list.find(t => t.type === 'page');
    if (page) { targetWs = page.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(200);
}
if (!targetWs) { console.error('Gagal terhubung ke Chrome'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(targetWs);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let msgId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(JSON.stringify(data.error)));
    else resolve(data.result);
    return;
  }
  if (data.method === 'Runtime.exceptionThrown') {
    const d = data.params.exceptionDetails;
    errors.push(`EXCEPTION: ${d.text} ${d.exception?.description || ''}`);
  }
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') {
    errors.push(`LOG: ${data.params.entry.text}`);
  }
  if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
    errors.push(`CONSOLE: ${data.params.args.map(a => a.value || a.description).join(' ')}`);
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(2500);

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const shellVisible = await evaluate(`!document.getElementById('app-shell').hidden`);
check('App shell tampil', shellVisible);
const splashHidden = await evaluate(`(() => { const s=document.getElementById('splash'); return !s || s.classList.contains('is-hidden'); })()`);
check('Splash hilang', splashHidden);
const homeText = await evaluate(`document.getElementById('app-main').innerText.slice(0,200)`);
check('Home ter-render', /EZRoutine|Today|Beranda|Selamat|Pengguna/i.test(homeText || ''), JSON.stringify(homeText));
const hasClock = await evaluate(`!!document.getElementById('home-clock')`);
check('Jam real-time ada', hasClock);
const navCount = await evaluate(`document.querySelectorAll('.nav-item[data-route]').length`);
check('Bottom nav 5 item', navCount === 5, String(navCount));

for (const route of ['schedule', 'workout', 'alarm', 'stats', 'settings', 'home']) {
  await evaluate(`location.hash = '#/${route}'`);
  await sleep(500);
  const text = await evaluate(`document.getElementById('app-main').innerText.slice(0,120)`);
  const active = await evaluate(`document.querySelector('.nav-item.is-active')?.dataset.route || ''`);
  check(`Route ${route}`, !!text && text.length > 5 && (route === 'settings' || route === 'home' || active === route), JSON.stringify(text));
}

// Basic interaction: open activity editor
await evaluate(`location.hash = '#/schedule'`);
await sleep(400);
await evaluate(`document.querySelector('[data-sched-action="add"]')?.click()`);
await sleep(300);
const modalOpen = await evaluate(`!!document.querySelector('.modal__panel #activity-form')`);
check('Form aktivitas terbuka', modalOpen);
await evaluate(`(() => { const f=document.querySelector('#activity-form'); if(!f) return; f.querySelector('#af-title').value='Tes CDP'; f.querySelector('#af-start').value='09:00'; f.querySelector('#af-end').value='10:00'; })()`);
await evaluate(`document.querySelectorAll('.modal__foot .btn')[1]?.click()`);
await sleep(500);
const saved = await evaluate(`document.getElementById('app-main').innerText.includes('Tes CDP')`);
check('Aktivitas tersimpan & tampil', saved);

const dbCount = await evaluate(`new Promise(res => { const r=indexedDB.open('ezroutine-db'); r.onsuccess=()=>{ const t=r.result.transaction('activities','readonly'); const g=t.objectStore('activities').getAll(); g.onsuccess=()=>res(g.result.length); }; r.onerror=()=>res(-1); })`);
check('IndexedDB menyimpan data', dbCount >= 1, String(dbCount));

check('Tidak ada error JS', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} checks passed`);
if (errors.length) console.log(errors.join('\n'));

ws.close();
chrome.kill();
process.exit(checks.every(c => c.ok) ? 0 : 1);
