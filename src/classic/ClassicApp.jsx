import { useMemo, useState } from 'react'
import NavIcon from './NavIcon'
import ClassicCashbook from './pages/ClassicCashbook'
import ClassicDashboard from './pages/ClassicDashboard'
import ClassicFinancials from './pages/ClassicFinancials'
import ClassicInventory from './pages/ClassicInventory'
import ClassicPayables from './pages/ClassicPayables'
import ClassicProduction from './pages/ClassicProduction'
import ClassicReceivables, { ClassicStatement } from './pages/ClassicReceivables'
import ClassicReports from './pages/ClassicReports'
import ClassicSales from './pages/ClassicSales'
import ClassicSettings from './pages/ClassicSettings'
import ClassicUsers from './pages/ClassicUsers'
import logo from './plus_yoghurt_logo.png'
import './classic.css'
import './classic-extra.css'

// The Plus Yoghurt ERP sidebar (templates/base.html), mapped onto this app's sections.
const NAV = [
  { key: 'dashboard', icon: 'home', label: 'Dashboard', title: 'Executive Control Center (Live ERP)' },
  { key: 'sales_hub', icon: 'sales', label: 'Sales & Invoices', title: 'Sales, Invoicing & Orders Log' },
  { key: 'production_ops', icon: 'production', label: 'Production & Batches', title: 'Production Batches & Recipe Management' },
  { key: 'supplies_stock', icon: 'inventory', label: 'Stock & Materials', title: 'Finished Goods & Raw Materials Inventory' },
  { key: 'treasury', icon: 'treasury', label: 'Cashbook & Treasury', title: 'Unified Cashbook & Treasury' },
  { key: 'receivables', icon: 'debtors', label: 'Customer Debtors (AR)', title: 'Receivables & Debtors Ledger', also: ['customers'] },
  { key: 'suppliers', icon: 'suppliers', label: 'Suppliers & AP', title: 'Suppliers & Accounts Payable (AP)' },
  { key: 'reporting', icon: 'reporting', label: 'Financials & Audit', title: 'Financial Statements, Unit Economics & Audit Center' },
  { key: 'reconciliation', icon: 'reconcile', label: 'Asset Reconciliation', title: 'Financial Statements, Unit Economics & Audit Center', badge: { text: 'AUDITED', style: { background: '#ecfdf5', color: '#059669' } } },
  { key: 'reports', icon: 'reports', label: 'Reports & Exports', title: 'Reports & Analytics Center', badge: { text: 'XLS/PDF', style: { background: '#e0f2fe', color: '#0284c7' } } },
  { key: 'settings', icon: 'settings', label: 'Settings & Pricing', title: 'ERP Configuration & Master Pricing Matrix' },
  { key: 'user_mgmt', icon: 'users', label: 'User Management', title: 'User Management' },
]

const BADGE_BASE = { marginLeft: 'auto', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '8px' }

function monthLabel(offset) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function monthRange(offset) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { start: iso(start), end: iso(end) }
}

const PERIOD_KEY = 'plusTreatClassicPeriod'
function loadPeriod() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY) || 'null')
    if (saved && saved.key) return saved
  } catch { /* ignore */ }
  return { key: 'all' }
}

// Resolves the saved choice to dates (current/previous month move with the calendar).
function resolvePeriod(p) {
  if (p.key === 'current_month') return { ...p, ...monthRange(0), label: `Current Period (${monthLabel(0)})` }
  if (p.key === 'prev_month') return { ...p, ...monthRange(-1), label: `Previous Month (${monthLabel(-1)})` }
  if (p.key === 'custom' && p.start && p.end) return { ...p, label: 'Custom Date Range' }
  return { key: 'all', start: '', end: '', label: 'All Time (Lifetime Dump)' }
}

