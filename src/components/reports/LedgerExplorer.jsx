import { useMemo, useState } from 'react'
import './LedgerExplorer.css'

// Financial Ledger & Transaction Details Explorer, after the Plus Yoghurt ERP
// (templates/financials.html): the records behind each statement line, by tab.
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) {
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}`
}
function qty(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num(v)) }
function day(v) { return String(v || '').slice(0, 10) || '—' }
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

function LedgerExplorer({ data, treasury, otherReceivables, rawMaterials, outstandingOf, paidOf, invNo, view, onView, onViewInvoice, onGoTo }) {
  const [search, setSearch] = useState('')
  const tab = view.tab
  const opexCat = view.cat || 'all'

  const f = useMemo(() => {
    const cost = unitCostBySize(data.productionBatches)
    const bySize = new Map()
    data.invoices.filter(inv => !inv.is_sample_sale).flatMap(inv => inv.lines || []).forEach(l => {
      const s = bySize.get(l.product_size) || { size: l.product_size, lines: 0, qty: 0, revenue: 0, cogs: 0 }
      s.lines += 1
      s.qty += num(l.quantity)
      s.revenue += num(l.line_total)
      s.cogs += num(l.quantity) * (cost.get(l.product_size) || 0)
      bySize.set(l.product_size, s)
    })
    const salesBySize = [...bySize.values()].sort((a, b) => b.revenue - a.revenue)
    const batches = data.productionBatches.map(b => {
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
    const opex = data.accountTransactions
      .filter(t => String(t.entry_type || '').toLowerCase() === 'expense')
      .sort((a, b) => day(b.transaction_date).localeCompare(day(a.transaction_date)))
    const byCat = new Map()
    opex.forEach(t => byCat.set(t.category || 'Uncategorised', (byCat.get(t.category || 'Uncategorised') || 0) + num(t.amount)))
    const arInvoices = data.invoices.filter(inv => outstandingOf(inv) > 0.005).sort((a, b) => day(b.invoice_date).localeCompare(day(a.invoice_date)))
    return {
      salesBySize,
      sales: salesBySize.reduce((t, s) => t + s.revenue, 0),
      cogs: salesBySize.reduce((t, s) => t + s.cogs, 0),
      batches,
      surplus: batches.reduce((t, b) => t + b.surplus, 0),
      opex,
      opexItems: [...byCat.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
      opexTotal: opex.reduce((t, o) => t + num(o.amount), 0),
      arInvoices,
      ar: arInvoices.reduce((t, inv) => t + outstandingOf(inv), 0),
      rmValue: rawMaterials.reduce((t, m) => t + Math.max(0, num(m.available)) * num(m.unit_price), 0),
    }
  }, [data, rawMaterials, outstandingOf])

  const q = search.trim().toLowerCase()
  const hit = (...fields) => !q || fields.some(v => String(v ?? '').toLowerCase().includes(q))
  const otherRows = otherReceivables.statement || []
  const TABS = [
    ['opex', 'Operating Expenses', f.opex.length],
    ['receivables', 'Trade Receivables', f.arInvoices.length],
    ['other_receivables', 'Other Receivables', otherRows.length],
    ['batches', 'Batch Manufacturing', f.batches.length],
    ['sales', 'Sales & COGS by Product', null],
    ['raw_materials', 'Raw Materials Schedule', rawMaterials.length],
    ['wallets', 'Cash & Wallet Ledger', null],
  ]
  const setTab = key => { setSearch(''); onView({ tab: key, cat: 'all' }) }

  let body = null
  if (tab === 'opex') {
    const rows = f.opex.filter(t => (opexCat === 'all' || (t.category || 'Uncategorised') === opexCat) && hit(t.transaction_id, t.description, t.comments, t.category, t.payment_method))
    body = (
      <>
        <div className="le-chips">
          <button type="button" className={`le-chip${opexCat === 'all' ? ' is-active' : ''}`} onClick={() => onView({ tab, cat: 'all' })}>All ({f.opex.length})</button>
          {f.opexItems.map(op => (
            <button key={op.category} type="button" className={`le-chip${opexCat === op.category ? ' is-active' : ''}`} onClick={() => onView({ tab, cat: op.category })}>{op.category} <span>{money(op.total)}</span></button>
          ))}
        </div>
        <Table
          head={['Date', 'Reference', 'Category', 'Recipient / Party', 'Wallet', ['Amount', 'num'], 'Description / Purpose']}
          rows={rows.map(t => [
            day(t.transaction_date),
            <span key="r" className="le-mono">{t.transaction_id || `#${t.id}`}</span>,
            <span key="c" className="le-pill">{t.category || 'Uncategorised'}</span>,
            t.comments || '—',
            t.payment_method || '—',
            [<span key="a" className="is-bad">-{money(t.amount)}</span>, 'num'],
            t.description || '—',
          ])}
          keys={rows.map(t => t.id)}
          foot={['Total operating expenses', <span key="t" className="is-bad">-{money(opexCat === 'all' ? f.opexTotal : rows.reduce((s, t) => s + num(t.amount), 0))}</span>]}
        />
      </>
    )
  } else if (tab === 'receivables') {
    const rows = f.arInvoices.filter(inv => hit(invNo(inv.id), inv.customer_name))
    body = (
      <>
        <p className="le-note"><strong>{f.arInvoices.length}</strong> unpaid or part-paid invoices make up <strong>{money(f.ar)}</strong> in trade receivables. <button type="button" className="le-link" onClick={() => onGoTo('receivables')}>Open Customer Debts →</button></p>
        <Table
          head={['Invoice #', 'Date', 'Customer', ['Total Billed', 'num'], ['Amount Paid', 'num'], ['Balance Due', 'num'], 'Status', '']}
          rows={rows.map(inv => [
            <strong key="n" className="is-blue">{invNo(inv.id)}</strong>,
            day(inv.invoice_date),
            <strong key="c">{inv.customer_name}</strong>,
            [money(inv.total_amount), 'num'],
            [<span key="p" className="is-good">{money(paidOf(inv))}</span>, 'num'],
            [<strong key="b" className="is-orange">{money(outstandingOf(inv))}</strong>, 'num'],
            paidOf(inv) > 0.005 ? <span key="s" className="le-badge is-warn">Part paid</span> : <span key="s" className="le-badge is-bad">Unpaid</span>,
            <button key="v" type="button" className="le-btn" onClick={() => onViewInvoice(inv)}>Invoice</button>,
          ])}
          keys={rows.map(inv => inv.id)}
        />
      </>
    )
  } else if (tab === 'other_receivables') {
    const rows = otherRows.filter(r => hit(r.reference, r.counterpart, r.description, r.comments))
    body = (
      <>
        <p className="le-note">Staff, personal &amp; household advances and their refunds. Net balance <strong className="is-blue">{money(otherReceivables.balance)}</strong>. <button type="button" className="le-link" onClick={() => onGoTo('treasury')}>Open Cashbook →</button></p>
        <Table
          head={['Date', 'Reference', 'Nature', 'Wallet', ['Advance (+)', 'num'], ['Refund (−)', 'num'], ['Running Balance', 'num'], 'Description']}
          rows={rows.map(r => [
            day(r.date),
            <span key="r" className="le-mono">{r.reference || `#${r.id}`}</span>,
            r.kind === 'in' ? <span key="k" className="le-badge is-warn">Advance issued</span> : <span key="k" className="le-badge is-good">Refund received</span>,
            r.counterpart || '—',
            [r.inflow > 0 ? <span key="i" className="is-orange">+{money(r.inflow)}</span> : '—', 'num'],
            [r.outflow > 0 ? <span key="o" className="is-good">-{money(r.outflow)}</span> : '—', 'num'],
            [<strong key="b">{money(r.balance)}</strong>, 'num'],
            r.description || r.comments || '—',
          ])}
          keys={rows.map(r => r.id)}
        />
      </>
    )
  } else if (tab === 'batches') {
    const rows = f.batches.filter(r => hit(r.b.batch_number, r.mix, day(r.b.production_date)))
    body = (
      <>
        <p className="le-note"><strong>{f.batches.length}</strong> production runs make up the <strong className={f.surplus >= 0 ? 'is-good' : 'is-bad'}>{f.surplus >= 0 ? '+' : ''}{money(f.surplus)}</strong> manufacturing surplus.</p>
        <Table
          head={['Batch #', 'Date', 'Output Mix', ['Output Value', 'num'], ['RM Cost', 'num'], ['Overheads', 'num'], ['Total Cost', 'num'], ['Surplus', 'num']]}
          rows={rows.map(({ b, value, overhead, surplus, litres, mix }) => [
            <strong key="n" className="is-blue">{b.batch_number || `#${b.id}`}</strong>,
            day(b.production_date),
            <span key="m" className="le-muted">{mix || 'Batch run'} ({litres.toFixed(1)} L)</span>,
            [<span key="v" className="is-good">{money(value)}</span>, 'num'],
            [money(b.total_raw_material_cost), 'num'],
            [money(overhead), 'num'],
            [money(b.total_cost), 'num'],
            [<strong key="s" className={surplus >= 0 ? 'is-good' : 'is-bad'}>{surplus > 0 ? '+' : ''}{money(surplus)}</strong>, 'num'],
          ])}
          keys={rows.map(r => r.b.id)}
        />
      </>
    )
  } else if (tab === 'sales') {
    const rows = f.salesBySize.filter(p => hit(p.size))
    const pct = (rev, cogs) => (rev > 0 ? (((rev - cogs) / rev) * 100).toFixed(1) : '0.0')
    body = (
      <Table
        head={['Bottle Size', 'Transactions', ['Units Sold', 'num'], ['Revenue', 'num'], ['Direct COGS', 'num'], ['Gross Margin', 'num'], ['Margin %', 'num']]}
        rows={rows.map(p => [
          <strong key="s">{p.size}</strong>,
          `${p.lines} lines`,
          [`${Math.trunc(p.qty)} pcs`, 'num'],
          [<strong key="r" className="is-good">{money(p.revenue)}</strong>, 'num'],
          [<span key="c" className="is-bad">-{money(p.cogs)}</span>, 'num'],
          [<strong key="g" className="is-blue">{money(p.revenue - p.cogs)}</strong>, 'num'],
          [<span key="m" className={`le-badge ${p.revenue - p.cogs >= 0 ? 'is-good' : 'is-bad'}`}>{pct(p.revenue, p.cogs)}%</span>, 'num'],
        ])}
        keys={rows.map(p => p.size)}
        foot={['Total commercial sales', `${money(f.sales)} revenue · -${money(f.cogs)} COGS · ${money(f.sales - f.cogs)} margin (${pct(f.sales, f.cogs)}%)`]}
      />
    )
  } else if (tab === 'raw_materials') {
    const rows = rawMaterials.filter(m => hit(m.name, m.category))
    body = (
      <>
        <p className="le-note"><strong>{rawMaterials.length}</strong> raw materials make up the <strong className="is-blue">{money(f.rmValue)}</strong> inventory asset.</p>
        <Table
          head={['ID', 'Material', 'Category', ['Opening', 'num'], ['Purchased', 'num'], ['Consumed', 'num'], ['Available', 'num'], ['Unit Cost', 'num'], ['Asset Value', 'num']]}
          rows={rows.map(m => [
            <span key="i" className="le-mono">{/^\d+$/.test(String(m.id)) ? `RM-${String(m.id).padStart(4, '0')}` : m.id}</span>,
            <strong key="n">{m.name}</strong>,
            <span key="c" className="le-pill">{m.category || '—'}</span>,
            [<span key="o" className="le-muted">{qty(m.opening_stock)} {m.unit}</span>, 'num'],
            [<span key="p" className="is-good">+{qty(m.stock_in)}</span>, 'num'],
            [<span key="u" className="is-bad">-{qty(m.stock_out)}</span>, 'num'],
            [<strong key="a">{qty(m.available)} {m.unit}</strong>, 'num'],
            [money(m.unit_price), 'num'],
            [<strong key="v" className="is-blue">{money(Math.max(0, num(m.available)) * num(m.unit_price))}</strong>, 'num'],
          ])}
          keys={rows.map(m => m.id)}
          foot={['Total raw materials valuation', <strong key="t" className="is-blue">{money(f.rmValue)}</strong>]}
        />
      </>
    )
  } else if (tab === 'wallets') {
    body = (
      <Table
        head={['Wallet', 'Transactions', ['Total Inflow (+)', 'num'], ['Total Outflow (−)', 'num'], ['Net Balance', 'num'], '']}
        rows={treasury.wallets.map(w => [
          <strong key="w">{w.label}</strong>,
          `${w.statement.length} records`,
          [<span key="i" className="is-good">+{money(w.statement.reduce((t, r) => t + r.inflow, 0))}</span>, 'num'],
          [<span key="o" className="is-bad">-{money(w.statement.reduce((t, r) => t + r.outflow, 0))}</span>, 'num'],
          [<strong key="b" className={w.balance >= 0 ? 'is-good' : 'is-bad'}>{money(w.balance)}</strong>, 'num'],
          <button key="v" type="button" className="le-btn" onClick={() => onGoTo('treasury', w.key)}>Cashbook</button>,
        ])}
        keys={treasury.wallets.map(w => w.key)}
        foot={['Total liquid cash balance', <strong key="t" className="is-blue">{money(treasury.total)}</strong>]}
      />
    )
  }

  return (
    <>
      <section className="workspace-inline-tabs le-tabs" role="tablist" aria-label="Ledger views">
        {TABS.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`workspace-inline-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}{count !== null ? <span className="le-count">{count}</span> : null}
          </button>
        ))}
        <button type="button" className="workspace-inline-tab le-tab-link" onClick={() => onGoTo('reconciliation')}>Asset Reconciliation →</button>
      </section>
      <section className="le-card" aria-label="Financial ledger explorer">
        <header className="le-head">
          <h2>{TABS.find(t => t[0] === tab)?.[1] || 'Ledger'}</h2>
          <input type="search" className="le-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </header>
        <div className="le-body">{body}</div>
      </section>
    </>
  )
}

// Cells are plain values or [value, 'num'] for right-aligned figures.
function Table({ head, rows, keys, foot = null }) {
  const cell = c => (Array.isArray(c) ? c : [c, ''])
  return (
    <div className="le-table-wrap">
      <table className="le-table">
        <thead><tr>{head.map((h, i) => { const [label, cls] = cell(h); return <th key={i} className={cls}>{label}</th> })}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, ri) => (
            <tr key={keys[ri]}>{r.map((c, ci) => { const [value, cls] = cell(c); return <td key={ci} className={cls}>{value}</td> })}</tr>
          )) : <tr><td colSpan={head.length} className="le-empty">No records.</td></tr>}
        </tbody>
      </table>
      {foot ? <div className="le-foot"><span>{foot[0]}</span><span>{foot[1]}</span></div> : null}
    </div>
  )
}

export default LedgerExplorer
