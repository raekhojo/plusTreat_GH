import { useState } from 'react'
import { StaffTable } from './ClassicSettings'

// Staff accounts in the classic look (the reference only lists users; editing is added here).
const ROLES = [['admin', 'Admin'], ['sales', 'Sales'], ['accounts', 'Accounts']]
const blank = () => ({ first_name: '', last_name: '', username: '', email: '', password: '', role: 'sales', phone: '', is_active: true, is_sales_staff: true })

function ClassicUsers({ ctx, editing, setEditing }) {
  const staff = ctx.data.staffProfiles || []
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const open = profile => {
    setError('')
    if (!profile) { setForm(blank()); setEditing('new'); return }
    setForm({
      first_name: profile.user?.first_name || '', last_name: profile.user?.last_name || '', username: profile.user?.username || '',
      email: profile.user?.email || '', password: '', role: profile.role || 'sales', phone: profile.phone || '',
      is_active: profile.user?.is_active !== false, is_sales_staff: profile.is_sales_staff !== false,
    })
    setEditing(profile.id)
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = async e => {
    e.preventDefault()
    if (!form.username.trim()) return setError('Username is required.')
    if (editing === 'new' && !form.password.trim()) return setError('Password is required for new staff.')
    setSaving(true)
    setError('')
    try {
      await ctx.saveStaff(editing === 'new' ? null : editing, {
        user: { first_name: form.first_name.trim(), last_name: form.last_name.trim(), username: form.username.trim(), email: form.email.trim(), is_active: form.is_active, ...(form.password ? { password: form.password } : {}) },
        role: form.role,
        phone: form.phone.trim(),
        is_sales_staff: form.is_sales_staff,
      })
      setEditing(null)
    } catch (err) {
      setError(err.message || 'Failed to save staff account.')
    } finally {
      setSaving(false)
    }
  }
  const q = search.trim().toLowerCase()
  const shown = staff.filter(p => !q || [p.user?.username, p.user?.first_name, p.user?.last_name, p.user?.email, p.role, p.phone].join(' ').toLowerCase().includes(q))

  return (
    <>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <h3 className="card-title" style={{ marginBottom: 0 }}>👥 Authorized Staff &amp; User Access</h3>
            <input type="text" className="form-control" placeholder="🔍 Search staff..." style={{ maxWidth: '300px' }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Staff: <strong>{staff.length}</strong></div>
        </div>
        <div className="table-responsive">
          <StaffTable staff={shown} onEdit={open} />
        </div>
      </div>

      <div className={`modal-overlay${editing ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
        <form className="modal-container" style={{ maxWidth: '640px' }} onSubmit={save}>
          <div className="modal-header">
            <div>
              <h3 className="modal-title">{editing === 'new' ? '👤 Add New Staff Account' : '✏️ Edit Staff Account'}</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Login details, role and access status</div>
            </div>
            <button type="button" className="modal-close" onClick={() => setEditing(null)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label">First Name</label><input className="form-control" value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Last Name</label><input className="form-control" value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Username</label><input className="form-control" required value={form.username} onChange={e => set('username', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-control" value={form.password} onChange={e => set('password', e.target.value)} placeholder={editing === 'new' ? 'Create a password' : 'Leave blank to keep current password'} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}><input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> <strong>Account active</strong></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}><input type="checkbox" checked={form.is_sales_staff} onChange={e => set('is_sales_staff', e.target.checked)} /> <strong>Can be assigned sales</strong></label>
              </div>
            </div>
            {error ? <div className="alert alert-danger"><span>{error}</span></div> : null}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing === 'new' ? 'Create Account' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </>
  )
}

export default ClassicUsers
