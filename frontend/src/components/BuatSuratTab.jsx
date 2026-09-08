import { useState, useEffect, useCallback, useRef } from 'react'
import { getSignatories, addSignatory, getNextNomor, saveDraft, sendSurat } from '../utils/api'

function getTodayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function BuatSuratTab({ user, editingLetter, onClearEdit, onSuccess }) {
  const [signatories, setSignatories] = useState([])
  const [selectedSigId, setSelectedSigId] = useState('')
  const [nomorSurat, setNomorSurat] = useState('')
  const [tanggal, setTanggal] = useState(getTodayISO())
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [newSig, setNewSig] = useState({ jabatan: '', nama: '', nip: '' })
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    tempat_surat: 'Bandar Lampung',
    sifat: 'Biasa',
    lampiran: '-',
    hal: 'Surat Rekomendasi',
    tujuan: '',
    lokasi_tujuan: 'Bandar Lampung',
    isi_surat: '',
    nama_penandatangan: '',
    nip_penandatangan: '',
  })

  const loadSignatories = useCallback(async () => {
    const s = await getSignatories()
    setSignatories(s)
    if (s.length > 0 && !selectedSigId && !editingLetter) {
      setSelectedSigId(s[0].id)
      setForm((f) => ({
        ...f,
        nama_penandatangan: s[0].nama,
        nip_penandatangan: s[0].nip,
      }))
    }
  }, [selectedSigId, editingLetter])

  const refreshNomor = useCallback(async () => {
    try {
      const nom = await getNextNomor('07')
      setNomorSurat(nom)
    } catch {
      setNomorSurat('')
    }
  }, [])

  useEffect(() => {
    loadSignatories()
    if (!editingLetter) {
      refreshNomor()
    }
  }, [loadSignatories, refreshNomor, editingLetter])

  // Populate form jika sedang mengedit draft atau surat yang ditolak
  useEffect(() => {
    if (editingLetter) {
      const rawData = editingLetter.data || {}
      setNomorSurat(editingLetter.nomor_surat || '')
      setTanggal(editingLetter.tanggal || getTodayISO())
      setSelectedSigId(editingLetter.signatoryId || '')
      setForm({
        tempat_surat: rawData.tempat_surat || 'Bandar Lampung',
        sifat: rawData.sifat || 'Biasa',
        lampiran: rawData.lampiran || '-',
        hal: editingLetter.hal || 'Surat Rekomendasi',
        tujuan: editingLetter.tujuan || '',
        lokasi_tujuan: rawData.lokasi_tujuan || 'Bandar Lampung',
        isi_surat: rawData.isi_surat || '',
        nama_penandatangan: editingLetter.namaPenandatangan || rawData.nama_penandatangan || '',
        nip_penandatangan: editingLetter.nipPenandatangan || rawData.nip_penandatangan || '',
      })
    }
  }, [editingLetter])

  const handleSigChange = (id) => {
    setSelectedSigId(id)
    const s = signatories.find((x) => x.id === id)
    if (s) {
      setForm((f) => ({
        ...f,
        nama_penandatangan: s.nama,
        nip_penandatangan: s.nip,
      }))
    }
  }

  const handleAddSig = async () => {
    if (!newSig.jabatan || !newSig.nama || !newSig.nip) return alert('Isi jabatan, nama, dan NIP')
    try {
      const res = await addSignatory(newSig)
      setNewSig({ jabatan: '', nama: '', nip: '' })
      setShowAddPanel(false)
      await loadSignatories()
      if (res.signatory) {
        setSelectedSigId(res.signatory.id)
        setForm((f) => ({
          ...f,
          nama_penandatangan: res.signatory.nama || newSig.nama,
          nip_penandatangan: res.signatory.nip || newSig.nip,
        }))
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const isSubmittingRef = useRef(false)

  const handleSubmit = async (e, shouldSend = false) => {
    if (e) e.preventDefault()
    if (isSubmittingRef.current || loading) return
    isSubmittingRef.current = true
    setStatus({ msg: '', type: '' })
    setLoading(true)

    const selected = signatories.find((x) => x.id === selectedSigId)
    const payload = {
      ...form,
      id: editingLetter?.id || undefined,
      nomor_surat: nomorSurat,
      tanggal,
      kode_jenis_surat: '07',
      signatoryId: selectedSigId || undefined,
      jabatan_penandatangan: selected?.jabatan || 'Kepala Bidang',
    }

    try {
      // 1. Simpan Draft
      const res = await saveDraft(payload)
      const savedSurat = res.surat

      // 2. Jika tombol "Kirim ke Kepala Bidang" diklik
      if (shouldSend && savedSurat?.id) {
        await sendSurat(savedSurat.id)
        setStatus({
          msg: `Surat ${savedSurat.nomor_surat} berhasil disimpan dan dikirim ke Kepala Bidang untuk verifikasi TTD.`,
          type: 'success',
        })
      } else {
        setStatus({
          msg: `Draft surat ${savedSurat.nomor_surat} berhasil disimpan (Status: DRAFT).`,
          type: 'success',
        })
      }

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000)
      }
    } catch (err) {
      setStatus({ msg: 'Gagal: ' + err.message, type: 'error' })
    } finally {
      isSubmittingRef.current = false
      setLoading(false)
    }
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="glass form-card">
      <div className="card-header">
        <div className="card-header-left">
          <h2>
            {editingLetter
              ? (editingLetter.status === 'DITOLAK' ? 'Perbaikan Surat Ditolak' : 'Edit Draft Surat')
              : 'Formulir Pembuatan Surat Rekomendasi'
            }
          </h2>
          <p>
            {editingLetter
              ? `Mengedit surat ${editingLetter.nomor_surat}. Simpan draft atau kirim kembali ke Kepala Bidang.`
              : 'Lengkapi isian di bawah. Surat dapat disimpan sebagai Draft atau langsung dikirim ke Kepala Bidang.'
            }
          </p>
        </div>
        {editingLetter && (
          <div className="card-header-right">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearEdit}>
              Batalkan Edit
            </button>
          </div>
        )}
      </div>

      {editingLetter && editingLetter.status === 'DITOLAK' && editingLetter.alasanPenolakan && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginBottom: 20
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-danger)', marginBottom: 4 }}>
            Catatan Penolakan oleh {editingLetter.rejectedBy || 'Kepala Bidang'}:
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            "{editingLetter.alasanPenolakan}"
          </div>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="row-2">
          <div>
            <label className="label">Nomor Surat</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={nomorSurat} readOnly required />
              {!editingLetter && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={refreshNomor}>
                  Baru
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="label">Tanggal Surat</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setTanggal(getTodayISO())}
              >
                Hari Ini
              </button>
            </div>
          </div>
        </div>

        <div className="row-2 mt-4">
          <div>
            <label className="label">Tempat Surat</label>
            <input
              className="input"
              value={form.tempat_surat}
              onChange={(e) => setField('tempat_surat', e.target.value)}
              placeholder="Bandar Lampung"
              required
            />
          </div>
          <div>
            <label className="label">Sifat Surat</label>
            <select
              className="select"
              value={form.sifat}
              onChange={(e) => setField('sifat', e.target.value)}
              required
            >
              <option value="-">-</option>
              <option value="Biasa">Biasa</option>
              <option value="Penting">Penting</option>
              <option value="Mendesak">Mendesak</option>
            </select>
          </div>
        </div>

        <div className="row-2 mt-4">
          <div>
            <label className="label">Lampiran</label>
            <input
              className="input"
              value={form.lampiran}
              onChange={(e) => setField('lampiran', e.target.value)}
              placeholder="-"
              required
            />
          </div>
          <div>
            <label className="label">Hal / Perihal</label>
            <input
              className="input"
              value={form.hal}
              onChange={(e) => setField('hal', e.target.value)}
              placeholder="Surat Rekomendasi"
              required
            />
          </div>
        </div>

        <div className="row-2 mt-4">
          <div>
            <label className="label">Tujuan (Yth.)</label>
            <input
              className="input"
              value={form.tujuan}
              onChange={(e) => setField('tujuan', e.target.value)}
              placeholder="Kepala Kantor / Instansi"
              required
            />
          </div>
          <div>
            <label className="label">Lokasi Tujuan</label>
            <input
              className="input"
              value={form.lokasi_tujuan}
              onChange={(e) => setField('lokasi_tujuan', e.target.value)}
              placeholder="Bandar Lampung"
              required
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Isi Surat</label>
          <textarea
            className="textarea"
            value={form.isi_surat}
            onChange={(e) => setField('isi_surat', e.target.value)}
            placeholder="Tuliskan isi rekomendasi resmi..."
            required
          />
        </div>

        <div className="row-2 mt-4">
          <div>
            <label className="label">Pejabat Penandatangan (Kepala Bidang)</label>
            <select
              className="select"
              value={selectedSigId}
              onChange={(e) => handleSigChange(e.target.value)}
              required
            >
              <option value="">-- Pilih Penandatangan --</option>
              {signatories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.jabatan} — {s.nama}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-2"
              onClick={() => setShowAddPanel(!showAddPanel)}
            >
              {showAddPanel ? 'Tutup Tambah Jabatan' : '+ Tambah Jabatan Baru'}
            </button>
            {showAddPanel && (
              <div className="add-panel">
                <input
                  className="input"
                  placeholder="Jabatan baru"
                  value={newSig.jabatan}
                  onChange={(e) => setNewSig((s) => ({ ...s, jabatan: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Nama lengkap"
                  value={newSig.nama}
                  onChange={(e) => setNewSig((s) => ({ ...s, nama: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="NIP"
                  value={newSig.nip}
                  onChange={(e) => setNewSig((s) => ({ ...s, nip: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  onClick={handleAddSig}
                >
                  Simpan
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="label">Nama Penandatangan</label>
            <input
              className="input"
              value={form.nama_penandatangan}
              onChange={(e) => setField('nama_penandatangan', e.target.value)}
              placeholder="Ir. Nama Penandatangan, M.Si"
              required
            />
            <label className="label mt-4">NIP Penandatangan</label>
            <input
              className="input"
              value={form.nip_penandatangan}
              onChange={(e) => setField('nip_penandatangan', e.target.value)}
              placeholder="197201011995032002"
              required
            />
          </div>
        </div>

        {status.msg && (
          <div className={`status-msg ${status.type}`} style={{ marginTop: 18 }}>
            {status.msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={loading}
            style={{ flex: 1, padding: '11px' }}
          >
            {loading ? 'Menyimpan...' : 'Simpan sebagai Draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={(e) => handleSubmit(e, true)}
            style={{ flex: 1, padding: '11px' }}
          >
            {loading ? 'Memproses...' : (editingLetter?.status === 'DITOLAK' ? 'Kirim Ulang ke Kepala Bidang' : 'Kirim ke Kepala Bidang (TTD)')}
          </button>
        </div>
      </form>
    </div>
  )
}
