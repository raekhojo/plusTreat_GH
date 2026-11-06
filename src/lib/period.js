// Helpers for figures over a date range ({ start, end } as YYYY-MM-DD; either may be blank).

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
export const dayOf = v => String(v || '').slice(0, 10)

export function hasRange(range) {
  return Boolean(range?.start || range?.end)
}

export function inRange(date, range) {
  if (!hasRange(range)) return true
  const d = dayOf(date)
  if (!d) return false
  if (range.start && d < range.start) return false
  if (range.end && d > range.end) return false
  return true
}

// On or before the end of the range (everything when there is no end).
export function byEnd(date, range) {
  if (!range?.end) return true
  const d = dayOf(date)
  return Boolean(d) && d <= range.end
}

// Amounts at the end of the range are worked back from today's figures: what is
// owed today plus anything paid after the range ended. Invoices and purchases
// dated after the range did not exist yet, so they count as nothing.
const paidAfter = (rows, key, id, dateField, range) => rows
  .filter(r => String(r[key]) === String(id) && dayOf(r[dateField]) > range.end)
  .reduce((t, r) => t + num(r.amount), 0)

export function invoiceDueAt(invoice, payments, range, outstandingOf) {
  if (!range?.end) return outstandingOf(invoice)
  if (!byEnd(invoice.invoice_date, range)) return 0
  return Math.max(0, outstandingOf(invoice) + paidAfter(payments, 'invoice', invoice.id, 'payment_date', range))
}

export function invoicePaidAt(invoice, payments, range, paidOf) {
  if (!range?.end) return paidOf(invoice)
  return Math.max(0, paidOf(invoice) - paidAfter(payments, 'invoice', invoice.id, 'payment_date', range))
}

export function purchaseDueAt(purchase, purchasePayments, range, purchaseOutstandingOf) {
  if (!range?.end) return purchaseOutstandingOf(purchase)
  if (!byEnd(purchase.purchase_date, range)) return 0
  return Math.max(0, purchaseOutstandingOf(purchase) + paidAfter(purchasePayments, 'purchase', purchase.id, 'payment_date', range))
}

export function rangeLabel(range) {
  if (!hasRange(range)) return 'Lifetime'
  const fmt = d => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (range.start && range.end) return `${fmt(range.start)} – ${fmt(range.end)}`
  return range.start ? `From ${fmt(range.start)}` : `To ${fmt(range.end)}`
}
