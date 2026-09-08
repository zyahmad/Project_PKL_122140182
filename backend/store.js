const crypto = require("crypto");
const supabase = require("./db");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toUuidOrNull(val) {
  if (!val || typeof val !== "string") return null;
  return UUID_REGEX.test(val.trim()) ? val.trim() : null;
}

// ---------- Branches (Supabase Pure) ----------
async function getBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ [Supabase getBranches error]:", error.message);
    throw new Error(`Gagal mengambil data cabang dari Supabase: ${error.message}`);
  }
  return data || [];
}

async function getBranchMap() {
  const branches = await getBranches();
  const map = {};
  for (const b of branches) {
    if (b.id) map[b.id] = b.name;
    if (b.code) map[b.code] = b.name;
  }
  return map;
}

// ---------- Users (Supabase Pure) ----------
function mapUserRecord(u, branchMap = {}) {
  const bName = u.branches?.name || (u.branch_id ? branchMap[u.branch_id] : null) || "Kota Bandar Lampung";
  return {
    id: u.id,
    username: u.username,
    passwordHash: u.password_hash,
    name: u.name,
    role: u.role,
    branchId: u.branch_id,
    branchName: bName,
    signatoryId: u.signatory_id,
    createdAt: u.created_at,
  };
}

async function getUsers() {
  const branchMap = await getBranchMap();
  const { data, error } = await supabase
    .from("users")
    .select("*, branches(name, code)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ [Supabase getUsers error]:", error.message);
    throw new Error(`Gagal mengambil data pengguna dari Supabase: ${error.message}`);
  }
  return (data || []).map((u) => mapUserRecord(u, branchMap));
}

async function findUserByUsername(username) {
  const branchMap = await getBranchMap();
  const { data, error } = await supabase
    .from("users")
    .select("*, branches(name, code)")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("❌ [Supabase findUserByUsername error]:", error.message);
    throw new Error(`Gagal mencari pengguna dari Supabase: ${error.message}`);
  }
  if (!data) return null;
  return mapUserRecord(data, branchMap);
}

async function addUser(user) {
  const branchMap = await getBranchMap();
  const branchIdUuid = toUuidOrNull(user.branchId);
  const signatoryIdUuid = toUuidOrNull(user.signatoryId);
  const userIdUuid = toUuidOrNull(user.id) || crypto.randomUUID();

  const { data, error } = await supabase
    .from("users")
    .insert({
      id: userIdUuid,
      username: user.username,
      password_hash: user.passwordHash,
      name: user.name,
      role: user.role || "admin",
      branch_id: branchIdUuid,
      signatory_id: signatoryIdUuid,
      created_at: user.createdAt || new Date().toISOString(),
    })
    .select("*, branches(name, code)")
    .single();

  if (error) {
    console.error("❌ [Supabase addUser error]:", error.message);
    throw new Error(`Gagal menambahkan pengguna ke Supabase: ${error.message}`);
  }

  return mapUserRecord(data, branchMap);
}

async function deleteUser(id) {
  const uuidVal = toUuidOrNull(id);
  if (!uuidVal) {
    throw new Error("ID pengguna tidak valid");
  }
  const { error } = await supabase.from("users").delete().eq("id", uuidVal);
  if (error) {
    console.error("❌ [Supabase deleteUser error]:", error.message);
    throw new Error(`Gagal menghapus pengguna dari Supabase: ${error.message}`);
  }
}

// ---------- History & Surat (Supabase Pure) ----------
function mapHistoryRecord(h) {
  return {
    id: h.id,
    jenisSurat: h.jenis_surat || "Surat Rekomendasi",
    nomor_surat: h.nomor_surat,
    hal: h.hal,
    tujuan: h.tujuan,
    tanggal: h.tanggal,
    status: h.status || "DRAFT",
    dibuatOleh: h.dibuat_oleh,
    userId: h.user_id,
    branchId: h.branch_id,
    branchName: h.branches ? h.branches.name : (h.branchName || "-"),
    signatoryId: h.signatory_id,
    jabatanPenandatangan: h.jabatan_penandatangan || (h.data?.jabatan_penandatangan),
    namaPenandatangan: h.nama_penandatangan || (h.data?.nama_penandatangan),
    nipPenandatangan: h.nip_penandatangan || (h.data?.nip_penandatangan),
    alasanPenolakan: h.alasan_penolakan || null,
    rejectedBy: h.rejected_by || null,
    rejectedAt: h.rejected_at || null,
    signedBy: h.signed_by || null,
    signedAt: h.signed_at || null,
    verificationToken: h.verification_token || null,
    fileHash: h.file_hash || null,
    pdfFilename: h.pdf_filename || null,
    driveUrl: h.drive_url || null,
    driveFileId: h.drive_file_id || null,
    createdAt: h.created_at,
    updatedAt: h.updated_at || h.created_at,
    data: h.data || {},
  };
}

