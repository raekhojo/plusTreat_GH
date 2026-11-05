import { useMemo } from 'react'
import { currency, inPeriod, num } from '../format'

// Port of templates/dashboard.html (Executive Control Center).
const WALLETS = [
  { key: 'Cash', label: '💵 Cash on Hand' },
  { key: 'MoMo Wallet', label: '📱 MoMo Wallet' },
  { key: 'GhanaPay', label: '🇬🇭 GhanaPay' },
  { key: 'CalBank', label: '🏦 Cal Bank' },
]

function ClassicDashboard({ ctx, period, onNavigate }) {
  const { data, treasury, inventoryLedger, outstandingOf } = ctx
  const isFiltered = period.key !== 'all'

  const view = useMemo(() => {
    const live = data.invoices.filter(inv => !['cancelled', 'draft'].includes(String(inv.status || '').toLowerCase()))
    const periodInvoices = live.filter(inv => inPeriod(inv.invoice_date, period))
    const periodBatches = data.productionBatches.filter(b => inPeriod(b.production_date, period))

    // Average production cost per bottle, by size, from every batch.
    const costBySize = new Map()
    data.productionBatches.forEach(b => (b.outputs || []).forEach(o => {
      const qty = num(o.quantity)
      if (qty <= 0) return
      const agg = costBySize.get(o.product_size) || { qty: 0, amount: 0 }
      agg.qty += qty
      agg.amount += num(o.amount) || qty * num(o.unit_cost)
      costBySize.set(o.product_size, agg)
    }))

    const fg = inventoryLedger.map(item => {
      const produced = sumQty(periodBatches.flatMap(b => b.outputs || []).filter(o => o.product_size === item.size))
      const sold = sumQty(periodInvoices.flatMap(inv => inv.lines || []).filter(l => l.product_size === item.size))
      const agg = costBySize.get(item.size)
      const unitCost = agg && agg.qty ? agg.amount / agg.qty : 0
      const available = num(item.available)
      return {
        size: item.size,
        produced: isFiltered ? produced : num(item.stockIn),
        sold: isFiltered ? sold : num(item.stockOut),
        available,
        unitCost,
        value: Math.max(0, available) * unitCost,
        produceNow: available <= num(item.productionLevel),
      }
    })

    const debtors = new Map()
    periodInvoices.forEach(inv => {
      const due = outstandingOf(inv)
      if (due <= 0.005) return
      const name = inv.customer_name || 'Unknown'
      const d = debtors.get(name) || { name, customerId: inv.customer, due: 0, count: 0 }
      d.due += due
      d.count += 1
      debtors.set(name, d)
    })

    const batches = [...periodBatches]
      .sort((a, b) => String(b.production_date || '').localeCompare(String(a.production_date || '')) || num(b.id) - num(a.id))
      .slice(0, 5)
      .map(b => {
        const value = num(b.total_production_value) || (b.outputs || []).reduce((t, o) => t + num(o.amount), 0)
        return { id: b.id, number: b.batch_number || `#${b.id}`, date: b.production_date, value, cost: num(b.total_cost), surplus: value - num(b.total_cost) }
      })

    const periodOpen = data.invoices.filter(inv => inPeriod(inv.invoice_date, period) && outstandingOf(inv) > 0.005)
    return {
      ar: periodOpen.reduce((t, inv) => t + outstandingOf(inv), 0),
      arCount: periodOpen.length,
      revenue: periodInvoices.reduce((t, inv) => t + num(inv.total_amount), 0),
      fg,
      fgUnits: fg.reduce((t, r) => t + Math.max(0, r.available), 0),
      fgValue: fg.reduce((t, r) => t + r.value, 0),
      critical: fg.filter(r => r.produceNow).length,
      debtors: [...debtors.values()].sort((a, b) => b.due - a.due).slice(0, 6),
      batches,
    }
  }, [data.invoices, data.productionBatches, inventoryLedger, outstandingOf, period, isFiltered])

  const wallet = key => treasury.wallets.find(w => w.key === key)?.balance || 0

  // Operational priorities (the reference keeps these in an audit table).
  const flags = [
    ...treasury.wallets.filter(w => w.balance < 0).map(w => ({ title: `${w.label} balance is negative`, description: `${w.label} shows ${currency(w.balance)} — more money recorded out than in.`, action: 'Check the cashbook for a missing receipt or a wrong wallet.' })),
    ...view.fg.filter(r => r.produceNow).map(r => ({ title: `${r.size} stock at reorder level`, description: `Only ${fmtQty(r.available)} pcs left in stock.`, action: 'Schedule a production batch for this size.' })),
  ]

  return (
    <>
      {flags.length ? (
        <div className="card" style={{ borderLeft: '5px solid var(--danger)', background: '#fffbfb', marginBottom: '24px' }}>
          <div className="card-body" style={{ padding: '18px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ System Audit Notice ({flags.length} Operational Priorities Detected)
              </h3>
              <a href="#reporting" className="btn btn-sm btn-secondary" style={{ fontSize: '11px' }} onClick={e => { e.preventDefault(); onNavigate('reporting') }}>View All Audits</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
              {flags.slice(0, 3).map(flag => (
                <div key={flag.title} style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#b91c1c' }}>{flag.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' }}>{flag.description}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>💡 {flag.action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Liquid Funds</span>
            <span className="kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>💰</span>
          </div>
          <div className="kpi-value">{currency(treasury.total)}</div>
          <div className="kpi-subtext">Across Cash, MoMo, GhanaPay &amp; Cal Bank</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Trade Receivables (AR)</span>
            <span className="kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>👥</span>
          </div>
          <div className="kpi-value" style={{ color: '#b45309' }}>{currency(view.ar)}</div>
          <div className="kpi-subtext">{isFiltered ? `Owed on ${view.arCount} invoices issued in ${period.label}` : 'Net outstanding customer debts'}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Finished Goods Stock</span>
            <span className="kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>📦</span>
          </div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{fmtQty(view.fgUnits)} <span style={{ fontSize: '16px', fontWeight: 500 }}>Units</span></div>
          <div className="kpi-subtext">Valued at {currency(view.fgValue)}{view.critical ? ' (Critical stockout)' : ''}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">{isFiltered ? 'Period Revenue' : 'Lifetime Revenue'}</span>
            <span className="kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>📈</span>
          </div>
          <div className="kpi-value" style={{ color: '#059669' }}>{currency(view.revenue)}</div>
          <div className="kpi-subtext">{isFiltered ? `Billed sales for ${period.label}` : 'Billed sales across entire database dump'}</div>
        </div>
      </div>

      <div className="wallets-ribbon">
        {WALLETS.map(w => (
          <div key={w.key} className="wallet-box">
            <div>
              <div className="wallet-name">{w.label}</div>
              <div className={`wallet-amt${wallet(w.key) < 0 ? ' negative' : ''}`}>{currency(wallet(w.key))}</div>
            </div>
            <a href="#treasury" className="btn btn-sm btn-secondary" onClick={e => { e.preventDefault(); ctx.viewWallet(w.key) }}>View</a>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🏭 Finished Goods Live Stock &amp; Reorder Alert</h2>
          <a href="#batch" className="btn btn-sm btn-primary" onClick={e => { e.preventDefault(); ctx.openModal('batch') }}>+ Schedule Batch Run</a>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Bottle Size</th>
                <th className="text-right">{isFiltered ? `Produced (${period.label})` : 'Total Produced (Lifetime)'}</th>
                <th className="text-right">{isFiltered ? `Sold (${period.label})` : 'Total Sold (Lifetime)'}</th>
                <th className="text-right">Live Available</th>
                <th className="text-right">Unit Prod. Cost</th>
                <th className="text-right">Inventory Value</th>
                <th className="text-center">Action Alert</th>
              </tr>
            </thead>
            <tbody>
              {view.fg.map(fg => (
                <tr key={fg.size}>
                  <td><strong>{fg.size}</strong></td>
                  <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>+{fmtQty(fg.produced)}</td>
                  <td className="text-right" style={{ color: '#dc2626', fontWeight: 600 }}>-{fmtQty(fg.sold)}</td>
                  <td className="text-right"><strong style={{ fontSize: '15px' }}>{fmtQty(fg.available)} pcs</strong></td>
                  <td className="text-right">{currency(fg.unitCost)}</td>
                  <td className="text-right">{currency(fg.value)}</td>
                  <td className="text-center">
                    {fg.produceNow ? <span className="badge badge-danger">PRODUCE NOW</span> : <span className="badge badge-success">STOCK OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">👥 Top Customer Debtors</h2>
            <a href="#receivables" className="btn btn-sm btn-secondary" onClick={e => { e.preventDefault(); onNavigate('receivables') }}>View All AR</a>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Balance Owing</th>
                  <th className="text-center">Invoices</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {view.debtors.map(deb => (
                  <tr key={deb.name}>
                    <td><strong>{deb.name}</strong></td>
                    <td className="text-right" style={{ color: '#b91c1c', fontWeight: 700 }}>{currency(deb.due)}</td>
                    <td className="text-center">{deb.count} open</td>
                    <td className="text-center">
                      <a href="#statement" className="btn btn-sm btn-secondary" onClick={e => { e.preventDefault(); ctx.onStatement({ title: deb.name, id: deb.customerId }) }}>Statement</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🧪 Recent Production Batches</h2>
            <a href="#production" className="btn btn-sm btn-secondary" onClick={e => { e.preventDefault(); onNavigate('production_ops') }}>Batches Log</a>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th className="text-center">Batch #</th>
                  <th className="text-center">Date</th>
                  <th className="text-right">Output Value</th>
                  <th className="text-right">Total Cost</th>
                  <th className="text-right">Surplus</th>
                </tr>
              </thead>
              <tbody>
                {view.batches.map(b => (
                  <tr key={b.id}>
                    <td className="text-center"><strong>{b.number}</strong></td>
                    <td className="text-center">{String(b.date || '').slice(0, 10)}</td>
                    <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>{currency(b.value)}</td>
                    <td className="text-right">{currency(b.cost)}</td>
                    <td className="text-right">
                      <span className={`badge ${b.surplus < 0 ? 'badge-danger' : 'badge-success'}`}>{b.surplus < 0 ? '' : '+'}{currency(b.surplus)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

function sumQty(list) {
  return list.reduce((t, x) => t + num(x.quantity), 0)
}
function fmtQty(v) {
  const n = num(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export default ClassicDashboard
