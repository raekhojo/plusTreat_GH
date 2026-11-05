import { useMemo, useState } from 'react'
import { act, currency, day, inPeriod, invoiceStatus, matches, num } from '../format'

// Port of templates/receivables.html (Receivables & Debtors Ledger) and customer_statement.html.
function daysSince(raw) {
  const d = new Date(`${day(raw)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function useCustomerLedger(ctx, period) {
  const { data, outstandingOf, paidOf } = ctx
  return useMemo(() => data.customers.map(c => {
    const invoices = data.invoices.filter(inv => String(inv.customer) === String(c.id) && inPeriod(inv.invoice_date, period))
    const billed = invoices.reduce((t, inv) => t + num(inv.previous_balance) + num(inv.total_amount), 0)
    const due = invoices.reduce((t, inv) => t + outstandingOf(inv), 0)
    return {
      c,
      invoices,
      billed,
      paid: invoices.reduce((t, inv) => t + paidOf(inv), 0),
      due,
      open: invoices.filter(inv => outstandingOf(inv) > 0.005).length,
    }
  }).sort((a, b) => b.due - a.due || String(a.c.name).localeCompare(String(b.c.name))), [data.customers, data.invoices, outstandingOf, paidOf, period])
}

function ClassicReceivables({ ctx, period, onStatement }) {
  const { data, outstandingOf, otherReceivables } = ctx
  const [tab, setTab] = useState('trade')
  const [search, setSearch] = useState('')
  const [otherSearch, setOtherSearch] = useState('')
  const ledger = useCustomerLedger(ctx, period)
  const totalAr = ledger.reduce((t, r) => t + r.due, 0)
  // Staff & home advances: movements dated in the period (lifetime when "All Time").
  const other = useMemo(() => {
    const rows = (otherReceivables.statement || []).filter(r => inPeriod(r.date, period))
    const totalIn = rows.reduce((t, r) => t + num(r.inflow), 0)
    const totalOut = rows.reduce((t, r) => t + num(r.outflow), 0)
    return period?.key === 'all' ? otherReceivables : { statement: rows, totalIn, totalOut, balance: totalIn - totalOut }
  }, [otherReceivables, period])

  const ageing = useMemo(() => {
    const a = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    data.invoices.forEach(inv => {
      const due = outstandingOf(inv)
      if (due <= 0.005 || !inPeriod(inv.invoice_date, period)) return
      const age = daysSince(inv.invoice_date)
      a[age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+'] += due
    })
    return a
  }, [data.invoices, outstandingOf, period])

  const shownCustomers = ledger.filter(r => matches(search, r.c.name, r.c.phone, r.c.customer_category_name, r.c.pricing_category))
  const otherRows = (other.statement || []).filter(r => matches(otherSearch, r.reference, r.description, r.counterpart, day(r.date)))
  const AGE = [
    ['0-30', '0 - 30 Days (Current)', 'Normal trade terms', '#ecfdf5', '#a7f3d0', '#065f46', '#047857'],
    ['31-60', '31 - 60 Days', 'Follow up reminder', '#fffbeb', '#fde68a', '#92400e', '#b45309'],
    ['61-90', '61 - 90 Days', 'Credit hold recommended', '#fff7ed', '#fed7aa', '#c2410c', '#ea580c'],
    ['90+', '90+ Days (Severe Overdue)', 'Doubtful debt review', '#fef2f2', '#fecaca', '#991b1b', '#dc2626'],
  ]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #b91c1c', padding: '18px 22px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>🏢 Customer Trade Debtors (AR)</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>{currency(totalAr)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Outstanding customer yogurt deliveries ({ledger.length} clients tracked)</div>
        </div>
        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #6366f1', padding: '18px 22px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>📋 Other Receivables (Home &amp; Staff Advances)</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#4338ca', marginTop: '4px' }}>{currency(other.balance)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Advances &amp; float balances (Issued: {currency(other.totalIn)} | Repaid: {currency(other.totalOut)})</div>
        </div>
        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #059669', padding: '18px 22px', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#047857' }}>💰 Total Overall Receivables</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#065f46', marginTop: '4px' }}>{currency(totalAr + other.balance)}</div>
          <div style={{ fontSize: '12px', color: '#047857', marginTop: '8px' }}>Complete company credit exposure across commercial and internal advances</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '2px solid var(--border)', paddingBottom: '6px' }}>
        <button type="button" className={`btn ${tab === 'trade' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('trade')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🏢 Customer Trade Debtors</span>
          <span className={tab === 'trade' ? 'badge' : 'badge badge-primary'} style={tab === 'trade' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : null}>{ledger.length}</span>
        </button>
        <button type="button" className={`btn ${tab === 'other' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('other')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📋 Other Receivables (Advances &amp; Refunds)</span>
          <span className={tab === 'other' ? 'badge' : 'badge badge-primary'} style={tab === 'other' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : null}>{(other.statement || []).length}</span>
        </button>
      </div>

      {tab === 'trade' ? (
        <div>
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h2 className="card-title">⏳ Customer Debt Ageing Analysis</h2>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#b91c1c' }}>Total Outstanding Trade AR: {currency(totalAr)}</div>
            </div>
            <div className="card-body" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {AGE.map(([key, label, note, bg, border, ink, noteInk]) => (
                  <div key={key} style={{ background: bg, border: `1px solid ${border}`, padding: '14px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: ink }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: ink }}>{currency(ageing[key])}</div>
                    <div style={{ fontSize: '11px', color: noteInk }}>{note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <input type="text" className="form-control" placeholder="🔍 Search customers..." style={{ maxWidth: '380px' }} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Customers: <strong>{ledger.length}</strong></div>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th className="text-center">Category</th>
                    <th className="text-center">Default Tier</th>
                    <th className="text-center">Phone</th>
                    <th className="text-right">Total Billed</th>
                    <th className="text-right">Total Paid</th>
                    <th className="text-right">Balance Owing</th>
                    <th className="text-center">Open Invoices</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shownCustomers.map(r => (
                    <tr key={r.c.id}>
                      <td><a href="#statement" onClick={act(() => onStatement(r.c.id))} style={{ color: 'var(--secondary)', fontWeight: 700, textDecoration: 'none' }}>{r.c.name}</a></td>
                      <td className="text-center">{r.c.customer_category_name || 'Customer'}</td>
                      <td className="text-center">{r.c.pricing_category || '-'}</td>
                      <td className="text-center">{r.c.phone || '-'}</td>
                      <td className="text-right"><strong>{currency(r.billed)}</strong></td>
                      <td className="text-right" style={{ color: '#059669' }}>{currency(r.paid)}</td>
                      <td className="text-right">{r.due > 0.005 ? <strong style={{ color: '#b91c1c', fontSize: '14.5px' }}>{currency(r.due)}</strong> : <span style={{ color: '#64748b' }}>GHS 0.00</span>}</td>
                      <td className="text-center">{r.open > 0 ? <span className="badge badge-warning">{r.open} open</span> : <span className="badge badge-success">Clear</span>}</td>
                      <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <a href="#statement" onClick={act(() => onStatement(r.c.id))} className="btn btn-sm btn-secondary">📜 Statement</a>
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => ctx.openModal('customer', r.c)}>✏️ Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.15)' }}>
              <div>
                <h2 className="card-title" style={{ color: '#3730a3' }}>📋 Other Receivables &amp; Advances Account (ACC-00062-06)</h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Tracks company funds advanced for Home Expenses, staff advances, and repayments back to liquid wallets.</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <a href="#cashbook" onClick={act(() => ctx.goTo('treasury'))} className="btn btn-sm btn-secondary">Go to Cashbook →</a>
              </div>
            </div>
            <div className="card-body" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ background: '#fff', border: '1px solid #fed7aa', padding: '14px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#9a3412' }}>Total Advances Issued</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#c2410c', marginTop: '4px' }}>{currency(other.totalIn)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cumulative funds advanced</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #bbf7d0', padding: '14px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#166534' }}>Total Refunds Recovered</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>{currency(other.totalOut)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cash &amp; MoMo repayments returned</div>
                </div>
                <div style={{ background: '#eef2ff', border: '2px solid #6366f1', padding: '14px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: '#4338ca' }}>Current Outstanding Balance</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#3730a3', marginTop: '4px' }}>{currency(other.balance)}</div>
                  <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '2px' }}>Net company asset claim</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <input type="text" className="form-control" placeholder="🔍 Search Other Receivables entries..." style={{ maxWidth: '380px' }} value={otherSearch} onChange={e => setOtherSearch(e.target.value)} />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Ledger Entries: <strong>{(other.statement || []).length}</strong></div>
            </div>
            <div className="table-responsive">
              <OtherReceivablesTable rows={otherRows} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function OtherReceivablesTable({ rows }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th className="text-center">Date</th>
          <th className="text-center">Reference</th>
          <th className="text-center">Transaction Nature</th>
          <th className="text-center">Wallet Channel</th>
          <th className="text-right">Advance (+)</th>
          <th className="text-right">Refund / Repaid (-)</th>
          <th className="text-right">Running Balance</th>
          <th>Description / Remarks</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td className="text-center">{day(r.date)}</td>
            <td className="text-center"><strong style={{ color: 'var(--primary)' }}>{r.reference || `#${r.id}`}</strong></td>
            <td className="text-center">
              {r.kind === 'in'
                ? <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>↗ Advance Issued</span>
                : <span className="badge badge-success" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>↙ Refund Received</span>}
            </td>
            <td className="text-center"><strong>{r.counterpart || '-'}</strong></td>
            <td className="text-right" style={{ color: '#c2410c', fontWeight: 600 }}>{r.inflow > 0 ? `+${currency(r.inflow)}` : '-'}</td>
            <td className="text-right" style={{ color: '#15803d', fontWeight: 600 }}>{r.outflow > 0 ? `-${currency(r.outflow)}` : '-'}</td>
            <td className="text-right" style={{ fontWeight: 800, color: '#3730a3', fontSize: '13.5px' }}>{currency(r.balance)}</td>
            <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{r.description || r.comments || '-'}</td>
          </tr>
        ))}
        {!rows.length ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No Other Receivables entries recorded.</td></tr> : null}
      </tbody>
    </table>
  )
}

