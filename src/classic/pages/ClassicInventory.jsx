import { useMemo, useState } from 'react'
import { act, currency, day, inPeriod, matches, num, number, qty, unitCostBySize } from '../format'

// Port of templates/inventory.html (Finished Goods & Raw Materials Inventory).
const CAT_BTN = { fontSize: '11.5px', padding: '4px 10px' }

function broadCategory(rm) {
  const text = `${rm.category || ''} ${rm.name || ''}`
  if (/bottle/i.test(text)) return 'Bottles'
  if (/label/i.test(text)) return 'Labels'
  if (/flavou?r|colou?r/i.test(text)) return 'Flavours'
  return 'Ingredients'
}
const BROAD_BADGE = { Bottles: 'badge-secondary', Labels: 'badge-warning', Flavours: 'badge-info', Ingredients: 'badge-primary' }

function rmId(id) {
  return /^\d+$/.test(String(id)) ? `RM-${String(id).padStart(4, '0')}` : String(id)
}

function MovementsModal({ size, ctx, period, onClose }) {
  const { data, invNo } = ctx
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const view = useMemo(() => {
    const stockIn = []
    data.productionBatches.forEach(b => (b.outputs || []).forEach(o => {
      if (o.product_size !== size) return
      stockIn.push({ date: day(b.production_date), batch: b.batch_number || `#${b.id}`, type: b.batch_type || 'production', quantity: num(o.quantity), unitCost: num(o.unit_cost), value: num(o.amount) || num(o.quantity) * num(o.unit_cost), notes: b.notes || '' })
    }))
    const stockOut = []
    data.invoices.forEach(inv => (inv.lines || []).forEach(l => {
      if (l.product_size !== size) return
      stockOut.push({ date: day(inv.invoice_date), invoice: invNo(inv.id), customer: inv.customer_name || 'Walk-in', tier: l.pricing_category || l.pricing_category_name || 'Standard', quantity: num(l.quantity), unitPrice: num(l.unit_price), total: num(l.line_total), saleType: inv.is_sample_sale ? 'Sample' : 'Sale', notes: inv.notes || '' })
    }))
    const events = [
      ...stockIn.map(i => ({ date: i.date, type: 'IN', ref: i.batch, party: i.type === 'repack' ? 'Repack Batch' : 'Production Run', qtyIn: i.quantity, qtyOut: 0, rate: i.unitCost, total: i.value, notes: i.notes })),
      ...stockOut.map(o => ({ date: o.date, type: 'OUT', ref: o.invoice, party: o.customer, qtyIn: 0, qtyOut: o.quantity, rate: o.unitPrice, total: o.total, notes: o.tier })),
    ].sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.type === b.type ? 0 : a.type === 'IN' ? -1 : 1))
    let running = 0
    events.forEach(e => { running += e.qtyIn - e.qtyOut; e.balance = running })
    const totalIn = stockIn.reduce((t, i) => t + i.quantity, 0)
    const totalOut = stockOut.reduce((t, o) => t + o.quantity, 0)
    const unitCost = unitCostBySize(data.productionBatches).get(size) || 0
    const rate = re => {
      const rules = data.pricingRules.filter(r => r.size === size && re(String(r.pricing_category_name || r.pricing_category || '')))
      return rules.length ? num(rules[0].price) : 0
    }
    return {
      stockIn: stockIn.sort((a, b) => b.date.localeCompare(a.date)),
      stockOut: stockOut.sort((a, b) => b.date.localeCompare(a.date)),
      events: events.reverse(),
      totalIn,
      inValue: stockIn.reduce((t, i) => t + i.value, 0),
      totalOut,
      outValue: stockOut.reduce((t, o) => t + o.total, 0),
      available: totalIn - totalOut,
      unitCost,
      prod: rate(ctx.isProductionPrice),
      ws: rate(v => /wholesale/i.test(v)),
      ret: rate(v => /^retail/i.test(v.trim())),
      periodIn: stockIn.filter(i => inPeriod(i.date, period)).reduce((t, i) => t + i.quantity, 0),
      periodOut: stockOut.filter(o => inPeriod(o.date, period)).reduce((t, o) => t + o.quantity, 0),
    }
  }, [data, size, invNo, ctx.isProductionPrice, period])

  const TH = { padding: '9px 12px' }
  const TD = { padding: '8px 12px' }
  const tabBtn = (key, label) => (
    <button type="button" className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(key)} style={{ padding: '6px 14px', fontWeight: 700, borderRadius: '6px', ...(tab === key ? null : { background: '#fff' }) }}>{label}</button>
  )
  const theadStyle = { position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-container" style={{ maxWidth: '1040px', width: '96%', maxHeight: '92vh', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', padding: '18px 24px', borderBottom: '1px solid #334155' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>📦</span>
              <h3 className="modal-title" style={{ color: '#ffffff', fontSize: '18px', fontWeight: 800, margin: 0 }}>{size} — Finished Goods Stock Movements</h3>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>Itemized audit trail of batch production runs (Stock In) and customer dispatches (Stock Out)</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} style={{ color: '#cbd5e1', fontSize: '24px', cursor: 'pointer', border: 'none', background: 'transparent', lineHeight: 1 }}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '20px 24px', background: '#f8fafc', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#ffffff', border: '1.5px solid #bbf7d0', borderLeft: '5px solid #10b981', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🟢 Total Stock In (Produced)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#065f46', margin: '4px 0 2px' }}>+{view.totalIn.toLocaleString()} pcs</div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Cost Value: {currency(view.inValue)}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1.5px solid #fecaca', borderLeft: '5px solid #ef4444', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔴 Total Stock Out (Sold)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#991b1b', margin: '4px 0 2px' }}>-{view.totalOut.toLocaleString()} pcs</div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Sales Revenue: {currency(view.outValue)}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1.5px solid #bae6fd', borderLeft: '5px solid #0284c7', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Current On Hand</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0c4a6e', margin: '4px 0 2px' }}>{view.available.toLocaleString()} pcs</div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Asset Valuation: {currency(Math.max(0, view.available) * view.unitCost)}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderLeft: '5px solid #64748b', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏷️ Benchmark Rates</div>
              <div style={{ fontSize: '12px', color: '#334155', marginTop: '6px', lineHeight: 1.4 }}>
                <div>Prod: <strong>{currency(view.prod)}</strong></div>
                <div>Wholesale: <strong>{currency(view.ws)}</strong> | Retail: <strong>{currency(view.ret)}</strong></div>
              </div>
            </div>
          </div>

          {period.key !== 'all' ? (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 14px', marginBottom: '16px', fontSize: '12.5px', color: '#1e40af' }}>
              <strong>📅 Active Period Range ({period.label}):</strong> Produced: <span style={{ fontWeight: 700, color: '#047857' }}>+{view.periodIn.toLocaleString()} pcs</span> | Sold: <span style={{ fontWeight: 700, color: '#b91c1c' }}>-{view.periodOut.toLocaleString()} pcs</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tabBtn('all', `📜 Audit Ledger (${view.events.length})`)}
              {tabBtn('in', `🟢 Stock In: Production (${view.stockIn.length})`)}
              {tabBtn('out', `🔴 Stock Out: Sales (${view.stockOut.length})`)}
            </div>
            <div style={{ position: 'relative', width: '280px' }}>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search batch, invoice, customer, date..." style={{ width: '100%', padding: '6px 12px 6px 30px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', outline: 'none', background: '#fff' }} />
              <span style={{ position: 'absolute', left: '9px', top: '7px', fontSize: '12px', color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
            </div>
          </div>

          <div className="table-responsive" style={{ maxHeight: '440px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
            {tab === 'all' ? (
              <table style={{ width: '100%', margin: 0, fontSize: '12.5px' }}>
                <thead style={theadStyle}>
                  <tr>
                    <th style={TH}>Date</th><th style={TH}>Flow</th><th style={TH}>Reference</th><th style={TH}>Party / Particulars</th>
                    <th style={{ ...TH, textAlign: 'right' }}>In (+Qty)</th><th style={{ ...TH, textAlign: 'right' }}>Out (-Qty)</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Rate (GHS)</th><th style={{ ...TH, textAlign: 'right' }}>Total (GHS)</th>
                    <th style={{ ...TH, textAlign: 'right', background: '#f1f5f9' }}>Live Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {view.events.filter(ev => matches(search, ev.date, ev.ref, ev.party, ev.notes)).map((ev, i) => (
                    <tr key={`${ev.type}-${ev.ref}-${i}`}>
                      <td style={{ ...TD, fontWeight: 600, color: '#1e293b' }}>{ev.date}</td>
                      <td style={TD}>
                        {ev.type === 'IN'
                          ? <span className="badge badge-success" style={{ fontSize: '10.5px', background: '#d1fae5', color: '#047857', fontWeight: 700 }}>🟢 IN (PROD)</span>
                          : <span className="badge badge-danger" style={{ fontSize: '10.5px', background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>🔴 OUT (SALE)</span>}
                      </td>
                      <td style={TD}><span style={{ fontWeight: 700, color: '#0284c7' }}>{ev.ref}</span></td>
                      <td style={{ ...TD, color: '#334155', fontWeight: 600 }}>
                        {ev.party}
                        {ev.notes ? <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>{ev.notes}</div> : null}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{ev.qtyIn > 0 ? `+${ev.qtyIn.toLocaleString()}` : '-'}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{ev.qtyOut > 0 ? `-${ev.qtyOut.toLocaleString()}` : '-'}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#475569' }}>{currency(ev.rate)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{currency(ev.total)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 800, background: '#f8fafc', color: ev.balance < 0 ? '#ef4444' : '#0284c7' }}>{ev.balance.toLocaleString()} pcs</td>
                    </tr>
                  ))}
                  {!view.events.length ? <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No movements found for this product.</td></tr> : null}
                </tbody>
              </table>
            ) : tab === 'in' ? (
              <table style={{ width: '100%', margin: 0, fontSize: '12.5px' }}>
                <thead style={theadStyle}>
                  <tr>
                    <th style={TH}>Production Date</th><th style={TH}>Batch Number</th><th style={TH}>Batch Type</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Quantity Produced</th><th style={{ ...TH, textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Batch Value</th><th style={TH}>Notes / Description</th>
                  </tr>
                </thead>
                <tbody>
                  {view.stockIn.filter(i => matches(search, i.date, i.batch, i.notes)).map((i, n) => (
                    <tr key={`${i.batch}-${n}`}>
                      <td style={{ ...TD, fontWeight: 600, color: '#1e293b' }}>{i.date}</td>
                      <td style={TD}><span style={{ fontWeight: 700, color: '#0284c7' }}>{i.batch}</span></td>
                      <td style={TD}><span className="badge badge-secondary" style={{ fontSize: '11px' }}>{i.type}</span></td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#059669' }}>+{i.quantity.toLocaleString()}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#475569' }}>{currency(i.unitCost)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{currency(i.value)}</td>
                      <td style={{ ...TD, color: '#64748b', fontSize: '11.5px' }}>{i.notes || '-'}</td>
                    </tr>
                  ))}
                  {!view.stockIn.length ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No production batch output recorded for this size.</td></tr> : null}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', margin: 0, fontSize: '12.5px' }}>
                <thead style={theadStyle}>
                  <tr>
                    <th style={TH}>Invoice Date</th><th style={TH}>Invoice #</th><th style={TH}>Customer</th><th style={TH}>Pricing Tier</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Quantity Sold</th><th style={{ ...TH, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Total Amount</th><th style={TH}>Sale Type / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {view.stockOut.filter(o => matches(search, o.date, o.invoice, o.customer, o.notes)).map((o, n) => (
                    <tr key={`${o.invoice}-${n}`}>
                      <td style={{ ...TD, fontWeight: 600, color: '#1e293b' }}>{o.date}</td>
                      <td style={TD}><span style={{ fontWeight: 700, color: '#0284c7' }}>{o.invoice}</span></td>
                      <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{o.customer}</td>
                      <td style={TD}><span className="badge badge-info" style={{ fontSize: '11px' }}>{o.tier}</span></td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>-{o.quantity.toLocaleString()}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#475569' }}>{currency(o.unitPrice)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{currency(o.total)}</td>
                      <td style={{ ...TD, color: '#64748b', fontSize: '11.5px' }}>{o.saleType} {o.notes ? `(${o.notes})` : ''}</td>
                    </tr>
                  ))}
                  {!view.stockOut.length ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No sales or dispatch records found for this size.</td></tr> : null}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassicInventory({ ctx, period }) {
  const { data, inventoryLedger, rawMaterials } = ctx
  const isFiltered = period.key !== 'all'
  const [movementSize, setMovementSize] = useState('')
  const [broad, setBroad] = useState('all')
  const [specific, setSpecific] = useState('')
  const [search, setSearch] = useState('')

  const fg = useMemo(() => {
    const cost = unitCostBySize(data.productionBatches)
    const produced = size => data.productionBatches.filter(b => inPeriod(b.production_date, period)).flatMap(b => b.outputs || []).filter(o => o.product_size === size).reduce((t, o) => t + num(o.quantity), 0)
    const sold = size => data.invoices.filter(inv => inPeriod(inv.invoice_date, period)).flatMap(inv => inv.lines || []).filter(l => l.product_size === size).reduce((t, l) => t + num(l.quantity), 0)
    return inventoryLedger.map(item => {
      const unitCost = cost.get(item.size) || 0
      const available = num(item.available)
      return {
        size: item.size,
        produced: isFiltered ? produced(item.size) : num(item.stockIn),
        sold: isFiltered ? sold(item.size) : num(item.stockOut),
        available,
        unitCost,
        value: Math.max(0, available) * unitCost,
        min: num(item.productionLevel),
        produceNow: available <= num(item.productionLevel),
      }
    })
  }, [data.productionBatches, data.invoices, inventoryLedger, period, isFiltered])

  const rms = useMemo(() => rawMaterials
    .map(rm => {
      const available = num(rm.available)
      const unitCost = num(rm.unit_price)
      const perPack = num(rm.unit_per_item)
      return { rm, id: rmId(rm.id), broad: broadCategory(rm), available, unitCost, value: Math.max(0, available) * unitCost, packs: perPack > 0 ? available / perPack : available, reorder: available <= num(rm.reorder_level) }
    })
    .sort((a, b) => String(a.rm.category || '').localeCompare(String(b.rm.category || '')) || String(a.rm.name).localeCompare(String(b.rm.name))), [rawMaterials])

  const counts = { all: rms.length, Ingredients: 0, Bottles: 0, Labels: 0, Flavours: 0 }
  rms.forEach(r => { counts[r.broad] += 1 })
  const specificCats = [...new Set(rms.map(r => r.rm.category).filter(Boolean))].sort()
  const shownRms = rms.filter(r => (broad === 'all' || r.broad === broad) && (!specific || r.rm.category === specific) && matches(search, r.rm.name, r.id))

  const catButton = (key, label) => (
    <button type="button" className={`btn btn-sm ${broad === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setBroad(key); setSpecific('') }} style={{ ...CAT_BTN, fontWeight: broad === key ? 700 : 600, ...(broad === key ? null : { background: '#fff' }) }}>{label}</button>
  )

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📦 Finished Goods Inventory</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Total Stock: <strong>{qty(fg.reduce((t, r) => t + Math.max(0, r.available), 0))} Units</strong> ({currency(fg.reduce((t, r) => t + r.value, 0))})
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Size</th>
                <th className="text-right">{isFiltered ? `Produced (${period.label})` : 'Total Produced (Lifetime)'}</th>
                <th className="text-right">{isFiltered ? `Sold (${period.label})` : 'Total Sold (Lifetime)'}</th>
                <th className="text-right">Live Stock</th>
                <th className="text-right">Unit Prod. Price</th>
                <th className="text-right">Total Value</th>
                <th className="text-right">Min Level</th>
                <th className="text-center">Status</th>
                <th className="text-center">Stock Movements</th>
              </tr>
            </thead>
            <tbody>
              {fg.map(r => (
                <tr key={r.size}>
                  <td>
                    <a href="#movements" onClick={act(() => setMovementSize(r.size))} style={{ fontWeight: 800, fontSize: '14.5px', color: '#0284c7', textDecoration: 'none', borderBottom: '1.5px dotted #0284c7' }} title="Click to view Stock In & Stock Out records">{r.size}</a>
                  </td>
                  <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>+{qty(r.produced)}</td>
                  <td className="text-right" style={{ color: '#dc2626', fontWeight: 600 }}>-{qty(r.sold)}</td>
                  <td className="text-right"><strong style={{ fontSize: '15px' }}>{qty(r.available)} pcs</strong></td>
                  <td className="text-right">{currency(r.unitCost)}</td>
                  <td className="text-right">{currency(r.value)}</td>
                  <td className="text-right">{qty(r.min)} pcs</td>
                  <td className="text-center">{r.produceNow ? <span className="badge badge-danger">PRODUCE NOW</span> : <span className="badge badge-success">STOCK OK</span>}</td>
                  <td className="text-center">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMovementSize(r.size)} style={{ padding: '4px 11px', fontSize: '12px', fontWeight: 700, color: '#0284c7', border: '1.5px solid #cbd5e1', background: '#ffffff', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span>📋</span><span>Stock Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '14px', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>🧪 Raw Materials Stock (All {rms.length} Items)</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Ingredients, packaging bottles, printed labels, flavours &amp; stabilizing agents in stock</div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Total Raw Material Asset Value: <strong style={{ color: 'var(--secondary)', fontSize: '15px' }}>{currency(rms.reduce((t, r) => t + r.value, 0))}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '2px' }}>Filter Category:</span>
              {catButton('all', `All (${counts.all})`)}
              {catButton('Ingredients', `🍶 Ingredients (${counts.Ingredients})`)}
              {catButton('Bottles', `🍾 Bottles (${counts.Bottles})`)}
              {catButton('Labels', `🏷️ Labels (${counts.Labels})`)}
              {catButton('Flavours', `🍓 Flavours & Colors (${counts.Flavours})`)}
              <select value={specific} onChange={e => { setSpecific(e.target.value); setBroad('all') }} style={{ marginLeft: '6px', padding: '4px 8px', fontSize: '11.5px', fontWeight: 600, border: '1.5px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text-main)' }}>
                <option value="">-- More Specific Categories --</option>
                {specificCats.map(c => <option key={c} value={c}>{c} ({rms.filter(r => r.rm.category === c).length} items)</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Showing <strong>{shownRms.length}</strong> items</span>
              <input type="text" className="form-control" placeholder="🔍 Search material..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '200px', fontSize: '12px', height: '32px', padding: '4px 10px' }} />
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th className="text-center">ID</th>
                <th>Material Name</th>
                <th className="text-center">Category</th>
                <th className="text-center">Unit</th>
                <th className="text-right">Live Available</th>
                <th className="text-right">Live Packs</th>
                <th className="text-right">Unit Cost</th>
                <th className="text-right">Live Value</th>
                <th className="text-right">Reorder Level</th>
                <th className="text-center">Status</th>
                {ctx.canEdit ? <th className="text-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shownRms.map(r => (
                <tr key={r.rm.id}>
                  <td className="text-center"><span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{r.id}</span></td>
                  <td><strong>{r.rm.name}</strong></td>
                  <td className="text-center"><span className={`badge ${BROAD_BADGE[r.broad]}`} style={{ fontSize: '11px' }}>{r.rm.category || r.broad}</span></td>
                  <td className="text-center">{r.rm.unit}</td>
                  <td className="text-right"><strong>{number(r.available)} {r.rm.unit}</strong></td>
                  <td className="text-right">{r.packs.toFixed(2)}</td>
                  <td className="text-right">{currency(r.unitCost)}</td>
                  <td className="text-right">{currency(r.value)}</td>
                  <td className="text-right">{qty(r.rm.reorder_level)} {r.rm.unit}</td>
                  <td className="text-center">{r.reorder ? <span className="badge badge-danger">REORDER</span> : <span className="badge badge-success">STOCK OK</span>}</td>
                  {ctx.canEdit ? (
                    <td className="text-center"><button type="button" className="btn btn-sm btn-secondary" onClick={() => ctx.openModal('raw_mat', r.rm)} style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 600 }}>✏️ Edit</button></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {movementSize ? <MovementsModal size={movementSize} ctx={ctx} period={period} onClose={() => setMovementSize('')} /> : null}
    </>
  )
}

export default ClassicInventory
