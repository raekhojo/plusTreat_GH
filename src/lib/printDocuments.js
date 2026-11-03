// Branded, printable business documents (invoice, payment receipt, customer
// statement), ported from the PlusYoghurt-App invoice template. Each opens in a
// new window and triggers the browser's Print dialog ("Save as PDF" works too).
import invoiceLogo from '../assets/plusLogo.png'

// ── Company & payment details printed on every document ─────────────────────
// Defaults below; Settings & Pricing → Document details can override them
// (saved in this browser under PROFILE_KEY).
export const DEFAULT_COMPANY_PROFILE = {
  name: 'Plus Treats Company',
  phone: '+233 53 875 217',
  email: 'plusyoghurt@gmail.com',
  social: '@Plus_yoghurt',
  momo: {
    label: 'Mobile Money:',
    lines: ['MoMoPay ID: 171675', "'No: +233 538 795 217", 'Name: Plus Treats Ltd (Desmond Kwakye)', 'Carrier: MTN'],
  },
  bank: {
    label: 'Bank Transfer',
    lines: ['Bank Name: Cal Bank', 'Acct No: 1400008752957', 'Acct Name: Plus Treats Ltd'],
  },
  thankYou: 'Thank you for your business !!',
}
const PROFILE_KEY = 'plusTreatCompanyProfile'

export function getCompanyProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')
    if (!saved) return DEFAULT_COMPANY_PROFILE
    return {
      ...DEFAULT_COMPANY_PROFILE,
      ...saved,
      momo: { ...DEFAULT_COMPANY_PROFILE.momo, ...(saved.momo || {}) },
      bank: { ...DEFAULT_COMPANY_PROFILE.bank, ...(saved.bank || {}) },
    }
  } catch {
    return DEFAULT_COMPANY_PROFILE
  }
}
export function saveCompanyProfile(profile) {
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  else localStorage.removeItem(PROFILE_KEY)
}

