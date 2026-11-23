# EZRoutine

**Personal Daily Planner, Workout Scheduler & Smart Alarm (PWA)**

EZRoutine adalah aplikasi perencana harian, jadwal olahraga, dan alarm pengingat yang berjalan **100% di sisi client**. Tidak ada akun, tidak ada backend, tidak ada database online, dan tidak ada data yang dikirim ke server.

- Mobile-first, terasa seperti aplikasi Android modern (Material Design 3 inspired)
- Dark mode sebagai tema awal + light mode + warna aksen yang bisa diganti
- Offline-first, bisa di-install sebagai PWA
- Semua data disimpan di perangkat: **IndexedDB** (jadwal, alarm, riwayat, audio) dan **LocalStorage** (pengaturan)
- Alarm dengan suara bawaan (Web Audio API) dan suara kustom hasil upload
- Bisa di-hosting gratis di GitHub Pages

---

## 1. Struktur Project

```
EZRoutine/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── .nojekyll
│
├── assets/
│   ├── icons/               # ikon PWA 192, 512, maskable, apple-touch, favicon
│   ├── images/
│   └── sounds/              # suara bawaan dibuat via Web Audio API (tanpa file biner)
│
├── css/
│   ├── themes.css           # design tokens, dark/light theme
│   ├── style.css            # shell, navigasi, layout dasar
│   ├── components.css       # kartu, tombol, form, modal, alarm, timer, grafik
│   └── responsive.css       # breakpoint HP / tablet / desktop
│
├── js/
│   ├── app.js               # bootstrap, PWA install/update, scheduler global
│   ├── router.js            # hash router
│   ├── home.js              # dashboard
│   ├── schedule.js          # CRUD jadwal, kalender, template, pengingat
│   ├── workout.js           # rencana, library, sesi timer, riwayat
│   ├── alarm.js             # CRUD alarm, suara kustom, ringing screen, snooze
│   ├── statistics.js        # statistik lokal & grafik
│   ├── settings.js          # pengaturan, export/import/reset
│   ├── database.js          # wrapper IndexedDB + export/import JSON
│   ├── storage.js           # LocalStorage settings
│   ├── audio.js             # Web Audio API + custom audio playback
│   ├── notifications.js     # Notification API helper
│   ├── constants.js         # kategori, library latihan, konstanta
│   ├── events.js            # event bus kecil
│   ├── ui.js                # ikon, modal, toast, dialog, app bar
│   └── utils.js             # tanggal, waktu, format, helper DOM
│
└── tools/
    ├── make-icons.ps1       # generator ikon PNG (PowerShell)
    ├── serve.js             # static server lokal untuk testing
    ├── test-cdp.js          # smoke test headless (Chrome CDP)
    └── test-cdp-extended.js # test interaksi, offline, export/import
```

---

## 2. Menjalankan Secara Lokal

Karena aplikasi memakai ES modules & Service Worker, bukalah melalui HTTP, bukan `file://`.

```bash
cd EZRoutine
node tools/serve.js 8899
```

Lalu buka `http://127.0.0.1:8899/index.html` di Chrome/Edge/Android Chrome.

> Service Worker hanya aktif di `localhost` atau HTTPS.

---

## 3. Deploy ke GitHub Pages

1. Push folder `EZRoutine` ke repository GitHub.
2. Buka **Settings → Pages**.
3. Pilih **Source: Deploy from a branch**, branch `main`, folder `/root` (atau `/docs` jika kamu memindahkan isinya ke folder docs).
4. Simpan. GitHub Pages otomatis memakai HTTPS.
5. Buka `https://<username>.github.io/<nama-repo>/`.

Catatan deployment:

- Seluruh path di aplikasi menggunakan **relative path** (`./`), sehingga aman untuk URL dengan subfolder seperti `https://user.github.io/ezroutine/`.
- Router memakai **hash** (`#/home`, `#/alarm`, ...), sehingga tidak memerlukan server rewrite.
- File `.nojekyll` disertakan agar GitHub Pages tidak memproses folder dengan aturan Jekyll.
- Tidak ada CDN, API key, atau dependency eksternal untuk fitur inti.

---

## 4. Memasang Aplikasi (PWA)

### Android (Chrome)
1. Buka EZRoutine via HTTPS.
2. Ketuk menu ⋮ → **Install app** / **Add to Home screen**, atau gunakan banner *Install EZRoutine* yang muncul.
3. Buka ikon EZRoutine di layar utama.

### iPhone / iPad (Safari)
1. Buka EZRoutine di Safari.
2. Ketuk tombol **Share** → **Add to Home Screen**.

Aplikasi akan tetap bisa dibuka offline setelah aset awal berhasil di-cache Service Worker.

---

## 5. Fitur Utama

### Beranda
- Sapaan sesuai waktu, tanggal, dan jam digital real-time
- Ringkasan aktivitas hari ini (selesai / belum / total) + progress circular
- Kartu jadwal berikutnya dan alarm berikutnya
- Quick action: tambah aktivitas & buat alarm
- Timeline “Today’s Overview” lengkap dengan selesai/edit/hapus

