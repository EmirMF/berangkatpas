# BerangkatPas Backend

BerangkatPas menghitung kapan pengguna perlu berangkat agar tiba sesuai jadwal. Backend menerima jadwal sekali jalan atau berulang, mengambil estimasi rute dan prakiraan hujan, lalu menambahkan cadangan waktu pribadi yang dikalibrasi dari waktu tiba aktual. Aplikasi mobile memakai hasilnya untuk menampilkan rekomendasi dan menjadwalkan notifikasi lokal.

**Status:** microservice dan pengujian lokal sudah berjalan. URL publik `https://berangkatpas.stei.site` adalah target deployment; ketersediaannya di STB belum dinyatakan terverifikasi. Integrasi dengan API dua kelompok lain masih menunggu kesepakatan endpoint. Kode frontend akan berada di [`mobile/`](mobile/).

## Arsitektur

`Aplikasi mobile / mitra → Cloudflare Tunnel → Nginx gateway → satu microservice Express → SQLite`

Satu microservice inti memiliki lima modul bounded context sesuai makalah kelompok:

- **Identitas Pengguna:** akun, JWT, refresh token, dan API key mitra.
- **Jadwal dan Rutinitas:** jadwal, lokasi, moda, dan waktu persiapan.
- **Perhitungan Keberangkatan:** rekomendasi, perbandingan moda, dan manifest pengingat.
- **Riwayat dan Kalibrasi:** waktu tiba aktual dan cadangan pribadi.
- **Data Eksternal:** adapter OSRM, Open-Meteo, dan Nominatim dengan timeout serta cache.

Konteks **Pengingat** berada di aplikasi mobile; backend hanya mengirim waktu event dan revisinya. SQLite berada pada volume Docker. Gateway Nginx menerapkan batas 5 request/detik per alamat sumber. Konfigurasi Compose membatasi CPU dan memori setiap container. Stack utama: Node.js 24, Express 5, SQLite, Swagger UI/OpenAPI, Docker Compose, Nginx, dan Cloudflare Tunnel.

## Menjalankan dan membaca kontrak secara lokal

Syarat: Node.js 24+ dan npm. Salin `.env.example` menjadi `.env`, lalu isi `JWT_SECRET` unik minimal 32 karakter. Jangan commit `.env`.

```sh
npm ci
npm test
npm start
```

Dengan proses Node lokal, base URL adalah `http://localhost:3000`. Dengan Docker Compose, jalankan `docker compose up --build -d` dan gunakan `http://localhost:8080`. Health check ada di `/api/health`, Swagger UI di `/api/docs`, dan kontrak mentah di `/api/openapi.yaml` atau [`openapi.yaml`](openapi.yaml). Alur frontend dijelaskan di [`FRONTEND_HANDOFF.md`](FRONTEND_HANDOFF.md).

## Daftar endpoint

Semua path di bawah relatif terhadap base URL. Endpoint pengguna memakai header `Authorization: Bearer <access-token>`, kecuali register, login, refresh, dan logout.

**Umum dan sesi pengguna**

- `GET /api/health` — status layanan dan database; tanpa autentikasi.
- `GET /api/docs` dan `GET /api/openapi.yaml` — dokumentasi Swagger dan kontrak OpenAPI; tanpa autentikasi.
- `POST /api/v1/auth/register` — membuat akun dan menerima access serta refresh token.
- `POST /api/v1/auth/login` — masuk dan menerima token.
- `GET /api/v1/auth/me` — membaca identitas akun dari JWT.
- `POST /api/v1/auth/refresh` — menukar refresh token sekali pakai dengan pasangan token baru.
- `POST /api/v1/auth/logout` — mencabut refresh token.

**Lokasi, jadwal, dan rekomendasi pengguna**

- `GET /api/v1/places/search?q=...` — mencari tempat setelah pengguna mengirim pencarian.
- `GET /api/v1/places/reverse?lat=...&lng=...` — nama lokasi dari koordinat terpilih.
- `GET /api/v1/schedules` dan `POST /api/v1/schedules` — daftar dan buat jadwal.
- `GET /api/v1/schedules/:id`, `PUT /api/v1/schedules/:id`, `DELETE /api/v1/schedules/:id` — baca, ganti, atau nonaktifkan jadwal sendiri.
- `GET /api/v1/schedules/:id/recommendation?date=YYYY-MM-DD` — hitung dan simpan rekomendasi untuk satu kejadian.
- `GET /api/v1/schedules/:id/mode-comparison?date=YYYY-MM-DD` — bandingkan jalan kaki, motor, dan mobil tanpa menyimpan riwayat.
- `GET /api/v1/reminders/manifest?days=7` — kejadian aktif, event notifikasi lokal, `reminderKey`, dan `revision`.
- `POST /api/v1/recommendations/:id/feedback` — simpan waktu tiba aktual dan perbarui cadangan pribadi.
- `GET /api/v1/history` — riwayat rekomendasi terbaru per kejadian beserta umpan balik.

**API untuk kelompok lain**

- `POST /api/v1/recommendations/preview` — satu endpoint perkiraan jam berangkat tanpa akun atau penyimpanan riwayat; memakai header `X-API-Key` per kelompok.

## Cara mendapat akses

Pengguna aplikasi dapat mendaftar lewat `POST /api/v1/auth/register`, lalu mengirim `token` sebagai Bearer JWT. Access token berlaku **15 menit**. Simpan `refreshToken` secara aman di perangkat; token ini berlaku **30 hari**, dirotasi ketika dipakai, dan dicabut saat logout. Semua endpoint jadwal, rekomendasi, lokasi, serta riwayat dibatasi ke akun pemiliknya.

