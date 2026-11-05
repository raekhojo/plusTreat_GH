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

const METHOD_LABELS = { cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', ghanapay: 'GhanaPay', other: 'Other' }

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

const VIEWER_STYLE_ID = 'plus-doc-viewer-style'
const VIEWER_CSS = `
.pdv-overlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.55);backdrop-filter:blur(2px)}
.pdv-shell{display:flex;flex-direction:column;width:min(920px,100%);height:min(1100px,100%);background:#f1f5f9;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.35)}
.pdv-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#ffffff;border-bottom:1px solid #e2e8f0}
.pdv-bar strong{font:600 0.95rem/1.3 "Nunito","Segoe UI",sans-serif;color:#15344d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdv-actions{display:flex;gap:8px;flex:none}
.pdv-actions button{height:36px;padding:0 16px;border-radius:10px;font:600 0.86rem "Nunito","Segoe UI",sans-serif;cursor:pointer}
.pdv-print{border:1px solid #15344d;background:#15344d;color:#fff}
.pdv-print:hover{background:#2c86b8;border-color:#2c86b8}
.pdv-close{border:1px solid rgba(21,52,77,.14);background:#fff;color:#15344d}
.pdv-close:hover{border-color:#31b1e4;color:#2c86b8}
.pdv-actions button:focus-visible{outline:2px solid #31b1e4;outline-offset:2px}
.pdv-frame{flex:1;width:100%;border:0;background:#f1f5f9}
@media (max-width:640px){.pdv-overlay{padding:0}.pdv-shell{border-radius:0;height:100%}}
`

// Shows a branded document inside the app (not a pop-up), with Print / Save as PDF and Close.
function showViewer(docTitle, html) {
  if (typeof document === 'undefined') return
  if (!document.getElementById(VIEWER_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = VIEWER_STYLE_ID
    style.textContent = VIEWER_CSS
    document.head.appendChild(style)
  }
  document.querySelector('.pdv-overlay')?.remove()
  const overlay = document.createElement('div')
  overlay.className = 'pdv-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', docTitle)
  overlay.innerHTML = `<div class="pdv-shell">
    <div class="pdv-bar"><strong></strong><div class="pdv-actions"><button type="button" class="pdv-print">Print / Save as PDF</button><button type="button" class="pdv-close">Close</button></div></div>
    <iframe class="pdv-frame"></iframe>
  </div>`
  overlay.querySelector('strong').textContent = docTitle
  const frame = overlay.querySelector('iframe')
  frame.title = docTitle
  frame.srcdoc = html
  const previousOverflow = document.body.style.overflow
  const close = () => {
    overlay.remove()
    document.body.style.overflow = previousOverflow
    document.removeEventListener('keydown', onKey)
  }
  const onKey = e => { if (e.key === 'Escape') close() }
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) close() })
  overlay.querySelector('.pdv-close').addEventListener('click', close)
  overlay.querySelector('.pdv-print').addEventListener('click', () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
  })
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  document.body.appendChild(overlay)
  overlay.querySelector('.pdv-print').focus()
}

