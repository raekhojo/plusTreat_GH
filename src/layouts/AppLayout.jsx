import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateMyProfile } from '../lib/api'

const mkProfileForm = (user) => ({
  first_name: user?.name?.split(' ')[0] || '',
  last_name: user?.name?.split(' ').slice(1).join(' ') || '',
  email: user?.email || '',
  phone: user?.phone || '',
  password: '',
})

// The ERP shell (sidebar + top bar) is drawn by the page itself; the layout only
// provides the Edit Profile dialog, opened from the sidebar's user badge.
function AppLayout() {
  const { user, updateSession } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState(() => mkProfileForm(user))
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  useEffect(() => {
    document.body.classList.add('ui-classic')
    return () => document.body.classList.remove('ui-classic')
  }, [])

  useEffect(() => {
    if (!isProfileOpen) return undefined
    const onKey = event => { if (event.key === 'Escape') setIsProfileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isProfileOpen])

  function handleOpenProfile() {
    setProfileForm(mkProfileForm(user))
    setProfileError('')
    setProfileSuccess(false)
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

  const set = (key, value) => setProfileForm(current => ({ ...current, [key]: value }))

  return (
    <div className="app-layout">
      {isProfileOpen ? (
        <div className="classic-ui classic-portal">
          <div className="modal-overlay open" onMouseDown={e => { if (e.target === e.currentTarget) handleCloseProfile() }}>
            <form className="modal-container" style={{ maxWidth: '520px' }} onSubmit={handleProfileSave}>
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">👤 Edit My Profile</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Update your account details and optional password</div>
                </div>
                <button type="button" className="modal-close" onClick={handleCloseProfile}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">First Name</label><input className="form-control" value={profileForm.first_name} onChange={e => set('first_name', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Last Name</label><input className="form-control" value={profileForm.last_name} onChange={e => set('last_name', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={profileForm.email} onChange={e => set('email', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={profileForm.phone} onChange={e => set('phone', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-control" value={profileForm.password} onChange={e => set('password', e.target.value)} placeholder="Leave blank to keep current password" /></div>
                {profileError ? <div className="alert alert-danger"><span>{profileError}</span></div> : null}
                {profileSuccess ? <div className="alert alert-success"><span>Profile saved successfully.</span></div> : null}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseProfile}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>{isSavingProfile ? 'Saving...' : '💾 Save Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Outlet context={{ headerNavSlot: null, openProfile: handleOpenProfile }} />
    </div>
  )
}

export default AppLayout