// Port of templates/customer_statement.html.
export function ClassicStatement({ ctx, customerId }) {
  const { data, outstandingOf, paidOf, invNo } = ctx
  const customer = data.customers.find(c => String(c.id) === String(customerId))
  const invoices = useMemo(() => data.invoices
    .filter(inv => String(inv.customer) === String(customerId))
    .sort((a, b) => day(b.invoice_date).localeCompare(day(a.invoice_date)) || num(b.id) - num(a.id)), [data.invoices, customerId])
  const ids = new Set(invoices.map(inv => String(inv.id)))
  const payments = data.payments.filter(p => ids.has(String(p.invoice))).sort((a, b) => day(b.payment_date).localeCompare(day(a.payment_date)))
  if (!customer) return <div className="card"><div className="card-body">Customer not found.</div></div>
  const billed = invoices.reduce((t, inv) => t + num(inv.previous_balance) + num(inv.total_amount), 0)
  const due = invoices.reduce((t, inv) => t + outstandingOf(inv), 0)
  const paid = invoices.reduce((t, inv) => t + paidOf(inv), 0)
  const TAG = { fully_paid: ['badge-success', 'Paid'], partially_paid: ['badge-warning', 'Partial'], sample: ['badge-info', 'Sample'], pending: ['badge-danger', 'Pending'] }
  const METHOD = { cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', ghanapay: 'GhanaPay', other: 'Other' }

  return (
    <>
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--secondary)' }}>{customer.name}</h2>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Category: <strong>{customer.customer_category_name || 'Customer'}</strong> • Pricing Tier: <strong>{customer.pricing_category || 'Wholesale Price'}</strong> • Phone: <strong>{customer.phone || 'N/A'}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Lifetime Billed</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--secondary)' }}>{currency(billed)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Total Paid</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>{currency(paid)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Current Balance Due</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: due > 0.005 ? '#dc2626' : '#059669' }}>{currency(due)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">📜 Invoices &amp; Orders Ledger</h3></div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th className="text-center">Invoice #</th><th className="text-center">Date</th><th className="text-right">Total Billed</th><th className="text-right">Paid</th>
                <th className="text-right">Balance Due</th><th className="text-center">Status</th><th>Notes</th><th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const d = outstandingOf(inv)
                const p = paidOf(inv)
                const [cls, label] = TAG[invoiceStatus(inv, d, p)]
                return (
                  <tr key={inv.id}>
                    <td className="text-center"><strong style={{ color: 'var(--primary)' }}>{invNo(inv.id)}</strong></td>
                    <td className="text-center">{day(inv.invoice_date)}</td>
                    <td className="text-right"><strong>{currency(inv.total_amount)}</strong></td>
                    <td className="text-right" style={{ color: '#059669' }}>{currency(p)}</td>
                    <td className="text-right">{d > 0.005 ? <strong style={{ color: '#dc2626' }}>{currency(d)}</strong> : <span style={{ color: '#64748b' }}>GHS 0.00</span>}</td>
                    <td className="text-center"><span className={`badge ${cls}`}>{label}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{inv.notes || '-'}</td>
                    <td className="text-center"><a href="#view" onClick={act(() => ctx.viewInvoice(inv))} className="btn btn-sm btn-secondary">View</a></td>
                  </tr>
                )
              })}
              {!invoices.length ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No invoices found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">💳 Recorded Customer Receipts &amp; Payments</h3></div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th className="text-center">Payment Date</th><th className="text-center">Invoice Ref</th><th className="text-center">Method</th>
                <th className="text-center">Reference #</th><th className="text-right">Amount Paid</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="text-center">{day(p.payment_date)}</td>
                  <td className="text-center"><strong style={{ color: 'var(--primary)' }}>{p.invoice ? invNo(p.invoice) : '-'}</strong></td>
                  <td className="text-center"><strong>{METHOD[p.method] || p.method}</strong></td>
                  <td className="text-center">{p.reference || '-'}</td>
                  <td className="text-right" style={{ color: '#059669', fontWeight: 700 }}>+{currency(p.amount)}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.notes || '-'}</td>
                </tr>
              ))}
              {!payments.length ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No payment receipts recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default ClassicReceivables
