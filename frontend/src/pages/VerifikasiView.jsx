import { useState, useEffect } from 'react'
import { verifyDocument, getPdfDownloadUrl } from '../utils/api'

export default function VerifikasiView({ token, onBack, user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Token verifikasi tidak disediakan.')
      setLoading(false)
      return
    }

    verifyDocument(token)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [token])

  const [showPreview, setShowPreview] = useState(false)

  return (
    <div style={{ maxWidth: 760, margin: '20px auto', padding: '0 12px', position: 'relative', zIndex: 1 }}>
      <div className="glass form-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          {user ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              ← Kembali ke Dashboard
            </button>
          ) : (
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--emerald-500)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              🏛️ Kantor Wilayah Kementerian Agama
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Sistem Verifikasi Surat Resmi
          </span>
        </div>

        {loading ? (
          <div className="empty-state">Memverifikasi keabsahan dokumen...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-danger)',
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 12
            }}>
              Peringatan: Dokumen Tidak Valid / Tidak Ditemukan
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{error}</p>
          </div>
        ) : (
          <div>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--emerald-600)' }}>
                  Dokumen Sah & Terverifikasi
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Tanda tangan elektronik telah diverifikasi secara sah melalui sistem internal Kanwil Kemenag.
                </div>
              </div>
              <span className="badge badge-admin" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald-600)' }}>
                {data.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label className="label">Nomor Surat</label>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--emerald-400)' }}>
                  {data.nomor_surat}
                </div>
              </div>

              <div>
                <label className="label">Tanggal Surat</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                  {data.tanggal}
                </div>
              </div>

              <div>
                <label className="label">Hal / Perihal</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {data.hal}
                </div>
              </div>

              <div>
                <label className="label">Tujuan</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                  {data.tujuan}
                </div>
              </div>

              <div>
                <label className="label">Pembuat Surat (Operator)</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                  {data.dibuat_oleh} ({data.branch_name || 'Pusat'})
                </div>
              </div>

              <div>
                <label className="label">Waktu Penandatanganan</label>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {data.signed_at
                    ? new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(data.signed_at)) + ' WIB'
                    : '-'}
                </div>
              </div>

              <div>
                <label className="label">Diverifikasi & Disetujui Oleh</label>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {data.verifier_name || data.signed_by || '-'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={getPdfDownloadUrl(data.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Buka dan lihat surat hasil yang sudah ditandatangani"
              >
                👁️ Tampilkan Surat Hasil (Buka PDF)
              </a>
              <a
                href={getPdfDownloadUrl(data.id, true)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Unduh berkas fisik PDF resmi"
              >
                ⬇️ Unduh PDF Resmi
              </a>
              {data.drive_url && (
                <a
                  href={data.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge-drive"
                  style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  title="Lihat berkas resmi di Google Drive"
                >
                  ☁️ Buka di Google Drive
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPreview((prev) => !prev)}
                style={{ marginLeft: 'auto', fontSize: '12.5px' }}
                title="Buka pratinjau naskah langsung di halaman ini"
              >
                {showPreview ? '▲ Sembunyikan Dokumen' : '📄 Pratinjau di Halaman'}
              </button>
            </div>

            {showPreview && (
              <div style={{ marginTop: 18, border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden', height: '650px', background: '#3b3e40', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
                <iframe
                  src={getPdfDownloadUrl(data.id)}
                  title="Pratinjau Surat Resmi"
                  width="100%"
                  height="100%"
                  style={{ border: 'none', display: 'block' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
