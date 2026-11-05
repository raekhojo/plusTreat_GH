import { useState } from 'react'
import { RECIPE, STANDARD_VOLUME, matchRecipeMaterial } from '../lib/recipe'
import { currency, litresOf, matches, num } from './format'
import './classic.css'
import './classic-extra.css'

// The ERP's modals (templates/*.html "modal-overlay" forms), bound to this app's
// form state and save handlers. `k` is the form kit HomePage passes in.

const MUTED = { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }
const H4 = { fontSize: '14px', fontWeight: 700, color: 'var(--secondary)', margin: '16px 0 8px 0' }
const REQ = <span style={{ color: '#dc2626' }}>*</span>
const PAYMENT_OPTIONS = [
  ['cash', 'Cash on Hand'],
  ['momo', 'MoMo Wallet'],
  ['bank_transfer', 'Cal Bank Transfer'],
  ['ghanapay', 'GhanaPay'],
  ['other', 'Other'],
]

function Frame({ title, subtitle, maxWidth = 680, onClose, onSubmit, children, footer, message }) {
  return (
    <div className="classic-ui classic-portal">
      <div className="modal-overlay open" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <form className="modal-container" style={{ maxWidth }} onSubmit={onSubmit} noValidate={false}>
          <div className="modal-header">
            <div>
              <h3 className="modal-title">{title}</h3>
              {subtitle ? <div style={MUTED}>{subtitle}</div> : null}
            </div>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {children}
            {message ? <div className={`alert ${/saved|updated|success/i.test(message) ? 'alert-success' : 'alert-danger'}`} style={{ marginTop: '14px', marginBottom: 0 }}><span>{message}</span></div> : null}
          </div>
          <div className="modal-footer">{footer}</div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, hint, style }) {
  return (
    <div className="form-group" style={style}>
      {label ? <label className="form-label">{label}</label> : null}
      {children}
      {hint ? <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{hint}</small> : null}
    </div>
  )
}

function Select({ value, onChange, options, placeholder, required, disabled, style }) {
  return (
    <select className="form-control" value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} disabled={disabled} style={style}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
    </select>
  )
}

function Footer({ k, type, primary, onDelete, canSave = true }) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={k.close}>Cancel</button>
      {onDelete ? <button type="button" className="btn btn-secondary" style={{ color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }} onClick={onDelete}>🗑️ Delete</button> : null}
      {canSave ? <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }} disabled={k.submitting[type]}>{k.submitting[type] ? 'Saving...' : primary}</button> : null}
    </>
  )
}