async function getHistory() {
  const { data, error } = await supabase
    .from("history")
    .select("*, branches(name, code)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ [Supabase getHistory error]:", error.message);
    throw new Error(`Gagal mengambil riwayat surat dari Supabase: ${error.message}`);
  }
  return (data || []).map(mapHistoryRecord);
}

async function getHistoryById(id) {
  const uuidVal = toUuidOrNull(id);
  if (!uuidVal) return null;

  const { data, error } = await supabase
    .from("history")
    .select("*, branches(name, code)")
    .eq("id", uuidVal)
    .maybeSingle();

  if (error) {
    console.error("❌ [Supabase getHistoryById error]:", error.message);
    throw new Error(`Gagal mengambil surat dari Supabase: ${error.message}`);
  }
  return data ? mapHistoryRecord(data) : null;
}

async function findHistoryByToken(token) {
  if (!token) return null;
  const { data, error } = await supabase
    .from("history")
    .select("*, branches(name, code)")
    .eq("verification_token", token)
    .maybeSingle();

  if (error) {
    console.error("❌ [Supabase findHistoryByToken error]:", error.message);
    throw new Error(`Gagal memverifikasi token dari Supabase: ${error.message}`);
  }
  return data ? mapHistoryRecord(data) : null;
}

async function addHistoryEntry(entry) {
  let userIdUuid = toUuidOrNull(entry.userId);
  let branchIdUuid = toUuidOrNull(entry.branchId);
  let sigIdUuid = toUuidOrNull(entry.signatoryId);

  // Verifikasi foreign key agar tidak melanggar foreign key constraint di PostgreSQL
  if (userIdUuid) {
    const { data: u } = await supabase.from("users").select("id").eq("id", userIdUuid).maybeSingle();
    if (!u) userIdUuid = null;
  }
  if (branchIdUuid) {
    const { data: b } = await supabase.from("branches").select("id").eq("id", branchIdUuid).maybeSingle();
    if (!b) branchIdUuid = null;
  }
  if (sigIdUuid) {
    const { data: s } = await supabase.from("signatories").select("id").eq("id", sigIdUuid).maybeSingle();
    if (!s) sigIdUuid = null;
  }

  const normalized = {
    id: toUuidOrNull(entry.id) || crypto.randomUUID(),
    jenis_surat: entry.jenisSurat || "Surat Rekomendasi",
    nomor_surat: entry.nomor_surat,
    hal: entry.hal,
    tujuan: entry.tujuan,
    tanggal: entry.tanggal,
    status: entry.status || "DRAFT",
    dibuat_oleh: entry.dibuatOleh,
    user_id: userIdUuid,
    branch_id: branchIdUuid,
    signatory_id: sigIdUuid,
    jabatan_penandatangan: entry.jabatanPenandatangan || entry.data?.jabatan_penandatangan || null,
    nama_penandatangan: entry.namaPenandatangan || entry.data?.nama_penandatangan || null,
    nip_penandatangan: entry.nipPenandatangan || entry.data?.nip_penandatangan || null,
    alasan_penolakan: entry.alasanPenolakan || null,
    rejected_by: entry.rejectedBy || null,
    rejected_at: entry.rejectedAt || null,
    signed_by: entry.signedBy || null,
    signed_at: entry.signedAt || null,
    verification_token: entry.verificationToken || null,
    file_hash: entry.fileHash || null,
    pdf_filename: entry.pdfFilename || null,
    drive_url: entry.driveUrl || null,
    drive_file_id: entry.driveFileId || null,
    data: entry.data || {},
    created_at: entry.createdAt || new Date().toISOString(),
    updated_at: entry.updatedAt || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("history")
    .insert(normalized)
    .select("*, branches(name, code)")
    .single();

  if (error) {
    console.error("❌ [Supabase addHistoryEntry error]:", error);
    throw new Error(`Gagal menyimpan surat ke Supabase: ${error.message}`);
  }

  return mapHistoryRecord(data);
}

async function updateHistoryEntry(id, updates) {
  const uuidVal = toUuidOrNull(id);
  if (!uuidVal) {
    throw new Error("ID riwayat surat tidak valid");
  }

  const dbUpdates = {};
  if (updates.jenisSurat !== undefined) dbUpdates.jenis_surat = updates.jenisSurat;
  if (updates.nomor_surat !== undefined) dbUpdates.nomor_surat = updates.nomor_surat;
  if (updates.hal !== undefined) dbUpdates.hal = updates.hal;
  if (updates.tujuan !== undefined) dbUpdates.tujuan = updates.tujuan;
  if (updates.tanggal !== undefined) dbUpdates.tanggal = updates.tanggal;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.signatoryId !== undefined) dbUpdates.signatory_id = toUuidOrNull(updates.signatoryId);
  if (updates.branchId !== undefined) dbUpdates.branch_id = toUuidOrNull(updates.branchId);
  if (updates.jabatanPenandatangan !== undefined) dbUpdates.jabatan_penandatangan = updates.jabatanPenandatangan;
  if (updates.namaPenandatangan !== undefined) dbUpdates.nama_penandatangan = updates.namaPenandatangan;
  if (updates.nipPenandatangan !== undefined) dbUpdates.nip_penandatangan = updates.nipPenandatangan;
  if (updates.alasanPenolakan !== undefined) dbUpdates.alasan_penolakan = updates.alasanPenolakan;
  if (updates.rejectedBy !== undefined) dbUpdates.rejected_by = updates.rejectedBy;
  if (updates.rejectedAt !== undefined) dbUpdates.rejected_at = updates.rejectedAt;
  if (updates.signedBy !== undefined) dbUpdates.signed_by = updates.signedBy;
  if (updates.signedAt !== undefined) dbUpdates.signed_at = updates.signedAt;
  if (updates.verificationToken !== undefined) dbUpdates.verification_token = updates.verificationToken;
  if (updates.fileHash !== undefined) dbUpdates.file_hash = updates.fileHash;
  if (updates.pdfFilename !== undefined) dbUpdates.pdf_filename = updates.pdfFilename;
  if (updates.driveUrl !== undefined) dbUpdates.drive_url = updates.driveUrl;
  if (updates.driveFileId !== undefined) dbUpdates.drive_file_id = updates.driveFileId;
  if (updates.data !== undefined) dbUpdates.data = updates.data;
  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("history")
    .update(dbUpdates)
    .eq("id", uuidVal)
    .select("*, branches(name, code)")
    .single();

  if (error) {
    console.error("❌ [Supabase updateHistoryEntry error]:", error);
    throw new Error(`Gagal memperbarui riwayat surat di Supabase: ${error.message}`);
  }

  return mapHistoryRecord(data);
}