### Jadwal
- CRUD aktivitas: nama, tanggal, jam mulai/selesai, deskripsi, kategori, warna, pengingat
- Pengulangan: sekali, setiap hari, hari tertentu per minggu
- Tampilan Harian, Mingguan, dan Kalender bulanan
- Template aktivitas agar jadwal berulang cepat dibuat
- Hapus pengulangan: hanya satu tanggal atau seluruh seri
- Notifikasi pengingat saat aplikasi terbuka/aktif

### Olahraga
- Workout Plan: hari, jam, durasi, latihan, catatan, aktif/nonaktif
- Workout Library: Walking, Jogging, Jumping Jacks, Squats, Push Up, Plank, Stretching, Rest Day
- Workout Session: countdown timer & stopwatch, start/pause/resume/reset/next, bunyi saat selesai, wake lock bila didukung
- Workout History: tanggal, jenis, durasi, status, statistik mingguan & bulanan
- Tidak ada target kalori/olahraga yang dipaksakan; target pengguna bisa diatur di Pengaturan

### Alarm
- CRUD alarm: nama, jam, pengulangan (sekali/harian/mingguan/tanggal), suara, volume, snooze
- Suara bawaan dibuat dengan Web Audio API (Rise, Bell, Pulse, Sunrise, Digital)
- Upload suara kustom MP3/WAV/OGG (maks 8 MB) — disimpan di IndexedDB
- Preview, play, stop, pilih, dan hapus suara kustom
- Volume per alarm + volume default global + mute
- Layar ringing besar dengan animasi, Stop dan Snooze (5–30 menit)
- Pemeriksaan alarm terlewat saat aplikasi dibuka kembali
- Notifikasi via Notification API ketika diizinkan

### Statistik
- Total selesai, tertunda, sesi olahraga, durasi olahraga, persentase konsistensi
- Grafik aktivitas mingguan & bulanan
- Grafik durasi olahraga mingguan & bulanan
- Semua dihitung dari data lokal

### Pengaturan & Data
- Nama, bahasa, format waktu 12/24 jam, tema, warna aksen
- Volume/suara/snooze/notifikasi default, target olahraga, durasi default
- Export seluruh data ke JSON
- Import JSON dengan mode **Ganti** atau **Gabungkan** + konfirmasi
- Reset aplikasi dengan konfirmasi
- Tentang aplikasi & versi

---

## 6. Batasan Alarm PWA (Penting)

EZRoutine sengaja tidak mengklaim alarm web setara alarm native Android.

Kenyataan browser:

1. Alarm **paling andal saat aplikasi terbuka dan aktif**.
2. Notifikasi dikirim bila izin Notification diberikan, tetapi browser/OS bisa menundanya.
3. Service Worker dipakai untuk caching & PWA, **bukan** untuk memutar audio background.
4. Tidak ada janji pemutaran audio otomatis dari Service Worker.
5. Tidak bergantung pada Background Sync / Periodic Background Sync sebagai alarm tepat waktu.
6. Saat aplikasi dibuka kembali, EZRoutine memeriksa alarm yang terlewat dan menampilkannya.
7. Jika browser memblokir autoplay audio, ketuk layar/tombol untuk mengizinkan pemutaran.

Informasi ini juga ditampilkan langsung di halaman Alarm.

---

## 7. Privasi & Penyimpanan

| Jenis data | Lokasi |
|---|---|
| Pengaturan (tema, nama, volume default, dll.) | LocalStorage (`ezroutine.settings.v1`) |
| Jadwal, template, alarm, rencana/riwayat olahraga | IndexedDB (`ezroutine-db`) |
| File audio kustom | IndexedDB (`audio` store, sebagai Blob) |
| Status alarm/pengingat terakhir | LocalStorage (kecil, dibatasi jumlahnya) |

Tidak ada data yang dikirim keluar dari perangkat. Export JSON adalah satu-satunya cara memindahkan data antar perangkat.

---

## 8. Pengujian

Smoke test memakai Chrome headless + Chrome DevTools Protocol (tanpa npm dependency).

```bash
# pastikan server jalan: node tools/serve.js 8899
node tools/test-cdp.js             # 15 pemeriksaan dasar
node tools/test-cdp-extended.js    # 21 pemeriksaan: workout, alarm, recurring, export/import, offline
```

Test mencakup:
- Render semua route & navigasi
- CRUD aktivitas & tersimpan di IndexedDB
- Buat rencana olahraga, sesi timer, mode stopwatch, next exercise
- Buat & toggle alarm
- Aktivitas berulang lintas tanggal
- Export/import JSON
- Ganti tema
- Offline reload dengan Service Worker
- Tidak ada error JavaScript

---

## 9. Kompatibilitas

- Android Chrome / Edge: PWA installable, offline, notifikasi
- Desktop Chrome / Edge: PWA installable, offline
- Safari iOS: offline & Add to Home Screen; notifikasi/web audio bergantung versi iOS
- Browser tanpa Notification API: fitur notifikasi disembunyikan/ dinonaktifkan dengan aman
- Browser tanpa IndexedDB: aplikasi tetap terbuka dengan peringatan, tetapi fitur penyimpanan tidak berfungsi

---

## 10. Lisensi & Developer

Dibuat sebagai aplikasi personal productivity open-source. Silakan dimodifikasi untuk kebutuhan sendiri.

**EZRoutine v1.0.0** — EZRoutine Team.
