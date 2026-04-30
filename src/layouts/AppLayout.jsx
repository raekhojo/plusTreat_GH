import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import plusLogo from '../assets/plusLogo.png'
import { useAuth } from '../context/AuthContext'

function AppLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
        setIsProfileOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleToggleMenu() {
    setIsMenuOpen((open) => !open)
    setIsProfileOpen(false)
  }

  function handleToggleProfile() {
    setIsProfileOpen((open) => !open)
  }

  const avatarText = (user?.name || 'PT')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="app-layout">
      <header className="app-layout-header">
        <div className="app-layout-brand">
          <img src={plusLogo} alt="Plus Treat logo" className="app-layout-logo" />
        </div>

        <div className="app-layout-user" ref={menuRef}>
          <button
            type="button"
            className={`app-layout-menu-trigger${isMenuOpen ? ' is-open' : ''}`}
            onClick={handleToggleMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <span className="app-layout-avatar" aria-hidden="true">
              {avatarText}
            </span>
            <span className="app-layout-caret" aria-hidden="true">
              ▾
            </span>
            <span className="app-layout-sr-only">Open account menu</span>
          </button>

          {isMenuOpen ? (
            <div className="app-layout-menu" role="menu" aria-label="Account menu">
              <button
                type="button"
                className="app-layout-menu-item"
                onClick={handleToggleProfile}
                aria-expanded={isProfileOpen}
              >
                <span>Profile</span>
                <span className="app-layout-menu-arrow" aria-hidden="true">
                  {isProfileOpen ? '-' : '+'}
                </span>
              </button>

              {isProfileOpen ? (
                <div className="app-layout-profile-card">
                  <strong>{user?.name || 'Staff'}</strong>
                  <span>{user?.role || 'Staff'}</span>
                  <span>{user?.email || user?.username || 'No contact info'}</span>
                  {user?.phone ? <span>{user.phone}</span> : null}
                </div>
              ) : null}

              <button
                type="button"
                className="app-layout-menu-item app-layout-menu-item-danger"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <Outlet />
    </div>
  )
}

export default AppLayout
