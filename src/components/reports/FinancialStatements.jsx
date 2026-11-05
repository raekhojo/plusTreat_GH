import { useMemo } from 'react'
import { FiSearch } from 'react-icons/fi'
import './FinancialStatements.css'

// Income Statement + Balance Sheet, built the same way as the Plus Yoghurt ERP
// (templates/financials.html): lifetime figures straight from the records.
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) {
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}`
}
function tbValue(rows, description) {
  const row = rows.find(r => String(r.description || '').toLowerCase() === description.toLowerCase())
  return row ? num(row.available) : 0
}
// Average production cost per bottle, by size, across every batch output.
function unitCostBySize(batches) {
  const agg = new Map()
  batches.forEach(b => (b.outputs || []).forEach(o => {
    const q = num(o.quantity)
    if (q <= 0) return
    const a = agg.get(o.product_size) || { qty: 0, amount: 0 }
    a.qty += q
    a.amount += num(o.amount) || q * num(o.unit_cost)
    agg.set(o.product_size, a)
  }))
  const out = new Map()
  agg.forEach((a, size) => out.set(size, a.qty ? a.amount / a.qty : 0))
  return out
}

function Drill({ target, title, onDrill }) {
  if (!onDrill) return null
  return <button type="button" className="fs-drill" title={title} aria-label={title} onClick={() => onDrill(target)}><FiSearch aria-hidden="true" /></button>
}
function Row({ label, value, tone = '', target, title, indent = false, strong = false, onDrill }) {
  return (
    <div className={`fs-row${indent ? ' is-indent' : ''}`}>
      <span className="fs-label">{strong ? <strong>{label}</strong> : label}{target ? <Drill target={target} title={title} onDrill={onDrill} /> : null}</span>
      <span className={`fs-value${tone ? ` is-${tone}` : ''}`}>{value}</span>
    </div>
  )
}

function FinancialStatements({ data, treasuryTotal, otherReceivablesBalance, inventoryLedger, rawMaterials, outstandingOf, purchaseOutstandingOf, onDrill, view = 'both' }) {
  const f = useMemo(() => {
    const cost = unitCostBySize(data.productionBatches)
    const lines = data.invoices.filter(inv => !inv.is_sample_sale).flatMap(inv => inv.lines || [])
    const sales = lines.reduce((t, l) => t + num(l.line_total), 0)
    const cogs = lines.reduce((t, l) => t + num(l.quantity) * (cost.get(l.product_size) || 0), 0)
    const surplus = data.productionBatches.reduce((t, b) => {
      const value = num(b.total_production_value) || (b.outputs || []).reduce((s, o) => s + num(o.amount), 0)
      return t + value - num(b.total_cost)
    }, 0)
    const opexByCat = new Map()
    data.accountTransactions
      .filter(t => String(t.entry_type || '').toLowerCase() === 'expense')
      .forEach(t => opexByCat.set(t.category || 'Uncategorised', (opexByCat.get(t.category || 'Uncategorised') || 0) + num(t.amount)))
    const opexItems = [...opexByCat.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
    const opexTotal = opexItems.reduce((t, o) => t + o.total, 0)

    const fgValue = inventoryLedger.reduce((t, i) => t + Math.max(0, num(i.available)) * (cost.get(i.size) || 0), 0)
    const rmValue = rawMaterials.reduce((t, m) => t + Math.max(0, num(m.available)) * num(m.unit_price), 0)
    const ar = data.invoices.reduce((t, inv) => t + outstandingOf(inv), 0)
    const tb = data.trialBalanceReport?.rows || []
    const ppe = tbValue(tb, 'PPE')
    const equipment = tbValue(tb, 'Equipment')
    const totalAssets = ppe + equipment + num(treasuryTotal) + ar + num(otherReceivablesBalance) + fgValue + rmValue
    const ap = data.purchases.reduce((t, p) => t + purchaseOutstandingOf(p), 0)
    const otherPayables = tbValue(tb, 'Other Payables')
    const capital = tbValue(tb, 'Equity')
    return {
      sales, cogs, surplus, opexItems, opexTotal, net: sales - cogs + surplus - opexTotal,
      fgValue, rmValue, ar, ppe, equipment, totalAssets, ap, otherPayables, capital,
      retained: totalAssets - ap - otherPayables - capital,
    }
  }, [data, treasuryTotal, otherReceivablesBalance, inventoryLedger, rawMaterials, outstandingOf, purchaseOutstandingOf])

  const drill = (target, title) => <Drill target={target} title={title} onDrill={onDrill} />

  return (
    <div className={`fs-grid${view === 'both' ? '' : ' is-single'}`}>
      {view !== 'balance' ? <section className="fs-card" aria-label="Income statement">
        <header className="fs-head"><h2>Income Statement</h2><span className="fs-tag">Lifetime</span></header>
        <div className="fs-body">
          <Row onDrill={onDrill} label="Commercial Sales Revenue" strong value={money(f.sales)} tone="good" target="sales" title="View sales" />
          <Row onDrill={onDrill} label="Direct Cost of Goods Sold (COGS)" indent value={`-${money(f.cogs)}`} tone="bad" target="sales" title="View sales" />
          <div className="fs-row is-subtotal"><span className="fs-label">Commercial Gross Profit</span><span className="fs-value">{money(f.sales - f.cogs)}</span></div>
          <Row onDrill={onDrill} label="Batch Manufacturing Efficiency Surplus" strong value={`${f.surplus >= 0 ? '+' : '-'}${money(Math.abs(f.surplus))}`} tone={f.surplus >= 0 ? 'good' : 'bad'} target="batches" title="View production batches" />
          <div className="fs-section"><span>Operating Expenses (OpEx)</span>{drill('opex', 'View all expense transactions')}</div>
          {f.opexItems.map(op => <Row onDrill={onDrill} key={op.category} label={op.category} indent value={`-${money(op.total)}`} tone="bad" target={`opex:${op.category}`} title={`View ${op.category} transactions`} />)}
          <div className="fs-row is-subtotal"><span className="fs-label">Total Operating Expenses</span><span className="fs-value is-bad">-{money(f.opexTotal)}</span></div>
          <div className={`fs-row is-total ${f.net >= 0 ? 'is-profit' : 'is-loss'}`}><span className="fs-label">Net Operating Profit / Surplus</span><span className="fs-value">{money(f.net)}</span></div>
        </div>
      </section> : null}

      {view !== 'income' ? <section className="fs-card" aria-label="Balance sheet">
        <header className="fs-head">
          <h2>Balance Sheet</h2>
          {onDrill ? <button type="button" className="fs-link" onClick={() => onDrill('reconciliation')}>Asset Reconciliation →</button> : null}
        </header>
        <div className="fs-body">
          <div className="fs-section"><span>Assets</span></div>
          <Row onDrill={onDrill} label="Property, Plant & Equipment (PPE)" indent value={money(f.ppe)} />
          <Row onDrill={onDrill} label="Tools & Equipment" indent value={money(f.equipment)} />
          <Row onDrill={onDrill} label="Cash & Wallets (Total Liquid)" indent value={money(treasuryTotal)} tone="blue" target="wallets" title="View wallets" />
          <Row onDrill={onDrill} label="Trade Receivables (AR)" indent value={money(f.ar)} tone="orange" target="receivables" title="View customer debts" />
          <Row onDrill={onDrill} label="Other Receivables (Staff & Home Advances)" indent value={money(otherReceivablesBalance)} tone="blue" target="other_receivables" title="View advances and refunds" />
          <Row onDrill={onDrill} label="Finished Goods Inventory" indent value={money(f.fgValue)} target="finished" title="View finished goods" />
          <Row onDrill={onDrill} label="Raw Materials Inventory" indent value={money(f.rmValue)} target="raw_materials" title="View raw materials" />
          <div className="fs-row is-total"><span className="fs-label">Total Assets</span><span className="fs-value">{money(f.totalAssets)}</span></div>
          <div className="fs-section"><span>Liabilities &amp; Equity</span></div>
          <Row onDrill={onDrill} label="Supplier Accounts Payable (AP)" indent value={money(f.ap)} />
          <Row onDrill={onDrill} label="Other Payables (Accrued Utilities/Wages)" indent value={money(f.otherPayables)} />
          <Row onDrill={onDrill} label="Stated Capital" indent value={money(f.capital)} />
          <Row onDrill={onDrill} label="Retained Surplus & Profit" indent value={money(f.retained)} />
          <div className="fs-row is-total"><span className="fs-label">Total Liabilities &amp; Equity</span><span className="fs-value">{money(f.totalAssets)}</span></div>
        </div>
      </section> : null}
    </div>
  )
}

export default FinancialStatements