// bodyHtml may be a list: each entry becomes its own page (e.g. every receipt of an invoice).
function openDocument(docTitle, bodyHtml, { plain = false } = {}) {
  const pages = (Array.isArray(bodyHtml) ? bodyHtml : [bodyHtml])
    .map(body => `<div class="page"><div class="canvas${plain ? ' canvas-plain' : ''}">${body}</div></div>`).join('')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${esc(docTitle)}</title><style>${STYLES}
body{padding-top:20px}
.canvas-plain{border:0;border-radius:10px;padding:32px 36px 0}
@media print{body{padding-top:0;zoom:1!important}.page{break-after:page}.page:last-child{break-after:auto}.canvas-plain{padding:0}}
</style></head><body>${pages}
<script>
// Shrink the page so a whole A4 sheet fits in the viewer without scrolling (screen only).
(function(){
  function fit(){
    var z = Math.min(1, (window.innerHeight - 28) / 1110, (window.innerWidth - 24) / 856);
    document.body.style.zoom = String(Math.max(0.45, z));
  }
  window.addEventListener('load', fit);
  window.addEventListener('resize', fit);
  window.addEventListener('beforeprint', function(){ document.body.style.zoom = '1' });
  window.addEventListener('afterprint', fit);
  fit();
})();
</${'script'}>
</body></html>`
  showViewer(docTitle, html)
}

function linesTable(lines, fallbackTotal, { minRows = 0 } = {}) {
  const rows = (lines || []).length
    ? lines.map(l => `
      <tr>
        <td class="desc">${esc(l.product_size || 'Plus Yoghurt')}${/sample/i.test(String(l.pricing_category || '')) ? '<span class="tag">(Sample)</span>' : ''}</td>
        <td class="c">${amount(l.unit_price)}</td>
        <td class="c">${qty(l.quantity)}</td>
        <td class="r amt">${amount(l.line_total)}</td>
      </tr>`).join('')
    : `<tr><td class="desc">Plus Yoghurt Assorted Line</td><td class="c">${amount(fallbackTotal)}</td><td class="c">1</td><td class="r amt">${amount(fallbackTotal)}</td></tr>`
  const filled = Math.max(0, minRows - Math.max(1, (lines || []).length))
  const blanks = Array.from({ length: filled }, () => '<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('')
  return `<table><thead><tr><th style="width:48%">Description</th><th class="c" style="width:22%">Unit Cost</th><th class="c" style="width:14%">Qty</th><th class="r" style="width:16%">Amount</th></tr></thead><tbody>${rows}${blanks}</tbody></table>`
}

/** Official invoice — the PlusYoghurt-App template. */
function invoiceBody(invoice, { customer = null } = {}) {
  const tier = invoice.lines?.[0]?.pricing_category || customer?.pricing_category || customer?.customer_category_name || 'Customer'
  const linesTotal = (invoice.lines || []).reduce((t, l) => t + num(l.line_total), 0)
  const subtotal = num(invoice.subtotal) || linesTotal || num(invoice.total_amount) + num(invoice.discount_amount)
  return `
    ${header('INVOICE')}
    <div class="meta">
      <div class="meta-left">
        <div class="meta-row"><b>Invoice Date:</b><span>${date(invoice.invoice_date)}</span></div>
        <div class="meta-row"><b>Invoice No.</b><span style="color:#64748b">${esc(invoiceNumber(invoice.id))}</span></div>
        ${invoice.staff_name ? `<div class="meta-row"><b>Served by:</b><span>${esc(invoice.staff_name)}</span></div>` : ''}
      </div>
      ${billTo(invoice.customer_name, tier)}
    </div>
    ${linesTable(invoice.lines, invoice.total_amount, { minRows: 8 })}
    <div class="totals"><div class="totals-box">
      <div class="calc"><span>Subtotal :</span><span>${amount(subtotal)}</span></div>
      <div class="calc"><span>Discount :</span><span>${amount(invoice.discount_amount)}</span></div>
      <div class="calc pill"><span>Total</span><span>${amount(invoice.total_amount)}</span></div>
      <div class="calc" style="margin-top:10px"><span>Prev Bal</span><span>${amount(invoice.previous_balance)}</span></div>
      <div class="calc owing"><span>Outstanding Balance:</span><span>${amount(Math.max(0, num(invoice.outstanding_balance)))}</span></div>
    </div></div>
    ${invoice.notes && String(invoice.notes).trim().toUpperCase() !== 'OPENING_BALANCE' ? `<p style="font-size:12.5px;color:#334155;margin:0 0 16px"><b>Notes:</b> ${esc(invoice.notes)}</p>` : ''}
    ${footer()}`
}

export function printInvoice(invoice, { customer = null } = {}) {
  if (!invoice) return
  openDocument(`Invoice ${invoiceNumber(invoice.id)}`, invoiceBody(invoice, { customer }))
}

/** A sale: the invoice (what was bought) first, then every receipt recorded against it. */
export function printSaleDocuments(invoice, payments = [], { customer = null } = {}) {
  if (!invoice) return
  const list = [...payments].sort((a, b) => String(a.payment_date || '').localeCompare(String(b.payment_date || '')) || num(a.id) - num(b.id))
  const today = Math.max(0, num(invoice.outstanding_balance))
  const receipts = list.map((p, i) => receiptBody(p, { invoice, customer, balanceAfter: today + list.slice(i + 1).reduce((t, q) => t + num(q.amount), 0) }))
  const title = `Invoice ${invoiceNumber(invoice.id)}${list.length ? ` + ${list.length} receipt${list.length === 1 ? '' : 's'}` : ''}`
  openDocument(title, [invoiceBody(invoice, { customer }), ...receipts])
}

/** Payment receipt in the same branded layout. */
function receiptBody(payment, { invoice = null, customer = null, balanceAfter = null } = {}) {
  const tier = invoice?.lines?.[0]?.pricing_category || customer?.pricing_category || 'Customer'
  const invoiceTotal = invoice ? num(invoice.previous_balance) + num(invoice.total_amount) : null
  const balance = balanceAfter !== null ? Math.max(0, balanceAfter) : (invoice ? Math.max(0, num(invoice.outstanding_balance)) : null)
  return `
    ${header('RECEIPT', 'PAYMENT RECEIVED')}
    <div class="meta">
      <div class="meta-left">
        <div class="meta-row"><b>Receipt Date:</b><span>${date(payment.payment_date)}</span></div>
        <div class="meta-row"><b>Receipt No.</b><span style="color:#64748b">${esc(receiptNumber(payment))}</span></div>
        <div class="meta-row"><b>For Invoice:</b><span>${esc(payment.invoice ? invoiceNumber(payment.invoice) : '—')}</span></div>
      </div>
      ${billTo(payment.customer_name || invoice?.customer_name, tier).replace('BILL TO', 'RECEIVED FROM').replace('margin:5px 0 0 68px', 'margin:5px 0 0 128px')}
    </div>
    ${invoice && (invoice.lines || []).length ? `<div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:4px 0 6px">Items bought</div>${linesTable(invoice.lines, invoice.total_amount)}<div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:14px 0 6px">Payment</div>` : ''}
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
}