function ClassicApp({ user, canAccess, activeSection, onNavigate, onLogout, onProfile, lastSyncedAt, ctx }) {
  const [periodChoice, setPeriodChoice] = useState(loadPeriod)
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState({ start: '', end: '' })
  // In-page views: a customer's statement, the wallet the Cashbook opens on, the staff form.
  const [statementFor, setStatementFor] = useState(null)
  const [walletFocus, setWalletFocus] = useState('')
  const [staffEditing, setStaffEditing] = useState(null)
  const period = useMemo(() => resolvePeriod(periodChoice), [periodChoice])
  const isFiltered = period.key !== 'all'

  const savePeriod = next => {
    setPeriodChoice(next)
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const openCustom = () => { setDraft({ start: period.start || '', end: period.end || '' }); setCustomOpen(true) }
  const onPeriodChange = value => {
    if (value === 'custom') return openCustom()
    savePeriod({ key: value })
  }

  const nav = NAV.filter(n => canAccess(n.key) || (n.also || []).some(canAccess))
  const current = nav.find(n => n.key === activeSection || (n.also || []).includes(activeSection)) || nav[0]
  const go = (key, wallet = '') => {
    setStatementFor(null)
    setWalletFocus(wallet)
    const item = NAV.find(n => n.key === key)
    onNavigate(canAccess(key) || !item?.also ? key : item.also.find(canAccess))
    window.scrollTo(0, 0)
  }
  const openStatement = customerId => { setStatementFor(customerId); window.scrollTo(0, 0) }
  const pageCtx = { ...ctx, goTo: go, canAccess, viewWallet: key => go('treasury', key), onStatement: item => openStatement(item.id) }
  const statementCustomer = statementFor ? ctx.data.customers.find(c => String(c.id) === String(statementFor)) : null
  const pageKey = current?.key
  const btn = (label, onClick, primary = false, style) => <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} onClick={onClick} style={style}>{label}</button>
  const PAGE_ACTIONS = {
    dashboard: <>{ctx.canManageSales ? btn('🛍️ Record Sale', () => ctx.openModal('sale'), true) : null}</>,
    sales_hub: ctx.canManageSales ? <>{btn('🧾 Add Sales Receipt', () => ctx.openModal('receipt'), false, { fontWeight: 600 })}{btn('🛍️ Record New Sale', () => ctx.openModal('sale'), true)}</> : null,
    production_ops: ctx.canManageProduction ? btn('🏭 Record Production Batch', () => ctx.openModal('batch'), true) : null,
    supplies_stock: btn('🧪 Record RM Purchase / Delivery', () => ctx.openModal('purchase'), true),
    treasury: <>{btn('🔄 Transfer Money', () => ctx.openTransferModal())}{btn('💰 Record Cash / Wallet Entry', () => ctx.openModal('account'), true)}</>,
    receivables: btn('👤 Add New Customer', () => ctx.openModal('customer'), true),
    suppliers: btn('🚚 Add New Supplier', () => ctx.openModal('supplier'), true),
    user_mgmt: btn('👤 Add Staff Account', () => setStaffEditing('new'), true),
  }
  const actions = statementCustomer
    ? <>{btn('← Back to Receivables', () => setStatementFor(null))}{btn('🖨️ Print Statement', () => ctx.printStatement(statementCustomer), true)}</>
    : PAGE_ACTIONS[pageKey] || null

  const renderPage = () => {
    if (statementCustomer) return <ClassicStatement ctx={pageCtx} customerId={statementFor} />
    switch (pageKey) {
      case 'dashboard': return <ClassicDashboard ctx={pageCtx} period={period} onNavigate={go} />
      case 'sales_hub': return <ClassicSales ctx={pageCtx} period={period} onStatement={openStatement} />
      case 'production_ops': return <ClassicProduction ctx={pageCtx} period={period} />
      case 'supplies_stock': return <ClassicInventory ctx={pageCtx} period={period} />
      case 'treasury': return <ClassicCashbook key={walletFocus || 'all'} ctx={pageCtx} period={period} initialWallet={walletFocus} />
      case 'receivables': return <ClassicReceivables ctx={pageCtx} period={period} onStatement={openStatement} />
      case 'suppliers': return <ClassicPayables ctx={pageCtx} period={period} />
      case 'reporting': return <ClassicFinancials key="fin" ctx={pageCtx} period={period} user={user} />
      case 'reconciliation': return <ClassicFinancials key="recon" ctx={pageCtx} period={period} user={user} initialTab="reconciliation" />
      case 'reports': return <ClassicReports ctx={pageCtx} />
      case 'settings': return <ClassicSettings ctx={pageCtx} lastSyncedAt={lastSyncedAt} />
      case 'user_mgmt': return <ClassicUsers ctx={pageCtx} editing={staffEditing} setEditing={setStaffEditing} />
      default: return <ClassicComingSoon title={current?.title} />
    }
  }

  return (
    <div className="classic-ui">
      <aside className="sidebar">
        <div className="brand-header">
          <img src={logo} alt="Plus Yoghurt Logo" style={{ height: '38px', width: 'auto', maxWidth: '100px', objectFit: 'contain', background: '#fff', padding: '3px 6px', borderRadius: '6px' }} />
          <div>
            <div className="brand-title">PLUS TREATS</div>
            <div className="brand-subtitle">Executive ERP System</div>
          </div>
        </div>

        <ul className="nav-menu">
          {nav.map(n => (
            <li key={n.key} className="nav-item">
              <a
                href={`#${n.key}`}
                className={`nav-link${current?.key === n.key ? ' active' : ''}`}
                onClick={e => { e.preventDefault(); go(n.key) }}
              >
                <span className="nav-icon"><NavIcon type={n.icon} /></span>
                <span>{n.label}</span>
                {n.badge ? <span style={{ ...BADGE_BASE, ...n.badge.style }}>{n.badge.text}</span> : null}
              </a>
            </li>
          ))}
        </ul>

        <div className="user-badge">
          <div className="user-info" role="button" tabIndex={0} title="Edit my profile" style={{ cursor: onProfile ? 'pointer' : 'default' }} onClick={() => onProfile?.()} onKeyDown={e => { if (e.key === 'Enter') onProfile?.() }}>
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="user-role">{user?.role || 'Staff'} (Online)</span>
          </div>
          <a href="#logout" title="Logout" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '16px' }} onClick={e => { e.preventDefault(); onLogout() }} aria-label="Log out"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15" /><path d="M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg></a>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-bar">
          <h1 className="page-title" title={statementCustomer ? `Customer Ledger Statement: ${statementCustomer.name}` : current?.title}>{statementCustomer ? `Customer Ledger Statement: ${statementCustomer.name}` : current?.title || 'Dashboard'}</h1>
          <div className="top-actions">
            <div
              className="period-filter-wrapper"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: isFiltered ? '#eff6ff' : '#ffffff', border: `1.5px solid ${isFiltered ? '#38bdf8' : '#cbd5e1'}`, borderRadius: '7px', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)' }}
              title="Filter all ERP records by operating period"
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: isFiltered ? '#0369a1' : '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span>📅</span>
                <span>Period:</span>
              </span>
              <select
                id="globalPeriodSelect"
                value={period.key}
                onChange={e => onPeriodChange(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: isFiltered ? '#0284c7' : '#1e293b', cursor: 'pointer', outline: 'none' }}
              >
                <option value="all">All Time (Lifetime Dump)</option>
                <option value="current_month">Current Period ({monthLabel(0)})</option>
                <option value="prev_month">Previous Month ({monthLabel(-1)})</option>
                <option value="custom">Custom Date Range...</option>
              </select>
              {isFiltered ? (
                <a href="#all" title="Reset to All Time" onClick={e => { e.preventDefault(); savePeriod({ key: 'all' }) }} style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: '4px', padding: '1px 6px', textDecoration: 'none', marginLeft: '2px' }}>✕</a>
              ) : null}
            </div>

            <span
              className="classic-live"
              title={ctx.loadError ? ctx.loadError : 'Connected to the live database. Figures update automatically.'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px', whiteSpace: 'nowrap', ...(ctx.loadError ? { background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca' } : { background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', color: '#065f46', border: '1.5px solid #059669' }) }}
            >
              <span className={ctx.loadError ? '' : 'classic-live-dot'} style={{ width: '8px', height: '8px', borderRadius: '50%', background: ctx.loadError ? '#dc2626' : '#10b981' }} />
              <span>{ctx.loadError ? 'Connection problem' : 'Live'}{lastSyncedAt ? ` · updated ${lastSyncedAt.toLocaleTimeString('en-GB')}` : ''}</span>
            </span>
            {actions}
          </div>
        </header>

        <main className="content-body">
          {isFiltered ? (
            <div className="period-filter-alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1.5px solid #7dd3fc', borderLeft: '5px solid #0284c7', padding: '10px 16px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(2, 132, 199, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#0369a1' }}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <div>
                  <strong>Active Period Filter:</strong> <span style={{ fontWeight: 700, color: '#0c4a6e' }}>{period.label}</span>
                  <span style={{ color: '#0284c7', marginLeft: '6px', fontSize: '12px' }}>({period.start} to {period.end})</span>
                  <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: '8px' }}>— Showing records within this date range</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button type="button" onClick={openCustom} className="btn btn-sm" style={{ background: '#ffffff', border: '1px solid #7dd3fc', color: '#0284c7', fontWeight: 700, fontSize: '11.5px', padding: '4px 10px', cursor: 'pointer', borderRadius: '5px' }}>
                  ✏️ Change Dates
                </button>
                <a href="#all" onClick={e => { e.preventDefault(); savePeriod({ key: 'all' }) }} className="btn btn-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontWeight: 700, fontSize: '11.5px', padding: '4px 10px', textDecoration: 'none', borderRadius: '5px' }}>
                  ✕ Reset to All Time
                </a>
              </div>
            </div>
          ) : null}

          {ctx.loadError ? (
            <div className="flash-container">
              <div className="alert alert-danger"><span>{ctx.loadError}</span></div>
            </div>
          ) : null}

          {renderPage()}
        </main>
      </div>

      <div className={`modal-overlay${customOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setCustomOpen(false) }}>
        <form
          className="modal-container"
          style={{ maxWidth: '460px' }}
          onSubmit={e => {
            e.preventDefault()
            if (!draft.start || !draft.end) return
            savePeriod({ key: 'custom', start: draft.start <= draft.end ? draft.start : draft.end, end: draft.start <= draft.end ? draft.end : draft.start })
            setCustomOpen(false)
          }}
        >
          <div className="modal-header">
            <h3 className="modal-title">📅 Custom Operating Period</h3>
            <button type="button" className="modal-close" onClick={() => setCustomOpen(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="classic-period-start">Start Date</label>
                <input id="classic-period-start" type="date" className="form-control" required value={draft.start} onChange={e => setDraft(d => ({ ...d, start: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="classic-period-end">End Date</label>
                <input id="classic-period-end" type="date" className="form-control" required value={draft.end} onChange={e => setDraft(d => ({ ...d, end: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCustomOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Apply Period</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClassicComingSoon({ title }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">🛠️ {title}</h2>
      </div>
      <div className="card-body">
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>This page is not available.</p>
      </div>
    </div>
  )
}

export default ClassicApp