async function deleteHistoryEntry(id) {
  const uuidVal = toUuidOrNull(id);
  if (!uuidVal) return;

  const { error } = await supabase.from("history").delete().eq("id", uuidVal);
  if (error) {
    console.error("❌ [Supabase deleteHistoryEntry error]:", error.message);
    throw new Error(`Gagal menghapus riwayat surat dari Supabase: ${error.message}`);
  }
}

// ---------- Signatories (Supabase Pure) ----------
async function getSignatories(branchId = null) {
  let query = supabase.from("signatories").select("*, branches(name, code)").order("created_at");
  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("❌ [Supabase getSignatories error]:", error.message);
    throw new Error(`Gagal mengambil data penandatangan dari Supabase: ${error.message}`);
  }
  return (data || []).map((s) => ({
    id: s.id,
    jabatan: s.jabatan,
    nama: s.nama,
    nip: s.nip,
    branchId: s.branch_id,
    branchName: s.branches ? s.branches.name : null,
    createdAt: s.created_at,
  }));
}

async function addSignatory(entry) {
  const sigId = toUuidOrNull(entry.id) || crypto.randomUUID();
  const branchIdUuid = toUuidOrNull(entry.branchId);

  const { data, error } = await supabase
    .from("signatories")
    .insert({
      id: sigId,
      jabatan: entry.jabatan,
      nama: entry.nama,
      nip: entry.nip,
      branch_id: branchIdUuid,
      created_at: entry.createdAt || new Date().toISOString(),
    })
    .select("*, branches(name, code)")
    .single();

  if (error) {
    console.error("❌ [Supabase addSignatory error]:", error.message);
    throw new Error(`Gagal menambahkan penandatangan ke Supabase: ${error.message}`);
  }

  return {
    id: data.id,
    jabatan: data.jabatan,
    nama: data.nama,
    nip: data.nip,
    branchId: data.branch_id,
    branchName: data.branches ? data.branches.name : null,
    createdAt: data.created_at,
  };
}

