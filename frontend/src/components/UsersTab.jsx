import { useState, useEffect, useCallback } from 'react'
import { getUsers, addUser, deleteUser, getBranches } from '../utils/api'

export default function UsersTab({ user }) {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'admin', branchId: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [uList, bList] = await Promise.all([getUsers(), getBranches()])
      setUsers(uList || [])
      setBranches(bList || [])
    } catch (err) {
      console.error('Gagal memuat data user/daerah:', err)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = { ...form }
    if (!payload.branchId || payload.branchId.trim() === '') {
      delete payload.branchId
    }
    try {
      await addUser(payload)
      setForm({ name: '', username: '', password: '', role: 'admin', branchId: '' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus user: ${name || id}?`)) return
    try {
      await deleteUser(id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const roleBadge = (role) => {
    if (role === 'superadmin') return 'badge badge-superadmin'
    if (role === 'kepala_bidang') return 'badge badge-admin'
    return 'badge badge-staff'
  }

  const roleText = (role) => {
    if (role === 'superadmin') return 'Superadmin'
    if (role === 'kepala_bidang') return 'Kepala Bidang'
    return 'Operator (Admin)'
  }

  const isSuperadmin = user.role === 'superadmin'

  return (
    <div className="glass form-card">
      <div className="card-header">
        <div className="card-header-left">
          <h2>Manajemen Pengguna</h2>
          <p>
            {isSuperadmin
              ? 'Kelola semua akun operator dan kepala bidang dari seluruh daerah.'
              : `Kelola akun pengguna untuk ${user.branchName || 'daerah Anda'}.`
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="inline-form">
        <input
          className="input"
          placeholder="Nama lengkap"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          className="input"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
        {isSuperadmin && (
          <select
            className="select"
            value={form.branchId}
            onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
          >
            <option value="">-- Daerah --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <select
          className="select"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        >
          <option value="admin">Operator (Admin)</option>
          <option value="kepala_bidang">Kepala Bidang (Penandatangan)</option>
          {isSuperadmin && <option value="superadmin">Superadmin</option>}
        </select>
        <button className="btn btn-primary btn-sm" type="submit">
          + User
        </button>
      </form>
      {error && <div className="text-danger text-sm mb-4">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username</th>
              <th>Role</th>
              {isSuperadmin && <th>Daerah</th>}
              <th>Dibuat</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.name}</td>
                <td>
                  <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    {u.username}
                  </code>
                </td>
                <td>
                  <span className={roleBadge(u.role)}>{roleText(u.role)}</span>
                </td>
                {isSuperadmin && <td className="text-muted text-sm">{u.branchName || 'Semua'}</td>}
                <td className="text-muted text-sm">
                  {new Date(u.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {u.id !== user.id ? (
                    <button className="btn btn-danger" onClick={() => handleDelete(u.id, u.name)}>
                      Hapus
                    </button>
                  ) : (
                    <span className="text-muted" style={{ fontSize: 12 }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
