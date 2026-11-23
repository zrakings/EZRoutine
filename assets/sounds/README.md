# Suara Bawaan

EZRoutine tidak menyimpan file audio biner untuk suara bawaan. Suara bawaan
(Rise, Bell, Pulse, Sunrise, Digital) dihasilkan secara dinamis memakai
**Web Audio API** di `js/audio.js`.

Keuntungan:

- Tidak ada file besar yang perlu diunduh
- Tidak ada ketergantungan CDN
- Berfungsi offline setelah aplikasi ter-cache
- Volume bisa diatur per alarm

Suara kustom pengguna tetap disimpan sebagai Blob di IndexedDB (`audio` store),
bukan di folder ini.
