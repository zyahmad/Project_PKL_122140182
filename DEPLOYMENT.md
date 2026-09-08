# 🚀 Panduan Lengkap: Upload GitHub & Hosting di Vercel

Panduan resmi langkah demi langkah untuk mengunggah proyek **Sistem Surat Rekomendasi Kanwil Kemenag** ke **GitHub** dan mendeploy ke **Vercel** (100% Serverless, tanpa biaya server / tanpa VPS).

---

## 📁 1. Keamanan & Audit File

Proyek ini telah dikonfigurasi dengan `.gitignore` yang ketat untuk mencegah kebocoran data rahasia.

### ✅ File yang di-upload ke GitHub:
- `backend/` (kode API Express, `services/pdfGenerator.js`, `auth.js`, `store.js`, `db.js`, `supabase-schema.sql`, template surat & logo)
- `frontend/` (kode React, komponen, halaman, styling responsif, Vite config)
- `api/index.js` (pintu masuk Serverless Function Vercel)
- `vercel.json` (konfigurasi routing & serverless bundling)
- `package.json` (root orchestrator dependensi dan build)
- `.gitignore`
- `README.md`, `DEPLOYMENT.md`

### 🔒 File yang OTOMATIS DIABAIKAN (Aman & Tidak Akan Ter-upload):
- `.env` & `backend/.env` (Berisi kunci rahasia Supabase & JWT)
- `backend/data/*.json` (Data lokal mock)
- `backend/output/*.pdf` (File PDF uji coba sementara)
- `*oauth*.json`, `*service-account*.json`, `*drive-config*.json` (Kredensial Drive lokal)
- Seluruh folder `node_modules/` dan `frontend/dist/`

---

## 📤 2. Langkah Upload ke GitHub

Buka terminal di folder root proyek (`D:\surat-uji`) lalu jalankan perintah berikut secara berurutan:

```bash
# 1. Inisialisasi Git (jika belum)
git init

# 2. Tambahkan semua file yang sudah difilter oleh .gitignore
git add .

# 3. Buat commit pertama
git commit -m "feat: Sistem Surat Rekomendasi siap deploy ke Vercel"

# 4. Hubungkan ke repository GitHub Anda
# Ganti URL di bawah dengan URL repository GitHub Anda yang baru dibuat
git remote add origin https://github.com/USERNAME-ANDA/NAMA-REPOSITORY.git

# 5. Ubah branch utama menjadi main dan push ke GitHub
git branch -M main
git push -u origin main
```

> **Catatan:** Pastikan repositori di GitHub dibuat dalam keadaan **kosong** (tanpa mencentang *Add README* atau *Add .gitignore* di GitHub) agar proses push berjalan instan tanpa konflik.

---

## ☁️ 3. Panduan Deploy ke Vercel (Langkah demi Langkah)

### Langkah 1: Hubungkan Repositori di Vercel
1. Buka [vercel.com](https://vercel.com) dan login menggunakan akun GitHub Anda.
2. Di halaman Dashboard, klik tombol **Add New...** lalu pilih **Project**.
3. Cari nama repositori yang baru saja Anda push, lalu klik tombol **Import**.

### Langkah 2: Konfigurasi Proyek
Pada halaman *Configure Project*:
- **Project Name**: Masukkan nama proyek sesuai keinginan (misal: `surat-kemenag-lampung`).
- **Framework Preset**: Biarkan **Other** (pengaturan build otomatis dibaca dari `vercel.json`).
- **Root Directory**: `./` (biarkan default).

### Langkah 3: Masukkan Environment Variables (Wajib)
Buka menu dropdown **Environment Variables**, lalu tambahkan variabel-variabel berikut satu per satu (salin dari file `.env` lokal Anda):

| Nama Variabel (*Key*) | Contoh / Sumber Nilai | Keterangan |
|---|---|---|
| `NODE_ENV` | `production` | Mode produksi |
| `SESSION_SECRET` | *(string acak panjang)* | Kunci JWT dari `.env` |
| `REACT_APP_SUPABASE_URL` | `https://eliovyrvtxyvfznkbgex.supabase.co` | URL Supabase Project Anda |
| `REACT_APP_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_5AvhCaX_rmhZ2bo2_1VdNg_K5LlLB8I` | Anon/Publishable Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Service Role Key dari `.env` |
| `GOOGLE_DRIVE_FOLDER_ID` | `15eoUcYIaYiUYmaqzZXCm4oQRC6cBgeHO` | *(Opsional)* Folder ID Google Drive untuk surat resmi / hasil ttd |
| `GOOGLE_DRIVE_FOLDER_DRAFT_ID` | `1xyz...` | *(Opsional)* Folder ID Google Drive untuk draf surat |
| `GOOGLE_DRIVE_OAUTH_CREDENTIALS` | `{"web":{"client_id":"..."}}` | *(Opsional)* Isi lengkap file `oauth.json` dalam format satu baris string JSON |

### Langkah 4: Klik Deploy!
1. Klik tombol **Deploy**.
2. Tunggu proses build selesai (~1 - 2 menit). Vercel akan otomatis:
   - Mengompilasi frontend React Vite menjadi file web statis berkecepatan tinggi.
   - Mengemas backend Express + PDF generator Chromium menjadi Serverless Function yang efisien.
3. Setelah selesai, Anda akan mendapatkan URL domain resmi aktif (misal: `https://surat-kemenag-lampung.vercel.app`).

---

## 🔑 4. Konfigurasi 2 Folder Google Drive (Draft & Surat Resmi)

Aplikasi memisahkan penyimpanan berkas PDF ke dalam 2 folder berbeda di Google Drive:
1. **Folder Draft**: Menyimpan pratinjau surat draft yang dikirim operator ke verifikator/Kepala Bidang (`GOOGLE_DRIVE_FOLDER_DRAFT_ID`).
2. **Folder Hasil / Resmi**: Menyimpan surat yang sudah disahkan/ditandatangani secara digital dengan QR Code (`GOOGLE_DRIVE_FOLDER_ID` atau `GOOGLE_DRIVE_FOLDER_SIGNED_ID`).

### Cara Menghubungkan Google Drive di Vercel:
1. Masukkan isi file `oauth.json` ke Environment Variable Vercel dengan nama **`GOOGLE_DRIVE_OAUTH_CREDENTIALS`**.
2. Masukkan ID folder Google Drive ke **`GOOGLE_DRIVE_FOLDER_DRAFT_ID`** (folder draft) dan **`GOOGLE_DRIVE_FOLDER_ID`** (folder resmi).
   - *(Tips: ID folder adalah teks setelah `/folders/` pada URL folder Google Drive Anda)*.
3. Buka [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
4. Edit **OAuth 2.0 Client IDs** Anda.
5. Pada bagian **Authorized redirect URIs**, tambahkan URL domain Vercel Anda:
   ```
   https://nama-proyek-anda.vercel.app/oauth2callback
   ```
6. Simpan, lalu pada aplikasi live Anda, login sebagai admin dan klik tombol **Hubungkan Google Drive** satu kali untuk autorisasi akun Google.

---

## 🛡️ 5. Database Supabase Cloud

Karena aplikasi ini **100% menggunakan Supabase Cloud PostgreSQL**, Anda tidak perlu memigrasikan database saat deploy ke Vercel:
- 15 Kabupaten/Kota se-Provinsi Lampung sudah aktif di tabel `branches`.
- Akun pengguna dan pejabat penandatangan sudah aktif di tabel `users` dan `signatories`.
- Draf dan arsip surat tersimpan aman dan terenkripsi di tabel `history`.
- File skema lengkap tersedia di `backend/supabase-schema.sql`.
