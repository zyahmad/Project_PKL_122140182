# 📄 Sistem Pembuatan Surat Rekomendasi Otomatis

> **Kantor Wilayah Kementerian Agama Provinsi Lampung**

Aplikasi web untuk pembuatan, penandatanganan digital, dan distribusi Surat Rekomendasi Ujian Komprehensif secara otomatis antar 15 Kabupaten/Kota di Provinsi Lampung.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 📝 **Buat Surat Otomatis** | Generate surat rekomendasi dari template dengan nomor surat otomatis |
| ✍️ **Tanda Tangan Digital** | QR Code verifikasi + alur persetujuan (Draft → Ditandatangani) |
| 📤 **Distribusi Antar Cabang** | Kirim surat ke cabang Kemenag lain se-Provinsi Lampung |
| 📥 **Surat Masuk** | Terima dan baca surat distribusi dari cabang lain |
| 🔐 **Autentikasi JWT** | Login berbasis token dengan proteksi CSRF Double-Submit Cookie |
| 👥 **Manajemen User & Role** | Admin dan Super Admin dengan kontrol akses per cabang |
| 📊 **Riwayat Surat** | Pencarian, filter, dan ekspor riwayat surat |
| ☁️ **Google Drive Backup** | Upload PDF surat yang sudah ditandatangani ke Google Drive |
| 📱 **Responsif** | Tampilan optimal di desktop maupun perangkat mobile |
| 🔍 **Verifikasi Publik** | Halaman verifikasi keaslian surat via link/QR Code |

---

## 🛠️ Tech Stack

### Frontend
- **React 19** + **Vite 6** — SPA modern dengan HMR
- **Vanilla CSS** — Responsive design tanpa framework CSS

### Backend
- **Express 5** — REST API server
- **Supabase (PostgreSQL)** — Cloud database utama (100% Supabase, tanpa JSON fallback)
- **Puppeteer Core** + **@sparticuz/chromium** — Serverless PDF generation
- **JWT** + **CSRF** + **bcryptjs** — Autentikasi & keamanan
- **Google APIs** — Upload PDF ke Google Drive

### Deployment
- **Vercel** — Serverless hosting (frontend + API)
- **Supabase Cloud** — Managed PostgreSQL database

---

## 📁 Struktur Proyek

```
surat-uji/
├── api/
│   └── index.js                  # Vercel serverless entrypoint
│
├── backend/
│   ├── server.js                 # Express app (routes, middleware, auth)
│   ├── db.js                     # Koneksi Supabase client
│   ├── store.js                  # Data access layer (CRUD Supabase)
│   ├── auth.js                   # Helper autentikasi JWT
│   ├── signer.js                 # Tanda tangan digital & QR Code
│   ├── drive.js                  # Integrasi Google Drive API
│   ├── services/
│   │   └── pdfGenerator.js       # Generate PDF dari HTML template
│   ├── templates/
│   │   ├── kemenag_logo.png      # Logo Kemenag untuk header surat
│   │   ├── Template_Surat_Rekomendasi.docx
│   │   └── Template_Surat_Rekomendasi.pdf
│   ├── data/
│   │   └── .gitkeep              # Placeholder (data JSON di-gitignore)
│   ├── output/
│   │   └── .gitkeep              # Placeholder (PDF output di-gitignore)
│   ├── supabase-schema.sql       # Skema database lengkap
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── index.html                # HTML entry point
│   ├── vite.config.js            # Konfigurasi Vite + proxy API
│   ├── src/
│   │   ├── main.jsx              # React entry point
│   │   ├── App.jsx               # Router & layout utama
│   │   ├── components/
│   │   │   ├── BuatSuratTab.jsx        # Form pembuatan surat
│   │   │   ├── RiwayatTab.jsx          # Tabel riwayat surat
│   │   │   ├── VerifikasiTab.jsx       # Daftar surat menunggu TTD
│   │   │   ├── SuratMasukTab.jsx       # Surat masuk dari cabang lain
│   │   │   ├── PenandatanganTab.jsx    # Kelola penandatangan
│   │   │   └── UsersTab.jsx            # Manajemen pengguna
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx           # Halaman login
│   │   │   ├── DashboardPage.jsx       # Dashboard utama (tab-based)
│   │   │   └── VerifikasiView.jsx      # Verifikasi publik keaslian surat
│   │   ├── styles/
│   │   │   ├── globals.css             # Style global & responsive
│   │   │   ├── dashboard.css           # Style dashboard
│   │   │   └── login.css              # Style halaman login
│   │   └── utils/
│   │       └── api.js                  # API client + CSRF auto-retry
│   ├── package.json
│   └── package-lock.json
│
├── flowchart/
│   ├── FLOWCHART.md              # Dokumentasi alur sistem
│   ├── index.html                # Viewer flowchart interaktif
│   └── diagrams/
│       ├── 01_arsitektur_sistem.mmd
│       ├── 02_autentikasi_rbac.mmd
│       ├── 03_pembuatan_surat.mmd
│       ├── 04_riwayat_surat.mmd
│       ├── 05_manajemen_user_penandatangan.mmd
│       └── 06_integrasi_google_drive.mmd
│
├── .gitignore                    # Proteksi kredensial & file sensitif
├── DEPLOYMENT.md                 # Panduan deploy ke Vercel
├── package.json                  # Root orchestrator (build & postinstall)
├── vercel.json                   # Konfigurasi Vercel (routes & functions)
└── Procfile                      # Konfigurasi Heroku (opsional)
```

