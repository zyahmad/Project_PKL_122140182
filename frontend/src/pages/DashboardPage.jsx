import { useState, useEffect } from 'react'
import { logout, getDriveStatus } from '../utils/api'
import BuatSuratTab from '../components/BuatSuratTab'
import RiwayatTab from '../components/RiwayatTab'
import SuratMasukTab from '../components/SuratMasukTab'
import VerifikasiTab from '../components/VerifikasiTab'
import UsersTab from '../components/UsersTab'
import PenandatanganTab from '../components/PenandatanganTab'
import '../styles/dashboard.css'

const ALL_TABS = [
  { id: 'buat', label: 'Buat Surat', roles: ['admin', 'superadmin'] },
  { id: 'verifikasi', label: 'Verifikasi & TTD', roles: ['kepala_bidang', 'superadmin'] },
  { id: 'riwayat', label: 'Riwayat Surat', roles: ['admin', 'superadmin', 'kepala_bidang'] },
  { id: 'surat-masuk', label: 'Surat Masuk', roles: ['admin', 'superadmin', 'kepala_bidang'] },
  { id: 'penandatangan', label: 'Penandatangan', roles: ['admin', 'superadmin'] },
  { id: 'users', label: 'Kelola User', roles: ['admin', 'superadmin'] },
]

export default function DashboardPage({ user, onLogout, theme, onToggleTheme, onOpenVerify }) {
  const visibleTabs = ALL_TABS.filter((t) => t.roles.includes(user.role))
  const initialTab = user.role === 'kepala_bidang' ? 'verifikasi' : visibleTabs[0]?.id || 'buat'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [driveConnected, setDriveConnected] = useState(false)
  const [editingLetter, setEditingLetter] = useState(null)

  useEffect(() => {
    getDriveStatus()
      .then((d) => setDriveConnected(d.connected))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  const handleEditLetter = (letter) => {
    setEditingLetter(letter)
    setActiveTab('buat')
  }

  const handleClearEdit = () => {
    setEditingLetter(null)
  }

  const branchInfo = user.branchName ? ` · ${user.branchName}` : ''
  const roleDisplay = user.role === 'kepala_bidang' ? 'Kepala Bidang' : (user.role === 'superadmin' ? 'Superadmin' : 'Admin Operator')

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Header + Tabs Container */}
      <div className="top-nav-sticky">
        {/* Header */}
        <header className="app-header">
          <div className="brand">
            <div className="brand-icon">S</div>
            <h1>Sistem Pembuat Surat</h1>
          </div>
          <div className="header-right">
            {/* Toggle Theme Icon */}
            <button
              type="button"
              className="header-icon-btn"
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
              aria-label="Ganti Tema"
            >
              {theme === 'light' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>

            {/* Google Drive Status Icon */}
            <a
              href="/auth/google"
              className={`header-icon-btn ${driveConnected ? 'active-drive' : ''}`}
              onClick={driveConnected ? (e) => { e.preventDefault(); alert('Google Drive sudah terhubung dan aktif.') } : undefined}
              title={driveConnected ? 'Google Drive: Terhubung' : 'Hubungkan ke Google Drive'}
              aria-label="Google Drive"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              <span className={`drive-status-dot ${driveConnected ? 'connected' : ''}`} />
            </a>

            {/* Profile Avatar Icon with Hover Popover */}
            <div className="user-profile-wrap">
              <button
                type="button"
                className="user-avatar-btn"
                title={`Profil Akun: ${user.name}`}
                aria-label="Informasi Akun"
              >
                {(user.name || user.username || 'U').charAt(0).toUpperCase()}
              </button>

              {/* Hover Popover Information Card */}
              <div className="user-popover-card">
                <div className="popover-header">
                  <div className="popover-avatar">
                    {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="popover-user-name" title={user.name}>
                      {user.name}
                    </div>
                    <div className="popover-user-username">
                      @{user.username || 'user'}
                    </div>
                  </div>
                </div>

                <div className="popover-meta">
                  <div className="popover-meta-row">
                    <span className="popover-meta-label">Hak Akses</span>
                    <span className="badge badge-staff" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {roleDisplay}
                    </span>
                  </div>
                  <div className="popover-meta-row">
                    <span className="popover-meta-label">Unit Kerja</span>
                    <span className="popover-meta-val">
                      {user.branchName || 'Kantor Pusat'}
                    </span>
                  </div>
                  <div className="popover-meta-row">
                    <span className="popover-meta-label">Status Sesi</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11.5px', color: 'var(--emerald-500)', fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald-500)' }} />
                      Aktif
                    </span>
                  </div>
                </div>

                <div className="popover-footer">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'center', gap: 6, color: 'var(--text-danger)' }}
                    onClick={handleLogout}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Keluar dari Akun
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Logout Icon Button */}
            <button
              type="button"
              className="header-icon-btn"
              onClick={handleLogout}
              title="Keluar dari Sistem"
              aria-label="Logout"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Tab Nav */}
        <nav className="tab-nav">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              className={activeTab === t.id ? 'active' : ''}
              onClick={() => {
                setActiveTab(t.id)
                if (t.id !== 'buat') setEditingLetter(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="main-content">
        {activeTab === 'buat' && (
          <BuatSuratTab
            user={user}
            editingLetter={editingLetter}
            onClearEdit={handleClearEdit}
            onSuccess={() => {
              setEditingLetter(null)
              setActiveTab('riwayat')
            }}
          />
        )}
        {activeTab === 'verifikasi' && <VerifikasiTab user={user} />}
        {activeTab === 'riwayat' && (
          <RiwayatTab
            user={user}
            onEditLetter={handleEditLetter}
            onOpenVerify={onOpenVerify}
          />
        )}
        {activeTab === 'surat-masuk' && (
          <SuratMasukTab
            user={user}
            onOpenVerify={onOpenVerify}
          />
        )}
        {activeTab === 'penandatangan' && <PenandatanganTab user={user} />}
        {activeTab === 'users' && <UsersTab user={user} />}
      </main>
    </div>
  )
}
