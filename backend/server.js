const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const store = require("./store");
const db = require("./db");
const { uploadPdfToDrive, getOAuth2Client, getDriveConfig, getDraftFolderId, getSignedFolderId, sanitizeDriveCredentials, CONFIG_PATH } = require("./drive");
const { generateQrCodeBuffer, calculateSha256, TRANSPARENT_1X1_PNG } = require("./signer");
const { generateSuratPdf } = require("./services/pdfGenerator");
const {
  COOKIE_NAME,
  CSRF_COOKIE_NAME,
  signToken,
  authenticateUser,
  getOrGenerateCsrfToken,
  verifyCsrfToken,
  requireAuth,
  requireAdmin,
  requireKepalaBidang,
  requireSuperAdmin,
} = require("./auth");

const app = express();

// Trust proxy untuk hosting di belakang reverse proxy (seperti Vercel)
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  app.set("trust proxy", 1);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authenticateUser);
app.use(verifyCsrfToken);

// Endpoint diagnostik & health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    supabaseConfigured: Boolean(db && db.isConfigured),
    env: {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY),
      nodeEnv: process.env.NODE_ENV,
      isVercel: Boolean(process.env.VERCEL)
    }
  });
});

// Middleware pengecekan ketersediaan konfigurasi Supabase
app.use((req, res, next) => {
  if (req.path === "/api/health") return next();
  if (req.path.startsWith("/api") && db && !db.isConfigured) {
    return res.status(500).json({
      error: "Konfigurasi Supabase belum lengkap di Vercel Environment Variables. Harap atur SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Settings Vercel lalu lakukan Redeploy.",
      code: "SUPABASE_CONFIG_MISSING"
    });
  }
  next();
});

// Endpoint untuk mengambil CSRF Token aktif (Stateless Double-Submit Cookie)
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = getOrGenerateCsrfToken(req, res);
  res.json({ csrfToken });
});

// ---------- Auth Routes (Stateless JWT) ----------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await store.findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Username atau password salah" });
  }
  const sessionUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    branchName: user.branchName,
    signatoryId: user.signatoryId,
  };

  const token = signToken(sessionUser);
  const isSecure = process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && (process.env.APP_BASE_URL || "").startsWith("https")) || Boolean(process.env.VERCEL);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8, // 8 jam
  });

  const csrfToken = getOrGenerateCsrfToken(req, res);
  res.json({ user: sessionUser, csrfToken });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.clearCookie(CSRF_COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Belum login" });
  const csrfToken = getOrGenerateCsrfToken(req, res);
  res.json({ user: req.user, csrfToken });
});

