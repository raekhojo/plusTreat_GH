import { useState } from 'react'
import { DEFAULT_COMPANY_PROFILE, getCompanyProfile, printInvoice, saveCompanyProfile } from '../../lib/printDocuments'
import './Settings.css'

const SAMPLE_INVOICE = {
  id: 1,
  invoice_date: new Date().toISOString().slice(0, 10),
  customer_name: 'Sample Customer',
  staff_name: 'Preview',
  subtotal: 450,
  discount_amount: 0,
  total_amount: 450,
  previous_balance: 0,
  outstanding_balance: 450,
  lines: [
    { product_size: '500ml', pricing_category: 'Wholesale Price', unit_price: 20, quantity: 15, line_total: 300 },
    { product_size: '350ml', pricing_category: 'Wholesale Price', unit_price: 15, quantity: 10, line_total: 150 },
  ],
}

const toText = lines => (lines || []).join('\n')
const toLines = text => String(text || '').split('\n').map(l => l.trim()).filter(Boolean)

function DocumentSettings() {
  const [form, setForm] = useState(() => {
    const p = getCompanyProfile()
    return { name: p.name, phone: p.phone, email: p.email, social: p.social, momo: toText(p.momo.lines), bank: toText(p.bank.lines), thankYou: p.thankYou }
  })
  const [message, setMessage] = useState('')
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const buildProfile = () => ({
    ...DEFAULT_COMPANY_PROFILE,
    name: form.name.trim() || DEFAULT_COMPANY_PROFILE.name,
    phone: form.phone.trim(),
    email: form.email.trim(),
    social: form.social.trim(),
    momo: { ...DEFAULT_COMPANY_PROFILE.momo, lines: toLines(form.momo) },
    bank: { ...DEFAULT_COMPANY_PROFILE.bank, lines: toLines(form.bank) },
    thankYou: form.thankYou.trim() || DEFAULT_COMPANY_PROFILE.thankYou,
  })
  const save = e => {
    e.preventDefault()
    saveCompanyProfile(buildProfile())
    setMessage('Saved. New invoices, receipts, statements and reports will use these details.')
  }
  const reset = () => {
    saveCompanyProfile(null)
    const p = DEFAULT_COMPANY_PROFILE
    setForm({ name: p.name, phone: p.phone, email: p.email, social: p.social, momo: toText(p.momo.lines), bank: toText(p.bank.lines), thankYou: p.thankYou })
    setMessage('Restored the default details.')
  }
  const preview = () => {
    saveCompanyProfile(buildProfile())
    printInvoice(SAMPLE_INVOICE)
  }

  return (
    <article className="st-card">
      <header className="st-head">
        <div>
          <h2>Document details</h2>
          <p>Printed on every invoice, receipt, customer statement and report. Saved in this browser.</p>
        </div>
        <button type="button" className="ro-btn" onClick={preview}>Preview invoice</button>
      </header>
      <form className="st-form" onSubmit={save}>
        <label><span>Company name</span><input value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <label><span>Phone</span><input value={form.phone} onChange={e => set('phone', e.target.value)} /></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
        <label><span>Social handle</span><input value={form.social} onChange={e => set('social', e.target.value)} /></label>
        <label className="st-wide"><span>Mobile Money details (one per line)</span><textarea rows={4} value={form.momo} onChange={e => set('momo', e.target.value)} /></label>
        <label className="st-wide"><span>Bank transfer details (one per line)</span><textarea rows={4} value={form.bank} onChange={e => set('bank', e.target.value)} /></label>
        <label className="st-full"><span>Footer banner</span><input value={form.thankYou} onChange={e => set('thankYou', e.target.value)} /></label>
        <div className="st-actions st-full">
          <button type="submit" className="rc-btn rc-btn-primary">Save details</button>
          <button type="button" className="rc-btn" onClick={reset}>Restore defaults</button>
          {message ? <span className="st-message" role="status">{message}</span> : null}
        </div>
      </form>
    </article>
  )
}

export default DocumentSettings
