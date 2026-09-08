-- ======================================================
-- SKEMA BERSIH DATABASE SUPABASE
-- Sistem Surat Rekomendasi Kanwil Kemenag
-- ======================================================

-- 1. EXTENSION UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL KANTOR CABANG (branches)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL PENANDATANGAN (signatories)
CREATE TABLE IF NOT EXISTS signatories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jabatan VARCHAR(255) NOT NULL,
  nama VARCHAR(255) NOT NULL,
  nip VARCHAR(100) NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL PENGGUNA (users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  signatory_id UUID REFERENCES signatories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL SURAT & RIWAYAT (history)
CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jenis_surat VARCHAR(100) NOT NULL DEFAULT 'Surat',
  nomor_surat VARCHAR(255) NOT NULL,
  hal TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  tanggal VARCHAR(100) NOT NULL,
  dibuat_oleh VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  signatory_id UUID REFERENCES signatories(id) ON DELETE SET NULL,
  jabatan_penandatangan VARCHAR(255),
  nama_penandatangan VARCHAR(255),
  nip_penandatangan VARCHAR(100),
  alasan_penolakan TEXT,
  rejected_by VARCHAR(255),
  rejected_at TIMESTAMPTZ,
  signed_by VARCHAR(255),
  signed_at TIMESTAMPTZ,
  verification_token VARCHAR(100),
  file_hash VARCHAR(128),
  pdf_filename TEXT,
  drive_url TEXT,
  drive_file_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL DISTRIBUSI & SURAT MASUK ANTAR-CABANG (surat_distributions)
CREATE TABLE IF NOT EXISTS surat_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  surat_id UUID REFERENCES history(id) ON DELETE CASCADE,
  source_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  target_branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name VARCHAR(255) NOT NULL,
  catatan TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================
-- INDEX PERFORMA
-- ======================================================
CREATE INDEX IF NOT EXISTS idx_signatories_branch_id ON signatories(branch_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_branch_id ON history(branch_id);
CREATE INDEX IF NOT EXISTS idx_history_status ON history(status);
CREATE INDEX IF NOT EXISTS idx_history_token ON history(verification_token);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dist_target_branch ON surat_distributions(target_branch_id);
CREATE INDEX IF NOT EXISTS idx_dist_surat_id ON surat_distributions(surat_id);
CREATE INDEX IF NOT EXISTS idx_dist_created_at ON surat_distributions(created_at DESC);