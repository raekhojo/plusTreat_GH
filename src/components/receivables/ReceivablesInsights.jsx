import { useMemo, useState } from 'react'
import { buildAccountLedger, walletLabel } from '../../lib/treasury'
import ExportMenu from '../ExportMenu'
import './ReceivablesInsights.css'

// Age of debt is a magnitude, so the buckets use one brand hue from light (recent) to dark (oldest).
const BUCKETS = [
  { key: 'b30', label: '0–30 days', max: 30, color: '#9fd8f1' },
  { key: 'b60', label: '31–60 days', max: 60, color: '#31b1e4' },
  { key: 'b90', label: '61–90 days', max: 90, color: '#2c86b8' },
  { key: 'b90p', label: '90+ days', max: Infinity, color: '#15344d' },
]
const DAY_MS = 86400000
const LATE_DAYS = 90

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) { return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}` }
function dayIndex(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS) : NaN
}
function fmtDate(raw) {
  const i = dayIndex(raw)
  return Number.isFinite(i) ? new Date(i * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function ReceivablesInsights({ invoices = [], customers = [], accountTransactions = [], onOpenCustomer, onStatement, onExport }) {
  const [query, setQuery] = useState('')

  const ageing = useMemo(() => {
    const now = new Date()
    const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS)
    const totals = Object.fromEntries(BUCKETS.map(b => [b.key, { amount: 0, count: 0 }]))
    const byCustomer = new Map()
    invoices.forEach(inv => {
      const due = Math.max(0, num(inv.outstanding_balance))
      if (due <= 0) return
      const day = dayIndex(inv.invoice_date)
      const age = Number.isFinite(day) ? Math.max(0, today - day) : 0
      const bucket = BUCKETS.find(b => age <= b.max)
      totals[bucket.key].amount += due
      totals[bucket.key].count += 1
      const key = String(inv.customer ?? inv.customer_name)
      const row = byCustomer.get(key) || { id: inv.customer, name: inv.customer_name || 'Customer', total: 0, invoices: 0, oldest: age, b30: 0, b60: 0, b90: 0, b90p: 0 }
      row[bucket.key] += due
      row.total += due
      row.invoices += 1
      row.oldest = Math.max(row.oldest, age)
      byCustomer.set(key, row)
    })
    const total = BUCKETS.reduce((t, b) => t + totals[b.key].amount, 0)
    const rows = [...byCustomer.values()].sort((a, b) => b.total - a.total)
    const oldest = rows.reduce((best, r) => (!best || r.oldest > best.oldest ? r : best), null)
    return { totals, total, rows, oldest }
  }, [invoices])

  const otherReceivables = useMemo(() => buildAccountLedger('Other Receivables', accountTransactions), [accountTransactions])
  const overdue = ageing.total - ageing.totals.b30.amount
  const overdueShare = ageing.total > 0 ? (overdue / ageing.total) * 100 : 0
  const knownCustomer = id => customers.some(c => String(c.id) === String(id))

  const shownRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ageing.rows.filter(r => r.name.toLowerCase().includes(q)) : ageing.rows
  }, [ageing.rows, query])

  const exportDebtors = format => onExport?.(
    'Customer_Debtors',
    ['Customer', 'Invoices', ...BUCKETS.map(b => b.label), 'Total due', 'Oldest (days)'],
    shownRows.map(r => ({ id: r.name, cells: [r.name, String(r.invoices), ...BUCKETS.map(b => (r[b.key] ? money(r[b.key]) : '—')), money(r.total), `${r.oldest} days`] })),
    format,
  )
  const exportAdvances = format => onExport?.(
    'Staff_and_Home_Advances',
    ['Date', 'Reference', 'Type', 'Account', 'Description', 'Advance', 'Repayment', 'Balance'],
    otherReceivables.statement.map(r => ({ id: r.id, cells: [fmtDate(r.date), r.reference || `#${r.id}`, r.kind === 'in' ? 'Advance issued' : 'Repayment', walletLabel(r.counterpart) || '—', r.description || '—', r.inflow ? money(r.inflow) : '', r.outflow ? money(r.outflow) : '', money(r.balance)] })),
    format,
  )

  return (
    <div className="rv-wrap">
      {/* 1. The headline: how much is owed and how worried to be */}
      <section className="mc-stats" aria-label="Debtors summary">
        <div className="mc-stats-grid">
          <div className="mc-stat">
            <span className="mc-stat-label">Owed by customers</span>
            <strong className="mc-stat-value">{money(ageing.total)}</strong>
            <p>{plural(ageing.rows.length, 'customer')} · {plural(BUCKETS.reduce((t, b) => t + ageing.totals[b.key].count, 0), 'open invoice')}</p>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Overdue (over 30 days)</span>
            <strong className="mc-stat-value">{money(overdue)}</strong>
            <p>{overdueShare.toFixed(0)}% of what is owed</p>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Oldest unpaid invoice</span>
            <strong className={`mc-stat-value${ageing.oldest && ageing.oldest.oldest > LATE_DAYS ? ' rv-late' : ''}`}>{ageing.oldest ? `${ageing.oldest.oldest} days` : '—'}</strong>
            <p>{ageing.oldest ? ageing.oldest.name : 'Nothing outstanding'}</p>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Staff &amp; home advances</span>
            <strong className="mc-stat-value">{money(otherReceivables.balance)}</strong>
            <p>Still owed to the business</p>
          </div>
        </div>
      </section>

      {/* 2. How old the debt is: one bar, read left (recent) to right (oldest) */}
      <article className="rv-card">
        <header className="rv-head">
          <h2>How old the debt is</h2>
          <span className="rv-head-note">As of today</span>
        </header>
        {ageing.total > 0 ? (
          <>
            <div className="rv-bar" role="img" aria-label={BUCKETS.map(b => `${b.label}: ${money(ageing.totals[b.key].amount)}`).join(', ')}>
              {BUCKETS.filter(b => ageing.totals[b.key].amount > 0).map(b => (
                <span
                  key={b.key}
                  style={{ flexGrow: ageing.totals[b.key].amount, background: b.color }}
                  title={`${b.label}: ${money(ageing.totals[b.key].amount)} (${plural(ageing.totals[b.key].count, 'invoice')})`}
                />
              ))}
            </div>
            <div className="rv-legend">
              {BUCKETS.map(b => {
                const t = ageing.totals[b.key]
                const share = ageing.total > 0 ? (t.amount / ageing.total) * 100 : 0
                return (
                  <div key={b.key} className="rv-legend-item">
                    <span className="rv-legend-label"><i style={{ background: b.color }} aria-hidden="true" />{b.label}</span>
                    <strong>{money(t.amount)}</strong>
                    <span className="rv-legend-meta">{share.toFixed(0)}% · {plural(t.count, 'invoice')}</span>
                  </div>
                )
              })}
            </div>
          </>
        ) : <p className="rv-empty">No open invoices. Every customer is paid up.</p>}
      </article>

      {/* 3. Who to chase, biggest first */}
      <article className="rv-card rv-card-table">
        <div className="mc-table-head">
          <div className="mc-table-title">
            <h2>Who owes us</h2>
            <span className="mc-table-count">{plural(shownRows.length, 'customer')}</span>
          </div>
          <div className="mc-table-tools">
            <input type="search" className="mc-search" placeholder="Search customers…" aria-label="Search debtors" value={query} onChange={e => setQuery(e.target.value)} />
            {onExport && shownRows.length ? <ExportMenu onExport={exportDebtors} /> : null}
          </div>
        </div>
        {shownRows.length ? (
          <div className="rv-table-scroll">
            <table className="rv-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Total due</th>
                  {BUCKETS.map(b => <th key={b.key} className="num">{b.label}</th>)}
                  <th className="num">Oldest</th>
                  {onStatement ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {shownRows.map(r => (
                  <tr key={`${r.id}-${r.name}`}>
                    <td>
                      {onOpenCustomer && knownCustomer(r.id)
                        ? <button type="button" className="rv-link" onClick={() => onOpenCustomer(r.id)}>{r.name}</button>
                        : <span className="rv-name">{r.name}</span>}
                      <span className="rv-sub">{plural(r.invoices, 'open invoice')}</span>
                    </td>
                    <td className="num"><strong>{money(r.total)}</strong></td>
                    {BUCKETS.map(b => <td key={b.key} className={`num${r[b.key] ? '' : ' rv-faint'}`}>{r[b.key] ? money(r[b.key]) : '—'}</td>)}
                    <td className={`num${r.oldest > LATE_DAYS ? ' rv-late' : ''}`}>{r.oldest > LATE_DAYS ? <span aria-hidden="true">! </span> : null}{r.oldest} days</td>
                    {onStatement ? (
                      <td className="rv-actions">
                        <button type="button" className="rv-chip" onClick={() => onStatement(r)}>Statement</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="rv-empty rv-pad">{ageing.rows.length ? 'No customer matches your search.' : 'No open invoices. Every customer is paid up.'}</p>}
      </article>

      {/* 4. Money staff or family owe the business */}
      <article className="rv-card rv-card-table">
        <div className="mc-table-head">
          <div className="mc-table-title">
            <h2>Staff &amp; home advances</h2>
            <span className="mc-table-count">Advanced {money(otherReceivables.totalIn)} · Repaid {money(otherReceivables.totalOut)}</span>
          </div>
          <div className="mc-table-tools">
            {onExport && otherReceivables.statement.length ? <ExportMenu onExport={exportAdvances} /> : null}
          </div>
        </div>
        {otherReceivables.statement.length ? (
          <div className="rv-table-scroll">
            <table className="rv-table">
              <thead>
                <tr><th>Date</th><th>Reference</th><th>Type</th><th>Account</th><th>Description</th><th className="num">Advance</th><th className="num">Repayment</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {otherReceivables.statement.map(r => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td className="nowrap rv-muted">{r.reference || `#${r.id}`}</td>
                    <td className="nowrap">{r.kind === 'in' ? 'Advance issued' : 'Repayment'}</td>
                    <td className="nowrap">{walletLabel(r.counterpart) || '—'}</td>
                    <td className="rv-muted">{r.description || '—'}</td>
                    <td className="num">{r.inflow ? money(r.inflow) : ''}</td>
                    <td className="num">{r.outflow ? money(r.outflow) : ''}</td>
                    <td className="num"><strong>{money(r.balance)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="rv-empty rv-pad">No advances recorded. Record one in Accounts as a transfer into “Other Receivables”.</p>}
      </article>
    </div>
  )
}

export default ReceivablesInsights
