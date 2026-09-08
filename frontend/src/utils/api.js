const BASE = '';
let cachedCsrfToken = null;

export async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch(BASE + '/api/csrf-token', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrfToken;
    }
  } catch (e) {
    console.warn('Gagal mengambil CSRF token:', e);
  }
  return cachedCsrfToken;
}

async function request(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  // Otomatis tempelkan CSRF Token pada request mutasi data (POST, PUT, DELETE, PATCH)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (!cachedCsrfToken) {
      await getCsrfToken();
    }
    if (cachedCsrfToken) {
      headers['X-CSRF-Token'] = cachedCsrfToken;
    }
  }

  let res = await fetch(BASE + url, {
    credentials: 'include',
    headers,
    ...options,
  });

  // Jika token expired / invalid, coba ambil token baru 1 kali dan ulangi request
  if (res.status === 403 && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const cloned = res.clone();
    try {
      const errData = await cloned.json();
      if (errData.code === 'INVALID_CSRF_TOKEN') {
        cachedCsrfToken = null;
        await getCsrfToken();
        if (cachedCsrfToken) {
          headers['X-CSRF-Token'] = cachedCsrfToken;
          res = await fetch(BASE + url, {
            credentials: 'include',
            headers,
            ...options,
          });
        }
      }
    } catch {}
  }

  return res;
}

export async function getMe() {
  const res = await request('/api/me');
  if (!res.ok) return null;
  const data = await res.json();
  if (data.csrfToken) cachedCsrfToken = data.csrfToken;
  return data.user;
}

export async function login(username, password) {
  const res = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Login gagal');
  }
  const data = await res.json();
  if (data.csrfToken) cachedCsrfToken = data.csrfToken;
  return data.user;
}

export async function logout() {
  await request('/api/logout', { method: 'POST' });
  cachedCsrfToken = null;
}

export async function getDriveStatus() {
  const res = await request('/api/drive-status');
  if (!res.ok) return { connected: false };
  return res.json();
}

export async function getBranches() {
  const res = await request('/api/branches');
  if (!res.ok) return [];
  const data = await res.json();
  return data.branches || [];
}

export async function getSignatories() {
  const res = await request('/api/signatories');
  if (!res.ok) return [];
  const data = await res.json();
  return data.signatories || [];
}

export async function addSignatory(payload) {
  const res = await request('/api/signatories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal menambah penandatangan');
  }
  return res.json();
}

export async function deleteSignatory(id) {
  await request(`/api/signatories/${id}`, { method: 'DELETE' });
}

export async function getNextNomor(kode = '07') {
  const res = await request(`/api/next-nomor?kode=${kode}`);
  if (!res.ok) return '';
  const data = await res.json();
  return data.nomor_surat || '';
}

export async function getHistory(page = 1, limit = 10, status = '') {
  let url = `/api/history?page=${page}&limit=${limit}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  const res = await request(url);
  if (!res.ok) return { history: [], pagination: {} };
  return res.json();
}

export async function getHistoryById(id) {
  const res = await request(`/api/history/${id}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Surat tidak ditemukan');
  }
  return res.json();
}

export async function deleteHistory(id) {
  const res = await request(`/api/history/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal menghapus');
  }
}

export async function getUsers() {
  const res = await request('/api/users');
  if (!res.ok) return [];
  const data = await res.json();
  return data.users || [];
}

export async function addUser(payload) {
  const res = await request('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal');
  }
  return res.json();
}

export async function deleteUser(id) {
  const res = await request(`/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal menghapus');
  }
}

// ---------- Surat Actions ----------
export async function saveDraft(data) {
  const res = await request('/api/surat/draft', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal menyimpan draft');
  }
  return res.json();
}

export async function sendSurat(id) {
  const res = await request(`/api/surat/${id}/send`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal mengirim surat ke Kepala Bidang');
  }
  return res.json();
}

export async function approveSurat(id, payload = {}) {
  const res = await request(`/api/surat/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal menyetujui surat');
  }
  return res.json();
}

export async function rejectSurat(id, alasan) {
  const res = await request(`/api/surat/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ alasan }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal menolak surat');
  }
  return res.json();
}

export async function verifyDocument(token) {
  const res = await request(`/api/verify/${token}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Dokumen tidak valid atau tidak ditemukan');
  }
  return res.json();
}

export function getPdfDownloadUrl(id) {
  return `/api/surat/${id}/download`;
}

// ---------- Distribusi Surat / Surat Masuk ----------
export async function forwardSurat(id, payload) {
  const res = await request(`/api/surat/${id}/forward`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Gagal meneruskan surat ke cabang');
  }
  return res.json();
}

export async function getSuratMasuk(page = 1, limit = 10, search = '', branchId = '') {
  let url = `/api/surat-masuk?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (branchId) url += `&branchId=${encodeURIComponent(branchId)}`;
  const res = await request(url);
  if (!res.ok) return { incoming: [], pagination: {} };
  return res.json();
}

export async function markSuratMasukRead(id) {
  const res = await request(`/api/surat-masuk/${id}/read`, {
    method: 'POST',
  });
  if (!res.ok) return null;
  return res.json();
}
