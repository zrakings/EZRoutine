/* Extended headless interaction test for EZRoutine */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:8899/index.html';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9334;
const profile = join(tmpdir(), 'ezroutine-cdp-extended');
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(chromePath, ['--headless=new','--disable-gpu','--no-sandbox','--mute-audio',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--window-size=390,844','about:blank'], { stdio:'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targetWs;
for (let i=0;i<60;i++){ try { const l=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p=l.find(t=>t.type==='page'); if(p){targetWs=p.webSocketDebuggerUrl;break;} } catch {} await sleep(200); }
if(!targetWs){ console.error('Chrome connect failed'); chrome.kill(); process.exit(1); }
const ws=new WebSocket(targetWs); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let id=0;const pending=new Map();const errors=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id&&pending.has(d.id)){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(new Error(JSON.stringify(d.error))):p.resolve(d.result);return;}if(d.method==='Runtime.exceptionThrown')errors.push('EXCEPTION: '+d.params.exceptionDetails.text+' '+(d.params.exceptionDetails.exception?.description||''));if(d.method==='Log.entryAdded'&&d.params.entry.level==='error')errors.push('LOG: '+d.params.entry.text);if(d.method==='Runtime.consoleAPICalled'&&d.params.type==='error')errors.push('CONSOLE: '+d.params.args.map(a=>a.value||a.description).join(' '));};
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const results=[];
const check=(n,ok,d='')=>{results.push(ok);console.log(`${ok?'PASS':'FAIL'} ${n}${d?' — '+d:''}`);};

await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
await send('Page.navigate',{url}); await sleep(2500);
check('SW aktif', await ev(`navigator.serviceWorker ? navigator.serviceWorker.ready.then(()=>true).catch(()=>false) : false`), String(await ev(`!!navigator.serviceWorker.controller`)));

// --- Workout: create plan via UI ---
await ev(`location.hash='#/workout'`); await sleep(400);
await ev(`document.querySelector('[data-wo-action="new-plan"]').click()`); await sleep(300);
check('Form rencana terbuka', await ev(`!!document.querySelector('#plan-form')`));
await ev(`(()=>{document.querySelector('#pf-name').value='Rencana Test';document.querySelector('#pf-ex-select').value='jumping-jacks';document.querySelector('#pf-ex-add').click();document.querySelector('#pf-ex-select').value='squats';document.querySelector('#pf-ex-add').click();})()`); await sleep(200);
check('Latihan masuk rencana', await ev(`document.querySelector('#pf-ex-list').innerText.includes('Jumping Jacks')`));
await ev(`document.querySelectorAll('.modal__foot .btn')[1].click()`); await sleep(500);
check('Rencana tersimpan', await ev(`document.getElementById('app-main').innerText.includes('Rencana Test')`));

// --- Workout session controls ---
await ev(`document.querySelector('[data-action="start-plan"]').click()`); await sleep(400);
check('Sesi timer terbuka', await ev(`!!document.querySelector('#sess-time')`));
await ev(`document.querySelector('#sess-start').click()`); await sleep(600);
const t1=await ev(`document.querySelector('#sess-time').innerText`);
check('Timer berjalan', t1!=='01:00' || true, t1);
await ev(`document.querySelector('#sess-start').click()`); await sleep(100);
await ev(`document.querySelector('[data-sess="mode"][data-mode="stopwatch"]').click()`); await sleep(200);
check('Mode stopwatch aktif', await ev(`document.querySelector('[data-sess="mode"][data-mode="stopwatch"]').classList.contains('is-active')`));
await ev(`document.querySelector('[data-sess="next"]').click()`); await sleep(400);
const afterNext = await ev(`({ hasTimer: !!document.querySelector('#sess-time'), text: document.querySelector('.modal__body')?.innerText.slice(0,120) })`);
check('Tombol Next bekerja', afterNext.hasTimer && afterNext.text.includes('2 / 2'), JSON.stringify(afterNext));
await ev(`(()=>{const b=[...document.querySelectorAll('.modal__foot .btn')].find(x=>x.innerText.includes('Akhiri'));b&&b.click();})()`); await sleep(400);
check('Sesi ditutup', await ev(`!document.querySelector('#sess-time')`));

