import { useMemo, useState } from 'react'
import { act, currency, day, inPeriod, matches, num } from '../format'

// Port of templates/payables.html (Suppliers & Accounts Payable).
function pad(prefix, id) {
  return /^\d+$/.test(String(id)) ? `${prefix}-${String(id).padStart(4, '0')}` : String(id)
}
function title(v) {
  return String(v || '').replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase())
}

function ClassicPayables({ ctx, period }) {
  const { data, purchaseOutstandingOf } = ctx
  const [supplierSearch, setSupplierSearch] = useState('')
  const [purchaseSearch, setPurchaseSearch] = useState('')

  const suppliers = useMemo(() => data.suppliers.map(s => {
    const purchases = data.purchases.filter(p => String(p.supplier) === String(s.id))
    return {
      s,
      total: purchases.reduce((t, p) => t + num(p.total_amount), 0),
      paid: purchases.reduce((t, p) => t + num(p.total_paid), 0),
      due: purchases.reduce((t, p) => t + purchaseOutstandingOf(p), 0),
    }
  }), [data.suppliers, data.purchases, purchaseOutstandingOf])

  const purchases = useMemo(() => data.purchases
    .filter(p => inPeriod(p.purchase_date, period))
    .map(p => {
      const latest = [...(p.payments || [])].sort((a, b) => day(b.payment_date).localeCompare(day(a.payment_date)))[0]
      return { p, ref: pad('PUR', p.id), due: purchaseOutstandingOf(p), method: latest?.payment_method || '' }
    })
    .sort((a, b) => day(b.p.purchase_date).localeCompare(day(a.p.purchase_date)) || num(b.p.id) - num(a.p.id)), [data.purchases, period, purchaseOutstandingOf])

  const shownSuppliers = suppliers.filter(r => matches(supplierSearch, r.s.name, r.s.item_category_name, r.s.phone, pad('SUP', r.s.id)))
  const shownPurchases = purchases.filter(r => matches(purchaseSearch, r.ref, r.p.supplier_name, r.p.category, r.method, day(r.p.purchase_date)))

  return (
    <>
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <h2 className="card-title" style={{ marginBottom: 0 }}>🚚 Raw Material Suppliers Directory &amp; AP</h2>
            <input type="text" className="form-control" placeholder="🔍 Search suppliers, categories..." style={{ maxWidth: '320px', fontSize: '13px' }} value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Suppliers: <strong>{shownSuppliers.length}</strong></div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center">Supplier ID</th>
                <th>Supplier Name</th>
                <th className="text-center">Category</th>
                <th className="text-center">Phone</th>
                <th className="text-right">Total Purchases</th>
                <th className="text-right">Total Paid</th>
                <th className="text-right">Outstanding AP</th>
                <th className="text-center">Status</th>
                {ctx.canEdit ? <th className="text-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shownSuppliers.map(r => (
                <tr key={r.s.id}>
                  <td className="text-center"><span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{pad('SUP', r.s.id)}</span></td>
                  <td><strong>{r.s.name}</strong></td>
                  <td className="text-center">{r.s.item_category_name || 'Raw Materials'}</td>
                  <td className="text-center">{r.s.phone || '-'}</td>
                  <td className="text-right"><strong>{currency(r.total)}</strong></td>
                  <td className="text-right" style={{ color: '#059669' }}>{currency(r.paid)}</td>
                  <td className="text-right">{r.due > 0.005 ? <strong style={{ color: '#dc2626' }}>{currency(r.due)}</strong> : <span style={{ color: '#64748b' }}>GHS 0.00</span>}</td>
                  <td className="text-center">{r.due > 0.005 ? <span className="badge badge-warning">AP Outstanding</span> : <span className="badge badge-success">Fully Settled</span>}</td>
                  {ctx.canEdit ? (
                    <td className="text-center"><button type="button" className="btn btn-sm btn-secondary" onClick={() => ctx.openModal('supplier', r.s)} style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 600 }}>✏️ Edit</button></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <h3 className="card-title" style={{ marginBottom: 0 }}>📦 Recent Supplier Deliveries &amp; Purchases</h3>
            <input type="text" className="form-control" placeholder="🔍 Search purchases, refs, suppliers..." style={{ maxWidth: '320px', fontSize: '13px' }} value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Purchases: <strong>{shownPurchases.length}</strong></div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center">Purchase Ref</th>
                <th className="text-center">Date</th>
                <th>Supplier</th>
                <th className="text-center">Category</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Amount Paid</th>
                <th className="text-right">Outstanding</th>
                <th className="text-center">Payment Method</th>
                <th className="text-center">Status</th>
                {ctx.canEdit ? <th className="text-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shownPurchases.map(r => (
                <tr key={r.p.id}>
                  <td className="text-center"><strong style={{ color: 'var(--primary)' }}>{r.ref}</strong></td>
                  <td className="text-center">{day(r.p.purchase_date)}</td>
                  <td><strong>{r.p.supplier_name}</strong></td>
                  <td className="text-center">{title(r.p.category)}</td>
                  <td className="text-right"><strong>{currency(r.p.total_amount)}</strong></td>
                  <td className="text-right" style={{ color: '#059669' }}>{currency(r.p.total_paid)}</td>
                  <td className="text-right">{r.due > 0.005 ? <strong style={{ color: '#dc2626' }}>{currency(r.due)}</strong> : <span style={{ color: '#64748b' }}>GHS 0.00</span>}</td>
                  <td className="text-center">
                    <span className={`badge ${/momo/i.test(r.method) ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '11px' }}>{title(r.method) || 'Cash'}</span>
                  </td>
                  <td className="text-center">{String(r.p.status).toLowerCase() === 'paid' ? <span className="badge badge-success">Paid</span> : <span className="badge badge-warning">{r.p.status}</span>}</td>
                  {ctx.canEdit ? (
                    <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                      <a href="#edit" onClick={act(() => ctx.openModal('purchase', r.p))} className="btn btn-sm btn-secondary" style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 600 }}>✏️ Edit</a>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default ClassicPayables
