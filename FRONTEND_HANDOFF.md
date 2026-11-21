# Kontrak frontend BerangkatPas

Backend berjalan di `https://berangkatpas.stei.site` setelah deploy STB. Untuk pengembangan laptop, gunakan `http://localhost:8080` pada browser di laptop yang sama. Perangkat fisik tidak dapat memakai alamat `localhost` laptop; gunakan URL HTTPS STB ketika tersedia. Daftar endpoint interaktif: `/api/docs`.

## Sesi dan header

1. Register atau login dengan `POST /api/v1/auth/register` atau `/api/v1/auth/login`, body `{"email":"...","password":"..."}`.
2. Simpan `token` (access JWT, 15 menit) dan `refreshToken` (30 hari) di penyimpanan aman perangkat. Semua endpoint pengguna memakai `Authorization: Bearer <token>`.
3. Saat API mengembalikan `401`, panggil `POST /api/v1/auth/refresh` dengan `{"refreshToken":"..."}` tepat sekali, simpan kedua token baru, lalu ulangi request awal satu kali. Jika refresh mendapat `401`, hapus token dan tampilkan layar login. Hindari dua refresh serentak dengan satu promise bersama.
4. Saat logout, panggil `POST /api/v1/auth/logout` dengan refresh token dan hapus kedua token lokal. Access JWT lama tetap berlaku sampai maksimal 15 menit, sehingga aplikasi harus langsung menghapusnya. `GET /api/v1/auth/me` memulihkan identitas pengguna saat aplikasi dibuka.

## Layar aplikasi

| Layar | API | Perilaku frontend |
| --- | --- | --- |
| Masuk/daftar | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/refresh` | Simpan token secara aman dan tangani 401. |
| Daftar jadwal | `GET /api/v1/schedules` dan `GET /api/v1/reminders/manifest` | Tampilkan `title`, nama tujuan, waktu tiba, dan keberangkatan terdekat. |
| Form jadwal | `GET /api/v1/places/search`, `GET /api/v1/places/reverse`, `POST/PUT /api/v1/schedules` | Cari tempat hanya saat pengguna menekan Cari; simpan `label`, `lat`, `lng`. Pilih `date` atau `weekdays`, tidak keduanya. Isi `preparationMinutes` 0–120. |
| Detail keberangkatan | `GET /api/v1/schedules/:id/recommendation?date=YYYY-MM-DD`, `GET /api/v1/schedules/:id/mode-comparison?date=YYYY-MM-DD` | Tampilkan `departAt`, `prepareAt`, `reasons`, `calibration`, dan opsi moda. Buka `navigationUrl` saat diminta pengguna; tandai `source.*.stale`, cuaca tidak tersedia, dan estimasi motor. |
| Riwayat | `GET /api/v1/history`, `POST /api/v1/recommendations/:id/feedback` | Kirim waktu perangkat sebagai `arrivedAt` saat pengguna menekan Sudah sampai; tampilkan `deltaMinutes` dan perubahan cadangan. |

Semua waktu respons memakai ISO 8601 dengan offset `+07:00`. Hari berulang memakai angka `0=Ahad` hingga `6=Sabtu`. Moda yang diterima: `walk`, `motorcycle`, `car`.

Contoh body jadwal:

```json
{
  "title": "Kuliah pagi",
  "origin": {"label": "Rumah", "lat": -6.9000, "lng": 107.6000},
  "destination": {"label": "Kampus ITB", "lat": -6.8915, "lng": 107.6107},
  "arrivalTime": "08:00",
  "preparationMinutes": 15,
  "weekdays": [1, 2, 3, 4, 5],
  "mode": "motorcycle"
}
```

Untuk sekali jalan, ganti `weekdays` dengan `"date":"2026-11-25"`. Respons error selalu berbentuk `{"error":{"code":"...","message":"..."}}`. Tampilkan pesan yang dapat dipahami saat `503`, lalu beri pilihan coba ulang. Respons pencarian tempat menyertakan atribusi OpenStreetMap yang perlu ditampilkan dalam aplikasi.

## Sinkronisasi notifikasi lokal

Panggil `GET /api/v1/reminders/manifest?days=7` pada saat aplikasi dibuka, kembali aktif, dan setelah jadwal dibuat/diubah/dinonaktifkan. Respons berisi `items` dan `errors`. Setiap item memuat `reminderKey` tetap (`scheduleId:date`), `revision`, dan `recommendation.departAt`.

Simpan pasangan `reminderKey → {revision, deviceNotificationIds}` di perangkat. Untuk setiap item baru, jadwalkan semua `recommendation.reminderEvents` menurut `at`: `prepare` (jika waktu persiapan diisi), `departure_soon` (20 menit sebelum berangkat), dan `depart`. Satu event dapat memuat dua `kinds` ketika waktunya sama; tampilkan satu notifikasi gabungan. Gunakan `reminderKey`, waktu event, dan `revision` sebagai identitas. Jika `revision` berubah, batalkan notifikasi lama dan buat ulang. Batalkan notifikasi lokal yang kuncinya tidak ada lagi dalam manifest untuk rentang tanggal yang diminta. Jangan menjadwalkan waktu yang sudah lewat. Jika ada `errors`, pertahankan notifikasi lama untuk kejadian itu dan tampilkan bahwa jadwal belum berhasil diperbarui; jangan hapus semua pengingat hanya karena satu penyedia data gagal.

Prakiraan cuaca dan rute dapat berubah. Dalam dua jam menjelang keberangkatan, sinkronkan ulang saat aplikasi aktif; backend memeriksa cuaca paling sering tiap 15 menit dan rute tiap satu jam. Backend tidak mengirim push saat aplikasi tertutup. Notifikasi yang sudah terjadwal memakai data terakhir sampai sinkronisasi berikutnya.

## Batas implementasi saat ini

- Pencarian Nominatim dibatasi area Bandung, satu permintaan ke penyedia per detik, dengan cache. Jangan membuat autocomplete per ketikan. Koordinat tetap dapat dipilih melalui GPS/peta di frontend.
- Rute motor memakai profil mobil dan diberi `estimate=car_profile_proxy_for_motorcycle`. Tampilkan sebagai perkiraan.
- Jika `source.weather.unavailable=true`, rekomendasi tetap diberikan tanpa tambahan durasi hujan. Jika rute tidak tersedia dan cache habis, API mengembalikan `503`.
- API kelompok lain belum diintegrasikan; endpoint preview milik BerangkatPas tersedia dengan `X-API-Key` untuk mitra di kemudian hari. Jangan menaruh API key mitra dalam aplikasi mobile.
