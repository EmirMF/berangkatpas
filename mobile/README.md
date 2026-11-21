# Mobile BerangkatPas

Folder ini disiapkan untuk aplikasi mobile (frontend). Kode aplikasi dapat ditambahkan di sini tanpa memindahkan backend yang sudah ada di root repositori.

## Kontrak backend

- Panduan layar, sesi, dan sinkronisasi pengingat: [FRONTEND_HANDOFF.md](../FRONTEND_HANDOFF.md).
- Kontrak lengkap: [openapi.yaml](../openapi.yaml), tersedia juga melalui Swagger UI di `/api/docs` saat backend berjalan.
- Basis URL pengembangan pada laptop: `http://localhost:8080` melalui Docker Compose. Perangkat fisik harus memakai alamat backend yang dapat dijangkau perangkat; `localhost` perangkat bukan laptop.

Endpoint aplikasi pengguna memakai Bearer JWT. `X-API-Key` hanya untuk integrasi kelompok lain dan tidak boleh ditanam di aplikasi mobile. Aplikasi menjadwalkan notifikasi lokal dari `GET /api/v1/reminders/manifest` serta membuka `navigationUrl` saat pengguna memilih navigasi.