export function printReceipt(payment, { invoice = null, customer = null } = {}) {
  if (!payment) return
  openDocument(`Receipt ${receiptNumber(payment)}`, receiptBody(payment, { invoice, customer }))
}

/** Every receipt recorded against one invoice, oldest first, one page each. */
export function printReceipts(payments = [], { invoice = null, customer = null } = {}) {
  const list = [...payments].sort((a, b) => String(a.payment_date || '').localeCompare(String(b.payment_date || '')) || num(a.id) - num(b.id))
  if (!list.length) return
  if (list.length === 1) {
    printReceipt(list[0], { invoice, customer })
    return
  }
  // Balance after each receipt: what is still outstanding today plus every later receipt.
  const today = invoice ? Math.max(0, num(invoice.outstanding_balance)) : null
  const bodies = list.map((p, i) => {
    const later = list.slice(i + 1).reduce((t, q) => t + num(q.amount), 0)
    return receiptBody(p, { invoice, customer, balanceAfter: today !== null ? today + later : null })
  })
  openDocument(`Receipts for ${invoice ? invoiceNumber(invoice.id) : 'invoice'} (${list.length})`, bodies)
}

/** Customer statement: every invoice and payment, with balance due. */
const STATEMENT_CSS = `
.st-brand{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:2px solid #0f172a}
.st-brand-left{display:flex;align-items:center;gap:12px}
.st-brand img{height:54px}
.st-brand .company{font-weight:800;font-size:15px}
.st-brand .muted{font-size:11.5px;color:#64748b}
.st-title{text-align:right}
.st-title h1{margin:0;font-size:20px;font-weight:800;letter-spacing:.02em}
.st-title span{font-size:11.5px;color:#64748b}
.st-card{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:18px 0 20px;padding:16px 18px;border:1px solid #e2e8f0;border-radius:10px}
.st-name{font-size:19px;font-weight:800}
.st-sub{margin-top:4px;font-size:12px;color:#64748b}
.st-sub b{color:#334155}
.st-totals{display:flex;gap:26px;text-align:right}
.st-totals span{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
.st-totals strong{display:block;margin-top:3px;font-size:18px;font-weight:800;white-space:nowrap}
.st-section{display:flex;align-items:center;gap:8px;margin:18px 0 8px;font-size:13px;font-weight:800}
.st-table{width:100%;border-collapse:collapse;font-size:12px}
.st-table th{padding:8px 10px;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b;text-align:left;white-space:nowrap}
.st-table td{padding:9px 10px;border-bottom:1px solid #eef2f6;white-space:nowrap}
.st-table .r{text-align:right}
.st-table .c{text-align:center}
.st-inv{color:#2c86b8;font-weight:700}
.st-billed{font-weight:700;color:#0f172a}
.st-paid{color:#059669;font-weight:600}
.st-due{color:#dc2626;font-weight:700}
.st-zero{color:#94a3b8}
.st-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.04em}
.st-badge.paid{background:#dcfce7;color:#15803d}
.st-badge.partial{background:#fef3c7;color:#b45309}
.st-badge.pending{background:#fee2e2;color:#b91c1c}
.st-badge.sample{background:#e0f2fe;color:#0369a1}
.st-empty{text-align:center;color:#94a3b8;padding:16px}
.st-foot{margin-top:auto;padding:14px 0 18px;font-size:11px;color:#94a3b8;text-align:center}
`