async function deleteSignatory(id) {
  const uuidVal = toUuidOrNull(id);
  if (!uuidVal) return;

  const { error } = await supabase.from("signatories").delete().eq("id", uuidVal);
  if (error) {
    console.error("❌ [Supabase deleteSignatory error]:", error.message);
    throw new Error(`Gagal menghapus penandatangan dari Supabase: ${error.message}`);
  }
}

// ---------- Surat Distributions (Supabase Pure) ----------
async function distributeSurat({ suratId, sourceBranchId, targetBranchId, sentByUserId, sentByName, catatan }) {
  const distId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("surat_distributions")
    .insert({
      id: distId,
      surat_id: toUuidOrNull(suratId),
      source_branch_id: toUuidOrNull(sourceBranchId),
      target_branch_id: toUuidOrNull(targetBranchId),
      sent_by_user_id: toUuidOrNull(sentByUserId),
      sent_by_name: sentByName,
      catatan: catatan ? catatan.trim() : null,
      is_read: false,
      created_at: createdAt,
    })
    .select()
    .single();

  if (error) {
    console.error("❌ [Supabase distributeSurat error]:", error.message);
    throw new Error(`Gagal mendistribusikan surat di Supabase: ${error.message}`);
  }

  return data;
}

async function getIncomingSurat(targetBranchId = null) {
  const branchMap = await getBranchMap();

  let query = supabase
    .from("surat_distributions")
    .select(`
      id,
      surat_id,
      source_branch_id,
      target_branch_id,
      sent_by_user_id,
      sent_by_name,
      catatan,
      is_read,
      read_at,
      created_at,
      source_branch:source_branch_id(name, code),
      target_branch:target_branch_id(name, code),
      surat:surat_id(
        id,
        nomor_surat,
        hal,
        tujuan,
        tanggal,
        status,
        dibuat_oleh,
        jabatan_penandatangan,
        nama_penandatangan,
        nip_penandatangan,
        signed_by,
        signed_at,
        verification_token,
        file_hash,
        pdf_filename,
        drive_url,
        data
      )
    `)
    .order("created_at", { ascending: false });

  if (targetBranchId) {
    query = query.eq("target_branch_id", targetBranchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("❌ [Supabase getIncomingSurat error]:", error.message);
    throw new Error(`Gagal mengambil surat masuk dari Supabase: ${error.message}`);
  }

  return (data || []).map((d) => ({
    id: d.id,
    suratId: d.surat_id,
    sourceBranchId: d.source_branch_id,
    sourceBranchName: d.source_branch?.name || (d.source_branch_id ? branchMap[d.source_branch_id] : null) || "Kota Bandar Lampung",
    targetBranchId: d.target_branch_id,
    targetBranchName: d.target_branch?.name || (d.target_branch_id ? branchMap[d.target_branch_id] : null) || "Cabang",
    sentByUserId: d.sent_by_user_id,
    sentByName: d.sent_by_name,
    catatan: d.catatan,
    isRead: d.is_read,
    readAt: d.read_at,
    createdAt: d.created_at,
    surat: d.surat || null,
  }));
}

async function markSuratMasukAsRead(distributionId) {
  const readAt = new Date().toISOString();
  const uuidVal = toUuidOrNull(distributionId);
  if (!uuidVal) throw new Error("ID distribusi tidak valid");

  const { data, error } = await supabase
    .from("surat_distributions")
    .update({ is_read: true, read_at: readAt })
    .eq("id", uuidVal)
    .select()
    .single();

  if (error) {
    console.error("❌ [Supabase markSuratMasukAsRead error]:", error.message);
    throw new Error(`Gagal memperbarui status surat masuk di Supabase: ${error.message}`);
  }

  return { isRead: true, readAt };
}

module.exports = {
  getBranches,
  getUsers,
  findUserByUsername,
  addUser,
  deleteUser,
  getHistory,
  getHistoryById,
  findHistoryByToken,
  addHistoryEntry,
  updateHistoryEntry,
  deleteHistoryEntry,
  getSignatories,
  addSignatory,
  deleteSignatory,
  distributeSurat,
  getIncomingSurat,
  markSuratMasukAsRead,
};
