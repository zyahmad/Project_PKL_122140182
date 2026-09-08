import { useState, useEffect, useCallback } from 'react'
import { getSuratMasuk, getBranches, markSuratMasukRead, getPdfDownloadUrl } from '../utils/api'

export default function SuratMasukTab({ user, onOpenVerify }) {
  const [incoming, setIncoming] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({ page: 1, totalItems: 0, totalPages: 1, limit: 10 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user.role === 'superadmin') {
      getBranches()
        .then(setBranches)
        .catch((err) => console.error('Gagal memuat daftar cabang:', err))
    }
  }, [user.role])

  const loadData = useCallback(async (page = 1, search = searchTerm, branchId = selectedBranch) => {
    setLoading(true)
    try {
      const res = await getSuratMasuk(page, 10, search, branchId)
      setIncoming(res.incoming || [])
      setPagination(res.pagination || { page: 1, totalItems: 0, totalPages: 1, limit: 10 })
    } catch (err) {
      console.error('Gagal memuat surat masuk:', err)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, selectedBranch])

  useEffect(() => {
    loadData(1, searchTerm, selectedBranch)
  }, [loadData, searchTerm, selectedBranch])

  const handleMarkAsRead = async (item) => {
    if (item.isRead) return
    try {
      await markSuratMasukRead(item.id)
      setIncoming((prev) =>
        prev.map((d) => (d.id === item.id ? { ...d, isRead: true, readAt: new Date().toISOString() } : d))
      )
    } catch (err) {
      console.error('Gagal menandai dibaca:', err)
    }
  }

  const handleDownload = (item) => {
    handleMarkAsRead(item)
  }

  const handleVerify = (item) => {
    handleMarkAsRead(item)
    const token = item.surat?.verification_token || item.surat?.verificationToken
    if (token && onOpenVerify) {
      onOpenVerify(token)
    }
  }

  const formatDate = (isoStr) => {
    if (!isoStr) return '-'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  const startItem = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
  const endItem = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="glass form-card">
      <div className="card-header">
        <div className="card-header-left">
          <h2>Surat Masuk Antar-Cabang</h2>
          <p>
            Daftar surat resmi yang diteruskan dari cabang lain untuk ditinjau, diunduh, dan diverifikasi keasliannya.
          </p>
        </div>

        <div className="card-header-right">
          {user.role === 'superadmin' && (
            <select
              className="select"
              style={{ padding: '6px 10px', fontSize: 13 }}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="">Semua Cabang Penerima</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            className="history-search-input"
            placeholder="Cari nomor, hal, pengirim..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <span className="badge badge-staff">
            Total: {pagination.totalItems} Surat Masuk
          </span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Memuat data surat masuk...</div>
      ) : incoming.length === 0 ? (
        <div className="empty-state">
          {searchTerm || selectedBranch
            ? 'Tidak ada surat masuk yang sesuai dengan filter pencarian.'
            : 'Belum ada surat masuk untuk cabang ini.'}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table-history">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Nomor Surat & Status</th>
                  <th style={{ minWidth: '160px' }}>Asal & Pengirim</th>
                  <th style={{ minWidth: '180px' }}>Hal / Perihal</th>
                  <th style={{ width: '150px' }}>Penandatangan</th>
                  <th style={{ width: '140px' }}>Waktu Diterima</th>
                  <th style={{ minWidth: '160px' }}>Catatan Pengiriman</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody>
                {incoming.map((item) => {
                  const s = item.surat || {}
                  const isRead = item.isRead
                  const verificationToken = s.verification_token || s.verificationToken

                  return (
                    <tr key={item.id} style={{ background: !isRead ? 'rgba(52, 211, 153, 0.04)' : undefined }}>
                      <td>
                        <span className="nomor-surat-pill">{s.nomor_surat || '-'}</span>
                        <div style={{ marginTop: '5px' }}>
                          {!isRead ? (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(52, 211, 153, 0.18)',
                                color: 'var(--emerald-400)',
                                fontWeight: 700,
                                fontSize: '11px',
                              }}
                            >
                              ✉️ BARU
                            </span>
                          ) : (
                            <span
                              className="badge badge-staff"
                              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                            >
                              ✓ DIBACA
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.sourceBranchName || 'Kantor Pusat'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Oleh: {item.sentByName || 'Operator'}
                        </div>
                        {user.role === 'superadmin' && item.targetBranchName && (
                          <div style={{ fontSize: '11.5px', color: 'var(--emerald-400)', marginTop: '3px' }}>
                            Tujuan: {item.targetBranchName}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="text-hal">{s.hal || '-'}</div>
                        {s.tujuan && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                            Tujuan Asli: {s.tujuan}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, fontSize: '12.5px' }}>
                          {s.nama_penandatangan || s.namaPenandatangan || s.signed_by || s.signedBy || '-'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {s.jabatan_penandatangan || s.jabatanPenandatangan || 'Kepala Bidang'}
                        </div>
                      </td>

                      <td>
                        <div className="date-text">{formatDate(item.createdAt)}</div>
                        <div className="date-time">Surat: {s.tanggal || '-'}</div>
                      </td>

                      <td>
                        {item.catatan ? (
                          <div
                            style={{
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              color: 'var(--text-primary)',
                              maxWidth: '220px',
                              wordBreak: 'break-word',
                            }}
                          >
                            📝 {item.catatan}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <a
                            href={getPdfDownloadUrl(item.suratId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge-drive"
                            title="Unduh Salinan Resmi PDF"
                            onClick={() => handleDownload(item)}
                          >
                            Unduh PDF
                          </a>

                          {verificationToken && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleVerify(item)}
                              title="Cek keaslian dokumen via QR"
                            >
                              Verifikasi
                            </button>
                          )}

                          {!isRead && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '11.5px', padding: '3px 8px' }}
                              onClick={() => handleMarkAsRead(item)}
                              title="Tandai surat ini sudah dibaca"
                            >
                              Tandai Dibaca
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Menampilkan {startItem}-{endItem} dari {pagination.totalItems} surat masuk
              </div>
              <div className="pagination-nav">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadData(pagination.page - 1, searchTerm, selectedBranch)}
                >
                  ‹ Sebelumnya
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`btn btn-ghost btn-sm ${p === pagination.page ? 'active-page' : ''}`}
                    onClick={() => loadData(p, searchTerm, selectedBranch)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadData(pagination.page + 1, searchTerm, selectedBranch)}
                >
                  Selanjutnya ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

