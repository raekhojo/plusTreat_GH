import { useEffect, useMemo, useState } from 'react'
import { act, currency, day, inPeriod, matches, num, qty, unitCostBySize } from '../format'
import ClassicReconciliation from './ClassicReconciliation'
import { OtherReceivablesTable } from './ClassicReceivables'

// Port of templates/financials.html (Financial Statements, Unit Economics & Audit Center).
const ACK_KEY = 'plusTreatAcknowledgedFlags'
const TH = { padding: '8px 12px' }
const TD = { padding: '8px 12px' }
const STICKY = { position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }
const DRILL = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', padding: 0, margin: 0, fontSize: '11px', lineHeight: 1, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569', verticalAlign: 'middle' }

function readAck() {
  try { return JSON.parse(localStorage.getItem(ACK_KEY) || '[]') } catch { return [] }
}
function tbValue(rows, description) {
  const row = rows.find(r => String(r.description || '').toLowerCase() === description.toLowerCase())
  return row ? num(row.available) : 0
}

function ClassicFinancials({ ctx, period, initialTab = 'opex', user }) {
  const { data, treasury, inventoryLedger, rawMaterials, otherReceivables, outstandingOf, paidOf, invNo, purchaseOutstandingOf } = ctx
  const [tab, setTab] = useState(initialTab)
  const [opexCat, setOpexCat] = useState('all')
  const [opexSearch, setOpexSearch] = useState('')
  const [ack, setAck] = useState(readAck)
  const isFiltered = period.key !== 'all'
  // Opened as "Asset Reconciliation": jump straight to the reconciliation tab, as the ERP does.
  useEffect(() => {
    if (initialTab !== 'reconciliation') return
    const t = setTimeout(() => document.getElementById('classicExplorer')?.scrollIntoView({ block: 'start' }), 50)
    return () => clearTimeout(t)
  }, [initialTab])

  const f = useMemo(() => {
    const cost = unitCostBySize(data.productionBatches)
    const periodInvoices = data.invoices.filter(inv => inPeriod(inv.invoice_date, period) && !inv.is_sample_sale)
    const lines = periodInvoices.flatMap(inv => inv.lines || [])
    const bySize = new Map()
    lines.forEach(l => {
      const s = bySize.get(l.product_size) || { size: l.product_size, lines: 0, qty: 0, revenue: 0, cogs: 0 }
      s.lines += 1
      s.qty += num(l.quantity)
      s.revenue += num(l.line_total)
      s.cogs += num(l.quantity) * (cost.get(l.product_size) || 0)
      bySize.set(l.product_size, s)
    })
    const salesBySize = [...bySize.values()].sort((a, b) => b.revenue - a.revenue)
    const sales = salesBySize.reduce((t, s) => t + s.revenue, 0)
    const cogs = salesBySize.reduce((t, s) => t + s.cogs, 0)

    const batches = data.productionBatches.filter(b => inPeriod(b.production_date, period)).map(b => {
      const value = num(b.total_production_value) || (b.outputs || []).reduce((t, o) => t + num(o.amount), 0)
      return {
        b,
        value,
        overhead: num(b.electricity_cost) + num(b.gas_cost) + num(b.production_wages),
        surplus: value - num(b.total_cost),
        litres: (b.outputs || []).reduce((t, o) => t + num(o.total_litres), 0),
        mix: (b.outputs || []).map(o => `${o.product_size}: ${qty(o.quantity)}`).join(', '),
      }
    }).sort((x, y) => day(y.b.production_date).localeCompare(day(x.b.production_date)))
    const surplus = batches.reduce((t, b) => t + b.surplus, 0)

    const opex = data.accountTransactions
      .filter(t => String(t.entry_type || '').toLowerCase() === 'expense' && inPeriod(t.transaction_date, period))
      .sort((a, b) => day(b.transaction_date).localeCompare(day(a.transaction_date)))
    const opexByCat = new Map()
    opex.forEach(t => opexByCat.set(t.category || 'Uncategorised', (opexByCat.get(t.category || 'Uncategorised') || 0) + num(t.amount)))
    const opexItems = [...opexByCat.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
    const opexTotal = opexItems.reduce((t, o) => t + o.total, 0)

    const fgValue = inventoryLedger.reduce((t, i) => t + Math.max(0, num(i.available)) * (cost.get(i.size) || 0), 0)
    const rmValue = rawMaterials.reduce((t, m) => t + Math.max(0, num(m.available)) * num(m.unit_price), 0)
    const ar = data.invoices.reduce((t, inv) => t + outstandingOf(inv), 0)
    const tb = data.trialBalanceReport?.rows || []
    const ppe = tbValue(tb, 'PPE')
    const equipment = tbValue(tb, 'Equipment')
    const totalAssets = ppe + equipment + treasury.total + ar + otherReceivables.balance + fgValue + rmValue
    const ap = data.purchases.reduce((t, p) => t + purchaseOutstandingOf(p), 0)
    const otherPayables = tbValue(tb, 'Other Payables')
    const capital = tbValue(tb, 'Equity')

    return {
      salesBySize, sales, cogs, batches, surplus, opex, opexItems, opexTotal,
      net: sales - cogs + surplus - opexTotal,
      fgValue, rmValue, ar, ppe, equipment, totalAssets, ap, otherPayables, capital,
      retained: totalAssets - ap - otherPayables - capital,
      arInvoices: data.invoices.filter(inv => outstandingOf(inv) > 0.005).sort((a, b) => day(b.invoice_date).localeCompare(day(a.invoice_date))),
    }
  }, [data, period, inventoryLedger, rawMaterials, treasury.total, otherReceivables.balance, outstandingOf, purchaseOutstandingOf])

  // Operational priorities (the reference keeps these in an audit_flags table).
  const flags = useMemo(() => {
    const list = []
    treasury.wallets.filter(w => w.balance < 0).forEach(w => list.push({ id: `wallet-${w.key}`, severity: 'danger', title: `${w.label} wallet balance is negative`, ref: w.label, description: `The book balance is ${currency(w.balance)}: more money has been recorded out of this wallet than in.`, action: 'Check the cashbook for a missing receipt, a transfer recorded the wrong way, or an expense against the wrong wallet.' }))
    f.batches.filter(b => b.surplus < 0).forEach(b => list.push({ id: `batch-${b.b.id}`, severity: 'warning', title: 'Production batch recorded at a loss', ref: b.b.batch_number || `#${b.b.id}`, description: `Total cost ${currency(b.b.total_cost)} exceeds output value ${currency(b.value)}.`, action: 'Verify the raw material quantities and overheads entered for this batch.' }))
    inventoryLedger.filter(i => num(i.available) <= num(i.productionLevel) && num(i.productionLevel) > 0).forEach(i => list.push({ id: `fg-${i.size}`, severity: 'warning', title: `${i.size} finished goods at reorder level`, ref: i.size, description: `Only ${qty(i.available)} bottles in stock (minimum ${qty(i.productionLevel)}).`, action: 'Schedule a production batch for this size.' }))
    rawMaterials.filter(m => num(m.available) <= num(m.reorder_level)).forEach(m => list.push({ id: `rm-${m.id}`, severity: 'info', title: `${m.name} below reorder level`, ref: m.name, description: `${qty(m.available)} ${m.unit || ''} available, reorder level ${qty(m.reorder_level)}.`, action: 'Raise a purchase with the supplier.' }))
    return list
  }, [treasury.wallets, f.batches, inventoryLedger, rawMaterials])
  const acknowledge = id => { const next = [...new Set([...ack, id])]; setAck(next); localStorage.setItem(ACK_KEY, JSON.stringify(next)) }
  const openTab = (key, cat = '') => {
    setTab(key)
    if (key === 'opex') setOpexCat(cat || 'all')
    requestAnimationFrame(() => document.getElementById('classicExplorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const drill = (to, title, cat = '') => <button type="button" style={DRILL} onClick={() => openTab(to, cat)} title={title}>🔍</button>

  const opexRows = f.opex.filter(t => (opexCat === 'all' || (t.category || 'Uncategorised') === opexCat) && matches(opexSearch, t.transaction_id, t.description, t.comments))
  const TABS = [
    ['opex', `💸 Operating Expenses (${f.opex.length})`],
    ['receivables', `👥 Trade Receivables (${f.arInvoices.length})`],
    ['other_receivables', `📋 Other Receivables (${(otherReceivables.statement || []).length})`],
    ['batches', `🏭 Batch Manufacturing (${f.batches.length})`],
    ['sales', '📈 Sales & COGS by Product'],
    ['raw_materials', `🧪 Raw Materials Schedule (${rawMaterials.length})`],
    ['wallets', '📱 Cash & Wallet Ledger'],
  ]

  return (
    <>
      <div className="card" style={{ borderLeft: '5px solid var(--danger)', marginBottom: '28px' }}>
        <div className="card-header" style={{ background: '#fffafa' }}>
          <h2 className="card-title" style={{ color: '#991b1b' }}>🔍 System Integrity &amp; Audit Monitor (Findings from Reconciled Datasets)</h2>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>The following operational flags and formula discrepancies were detected across the live records. You can review and acknowledge each priority below:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {flags.map(flag => (
              <div key={flag.id} style={{ background: '#fff', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    {flag.severity === 'danger' ? <span className="badge badge-danger">CRITICAL</span> : flag.severity === 'warning' ? <span className="badge badge-warning">WARNING</span> : <span className="badge badge-info">INFO</span>}
                    <strong style={{ color: 'var(--secondary)', fontSize: '14px' }}>{flag.title}</strong>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>Ref: {flag.ref}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '6px' }}>{flag.description}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>💡 Recommended Action: {flag.action}</div>
                </div>
                <div>
                  {ack.includes(flag.id) ? <span className="badge badge-success">Resolved ✅</span> : <button type="button" className="btn btn-sm btn-secondary" onClick={() => acknowledge(flag.id)}>Acknowledge</button>}
                </div>
              </div>
            ))}
            {!flags.length ? <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>✅ No open audit findings.</div> : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>📈 Income Statement ({isFiltered ? period.label : 'Lifetime Database Dump'})</h3>
          </div>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><strong>Commercial Sales Revenue</strong>{drill('sales', 'View Sales Breakdown')}</span></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#059669' }}>{currency(f.sales)}</strong></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ color: 'var(--text-muted)' }}>Direct Cost of Goods Sold (COGS)</span>{drill('sales', 'View COGS Breakdown')}</span></td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>-{currency(f.cogs)}</td>
                </tr>
                <tr style={{ background: 'var(--bg-main)', fontWeight: 700 }}>
                  <td>Commercial Gross Profit</td>
                  <td style={{ textAlign: 'right' }}>{currency(f.sales - f.cogs)}</td>
                </tr>
                <tr>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><strong>Batch Manufacturing Efficiency Surplus</strong>{drill('batches', 'View Batch Details')}</span></td>
                  <td style={{ textAlign: 'right', color: '#059669' }}>+{currency(f.surplus)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td colSpan={2} style={{ paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-muted)' }}>Operating Expenses (OpEx)</span>
                      {drill('opex', 'View All OpEx Transactions', 'all')}
                    </div>
                  </td>
                </tr>
                {f.opexItems.map(op => (
                  <tr key={op.category}>
                    <td style={{ paddingLeft: '16px', fontSize: '13px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span>{op.category}</span>{drill('opex', `View ${op.category} Transactions`, op.category)}</span></td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>-{currency(op.total)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-main)', fontWeight: 700 }}>
                  <td>Total Operating Expenses</td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>-{currency(f.opexTotal)}</td>
                </tr>
                <tr style={{ background: '#ecfdf5', borderTop: '2px solid #a7f3d0', fontSize: '15px' }}>
                  <td><strong style={{ color: '#065f46' }}>NET OPERATING PROFIT / SURPLUS</strong></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#065f46' }}>{currency(f.net)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>⚖️ Balance Sheet (Audited Financial Position)</h3>
            <button type="button" className="btn btn-sm" onClick={() => openTab('reconciliation')} style={{ fontSize: '11.5px', padding: '4px 10px', background: '#ecfdf5', border: '1.5px solid #059669', color: '#065f46', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}>⚖️ Asset Reconciliation Tab →</button>
          </div>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr style={{ background: 'var(--bg-main)' }}><td colSpan={2}><strong>ASSETS</strong></td></tr>
                <tr><td style={{ paddingLeft: '16px' }}>Property, Plant &amp; Equipment (PPE)</td><td style={{ textAlign: 'right' }}>{currency(f.ppe)}</td></tr>
                <tr><td style={{ paddingLeft: '16px' }}>Tools &amp; Equipment</td><td style={{ textAlign: 'right' }}>{currency(f.equipment)}</td></tr>
                <tr>
                  <td style={{ paddingLeft: '16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span>Cash &amp; Wallets (Total Liquid)</span>{drill('wallets', 'View Wallet Breakdown')}</span></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#2563eb' }}>{currency(treasury.total)}</strong></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span>Trade Receivables (AR)</span>{drill('receivables', 'View Debtors & Unpaid Invoices')}</span></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#b45309' }}>{currency(f.ar)}</strong></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span>Other Receivables (Staff &amp; Home Advances)</span>{drill('other_receivables', 'View Advances & Repayments')}</span></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#6366f1' }}>{currency(otherReceivables.balance)}</strong></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span>Finished Goods Inventory</span>{drill('sales', 'View Finished Goods Stock')}</span></td>
                  <td style={{ textAlign: 'right' }}>{currency(f.fgValue)}</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span>Raw Materials Inventory</span>{drill('raw_materials', 'View Raw Materials Valuation')}</span></td>
                  <td style={{ textAlign: 'right' }}>{currency(f.rmValue)}</td>
                </tr>
                <tr style={{ background: '#eff6ff', fontWeight: 700, borderTop: '2px solid #bfdbfe' }}>
                  <td><strong style={{ color: '#1e40af' }}>TOTAL ASSETS</strong></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#1e40af' }}>{currency(f.totalAssets)}</strong></td>
                </tr>
                <tr style={{ background: 'var(--bg-main)' }}><td colSpan={2} style={{ paddingTop: '14px' }}><strong>LIABILITIES &amp; EQUITY</strong></td></tr>
                <tr><td style={{ paddingLeft: '16px' }}>Supplier Accounts Payable (AP)</td><td style={{ textAlign: 'right' }}>{currency(f.ap)}</td></tr>
                <tr><td style={{ paddingLeft: '16px' }}>Other Payables (Accrued Utilities/Wages)</td><td style={{ textAlign: 'right' }}>{currency(f.otherPayables)}</td></tr>
                <tr><td style={{ paddingLeft: '16px' }}>Stated Capital</td><td style={{ textAlign: 'right' }}>{currency(f.capital)}</td></tr>
                <tr><td style={{ paddingLeft: '16px' }}>Retained Surplus &amp; Profit</td><td style={{ textAlign: 'right' }}>{currency(f.retained)}</td></tr>
                <tr style={{ background: '#eff6ff', fontWeight: 700, borderTop: '2px solid #bfdbfe' }}>
                  <td><strong style={{ color: '#1e40af' }}>TOTAL LIABILITIES &amp; EQUITY</strong></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: '#1e40af' }}>{currency(f.totalAssets)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" id="classicExplorer" style={{ marginBottom: '28px', scrollMarginTop: '80px' }}>
        <div className="card-header" style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><span>📑 Financial Ledger &amp; Transaction Details Explorer</span></h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Detailed audit trails and underlying records that compose the financial statements above.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(key)} style={tab === key ? null : { background: '#fff' }}>{label}</button>
          ))}
          <button type="button" className={`btn btn-sm ${tab === 'reconciliation' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('reconciliation')} style={tab === 'reconciliation' ? null : { background: '#ecfdf5', border: '1.5px solid #10b981', color: '#065f46', fontWeight: 700 }}>⚖️ Asset Reconciliation (Cash, AR, FG, RM)</button>
        </div>

        <div className="card-body" style={{ padding: '16px' }}>
          {tab === 'opex' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" className={`btn btn-sm ${opexCat === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOpexCat('all')} style={{ fontSize: '11px', padding: '3px 8px' }}>All ({f.opex.length})</button>
                  {f.opexItems.map(op => (
                    <button key={op.category} type="button" className={`btn btn-sm ${opexCat === op.category ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOpexCat(op.category)} style={{ fontSize: '11px', padding: '3px 8px', ...(opexCat === op.category ? null : { background: '#fff' }) }}>{op.category} ({currency(op.total)})</button>
                  ))}
                </div>
                <div style={{ minWidth: '180px' }}>
                  <input type="text" className="form-control" placeholder="🔍 Search description, ref..." value={opexSearch} onChange={e => setOpexSearch(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', height: '30px' }} />
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead style={STICKY}>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={TH}>Date</th><th style={TH}>Reference</th><th style={TH}>Category</th><th style={TH}>Recipient / Party</th><th style={TH}>Wallet</th><th style={{ ...TH, textAlign: 'right' }}>Amount (GHS)</th><th style={TH}>Description / Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opexRows.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...TD, fontWeight: 500 }}>{day(t.transaction_date)}</td>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--secondary)' }}>{t.transaction_id || `#${t.id}`}</td>
                        <td style={TD}><span className="badge badge-secondary" style={{ fontSize: '11px' }}>{t.category || 'Uncategorised'}</span></td>
                        <td style={{ ...TD, color: 'var(--text-muted)' }}>{t.comments || '-'}</td>
                        <td style={TD}>{t.payment_method || '-'}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>-{currency(t.amount)}</td>
                        <td style={{ ...TD, fontSize: '12px', color: 'var(--text-main)' }}>{t.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>Total OpEx Reconciled: <strong style={{ color: '#dc2626' }}>-{currency(f.opexTotal)}</strong></div>
            </div>
          ) : null}

          {tab === 'receivables' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>All <strong>{f.arInvoices.length}</strong> currently unpaid or partially paid invoices that make up the <strong>{currency(f.ar)}</strong> trade receivables balance.</div>
                <div><a href="#receivables" onClick={act(() => ctx.goTo('receivables'))} className="btn btn-sm btn-primary" style={{ fontSize: '12px' }}>Go to Full Receivables Aging →</a></div>
              </div>
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead style={STICKY}>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={TH}>Invoice #</th><th style={TH}>Date</th><th style={TH}>Customer</th><th style={{ ...TH, textAlign: 'right' }}>Total Billed</th><th style={{ ...TH, textAlign: 'right' }}>Amount Paid</th><th style={{ ...TH, textAlign: 'right' }}>Balance Due</th><th style={{ ...TH, textAlign: 'center' }}>Status</th><th style={{ ...TH, textAlign: 'center' }}>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.arInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...TD, fontWeight: 700, color: 'var(--primary)' }}>{invNo(inv.id)}</td>
                        <td style={TD}>{day(inv.invoice_date)}</td>
                        <td style={{ ...TD, fontWeight: 600, color: 'var(--secondary)' }}>{inv.customer_name}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{currency(inv.total_amount)}</td>
                        <td style={{ ...TD, textAlign: 'right', color: '#059669' }}>{currency(paidOf(inv))}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{currency(outstandingOf(inv))}</td>
                        <td style={{ ...TD, textAlign: 'center' }}>{paidOf(inv) > 0.005 ? <span className="badge badge-warning">Partially Paid</span> : <span className="badge badge-danger">Unpaid</span>}</td>
                        <td style={{ ...TD, textAlign: 'center' }}><a href="#invoice" onClick={act(() => ctx.viewInvoice(inv))} className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '2px 7px' }}>Invoice</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'other_receivables' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Audit schedule of staff, personal &amp; household advances and subsequent refunds. Current Net Balance: <strong style={{ color: '#6366f1' }}>{currency(otherReceivables.balance)}</strong>.</div>
                <div><a href="#receivables" onClick={act(() => ctx.goTo('receivables'))} className="btn btn-sm btn-primary" style={{ fontSize: '12px' }}>Go to Receivables Hub →</a></div>
              </div>
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <OtherReceivablesTable rows={otherReceivables.statement || []} />
              </div>
            </div>
          ) : null}

          {tab === 'batches' ? (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Details of all <strong>{f.batches.length}</strong> completed production runs composing the <strong>+{currency(f.surplus)}</strong> manufacturing efficiency surplus.</div>
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead style={STICKY}>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={TH}>Batch #</th><th style={TH}>Date</th><th style={TH}>Output Mix</th><th style={{ ...TH, textAlign: 'right' }}>Output Value</th><th style={{ ...TH, textAlign: 'right' }}>RM Cost</th><th style={{ ...TH, textAlign: 'right' }}>Overheads</th><th style={{ ...TH, textAlign: 'right' }}>Total Cost</th><th style={{ ...TH, textAlign: 'right' }}>Surplus (Profit)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.batches.map(({ b, value, overhead, surplus, litres, mix }) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...TD, fontWeight: 700, color: 'var(--primary)' }}>{b.batch_number || `#${b.id}`}</td>
                        <td style={TD}>{day(b.production_date)}</td>
                        <td style={{ ...TD, fontSize: '11.5px', color: 'var(--text-muted)', maxWidth: '200px' }}>{mix || 'Batch run'} ({litres.toFixed(1)}L)</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#059669' }}>{currency(value)}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{currency(b.total_raw_material_cost)}</td>
                        <td style={{ ...TD, textAlign: 'right', color: 'var(--text-muted)' }}>{currency(overhead)}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{currency(b.total_cost)}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: surplus >= 0 ? '#059669' : '#dc2626' }}>{surplus > 0 ? '+' : ''}{currency(surplus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'sales' ? (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Commercial sales revenue and direct production cost breakdown across all bottle sizes.</div>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={TH}>Bottle Size</th><th style={{ ...TH, textAlign: 'center' }}>Transactions</th><th style={{ ...TH, textAlign: 'right' }}>Units Sold</th><th style={{ ...TH, textAlign: 'right' }}>Revenue</th><th style={{ ...TH, textAlign: 'right' }}>Direct COGS</th><th style={{ ...TH, textAlign: 'right' }}>Gross Margin</th><th style={{ ...TH, textAlign: 'right' }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.salesBySize.map(p => (
                      <tr key={p.size} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...TD, fontWeight: 700, color: 'var(--secondary)' }}>{p.size}</td>
                        <td style={{ ...TD, textAlign: 'center' }}>{p.lines} lines</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{Math.trunc(p.qty)} pcs</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{currency(p.revenue)}</td>
                        <td style={{ ...TD, textAlign: 'right', color: '#dc2626' }}>-{currency(p.cogs)}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{currency(p.revenue - p.cogs)}</td>
                        <td style={{ ...TD, textAlign: 'right' }}><span className={`badge ${p.revenue - p.cogs >= 0 ? 'badge-success' : 'badge-danger'}`}>{p.revenue > 0 ? (((p.revenue - p.cogs) / p.revenue) * 100).toFixed(1) : '0.0'}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                      <td style={TD}>Total Commercial Sales</td><td /><td />
                      <td style={{ ...TD, textAlign: 'right', color: '#059669' }}>{currency(f.sales)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#dc2626' }}>-{currency(f.cogs)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: 'var(--primary)' }}>{currency(f.sales - f.cogs)}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>{f.sales > 0 ? (((f.sales - f.cogs) / f.sales) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'raw_materials' ? (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Valuation schedule of all <strong>{rawMaterials.length}</strong> raw materials composing the <strong>{currency(f.rmValue)}</strong> current inventory asset.</div>
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead style={STICKY}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ ...TH, textAlign: 'center' }}>ID</th><th style={TH}>Material Name</th><th style={{ ...TH, textAlign: 'center' }}>Category</th><th style={{ ...TH, textAlign: 'right' }}>Opening</th><th style={{ ...TH, textAlign: 'right' }}>Purchased</th><th style={{ ...TH, textAlign: 'right' }}>Consumed</th><th style={{ ...TH, textAlign: 'right' }}>Available Stock</th><th style={{ ...TH, textAlign: 'right' }}>Unit Cost</th><th style={{ ...TH, textAlign: 'right' }}>Total Asset Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawMaterials.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...TD, textAlign: 'center', fontFamily: 'monospace', fontSize: '11px' }}>{/^\d+$/.test(String(m.id)) ? `RM-${String(m.id).padStart(4, '0')}` : m.id}</td>
                        <td style={{ ...TD, fontWeight: 600, color: 'var(--secondary)' }}>{m.name}</td>
                        <td style={{ ...TD, textAlign: 'center' }}><span className="badge badge-secondary" style={{ fontSize: '10.5px' }}>{m.category || '-'}</span></td>
                        <td style={{ ...TD, textAlign: 'right', color: 'var(--text-muted)' }}>{qty(m.opening_stock)} {m.unit}</td>
                        <td style={{ ...TD, textAlign: 'right', color: '#059669' }}>+{qty(m.stock_in)}</td>
                        <td style={{ ...TD, textAlign: 'right', color: '#dc2626' }}>-{qty(m.stock_out)}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{qty(m.available)} {m.unit}</td>
                        <td style={{ ...TD, textAlign: 'right', color: 'var(--text-muted)' }}>GHS {num(m.unit_price).toFixed(2)}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{currency(Math.max(0, num(m.available)) * num(m.unit_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                      <td colSpan={8} style={TD}>Total Raw Materials Asset Valuation</td>
                      <td style={{ ...TD, textAlign: 'right', color: 'var(--primary)' }}>{currency(f.rmValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'wallets' ? (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Summary of cash movements, collections, and disbursements composing the liquid cash balance of <strong>{currency(treasury.total)}</strong>.</div>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={TH}>Wallet Account</th><th style={{ ...TH, textAlign: 'center' }}>Transactions</th><th style={{ ...TH, textAlign: 'right' }}>Total Inflow (+)</th><th style={{ ...TH, textAlign: 'right' }}>Total Outflow (−)</th><th style={{ ...TH, textAlign: 'right' }}>Net Reconciled Balance</th><th style={{ ...TH, textAlign: 'center' }}>View Full Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treasury.wallets.map(w => {
                      const inflow = w.statement.reduce((t, r) => t + r.inflow, 0)
                      const outflow = w.statement.reduce((t, r) => t + r.outflow, 0)
                      return (
                        <tr key={w.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ ...TD, fontWeight: 700, color: 'var(--secondary)' }}>{w.label}</td>
                          <td style={{ ...TD, textAlign: 'center' }}>{w.statement.length} records</td>
                          <td style={{ ...TD, textAlign: 'right', color: '#059669', fontWeight: 600 }}>+{currency(inflow)}</td>
                          <td style={{ ...TD, textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>-{currency(outflow)}</td>
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: w.balance >= 0 ? '#059669' : '#dc2626' }}>{currency(w.balance)}</td>
                          <td style={{ ...TD, textAlign: 'center' }}><a href="#cashbook" onClick={act(() => ctx.goTo('treasury', w.key))} className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '2px 7px' }}>Cashbook</a></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#eff6ff', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                      <td colSpan={4} style={TD}>Total Liquid Cash Balance</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#2563eb', fontSize: '14px' }}>{currency(treasury.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'reconciliation' ? <ClassicReconciliation ctx={ctx} user={user} /> : null}
        </div>
      </div>
    </>
  )
}

export default ClassicFinancials