const METHOD_LABELS = { cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', other: 'Other' }

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function amount(v) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v)) }
function ghs(v) { return `GHS ${amount(v)}` }
function qty(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num(v)) }
function date(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return esc(raw || '—')
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
export function invoiceNumber(id) { return `INV-${String(id ?? '').padStart(4, '0')}` }
function receiptNumber(payment) { return payment?.receipt_id ? `RCPT-${String(payment.receipt_id).padStart(4, '0')}` : `RCPT-${String(payment?.id ?? '').padStart(4, '0')}` }

const ICONS = {
  phone: '<path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.72 11.72 0 003.68.59 1 1 0 011 1v3.5a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.72 11.72 0 00.59 3.68 1 1 0 01-.24 1.02l-2.23 2.09z"/>',
  email: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.63-.56 3.54-1.46.65.89 1.7 1.46 2.96 1.46 1.93 0 3.5-1.57 3.5-3.5V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>',
  social: '<path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>',
}

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:#f1f5f9;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{display:flex;justify-content:center;gap:10px;padding:14px}
.toolbar button{border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer;background:#0f172a;color:#fff}
.toolbar button.secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1}
.page{display:flex;justify-content:center;padding:0 0 40px}
.canvas{width:100%;max-width:820px;background:#fff;border:18px solid #00b0ff;border-radius:4px;box-shadow:0 10px 25px -5px rgba(0,0,0,.1);padding:40px 40px 0;display:flex;flex-direction:column;min-height:1060px;position:relative}
.head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.brand{display:flex;align-items:flex-start;gap:16px}
.brand img{width:110px;height:auto;display:block}
.contacts{display:flex;flex-direction:column;gap:2px}
.company{font-size:15.5px;font-weight:800;margin-bottom:3px;letter-spacing:-.2px}
.contact{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:#334155;line-height:1.4}
.contact svg{width:14px;height:14px;fill:#0f172a;flex-shrink:0}
.contact svg.social{fill:#0284c7}
.title{font-size:44px;font-weight:900;letter-spacing:1px;margin:0;line-height:1;text-align:right;padding-top:8px}
.subtitle{text-align:right;font-size:12.5px;font-weight:700;color:#64748b;margin-top:6px;letter-spacing:.4px}
.meta{display:flex;justify-content:space-between;align-items:flex-start;margin:28px 0 24px;gap:24px}
.meta-left{display:flex;flex-direction:column;gap:8px}
.meta-row{display:flex;gap:18px;font-size:13.5px}
.meta-row b{min-width:110px}
.meta-row span{font-weight:600;color:#334155}
.billto{min-width:250px}
.billto-head{display:flex;align-items:baseline;gap:14px}
.billto-title{font-size:13px;font-weight:800;letter-spacing:.3px}
.underline{border-bottom:1.5px solid #0f172a;flex:1;padding-bottom:2px;font-size:14px;font-weight:700}
.tier{border-bottom:1.5px solid #0f172a;margin:5px 0 0 68px;padding-bottom:2px;text-align:center;font-size:13px;color:#334155}
table{width:100%;border-collapse:collapse;margin:10px 0 24px}
th{font-size:14px;font-weight:800;text-align:left;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a;padding:11px 14px}
td{padding:13px 14px;font-size:13.5px;border-bottom:1px solid #e2e8f0}
.c{text-align:center}.r{text-align:right}
td.desc{font-weight:600}td.amt{font-weight:600}
.tag{color:#64748b;font-size:12px;font-weight:500;margin-left:4px}
.totals{display:flex;justify-content:flex-end;margin-bottom:32px}
.totals-box{width:300px}
.calc{display:flex;justify-content:space-between;padding:5px 8px;font-size:13.5px;font-weight:700}
.calc span:last-child{font-weight:600}
.pill{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;margin:4px 0}
.pill span{font-weight:800!important}
.owing{margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;color:#ef4444}
.owing span:first-child{font-size:14px}.owing span:last-child{font-weight:800!important;font-size:15.5px}
.paid{color:#059669}
.stamp{align-self:flex-end;margin:-8px 0 24px;border:3px solid #059669;color:#059669;font-weight:900;font-size:20px;letter-spacing:2px;padding:6px 16px;border-radius:6px;transform:rotate(-6deg)}
.section-title{font-size:14px;font-weight:800;margin:8px 0 0}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 20px}
.summary div{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
.summary span{display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b}
.summary strong{font-size:18px}
.pay{margin-top:auto;padding-top:24px;border-top:1px solid #cbd5e1;margin-bottom:24px}
.pay-note{font-size:12.5px;font-weight:700;margin-bottom:12px}
.channels{display:flex;gap:48px;flex-wrap:wrap}
.channel{display:flex;gap:16px;font-size:12px;line-height:1.5;color:#1e293b}
.channel b{min-width:95px}
.banner{background:#ff9800;color:#000;text-align:center;font-size:15.5px;font-weight:800;padding:13px;margin:0 -40px;letter-spacing:.5px}
.empty{color:#64748b;text-align:center}
@media print{
  @page{size:A4;margin:8mm}
  body{background:#fff}
  .toolbar{display:none}
  .page{padding:0}
  .canvas{box-shadow:none;border-width:16px;padding:30px 30px 0;max-width:100%;min-height:calc(297mm - 16mm - 4px)}
  .banner{margin:0 -30px}
  tr{page-break-inside:avoid}
}
`

function header(title, subtitle = '') {
  const p = getCompanyProfile()
  const logo = new URL(invoiceLogo, window.location.href).href
  return `
  <div class="head">
    <div class="brand">
      <img src="${esc(logo)}" alt="Plus Yoghurt" />
      <div class="contacts">
        <div class="company">${esc(p.name)}</div>
        <div class="contact"><svg viewBox="0 0 24 24">${ICONS.phone}</svg><span>${esc(p.phone)}</span></div>
        <div class="contact"><svg viewBox="0 0 24 24">${ICONS.email}</svg><span>${esc(p.email)}</span></div>
        <div class="contact"><svg viewBox="0 0 24 24" class="social">${ICONS.social}</svg><span>${esc(p.social)}</span></div>
      </div>
    </div>
    <div>
      <h1 class="title">${esc(title)}</h1>
      ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
    </div>
  </div>`
}

function footer({ showPaymentDetails = true } = {}) {
  const p = getCompanyProfile()
  const channel = c => `<div class="channel"><b>${esc(c.label)}</b><div>${c.lines.map((l, i) => `<div${i === 0 && c === p.momo ? ' style="font-weight:700"' : ''}>${esc(l)}</div>`).join('')}</div></div>`
  return `
  ${showPaymentDetails ? `<div class="pay"><div class="pay-note">Please send payment to any of the accounts below:</div><div class="channels">${channel(p.momo)}${channel(p.bank)}</div></div>` : '<div class="pay" style="border-top:0"></div>'}
  <div class="banner">${esc(p.thankYou)}</div>`
}

function billTo(name, tier) {
  return `
  <div class="billto">
    <div class="billto-head"><span class="billto-title">BILL TO</span><div class="underline">${esc(name || '—')}</div></div>
    <div class="tier">${esc(tier || 'Customer')}</div>
  </div>`
}

function openDocument(docTitle, bodyHtml) {
  const win = window.open('', '_blank', 'width=960,height=1100')
  if (!win) {
    window.alert('Please allow pop-ups for this site to print documents.')
    return
  }
  win.document.open()
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${esc(docTitle)}</title><style>${STYLES}</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button><button class="secondary" onclick="window.close()">Close</button></div>
  <div class="page"><div class="canvas">${bodyHtml}</div></div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 250) })</${'script'}>
</body></html>`)
  win.document.close()
}

function linesTable(lines, fallbackTotal) {
  const rows = (lines || []).length
    ? lines.map(l => `
      <tr>
        <td class="desc">${esc(l.product_size || 'Plus Yoghurt')}${/sample/i.test(String(l.pricing_category || '')) ? '<span class="tag">(Sample)</span>' : ''}</td>
        <td class="c">${amount(l.unit_price)}</td>
        <td class="c">${qty(l.quantity)}</td>
        <td class="r amt">${amount(l.line_total)}</td>
      </tr>`).join('')
    : `<tr><td class="desc">Plus Yoghurt Assorted Line</td><td class="c">${amount(fallbackTotal)}</td><td class="c">1</td><td class="r amt">${amount(fallbackTotal)}</td></tr>`
  return `<table><thead><tr><th style="width:48%">Description</th><th class="c" style="width:22%">Unit Cost</th><th class="c" style="width:14%">Qty</th><th class="r" style="width:16%">Amount</th></tr></thead><tbody>${rows}</tbody></table>`
}

/** Official invoice — the PlusYoghurt-App template. */
export function printInvoice(invoice, { customer = null } = {}) {
  if (!invoice) return
  const tier = invoice.lines?.[0]?.pricing_category || customer?.pricing_category || customer?.customer_category_name || 'Customer'
  const linesTotal = (invoice.lines || []).reduce((t, l) => t + num(l.line_total), 0)
  const subtotal = num(invoice.subtotal) || linesTotal || num(invoice.total_amount) + num(invoice.discount_amount)
  const body = `
    ${header('INVOICE')}
    <div class="meta">
      <div class="meta-left">
        <div class="meta-row"><b>Invoice Date:</b><span>${date(invoice.invoice_date)}</span></div>
        <div class="meta-row"><b>Invoice No.</b><span style="color:#64748b">${esc(invoiceNumber(invoice.id))}</span></div>
        ${invoice.staff_name ? `<div class="meta-row"><b>Served by:</b><span>${esc(invoice.staff_name)}</span></div>` : ''}
      </div>
      ${billTo(invoice.customer_name, tier)}
    </div>
    ${linesTable(invoice.lines, invoice.total_amount)}
    <div class="totals"><div class="totals-box">
      <div class="calc"><span>Subtotal :</span><span>${amount(subtotal)}</span></div>
      <div class="calc"><span>Discount :</span><span>${amount(invoice.discount_amount)}</span></div>
      <div class="calc pill"><span>Total</span><span>${amount(invoice.total_amount)}</span></div>
      <div class="calc" style="margin-top:10px"><span>Prev Bal</span><span>${amount(invoice.previous_balance)}</span></div>
      <div class="calc owing"><span>Outstanding Balance:</span><span>${amount(Math.max(0, num(invoice.outstanding_balance)))}</span></div>
    </div></div>
    ${invoice.notes && String(invoice.notes).trim().toUpperCase() !== 'OPENING_BALANCE' ? `<p style="font-size:12.5px;color:#334155;margin:0 0 16px"><b>Notes:</b> ${esc(invoice.notes)}</p>` : ''}
    ${footer()}`
  openDocument(`Invoice ${invoiceNumber(invoice.id)}`, body)
}

/** Payment receipt in the same branded layout. */
export function printReceipt(payment, { invoice = null, customer = null } = {}) {
  if (!payment) return
  const tier = invoice?.lines?.[0]?.pricing_category || customer?.pricing_category || 'Customer'
  const invoiceTotal = invoice ? num(invoice.previous_balance) + num(invoice.total_amount) : null
  const balance = invoice ? Math.max(0, num(invoice.outstanding_balance)) : null
  const body = `
    ${header('RECEIPT', 'PAYMENT RECEIVED')}
    <div class="meta">
      <div class="meta-left">
        <div class="meta-row"><b>Receipt Date:</b><span>${date(payment.payment_date)}</span></div>
        <div class="meta-row"><b>Receipt No.</b><span style="color:#64748b">${esc(receiptNumber(payment))}</span></div>
        <div class="meta-row"><b>For Invoice:</b><span>${esc(payment.invoice ? invoiceNumber(payment.invoice) : '—')}</span></div>
      </div>
      ${billTo(payment.customer_name || invoice?.customer_name, tier).replace('BILL TO', 'RECEIVED FROM').replace('margin:5px 0 0 68px', 'margin:5px 0 0 128px')}
    </div>
    <table>
      <thead><tr><th style="width:40%">Description</th><th class="c">Method</th><th class="c">Reference</th><th class="r">Amount</th></tr></thead>
      <tbody><tr>
        <td class="desc">Payment${payment.invoice ? ` for ${esc(invoiceNumber(payment.invoice))}` : ''}${payment.notes ? `<span class="tag">${esc(payment.notes)}</span>` : ''}</td>
        <td class="c">${esc(METHOD_LABELS[payment.method] || payment.method || '—')}</td>
        <td class="c">${esc(payment.reference || '—')}</td>
        <td class="r amt">${amount(payment.amount)}</td>
      </tr></tbody>
    </table>
    <div class="totals"><div class="totals-box">
      ${invoiceTotal !== null ? `<div class="calc"><span>Invoice Total :</span><span>${amount(invoiceTotal)}</span></div>` : ''}
      ${invoiceTotal !== null && invoiceTotal - balance - num(payment.amount) > 0.005 ? `<div class="calc"><span>Paid before this receipt :</span><span>${amount(invoiceTotal - balance - num(payment.amount))}</span></div>` : ''}
      <div class="calc pill paid"><span>Amount Received</span><span>${amount(payment.amount)}</span></div>
      ${balance !== null ? `<div class="calc ${balance > 0 ? 'owing' : 'paid'}"><span>${balance > 0 ? 'Balance Remaining:' : 'Balance:'}</span><span>${amount(balance)}</span></div>` : ''}
    </div></div>
    ${balance === 0 ? '<div class="stamp">PAID IN FULL</div>' : ''}
    ${footer({ showPaymentDetails: balance === null || balance > 0 })}`
  openDocument(`Receipt ${receiptNumber(payment)}`, body)
}

/** Customer statement: every invoice and payment, with balance due. */
export function printCustomerStatement(customer, invoices = [], payments = []) {
  if (!customer) return
  const sortedInv = [...invoices].sort((a, b) => String(a.invoice_date || '').localeCompare(String(b.invoice_date || '')))
  const sortedPay = [...payments].sort((a, b) => String(a.payment_date || '').localeCompare(String(b.payment_date || '')))
  const billed = sortedInv.reduce((t, i) => t + num(i.previous_balance) + num(i.total_amount), 0)
  const due = sortedInv.reduce((t, i) => t + Math.max(0, num(i.outstanding_balance)), 0)
  // Matches the invoice table: paid = billed − what is still outstanding.
  const paid = Math.max(0, billed - due)
  const today = new Date().toISOString().slice(0, 10)
  const invRows = sortedInv.length
    ? sortedInv.map(i => {
      const out = Math.max(0, num(i.outstanding_balance))
      return `<tr><td>${esc(invoiceNumber(i.id))}</td><td class="c">${date(i.invoice_date)}</td><td class="r">${amount(num(i.previous_balance) + num(i.total_amount))}</td><td class="r">${amount(Math.max(0, num(i.previous_balance) + num(i.total_amount) - num(i.outstanding_balance)))}</td><td class="r" style="${out > 0 ? 'color:#dc2626;font-weight:700' : ''}">${amount(out)}</td></tr>`
    }).join('')
    : '<tr><td colspan="5" class="empty">No invoices recorded.</td></tr>'
  const payRows = sortedPay.length
    ? sortedPay.map(p => `<tr><td class="c">${date(p.payment_date)}</td><td class="c">${esc(p.invoice ? invoiceNumber(p.invoice) : '—')}</td><td class="c">${esc(METHOD_LABELS[p.method] || p.method || '—')}</td><td class="c">${esc(p.reference || '—')}</td><td class="r">${amount(p.amount)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">No payments recorded.</td></tr>'
  const body = `
    ${header('STATEMENT', 'CUSTOMER ACCOUNT')}
    <div class="meta">
      <div class="meta-left">
        <div class="meta-row"><b>Statement Date:</b><span>${date(today)}</span></div>
        ${customer.phone ? `<div class="meta-row"><b>Phone:</b><span>${esc(customer.phone)}</span></div>` : ''}
        ${customer.customer_category_name ? `<div class="meta-row"><b>Category:</b><span>${esc(customer.customer_category_name)}</span></div>` : ''}
      </div>
      ${billTo(customer.name, customer.pricing_category || customer.customer_category_name)}
    </div>
    <div class="summary">
      <div><span>Total Billed</span><strong>${ghs(billed)}</strong></div>
      <div><span>Total Paid</span><strong class="paid">${ghs(paid)}</strong></div>
      <div><span>Balance Due</span><strong style="color:${due > 0 ? '#dc2626' : '#059669'}">${ghs(due)}</strong></div>
    </div>
    <div class="section-title">Invoices</div>
    <table><thead><tr><th>Invoice #</th><th class="c">Date</th><th class="r">Billed</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>${invRows}</tbody></table>
    <div class="section-title">Payments received</div>
    <table><thead><tr><th class="c">Date</th><th class="c">Invoice</th><th class="c">Method</th><th class="c">Reference</th><th class="r">Amount</th></tr></thead><tbody>${payRows}</tbody></table>
    ${footer({ showPaymentDetails: due > 0 })}`
  openDocument(`Statement — ${customer.name}`, body)
}

/**
 * Printable report (Reports Center → Print / PDF). `rows` items are arrays of
 * cells, or { section: 'Title' } headings, or { subtotal: [cells] } lines.
 */
// Renders one report table. Columns whose values are all numbers or amounts are right-aligned.
function reportTable({ columns = [], rows = [], totals = [] }) {
  const wide = columns.length > 6
  const isNum = v => typeof v === 'number' || /^[-−]?(GHS\s*)?[-−]?[\d,]+(\.\d+)?\s*(%|L|days?)?$/i.test(String(v).trim())
  const dataRows = rows.filter(r => Array.isArray(r))
  const numCols = new Set(columns.map((_, i) => i).filter(i => {
    const vals = dataRows.map(r => r[i]).filter(v => v !== '' && v !== undefined && v !== null && v !== '—')
    return i > 0 && vals.length && vals.every(isNum)
  }))
  const cell = (v, i) => `<td class="${numCols.has(i) ? 'r' : ''}">${esc(v)}</td>`
  const body = rows.length
    ? rows.map(r => {
      if (r && r.section) return `<tr class="sec"><td colspan="${columns.length}">${esc(r.section)}</td></tr>`
      if (r && r.subtotal) return `<tr class="sub">${r.subtotal.map(cell).join('')}</tr>`
      return `<tr>${r.map(cell).join('')}</tr>`
    }).join('')
    : `<tr><td colspan="${columns.length}" class="empty">No records for the selected filters.</td></tr>`
  const foot = totals.map(t => `<tr class="tot">${t.map(cell).join('')}</tr>`).join('')
  return `<table class="report${wide ? ' wide' : ''}">
      <thead><tr>${columns.map((c, i) => `<th class="${numCols.has(i) ? 'r' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
      ${foot ? `<tfoot>${foot}</tfoot>` : ''}
    </table>`
}

// `tables` (optional) prints several titled tables in one document: [{ heading, columns, rows, totals }].
export function printReport({ title, subtitle = '', columns = [], rows = [], totals = [], note = '', tables = null }) {
  const tablesHtml = Array.isArray(tables) && tables.length
    ? tables.map(t => `<h3 class="report-heading">${esc(t.heading || '')}</h3>${reportTable(t)}`).join('')
    : reportTable({ columns, rows, totals })
  const html = `
    ${header('REPORT', title.toUpperCase())}
    <div class="meta" style="margin-top:8px">
      <div class="meta-left">
        <div class="meta-row"><b>Report:</b><span>${esc(title)}</span></div>
        ${subtitle ? `<div class="meta-row"><b>Period:</b><span>${esc(subtitle)}</span></div>` : ''}
        <div class="meta-row"><b>Generated:</b><span>${date(new Date().toISOString().slice(0, 10))}</span></div>
      </div>
    </div>
    ${tablesHtml}
    ${note ? `<p style="font-size:11.5px;color:#64748b;margin:0 0 16px">${esc(note)}</p>` : ''}
    <div style="margin-top:auto"></div>
    <div class="banner">${esc(getCompanyProfile().name)} · Confidential internal report</div>`
  openDocument(`${title} report`, html.replace('<table class="report', '<style>.report-heading{margin:18px 0 6px;font-size:13px;font-weight:800;color:#0f172a}.report th,.report td{padding:8px 10px;font-size:12px}.report.wide th,.report.wide td{padding:6px 7px;font-size:11px}.report tr.sec td{font-weight:800;background:#f1f5f9;border-bottom:1px solid #cbd5e1}.report tr.sub td{font-weight:700;border-top:1px solid #cbd5e1}.report tr.tot td{font-weight:800;border-top:2px solid #0f172a;border-bottom:0}</style><table class="report'))
}
