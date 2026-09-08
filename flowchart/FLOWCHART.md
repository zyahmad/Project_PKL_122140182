# Dokumentasi Flowchart & Alur Kerja Sistem Surat Rekomendasi

Dokumen ini berisi dokumentasi lengkap arsitektur sistem, alur proses bisnis, autentikasi pengguna, pembuatan surat otomatis, manajemen data, dan integrasi Google Drive pada aplikasi **Sistem Surat Rekomendasi**.

---

## Daftar Isi
1. [Arsitektur Sistem Keseluruhan](#1-arsitektur-sistem-keseluruhan)
2. [Autentikasi & Role-Based Access Control (RBAC)](#2-autentikasi--role-based-access-control-rbac)
3. [Alur Pembuatan Surat Rekomendasi (Core Process)](#3-alur-pembuatan-surat-rekomendasi-core-process)
4. [Alur Riwayat Surat & Pagination](#4-alur-riwayat-surat--pagination)
5. [Manajemen Pengguna & Penandatangan](#5-manajemen-pengguna--penandatangan)
6. [Integrasi Google Drive OAuth 2.0](#6-integrasi-google-drive-oauth-20)
7. [Spesifikasi API Endpoint & Hak Akses](#7-spesifikasi-api-endpoint--hak-akses)

---

## 1. Arsitektur Sistem Keseluruhan

Diagram ini menggambarkan interaksi antara pengguna, antarmuka Frontend React, Backend API Express.js, sistem pembuatan dokumen (Docxtemplater & VBScript Word Converter), Database Store (Supabase Cloud / JSON Fallback), dan Google Drive API.

```mermaid
flowchart TD
    User(["👤 Pengguna (Staff / Admin / Superadmin)"]) -->|Akses Web /| FE["🖥️ Frontend (React JSX + Vite)"]
    
    FE -->|Cek Sesi /api/me| AuthCheck{"Sudah Login?"}
    AuthCheck -- "Tidak" --> LoginPage["Halaman Login (/login)"]
    AuthCheck -- "Ya" --> Dashboard["Halaman Dashboard (/dashboard)"]

    LoginPage -->|POST /api/login| AuthAPI["Backend Auth Controller"]
    AuthAPI -->|Verifikasi Hash Bcrypt| DataStore[("Database Store\nSupabase Cloud / JSON Fallback")]
    AuthAPI -->|Buat Session Cookie| Dashboard

    Dashboard --> Tab1["📝 Tab Buat Surat"]
    Dashboard --> Tab2["📋 Tab Riwayat Surat"]
    Dashboard --> Tab3["✒️ Tab Penandatangan (Admin+)"]
    Dashboard --> Tab4["👥 Tab Kelola User (Admin+)"]
    Dashboard --> GDriveAuth["🔗 Hubungkan Google Drive OAuth"]

    Tab1 -->|Generate PDF| PDFEngine["Docxtemplater + Word Converter"]
    PDFEngine --> GDriveAPI["☁️ Google Drive API"]
    PDFEngine --> Download(["📥 Download File PDF"])
    PDFEngine -->|Simpan Metadata| DataStore
```

### Penjelasan Komponen:
- **Frontend (React JSX + Vite)**: Menyediakan antarmuka bertema Glassmorphism dengan multi-tab dinamis berdasarkan role user.
- **Backend (Express.js)**: Menyediakan RESTful API, validasi request, pengelolaan session cookie (8 jam), dan pembatasan konkurensi pembuatan surat.
- **Data Layer (Store)**: Menggunakan Supabase Cloud PostgreSQL sebagai basis data utama dengan fallback otomatis ke file lokal JSON (`data/*.json`).
- **Document Engine**: Memproses placeholder dokumen DOCX dengan `Docxtemplater` + `PizZip`, lalu mengonversinya menjadi PDF berpresisi tinggi via VBScript Microsoft Word Automation.
- **Google Drive Integration**: Mengunggah PDF hasil konversi ke folder Google Drive secara otomatis via OAuth 2.0.

---

## 2. Autentikasi & Role-Based Access Control (RBAC)

Diagram ini mengilustrasikan alur login pengguna, verifikasi password, dan penentuan menu serta hak akses berdasarkan role (`staff`, `admin`, `superadmin`).

```mermaid
flowchart TD
    Start(["Mulai"]) --> InputLogin["Input Username & Password"]
    InputLogin --> SubmitLogin["Kirim Request POST /api/login"]
    SubmitLogin --> CheckUser{"User Ditemukan & Password Cocok?"}

    CheckUser -- "Tidak" --> LoginFail["Tampilkan Pesan Error (401)"] --> InputLogin
    CheckUser -- "Ya" --> CreateSession["Buat Session Cookie (8 Jam)"]
    CreateSession --> CheckRole{"Identifikasi Role Pengguna"}

    CheckRole -- "staff" --> StaffView["Dashboard Staff:\n- Buat Surat\n- Lihat Riwayat Pribadi"]
    CheckRole -- "admin" --> AdminView["Dashboard Admin Cabang:\n- Buat Surat\n- Riwayat Cabang\n- Kelola Penandatangan Cabang\n- Kelola User Cabang"]
    CheckRole -- "superadmin" --> SuperView["Dashboard Superadmin:\n- Buat Surat Lintas Cabang\n- Riwayat Semua Cabang\n- Kelola Penandatangan Global\n- Kelola Semua User"]

    StaffView --> End(["Selesai"])
    AdminView --> End
    SuperView --> End
```

### Matriks Hak Akses Role:
| Fitur / Modul | Staff | Admin Cabang | Superadmin |
| :--- | :---: | :---: | :---: |
| **Buat Surat Rekomendasi** | ✅ (Cabang Sendiri) | ✅ (Cabang Sendiri) | ✅ (Semua Cabang) |
| **Riwayat Surat** | ✅ (Hanya Surat Sendiri) | ✅ (Surat Satu Cabang) | ✅ (Semua Cabang) |
| **Hapus Riwayat** | ✅ (Hanya Surat Sendiri) | ✅ (Surat Satu Cabang) | ✅ (Semua Surat) |
| **Kelola Penandatangan** | ❌ | ✅ (Cabang Sendiri) | ✅ (Semua Cabang) |
| **Kelola Pengguna (User)** | ❌ | ✅ (Cabang Sendiri) | ✅ (Semua Cabang & Role) |
| **Koneksi Google Drive** | ✅ | ✅ | ✅ |

---

## 3. Alur Pembuatan Surat Rekomendasi (Core Process)

Diagram ini merinci alur pembuatan surat dari input form, pencegahan spam/duplikasi, penomoran surat otomatis, render DOCX, konversi PDF, upload cloud, hingga streaming file download ke browser.

```mermaid
flowchart TD
    StartSurat(["User Buka Tab 'Buat Surat'"]) --> FetchInit["Load Penandatangan & Nomor Surat Otomatis\n(GET /api/signatories & GET /api/next-nomor)"]
    FetchInit --> FillForm["User Mengisi Form Surat:\n- Tempat, Sifat, Lampiran, Hal\n- Tujuan & Lokasi Tujuan\n- Isi Surat & Pilihan Penandatangan"]
    FillForm --> SubmitSurat["Klik 'Buat & Unduh Surat' (POST /api/generate-surat)"]

    SubmitSurat --> MutexCheck{"Apakah User Sedang Memproses Surat Lain?\n(Active Concurrency Check)"}
    MutexCheck -- "Ya" --> ErrMutex["Tolak: 429 Too Many Requests"] --> FillForm
    MutexCheck -- "No" --> DupCheck{"Cek Duplikasi Konten dalam 30 Detik?"}

    DupCheck -- "Ya" --> ErrDup["Tolak: Surat yang sama baru saja dibuat"] --> FillForm
    DupCheck -- "Tidak" --> ValFields{"Semua Field Wajib Terisi?"}

    ValFields -- "Tidak" --> ErrFields["Tolak: 400 Field Belum Lengkap"] --> FillForm
    ValFields -- "Ya" --> CheckNomor{"Nomor Surat Kosong / Sudah Dipakai?"}

    CheckNomor -- "Ya" --> GenNewNomor["Generate Nomor Urut Otomatis Baru"]
    CheckNomor -- "Tidak" --> RenderDocx["Render Template DOCX\n(PizZip + Docxtemplater)"]
    GenNewNomor --> RenderDocx

    RenderDocx --> SaveTempDocx["Simpan File DOCX Sementara"]
    SaveTempDocx --> ConvertPDF["Konversi DOCX ke PDF via VBScript / MS Word COM"]
    ConvertPDF --> DeleteDocx["Hapus File DOCX Sementara"]
    
    DeleteDocx --> CheckDrive{"Google Drive Terhubung?"}
    CheckDrive -- "Ya" --> UploadDrive["Upload PDF ke Google Drive Folder"]
    CheckDrive -- "Tidak" --> SkipDrive["Lewati Upload Drive"]

    UploadDrive --> SaveHistory["Simpan Riwayat Surat ke Supabase / JSON Store"]
    SkipDrive --> SaveHistory

    SaveHistory --> StreamPDF["Kirim Stream File PDF ke Browser"]
    StreamPDF --> DownloadTrigger["Browser Mengunduh File 'Surat_Rekomendasi.pdf'"]
    DownloadTrigger --> ResetForm["Reset Form & Generate Nomor Surat Baru"]
    ResetForm --> Selesai(["Selesai"])
```

### Logika Khusus Pembuatan Surat:
1. **Pencegahan Race Condition**: Menggunakan Set `activeGenerations` pada backend untuk mencegah klik ganda/request bersamaan dari user yang sama.
2. **Anti-Duplikasi (30 Detik Debounce)**: Backend membuat hash dari `userId + hal + tujuan + isi_surat` dan menolak pembuatan surat identik dalam rentang waktu 30 detik.
3. **Format Nomor Surat Otomatis**:
   `B-{NomorUrut}/Kw.08.3.5/PP.00.{KodeJenis}/{Bulan}/{Tahun}`
   Contoh: `B-001/Kw.08.3.5/PP.00.07/09/2026`

---

## 4. Alur Riwayat Surat & Pagination

Diagram ini menunjukkan bagaimana data riwayat difilter berdasarkan hak akses role, fitur pencarian di sisi client, pagination 10 data per halaman, dan verifikasi izin penghapusan.

```mermaid
flowchart TD
    StartHist(["Buka Tab 'Riwayat Surat'"]) --> FetchHist["Kirim GET /api/history?page=X&limit=10"]
    FetchHist --> FilterRole{"Filter Riwayat di Backend Sesuai Role"}

    FilterRole -- "Superadmin" --> AllData["Ambil Seluruh Data Riwayat Semua Cabang"]
    FilterRole -- "Admin" --> BranchData["Filter: Surat dari Cabang Sendiri"]
    FilterRole -- "Staff" --> UserData["Filter: Surat yang Dibuat Oleh User Sendiri"]

    AllData --> Pagination["Hitung Total Data & Paginate (10 per Halaman)"]
    BranchData --> Pagination
    UserData --> Pagination

    Pagination --> RenderTable["Tampilkan Tabel Riwayat di Frontend"]
    RenderTable --> UserAction{"Aksi Pengguna"}

    UserAction -- "Pencarian Real-Time" --> FilterClient["Filter Baris Berdasarkan Nomor, Hal, Tujuan, Pembuat"]
    UserAction -- "Buka Drive" --> OpenLink["Buka Link PDF di Tab Baru Google Drive"]
    UserAction -- "Ganti Halaman" --> ChangePage["Request Page Baru"] --> FetchHist
    UserAction -- "Hapus Riwayat" --> ConfirmDelete{"Konfirmasi Dialog Hapus?"}

    ConfirmDelete -- "Ya" --> SendDelete["Kirim DELETE /api/history/:id"]
    SendDelete --> VerifyPerm{"Cek Izin Hapus:\n- Superadmin: Boleh Semua\n- Admin: Boleh Cabang Sendiri\n- Staff: Hanya Milik Sendiri"}

    VerifyPerm -- "Diizinkan" --> DeleteDB["Hapus dari Supabase / JSON"] --> RefreshHist["Muat Ulang Halaman Riwayat"]
    VerifyPerm -- "Ditolak" --> Err403["Tampilkan Error 403 Forbidden"]
    ConfirmDelete -- "Batal" --> RenderTable
```

---

## 5. Manajemen Pengguna & Penandatangan

Diagram ini menjelaskan alur CRUD untuk penandatangan surat dan pengguna (user) oleh Admin dan Superadmin.

```mermaid
flowchart TD
    StartAdmin(["Admin / Superadmin Akses Tab Penandatangan / User"]) --> SelectTab{"Pilih Tab"}

    subgraph KelolaPenandatangan ["Kelola Penandatangan"]
        SelectTab -- "Penandatangan" --> ViewSig["Lihat Daftar Penandatangan\n(Superadmin: Semua / Admin: Cabangnya)"]
        ViewSig --> ActSig{"Aksi Penandatangan"}
        ActSig -- "Tambah" --> FormSig["Input Jabatan, Nama, NIP, (Cabang jika Superadmin)"]
        FormSig --> SubmitSig["POST /api/signatories"] --> SaveSig["Simpan ke DB"] --> ViewSig
        ActSig -- "Hapus" --> DelSig["DELETE /api/signatories/:id"] --> DeleteSigDB["Hapus dari DB"] --> ViewSig
    end

    subgraph KelolaUser ["Kelola Pengguna"]
        SelectTab -- "Kelola User" --> ViewUser["Lihat Daftar User\n(Superadmin: Semua / Admin: Cabangnya)"]
        ViewUser --> ActUser{"Aksi User"}
        ActUser -- "Tambah" --> FormUser["Input Nama, Username, Password, Role, Cabang"]
        FormUser --> CheckExist{"Username Sudah Ada?"}
        CheckExist -- "Ya" --> ErrUser["Error: Username sudah dipakai"]
        CheckExist -- "Tidak" --> HashPass["Hash Password dengan Bcrypt"]
        HashPass --> SubmitUser["POST /api/users"] --> SaveUser["Simpan User ke DB"] --> ViewUser
        ActUser -- "Hapus" --> SelfCheck{"Apakah Menghapus Diri Sendiri?"}
        SelfCheck -- "Ya" --> BlockDel["Tolak: Tidak bisa hapus akun sendiri"]
        SelfCheck -- "Tidak" --> DelUser["DELETE /api/users/:id"] --> DeleteUserDB["Hapus User dari DB"] --> ViewUser
    end
```

---

## 6. Integrasi Google Drive OAuth 2.0

Diagram ini menjelaskan proses otorisasi Google OAuth 2.0 agar aplikasi dapat mengunggah file PDF yang dihasilkan secara otomatis ke Google Drive pengguna.

```mermaid
flowchart TD
    StartOAuth(["User Klik 'Hubungkan Drive' di Header"]) --> ReqAuth["Akses GET /auth/google"]
    ReqAuth --> GenAuthURL["Backend Generate URL OAuth2 Google\n(Scope: drive.file, drive)"]
    GenAuthURL --> RedirectGoogle["Redirect User ke Halaman Izin Akun Google"]
    
    RedirectGoogle --> UserConsent{"User Menyetujui Izin Google?"}
    UserConsent -- "Tidak" --> AuthCancel["Proses Dibatalkan"]
    UserConsent -- "Ya" --> Callback["Google Redirect ke /oauth2callback?code=XXX"]

    Callback --> ExchangeToken["Backend Menukar Code dengan Access & Refresh Token"]
    ExchangeToken --> SaveConfig["Simpan Refresh Token ke drive-config.json"]
    SaveConfig --> SuccessPage["Tampilkan Halaman 'Google Drive Berhasil Terhubung'"]
    SuccessPage --> ReturnApp["User Kembali ke Aplikasi (Status: Drive Terhubung ✅)"]
```

---

## 7. Spesifikasi API Endpoint & Hak Akses

| Endpoint | Method | Role Minimum | Deskripsi |
| :--- | :---: | :---: | :--- |
| `/api/login` | `POST` | Publik | Otentikasi username & password, mengembalikan info user dan membuat session |
| `/api/logout` | `POST` | Auth | Menghancurkan session user yang aktif |
| `/api/me` | `GET` | Auth | Mengecek status login dan data user saat ini |
| `/auth/google` | `GET` | Publik | Memulai alur otentikasi Google OAuth 2.0 |
| `/oauth2callback` | `GET` | Publik | Callback Google OAuth 2.0 untuk menukar token |
| `/api/drive-status` | `GET` | Auth | Memeriksa apakah integrasi Google Drive aktif |
| `/api/branches` | `GET` | Auth | Mendapatkan daftar seluruh cabang yang tersedia |
| `/api/signatories` | `GET` | Auth | Mengambil data pejabat penandatangan (terfilter per cabang/global) |
| `/api/signatories` | `POST` | Admin | Menambahkan data pejabat penandatangan baru |
| `/api/signatories/:id` | `DELETE` | Admin | Menghapus pejabat penandatangan |
| `/api/users` | `GET` | Admin | Mengambil daftar pengguna |
| `/api/users` | `POST` | Admin | Membuat akun pengguna baru |
| `/api/users/:id` | `DELETE` | Admin | Menghapus akun pengguna (selain akun sendiri) |
| `/api/next-nomor` | `GET` | Auth | Menghitung nomor urut surat resmi berikutnya |
| `/api/generate-surat` | `POST` | Auth | Memproses DOCX → PDF, upload Google Drive, simpan riwayat, kirim file PDF |
| `/api/history` | `GET` | Auth | Mengambil daftar riwayat surat dengan paginasi & filter hak akses |
| `/api/history/:id` | `DELETE` | Auth | Menghapus riwayat surat (tervalidasi hak cabang/kepemilikan) |

