# EduSpace

Learning Management System (LMS) berbasis web untuk mengelola kelas, materi,
kuis, tugas, progres, dan aktivitas pra-kelas. Aplikasi dibuat dengan Next.js
dan Supabase, dengan antarmuka berbahasa Indonesia untuk siswa, guru, dan
administrator.

> **Status:** proyek aktif dalam pengembangan. Fitur yang tersedia dapat berubah
> mengikuti migration database dan implementasi terbaru.

## Daftar isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Arsitektur singkat](#arsitektur-singkat)
- [Persyaratan](#persyaratan)
- [Menjalankan secara lokal](#menjalankan-secara-lokal)
- [Menyiapkan Supabase](#menyiapkan-supabase)
- [Alur penggunaan](#alur-penggunaan)
- [Perintah pengembangan](#perintah-pengembangan)
- [Struktur direktori](#struktur-direktori)
- [Catatan keamanan](#catatan-keamanan)
- [Pemecahan masalah](#pemecahan-masalah)
- [Lisensi](#lisensi)

## Fitur

### Siswa

- Mendaftar menggunakan nama, NIS, kata sandi, dan kode kelas.
- Melihat materi kelas yang disusun dalam modul dan mengikuti progres belajar.
- Membaca materi rich text, menonton video YouTube/Google Drive, memutar audio
  beserta transkrip, dan membuka simulasi eksternal yang di-embed.
- Menandai materi selesai. Akses materi dapat dikunci secara berurutan sesuai
  penyelesaian materi sebelumnya.
- Mengerjakan kuis bab dan kuis penilaian, melihat nilai, umpan balik, serta
  pembahasan sesuai pengaturan guru.
- Melihat dan mengumpulkan tugas sesuai jenis pengumpulan dan tenggat.
- Mengatur preferensi profil seperti nama pengguna, avatar, tema, dan audio.
- Mengikuti aktivitas pra-kelas dan pre-test; melihat progres, poin, lencana,
  dan papan peringkat kelas.

### Guru

- Melihat kelas dan mata pelajaran yang ditugaskan administrator.
- Mengelola modul, materi, audio, simulasi embed, kuis, soal, dan kunci jawaban
  pada kelas yang diajar.
- Menjadwalkan kuis dan mengatur batas percobaan, nilai kelulusan, serta
  pengaturan umpan balik.
- Menandai materi sebagai materi pra-kelas dan kuis sebagai pre-test.
- Membuat tugas, memeriksa pengumpulan, memberi nilai dan umpan balik.
- Melihat progres materi dan nilai siswa melalui gradebook serta mengekspor
  rekap nilai ke CSV.

### Administrator

- Melihat ringkasan kelas, mata pelajaran, guru, dan siswa.
- Mengelola kelas, mata pelajaran, akun guru, serta penugasan guru ke kelas dan
  mata pelajaran.

### Pra-kelas dan gamifikasi

- Guru dapat menandai materi dan kuis yang menjadi bagian persiapan sebelum
  pertemuan.
- Halaman siswa **Pra-kelas & Poin** menyatukan daftar persiapan dan pre-test.
- Target penyelesaian dapat digunakan untuk mengingatkan siswa tentang jadwal
  (misalnya H-2). Untuk menerapkan tenggat kuis, gunakan jenis **Kuis
  Penilaian**; target waktu untuk **Kuis Bab** hanya rekomendasi.
- Poin diberikan satu kali per aktivitas/capaian:
  - Materi pra-kelas selesai: **+5**.
  - Pre-test dikumpulkan: **+10**.
  - Pre-test lulus: **+10**.
  - Nilai pre-test 100: **+10**.
- Lencana otomatis: **Siap Kelas**, **Lulus Pre-test**, dan **Skor Sempurna**.
- Papan peringkat menampilkan hingga 10 siswa teratas di kelas.

## Teknologi

- **Next.js 15** dengan App Router dan React 19.
- **TypeScript** dengan pemeriksaan tipe.
- **Tailwind CSS** serta komponen UI berbasis Radix UI.
- **Supabase** untuk PostgreSQL, autentikasi, Row Level Security (RLS), dan
  penyimpanan file.
- **TipTap** untuk penyuntingan materi rich text.
- **Vitest** dan Testing Library untuk pengujian.

## Arsitektur singkat

```text
Browser
  └── Next.js App Router
        ├── Halaman dan komponen per peran
        ├── Server Actions untuk operasi tulis
        └── Supabase client (server/browser)
              ├── Supabase Auth
              ├── PostgreSQL + RLS + fungsi RPC
              └── Supabase Storage
```

- Halaman aplikasi berada di `app/`; area siswa, guru, dan admin masing-masing
  dilindungi pemeriksaan peran.
- Komponen UI bersama berada di `components/`, sedangkan integrasi Supabase,
  validasi, dan server actions berada di `lib/`.
- Skema, fungsi database, kebijakan akses, dan konfigurasi bucket disimpan
  sebagai migration SQL dalam `supabase/migrations/`.
- `auth.users` menyimpan akun autentikasi. `public.profiles` menyimpan profil
  dan peran aplikasi; pendaftaran siswa mengaitkan akun dengan kelas lewat kode
  pendaftaran.
- RLS adalah lapisan pembatasan akses data di database. Jangan mengandalkan
  penyembunyian tombol atau validasi browser sebagai satu-satunya kontrol akses.

## Persyaratan

- Node.js versi 20 atau lebih baru dan npm.
- Proyek Supabase yang dapat diakses.
- Akses ke Supabase Dashboard untuk mengatur autentikasi, menjalankan SQL, dan
  membuat akun awal.

## Menjalankan secara lokal

1. Kloning repository dan masuk ke direktori proyek:

   ```powershell
   git clone https://github.com/arekpelajar-cmd/web-lms.git
   cd web-lms
   ```

2. Pasang dependensi:

   ```powershell
   npm install
   ```

3. Buat berkas `.env.local` di root proyek. Isi dengan kredensial proyek
   Supabase Anda:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY

   # Diperlukan untuk operasi admin yang membuat/mengelola akun Auth.
   # Hanya digunakan di server; jangan pernah memakai awalan NEXT_PUBLIC_.
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
   ```

   Ganti nilai contoh dengan nilai dari **Supabase Dashboard → Project
   Settings → API**. Kunci service role memiliki hak istimewa tinggi; simpan
   hanya di environment server lokal/deployment dan jangan pernah mengirimnya ke
   browser atau mengunggahnya ke Git.

4. Siapkan Supabase mengikuti [Menyiapkan Supabase](#menyiapkan-supabase).

5. Jalankan server pengembangan:

   ```powershell
   npm run dev
   ```

6. Buka <http://localhost:3000>.

## Menyiapkan Supabase

### 1. Konfigurasi autentikasi

Di Supabase Dashboard, buka **Authentication → Providers → Email** dan
nonaktifkan **Confirm email** untuk alur masuk otomatis setelah pendaftaran.
Jika konfirmasi email tetap aktif, siswa mungkin perlu mengonfirmasi alamat
email sebelum dapat masuk.

### 2. Jalankan migration database

Jalankan berkas SQL berikut satu per satu melalui **Supabase Dashboard → SQL
Editor**, sesuai urutan nama. Pastikan setiap migration selesai tanpa error
sebelum menjalankan migration berikutnya.

| Migration | Cakupan utama |
|---|---|
| `0001_core_tables.sql` | Profil, kelas, mata pelajaran, pendaftaran, dan penugasan guru |
| `0002_helper_functions.sql` | Fungsi bantu untuk pemeriksaan peran, kelas, dan akses |
| `0003_registration_trigger.sql` | Pembuatan profil siswa dari pendaftaran Auth |
| `0004_rls.sql` | Row Level Security untuk data inti |
| `0005_modules_and_materials.sql` | Modul, materi, dan kebijakan aksesnya |
| `0006_student_progress_and_materials_rls.sql` | Penyelesaian materi, akses berurutan, dan RPC daftar modul |
| `0007_quizzes_and_grading.sql` | Kuis pilihan ganda, kunci, percobaan, dan progres kuis |
| `0008_teacher_gradebook_and_rls.sql` | Akses guru terhadap rekap nilai dan progres siswa |
| `0009_simulations.sql` | Metadata simulasi eksternal dan RLS |
| `0010_assignments_and_submissions.sql` | Tugas, pengumpulan, ekstensi tenggat, dan storage |
| `0011_quiz_types_and_assessment.sql` | Kuis bab/penilaian, jadwal, dan batas percobaan |
| `0012_material_images_storage.sql` | Bucket gambar materi dan kebijakan storage |
| `0013_quiz_feedback_and_review.sql` | Umpan balik, review, serta pengerjaan kuis per soal |
| `0014_material_audio.sql` | Audio pembelajaran, transkrip, bucket privat, dan RLS |
| `0015_quiz_feedback_constraints.sql` | Batasan dan validasi pengaturan umpan balik kuis |
| `0016_profile_preferences.sql` | Preferensi profil dan bucket avatar |
| `0017_preclass_and_gamification.sql` | Materi pra-kelas, pre-test, poin, lencana, dan leaderboard |

Migration dapat membuat atau memperbarui bucket Supabase Storage dan kebijakan
aksesnya. Jalankan migration yang sama pada setiap environment database yang
akan digunakan.

### 3. Buat akun administrator dan guru

1. Buat pengguna melalui **Authentication → Users → Add user** di Supabase.
2. Catat alamat email dan UUID akun yang dibuat.
3. Buka `supabase/seed/create_staff_profile.sql`. Ganti email, nama, identitas,
   kelas, mata pelajaran, dan kode kelas contoh dengan nilai yang sesuai.
4. Jalankan SQL yang sudah disesuaikan melalui SQL Editor.

Berkas seed merupakan **contoh untuk diadaptasi**, bukan akun atau data produksi.
Jangan gunakan kata sandi contoh atau menyalin data identitas contoh ke
deployment nyata. Untuk guru/admin yang dibuat dari Dashboard, profil di
`public.profiles` dan penugasan guru perlu dibuat sesuai migration serta aturan
akses proyek.

Jika fungsi admin untuk membuat/mengelola akun Auth digunakan, pastikan
`SUPABASE_SERVICE_ROLE_KEY` tersedia di environment server.

### 4. Daftarkan siswa

Siswa mendaftar melalui `/register` menggunakan nama, NIS, kata sandi, dan kode
kelas yang diberikan guru. NIS dinormalisasi menjadi email internal
`<nis>@lms.local`; siswa tidak perlu memiliki alamat email pribadi untuk alur
ini. NIS harus berupa 3–30 huruf/angka dan kata sandi minimal 6 karakter.

## Alur penggunaan

### Administrator

1. Masuk ke `/login`.
2. Buat kelas dan mata pelajaran.
3. Buat akun guru, lalu tugaskan guru ke kelas dan mata pelajaran.
4. Bagikan kode kelas kepada siswa.

### Guru

1. Masuk dan pilih kelas/mata pelajaran yang ditugaskan.
2. Buat modul, materi, video/audio, simulasi, dan kuis.
3. Untuk persiapan sebelum kelas, ubah materi menjadi **Materi pra-kelas** dan
   kuis menjadi **Pre-test pra-kelas**.
4. Atur tenggat kuis bila diperlukan. Pilih **Kuis Penilaian** jika tenggat
   harus diterapkan saat pengerjaan.
5. Kelola tugas, nilai dan umpan balik, lalu pantau gradebook.

### Siswa

1. Daftar dengan NIS dan kode kelas, lalu masuk.
2. Buka menu **Pelajaran saya** untuk mengikuti modul dan materi.
3. Buka **Pra-kelas & Poin** untuk melihat aktivitas persiapan, mengerjakan
   pre-test, serta memantau progres dan capaian.
4. Gunakan menu **Tugas saya** dan **Kuis & Ujian** untuk aktivitas lainnya.

## Perintah pengembangan

```powershell
npm run dev        # Server pengembangan
npm run typecheck  # Pemeriksaan TypeScript
npm run test       # Seluruh unit test
npm run build      # Build production
npm run start      # Menjalankan build production
```

Tes SQL di `supabase/tests/` merupakan skrip pemeriksaan tambahan untuk
lingkungan Supabase/PostgreSQL. Jalankan hanya pada database pengujian yang
memiliki migration terkait dan data fixture yang sesuai; jangan jalankan
fixture test pada database produksi.

## Struktur direktori

```text
app/
  (auth)/                 Halaman masuk dan pendaftaran
  admin/                  Dashboard dan pengelolaan admin
  student/                Dashboard, materi, kuis, tugas, dan pra-kelas
  teacher/                Dashboard guru, modul, tugas, dan gradebook
  api/                    Route handler API
components/
  editor/                 Editor dan renderer materi rich text
  layout/                 Shell aplikasi, navigasi, dan preferensi
  media/                  Pemutar audio dan video
  simulation/             Tampilan simulasi embed
  student/                Komponen aktivitas siswa
  teacher/                Komponen pengelolaan guru
lib/
  actions/                Server actions
  simulations/            Validasi embed dan CSP
  supabase/               Client, server client, dan middleware
  *.test.ts               Unit test
supabase/
  migrations/             Migration SQL berurutan
  seed/                   Contoh pembuatan data awal
  tests/                  Skrip pemeriksaan database
```

## Catatan keamanan

- Jangan commit `.env.local`, kunci service role, kata sandi, atau data pribadi
  siswa.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` memang digunakan oleh aplikasi browser; akses
  data tetap harus dikontrol dengan RLS.
- `SUPABASE_SERVICE_ROLE_KEY` melewati RLS. Jangan mengeksposnya ke client,
  menuliskannya ke log, atau memasukkannya ke source code.
- Pertahankan RLS dan kebijakan Storage pada semua tabel/bucket yang berisi data
  kelas, pengumpulan, nilai, audio, atau identitas pengguna.
- Gunakan database dan akun uji terpisah dari produksi saat menjalankan
  migration atau tes SQL.

## Pemecahan masalah

### Aplikasi melaporkan URL atau key Supabase tidak tersedia

Pastikan `.env.local` berada di root proyek dan memiliki
`NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Setelah
mengubah environment variable, hentikan lalu jalankan kembali `npm run dev`.

### Pendaftaran berhasil tetapi siswa tidak langsung masuk

Periksa **Authentication → Providers → Email** dan pastikan **Confirm email**
dinonaktifkan untuk alur pendaftaran yang digunakan aplikasi. Pastikan juga
seluruh migration sampai `0004_rls.sql` telah dijalankan.

### Siswa tidak bisa masuk atau tidak memiliki profil

Pastikan migration profil dan trigger pendaftaran telah berjalan, kode kelas
valid, serta siswa terdaftar pada kelas yang benar. Pengguna Auth yang dibuat
manual tanpa profil `public.profiles` tidak akan memperoleh akses sebagai siswa,
guru, atau admin.

### Guru tidak melihat kelas

Pastikan profil pengguna memiliki peran `teacher` dan terdapat baris
`teacher_assignments` yang cocok untuk kelas dan mata pelajaran tersebut.

### Gambar, audio, avatar, atau lampiran tidak dapat diakses

Pastikan migration terkait sudah dijalankan dan bucket beserta kebijakan
Storage-nya tersedia di proyek Supabase yang digunakan aplikasi.

## Lisensi

Kode proyek ini dilisensikan berdasarkan [MIT License](./LICENSE).
Hak cipta proyek: © 2026 Kid Tasadi Prasastino dan Moch. Fatwa Hidayatulloh.

Lisensi ini hanya berlaku untuk materi proyek yang haknya dimiliki pemegang hak
cipta tersebut. Dependensi pihak ketiga, logo, gambar, video, audio, materi ajar,
dan aset lain yang tidak dibuat oleh pemegang hak cipta tetap tunduk pada lisensi
atau izin masing-masing.