// ---------- Google OAuth Routes ----------
app.get("/auth/google", (req, res) => {
  const oauth2Client = getOAuth2Client(req);
  if (!oauth2Client) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head><meta charset="UTF-8"><title>Kredensial Google Drive Belum Diatur</title></head>
      <body style="font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f5f6f7; margin:0;">
        <div style="background:#fff; padding:32px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.1); max-width:550px; text-align:left;">
          <h2 style="color:#b91c1c; margin-top:0;">⚠️ Kredensial OAuth Belum Ditemukan</h2>
          <p style="color:#4b5563; font-size:14px; line-height:1.6;">
            Agar Google Drive dapat terhubung di Vercel, tambahkan variabel berikut di <b>Settings > Environment Variables</b> pada Vercel Dashboard:
          </p>
          <ul style="color:#374151; font-size:13px; line-height:1.8;">
            <li><code>GOOGLE_CLIENT_ID</code></li>
            <li><code>GOOGLE_CLIENT_SECRET</code></li>
            <li><code>GOOGLE_DRIVE_REFRESH_TOKEN</code></li>
            <li><code>GOOGLE_DRIVE_FOLDER_ID</code></li>
          </ul>
          <p style="color:#6b7280; font-size:13px;">Setelah menambahkan variabel tersebut, lakukan <b>Redeploy</b> di Vercel.</p>
          <a href="/" style="display:inline-block; margin-top:12px; padding:10px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px; font-weight:600;">Kembali ke Dashboard</a>
        </div>
      </body>
      </html>
    `);
  }
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
  });
  res.redirect(authUrl);
});

app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Authorization code tidak ditemukan.");
  try {
    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code);

    let config = getDriveConfig();
    config.tokens = sanitizeDriveCredentials(tokens);
    if (tokens.refresh_token) {
      config.refreshToken = tokens.refresh_token;
    }

    // Coba simpan ke file lokal atau /tmp (untuk lingkungan Vercel)
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch {
      try {
        const { TMP_CONFIG_PATH } = require("./drive");
        fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(config, null, 2));
      } catch {}
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head><meta charset="UTF-8"><title>Google Drive Terhubung</title></head>
      <body style="font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f5f6f7; margin:0;">
        <div style="background:#fff; padding:40px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.1); text-align:center; max-width:480px;">
          <h2 style="color:#0f5132; margin-top:0;">✅ Google Drive Berhasil Terhubung!</h2>
          <p style="color:#4b5563; font-size:14px; line-height:1.5;">Akun Google Drive Anda telah berhasil dihubungkan. File PDF surat yang ditandatangani akan otomatis tersimpan di Google Drive.</p>
          ${tokens.refresh_token ? `
            <div style="margin-top:16px; text-align:left; background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px;">
              <p style="margin:0 0 6px 0; font-size:12px; font-weight:bold; color:#475569;">Simpan Permanen di Vercel (Opsional):</p>
              <p style="margin:0 0 6px 0; font-size:11px; color:#64748b;">Tambahkan ke Vercel Environment Variables: <code>GOOGLE_DRIVE_REFRESH_TOKEN</code></p>
              <input readonly value="${tokens.refresh_token}" style="width:100%; font-size:11px; padding:6px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;" onclick="this.select(); document.execCommand('copy'); alert('Token berhasil disalin!');" />
            </div>
          ` : ''}
          <a href="/" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#0f5132; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">Kembali ke Aplikasi</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Gagal menghubungkan Google Drive: " + err.message);
  }
});

app.get("/api/drive-status", requireAuth, (req, res) => {
  const config = getDriveConfig();
  const isConnected = Boolean(config.refreshToken || (config.tokens && config.tokens.refresh_token));
  res.json({ connected: isConnected });
});

// ---------- Data Cabang ----------
app.get("/api/branches", requireAuth, async (req, res) => {
  const branches = await store.getBranches();
  res.json({ branches });
});

// ---------- Data Penandatangan ----------
app.get("/api/signatories", requireAuth, async (req, res) => {
  const user = req.session.user;
  const branchId = user.role === "superadmin" ? (req.query.branchId || null) : (user.branchId || null);
  const signatories = await store.getSignatories(branchId);
  res.json({ signatories });
});

app.post("/api/signatories", requireAuth, requireAdmin, async (req, res) => {
  const { jabatan, nama, nip, branchId } = req.body;
  if (!jabatan || !nama || !nip) {
    return res.status(400).json({ error: "Jabatan, nama, dan NIP wajib diisi" });
  }
  const user = req.session.user;
  const effectiveBranchId = user.role === "superadmin" ? (branchId || null) : (user.branchId || null);
  const newSignatory = {
    id: crypto.randomUUID(),
    jabatan: jabatan.trim(),
    nama: nama.trim(),
    nip: nip.trim(),
    branchId: effectiveBranchId,
    createdAt: new Date().toISOString(),
  };
  await store.addSignatory(newSignatory);
  res.json({ signatory: newSignatory });
});

app.delete("/api/signatories/:id", requireAuth, requireAdmin, async (req, res) => {
  const sessionUser = req.session.user;
  if (sessionUser.role === "admin" && sessionUser.branchId) {
    const signatories = await store.getSignatories();
    const target = signatories.find((s) => s.id === req.params.id);
    if (target && target.branchId && target.branchId !== sessionUser.branchId) {
      return res.status(403).json({ error: "Tidak dapat menghapus penandatangan dari cabang lain" });
    }
  }
  await store.deleteSignatory(req.params.id);
  res.json({ ok: true });
});

// ---------- Manajemen User (Admin & Superadmin) ----------
app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const sessionUser = req.session.user;
  let users = (await store.getUsers()).map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    branchId: u.branchId,
    branchName: u.branchName,
    signatoryId: u.signatoryId,
    createdAt: u.createdAt,
  }));
  if (sessionUser.role === "admin" && sessionUser.branchId) {
    users = users.filter((u) => u.branchId === sessionUser.branchId);
  }
  res.json({ users });
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const { username, password, name, role, branchId, signatoryId } = req.body;
  const sessionUser = req.session.user;
  if (!username || !password || !name) {
    return res.status(400).json({ error: "Username, password, dan nama wajib diisi" });
  }
  if (await store.findUserByUsername(username)) {
    return res.status(400).json({ error: "Username sudah dipakai" });
  }

  const isSuperadmin = sessionUser.role === "superadmin";
  let effectiveRole = "admin";
  if (isSuperadmin) {
    if (role === "superadmin") effectiveRole = "superadmin";
    else if (role === "kepala_bidang") effectiveRole = "kepala_bidang";
    else effectiveRole = "admin";
  } else {
    effectiveRole = role === "kepala_bidang" ? "kepala_bidang" : "admin";
  }

  const effectiveBranchId = isSuperadmin ? (branchId || null) : (sessionUser.branchId || null);
  const newUser = {
    id: crypto.randomUUID(),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    name: name.trim(),
    role: effectiveRole,
    branchId: effectiveBranchId,
    signatoryId: signatoryId || null,
    createdAt: new Date().toISOString(),
  };
  await store.addUser(newUser);
  res.json({
    user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role, branchId: newUser.branchId },
  });
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.session.user.id) {
    return res.status(400).json({ error: "Tidak bisa menghapus akun sendiri" });
  }
  const sessionUser = req.session.user;
  if (sessionUser.role === "admin" && sessionUser.branchId) {
    const allUsers = await store.getUsers();
    const target = allUsers.find((u) => u.id === req.params.id);
    if (target && target.branchId !== sessionUser.branchId) {
      return res.status(403).json({ error: "Tidak dapat menghapus user dari daerah lain" });
    }
  }
  await store.deleteUser(req.params.id);
  res.json({ ok: true });
});

// ---------- Riwayat Surat & Daftar Surat ----------
app.get("/api/history", requireAuth, async (req, res) => {
  const allHistory = await store.getHistory();
  const user = req.session.user;
  const statusFilter = req.query.status;

  let filtered = allHistory;

  if (user.role === "superadmin") {
    filtered = allHistory;
  } else if (user.role === "admin") {
    filtered = user.branchId
      ? allHistory.filter((h) => h.branchId === user.branchId || h.userId === user.id)
      : allHistory;
  } else if (user.role === "kepala_bidang") {
    filtered = allHistory.filter((h) => {
      const matchName = h.namaPenandatangan && user.name && h.namaPenandatangan.toLowerCase().includes(user.name.toLowerCase());
      const matchBranch = !user.branchId || h.branchId === user.branchId;
      return matchName || matchBranch;
    });
  } else {
    filtered = allHistory.filter((entry) => entry.userId === user.id);
  }

  if (statusFilter) {
    filtered = filtered.filter((h) => h.status === statusFilter);
  }

  const page = parseInt(req.query.page || "1", 10);
  const limit = parseInt(req.query.limit || "10", 10);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIndex = (currentPage - 1) * limit;
  const paginatedHistory = filtered.slice(startIndex, startIndex + limit);

  res.json({
    history: paginatedHistory,
    pagination: {
      page: currentPage,
      limit,
      totalItems,
      totalPages,
    },
  });
});

app.get("/api/history/:id", requireAuth, async (req, res) => {
  const entry = await store.getHistoryById(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Surat tidak ditemukan" });
  }
  res.json({ surat: entry });
});

app.delete("/api/history/:id", requireAuth, async (req, res) => {
  const entry = await store.getHistoryById(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Entri surat tidak ditemukan" });
  }

  const user = req.session.user;

  if (entry.status === "SUDAH_DITANDATANGANI" && user.role !== "superadmin") {
    return res.status(403).json({ error: "Surat yang sudah ditandatangani resmi tidak dapat dihapus" });
  }

  if (user.role === "admin" && user.branchId) {
    if (entry.branchId !== user.branchId && entry.userId !== user.id) {
      return res.status(403).json({ error: "Anda tidak memiliki izin menghapus surat dari cabang lain" });
    }
  } else if (user.role !== "superadmin" && entry.userId !== user.id) {
    return res.status(403).json({ error: "Anda tidak memiliki izin menghapus surat ini" });
  }

  await store.deleteHistoryEntry(req.params.id);
  res.json({ ok: true });
});

// ---------- Generate, Template, & Output Helpers ----------
const OUTPUT_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "output")
  : path.join(__dirname, "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch {}
}

const REQUIRED_FIELDS = [
  "nomor_surat",
  "tempat_surat",
  "tanggal",
  "sifat",
  "lampiran",
  "hal",
  "tujuan",
  "lokasi_tujuan",
  "isi_surat",
  "jabatan_penandatangan",
  "nama_penandatangan",
  "nip_penandatangan",
];

function formatTanggalIndonesia(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  const date = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function extractNomorSequence(nomorSurat) {
  const match = String(nomorSurat || "").match(/B-(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function normalizeJenisSurat(value) {
  const raw = String(value ?? "07").trim();
  if (/^\d+$/.test(raw)) return raw.padStart(2, "0");
  const match = raw.match(/PP\.00\.(\d+)/i);
  return match ? match[1].padStart(2, "0") : "07";
}

function generateNomorSurat(date = new Date(), history = [], jenisSurat = "07", branchId = null) {
  const branchHistory = branchId
    ? history.filter((h) => h.branchId === branchId)
    : history;

  const existingSequences = branchHistory
    .map((entry) => extractNomorSequence(entry.nomor_surat || entry.data?.nomor_surat))
    .filter((n) => Number.isFinite(n) && n > 0);

  const sequence = existingSequences.length > 0 ? Math.max(...existingSequences) + 1 : 1;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `B-${String(sequence).padStart(3, "0")}/Kw.08.3.5/PP.00.${normalizeJenisSurat(jenisSurat)}/${month}/${year}`;
}

app.get("/api/next-nomor", requireAuth, async (req, res) => {
  const user = req.session.user;
  const branchId = user.role === "superadmin" ? (req.query.branchId || user.branchId || null) : (user.branchId || null);
  const history = await store.getHistory();
  const jenisSurat = normalizeJenisSurat(req.query.kode || "07");
  const nomor = generateNomorSurat(new Date(), history, jenisSurat, branchId);
  res.json({ nomor_surat: nomor });
});

// ---------- ALUR SURAT: DRAFT & KIRIM ----------
app.post("/api/surat/draft", requireAuth, requireAdmin, async (req, res) => {
  const user = req.session.user;
  const data = req.body || {};
  const id = data.id;

  if (id) {
    const existing = await store.getHistoryById(id);
    if (!existing) {
      return res.status(404).json({ error: "Draft surat tidak ditemukan" });
    }
    if (existing.status === "SUDAH_DITANDATANGANI") {
      return res.status(400).json({ error: "Surat yang sudah ditandatangani tidak dapat diedit. Silakan buat versi baru." });
    }

    const updated = await store.updateHistoryEntry(id, {
      nomor_surat: data.nomor_surat || existing.nomor_surat,
      hal: data.hal || existing.hal,
      tujuan: data.tujuan || existing.tujuan,
      tanggal: data.tanggal ? formatTanggalIndonesia(data.tanggal) : existing.tanggal,
      signatoryId: data.signatoryId || existing.signatoryId,
      jabatanPenandatangan: data.jabatan_penandatangan || existing.jabatanPenandatangan,
      namaPenandatangan: data.nama_penandatangan || existing.namaPenandatangan,
      nipPenandatangan: data.nip_penandatangan || existing.nipPenandatangan,
      data: { ...(existing.data || {}), ...data },
      status: "DRAFT",
    });
    return res.json({ ok: true, surat: updated });
  }

  // Buat draft baru
  const history = await store.getHistory();
  const jenisSurat = normalizeJenisSurat(data.kode_jenis_surat || "07");
  const branchId = user.branchId || null;

  let nomorSurat = data.nomor_surat;
  const branchHistory = branchId ? history.filter((h) => h.branchId === branchId) : history;
  const existingNomors = new Set(branchHistory.map((h) => h.nomor_surat));
  if (!nomorSurat || existingNomors.has(nomorSurat)) {
    nomorSurat = generateNomorSurat(new Date(), history, jenisSurat, branchId);
  }

  const newEntry = {
    id: crypto.randomUUID(),
    jenisSurat: "Surat Rekomendasi",
    nomor_surat: nomorSurat,
    hal: data.hal || "Surat Rekomendasi",
    tujuan: data.tujuan || "-",
    tanggal: data.tanggal ? formatTanggalIndonesia(data.tanggal) : formatTanggalIndonesia(new Date().toISOString().slice(0, 10)),
    status: "DRAFT",
    dibuatOleh: user.name,
    userId: user.id,
    branchId: user.branchId || null,
    signatoryId: data.signatoryId || null,
    jabatanPenandatangan: data.jabatan_penandatangan || "",
    namaPenandatangan: data.nama_penandatangan || "",
    nipPenandatangan: data.nip_penandatangan || "",
    data: { ...data, nomor_surat: nomorSurat },
    createdAt: new Date().toISOString(),
  };

  const created = await store.addHistoryEntry(newEntry);
  res.json({ ok: true, surat: created });
});

app.post("/api/surat/:id/send", requireAuth, requireAdmin, async (req, res) => {
  const existing = await store.getHistoryById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Surat tidak ditemukan" });
  }

  if (existing.status === "SUDAH_DITANDATANGANI") {
    return res.status(400).json({ error: "Surat sudah ditandatangani dan tidak dapat dikirim ulang." });
  }

  const data = existing.data || {};
  const mergedData = {
    nomor_surat: existing.nomor_surat,
    tempat_surat: data.tempat_surat,
    tanggal: existing.tanggal,
    sifat: data.sifat,
    lampiran: data.lampiran,
    hal: existing.hal,
    tujuan: existing.tujuan,
    lokasi_tujuan: data.lokasi_tujuan,
    isi_surat: data.isi_surat,
    jabatan_penandatangan: existing.jabatanPenandatangan || data.jabatan_penandatangan,
    nama_penandatangan: existing.namaPenandatangan || data.nama_penandatangan,
    nip_penandatangan: existing.nipPenandatangan || data.nip_penandatangan,
  };

  const missing = REQUIRED_FIELDS.filter((f) => !mergedData[f] || String(mergedData[f]).trim() === "");
  if (missing.length > 0) {
    return res.status(400).json({ error: "Field surat belum lengkap untuk dikirim ke Kepala Bidang", missing });
  }

  // 1. Upload file Draft ke Google Drive folder draft (jika Google Drive terhubung)
  let draftDriveResult = null;
  try {
    const draftPdfBytes = await generateSuratPdf(mergedData, { isDraft: true });
    const cleanNomor = (mergedData.nomor_surat || "Draft").replace(/[/\\?%*:|"<>]/g, "_");
    const draftPdfName = `Draft_${cleanNomor}_${Date.now()}.pdf`;
    const draftPdfPath = path.join(OUTPUT_DIR, draftPdfName);
    try { fs.writeFileSync(draftPdfPath, draftPdfBytes); } catch {}

    draftDriveResult = await uploadPdfToDrive(draftPdfPath, draftPdfName, getDraftFolderId());
    try { if (fs.existsSync(draftPdfPath)) fs.unlinkSync(draftPdfPath); } catch {}
  } catch (dErr) {
    console.warn("⚠️ [Drive Draft Upload] Gagal upload draft ke Google Drive:", dErr.message);
  }

  const updatedData = {
    ...data,
    ...(draftDriveResult ? {
      draft_drive_url: draftDriveResult.webViewLink,
      draft_drive_file_id: draftDriveResult.fileId,
    } : {}),
  };

  const updated = await store.updateHistoryEntry(req.params.id, {
    status: "MENUNGGU_TTD",
    alasanPenolakan: null,
    data: updatedData,
  });

  res.json({ ok: true, surat: updated });
});

// ---------- ALUR SURAT: APPROVE & TANDA TANGAN OTOMATIS (KEPALA BIDANG) ----------
app.post("/api/surat/:id/approve", requireAuth, requireKepalaBidang, async (req, res) => {
  const user = req.session.user;
  const surat = await store.getHistoryById(req.params.id);
  if (!surat) {
    return res.status(404).json({ error: "Surat tidak ditemukan" });
  }

  if (surat.status === "SUDAH_DITANDATANGANI") {
    return res.status(400).json({ error: "Surat ini sudah disetujui dan ditandatangani sebelumnya." });
  }

  if (surat.status !== "MENUNGGU_TTD") {
    return res.status(400).json({ error: `Surat dengan status ${surat.status} tidak dapat disetujui. Surat harus berstatus MENUNGGU_TTD.` });
  }

  try {
    const { verifierName, checklist } = req.body || {};
    const finalSigner = (verifierName && String(verifierName).trim()) || user.name;

    const rawData = surat.data || {};
    const templateData = {
      nomor_surat: surat.nomor_surat,
      tempat_surat: rawData.tempat_surat || "Bandar Lampung",
      tanggal: surat.tanggal,
      sifat: rawData.sifat || "Biasa",
      lampiran: rawData.lampiran || "-",
      hal: surat.hal,
      tujuan: surat.tujuan,
      lokasi_tujuan: rawData.lokasi_tujuan || "Bandar Lampung",
      isi_surat: rawData.isi_surat || "",
      jabatan_penandatangan: surat.jabatanPenandatangan || rawData.jabatan_penandatangan || "Kepala Bidang",
      nama_penandatangan: surat.namaPenandatangan || rawData.nama_penandatangan || finalSigner,
      nip_penandatangan: surat.nipPenandatangan || rawData.nip_penandatangan || "-",
    };

    // 1. Bangkitkan Token Verifikasi Unik & URL Verifikasi Internal
    const verificationToken = crypto.randomUUID();
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const verificationUrl = `${baseUrl.replace(/\/+$/, "")}/#/verify/${verificationToken}`;

    // 2. Buat Buffer Gambar QR Code & Data URL
    const qrImageBuffer = await generateQrCodeBuffer(verificationUrl);
    const qrDataUrl = `data:image/png;base64,${qrImageBuffer.toString("base64")}`;

    // 3. Generate PDF Final menggunakan Chromium
    const finalPdfBytes = await generateSuratPdf(templateData, {
      qrDataUrl,
      verificationUrl,
      isDraft: false,
    });

    const finalPdfName = `Surat_Rekomendasi_Signed_${Date.now()}.pdf`;
    const finalPdfPath = path.join(OUTPUT_DIR, finalPdfName);
    try {
      fs.writeFileSync(finalPdfPath, finalPdfBytes);
    } catch (writeErr) {
      console.warn("⚠️ Gagal menulis file PDF ke disk lokal:", writeErr.message);
    }

    // 4. Hitung SHA-256 Hash File Final
    const fileHash = calculateSha256(finalPdfBytes);

    // 6. Upload File Final ke Google Drive folder resmi jika terhubung
    let driveResult = null;
    try {
      driveResult = await uploadPdfToDrive(finalPdfPath, finalPdfName, getSignedFolderId());
    } catch (dErr) {
      console.warn("⚠️ [Drive Upload] Gagal upload ke drive:", dErr.message);
    }

    // 7. Kunci Status Menjadi SUDAH_DITANDATANGANI
    const signedAt = new Date().toISOString();
    const updatedData = {
      ...(surat.data || {}),
      verifier_name: finalSigner,
      verified_at: signedAt,
      verification_checklist: Array.isArray(checklist) ? checklist : [],
    };
    const updated = await store.updateHistoryEntry(surat.id, {
      status: "SUDAH_DITANDATANGANI",
      signedBy: finalSigner,
      signedAt,
      verificationToken,
      fileHash,
      pdfFilename: finalPdfName,
      driveUrl: driveResult ? driveResult.webViewLink : surat.driveUrl,
      driveFileId: driveResult ? driveResult.fileId : surat.driveFileId,
      alasanPenolakan: null,
      data: updatedData,
    });

    res.json({
      ok: true,
      message: "Surat berhasil disetujui dan ditandatangani secara elektronik.",
      surat: updated,
    });
  } catch (err) {
    console.error("❌ [APPROVE ERROR]:", err);
    res.status(500).json({ error: "Gagal memproses tanda tangan surat", details: err.message });
  }
});

