import { useState, useEffect } from 'react'
import { getMe } from './utils/api'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import VerifikasiView from './pages/VerifikasiView'
import kemenagLogo from './assets/kemenag_logo.png'

function BgOrbs() {
  return (
    <div className="bg-orbs">
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
    </div>
  )
}

function getVerifyTokenFromHash() {
  const hash = window.location.hash || ''
  const match = hash.match(/#\/verify\/([a-zA-Z0-9-]+)/)
  return match ? match[1] : null
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [verifyToken, setVerifyToken] = useState(() => getVerifyTokenFromHash())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    const handleHashChange = () => {
      setVerifyToken(getVerifyTokenFromHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  const handleOpenVerify = (token) => {
    window.location.hash = `#/verify/${token}`
    setVerifyToken(token)
  }

  const handleCloseVerify = () => {
    window.location.hash = ''
    setVerifyToken(null)
  }

  if (loading) {
    return (
      <>
        <BgOrbs />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative', zIndex: 1 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Memuat...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <BgOrbs />
      {verifyToken ? (
        <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
          <header className="app-header">
            <div className="brand">
              <img src={kemenagLogo} alt="Logo Kemenag" className="brand-icon-logo" />
              <h1>Sistem Verifikasi Surat Resmi Bidang PAPKI</h1>
            </div>
            <div className="header-right">
              <button
                type="button"
                className="header-icon-btn"
                onClick={toggleTheme}
                title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
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
              {user && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCloseVerify}
                >
                  ← Dashboard
                </button>
              )}
            </div>
          </header>
          <VerifikasiView token={verifyToken} user={user} onBack={handleCloseVerify} />
        </div>
      ) : !user ? (
        <LoginPage onLogin={setUser} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <DashboardPage
          user={user}
          onLogout={() => setUser(null)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenVerify={handleOpenVerify}
        />
      )}
    </>
  )
}
