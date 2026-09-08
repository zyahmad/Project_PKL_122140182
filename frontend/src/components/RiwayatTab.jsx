import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getHistory, deleteHistory, sendSurat, getPdfDownloadUrl, getBranches, forwardSurat } from '../utils/api'

export default function RiwayatTab({ user, onEditLetter, onOpenVerify }) {
  const [history, setHistory] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalItems: 0, totalPages: 1, limit: 10 })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Forward Modal State
  const [forwardModalOpen, setForwardModalOpen] = useState(false)
  const [selectedLetterForForward, setSelectedLetterForForward] = useState(null)
  const [branches, setBranches] = useState([])
  const [forwardTargetBranches, setForwardTargetBranches] = useState([])
  const [forwardCatatan, setForwardCatatan] = useState('')
  const [forwarding, setForwarding] = useState(false)

  const load = useCallback(async (page = 1, currentStatus = statusFilter) => {
    setLoading(true)
    try {
      const data = await getHistory(page, 10, currentStatus)
      setHistory(data.history || [])
      setPagination(data.pagination || { page: 1, totalItems: 0, totalPages: 1, limit: 10 })
    } catch (err) {
      console.error('Gagal memuat riwayat:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load(1, statusFilter)
  }, [load, statusFilter])

  const handleOpenForward = async (letter) => {
    setSelectedLetterForForward(letter)
    setForwardCatatan('')
    setForwardTargetBranches([])
    setForwardModalOpen(true)
    try {
      const bList = await getBranches()
      // Exclude current branch if set, or let user pick any target branch
      setBranches(bList)
    } catch (err) {
      console.error('Gagal mengambil daftar cabang:', err)
    }
  }

  const handleToggleBranch = (branchId) => {
    setForwardTargetBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    )
  }

  const handleSelectAllBranches = () => {
    if (forwardTargetBranches.length === branches.length) {
      setForwardTargetBranches([])
    } else {
      setForwardTargetBranches(branches.map((b) => b.id))
    }
  }

  const handleExecuteForward = async () => {
    if (forwardTargetBranches.length === 0) {
      alert('Silakan pilih minimal satu cabang penerima.')
      return
    }
    setForwarding(true)
    try {
      await forwardSurat(selectedLetterForForward.id, {
        targetBranchIds: forwardTargetBranches,
        catatan: forwardCatatan,
      })
      alert(`Surat ${selectedLetterForForward.nomor_surat} berhasil diteruskan ke ${forwardTargetBranches.length} cabang.`)
      setForwardModalOpen(false)
      setSelectedLetterForForward(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setForwarding(false)
    }
  }

  const handleDelete = async (id, nomor) => {
    if (!confirm(`Hapus entri surat:\n${nomor || id}?`)) return
    try {
      await deleteHistory(id)
      load(pagination.page, statusFilter)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSendDraft = async (surat) => {
    if (!confirm(`Kirim surat ${surat.nomor_surat} kepada Kepala Bidang untuk verifikasi tanda tangan?`)) return
    setActionLoading(true)
    try {
      await sendSurat(surat.id)
      alert(`Surat ${surat.nomor_surat} berhasil dikirim ke Kepala Bidang.`)
      load(pagination.page, statusFilter)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const canDelete = (h) => {
    if (h.status === 'SUDAH_DITANDATANGANI') {
      return user.role === 'superadmin'
    }
    return user.role === 'superadmin' || user.role === 'admin' || h.userId === user.id
  }

  const canEdit = (h) => {
    return (h.status === 'DRAFT' || h.status === 'DITOLAK') && (user.role === 'admin' || user.role === 'superadmin')
  }

  const renderStatusBadge = (h) => {
    switch (h.status) {
      case 'DRAFT':
        return <span className="badge badge-staff">DRAFT</span>
      case 'MENUNGGU_TTD':
        return <span className="badge badge-superadmin" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04' }}>MENUNGGU TTD</span>
      case 'DITOLAK':
        return <span className="badge" style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }}>DITOLAK</span>
      case 'SUDAH_DITANDATANGANI':
        return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>SUDAH DITANDATANGANI</span>
      default:
        return <span className="badge badge-staff">{h.status || 'DRAFT'}</span>
    }
  }

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history
    const q = searchTerm.toLowerCase()
    return history.filter((h) =>
      (h.nomor_surat && h.nomor_surat.toLowerCase().includes(q)) ||
      (h.hal && h.hal.toLowerCase().includes(q)) ||
      (h.tujuan && h.tujuan.toLowerCase().includes(q)) ||
      (h.dibuatOleh && h.dibuatOleh.toLowerCase().includes(q)) ||
      (h.namaPenandatangan && h.namaPenandatangan.toLowerCase().includes(q))
    )
  }, [history, searchTerm])

  const startItem = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
  const endItem = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="glass form-card">
      <div className="card-header">
        <div className="card-header-left">
          <h2>Daftar & Riwayat Surat</h2>
          <p>Seluruh surat rekomendasi resmi beserta status verifikasi dan tanda tangan elektronik.</p>
        </div>
        <div className="card-header-right">
          <select
            className="select"
            style={{ padding: '6px 10px', fontSize: 13 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="MENUNGGU_TTD">Menunggu TTD</option>
            <option value="DITOLAK">Ditolak</option>
            <option value="SUDAH_DITANDATANGANI">Sudah Ditandatangani</option>
          </select>

          <input
            type="text"
            className="history-search-input"
            placeholder="Cari nomor, hal, tujuan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="badge badge-staff">
            Total: {pagination.totalItems} Surat
          </span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Memuat data riwayat...</div>
      ) : history.length === 0 ? (
        <div className="empty-state">Belum ada surat yang terdaftar.</div>
      ) : filteredHistory.length === 0 ? (
        <div className="empty-state">Tidak ada surat yang cocok dengan pencarian "{searchTerm}".</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table-history">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Nomor Surat</th>
                  <th style={{ minWidth: '170px' }}>Hal / Perihal</th>
                  <th style={{ minWidth: '150px' }}>Tujuan</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '130px' }}>Pembuat / TTD</th>
                  <th style={{ width: '100px' }}>Tanggal</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <span className="nomor-surat-pill">{h.nomor_surat}</span>
                      {h.status === 'DITOLAK' && h.alasanPenolakan && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-danger)', marginTop: '4px', maxWidth: '210px' }}>
                          Catatan: {h.alasanPenolakan}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-hal">{h.hal || '-'}</div>
                    </td>
                    <td>
                      <div className="text-tujuan">{h.tujuan || '-'}</div>
                    </td>
                    <td>
                      {renderStatusBadge(h)}
                    </td>
                    <td>
                      <span className="badge badge-staff">{h.dibuatOleh || 'Operator'}</span>
                      {h.namaPenandatangan && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          TTD: {h.namaPenandatangan}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="date-text">{h.tanggal}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {h.status === 'SUDAH_DITANDATANGANI' ? (
                          <>
                            <a
                              href={getPdfDownloadUrl(h.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              title="Buka dan baca surat resmi di tab baru"
                            >
                              👁️ Buka PDF
                            </a>
                            <a
                              href={getPdfDownloadUrl(h.id, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              title="Unduh file PDF resmi ke komputer"
                            >
                              ⬇️ Unduh
                            </a>
                            {h.driveUrl && (
                              <a
                                href={h.driveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="badge-drive"
                                title="Buka berkas surat resmi di Google Drive"
                              >
                                ☁️ Google Drive
                              </a>
                            )}
                            {h.verificationToken && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => onOpenVerify && onOpenVerify(h.verificationToken)}
                                title="Cek status verifikasi QR"
                              >
                                Verifikasi
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--emerald-400)', borderColor: 'rgba(52, 211, 153, 0.3)' }}
                              onClick={() => handleOpenForward(h)}
                              title="Teruskan surat ke cabang lain"
                            >
                              📤 Teruskan
                            </button>
                          </>
                        ) : h.status === 'DRAFT' ? (
                          <>
                            <a
                              href={getPdfDownloadUrl(h.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              title="Pratinjau draft surat"
                            >
                              👁️ Pratinjau
                            </a>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={actionLoading}
                              onClick={() => handleSendDraft(h)}
                              title="Kirim draft ke Kepala Bidang"
                            >
                              Kirim
                            </button>
                            {canEdit(h) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => onEditLetter && onEditLetter(h)}
                                title="Edit data draft"
                              >
                                Edit
                              </button>
                            )}
                          </>
                        ) : h.status === 'DITOLAK' ? (
                          <>
                            <a
                              href={getPdfDownloadUrl(h.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              title="Pratinjau surat yang ditolak"
                            >
                              👁️ Pratinjau
                            </a>
                            {canEdit(h) && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => onEditLetter && onEditLetter(h)}
                                title="Buka form untuk memperbaiki surat"
                              >
                                Perbaiki
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <a
                              href={getPdfDownloadUrl(h.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              title="Buka pratinjau PDF"
                            >
                              👁️ Pratinjau
                            </a>
                            {h.draftDriveUrl && (
                              <a
                                href={h.draftDriveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="badge-drive"
                                style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                                title="Buka berkas draft di Google Drive"
                              >
                                ☁️ Drive Draft
                              </a>
                            )}
                          </>
                        )}

                        {canDelete(h) && (
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDelete(h.id, h.nomor_surat)}
                            title="Hapus surat"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Menampilkan {startItem}-{endItem} dari {pagination.totalItems} surat
              </div>
              <div className="pagination-nav">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => load(pagination.page - 1, statusFilter)}
                >
                  ‹ Sebelumnya
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`btn btn-ghost btn-sm ${p === pagination.page ? 'active-page' : ''}`}
                    onClick={() => load(p, statusFilter)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => load(pagination.page + 1, statusFilter)}
                >
                  Selanjutnya ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Teruskan Surat ke Cabang */}
      {forwardModalOpen && selectedLetterForForward && createPortal(
        <div className="modal-overlay" onClick={() => !forwarding && setForwardModalOpen(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                📤 Teruskan Surat ke Cabang Lain
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px', fontSize: '16px' }}
                onClick={() => !forwarding && setForwardModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--emerald-400)', fontFamily: 'monospace' }}>
                {selectedLetterForForward.nomor_surat}
              </div>
              <div style={{ color: 'var(--text-primary)', marginTop: '4px', fontWeight: 500 }}>
                {selectedLetterForForward.hal}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                Tujuan Asli: {selectedLetterForForward.tujuan || '-'} · Tanggal: {selectedLetterForForward.tanggal}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pilih Cabang Tujuan ({forwardTargetBranches.length} terpilih):
                </label>
                {branches.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11.5px', padding: '2px 6px' }}
                    onClick={handleSelectAllBranches}
                  >
                    {forwardTargetBranches.length === branches.length ? 'Batal Semua' : 'Pilih Semua'}
                  </button>
                )}
              </div>

              {branches.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Memuat daftar cabang...</div>
              ) : (
                <div
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '8px',
                    background: 'var(--input-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {branches.map((b) => {
                    const isChecked = forwardTargetBranches.includes(b.id)
                    return (
                      <label
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                          transition: 'background 0.15s ease',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleBranch(b.id)}
                          style={{ accentColor: 'var(--emerald-500)', cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--emerald-400)' : 'var(--text-primary)' }}>
                          {b.name}
                        </span>
                        {b.code && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {b.code}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Catatan Pengiriman (Opsional):
              </label>
              <textarea
                className="input"
                rows="3"
                placeholder="Contoh: Mohon dipelajari salinan keputusan terlampir untuk tindak lanjut cabang."
                value={forwardCatatan}
                onChange={(e) => setForwardCatatan(e.target.value)}
                style={{ width: '100%', resize: 'vertical', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={forwarding}
                onClick={() => setForwardModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={forwarding || forwardTargetBranches.length === 0}
                onClick={handleExecuteForward}
              >
                {forwarding ? 'Mengirim...' : `Kirim ke ${forwardTargetBranches.length} Cabang`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
