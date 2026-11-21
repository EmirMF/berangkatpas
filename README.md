# BerangkatPas backend

Microservice rekomendasi jam berangkat untuk kelompok K02. Backend memakai Express, SQLite, OSRM, Open-Meteo, dan Nominatim. Aplikasi mobile mengatur notifikasi perangkat berdasarkan manifest rekomendasi dari API. Integrasi dengan API dua kelompok lain akan dikerjakan setelah mitra dipilih.

Folder [`mobile/`](mobile/) disiapkan untuk kode aplikasi frontend. Backend saat ini berada di root repositori.

## Arsitektur

`mobile / mitra → Cloudflare Tunnel → Nginx → satu microservice Express → SQLite`. Lima modul bounded context di dalam microservice adalah **Identitas Pengguna**, **Jadwal dan Rutinitas**, **Perhitungan Keberangkatan**, **Riwayat dan Kalibrasi**, serta **Data Eksternal**. Modul berkomunikasi lewat fungsi layanan yang eksplisit dan hanya mengakses tabel miliknya sendiri. Konteks **Pengingat** berada di aplikasi mobile karena notifikasinya dijadwalkan pada perangkat. STB hanya menjalankan container `core`, `gateway`, dan `tunnel`; database berada di volume Docker dan tidak memiliki port publik.

## Menjalankan lokal

Syarat: Node.js 24+, npm. Salin `.env.example` menjadi `.env`, lalu ganti `JWT_SECRET` dengan nilai acak minimal 32 karakter. Jangan commit `.env`.

```sh
npm ci
npm test
npm start
```

Health check: `http://localhost:3000/api/health`. **Swagger UI:** `http://localhost:3000/api/docs`. Berkas kontrak OpenAPI: `http://localhost:3000/api/openapi.yaml`. Untuk Docker lokal, jalankan `docker compose up --build -d`, kemudian akses port gateway `http://localhost:8080/api/health` dan `http://localhost:8080/api/docs`. Setelah container sehat, jalankan `npm run smoke` untuk menguji alur nyata dengan akun uji acak pada gateway lokal.

## Kontrak dan contoh pemakaian

Seluruh endpoint, skema respons, dan autentikasi dijelaskan di [openapi.yaml](openapi.yaml) dan ditampilkan melalui Swagger UI di `/api/docs`. Alur implementasi lima layar aplikasi ada di [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md). Tombol **Authorize** menerima JWT untuk `BearerAuth` atau kunci mitra untuk `PartnerKey`; nilai rahasia tidak diisi otomatis. Respons error berbentuk `{"error":{"code":"...","message":"..."}}`. Semua waktu hasil memakai ISO 8601 dengan offset `+07:00`; hari berulang memakai `0=Ahad` hingga `6=Sabtu`.

1. `POST /api/v1/auth/register` dengan `{"email":"demo@example.com","password":"password123"}` menghasilkan JWT akses 15 menit, refresh token 30 hari, dan `expiresInSeconds`. `POST /api/v1/auth/login` memakai body yang sama. `GET /api/v1/auth/me` membaca akun; `POST /api/v1/auth/refresh` menukar refresh token secara sekali pakai; `POST /api/v1/auth/logout` mencabutnya.
2. Kirim `Authorization: Bearer <token>` ke `POST /api/v1/schedules` dengan body berikut:

```json
{
  "origin": {"lat": -6.9000, "lng": 107.6000},
  "destination": {"lat": -6.8900, "lng": 107.6100},
  "arrivalTime": "08:00",
  "preparationMinutes": 15,
  "date": "2026-11-25",
  "mode": "motorcycle"
}
```

Untuk jadwal berulang, ganti `date` dengan `"weekdays":[1,2,3,4,5]`. Tambahkan `title` serta `label` di dalam `origin`/`destination` agar daftar jadwal terbaca manusia; format koordinat lama tetap diterima. Moda: `walk`, `motorcycle`, `car`. Endpoint `GET /api/v1/schedules`, `GET/PUT/DELETE /api/v1/schedules/:id` membaca, mengganti, atau menonaktifkan jadwal milik akun itu sendiri.

3. `GET /api/v1/schedules/:id/recommendation?date=2026-11-25` menghitung dan menyimpan rekomendasi. Respons menyertakan `id`, `arrivalAt`, `departAt`, `prepareAt`, `reminderEvents`, `reasons`, `calibration`, `navigationUrl`, rincian menit, `estimate`, dan `source`. `preparationMinutes` pada jadwal bernilai awal 0 dan menerima 0–120 menit; waktu bersiap tidak menggeser jam berangkat. `GET /api/v1/schedules/:id/mode-comparison?date=2026-11-25` membandingkan kaki, motor, dan mobil tanpa menyimpan riwayat. Opsi yang gagal memiliki `error` sendiri.
4. `POST /api/v1/recommendations/:id/feedback` dengan `{"arrivedAt":"2026-11-25T08:06:00+07:00"}` mencatat realisasi dan mengubah cadangan pribadi. Satu rekomendasi hanya menerima satu umpan balik. `GET /api/v1/history` menampilkan 100 rekomendasi terakhir beserta umpan baliknya.

