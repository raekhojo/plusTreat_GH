import { useState } from 'react'
import { walletLabel } from '../../lib/treasury'
import './TreasuryPanel.css'

function money(v) {
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)}`
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

function TreasuryPanel({ treasury, isPeriodFiltered = false, periodLabel = '', onTransfer, canTransfer = true }) {
  const [openWallet, setOpenWallet] = useState('')
  const [showAllRows, setShowAllRows] = useState(false)
  const selected = treasury.wallets.find(w => w.key === openWallet)
  const statementRows = selected ? (showAllRows ? selected.statement : selected.statement.slice(0, 15)) : []

  return (
    <section className="tr-panel" aria-label="Treasury and wallet balances">
      <header className="tr-head">
        <div>
          <h2>Treasury</h2>
          <p>Live balance of every wallet, using the same rules as the trial balance.{isPeriodFiltered ? ` Money in and out shown for ${periodLabel}.` : ''}</p>
        </div>
        {canTransfer ? (
          <button type="button" className="account-alert-button account-alert-button-dark" onClick={() => onTransfer?.()}>Transfer Money</button>
        ) : null}
      </header>

      <div className="tr-wallets">
        {treasury.wallets.map(w => {
          const active = w.key === openWallet
          return (
            <button
              key={w.key}
              type="button"
              className={`tr-wallet${active ? ' is-open' : ''}${w.balance < 0 ? ' is-negative' : ''}`}
              aria-expanded={active}
              onClick={() => { setOpenWallet(active ? '' : w.key); setShowAllRows(false) }}
            >
              <span className="tr-wallet-top">
                <span className="tr-wallet-icon"><WalletGlyph walletKey={w.key} /></span>
                <span className="tr-wallet-name">{w.label}</span>
              </span>
              <strong className="tr-wallet-balance">{money(w.balance)}</strong>
              <span className="tr-wallet-flow">
                <span><em aria-hidden="true">▲</em> {money(w.periodIn)}</span>
                <span><em aria-hidden="true">▼</em> {money(w.periodOut)}</span>
              </span>
              {w.balance < 0 ? <span className="tr-wallet-warn">! Below zero — check entries</span> : null}
              <span className="tr-wallet-link">{active ? 'Hide statement' : 'View statement'}</span>
            </button>
          )
        })}
        <div className="tr-wallet tr-wallet-total">
          <span className="tr-wallet-name">Total cash &amp; bank</span>
          <strong className="tr-wallet-balance">{money(treasury.total)}</strong>
          <span className="tr-wallet-flow"><span>Across {treasury.wallets.length} wallets</span></span>
        </div>
      </div>

      {selected ? (
        <article className="tr-card">
          <div className="tr-card-head">
            <h3>{selected.label} statement</h3>
            <span>{selected.count} movement{selected.count === 1 ? '' : 's'} · balance {money(selected.balance)}</span>
          </div>
          {selected.statement.length ? (
            <div className="tr-table-scroll">
              <table className="tr-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Details</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr>
                </thead>
                <tbody>
                  {statementRows.map(r => (
                    <tr key={r.id}>
                      <td className="nowrap">{fmtDate(r.date)}</td>
                      <td className="nowrap">{r.type}</td>
                      <td>{r.detail || '—'}{r.reference ? <span className="tr-ref">{r.reference}</span> : null}</td>
                      <td className="num tr-in">{r.inflow ? money(r.inflow) : ''}</td>
                      <td className="num tr-out">{r.outflow ? money(r.outflow) : ''}</td>
                      <td className="num"><strong>{money(r.balance)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="tr-empty">No movements recorded for {selected.label} yet.</p>}
          {selected.statement.length > 15 ? (
            <button type="button" className="tr-more" onClick={() => setShowAllRows(v => !v)}>
              {showAllRows ? 'Show latest 15' : `Show all ${selected.statement.length} movements`}
            </button>
          ) : null}
        </article>
      ) : null}

      <article className="tr-card">
        <div className="tr-card-head">
          <h3>Wallet transfers</h3>
          <span>{treasury.transfers.length} transfer{treasury.transfers.length === 1 ? '' : 's'}{isPeriodFiltered ? ` in ${periodLabel}` : ''}</span>
        </div>
        {treasury.transfers.length ? (
          <div className="tr-table-scroll">
            <table className="tr-table">
              <thead>
                <tr><th>Date</th><th>Reference</th><th>From</th><th aria-label="direction" /><th>To</th><th>Note</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {treasury.transfers.slice(0, 20).map(t => (
                  <tr key={t.id}>
                    <td className="nowrap">{fmtDate(t.transaction_date)}</td>
                    <td className="nowrap tr-muted">{t.transaction_id || `#${t.id}`}</td>
                    <td>{walletLabel(t.payment_method)}</td>
                    <td className="tr-arrow" aria-hidden="true">→</td>
                    <td>{walletLabel(t.category)}</td>
                    <td className="tr-muted">{t.description || '—'}</td>
                    <td className="num"><strong>{money(t.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="tr-empty">No wallet transfers recorded{isPeriodFiltered ? ' in this period' : ''}. Use “Transfer Money” to move cash between wallets.</p>}
      </article>
    </section>
  )
}

export default TreasuryPanel