// ---------- ALUR SURAT: REJECT DENGAN ALASAN WAJIB (KEPALA BIDANG) ----------
app.post("/api/surat/:id/reject", requireAuth, requireKepalaBidang, async (req, res) => {
  const { alasan } = req.body;
  if (!alasan || String(alasan).trim() === "") {
    return res.status(400).json({ error: "Alasan penolakan wajib diisi" });
  }

  const surat = await store.getHistoryById(req.params.id);
  if (!surat) {
    return res.status(404).json({ error: "Surat tidak ditemukan" });
  }

  if (surat.status === "SUDAH_DITANDATANGANI") {
    return res.status(400).json({ error: "Surat yang sudah ditandatangani tidak dapat ditolak." });
  }

  const updated = await store.updateHistoryEntry(surat.id, {
    status: "DITOLAK",
    alasanPenolakan: alasan.trim(),
    rejectedBy: req.session.user.name,
    rejectedAt: new Date().toISOString(),
  });

  res.json({
    ok: true,
    message: "Surat berhasil ditolak dan dikembalikan ke operator.",
    surat: updated,
  });
});

// ---------- DISTRIBUSI SURAT & SURAT MASUK ANTAR-CABANG ----------
app.post("/api/surat/:id/forward", requireAuth, async (req, res) => {
  const { targetBranchId, targetBranchIds, catatan } = req.body;
  const user = req.session.user;

  const surat = await store.getHistoryById(req.params.id);
  if (!surat) {
    return res.status(404).json({ error: "Surat tidak ditemukan" });
  }

  if (surat.status !== "SUDAH_DITANDATANGANI") {
    return res.status(400).json({ error: "Hanya surat yang sudah ditandatangani resmi yang dapat diteruskan ke cabang lain." });
  }

  const targets = Array.isArray(targetBranchIds) && targetBranchIds.length > 0
    ? targetBranchIds
    : (targetBranchId ? [targetBranchId] : []);

  if (targets.length === 0) {
    return res.status(400).json({ error: "Pilih setidaknya satu cabang tujuan" });
  }

  const results = [];
  for (const tId of targets) {
    const dist = await store.distributeSurat({
      suratId: surat.id,
      sourceBranchId: user.branchId || surat.branchId || null,
      targetBranchId: tId,
      sentByUserId: user.id,
      sentByName: user.name,
      catatan,
    });
    results.push(dist);
  }

  res.json({
    ok: true,
    message: `Surat berhasil diteruskan ke ${results.length} cabang tujuan.`,
    distributions: results,
  });
});

