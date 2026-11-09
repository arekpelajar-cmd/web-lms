# Chatbot AI RAG EduSpace

Chatbot siswa menjawab menggunakan materi teks yang telah diindeks dari kelas
siswa. Materi dipotong menjadi beberapa bagian, diubah menjadi embedding oleh
Google Gemini Embedding, lalu dicari dengan cosine similarity di Supabase
pgvector. Hanya materi yang dapat diakses siswa menurut aturan urutan belajar
`can_access_material` yang dapat masuk ke hasil pencarian.

## 1. Konfigurasi

Tambahkan variabel berikut ke `.env.local` (jangan commit nilai rahasia):

```env
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-studio-api-key
GOOGLE_CHAT_MODEL=gemini-3.8-flash
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001
```

`GOOGLE_CHAT_MODEL` dapat disesuaikan dengan model Gemini yang tersedia untuk
project dan API key Anda. Model contoh `gemini-1.5-flash` pada permintaan awal
tidak lagi dipilih sebagai default; gunakan model Flash yang masih tersedia.
Embedding menggunakan model terpisah dari model chat, dengan dimensi tetap 768.
Jangan mengubah dimensi embedding hanya pada salah satu sisi: kolom pgvector,
konfigurasi Google Embedding, dan fungsi pencarian harus selalu sama.

## 2. Terapkan migrasi

Jalankan migrasi `supabase/migrations/0018_rag_chatbot.sql` pada project
Supabase yang digunakan aplikasi, misalnya dengan Supabase CLI:

```powershell
npx supabase db push
```

Migrasi mengaktifkan ekstensi pgvector, membuat tabel embedding dan indeks HNSW
cosine, memasang RLS, lalu menambahkan RPC `match_modul`. RPC bersifat
`SECURITY INVOKER`, sehingga kebijakan tabel tetap diberlakukan saat pencarian.
Untuk siswa, hasilnya dibatasi pada kelas terdaftar dan materi yang sudah dapat
diakses.

## 3. Indeks materi kelas

1. Pastikan API key ada di environment server dan migrasi telah diterapkan.
2. Buka **Kelola Kelas → Modul** sebagai guru.
3. Klik **Indeks AI** pada materi berisi teks.
4. Ulangi setelah isi/judul materi diubah, atau untuk mengindeks materi lama.

Materi tanpa teks akan menghapus indeks lama agar chatbot tidak menggunakan
versi yang sudah tidak berlaku. Gambar, video, dan audio tidak diubah menjadi
teks; tambahkan transkrip ke isi materi bila konten tersebut harus dapat dicari.
Setiap materi dibatasi maksimal 80 bagian agar permintaan embedding dan ukuran
indeks tetap terukur.

## 4. Alur API dan keamanan

`app/api/chat/route.ts` memverifikasi sesi lewat Supabase Auth, menolak non-siswa,
dan mendapatkan kelas dari enrollment di server (bukan dari body browser).
Pertanyaan dibatasi maksimal 2.000 karakter. Embedding query dipakai untuk
memanggil RPC dengan jumlah hasil maksimal lima dan ambang similarity 0.35.
Jika tidak ada materi relevan, API mengirim jawaban penolakan tetap tanpa
memanggil model generatif.

Route meneruskan hanya materi hasil pencarian ke Gemini melalui Vercel AI SDK.
Instruksi sistem meminta model untuk mengabaikan instruksi yang tersisip dalam
materi, tidak mengarang jawaban di luar sumber, dan merujuk materi dengan nomor
`[1]`, `[2]`, dan seterusnya. RAG mengurangi jawaban tanpa sumber, tetapi tidak
menjamin kebenaran mutlak; verifikasi materi dan jawaban tetap diperlukan.

Widget siswa tersedia pada layout `/student` untuk akun yang memiliki enrollment.
Untuk troubleshooting, cek log server, status koneksi Google AI, migrasi yang
telah diterapkan, dan apakah materi sudah diindeks.

## 5. Komponen utama

- `supabase/migrations/0018_rag_chatbot.sql` — tabel embedding, RLS, indeks,
  serta fungsi `match_modul`.
- `lib/chat-rag.ts` — sanitasi HTML TipTap, ekstraksi teks, chunking, dan
  embedding query/dokumen.
- `lib/actions/teacher.ts` — indexing materi berdasarkan otorisasi guru.
- `app/api/chat/route.ts` — autentikasi, retrieval, prompt, dan streaming.
- `components/student/chatbot-widget.tsx` — floating chat UI berbasis `useChat`.
