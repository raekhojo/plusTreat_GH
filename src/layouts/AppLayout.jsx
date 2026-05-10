import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import plusLogo from '../assets/plusLogo.png'
import { useAuth } from '../context/AuthContext'
import { updateMyProfile } from '../lib/api'

const mkProfileForm = (user) => ({
  first_name: user?.name?.split(' ')[0] || '',
  last_name: user?.name?.split(' ').slice(1).join(' ') || '',
  email: user?.email || '',
  phone: user?.phone || '',
  password: '',
})

function AppLayout() {
  const navigate = useNavigate()
  const { user, logout, updateSession } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState(() => mkProfileForm(user))
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)
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

  function handleOpenProfile() {
    setProfileForm(mkProfileForm(user))
    setProfileError('')
    setProfileSuccess(false)
    setIsMenuOpen(false)
    setIsProfileOpen(true)
  }

  function handleCloseProfile() {
    setIsProfileOpen(false)
    setProfileError('')
    setProfileSuccess(false)
  }

  async function handleProfileSave(event) {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileError('')
    setProfileSuccess(false)

    try {
      const payload = {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        ...(profileForm.password ? { password: profileForm.password } : {}),
      }
      const response = await updateMyProfile(payload)
      updateSession(response)
      setProfileSuccess(true)
      setProfileForm((current) => ({ ...current, password: '' }))
    } catch (error) {
      setProfileError(error.message || 'Failed to save profile.')
    } finally {
      setIsSavingProfile(false)
    }
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
                onClick={handleOpenProfile}
              >
                <span>Edit Profile</span>
              </button>

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

      {isProfileOpen ? (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.4)' }}
          onClick={handleCloseProfile}
        >
          <form
            onSubmit={handleProfileSave}
            onClick={(event) => event.stopPropagation()}
            style={{ width: '100%', maxWidth: '460px', padding: '28px', borderRadius: '24px', background: '#ffffff', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)' }}
          >
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ margin: 0, color: '#173450' }}>Edit Profile</h2>
              <p style={{ margin: '8px 0 0', color: '#64748b' }}>Update your account details and optional password.</p>
            </div>

            <div className="sales-form-grid-two">
              <label className="sales-field">
                <span>First Name</span>
                <input value={profileForm.first_name} onChange={(event) => setProfileForm((current) => ({ ...current, first_name: event.target.value }))} />
              </label>
              <label className="sales-field">
                <span>Last Name</span>
                <input value={profileForm.last_name} onChange={(event) => setProfileForm((current) => ({ ...current, last_name: event.target.value }))} />
              </label>
              <label className="sales-field" style={{ gridColumn: '1 / -1' }}>
                <span>Email</span>
                <input type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="sales-field" style={{ gridColumn: '1 / -1' }}>
                <span>Phone</span>
                <input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label className="sales-field" style={{ gridColumn: '1 / -1' }}>
                <span>New Password</span>
                <input type="password" value={profileForm.password} onChange={(event) => setProfileForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to keep current password" />
              </label>
            </div>

            {profileError ? <p className="login-error" style={{ marginTop: '14px' }}>{profileError}</p> : null}
            {profileSuccess ? <p style={{ margin: '14px 0 0', color: '#15803d', fontWeight: 700 }}>Profile saved successfully.</p> : null}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" className="account-alert-button account-alert-button-dark" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="account-alert-button account-alert-button-light" onClick={handleCloseProfile}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <Outlet />
    </div>
  )
}

export default AppLayout