---

## 🗄️ Database Schema

Sistem menggunakan **5 tabel utama** di Supabase (PostgreSQL):

```
┌──────────────────┐     ┌──────────────────┐
│    branches       │     │   signatories     │
│──────────────────│     │──────────────────│
│ id (UUID, PK)    │◄────│ branch_id (FK)   │
│ code (UNIQUE)    │     │ id (UUID, PK)    │
│ name             │     │ jabatan          │
│ created_at       │     │ nama             │
└──────────────────┘     │ nip              │
        ▲                └──────────────────┘
        │                         ▲
        │                         │
┌──────────────────┐              │
│     users         │              │
│──────────────────│              │
│ id (UUID, PK)    │              │
│ username (UNIQUE)│              │
│ password_hash    │              │
│ name             │              │
│ role             │              │
│ branch_id (FK)───┤              │
│ signatory_id (FK)│──────────────┘
└──────────────────┘
        ▲
        │
┌──────────────────┐     ┌───────────────────────┐
│    history        │     │  surat_distributions   │
│──────────────────│     │───────────────────────│
│ id (UUID, PK)    │◄────│ surat_id (FK)         │
│ nomor_surat      │     │ id (UUID, PK)         │
│ hal, tujuan      │     │ source_branch_id (FK) │
│ status           │     │ target_branch_id (FK) │
│ user_id (FK)     │     │ sent_by_user_id (FK)  │
│ branch_id (FK)   │     │ sent_by_name          │
│ signatory_id (FK)│     │ catatan               │
│ data (JSONB)     │     │ is_read               │
│ verification_..  │     │ created_at            │
│ drive_url        │     └───────────────────────┘
│ created_at       │
│ updated_at       │
└──────────────────┘
```

> Skema lengkap tersedia di [`supabase-schema.sql`](backend/supabase-schema.sql)

---

## 🚀 Cara Menjalankan (Lokal)

### Prasyarat

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9
- Akun **Supabase** dengan project aktif
- (Opsional) **Google Cloud** service account untuk fitur Google Drive

### 1. Clone Repository

```bash
git clone https://github.com/zyahmad/Project_PKL_122140182.git
cd Project_PKL_122140182
```

### 2. Setup Environment Variables

Buat file `.env` di folder `backend/`:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-session-secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Google Drive (Opsional)
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
```

### 3. Setup Database

Jalankan file [`backend/supabase-schema.sql`](backend/supabase-schema.sql) di **Supabase SQL Editor** untuk membuat tabel, index, dan seed data.

### 4. Install Dependencies & Jalankan

```bash
# Install semua dependencies (root + backend + frontend)
npm install

# Jalankan backend (port 3000)
npm start

# Jalankan frontend development server (terminal terpisah)
cd frontend
npm run dev
```

Frontend akan berjalan di `http://localhost:5173` dengan proxy ke backend di `http://localhost:3000`.