// ── Sales (templates/sales.html #newSaleModal) ────────────────────────────────
function SaleModal({ k }) {
  const f = k.saleForm
  const set = k.setSaleForm
  const editing = Boolean(f._editId)
  const tierId = String(f.pricingCategoryId || '')
  const rules = tierId ? k.pricingRules.filter(r => String(r.pricing_category) === tierId) : k.pricingRules
  const sizes = [...new Set(rules.map(r => r.size).filter(Boolean))]
  const priceOf = line => num(line.unitPrice || rules.find(r => r.size === line.productSize)?.price || 0)
  const subtotal = f.lines.reduce((t, l) => t + num(l.quantity) * priceOf(l), 0)
  const discount = Math.min(subtotal, Math.max(0, num(f.discountAmount)))
  const net = subtotal - discount
  const paid = f.payments.reduce((t, p) => t + num(p.amount), 0)
  const customer = k.customers.find(c => String(c.id) === String(f.customer))
  const owing = customer ? k.customerOwing(customer.id) : 0
  const first = f.payments[0] || {}
  const payMode = num(first.amount) > 0 || first.reference ? first.method || 'cash' : 'none'

  const setTier = value => set(c => ({
    ...c,
    pricingCategoryId: value,
    lines: c.lines.map(l => {
      const r = (value ? k.pricingRules.filter(x => String(x.pricing_category) === value) : k.pricingRules).find(x => x.size === l.productSize)
      return { ...l, pricingRule: r ? String(r.id) : '', unitPrice: r ? String(r.price) : '' }
    }),
  }))
  const setFirstPayment = patch => set(c => ({ ...c, payments: [{ ...(c.payments[0] || k.mkSalePayment()), ...patch }, ...c.payments.slice(1)] }))

  return (
    <Frame
      maxWidth={780}
      title={editing ? `✏️ Edit Sale ${k.invNo(f._editId)}` : '🛍️ Record Customer Sale / Issue Invoice'}
      onClose={k.close}
      onSubmit={k.handleSaleSubmit}
      message={k.feedback.sale}
      footer={<Footer k={k} type="sale" primary={editing ? '💾 Update Sale' : 'Generate Invoice & Save'} canSave={!editing || k.canManageSales} onDelete={editing && k.canManageSales ? () => k.handleDelete('sale', () => k.deleteInvoice(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label="Invoice Date"><input type="date" className="form-control" value={f.invoiceDate} onChange={e => set(c => ({ ...c, invoiceDate: e.target.value }))} required /></Field>
        <Field label="Customer Name">
          <select className="form-control" value={f.customer} onChange={e => k.changeSaleCustomer(e.target.value)} required>
            <option value="">-- Select Customer --</option>
            {k.customers.map(c => <option key={c.id} value={String(c.id)}>{c.name}{c.pricing_category ? ` (${c.pricing_category})` : ''}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Pricing Tier">
          <Select value={tierId} onChange={setTier} options={k.pricingCategories.map(pc => ({ value: pc.id, label: pc.name }))} placeholder="All price lists" />
        </Field>
        <Field label="Salesperson"><input type="text" className="form-control" value={k.salespersonName} readOnly /></Field>
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div className={`badge ${owing > 0 ? 'badge-danger' : 'badge-secondary'}`} style={{ padding: '8px', fontSize: '12px', justifyContent: 'center' }}>Owing: {currency(owing)}</div>
        </div>
      </div>

      <div style={{ margin: '20px 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Order Line Items</label>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => set(c => ({ ...c, lines: [...c.lines, k.mkSaleLine()] }))}>+ Add Product Line</button>
        </div>
        <table style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Product Size</th>
              <th className="text-center" style={{ width: '20%' }}>Quantity</th>
              <th className="text-right" style={{ width: '25%' }}>Unit Price (GHS)</th>
              <th className="text-right" style={{ width: '20%' }}>Line Total</th>
              <th className="text-center" style={{ width: '5%' }} />
            </tr>
          </thead>
          <tbody>
            {f.lines.map((line, idx) => {
              const stock = k.stockOf(line.productSize)
              return (
                <tr key={idx}>
                  <td>
                    <select className="form-control" value={line.productSize} onChange={e => k.updateSaleLineSize(idx, e.target.value, rules)} required>
                      <option value="">-- Size --</option>
                      {[...new Set([...sizes, line.productSize].filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {line.productSize && stock !== null ? <div style={{ fontSize: '10.5px', marginTop: '3px', color: stock - num(line.quantity) < 0 ? '#dc2626' : 'var(--text-muted)' }}>{stock} in stock · {stock - num(line.quantity)} after sale</div> : null}
                  </td>
                  <td><input type="number" min="1" step="1" className="form-control sale-qty" value={line.quantity} onChange={e => k.updateSaleLine(idx, 'quantity', e.target.value)} required /></td>
                  <td><input type="number" step="0.01" className="form-control sale-price" value={line.unitPrice || (priceOf(line) ? String(priceOf(line)) : '')} readOnly placeholder="0.00" /></td>
                  <td style={{ fontWeight: 700, textAlign: 'right' }}>{currency(num(line.quantity) * priceOf(line))}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="btn btn-sm btn-secondary" disabled={f.lines.length === 1} onClick={() => set(c => ({ ...c, lines: c.lines.filter((_, i) => i !== idx) }))}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="form-row" style={{ marginTop: '14px' }}>
        <Field label="Discount (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.discountAmount} onChange={e => set(c => ({ ...c, discountAmount: e.target.value }))} /></Field>
        <Field label="Immediate Payment">
          <select className="form-control" value={payMode} onChange={e => (e.target.value === 'none' ? setFirstPayment({ amount: '', reference: '' }) : setFirstPayment({ method: e.target.value }))}>
            <option value="none">None (Full Credit)</option>
            {PAYMENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Amount Paid Now (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={first.amount || ''} placeholder="0.00" onChange={e => setFirstPayment({ amount: e.target.value })} /></Field>
      </div>
      {f.payments.slice(1).map((p, i) => (
        <div key={i + 1} className="form-row">
          <Field label={`Additional Payment ${i + 2}`}>
            <select className="form-control" value={p.method} onChange={e => k.updateSalePayment(i + 1, 'method', e.target.value)}>
              {PAYMENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Amount (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={p.amount} onChange={e => k.updateSalePayment(i + 1, 'amount', e.target.value)} /></Field>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => set(c => ({ ...c, payments: c.payments.filter((_, j) => j !== i + 1) }))}>✕ Remove</button>
          </div>
        </div>
      ))}

      <Field label="Comments / Notes"><input type="text" className="form-control" value={f.notes} onChange={e => set(c => ({ ...c, notes: e.target.value }))} placeholder="Optional delivery location or remarks" /></Field>

      <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subtotal</div><div style={{ fontSize: '16px', fontWeight: 700 }}>{currency(subtotal)}</div></div>
        <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Billed</div><div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{currency(net)}</div></div>
        <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Due</div><div style={{ fontSize: '16px', fontWeight: 700, color: net - paid > 0 ? '#dc2626' : '#059669' }}>{currency(Math.max(0, net - paid))}</div></div>
      </div>
    </Frame>
  )
}

// ── Sales receipt (templates/sales.html #newReceiptModal) ─────────────────────
function ReceiptModal({ k }) {
  const f = k.receiptForm
  const set = k.setReceiptForm
  const editing = Boolean(f._editId)
  const invoiceOf = id => k.invoices.find(inv => String(inv.id) === String(id))
  const [customerId, setCustomerId] = useState(() => String(invoiceOf(f.invoice)?.customer || ''))
  const invoiceOptions = k.invoiceSelectOptions.filter(o => !customerId || String(invoiceOf(o.value)?.customer) === customerId)
  const selected = invoiceOf(f.invoice)
  const due = selected ? k.receiptDue(selected) : 0
  const payment = f.payments[0] || {}
  const debtorIds = new Set(k.invoiceSelectOptions.map(o => String(invoiceOf(o.value)?.customer)))
  const customerOptions = k.customers.filter(c => debtorIds.has(String(c.id)) || String(c.id) === customerId)

  return (
    <Frame
      maxWidth={640}
      title={editing ? `✏️ Edit Sales Receipt #${f._editId}` : '🧾 Add Customer Sales Receipt'}
      subtitle="Record customer payment, auto-settle invoice balances & post to Treasury"
      onClose={k.close}
      onSubmit={k.handleReceiptSubmit}
      message={k.feedback.receipt}
      footer={<Footer k={k} type="receipt" primary="💾 Post Sales Receipt" canSave={!editing || k.canManageSales} onDelete={editing && k.canManageSales ? () => k.handleDelete('receipt', () => k.deletePayment(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label="Receipt Date"><input type="date" className="form-control" value={f.paymentDate} onChange={e => set(c => ({ ...c, paymentDate: e.target.value }))} required /></Field>
        <Field label="Receipt / Reference ID"><input type="text" className="form-control" value={payment.reference || ''} onChange={e => k.updateReceiptPayment(0, 'reference', e.target.value)} placeholder="e.g. REC-1021001 or MoMo TxID" /></Field>
      </div>
      <div className="form-row">
        <Field label="Customer Name">
          <select className="form-control" value={customerId} onChange={e => { setCustomerId(e.target.value); if (selected && String(selected.customer) !== e.target.value) set(c => ({ ...c, invoice: '' })) }}>
            <option value="">-- Select Customer --</option>
            {customerOptions.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Target Invoice">
          <select className="form-control" value={f.invoice} onChange={e => { set(c => ({ ...c, invoice: e.target.value })); const inv = invoiceOf(e.target.value); if (inv) setCustomerId(String(inv.customer)) }} required>
            <option value="">-- Select Invoice --</option>
            {invoiceOptions.map(o => <option key={o.value} value={String(o.value)}>{o.label}{o.meta ? ` (Due: ${o.meta})` : ''}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Amount Received (GHS)"><input type="number" step="0.01" min="0.01" className="form-control" value={payment.amount || ''} onChange={e => k.updateReceiptPayment(0, 'amount', e.target.value)} placeholder="0.00" required /></Field>
        <Field label="Payment Channel / Wallet">
          <select className="form-control" value={payment.method || 'cash'} onChange={e => k.updateReceiptPayment(0, 'method', e.target.value)} required>
            {PAYMENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Payment Notes / Description"><input type="text" className="form-control" value={payment.notes || ''} onChange={e => k.updateReceiptPayment(0, 'notes', e.target.value)} placeholder="e.g. Customer payment via MoMo or cash handover" /></Field>
      {selected ? (
        <div style={{ background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '13px' }}>
          Remaining Invoice Balance: <strong style={{ color: '#dc2626' }}>{currency(Math.max(0, due - num(payment.amount)))}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>(currently due {currency(due)})</span>
        </div>
      ) : null}
    </Frame>
  )
}

// ── Production batch (templates/production.html #newBatchModal) ───────────────
function broad(m) {
  const t = `${m?.category || ''} ${m?.name || ''}`
  if (/bottle/i.test(t)) return 'Bottles'
  if (/label/i.test(t)) return 'Labels'
  if (/flavou?r|colou?r/i.test(t)) return 'Flavours'
  return 'Ingredients'
}

function BatchModal({ k }) {
  const f = k.batchForm
  const set = k.setBatchForm
  const editing = Boolean(f._editId)
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const outputs = f.outputs || {}
  const materialOf = u => (u.rawMaterial ? k.rawMaterials.find(m => String(m.id) === String(u.rawMaterial)) : k.rawMaterials.find(m => String(m.name || '').trim().toLowerCase() === String(u.materialName || '').trim().toLowerCase()))
  const rows = f.usages.map((u, idx) => ({ u, idx, m: materialOf(u) }))
  const outputLitres = k.sizes.reduce((t, s) => t + litresOf(s, outputs[s]), 0)
  const outputValue = k.sizes.reduce((t, s) => t + num(outputs[s]) * k.productionPrice(s), 0)
  const rmCost = rows.reduce((t, r) => t + num(r.u.quantityUsed) * num(r.m?.unit_price), 0)
  const overheads = num(f.electricityCost) + num(f.gasCost) + num(f.productionWages)
  const counts = { all: rows.length, Ingredients: 0, Bottles: 0, Labels: 0, Flavours: 0 }
  rows.forEach(r => { counts[broad(r.m || { name: r.u.materialName })] += 1 })
  const shown = rows.filter(r => (cat === 'all' || broad(r.m || { name: r.u.materialName }) === cat) && matches(search, r.m?.name, r.u.materialName, r.m?.category))

  const autoFill = () => {
    const factor = outputLitres > 0 ? outputLitres / STANDARD_VOLUME : 1
    const want = new Map()
    RECIPE.forEach(item => {
      const m = matchRecipeMaterial(item, k.rawMaterials)
      if (m) want.set(String(m.id), Math.round(item.baseQty * factor * 1000) / 1000)
    })
    k.sizes.forEach(s => {
      const q = num(outputs[s])
      if (q <= 0) return
      const bottle = k.rawMaterials.find(m => /bottle/i.test(m.name) && Math.abs(litresOf(m.name, 1) - litresOf(s, 1)) < 0.001)
      if (bottle) want.set(String(bottle.id), q)
    })
    set(c => ({
      ...c,
      electricityCost: c.electricityCost || String(Math.round(30 * factor * 100) / 100),
      gasCost: c.gasCost || String(Math.round(30 * factor * 100) / 100),
      productionWages: c.productionWages || String(Math.round(350 * factor * 100) / 100),
      usages: c.usages.map(u => {
        const m = materialOf(u)
        return m && want.has(String(m.id)) ? { ...u, quantityUsed: String(want.get(String(m.id))) } : u
      }),
    }))
  }
  const BTN = { fontSize: '11px', padding: '3px 8px' }

  return (
    <Frame
      maxWidth={920}
      title={editing ? `✏️ Edit Production Batch ${k.batchNumberOf(f._editId)}` : '🏭 Record New Production Batch Run'}
      onClose={k.close}
      onSubmit={k.handleBatchSubmit}
      message={k.feedback.batch}
      footer={<Footer k={k} type="batch" primary={editing ? '💾 Update Batch' : '💾 Save Batch & Deplete Stock'} canSave={!editing || k.canManageProduction} onDelete={editing && k.canManageProduction ? () => k.handleDelete('batch', () => k.deleteProductionBatch(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label="Production Date"><input type="date" className="form-control" value={f.productionDate} onChange={e => set(c => ({ ...c, productionDate: e.target.value }))} required /></Field>
        <Field label="Batch Type"><Select value={f.batchType} onChange={v => set(c => ({ ...c, batchType: v || 'production' }))} options={k.productionBatchTypeOptions} /></Field>
        <Field label="Batch Notes / Variant"><input type="text" className="form-control" value={f.notes} onChange={e => set(c => ({ ...c, notes: e.target.value }))} placeholder="e.g. Vanilla & Strawberry Run #42" /></Field>
      </div>

      {!editing ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '16px 0 8px 0' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--secondary)', margin: 0 }}>1. Finished Goods Output Quantities</h4>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Batch Volume: <strong style={{ color: 'var(--secondary)' }}>{outputLitres.toFixed(1)} L</strong> | Value: <strong style={{ color: '#059669' }}>{currency(outputValue)}</strong>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {k.sizes.map(s => (
              <div key={s} style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>{s} Bottles</label>
                <input type="number" min="0" className="form-control" value={outputs[s] ?? ''} placeholder="0" onChange={e => set(c => ({ ...c, outputs: { ...(c.outputs || {}), [s]: e.target.value } }))} />
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{litresOf(s, 1)}L/ea</span><span>{currency(k.productionPrice(s))}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="alert alert-info" style={{ marginTop: '12px' }}><span>Finished goods for this batch are recorded with “Finished Goods Produced” in Production Ops.</span></div>
      )}

      <h4 style={H4}>{editing ? '1' : '2'}. Direct Production Overheads</h4>
      <div className="form-row" style={{ marginBottom: '20px' }}>
        <Field label="Electricity (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.electricityCost} placeholder="0.00" onChange={e => set(c => ({ ...c, electricityCost: e.target.value }))} /></Field>
        <Field label="Gas Fuel (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.gasCost} placeholder="0.00" onChange={e => set(c => ({ ...c, gasCost: e.target.value }))} /></Field>
        <Field label="Production Wages (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.productionWages} placeholder="0.00" onChange={e => set(c => ({ ...c, productionWages: e.target.value }))} /></Field>
      </div>

      <div style={{ background: '#fafbfe', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🧪 {editing ? '2' : '3'}. Raw Materials Utilised (Ingredients &amp; Packaging)</span>
            </h4>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Input the quantities utilised for this batch. Pre-batch available stock is shown for each material.</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={autoFill} style={{ fontSize: '11.5px', padding: '4px 10px', background: '#fff' }}>📋 Auto-Fill Benchmark</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => set(c => ({ ...c, usages: c.usages.map(u => ({ ...u, quantityUsed: '' })) }))} style={{ fontSize: '11.5px', padding: '4px 10px', background: '#fff' }}>🔄 Reset to 0</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={k.addBatchUsageLine} style={{ fontSize: '11.5px', padding: '4px 10px', background: '#fff' }}>+ Extra Material</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['all', `All (${counts.all})`], ['Ingredients', `🍶 Ingredients (${counts.Ingredients})`], ['Bottles', `🍾 Bottles (${counts.Bottles})`], ['Labels', `🏷️ Labels (${counts.Labels})`], ['Flavours', `🍓 Flavours & Colors (${counts.Flavours})`]].map(([key, label]) => (
              <button key={key} type="button" className={`btn btn-sm ${cat === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCat(key)} style={{ ...BTN, ...(cat === key ? null : { background: '#fff' }) }}>{label}</button>
            ))}
          </div>
          <div style={{ minWidth: '180px' }}>
            <input type="text" className="form-control" placeholder="🔍 Search material..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '11.5px', padding: '3px 8px', height: '28px' }} />
          </div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflowY: 'auto', maxHeight: '290px', background: '#fff', marginBottom: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 2 }}>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600, width: '34%' }}>Material Name</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, width: '22%' }}>Prior Available Stock</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, width: '22%' }}>Quantity Utilised</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, width: '11%', textAlign: 'right' }}>Unit Cost</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, width: '11%', textAlign: 'right' }}>Line Cost</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ u, idx, m }) => {
                const avail = m ? num(m.available) : 0
                const line = num(u.quantityUsed) * num(m?.unit_price)
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 12px' }}>
                      {u.isTemplate || u.rawMaterial ? (
                        <>
                          <div style={{ fontWeight: 600, color: 'var(--secondary)' }}>{m?.name || u.materialName}</div>
                          <div style={{ fontSize: '10.5px', color: m ? 'var(--text-muted)' : '#d97706' }}>{m ? `RM-${String(m.id).padStart(4, '0')} · ${m.category || '-'}` : 'Material not found in stock'}</div>
                        </>
                      ) : (
                        <Select value={u.rawMaterial} onChange={v => k.updateBatchUsage(idx, 'rawMaterial', v)} options={k.rawMaterialSelectOptions} placeholder="-- Select material --" style={{ fontSize: '12px', padding: '4px 8px' }} />
                      )}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      {m ? (avail > 0
                        ? <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 600 }}>{Math.round(avail * 1000) / 1000} {m.unit}</span>
                        : <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 600 }}>0.00 {m.unit} (Stockout)</span>) : '-'}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="number" step="any" min="0" className="form-control" value={u.quantityUsed} placeholder="0" onChange={e => k.updateBatchUsage(idx, 'quantityUsed', e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', height: '30px', textAlign: 'right', width: '90px', ...(m && num(u.quantityUsed) > avail ? { borderColor: '#dc2626' } : null) }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '35px' }}>{m?.unit}</span>
                        {!u.isTemplate ? <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '2px 6px' }} onClick={() => set(c => ({ ...c, usages: c.usages.filter((_, i) => i !== idx) }))} title="Remove">✕</button> : null}
                      </div>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '11.5px' }}>GHS {num(m?.unit_price).toFixed(2)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}><span style={{ color: line > 0 ? 'var(--secondary)' : 'var(--text-muted)' }}>{currency(line)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#fff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          {[['Total RM Cost', currency(rmCost), 'var(--secondary)', 700], ['Total Overheads', currency(overheads), 'var(--text-main)', 700], ['Total Batch Cost', currency(rmCost + overheads), '#dc2626', 800], ['Projected Surplus', currency(outputValue - rmCost - overheads), outputValue - rmCost - overheads >= 0 ? '#059669' : '#dc2626', 800]].map(([l, v, color, w]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: '15px', fontWeight: w, color }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

// ── Raw material purchase (templates/inventory.html #newPurchaseModal) ────────
function PurchaseModal({ k }) {
  const f = k.purchaseForm
  const set = k.setPurchaseForm
  const editing = Boolean(f._editId)
  const total = f.items.reduce((t, it) => t + num(it.quantity) * num(it.pricePerItem), 0)
  return (
    <Frame
      maxWidth={760}
      title={editing ? `✏️ Edit Purchase PUR-${String(f._editId).padStart(4, '0')}` : '🧪 Record Raw Material Purchase / Intake'}
      onClose={k.close}
      onSubmit={k.handlePurchaseSubmit}
      message={k.feedback.purchase}
      footer={<Footer k={k} type="purchase" primary={editing ? '💾 Update Purchase' : 'Receive & Update Stock'} onDelete={editing ? () => k.handleDelete('purchase', () => k.deletePurchase(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label="Delivery Date"><input type="date" className="form-control" value={f.purchaseDate} onChange={e => set(c => ({ ...c, purchaseDate: e.target.value }))} required /></Field>
        <Field label={<span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Supplier Name</span></span>}>
          <Select value={f.supplier} onChange={k.handlePurchaseSupplierChange} options={k.supplierSelectOptions} placeholder="-- Select Supplier --" required />
        </Field>
      </div>
      <Field label="Item Category" hint="Set from the supplier's category"><input type="text" className="form-control" value={f.category || ''} readOnly placeholder="Select supplier first" /></Field>

      <div style={{ margin: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Raw Material Items</label>
          <button type="button" className="btn btn-sm btn-secondary" onClick={k.addPurchaseItemLine}>+ Add Item</button>
        </div>
        <table style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Raw Material Item</th>
              <th className="text-center">Packs Bought</th>
              <th className="text-center">Units / Pack</th>
              <th className="text-right">Price / Pack (GHS)</th>
              <th className="text-right">Line Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {f.items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  {it.isNewRM
                    ? <input type="text" className="form-control" value={it.newRMName} onChange={e => k.updatePurchaseItem(idx, 'newRMName', e.target.value)} placeholder="New material name" />
                    : <Select value={it.rawMaterial} onChange={v => k.selectPurchaseRawMaterial(idx, v)} options={k.purchaseRawMaterialSelectOptions} placeholder="-- Select Material --" />}
                </td>
                <td><input type="number" step="0.001" min="0" className="form-control" value={it.quantity} placeholder="0" onChange={e => k.updatePurchaseItem(idx, 'quantity', e.target.value)} /></td>
                <td><input type="number" className="form-control" value={it.unitPerItem} readOnly /></td>
                <td><input type="number" step="0.01" min="0" className="form-control" value={it.pricePerItem} placeholder="0.00" onChange={e => k.updatePurchaseItem(idx, 'pricePerItem', e.target.value)} /></td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{currency(num(it.quantity) * num(it.pricePerItem))}</td>
                <td style={{ textAlign: 'center' }}><button type="button" className="btn btn-sm btn-secondary" disabled={f.items.length === 1} onClick={() => k.handlePurchaseItemDelete(idx)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-row">
        <Field label="Amount Paid Now (GHS)" hint="Unpaid balance records as Accounts Payable"><input type="number" step="0.01" min="0" className="form-control" value={f.paymentAmount} placeholder="0.00" onChange={e => set(c => ({ ...c, paymentAmount: e.target.value }))} /></Field>
        <Field label="Payment Wallet">
          <select className="form-control" value={f.paymentMethod} onChange={e => set(c => ({ ...c, paymentMethod: e.target.value }))}>
            {PAYMENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Payment Date"><input type="date" className="form-control" value={f.paymentDate} onChange={e => set(c => ({ ...c, paymentDate: e.target.value }))} /></Field>
      </div>
      <Field label="Waybill / Delivery Notes"><input type="text" className="form-control" value={f.notes} onChange={e => set(c => ({ ...c, notes: e.target.value }))} placeholder="e.g. Waybill #108 or invoice number" /></Field>
      <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Purchase Total</div><div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{currency(total)}</div></div>
        <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid Now</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>{currency(f.paymentAmount)}</div></div>
        <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payable (AP)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>{currency(Math.max(0, total - num(f.paymentAmount)))}</div></div>
      </div>
    </Frame>
  )
}

// ── Customer (templates/sales.html / receivables.html #newCustomerModal) ──────
function CustomerModal({ k }) {
  const f = k.customerForm
  const set = k.setCustomerForm
  const editing = Boolean(f._editId)
  return (
    <Frame
      maxWidth={640}
      title={editing ? '✏️ Edit Customer' : '👤 Add New Customer'}
      subtitle="Register customer profile, assign default pricing tier and credit terms"
      onClose={k.close}
      onSubmit={k.handleCustomerSubmit}
      message={k.feedback.customer}
      footer={<Footer k={k} type="customer" primary="💾 Save Customer" onDelete={editing ? () => k.handleDelete('customer', () => k.deleteCustomer(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label={<>Customer / Business Name {REQ}</>}><input type="text" className="form-control" value={f.name} onChange={e => set(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Adwoa Mart, Kweku Adu, Star Mart" required /></Field>
        <Field label="Category"><Select value={f.customer_category} onChange={v => set(c => ({ ...c, customer_category: v }))} options={k.customerCategoryOptions} placeholder="-- Select Category --" /></Field>
      </div>
      <div className="form-row">
        <Field label={<>Default Pricing Tier {REQ}</>}><Select value={f.pricing_category} onChange={v => set(c => ({ ...c, pricing_category: v }))} options={k.pricingCategoryOptions} placeholder="-- Select Pricing Tier --" required /></Field>
        <Field label="Phone Number"><input type="text" className="form-control" value={f.phone} onChange={e => set(c => ({ ...c, phone: e.target.value }))} placeholder="e.g. 0244123456" /></Field>
      </div>
      <div className="form-row">
        <Field label="Delivery Address / Location"><input type="text" className="form-control" value={f.address} onChange={e => set(c => ({ ...c, address: e.target.value }))} placeholder="e.g. Winneba Roundabout, Kasoa Barrier" /></Field>
        <Field label="Email Address (Optional)"><input type="email" className="form-control" value={f.email} onChange={e => set(c => ({ ...c, email: e.target.value }))} placeholder="e.g. contact@business.com" /></Field>
      </div>
      <div className="form-row">
        <Field label="Opening Balance Owing (GHS)" hint="Initial debt brought forward"><input type="number" step="0.01" min="0" className="form-control" value={f.previousBalance} onChange={e => set(c => ({ ...c, previousBalance: e.target.value }))} /></Field>
        <Field label="Registration Date"><input type="date" className="form-control" value={f.date || ''} onChange={e => set(c => ({ ...c, date: e.target.value }))} /></Field>
      </div>
    </Frame>
  )
}

// ── Supplier (templates/payables.html #newSupplierModal) ──────────────────────
function SupplierModal({ k }) {
  const f = k.supplierForm
  const set = k.setSupplierForm
  const editing = Boolean(f._editId)
  return (
    <Frame
      maxWidth={640}
      title={editing ? '✏️ Edit Supplier' : '🚚 Add New Raw Material Supplier'}
      subtitle="Register vendor details, material supplied, and payment terms"
      onClose={k.close}
      onSubmit={k.handleSupplierSubmit}
      message={k.feedback.supplier}
      footer={<Footer k={k} type="supplier" primary="💾 Save Supplier" onDelete={editing ? () => k.handleDelete('supplier', () => k.deleteSupplier(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label={<>Supplier / Company Name {REQ}</>}><input type="text" className="form-control" value={f.name} onChange={e => set(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Apex Packaging, Accra Milk Depot" required /></Field>
        <Field label={<span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Category Supplied {REQ}</span><a href="#new-category" onClick={e => { e.preventDefault(); k.openCategoryModal('supplier') }} style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>+ New Category</a></span>}>
          <Select value={f.item_category ? String(f.item_category) : ''} onChange={v => set(c => ({ ...c, item_category: v }))} options={k.supplierItemCategoryOptions} placeholder="Select category" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Phone Number / Contact"><input type="text" className="form-control" value={f.phone} onChange={e => set(c => ({ ...c, phone: e.target.value }))} placeholder="e.g. 0244123456" /></Field>
        <Field label="Delivery Arrangement / Package">
          <select className="form-control" value={f.delivery_package ? 'true' : 'false'} onChange={e => set(c => ({ ...c, delivery_package: e.target.value === 'true' }))}>
            <option value="false">Standard Delivery</option>
            <option value="true">Boxed Packaging (Delivery Package)</option>
          </select>
        </Field>
      </div>
      <Field label="Payment Terms & Remarks"><input type="text" className="form-control" value={f.notes} onChange={e => set(c => ({ ...c, notes: e.target.value }))} placeholder="e.g. Fully Paid, Net 14 Days, MoMo: 0244xxxxxx" /></Field>
    </Frame>
  )
}

// ── Raw material record ───────────────────────────────────────────────────────
function RawMaterialModal({ k }) {
  const f = k.rawMatForm
  const set = k.setRawMatForm
  const editing = Boolean(f._editId)
  return (
    <Frame
      maxWidth={680}
      title={editing ? '✏️ Edit Raw Material' : '🧪 Add Raw Material'}
      subtitle="Ingredient, packaging bottle, label or flavour kept in the warehouse"
      onClose={k.close}
      onSubmit={k.handleRawMatSubmit}
      message={k.feedback.raw_mat}
      footer={<Footer k={k} type="raw_mat" primary="💾 Save Material" onDelete={editing ? () => k.handleDelete('raw material', () => k.deleteRawMaterial(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label={<>Material Name {REQ}</>}><input list="raw-material-template-names" className="form-control" value={f.name} onChange={e => k.updateRawMatName(e.target.value)} placeholder="Pick from template or type custom" required /></Field>
        <Field label={<span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Category</span><a href="#new-category" onClick={e => { e.preventDefault(); k.openCategoryModal('raw_mat') }} style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>+ New Category</a></span>}>
          <Select value={k.normalizeCategoryValue(f.category)} onChange={v => set(c => ({ ...c, category: v }))} options={k.itemCategoryOptions} placeholder="Select category" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Supplier"><Select value={f.supplier} onChange={v => set(c => ({ ...c, supplier: v }))} options={k.supplierSelectOptions} placeholder="— None —" /></Field>
        <Field label="Unit"><input type="text" className="form-control" value={f.unit} onChange={e => set(c => ({ ...c, unit: e.target.value }))} placeholder="kg / litres / Pcs" /></Field>
      </div>
      <div className="form-row">
        <Field label="Units per Pack"><input type="number" step="0.001" min="0" className="form-control" value={f.unit_per_item} onChange={e => set(c => ({ ...c, unit_per_item: e.target.value }))} /></Field>
        <Field label="Pack Price (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.item_price} onChange={e => set(c => ({ ...c, item_price: e.target.value }))} /></Field>
        <Field label="Unit Cost (GHS)"><input type="number" step="0.0001" min="0" className="form-control" value={f.unit_price} onChange={e => set(c => ({ ...c, unit_price: e.target.value }))} /></Field>
      </div>
      <div className="form-row">
        <Field label="Opening Stock"><input type="number" step="0.001" min="0" className="form-control" value={f.opening_stock} onChange={e => set(c => ({ ...c, opening_stock: e.target.value }))} /></Field>
        <Field label="Reorder Level"><input type="number" step="0.001" min="0" className="form-control" value={f.reorder_level} onChange={e => set(c => ({ ...c, reorder_level: e.target.value }))} /></Field>
      </div>
    </Frame>
  )
}

// ── Cashbook entry (templates/cashbook.html #newCashbookModal) ────────────────
function AccountModal({ k }) {
  const f = k.accountForm
  const set = k.setAccountForm
  const editing = Boolean(f._editId)
  const type = String(f.entry_type || '').toLowerCase()
  const setType = value => set(c => {
    const opts = k.ACCOUNT_SUB_ACCOUNTS_BY_TYPE[value] || []
    return { ...c, entry_type: value, category: opts.includes(c.category) ? c.category : '' }
  })
  const TYPE_LABEL = { expense: 'Operating Expense (- Outflow)', income: 'Other Income / Capital Inflow (+ Inflow)', transfers: 'Account Transfer / Liquidity' }
  return (
    <Frame
      maxWidth={620}
      title={editing ? '✏️ Quick Edit Cashbook Entry' : '💰 Record Cash / Treasury Transaction'}
      subtitle="Operating Expenses, Supplier Payments, Transfers & Capital"
      onClose={k.close}
      onSubmit={k.handleAccountSubmit}
      message={k.feedback.account}
      footer={<Footer k={k} type="account" primary={editing ? '💾 Update Entry' : 'Post to Cashbook'} onDelete={editing ? () => k.handleDelete('account entry', () => k.deleteAccountTransaction(f._editId)).then(k.close) : null} />}
    >
      {!editing ? (
        <div style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: 'var(--radius-sm)', padding: '9px 13px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span>💡 <strong>Customer Sales Receipts:</strong> Recorded under Sales Log.</span>
          <button type="button" className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 600 }} onClick={k.goSales}>Go to Sales Log →</button>
        </div>
      ) : null}
      <div className="form-row">
        <Field label="Transaction Date"><input type="date" className="form-control" value={f.transaction_date} onChange={e => set(c => ({ ...c, transaction_date: e.target.value }))} required /></Field>
        <Field label="Transaction Type">
          <select className="form-control" value={f.entry_type} onChange={e => setType(e.target.value)} required>
            {k.accountTypeOptions.map(o => <option key={o.value} value={o.value}>{TYPE_LABEL[o.value] || o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Counterparty / Payee"><input type="text" className="form-control" value={f.comments || ''} onChange={e => set(c => ({ ...c, comments: e.target.value }))} placeholder="e.g. Shell Fuel, Landlord, Delivery Driver" /></Field>
        <Field label={type === 'transfers' ? 'From Wallet / Account' : 'Wallet / Account Used'}><Select value={f.payment_method} onChange={v => set(c => ({ ...c, payment_method: v }))} options={k.accountPaymentOptions} placeholder="-- Select --" required /></Field>
      </div>
      <Field label={type === 'transfers' ? '📥 Destination Account (Receiving Channel)' : 'Account Category'}>
        <Select value={f.category} onChange={v => set(c => ({ ...c, category: v }))} options={k.accountSubAccountSelectOptions} placeholder="-- Select Category --" required />
      </Field>
      <div className="form-row">
        <Field label={type === 'income' ? 'Inflow (+) Amount (GHS)' : type === 'transfers' ? 'Transfer Amount (GHS)' : 'Outflow (-) Amount (GHS)'}><input type="number" step="0.01" min="0" className="form-control" value={f.amount} onChange={e => set(c => ({ ...c, amount: e.target.value }))} placeholder="0.00" required /></Field>
      </div>
      <Field label="Description / Remarks"><input type="text" className="form-control" value={f.description} onChange={e => set(c => ({ ...c, description: e.target.value }))} placeholder="Reason for transaction" required /></Field>
    </Frame>
  )
}

// ── Wallet transfer (cashbook "Account Transfer" entry) ───────────────────────
function TransferModal({ k }) {
  const f = k.transferForm
  const set = k.setTransferForm
  const wallets = k.treasury.wallets
  const from = wallets.find(w => w.key === f.from)
  const to = wallets.find(w => w.key === f.to)
  const amount = num(f.amount)
  return (
    <Frame
      maxWidth={620}
      title="🔄 Account Transfer / Liquidity Move"
      subtitle="Move money between wallets. One entry updates both balances."
      onClose={k.close}
      onSubmit={k.handleTransferSubmit}
      message={k.feedback.transfer}
      footer={<Footer k={k} type="transfer" primary="Post Transfer to Cashbook" />}
    >
      <div className="form-row">
        <Field label="Transaction Date"><input type="date" className="form-control" value={f.transaction_date} onChange={e => set(c => ({ ...c, transaction_date: e.target.value }))} required /></Field>
        <Field label="Transfer Amount (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.amount} onChange={e => set(c => ({ ...c, amount: e.target.value }))} placeholder="0.00" required /></Field>
      </div>
      <div className="form-row">
        <Field label="📤 From Wallet (Paying Channel)">
          <select className="form-control" value={f.from} onChange={e => set(c => ({ ...c, from: e.target.value, to: c.to === e.target.value ? '' : c.to }))} required>
            {wallets.map(w => <option key={w.key} value={w.key}>{w.label} ({currency(w.balance)})</option>)}
          </select>
        </Field>
        <Field label="📥 Destination Wallet (Receiving Channel)">
          <select className="form-control" value={f.to} onChange={e => set(c => ({ ...c, to: e.target.value }))} required>
            <option value="">-- Select wallet --</option>
            {wallets.filter(w => w.key !== f.from).map(w => <option key={w.key} value={w.key}>{w.label} ({currency(w.balance)})</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description / Remarks"><input type="text" className="form-control" value={f.description} onChange={e => set(c => ({ ...c, description: e.target.value }))} placeholder={`Transfer from ${from?.label || ''}${to ? ` to ${to.label}` : ''}`} /></Field>
      <Field label="Comments"><input type="text" className="form-control" value={f.comments} onChange={e => set(c => ({ ...c, comments: e.target.value }))} /></Field>
      {from ? (
        <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{from.label} after</div><div style={{ fontSize: '16px', fontWeight: 700, color: from.balance - amount < 0 ? '#dc2626' : 'var(--secondary)' }}>{currency(from.balance - amount)}</div></div>
          <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{to ? `${to.label} after` : 'Receiving wallet'}</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>{to ? currency(to.balance + amount) : '—'}</div></div>
        </div>
      ) : null}
      {from && amount > from.balance ? <div className="alert alert-warning" style={{ marginTop: '12px', marginBottom: 0 }}><span>This is more than the {from.label} book balance.</span></div> : null}
    </Frame>
  )
}

// ── Pricing rule (Settings & Pricing) ─────────────────────────────────────────
function PricingModal({ k }) {
  const f = k.pricingForm
  const set = k.setPricingForm
  const editing = Boolean(f._editId)
  return (
    <Frame
      maxWidth={560}
      title={editing ? '✏️ Edit Pricing Rule' : '💲 Add Pricing Rule'}
      subtitle="Selling price per bottle size and pricing tier"
      onClose={k.close}
      onSubmit={k.handlePricingSubmit}
      message={k.feedback.pricing}
      footer={<Footer k={k} type="pricing" primary="💾 Save Price" onDelete={editing ? () => k.handleDelete('pricing rule', () => k.deletePricingRule(f._editId)).then(k.close) : null} />}
    >
      <div className="form-row">
        <Field label="Product Size">
          <Select value={f.product} onChange={v => { const p = k.productMap.get(String(v)); set(c => ({ ...c, product: v, size: p?.name || '' })) }} options={k.productSelectOptions} placeholder="-- Select size --" required />
        </Field>
        <Field label="Pricing Tier"><Select value={f.pricing_category} onChange={v => set(c => ({ ...c, pricing_category: v }))} options={k.pricingCategoryOptions} placeholder="-- Select tier --" required /></Field>
      </div>
      <Field label="Selling Price (GHS)"><input type="number" step="0.01" min="0" className="form-control" value={f.price} onChange={e => set(c => ({ ...c, price: e.target.value }))} required /></Field>
    </Frame>
  )
}

const MODALS = {
  sale: SaleModal,
  receipt: ReceiptModal,
  batch: BatchModal,
  purchase: PurchaseModal,
  customer: CustomerModal,
  supplier: SupplierModal,
  raw_mat: RawMaterialModal,
  account: AccountModal,
  transfer: TransferModal,
  pricing: PricingModal,
}

function ClassicForms({ kit }) {
  const Modal = MODALS[kit.activeModal]
  return Modal ? <Modal k={kit} /> : null
}

export default ClassicForms
