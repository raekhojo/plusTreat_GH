import { useMemo, useState } from 'react'
import { DEFAULT_COMPANY_PROFILE, getCompanyProfile, printInvoice, saveCompanyProfile } from '../../lib/printDocuments'
import { currency, num, unitCostBySize } from '../format'

// Port of templates/settings.html (ERP Configuration & Master Pricing Matrix).
// The reference's Google Sheets mirror does not exist in this app (it reads the
// live API directly), so that card shows the live connection instead.
const API_HOST = (() => {
  try { return new URL(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').host } catch { return 'API' }
})()

const SAMPLE_INVOICE = {
  id: 1, invoice_date: new Date().toISOString().slice(0, 10), customer_name: 'Sample Customer', staff_name: 'Preview',
  subtotal: 450, discount_amount: 0, total_amount: 450, previous_balance: 0, outstanding_balance: 450,
  lines: [
    { product_size: '500ml', pricing_category: 'Wholesale Price', unit_price: 20, quantity: 15, line_total: 300 },
    { product_size: '350ml', pricing_category: 'Wholesale Price', unit_price: 15, quantity: 10, line_total: 150 },
  ],
}

function PriceRow({ rule, unitCost, canEdit, onSave }) {
  const [value, setValue] = useState(String(num(rule.price)))
  const [state, setState] = useState('')
  const price = num(rule.price)
  const save = async e => {
    e.preventDefault()
    setState('saving')
    try { await onSave(rule, value); setState('saved') } catch (err) { setState(err.message || 'Failed') }
  }
  return (
    <tr>
      <td><strong>{rule.size || rule.product_name}</strong></td>
      <td className="text-center"><span className="badge badge-secondary">{rule.pricing_category_name || '-'}</span></td>
      <td className="text-right">{currency(unitCost)}</td>
      <td className="text-right"><strong style={{ color: 'var(--primary)' }}>{currency(price)}</strong></td>
      <td className="text-right" style={{ color: price - unitCost >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
        {currency(price - unitCost)}
        {price > 0 ? ` (${(((price - unitCost) / price) * 100).toFixed(1)}%)` : ''}
      </td>
      <td className="text-center">
        {canEdit ? (
          <form onSubmit={save} style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
            <input type="number" step="0.5" value={value} onChange={e => { setValue(e.target.value); setState('') }} className="form-control text-right" style={{ width: '100px', padding: '4px 8px', fontSize: '13px' }} aria-label={`Price for ${rule.size} ${rule.pricing_category_name}`} />
            <button type="submit" className="btn btn-sm btn-secondary" disabled={state === 'saving'}>{state === 'saving' ? '…' : state === 'saved' ? 'Saved ✓' : 'Save'}</button>
          </form>
        ) : '-'}
        {state && !['saving', 'saved'].includes(state) ? <div style={{ fontSize: '11px', color: '#dc2626' }}>{state}</div> : null}
      </td>
    </tr>
  )
}

export function StaffTable({ staff, onEdit }) {
  return (
    <table>
      <thead>
        <tr>
          <th className="text-center">Username</th>
          <th>Full Name</th>
          <th>Email</th>
          <th className="text-center">Role</th>
          <th className="text-center">Phone</th>
          <th className="text-center">Account Status</th>
          {onEdit ? <th className="text-center">Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {staff.map(p => (
          <tr key={p.id}>
            <td className="text-center"><strong style={{ color: 'var(--secondary)' }}>{p.user?.username}</strong></td>
            <td>{[p.user?.first_name, p.user?.last_name].filter(Boolean).join(' ') || '-'}</td>
            <td>{p.user?.email || '-'}</td>
            <td className="text-center">
              {p.role === 'admin' ? <span className="badge badge-danger">Admin</span> : p.role === 'accounts' ? <span className="badge badge-warning">Accounts</span> : <span className="badge badge-secondary">{p.role}</span>}
            </td>
            <td className="text-center">{p.phone || '-'}</td>
            <td className="text-center">{p.user?.is_active !== false ? <span className="badge badge-success">Active</span> : <span className="badge badge-secondary">Inactive</span>}</td>
            {onEdit ? <td className="text-center"><button type="button" className="btn btn-sm btn-secondary" onClick={() => onEdit(p)}>✏️ Edit</button></td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ClassicSettings({ ctx, lastSyncedAt }) {
  const { data } = ctx
  const cost = useMemo(() => unitCostBySize(data.productionBatches), [data.productionBatches])
  const rules = useMemo(() => [...data.pricingRules].sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }) || String(a.pricing_category_name).localeCompare(String(b.pricing_category_name))), [data.pricingRules])
  const sizes = new Set(rules.map(r => r.size)).size
  const tiers = new Set(rules.map(r => r.pricing_category_name)).size
  const [doc, setDoc] = useState(() => {
    const p = getCompanyProfile()
    return { name: p.name, phone: p.phone, email: p.email, social: p.social, momo: (p.momo.lines || []).join('\n'), bank: (p.bank.lines || []).join('\n'), thankYou: p.thankYou }
  })
  const [docMsg, setDocMsg] = useState('')
  const lines = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean)
  const buildProfile = () => ({
    ...DEFAULT_COMPANY_PROFILE,
    name: doc.name.trim() || DEFAULT_COMPANY_PROFILE.name,
    phone: doc.phone.trim(),
    email: doc.email.trim(),
    social: doc.social.trim(),
    momo: { ...DEFAULT_COMPANY_PROFILE.momo, lines: lines(doc.momo) },
    bank: { ...DEFAULT_COMPANY_PROFILE.bank, lines: lines(doc.bank) },
    thankYou: doc.thankYou.trim() || DEFAULT_COMPANY_PROFILE.thankYou,
  })
  const setField = (k, v) => setDoc(d => ({ ...d, [k]: v }))

  return (
    <>
      <div className="card" style={{ marginBottom: '28px', borderLeft: '5px solid #10b981', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '18px 24px' }}>
          <div>
            <h2 className="card-title" style={{ color: 'var(--secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><span>☁️ Live Cloud Database Connection</span></h2>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              This system reads and writes directly to the live cloud API at <strong>{API_HOST}</strong>. Figures refresh automatically every 20 seconds and whenever you return to the app.
            </div>
          </div>
          <span className="badge badge-success" style={{ padding: '8px 14px', fontSize: '12px' }}>● Live{lastSyncedAt ? ` · updated ${lastSyncedAt.toLocaleTimeString('en-GB')}` : ''}</span>
        </div>
        <div className="card-body" style={{ padding: '18px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {[
              ['Source Cloud API', API_HOST, ctx.loadError ? '● Connection problem' : '● Online & Authenticated', !ctx.loadError, true],
              ['Records Loaded', `${data.invoices.length} invoices · ${data.customers.length} customers`, `${data.productionBatches.length} batches · ${data.accountTransactions.length} account entries`, null],
              ['Storage', 'Live server database', '● Every save goes straight to the server', true],
              ['Sync Mode', '● Live (no local copy)', 'Auto-refresh every 20 seconds', null],
            ].map(([label, value, note, good, mono]) => (
              <div key={label} style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: label === 'Sync Mode' ? '#166534' : 'var(--secondary)', marginTop: '4px', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
                <div style={{ fontSize: '11px', color: good === true ? '#059669' : good === false ? '#dc2626' : 'var(--text-muted)', marginTop: '2px' }}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <h2 className="card-title">💲 Master Pricing Rules Matrix (All {sizes} Sizes × {tiers} Tiers)</h2>
          {ctx.canEdit ? <button type="button" className="btn btn-sm btn-primary" onClick={() => ctx.openModal('pricing')}>+ Add Pricing Rule</button> : null}
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Product Size</th>
                <th className="text-center">Pricing Tier</th>
                <th className="text-right">Unit Production Cost</th>
                <th className="text-right">Selling Price</th>
                <th className="text-right">Gross Margin</th>
                <th className="text-center">Update Price</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => <PriceRow key={r.id} rule={r} unitCost={cost.get(r.size) || 0} canEdit={ctx.canEdit} onSave={ctx.savePrice} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '28px', borderLeft: '5px solid #00b0ff' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ color: '#0f172a' }}>🧾 Invoice, Receipt &amp; Statement Details</h2>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Company details printed on every invoice, receipt, statement and report.</div>
          </div>
        </div>
        <form className="card-body" onSubmit={e => { e.preventDefault(); saveCompanyProfile(buildProfile()); setDocMsg('Saved. New documents will use these details.') }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Company Name</label><input className="form-control" value={doc.name} onChange={e => setField('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={doc.phone} onChange={e => setField('phone', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={doc.email} onChange={e => setField('email', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Social Handle</label><input className="form-control" value={doc.social} onChange={e => setField('social', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Mobile Money Details (one per line)</label><textarea className="form-control" rows={4} value={doc.momo} onChange={e => setField('momo', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Bank Transfer Details (one per line)</label><textarea className="form-control" rows={4} value={doc.bank} onChange={e => setField('bank', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Thank-you Banner</label><input className="form-control" value={doc.thankYou} onChange={e => setField('thankYou', e.target.value)} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <span style={{ fontSize: '12.5px', color: '#059669', fontWeight: 600 }}>{docMsg}</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { saveCompanyProfile(buildProfile()); printInvoice(SAMPLE_INVOICE) }}>👁️ Preview Invoice</button>
              <button type="submit" className="btn btn-primary">Save Document Details</button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">👥 Authorized Staff &amp; User Access</h3>
          {ctx.canAccess?.('user_mgmt') ? <button type="button" className="btn btn-sm btn-secondary" onClick={() => ctx.goTo('user_mgmt')}>Manage Users →</button> : null}
        </div>
        <div className="table-responsive">
          <StaffTable staff={data.staffProfiles || []} />
        </div>
      </div>
    </>
  )
}

export default ClassicSettings
