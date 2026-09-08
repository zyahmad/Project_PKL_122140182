# Sistem Surat Rekomendasi (React + Glassmorphism)

Aplikasi web modern untuk pembuatan surat rekomendasi resmi secara digital.  
Menggunakan **React JSX**, **Glassmorphism Dark Theme**, multi-cabang, role-based access, dan integrasi Google Drive.

---

## Fitur Utama

- **Desain Glassmorphism Dark Theme**: Tampilan modern, responsif, dan elegan dengan animasi background.
- **Frontend React JSX**: Performa tinggi, komponen modular, terpisah dari CSS.
- **Pembuatan Surat DOCX → PDF**: Otomatisasi pengisian template dan konversi ke PDF.
- **Multi-Cabang**: Dukungan Kantor Pusat & cabang daerah (Bandar Lampung, Metro, Lampung Selatan, dll).
- **Role-Based Access Control**:
  - `Superadmin`: Akses penuh lintas daerah.
  - `Admin`: Kelola user & penandatangan daerah milik sendiri.
  - `Staff`: Pembuatan surat & lihat riwayat pribadi.
- **Riwayat & Pagination**: Tabel riwayat surat dengan fitur hapus & pagination.
- **Google Drive Integration**: Auto-upload hasil surat ke folder Google Drive.
- **Supabase Cloud PostgreSQL**: Single source of truth dengan JSON local fallback.

---

## Struktur Project

```
├── frontend/
│   ├── src/
│   │   ├── components/      # Tab components (BuatSurat, Riwayat, Users, Penandatangan)
│   │   ├── pages/           # Halaman utama (LoginPage, DashboardPage)
│   │   ├── styles/          # Separated CSS (globals, login, dashboard)
│   │   ├── utils/           # API helper module
│   │   ├── App.jsx          # Root React App
│   │   └── main.jsx         # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── server.js            # Express server (Serves React build dist/)
│   ├── store.js              # Data layer (Supabase + JSON fallback)
│   ├── db.js                 # Koneksi Supabase
│   ├── drive.js              # Google Drive API
│   ├── data/                 # JSON fallback
│   ├── templates/            # Template DOCX
│   ├── output/               # Output sementara (PDF)
│   └── package.json
├── .gitignore
├── Procfile
├── package.json              # Root package (Auto build frontend on deploy)
└── README.md
```

---

## Cara Menjalankan (Development)

### 1. Backend

```bash
cd backend
npm install
npm start
```
Server berjalan di `http://localhost:3000`.

### 2. Frontend (Vite Hot-Reload)

```bash
cd frontend
npm install
npm run dev
```
Buka `http://localhost:5173`. Request API akan otomatis diproxy ke `http://localhost:3000`.

---

## Cara Build & Deploy (Production)

### Build Manual

```bash
npm run build
```
Command ini akan melakukan `vite build` di folder `frontend` dan menghasilkan file static di `frontend/dist`. Server Express di `backend/server.js` akan otomatis menyajikan file dari `frontend/dist`.

---

## Akun Default

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: `superadmin`