/** Customer ledger statement: who the customer is, totals, every invoice and every payment. */
export function printCustomerStatement(customer, invoices = [], payments = []) {
  if (!customer) return
  const p = getCompanyProfile()
  const logo = new URL(invoiceLogo, window.location.href).href
  const sortedInv = [...invoices].sort((a, b) => String(b.invoice_date || '').localeCompare(String(a.invoice_date || '')))
  const sortedPay = [...payments].sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || '')))
  const billedOf = i => num(i.previous_balance) + num(i.total_amount)
  const dueOf = i => Math.max(0, num(i.outstanding_balance))
  const billed = sortedInv.reduce((t, i) => t + billedOf(i), 0)
  const due = sortedInv.reduce((t, i) => t + dueOf(i), 0)
  const paid = Math.max(0, billed - due)
  const status = i => {
    if (i.is_sample_sale) return ['sample', 'SAMPLE']
    if (dueOf(i) <= 0.005) return ['paid', 'PAID']
    return billedOf(i) - dueOf(i) > 0.005 ? ['partial', 'PARTIAL'] : ['pending', 'PENDING']
  }
  const invRows = sortedInv.length
    ? sortedInv.map(i => {
      const out = dueOf(i)
      const [cls, label] = status(i)
      const notes = String(i.notes || '').trim()
      return `<tr>
        <td class="st-inv">${esc(invoiceNumber(i.id))}</td>
        <td>${date(i.invoice_date)}</td>
        <td class="r st-billed">GHS ${amount(billedOf(i))}</td>
        <td class="r st-paid">GHS ${amount(Math.max(0, billedOf(i) - out))}</td>
        <td class="r ${out > 0 ? 'st-due' : 'st-zero'}">GHS ${amount(out)}</td>
        <td class="c"><span class="st-badge ${cls}">${label}</span></td>
        <td style="white-space:normal;color:#64748b">${esc(notes || '—')}</td>
      </tr>`
    }).join('')
    : '<tr><td colspan="7" class="st-empty">No invoices recorded.</td></tr>'
  const payRows = sortedPay.length
    ? sortedPay.map(x => `<tr>
        <td>${date(x.payment_date)}</td>
        <td class="st-inv">${esc(x.invoice ? invoiceNumber(x.invoice) : '—')}</td>
        <td>${esc(METHOD_LABELS[x.method] || x.method || '—')}</td>
        <td>${esc(x.reference || '—')}</td>
        <td class="r st-paid">GHS ${amount(x.amount)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="st-empty">No payments recorded.</td></tr>'
  const tier = customer.pricing_category_name || customer.pricing_category
  const facts = [
    customer.customer_category_name ? `Category: <b>${esc(customer.customer_category_name)}</b>` : '',
    tier && typeof tier === 'string' ? `Pricing Tier: <b>${esc(tier)}</b>` : '',
    `Phone: <b>${esc(customer.phone || 'N/A')}</b>`,
  ].filter(Boolean).join(' · ')
  const body = `<style>${STATEMENT_CSS}</style>
    <div class="st-brand">
      <div class="st-brand-left">
        <img src="${esc(logo)}" alt="Plus Yoghurt" />
        <div><div class="company">${esc(p.name)}</div><div class="muted">${esc(p.phone)} · ${esc(p.email)}</div></div>
      </div>
      <div class="st-title"><h1>Customer Ledger Statement</h1><span>Generated ${date(new Date().toISOString().slice(0, 10))}</span></div>
    </div>
    <div class="st-card">
      <div><div class="st-name">${esc(customer.name)}</div><div class="st-sub">${facts}</div></div>
      <div class="st-totals">
        <div><span>Lifetime billed</span><strong>GHS ${amount(billed)}</strong></div>
        <div><span>Total paid</span><strong style="color:#059669">GHS ${amount(paid)}</strong></div>
        <div><span>Current balance due</span><strong style="color:${due > 0 ? '#dc2626' : '#059669'}">GHS ${amount(due)}</strong></div>
      </div>
    </div>
    <div class="st-section">Invoices &amp; Orders Ledger</div>
    <table class="st-table">
      <thead><tr><th>Invoice #</th><th>Date</th><th class="r">Total billed</th><th class="r">Paid</th><th class="r">Balance due</th><th class="c">Status</th><th>Notes</th></tr></thead>
      <tbody>${invRows}</tbody>
    </table>
    <div class="st-section">Recorded Customer Receipts &amp; Payments</div>
    <table class="st-table">
      <thead><tr><th>Payment date</th><th>Invoice ref</th><th>Method</th><th>Reference #</th><th class="r">Amount paid</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>
    <div class="st-foot">${esc(p.name)} · Customer statement for ${esc(customer.name)}</div>`
  openDocument(`Statement — ${customer.name}`, body, { plain: true })
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