`GET /api/v1/places/search?q=...` mencari lokasi di area Bandung dan `GET /api/v1/places/reverse?lat=...&lng=...` memberi label pada koordinat GPS. Keduanya memerlukan JWT, mengembalikan atribusi OpenStreetMap, dan hanya dipanggil setelah tindakan eksplisit pengguna. Jangan memanggil Nominatim setiap ketikan atau untuk autocomplete. Hasil dicache tujuh hari dan permintaan ke penyedia diantre maksimal satu per detik. Base URL penyedia dapat diganti melalui `GEOCODING_BASE_URL` tanpa mengubah aplikasi mobile.

`GET /api/v1/reminders/manifest?days=7` mengembalikan rekomendasi keberangkatan mendatang beserta `reminderKey` stabil dan `revision`. `reminderEvents` memberi waktu mulai bersiap, 20 menit sebelum berangkat, dan saat berangkat; event pada waktu sama digabung. Aplikasi mengambil manifest saat dibuka, kembali aktif, atau jadwal diubah; notifikasi lokal yang kuncinya hilang dibatalkan dan yang revisinya berubah diganti. Dalam dua jam menjelang berangkat, sinkronisasi saat aplikasi aktif dapat memeriksa cuaca tiap 15 menit dan rute tiap satu jam. Kegagalan sebagian jadwal berada dalam `errors`, sehingga jadwal lain tetap diterima. Permintaan berulang dengan hasil sama memakai ID rekomendasi yang sama; riwayat menampilkan satu entri per kejadian.

Untuk mitra, hanya ada **satu endpoint**: `POST /api/v1/recommendations/preview`. Kirim `X-API-Key` dan body berisi `origin`, `destination`, `arrivalTime`, `date`, `mode` seperti contoh di atas; abaikan `preparationMinutes` dan fitur akun. Respons ringkas berisi `arrivalAt`, `departAt`, `totalMinutes`, `routeMinutes`, `weatherMinutes`, `bufferMinutes`, `estimate`, dan `sourceStatus` (`available`, `stale`, atau `unavailable`). Preview tidak menyimpan perjalanan dan memakai cadangan bawaan 10 menit. Respons salah input `400`, kunci salah `401`, dan rute tak tersedia `503`, semuanya memakai `error.code` dan `error.message`. Tiap kelompok memiliki kunci sendiri. Jangan menaruh kunci pada aplikasi mobile.

## Aturan perhitungan dan keterbatasan

`departAt = arrivalAt - (routeMinutes + weatherMinutes + bufferMinutes)`. Perkiraan hujan ≥50% menambah 20% durasi untuk berjalan kaki, 15% untuk motor, dan 10% untuk mobil, dibulatkan ke atas. Persentase dan ambang dapat diubah melalui `.env`. Cadangan awal 10 menit; setelah umpan balik, cadangan berubah 25% dari selisih waktu tiba aktual dan target, maksimal 3 menit per perjalanan, dengan batas 0–30 menit.

OSRM memakai profil kaki untuk berjalan dan profil mobil untuk mobil maupun motor. Estimasi motor ditandai `car_profile_proxy_for_motorcycle`, sehingga tidak dianggap rute motor yang akurat. `navigationUrl` membuka petunjuk arah OpenStreetMap dengan profil yang sesuai. Rute di-cache 24 jam, atau satu jam saat mendekati berangkat; jika penyedia gagal, data terakhir sampai 30 hari dapat dipakai dengan `source.route.stale=true`, atau API membalas `503`. Prakiraan cuaca di-cache 1 jam, atau 15 menit saat mendekati berangkat; saat tidak tersedia, tambahan hujan menjadi 0, `rainProbability=null`, dan `source.weather.unavailable=true`. Klien perlu menampilkan penanda keterbatasan ini.

Server demo OSRM membatasi pemakaian hingga satu permintaan per detik dan tidak menjamin uptime. Adapter ini mengantre permintaan rute berjarak minimal 1,1 detik serta memakai cache. Rute, cuaca, dan pencarian tempat memerlukan koneksi internet dari STB. Tampilkan atribusi OpenStreetMap/OSRM, Nominatim, dan Open-Meteo pada layar informasi aplikasi.

## Pengujian

Pengujian `npm test` mencakup migrasi, sesi login, lokasi, rekomendasi, manifest pengingat, kalibrasi, otorisasi, kegagalan penyedia data, dan alur API lengkap.