app.get("/api/surat-masuk", requireAuth, async (req, res) => {
  const user = req.session.user;
  const targetBranchId = user.role === "superadmin" ? (req.query.branchId || null) : (user.branchId || null);
  const search = (req.query.search || "").toLowerCase().trim();

  let incoming = await store.getIncomingSurat(targetBranchId);

  if (search) {
    incoming = incoming.filter((item) => {
      const s = item.surat || {};
      return (
        (s.nomor_surat && s.nomor_surat.toLowerCase().includes(search)) ||
        (s.hal && s.hal.toLowerCase().includes(search)) ||
        (item.sourceBranchName && item.sourceBranchName.toLowerCase().includes(search)) ||
        (item.sentByName && item.sentByName.toLowerCase().includes(search))
      );
    });
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const totalItems = incoming.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (currentPage - 1) * limit;
  const paginated = incoming.slice(startIndex, startIndex + limit);

  res.json({
    incoming: paginated,
    pagination: {
      page: currentPage,
      limit,
      totalItems,
      totalPages,
    },
  });
});

app.post("/api/surat-masuk/:id/read", requireAuth, async (req, res) => {
  const result = await store.markSuratMasukAsRead(req.params.id);
  res.json({ ok: true, ...result });
});

// ---------- VERIFIKASI DOKUMEN PUBLIK (QR SCAN / TOKEN TANPA PERLU LOGIN) ----------
app.get("/api/verify/:token", async (req, res) => {
  const token = req.params.token;
  if (!token) {
    return res.status(400).json({ valid: false, error: "Token verifikasi tidak valid" });
  }

  const surat = await store.findHistoryByToken(token);
  if (!surat || surat.status !== "SUDAH_DITANDATANGANI") {
    return res.status(404).json({
      valid: false,
      error: "Dokumen tidak ditemukan atau belum ditandatangani secara sah oleh pejabat berwenang.",
    });
  }

  res.json({
    valid: true,
    id: surat.id,
    nomor_surat: surat.nomor_surat,
    hal: surat.hal,
    tujuan: surat.tujuan,
    tanggal: surat.tanggal,
    status: surat.status,
    dibuat_oleh: surat.dibuatOleh,
    branch_name: surat.branchName,
    signed_at: surat.signedAt,
    verifier_name: (surat.data && surat.data.verifier_name) || surat.signedBy,
    drive_url: surat.driveUrl,
    pdf_filename: surat.pdfFilename,
    created_at: surat.createdAt,
  });
});

// ---------- DOWNLOAD & PREVIEW PDF ----------
app.get("/api/surat/:id/download", async (req, res) => {
  const surat = await store.getHistoryById(req.params.id);
  if (!surat) {
    return res.status(404).json({ error: "Surat tidak ditemukan" });
  }

  // Jika surat belum ditandatangani resmi, hanya bisa diakses user yang login
  if (surat.status !== "SUDAH_DITANDATANGANI" && !req.user) {
    return res.status(401).json({ error: "Perlu login untuk melihat pratinjau draft surat" });
  }

  // Jika file PDF final ada di disk/cache server
  if (surat.pdfFilename) {
    const filePath = path.join(OUTPUT_DIR, surat.pdfFilename);
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${surat.pdfFilename}"`);
      return res.sendFile(filePath);
    }
  }

  // Jika tidak ada di disk atau masih DRAFT/MENUNGGU_TTD, generate on-the-fly PDF
  try {
    const rawData = surat.data || {};
    const templateData = {
      nomor_surat: surat.nomor_surat,
      tempat_surat: rawData.tempat_surat || "Bandar Lampung",
      tanggal: surat.tanggal,
      sifat: rawData.sifat || "Biasa",
      lampiran: rawData.lampiran || "-",
      hal: surat.hal,
      tujuan: surat.tujuan,
      lokasi_tujuan: rawData.lokasi_tujuan || "Bandar Lampung",
      isi_surat: rawData.isi_surat || "",
      jabatan_penandatangan: surat.jabatanPenandatangan || rawData.jabatan_penandatangan || "Kepala Bidang",
      nama_penandatangan: surat.namaPenandatangan || rawData.nama_penandatangan || "Penandatangan",
      nip_penandatangan: surat.nipPenandatangan || rawData.nip_penandatangan || "-",
    };

    let qrDataUrl = null;
    let verificationUrl = null;
    if (surat.status === "SUDAH_DITANDATANGANI" && surat.verificationToken) {
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      verificationUrl = `${baseUrl.replace(/\/+$/, "")}/#/verify/${surat.verificationToken}`;
      const qrBuf = await generateQrCodeBuffer(verificationUrl);
      qrDataUrl = `data:image/png;base64,${qrBuf.toString("base64")}`;
    }

    const isDraft = surat.status !== "SUDAH_DITANDATANGANI";
    const pdfBuf = await generateSuratPdf(templateData, {
      qrDataUrl,
      verificationUrl,
      isDraft,
    });

    const pdfName = surat.pdfFilename || (isDraft ? `Draft_${surat.id.slice(0, 8)}.pdf` : `Surat_${surat.id.slice(0, 8)}.pdf`);
    const isDownload = req.query.download === "1" || req.query.download === "true";
    const disposition = isDownload ? "attachment" : "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${pdfName}"`);
    return res.send(pdfBuf);
  } catch (err) {
    console.error("Gagal membuat PDF:", err);
    res.status(500).json({ error: "Gagal membuat file PDF", details: err.message });
  }
});

// Global error handling middleware untuk menangkap error async/database
app.use((err, req, res, next) => {
  console.error("❌ [API Exception]:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: err.message || "Terjadi kesalahan internal server",
    code: err.code || "INTERNAL_SERVER_ERROR",
  });
});

// Static frontend serving (hanya untuk mode standalone lokal tanpa Vercel)
const distPath = path.join(__dirname, "../frontend/dist");
const frontendPath = fs.existsSync(distPath) ? distPath : path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// Fallback untuk Single Page Application (React)
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/oauth2callback")) {
    return next();
  }
  const indexPath = path.join(frontendPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Ekspor app untuk Vercel Serverless Function handler
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}