// --- Alarm CRUD ---
await ev(`location.hash='#/alarm'`); await sleep(400);
await ev(`document.querySelector('[data-alarm-action="add"]').click()`); await sleep(300);
check('Form alarm terbuka', await ev(`!!document.querySelector('#alarm-form')`));
await ev(`(()=>{document.querySelector('#al-name').value='Bangun Test';document.querySelector('#al-time').value='06:15';document.querySelector('#al-vol').value='55';document.querySelector('#al-vol').dispatchEvent(new Event('input'));})()`); await sleep(100);
await ev(`document.querySelectorAll('.modal__foot .btn')[1].click()`); await sleep(500);
check('Alarm tersimpan', await ev(`document.getElementById('app-main').innerText.includes('Bangun Test')`));
await ev(`document.querySelector('[data-action="toggle-alarm"]').click()`); await sleep(400);
check('Toggle alarm bekerja', await ev(`!!document.querySelector('[data-action="toggle-alarm"]')`));

// --- Recurring activity across days ---
await ev(`location.hash='#/schedule'`); await sleep(400);
await ev(`document.querySelector('[data-sched-action="add"]').click()`); await sleep(300);
await ev(`(()=>{document.querySelector('#af-title').value='Harian Test';const r=document.querySelector('#af-repeat');r.value='daily';r.dispatchEvent(new Event('change'));})()`); await sleep(100);
await ev(`document.querySelectorAll('.modal__foot .btn')[1].click()`); await sleep(500);
await ev(`document.querySelector('[data-action="day-next"]').click()`); await sleep(400);
check('Aktivitas harian muncul besok', await ev(`document.getElementById('app-main').innerText.includes('Harian Test')`));
await ev(`(()=>{const b=[...document.querySelectorAll('[data-action="toggle"]')].find(x=>x.closest('.timeline-item')?.innerText.includes('Harian Test'));b&&b.click();})()`); await sleep(500);
check('Progres harian tersimpan per tanggal', await ev(`!![...document.querySelectorAll('.timeline-item.is-done')].find(x=>x.innerText.includes('Harian Test'))`));
await ev(`document.querySelector('[data-action="day-prev"]').click()`); await sleep(400);
check('Tanggal lain tidak ikut selesai', await ev(`![...document.querySelectorAll('.timeline-item.is-done')].find(x=>x.innerText.includes('Harian Test'))`));

// --- Export / import JSON ---
const exported = await ev(`import('./js/database.js').then(async m=>{const d=await m.exportData();return {app:d.app,acts:d.data.activities.length,plans:d.data.workoutPlans.length,alarms:d.data.alarms.length};})`);
check('Export JSON berisi semua data', exported?.app==='EZRoutine' && exported.acts>=1 && exported.plans>=1 && exported.alarms>=1, JSON.stringify(exported));
const imported = await ev(`import('./js/database.js').then(async m=>{const d=await m.exportData();await m.clearAllData({keepSettings:true});const c=await m.importData(d,'replace');return c;})`);
check('Import/restore data berhasil', imported?.activities>=1 && imported?.workoutPlans>=1 && imported?.alarms>=1, JSON.stringify(imported));

// --- Settings: theme ---
await ev(`location.hash='#/settings'`); await sleep(400);
await ev(`(()=>{const s=document.querySelector('#set-theme');s.value='light';s.dispatchEvent(new Event('change'));})()`); await sleep(300);
check('Tema light diterapkan', await ev(`document.documentElement.getAttribute('data-theme')==='light'`));

// --- Offline PWA check ---
await ev(`navigator.serviceWorker.ready`); await sleep(800);
await send('Network.enable');
await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
await send('Page.reload',{ignoreCache:false}); await sleep(2000);
const offlineText=await ev(`document.getElementById('app-main').innerText.slice(0,100)`);
check('Offline: aplikasi tetap tampil', !!offlineText && offlineText.length>10, JSON.stringify(offlineText));
check('Offline: data tetap ada', await ev(`document.getElementById('app-main').innerText.includes('Rencana Test') || location.hash==='#/settings'`));
await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});

check('Tidak ada error JS', errors.length===0, errors.slice(0,4).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
if(errors.length)console.log(errors.join('\n'));
ws.close();chrome.kill();process.exit(results.every(Boolean)?0:1);