Kelompok mitra meminta **API key dan akun uji** kepada pengelola BerangkatPas melalui kanal koordinasi kelas atau issue repositori. Kunci diterbitkan satu per kelompok dan disampaikan lewat kanal privat, bukan dicantumkan di README atau aplikasi mobile. Di Swagger, tombol **Authorize** menerima Bearer JWT untuk endpoint pengguna dan `X-API-Key` untuk preview mitra. Akun uji bersama belum dipublikasikan.

## Contoh request

Contoh di bawah memakai base URL Docker lokal `http://localhost:8080`. Ganti dengan URL HTTPS setelah deployment publik tersedia. Nilai token dan API key hanya placeholder.

**1. Daftar atau login**

```http
POST /api/v1/auth/register HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{"email":"demo@example.com","password":"password123"}
```

Respons `201` memuat `user`, `token`, `refreshToken`, dan `expiresInSeconds: 900`. Login memakai body yang sama di `/api/v1/auth/login`. Untuk memperbarui sesi, kirim `{"refreshToken":"<refresh-token>"}` ke `/api/v1/auth/refresh` dan simpan kedua token baru.

**2. Buat jadwal sekali jalan**

```http
POST /api/v1/schedules HTTP/1.1
Host: localhost:8080
Authorization: Bearer <access-token>
Content-Type: application/json

{"title":"Kuliah pagi","origin":{"label":"Rumah","lat":-6.9,"lng":107.6},"destination":{"label":"Kampus ITB","lat":-6.8915,"lng":107.6107},"arrivalTime":"08:00","date":"2026-11-25","mode":"motorcycle","preparationMinutes":15}
```

Respons `201` memuat `id` jadwal. Untuk jadwal berulang, ganti `date` dengan `"weekdays":[1,2,3,4,5]` (`0` = Minggu). `preparationMinutes` opsional, bernilai awal 0, dan menerima 0–120 menit.

**3. Ambil rekomendasi**

```http
GET /api/v1/schedules/<schedule-id>/recommendation?date=2026-11-25 HTTP/1.1
Host: localhost:8080
Authorization: Bearer <access-token>
```

Respons `200` memuat `arrivalAt`, `departAt`, `prepareAt`, rincian `routeMinutes`, `weatherMinutes`, `bufferMinutes`, `reasons`, `calibration`, `reminderEvents`, `navigationUrl`, dan `source`. Semua waktu memakai ISO 8601 dengan offset `+07:00`. Jika perlu mencatat kedatangan, kirim `{"arrivedAt":"2026-11-25T08:06:00+07:00"}` ke `POST /api/v1/recommendations/<recommendation-id>/feedback`.

**4. Preview sederhana untuk mitra**

```http
POST /api/v1/recommendations/preview HTTP/1.1
Host: localhost:8080
X-API-Key: <api-key-kelompok>
Content-Type: application/json

{"origin":{"lat":-6.9,"lng":107.6},"destination":{"lat":-6.8915,"lng":107.6107},"arrivalTime":"08:00","date":"2026-11-25","mode":"car"}
```

Respons `200` hanya berisi `arrivalAt`, `departAt`, `totalMinutes`, rincian menit rute/cuaca/cadangan, `estimate`, dan `sourceStatus`. Preview memakai cadangan bawaan 10 menit dan tidak membuat jadwal atau riwayat. Kesalahan selalu berbentuk `{"error":{"code":"...","message":"..."}}`; input salah menghasilkan `400`, autentikasi salah `401`, dan rute tidak tersedia `503`.

## Aturan dan batasan

`departAt = arrivalAt - (routeMinutes + weatherMinutes + bufferMinutes)`. Peluang hujan minimal 50% menambah 20% durasi berjalan kaki, 15% motor, atau 10% mobil, dibulatkan ke atas. Cadangan awal 10 menit; sesudah umpan balik, cadangan berubah sebesar 25% selisih waktu tiba aktual terhadap target, dibatasi 3 menit per perjalanan dan total 0–30 menit.

Motor menggunakan profil rute mobil sebagai **perkiraan** (`estimate=car_profile_proxy_for_motorcycle`). OSRM tidak menyediakan lalu lintas langsung. Bila rute gagal, cache terakhir dapat dipakai dengan penanda `stale`, atau API mengembalikan `503`. Jika prakiraan cuaca tidak tersedia, tambahan hujan bernilai 0 dan `source.weather.unavailable=true`. Dalam dua jam menjelang berangkat, sinkronisasi aktif memeriksa cuaca paling sering tiap 15 menit dan rute tiap satu jam. Backend tidak mengirim push saat aplikasi tertutup; aplikasi mobile menjadwalkan notifikasi dari manifest dan menggantinya ketika `revision` berubah.

Pencarian Nominatim dibatasi area percontohan Bandung dan dilakukan setelah tindakan pengguna, bukan autocomplete per ketikan. Tampilkan atribusi OpenStreetMap, OSRM, Nominatim, dan Open-Meteo di aplikasi.

## Pengujian

`npm test` menjalankan tes domain, migrasi, autentikasi, kepemilikan data, penyedia eksternal, manifest, API mitra, dan kontrak OpenAPI. Pada pemeriksaan lokal terakhir, **18 tes lulus**; `docker compose config --quiet` juga valid. Deployment STB, URL publik, akun uji, dan integrasi dua API kelompok lain masih perlu diverifikasi saat tersedia.
