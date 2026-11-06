import { useMemo, useState } from 'react'
import { CASHBOOK_TYPES } from '../../lib/treasury'
import ExportMenu from '../ExportMenu'
import './TreasuryPanel.css'

function money(v) {
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)}`
}
function signed(v) {
  const n = Number(v) || 0
  if (Math.abs(n) < 0.005) return money(0)
  return `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`
}
// Table figures: currency is in the column heading, so cells show the number only.
function amount(v) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)
}
function signedAmount(v) {
  const n = Number(v) || 0
  if (Math.abs(n) < 0.005) return amount(0)
  return `${n > 0 ? '+' : '−'}${amount(Math.abs(n))}`
}
function fmtDate(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return raw || '—'
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function WalletGlyph({ walletKey }) {
  const paths = {
    Cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
    'MoMo Wallet': <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M10.5 18.5h3" /></>,
    CalBank: <><path d="M3 9.5 12 4l9 5.5" /><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7" /><path d="M3.5 20h17" /></>,
    GhanaPay: <><path d="M4 7.5h13a3 3 0 0 1 3 3V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z" /><path d="M4 7.5 15 4.5v3" /><circle cx="16" cy="13.5" r="1.3" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="tr-wallet-glyph">{paths[walletKey] || paths.Cash}</svg>
}

const PAGE_SIZE = 25

// Unified cashbook: wallet balances on top (each filters the table), then every
// money movement in one table with type chips, search and an Edit action.
function TreasuryPanel({ treasury, rows = [], onEdit = null, onTransfer, onAddEntry, canTransfer = true, initialWallet = '', onExport }) {
  const [wallet, setWallet] = useState(initialWallet)
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  // Rows seen through the chosen wallet: a transfer only counts its own side.
  // Each row also carries the running balance after it: of the chosen wallet,
  // or of all wallets together (rows are newest first, so add up from the end).
  const walletRows = useMemo(() => {
    const list = !wallet ? rows : rows
      .filter(r => r.walletKey === wallet || r.walletToKey === wallet)
      .map(r => {
        if (r.kind !== 'transfer') return r
        const inflow = r.walletToKey === wallet ? r.inflow || r.outflow : 0
        const outflow = r.walletKey === wallet ? r.outflow || r.inflow : 0
        return { ...r, inflow, outflow, net: inflow - outflow }
      })
    const out = new Array(list.length)
    let running = 0
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const r = list[i]
      if (r.walletKey || r.walletToKey) running += (Number(r.inflow) || 0) - (Number(r.outflow) || 0)
      out[i] = { ...r, balance: running }
    }
    return out
  }, [rows, wallet])

  const typeCounts = useMemo(() => {
    const counts = {}
    walletRows.forEach(r => { counts[r.kind] = (counts[r.kind] || 0) + 1 })
    return counts
  }, [walletRows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return walletRows.filter(r => {
      if (type && r.kind !== type) return false
      if (!q) return true
      return [r.reference, r.type, r.counterparty, r.category, r.wallet, r.description, fmtDate(r.date), money(r.inflow), money(r.outflow)]
        .join(' ').toLowerCase().includes(q)
    })
  }, [walletRows, type, query])

  const totals = useMemo(() => visible.reduce((t, r) => ({ in: t.in + r.inflow, out: t.out + r.outflow }), { in: 0, out: 0 }), [visible])
  const shown = visible.slice(0, limit)
  const walletName = treasury.wallets.find(w => w.key === wallet)?.label || ''
  const resetPaging = () => setLimit(PAGE_SIZE)

  return (
    <section className="tr-panel" aria-label="Cashbook and treasury">
      <div className="tr-wallets">
        {treasury.wallets.map(w => {
          const active = w.key === wallet
          return (
            <div key={w.key} className={`tr-wallet${active ? ' is-open' : ''}${w.balance < 0 ? ' is-negative' : ''}`}>
              <span className="tr-wallet-top">
                <span className="tr-wallet-icon"><WalletGlyph walletKey={w.key} /></span>
                <span className="tr-wallet-name">{w.label}</span>
              </span>
              <strong className="tr-wallet-balance">{money(w.balance)}</strong>
              {w.balance < 0 ? <span className="tr-wallet-warn">! Below zero — check entries</span> : null}
              <button
                type="button"
                className="tr-wallet-filter"
                aria-pressed={active}
                onClick={() => { setWallet(active ? '' : w.key); resetPaging() }}
              >
                {active ? 'Clear filter' : 'Filter'}
              </button>
            </div>
          )
        })}
        <div className="tr-wallet tr-wallet-total">
          <span className="tr-wallet-name">Total cash &amp; bank</span>
          <strong className="tr-wallet-balance">{money(treasury.total)}</strong>
          <span className="tr-wallet-flow"><span>Across {treasury.wallets.length} wallets</span></span>
        </div>
      </div>

      <article className="tr-card tr-cashbook">
        <div className="mc-table-head">
          <div className="mc-table-title">
            <h2>{walletName ? `${walletName} transactions` : 'All transactions'}</h2>
            <span className="mc-table-count">{visible.length} of {rows.length}</span>
          </div>
          <div className="mc-table-tools">
            <input
              type="search"
              className="mc-search tr-search"
              placeholder="Search entries, references, descriptions…"
              value={query}
              onChange={e => { setQuery(e.target.value); resetPaging() }}
              aria-label="Search cashbook"
            />
            {onExport ? <ExportMenu onExport={format => onExport(format, visible)} /> : null}
            {canTransfer ? <button type="button" className="account-alert-button account-alert-button-light" onClick={() => onTransfer?.()}>Transfer Money</button> : null}
            {onAddEntry ? <button type="button" className="account-alert-button account-alert-button-dark" onClick={() => onAddEntry()}>Add Account Entry</button> : null}
          </div>
        </div>

        <div className="tr-filter-row">
          <span className="tr-filter-label">Filter by type</span>
          <div className="tr-chips" role="group" aria-label="Filter by type">
            <button type="button" className={`tr-chip${type === '' ? ' is-active' : ''}`} aria-pressed={type === ''} onClick={() => { setType(''); resetPaging() }}>
              All Types <em>{walletRows.length}</em>
            </button>
            {CASHBOOK_TYPES.map(t => (
              <button key={t.key} type="button" className={`tr-chip tr-chip-${t.key}${type === t.key ? ' is-active' : ''}`} aria-pressed={type === t.key} onClick={() => { setType(type === t.key ? '' : t.key); resetPaging() }}>
                <i aria-hidden="true" />{t.label} <em>{typeCounts[t.key] || 0}</em>
              </button>
            ))}
          </div>
          <div className="tr-totals" aria-label="Totals for the rows shown">
            <span>In <strong className="tr-in">{money(totals.in)}</strong></span>
            <span>Out <strong className="tr-out">{money(totals.out)}</strong></span>
            <span>Net <strong className={totals.in - totals.out < 0 ? 'tr-out' : 'tr-in'}>{signed(totals.in - totals.out)}</strong></span>
          </div>
        </div>

        {visible.length ? (
          <div className="tr-table-scroll">
            <table className="tr-table tr-cashbook-table">
              <thead>
                <tr>
                  <th>Date</th><th>Reference</th><th>Description</th><th>Counter&shy;party</th><th>Category</th><th>Wallet / Account</th>
                  <th className="num">Net flow (GHS)</th><th className="num">Balance (GHS)</th>
                  {onEdit ? <th className="tr-actions-head">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td className="nowrap tr-reference">{r.reference}</td>
                    <td className="tr-muted tr-desc">{r.description || '—'}</td>
                    <td className="tr-strong tr-party">{r.counterparty}</td>
                    <td className="tr-muted">{r.category}</td>
                    <td className="nowrap">{r.wallet}</td>
                    <td className={`num tr-net ${r.net < -0.005 ? 'tr-out' : r.net > 0.005 ? 'tr-in' : 'tr-faint'}`}>{signedAmount(r.net)}</td>
                    <td className={`num tr-balance${r.balance < -0.005 ? ' tr-out' : ''}`}>{amount(r.balance)}</td>
                    {onEdit ? (
                      <td className="tr-actions">
                        <button type="button" className="workspace-action-btn" onClick={() => onEdit(r)}>Edit</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="tr-empty tr-pad">No transactions match{type ? ` “${CASHBOOK_TYPES.find(t => t.key === type)?.label}”` : ''}{walletName ? ` for ${walletName}` : ''}{query ? ` “${query}”` : ''}.</p>}

        {visible.length > limit ? (
          <div className="tr-pad">
            <button type="button" className="tr-more" onClick={() => setLimit(l => l + PAGE_SIZE * 2)}>
              Show more ({visible.length - limit} left)
            </button>
          </div>
        ) : null}
      </article>
    </section>
  )
}

export default TreasuryPanel
