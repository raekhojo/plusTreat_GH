// Formatting used by the classic (Plus Yoghurt ERP) screens, same as its Jinja filters.
export function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// {{ value|currency }} → "GHS 1,234.56"
export function currency(v) {
  return `GHS ${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// {{ value|number }} → "1,234.56"
export function number(v) {
  return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// True when a YYYY-MM-DD date falls inside the active period (always true for "All Time").
export function inPeriod(raw, period) {
  if (!period || period.key === 'all') return true
  const d = String(raw || '').slice(0, 10)
  if (!d) return false
  return (!period.start || d >= period.start) && (!period.end || d <= period.end)
}

export function day(raw) {
  return String(raw || '').slice(0, 10)
}

export function qty(v) {
  const n = num(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

// fully_paid / partially_paid / pending / sample, as the ERP classifies invoices.
export function invoiceStatus(inv, due, paid) {
  if (inv.is_sample_sale) return 'sample'
  if (due <= 0.005) return 'fully_paid'
  if (paid > 0.005) return 'partially_paid'
  return 'pending'
}

// Average production cost per bottle by size, from every batch output.
export function unitCostBySize(batches) {
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

export function litresOf(size, quantity) {
  const t = String(size || '').toLowerCase().replaceAll(',', '')
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (ml) return (num(ml[1]) / 1000) * num(quantity)
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/)
  return l ? num(l[1]) * num(quantity) : 0
}

export function matches(query, ...fields) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  return fields.join(' ').toLowerCase().includes(q)
}

// Click handler for in-page links (<a href="#..."> that should not navigate).
export function act(fn) {
  return e => { e.preventDefault(); fn() }
}

// "a: b; c-d: e" → { a: 'b', cD: 'e' } so template style strings can be reused verbatim.
export function css(text) {
  const out = {}
  String(text || '').split(';').forEach(part => {
    const i = part.indexOf(':')
    if (i < 0) return
    const key = part.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    if (key) out[key] = part.slice(i + 1).trim()
  })
  return out
}
