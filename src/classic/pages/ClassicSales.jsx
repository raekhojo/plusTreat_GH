import { useMemo, useState } from 'react'
import { act, currency, day, inPeriod, invoiceStatus, litresOf, matches, num, qty } from '../format'

// Port of templates/sales.html (Sales, Invoicing & Orders Log).
const STATUS_PILLS = [
  { key: 'fully_paid', label: '🟢 Fully Paid', color: '#059669' },
  { key: 'partially_paid', label: '🟡 Partial', color: '#d97706' },
  { key: 'pending', label: '🔴 Pending', color: '#dc2626' },
  { key: 'sample', label: '🔵 Sample', color: '#0284c7' },
]
const STATUS_TAG = { fully_paid: ['badge-success', 'Fully Paid'], partially_paid: ['badge-warning', 'Partial'], pending: ['badge-danger', 'Pending'], sample: ['badge-info', 'Sample'] }
const PILL_STYLE = { padding: '3px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px' }
const PILL_X = { background: 'rgba(255,255,255,0.3)', borderRadius: '50%', width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', marginLeft: '2px' }

function ClassicSales({ ctx, period, onStatement }) {
  const { data, outstandingOf, paidOf, invNo } = ctx
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => data.invoices
    .filter(inv => inPeriod(inv.invoice_date, period))
    .map(inv => {
      const due = outstandingOf(inv)
      const paid = paidOf(inv)
      const lines = inv.lines || []
      return {
        inv,
        number: invNo(inv.id),
        due,
        paid,
        status: invoiceStatus(inv, due, paid),
        items: lines.map(l => `${l.product_size} x${qty(l.quantity)}`).join(', '),
        bottles: lines.reduce((t, l) => t + num(l.quantity), 0),
        litres: lines.reduce((t, l) => t + litresOf(l.product_size, l.quantity), 0),
      }
    })
    .sort((a, b) => day(b.inv.invoice_date).localeCompare(day(a.inv.invoice_date)) || num(b.inv.id) - num(a.inv.id)), [data.invoices, period, outstandingOf, paidOf, invNo])

  const counts = useMemo(() => {
    const c = { all: rows.length, fully_paid: 0, partially_paid: 0, pending: 0, sample: 0 }
    rows.forEach(r => { c[r.status] += 1 })
    return c
  }, [rows])

  const summary = useMemo(() => {
    const billed = rows.reduce((t, r) => t + num(r.inv.total_amount), 0)
    const collected = rows.reduce((t, r) => t + r.paid, 0)
    return {
      billed,
      collected,
      rate: billed > 0 ? (collected / billed) * 100 : 0,
      outstanding: rows.reduce((t, r) => t + r.due, 0),
      open: rows.filter(r => r.due > 0.005).length,
      litres: rows.reduce((t, r) => t + r.litres, 0),
      bottles: rows.reduce((t, r) => t + r.bottles, 0),
    }
  }, [rows])

  const shown = rows.filter(r => (!status || r.status === status) && matches(search, r.number, r.inv.customer_name, r.items, r.inv.notes, day(r.inv.invoice_date)))
  const statusLabel = STATUS_PILLS.find(p => p.key === status)?.label.slice(3)

  return (
    <>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '24px' }}>
        <div className="kpi-card" style={{ borderTop: '3px solid var(--primary)' }}>
          <div className="kpi-header">
            <div className="kpi-label">Gross Billed Sales</div>
            <div className="kpi-icon" style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)' }}>💰</div>
          </div>
          <div className="kpi-value">{currency(summary.billed)}</div>
          <div className="kpi-subtext">Across <strong>{counts.all}</strong> total orders</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '3px solid #059669' }}>
          <div className="kpi-header">
            <div className="kpi-label">Cash Collected</div>
            <div className="kpi-icon" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>💳</div>
          </div>
          <div className="kpi-value" style={{ color: '#059669' }}>{currency(summary.collected)}</div>
          <div className="kpi-subtext"><strong>{summary.rate.toFixed(1)}%</strong> collection rate ({counts.fully_paid} paid)</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '3px solid #dc2626' }}>
          <div className="kpi-header">
            <div className="kpi-label">Outstanding Receivables (AR)</div>
            <div className="kpi-icon" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}>⏳</div>
          </div>
          <div className="kpi-value" style={{ color: summary.outstanding > 0 ? '#dc2626' : 'var(--text-muted)' }}>{currency(summary.outstanding)}</div>
          <div className="kpi-subtext"><strong style={{ color: '#dc2626' }}>{summary.open}</strong> open invoices due</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '3px solid #8b5cf6' }}>
          <div className="kpi-header">
            <div className="kpi-label">Total Volume Sold</div>
            <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>🥛</div>
          </div>
          <div className="kpi-value" style={{ color: '#6d28d9' }}>{summary.litres.toFixed(1)} L</div>
          <div className="kpi-subtext"><strong>{Math.trunc(summary.bottles)}</strong> packaged bottles delivered</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '340px' }}>
              <input type="text" className="form-control" placeholder="🔍 Search invoice #, customer, items..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="classicStatusFilter" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 0 }}>STATUS:</label>
              <select id="classicStatusFilter" className="form-control" style={{ width: 'auto', minWidth: '185px', fontWeight: 600 }} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All Statuses ({counts.all})</option>
                <option value="fully_paid">🟢 Fully Paid ({counts.fully_paid})</option>
                <option value="partially_paid">🟡 Partial ({counts.partially_paid})</option>
                <option value="pending">🔴 Pending / Issued ({counts.pending})</option>
                <option value="sample">🔵 Sample / Staff ({counts.sample})</option>
              </select>
            </div>
            {status ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_TAG[status][0]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', fontSize: '11.5px', fontWeight: 600 }}>
                  Status: {statusLabel}
                  <a href="#clear" onClick={act(() => setStatus(''))} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 'bold', marginLeft: '2px' }} title="Remove Status filter">✕</a>
                </span>
                <a href="#reset" onClick={act(() => setStatus(''))} className="btn btn-sm btn-secondary" style={{ fontSize: '11.5px', padding: '3px 8px' }}>Reset Filter</a>
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Showing Invoices: <strong style={{ color: 'var(--text-main)' }}>{shown.length}</strong> of <strong>{counts.all}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '9px 18px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter by Status:</span>
          <a href="#all" onClick={act(() => setStatus(''))} className={`btn btn-sm ${!status ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '3px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '16px' }}>All ({counts.all})</a>
          {STATUS_PILLS.map(p => {
            const on = status === p.key
            return (
              <a key={p.key} href={`#${p.key}`} onClick={act(() => setStatus(on ? '' : p.key))} className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`} style={{ ...PILL_STYLE, ...(on ? { background: p.color, borderColor: p.color, color: 'white' } : null) }} title={on ? 'Click to clear filter' : `Filter by ${p.label.slice(3)}`}>
                {p.label} ({counts[p.key]})
                {on ? <span style={PILL_X}>✕</span> : null}
              </a>
            )
          })}
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center">Invoice #</th>
                <th className="text-center">Date</th>
                <th>Customer</th>
                <th>Items Summary</th>
                <th className="text-right">Total Billed</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance Due</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!shown.length ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--secondary)' }}>No invoices found matching the selected status.</div>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Try selecting another status or <a href="#all" onClick={act(() => { setStatus(''); setSearch('') })} style={{ color: 'var(--primary)', fontWeight: 600 }}>view all invoices</a>.</div>
                  </td>
                </tr>
              ) : null}
              {shown.map(r => (
                <tr key={r.inv.id}>
                  <td className="text-center"><strong style={{ color: 'var(--primary)' }}>{r.number}</strong></td>
                  <td className="text-center">{day(r.inv.invoice_date)}</td>
                  <td>
                    <a href="#statement" onClick={act(() => onStatement(r.inv.customer))} style={{ color: 'var(--secondary)', fontWeight: 600, textDecoration: 'none' }}>{r.inv.customer_name}</a>
                  </td>
                  <td style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '250px' }}>{r.items || r.inv.notes || 'General line'}</td>
                  <td className="text-right"><strong>{currency(r.inv.total_amount)}</strong></td>
                  <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>{currency(r.paid)}</td>
                  <td className="text-right">
                    {r.due > 0.005 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{currency(r.due)}</span> : <span style={{ color: '#64748b' }}>GHS 0.00</span>}
                  </td>
                  <td className="text-center"><span className={`badge ${STATUS_TAG[r.status][0]}`}>{STATUS_TAG[r.status][1]}</span></td>
                  <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                      <a href="#view" onClick={act(() => ctx.viewInvoice(r.inv))} className="btn btn-sm btn-secondary" title="View / Print Invoice">🧾 View</a>
                      {ctx.canManageSales ? (
                        <a href="#edit" onClick={act(() => ctx.openModal('sale', r.inv))} className="btn btn-sm btn-secondary" style={{ color: 'var(--primary)', fontWeight: 600 }} title="Edit Sale">✏️ Edit</a>
                      ) : null}
                      {ctx.canManageSales && r.due > 0.005 ? (
                        <button type="button" className="btn btn-sm btn-secondary" style={{ color: '#059669', fontWeight: 600, borderColor: '#a7f3d0', background: '#ecfdf5' }} onClick={() => ctx.openModal('receipt', { invoice: r.inv.id, amount: r.due.toFixed(2) })} title="Add Sales Receipt">💰 Receipt</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default ClassicSales