---

## ☁️ Deployment ke Vercel

Panduan lengkap tersedia di [`DEPLOYMENT.md`](DEPLOYMENT.md).

**Ringkasan langkah:**

1. Push ke GitHub
2. Import project di [Vercel Dashboard](https://vercel.com/new)
3. Set Environment Variables di Vercel:
   | Variable | Deskripsi |
   |----------|-----------|
   | `SUPABASE_URL` | URL project Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase |
   | `REACT_APP_SUPABASE_URL` | URL Supabase (untuk frontend) |
   | `REACT_APP_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key Supabase |
   | `SESSION_SECRET` | Secret untuk JWT signing |
   | `NODE_ENV` | `production` |
   | `GOOGLE_DRIVE_FOLDER_ID` | (Opsional) Folder ID Google Drive |
4. Deploy 🚀

---

## 🔒 Keamanan

- ✅ Password di-hash dengan **bcrypt** (cost factor 10)
- ✅ Autentikasi berbasis **JWT** (HttpOnly cookie)
- ✅ Proteksi **CSRF** dengan Double-Submit Cookie pattern
- ✅ Environment variables untuk semua kredensial (tidak hardcoded)
- ✅ `.gitignore` melindungi `.env`, service account keys, OAuth tokens
- ✅ **Row Level Security (RLS)** di Supabase — anon hanya bisa baca surat yang sudah ditandatangani

---

## 🌐 15 Kabupaten/Kota Lampung

| Kode | Kabupaten/Kota |
|------|----------------|
| LAMSEL | Lampung Selatan |
| PSWRN | Pesawaran |
| METRO | Metro |
| PUSAT | Kanwil Pusat |
| MESUJI | Mesuji |
| PRSW | Pringsewu |
| TGMS | Tanggamus |
| LAMBAR | Lampung Barat |
| LAMTENG | Lampung Tengah |
| TULBAW | Tulang Bawang |
| WAYKANAN | Way Kanan |
| LAMTIM | Lampung Timur |
| PESBAR | Pesisir Barat |
| TULBAWBAR | Tulang Bawang Barat |
| LAMUT | Lampung Utara |

---

## 📄 Alur Surat

```
  Buat Draft          Kirim ke           Verifikasi &        Upload ke
  Surat Baru    →    Penandatangan   →   Tanda Tangan   →   Google Drive
  (DRAFT)            (MENUNGGU)          (DITANDATANGANI)    (PDF + QR Code)
                                                ↓
                                         Distribusi ke
                                         Cabang Lain
```

1. **Admin Cabang** membuat surat draft dengan data mahasiswa
2. Surat dikirim ke **Penandatangan** untuk ditinjau
3. Penandatangan **menyetujui** (tanda tangan digital + QR) atau **menolak**
4. Surat yang disetujui otomatis di-upload ke **Google Drive**
5. Surat dapat **didistribusikan** ke cabang Kemenag lainnya
6. Keaslian surat dapat **diverifikasi** publik via QR Code/link

---

## 👨‍💻 Teknologi & Dependensi

### Backend Dependencies
| Package | Fungsi |
|---------|--------|
| `express` | Web framework & REST API |
| `@supabase/supabase-js` | Client Supabase (PostgreSQL) |
| `puppeteer-core` | Render HTML → PDF |
| `@sparticuz/chromium` | Chromium binary untuk serverless |
| `jsonwebtoken` | JWT token auth |
| `bcryptjs` | Hash password |
| `cookie-parser` | Parse HTTP cookies |
| `pdf-lib` | Manipulasi file PDF |
| `qrcode` | Generate QR Code verifikasi |
| `googleapis` | Upload ke Google Drive |
| `multer` | Handle file upload |
| `dotenv` | Load environment variables |

### Frontend Dependencies
| Package | Fungsi |
|---------|--------|
| `react` | UI library |
| `react-dom` | React DOM renderer |
| `vite` | Build tool & dev server |
| `@vitejs/plugin-react` | Vite plugin untuk React |

---

## 📝 Lisensi

ISC License

---

## 👤 Author

**Proyek PKL (Praktik Kerja Lapangan)**
Kantor Wilayah Kementerian Agama Provinsi Lampung
