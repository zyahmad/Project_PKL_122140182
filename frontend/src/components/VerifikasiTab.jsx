import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getHistory, approveSurat, rejectSurat, getPdfDownloadUrl } from '../utils/api'

export default function VerifikasiTab({ user }) {
  const [letters, setLetters] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  // Modal Tolak
  const [selectedSurat, setSelectedSurat] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  // Modal Verifikasi & Setujui (Nama Verifikator & 1 Checklist Validasi)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [selectedSuratForApprove, setSelectedSuratForApprove] = useState(null)
  const [verifierName, setVerifierName] = useState('')
  const [isValidated, setIsValidated] = useState(false)

  const loadPendingLetters = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getHistory(1, 50, 'MENUNGGU_TTD')
      setLetters(data.history || [])
    } catch (err) {
      console.error('Gagal memuat surat verifikasi:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPendingLetters()
  }, [loadPendingLetters])

  // ---------- Modal Setujui (Approval) Handlers ----------
  const openApproveModal = (surat) => {
    setSelectedSuratForApprove(surat)
    setVerifierName(user?.name || '')
    setIsValidated(false)
    setShowApproveModal(true)
  }

  const closeApproveModal = () => {
    if (actionLoading) return
    setShowApproveModal(false)
    setSelectedSuratForApprove(null)
  }

  const isFormValid = isValidated && verifierName.trim().length > 0 && !actionLoading

  const handleApproveSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid || !selectedSuratForApprove) return

    setActionLoading(true)
    setMessage({ text: '', type: '' })
    try {
      await approveSurat(selectedSuratForApprove.id, {
        verifierName: verifierName.trim(),
      })

      setMessage({
        text: `Surat ${selectedSuratForApprove.nomor_surat} berhasil disetujui & ditandatangani secara elektronik oleh ${verifierName.trim()}. QR Code verifikasi aktif.`,
        type: 'success',
      })
      setShowApproveModal(false)
      setSelectedSuratForApprove(null)
      await loadPendingLetters()
    } catch (err) {
      alert(err.message || 'Gagal memproses persetujuan surat')
    } finally {
      setActionLoading(false)
    }
  }

  // ---------- Modal Tolak Handlers ----------
  const openRejectModal = (surat) => {
    setSelectedSurat(surat)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!rejectionReason.trim()) {
      alert('Alasan penolakan wajib diisi.')
      return
    }
    setActionLoading(true)
    try {
      await rejectSurat(selectedSurat.id, rejectionReason.trim())
      setShowRejectModal(false)
      setSelectedSurat(null)
      setMessage({
        text: `Surat ${selectedSurat.nomor_surat} telah ditolak dan dikembalikan ke operator.`,
        type: 'success',
      })
      await loadPendingLetters()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="glass form-card">
      <div className="card-header">
        <div className="card-header-left">
          <h2>Verifikasi & Persetujuan Tanda Tangan Surat</h2>
          <p>Daftar surat rekomendasi resmi yang menunggu verifikasi dan tanda tangan elektronik Kepala Bidang.</p>
        </div>
        <div className="card-header-right">
          <span className="badge badge-admin">
            Menunggu TTD: {letters.length} Surat
          </span>
        </div>
      </div>

      {message.text && (
        <div className={`status-msg ${message.type}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Memuat data surat...</div>
      ) : letters.length === 0 ? (
        <div className="empty-state">Tidak ada surat yang sedang menunggu verifikasi atau tanda tangan.</div>
      ) : (
        <div className="table-wrap">
          <table className="table-history">
            <thead>
              <tr>
                <th style={{ width: '220px' }}>Nomor Surat</th>
                <th style={{ minWidth: '180px' }}>Hal / Perihal</th>
                <th style={{ minWidth: '160px' }}>Tujuan</th>
                <th style={{ width: '130px' }}>Pembuat</th>
                <th style={{ width: '130px' }}>Tanggal</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Pratinjau</th>
                <th style={{ width: '180px', textAlign: 'center' }}>Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {letters.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="nomor-surat-pill">{s.nomor_surat}</span>
                  </td>
                  <td>
                    <div className="text-hal">{s.hal}</div>
                  </td>
                  <td>
                    <div className="text-tujuan">{s.tujuan}</div>
                  </td>
                  <td>
                    <span className="badge badge-staff">{s.dibuatOleh}</span>
                    {s.branchName && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.branchName}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="date-text">{s.tanggal}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <a
                      href={getPdfDownloadUrl(s.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      title="Buka pratinjau dokumen PDF"
                    >
                      Buka PDF
                    </a>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading}
                        onClick={() => openApproveModal(s)}
                        title="Verifikasi & setujui tanda tangan elektronik"
                      >
                        Setujui (TTD)
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionLoading}
                        onClick={() => openRejectModal(s)}
                        title="Tolak surat dengan alasan"
                      >
                        Tolak
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Verifikasi & Masukkan Nama Verifikator */}
      {showApproveModal && selectedSuratForApprove && createPortal(
        <div className="modal-overlay" onClick={closeApproveModal}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--glass-border)' }}>
              <div>
                <h2 style={{ fontSize: 17, color: 'var(--emerald-400)', margin: 0, fontWeight: 700 }}>
                  Verifikasi & Persetujuan Surat
                </h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Masukkan nama verifikator dan validasi naskah untuk tanda tangan elektronik resmi.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1, border: 'none', marginLeft: 8 }}
                onClick={closeApproveModal}
                disabled={actionLoading}
                title="Tutup Modal"
              >
                ✕
              </button>
            </div>

            {/* Ringkasan Surat */}
            <div
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                marginBottom: 18,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="nomor-surat-pill" style={{ fontWeight: 600 }}>
                  {selectedSuratForApprove.nomor_surat}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedSuratForApprove.tanggal}
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                <strong>Perihal:</strong> {selectedSuratForApprove.hal}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                <strong>Tujuan:</strong> {selectedSuratForApprove.tujuan}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                <strong>Dibuat Oleh:</strong> {selectedSuratForApprove.dibuatOleh}{' '}
                {selectedSuratForApprove.branchName ? `(${selectedSuratForApprove.branchName})` : ''}
              </div>
            </div>

            <form onSubmit={handleApproveSubmit}>
              {/* Input Nama Verifikator */}
              <div className="field" style={{ marginBottom: 20 }}>
                <label className="label" style={{ fontSize: 13.5, fontWeight: 700 }}>
                  Nama Petugas / Pejabat yang Memverifikasi{' '}
                  <span style={{ color: 'var(--text-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contoh: Drs. H. Ahmad Sudrajat, M.Ag"
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  autoFocus
                  required
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  Nama ini akan dicantumkan secara resmi dalam riwayat persetujuan dokumen dan audit trail integritas tanda tangan elektronik (QR Code).
                </div>
              </div>

              {/* 1 Checklist Validasi */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isValidated ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-border)'}`,
                  background: isValidated ? 'rgba(16, 185, 129, 0.08)' : 'var(--input-bg)',
                  cursor: 'pointer',
                  marginBottom: 22,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setIsValidated(!isValidated)}
              >
                <input
                  type="checkbox"
                  checked={isValidated}
                  onChange={() => {}} // dikontrol oleh onClick container
                  style={{
                    marginTop: 2,
                    cursor: 'pointer',
                    accentColor: 'var(--emerald-500)',
                    width: 17,
                    height: 17,
                  }}
                />
                <div style={{ flex: 1, userSelect: 'none', fontSize: 12.8, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: isValidated ? 'var(--emerald-400)' : 'var(--text-primary)' }}>
                    Saya telah memeriksa dan memvalidasi bahwa naskah surat ini telah lengkap, benar, dan sah untuk disetujui serta ditandatangani secara elektronik.
                  </span>
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeApproveModal}
                  disabled={actionLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!isFormValid}
                  title={
                    !verifierName.trim()
                      ? 'Masukkan nama verifikator'
                      : !isValidated
                      ? 'Centang checklist validasi dokumen terlebih dahulu'
                      : 'Setujui dan tanda tangani surat'
                  }
                >
                  {actionLoading ? 'Memproses Tanda Tangan...' : 'Setujui & Tanda Tangani'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Alasan Penolakan */}
      {showRejectModal && selectedSurat && createPortal(
        <div className="modal-overlay" onClick={() => !actionLoading && setShowRejectModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--glass-border)' }}>
              <div>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>Tolak Surat Rekomendasi</h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>Nomor: {selectedSurat.nomor_surat}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1, border: 'none' }}
                onClick={() => !actionLoading && setShowRejectModal(false)}
                title="Tutup Modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectSubmit}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="label">Alasan Penolakan (Wajib Diisi)</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 90 }}
                  placeholder="Tuliskan catatan perbaikan atau alasan penolakan..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRejectModal(false)}
                  disabled={actionLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Memproses...' : 'Kirim Penolakan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
