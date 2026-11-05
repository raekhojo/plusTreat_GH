import { useMemo, useState } from 'react'
import { act, currency, day, inPeriod, matches } from '../format'

// Port of templates/cashbook.html (Unified Cashbook & Treasury).
const WALLETS = [
  { key: 'Cash', label: '💵 Cash on Hand', name: 'Cash' },
  { key: 'MoMo Wallet', label: '📱 MoMo Wallet', name: 'MoMo Wallet' },
  { key: 'GhanaPay', label: '🇬🇭 GhanaPay', name: 'GhanaPay' },
  { key: 'CalBank', label: '🏦 Cal Bank', name: 'Cal Bank' },
]
// Cashbook row kinds → the ERP's transaction types.
const TYPES = [
  { kind: 'receipt', type: 'Customer Receipt', option: '💵 Customer Receipt', pill: '💵 Receipts' },
  { kind: 'expense', type: 'Operating Expense', option: '📉 Operating Expense', pill: '📉 Operating Expenses' },
  { kind: 'supplier', type: 'Supplier Payment', option: '📦 Supplier Payment', pill: '📦 Supplier Payments' },
  { kind: 'transfer', type: 'Account Transfer', option: '🔄 Account Transfer', pill: '🔄 Account Transfers' },
  { kind: 'income', type: 'Income', option: '💰 Income', pill: '💰 Other Income' },
]
const BADGE = { receipt: ['badge-success', 'Receipt'], supplier: ['badge-danger', 'Supplier Pmt'], expense: ['badge-warning', 'Expense'], transfer: ['badge-secondary', 'Account Transfer'], income: ['badge-secondary', 'Income'] }
const PILL_X = { background: 'rgba(255,255,255,0.3)', borderRadius: '50%', width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', marginLeft: '2px' }

function ClassicCashbook({ ctx, period, initialWallet = '' }) {
  const { treasury, cashbook } = ctx
  const [wallet, setWallet] = useState(initialWallet)
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const isFiltered = period.key !== 'all'

  const periodRows = useMemo(() => cashbook.filter(r => inPeriod(r.date, period)), [cashbook, period])
  const walletRows = useMemo(() => {
    if (!wallet) return periodRows
    return periodRows
      .filter(r => r.walletKey === wallet || r.walletToKey === wallet)
      .map(r => {
        if (r.kind !== 'transfer') return r
        const inflow = r.walletToKey === wallet ? r.inflow || r.outflow : 0
        const outflow = r.walletKey === wallet ? r.outflow || r.inflow : 0
        return { ...r, inflow, outflow, net: inflow - outflow }
      })
  }, [periodRows, wallet])
  const shown = walletRows.filter(r => (!kind || r.kind === kind) && matches(search, r.reference, r.type, r.counterparty, r.category, r.wallet, r.description, day(r.date)))

  const inflow = periodRows.reduce((t, r) => t + (r.kind === 'transfer' ? 0 : r.inflow), 0)
  const outflow = periodRows.reduce((t, r) => t + (r.kind === 'transfer' ? 0 : r.outflow), 0)
  const balance = key => treasury.wallets.find(w => w.key === key)?.balance || 0
  const walletName = WALLETS.find(w => w.key === wallet)?.name
  const typeName = TYPES.find(t => t.kind === kind)?.type

  return (
    <>
      <div className="wallets-ribbon">
        {WALLETS.map(w => {
          const on = wallet === w.key
          return (
            <div key={w.key} className="wallet-box" style={on ? { borderColor: 'var(--primary)' } : null}>
              <div>
                <div className="wallet-name">{w.label}</div>
                <div className={`wallet-amt${balance(w.key) < 0 ? ' negative' : ''}`}>{currency(balance(w.key))}</div>
              </div>
              {on
                ? <a href="#clear" onClick={act(() => setWallet(''))} className="btn btn-sm btn-primary" title="Click to clear wallet filter">Active ✓</a>
                : <a href="#filter" onClick={act(() => setWallet(w.key))} className="btn btn-sm btn-secondary">Filter</a>}
            </div>
          )
        })}
      </div>

      {isFiltered ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #a7f3d0', borderRadius: '8px', padding: '12px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>Period Inflows</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{currency(inflow)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Collections &amp; receipts in {period.label}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1.5px solid #fecaca', borderRadius: '8px', padding: '12px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Period Outflows</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>{currency(outflow)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Purchases, OpEx &amp; advances in {period.label}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '8px', padding: '12px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Net Cash Movement</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: inflow - outflow >= 0 ? '#059669' : '#dc2626', marginTop: '2px' }}>{currency(inflow - outflow)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net cash change for {period.label}</div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '340px' }}>
              <input type="text" className="form-control" placeholder="🔍 Search entries, references, descriptions..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="classicTypeFilter" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 0 }}>TYPE:</label>
              <select id="classicTypeFilter" className="form-control" style={{ width: 'auto', minWidth: '195px', fontWeight: 600 }} value={kind} onChange={e => setKind(e.target.value)}>
                <option value="">All Transaction Types</option>
                {TYPES.map(t => <option key={t.kind} value={t.kind}>{t.option}</option>)}
              </select>
            </div>
            {wallet || kind ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {kind ? (
                  <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', fontSize: '11.5px', fontWeight: 600 }}>
                    Type: {typeName}
                    <a href="#clear" onClick={act(() => setKind(''))} style={{ textDecoration: 'none', fontWeight: 'bold', marginLeft: '2px' }} title="Remove Type filter">✕</a>
                  </span>
                ) : null}
                {wallet ? (
                  <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', fontSize: '11.5px', fontWeight: 600 }}>
                    Wallet: {walletName}
                    <a href="#clear" onClick={act(() => setWallet(''))} style={{ textDecoration: 'none', fontWeight: 'bold', marginLeft: '2px' }} title="Remove Wallet filter">✕</a>
                  </span>
                ) : null}
                <a href="#reset" onClick={act(() => { setKind(''); setWallet('') })} className="btn btn-sm btn-secondary" style={{ fontSize: '11.5px', padding: '3px 8px' }}>Reset All</a>
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Total Transactions: <strong style={{ color: 'var(--text-main)' }}>{shown.length}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '9px 18px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter by Type:</span>
          <a href="#all" onClick={act(() => setKind(''))} className={`btn btn-sm ${!kind ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '3px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '16px' }}>All Types</a>
          {TYPES.map(t => {
            const on = kind === t.kind
            return (
              <a key={t.kind} href={`#${t.kind}`} onClick={act(() => setKind(on ? '' : t.kind))} className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '3px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={on ? 'Click to clear filter' : `Filter by ${t.type}`}>
                {t.pill}
                {on ? <span style={PILL_X}>✕</span> : null}
              </a>
            )
          })}
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center">Date</th>
                <th className="text-center">Reference</th>
                <th className="text-center">Type</th>
                <th>Counterparty</th>
                <th>Category</th>
                <th className="text-center">Wallet / Account</th>
                <th className="text-right">Inflow (+)</th>
                <th className="text-right">Outflow (-)</th>
                <th className="text-right">Net Flow</th>
                <th>Description</th>
                {ctx.canEdit ? <th className="text-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shown.map(e => (
                <tr key={e.id}>
                  <td className="text-center">{day(e.date)}</td>
                  <td className="text-center"><strong style={{ color: 'var(--primary)', fontSize: '12px' }}>{e.reference}</strong></td>
                  <td className="text-center"><span className={`badge ${BADGE[e.kind][0]}`}>{BADGE[e.kind][1]}</span></td>
                  <td><strong>{e.counterparty || '-'}</strong></td>
                  <td>{e.category || '-'}</td>
                  <td className="text-center"><strong>{e.wallet}</strong></td>
                  <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>{e.inflow > 0 ? `+${currency(e.inflow)}` : '-'}</td>
                  <td className="text-right" style={{ color: '#dc2626', fontWeight: 600 }}>{e.outflow > 0 ? `-${currency(e.outflow)}` : '-'}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: e.net >= 0 ? '#059669' : '#dc2626' }}>{currency(e.net)}</td>
                  <td style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '250px' }}>{e.description || '-'}</td>
                  {ctx.canEdit ? (
                    <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => ctx.editCashbookRow(e)} style={{ fontSize: '11px', padding: '2px 7px', fontWeight: 600 }} title="Edit Transaction">✏️ Edit</button>
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

export default ClassicCashbook
