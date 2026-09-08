import { useState, useEffect, useCallback } from 'react'
import { getSignatories, addSignatory, deleteSignatory, getBranches } from '../utils/api'

export default function PenandatanganTab({ user }) {
  const [signatories, setSignatories] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState({ jabatan: '', nama: '', nip: '', branchId: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setSignatories(await getSignatories())
    if (user.role === 'superadmin') setBranches(await getBranches())
  }, [user.role])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = { ...form }
    if (!payload.branchId) delete payload.branchId
    try {
      await addSignatory(payload)
      setForm({ jabatan: '', nama: '', nip: '', branchId: '' })
      load()
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus penandatangan ini?')) return
    await deleteSignatory(id)
    load()
  }

  const isSuperadmin = user.role === 'superadmin'

  return (
    <div className="glass form-card">
      <div className="card-header">
        <div className="card-header-left">
          <h2>Data Penandatangan Surat</h2>
          <p>
            {isSuperadmin
              ? 'Kelola data penandatangan dari semua daerah.'
              : `Penandatangan untuk ${user.branchName || 'daerah Anda'}.`
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="inline-form">
        <input className="input" placeholder="Jabatan" value={form.jabatan} onChange={e => setForm(f => ({ ...f, jabatan: e.target.value }))} required />
        <input className="input" placeholder="Nama Lengkap" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required />
        <input className="input" placeholder="NIP" value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} required />
        {isSuperadmin && (
          <select className="select" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
            <option value="">-- Daerah --</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <button className="btn btn-primary btn-sm" type="submit">+ Tambah</button>
      </form>
      {error && <div className="text-danger text-sm mb-4">{error}</div>}

      {signatories.length === 0 ? (
        <div className="empty-state">Belum ada data penandatangan.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jabatan</th>
                <th>Nama</th>
                <th>NIP</th>
                {isSuperadmin && <th>Cabang</th>}
                <th style={{ width: '70px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {signatories.map(s => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.jabatan}</td>
                  <td>{s.nama}</td>
                  <td><span className="badge badge-staff">{s.nip}</span></td>
                  {isSuperadmin && <td className="text-muted text-sm">{s.branchName || 'Semua'}</td>}
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-danger" onClick={() => handleDelete(s.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
