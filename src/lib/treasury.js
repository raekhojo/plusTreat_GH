// Wallet (cash & bank) balances, computed with exactly the same rules as the
// backend trial balance (plus_treat/operations/trial_balance.py →
// _account_ledger_parts) so the Treasury view always agrees with Reporting:
//
//   money in  = transfers whose category is the wallet
//             + income entries paid into the wallet (payment_method)
//             + customer payments whose method maps to the wallet
//   money out = transfers whose payment_method is the wallet
//             + expense entries paid from the wallet (payment_method)
//             + supplier (purchase) payments whose payment_method is the wallet
//
// A transfer is ONE account transaction (entry_type "transfers"):
//   payment_method = wallet the money leaves, category = wallet it lands in.

export const WALLETS = [
  { key: 'Cash', label: 'Cash' },
  { key: 'MoMo Wallet', label: 'MoMo Wallet' },
  { key: 'CalBank', label: 'Cal Bank' },
  { key: 'GhanaPay', label: 'GhanaPay' },
]

// Customer payments store a method code; the backend maps them to wallets.
// ('other' is not mapped to any wallet, matching the backend.)
const RECEIPT_METHOD_TO_WALLET = { cash: 'Cash', momo: 'MoMo Wallet', bank_transfer: 'CalBank', ghanapay: 'GhanaPay' }

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function same(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() }
function inRange(raw, range) {
  if (!range?.start && !range?.end) return true
  const d = String(raw || '').slice(0, 10)
  if (!d) return false
  if (range.start && d < range.start) return false
  if (range.end && d > range.end) return false
  return true
}

export function walletLabel(key) {
  return WALLETS.find(w => same(w.key, key))?.label || key
}

export function isWallet(name) {
  return WALLETS.some(w => same(w.key, name))
}

/**
 * Ledger for any trial-balance account fed by account transactions
 * (e.g. "Other Receivables"), using the same in/out rules as the backend.
 * For a receivable, "in" raises the amount owed to us, "out" is a repayment.
 */
export function buildAccountLedger(accountName, accountTransactions = []) {
  const rows = []
  accountTransactions.forEach(t => {
    const amount = num(t.amount)
    const type = String(t.entry_type || '').toLowerCase()
    const base = { id: t.id, date: t.transaction_date, reference: t.transaction_id || '', description: t.description || '', comments: t.comments || '' }
    if (type === 'transfers' && same(t.category, accountName)) rows.push({ ...base, kind: 'in', counterpart: t.payment_method, inflow: amount, outflow: 0 })
    else if (type === 'transfers' && same(t.payment_method, accountName)) rows.push({ ...base, kind: 'out', counterpart: t.category, inflow: 0, outflow: amount })
    else if (type === 'income' && same(t.payment_method, accountName)) rows.push({ ...base, kind: 'in', counterpart: t.category, inflow: amount, outflow: 0 })
    else if (type === 'expense' && same(t.payment_method, accountName)) rows.push({ ...base, kind: 'out', counterpart: t.category, inflow: 0, outflow: amount })
  })
  rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || num(a.id) - num(b.id))
  let running = 0
  const statement = rows.map(r => { running += r.inflow - r.outflow; return { ...r, balance: running } }).reverse()
  return {
    balance: running,
    totalIn: rows.reduce((t, r) => t + r.inflow, 0),
    totalOut: rows.reduce((t, r) => t + r.outflow, 0),
    statement,
  }
}

/**
 * Builds every wallet's statement and balance.
 * `range` ({ start, end } as YYYY-MM-DD) only scopes the period in/out figures;
 * balances are always as of today (all recorded movements).
 */
export function buildTreasury({ payments = [], accountTransactions = [], purchasePayments = [] }, range = null) {
  const entriesByWallet = new Map(WALLETS.map(w => [w.key, []]))
  const push = (walletName, entry) => {
    const wallet = WALLETS.find(w => same(w.key, walletName))
    if (wallet) entriesByWallet.get(wallet.key).push(entry)
  }

  payments.forEach(p => {
    const wallet = RECEIPT_METHOD_TO_WALLET[String(p.method || '').toLowerCase()]
    if (!wallet) return
    push(wallet, {
      id: `pay-${p.id}`,
      date: p.payment_date,
      type: 'Customer receipt',
      detail: [p.customer_name, p.invoice ? `Invoice #${p.invoice}` : ''].filter(Boolean).join(' · ') || 'Customer payment',
      reference: p.reference || '',
      inflow: num(p.amount),
      outflow: 0,
    })
  })

  accountTransactions.forEach(t => {
    const amount = num(t.amount)
    const type = String(t.entry_type || '').toLowerCase()
    const base = { date: t.transaction_date, reference: t.transaction_id || '', sourceId: t.id }
    if (type === 'transfers') {
      push(t.category, { ...base, id: `tr-in-${t.id}`, type: 'Transfer in', detail: `From ${walletLabel(t.payment_method)}${t.description ? ` · ${t.description}` : ''}`, inflow: amount, outflow: 0, counterpart: t.payment_method })
      push(t.payment_method, { ...base, id: `tr-out-${t.id}`, type: 'Transfer out', detail: `To ${walletLabel(t.category)}${t.description ? ` · ${t.description}` : ''}`, inflow: 0, outflow: amount, counterpart: t.category })
    } else if (type === 'income') {
      push(t.payment_method, { ...base, id: `inc-${t.id}`, type: 'Income', detail: [t.category, t.description].filter(Boolean).join(' · '), inflow: amount, outflow: 0 })
    } else if (type === 'expense') {
      push(t.payment_method, { ...base, id: `exp-${t.id}`, type: 'Expense', detail: [t.category, t.description].filter(Boolean).join(' · '), inflow: 0, outflow: amount })
    }
  })

  purchasePayments.forEach(pp => {
    push(pp.payment_method, {
      id: `pp-${pp.id}`,
      date: pp.payment_date,
      type: 'Supplier payment',
      detail: [pp.supplier_name, pp.purchase ? `Purchase #${pp.purchase}` : '', pp.notes].filter(Boolean).join(' · ') || 'Supplier payment',
      reference: '',
      inflow: 0,
      outflow: num(pp.amount),
    })
  })

  const wallets = WALLETS.map(w => {
    const rows = entriesByWallet.get(w.key)
      .slice()
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)))
    let running = 0
    const statement = rows.map(r => { running += r.inflow - r.outflow; return { ...r, balance: running } }).reverse()
    const inPeriod = rows.filter(r => inRange(r.date, range))
    return {
      key: w.key,
      label: w.label,
      balance: running,
      periodIn: inPeriod.reduce((t, r) => t + r.inflow, 0),
      periodOut: inPeriod.reduce((t, r) => t + r.outflow, 0),
      count: rows.length,
      statement,
    }
  })

  const transfers = accountTransactions
    .filter(t => String(t.entry_type || '').toLowerCase() === 'transfers' && (isWallet(t.category) || isWallet(t.payment_method)))
    .filter(t => inRange(t.transaction_date, range))
    .sort((a, b) => String(b.transaction_date || '').localeCompare(String(a.transaction_date || '')) || num(b.id) - num(a.id))

  return {
    wallets,
    total: wallets.reduce((t, w) => t + w.balance, 0),
    transfers,
  }
}

// Cashbook: every money movement in one list (receipts, expenses, supplier
// payments, transfers, other income), newest first. `kind` says which record
// it came from so the page can open the right edit form.
export const CASHBOOK_TYPES = [
  { key: 'receipt', label: 'Receipts' },
  { key: 'expense', label: 'Operating Expenses' },
  { key: 'supplier', label: 'Supplier Payments' },
  { key: 'transfer', label: 'Account Transfers' },
  { key: 'income', label: 'Other Income' },
]
const RECEIPT_METHOD_LABELS = { cash: 'Cash', momo: 'MoMo Wallet', bank_transfer: 'Cal Bank', ghanapay: 'GhanaPay', other: 'Other' }

export function buildCashbook({ payments = [], accountTransactions = [], purchasePayments = [] }) {
  const rows = []
  payments.forEach(p => {
    const amount = num(p.amount)
    const method = String(p.method || '').toLowerCase()
    rows.push({
      id: `pay-${p.id}`, kind: 'receipt', source: p, date: p.payment_date,
      reference: p.reference || `RCPT-${String(p.receipt_id || p.id).padStart(4, '0')}`,
      type: 'Receipt', counterparty: p.customer_name || '—', category: 'Sales Receipt',
      walletKey: RECEIPT_METHOD_TO_WALLET[method] || '', wallet: RECEIPT_METHOD_LABELS[method] || p.method || '—',
      inflow: amount, outflow: 0,
      description: p.notes || (p.invoice ? `Payment for INV-${String(p.invoice).padStart(4, '0')}` : 'Customer payment'),
    })
  })
  accountTransactions.forEach(t => {
    const amount = num(t.amount)
    const type = String(t.entry_type || '').toLowerCase()
    const base = { id: `acc-${t.id}`, source: t, date: t.transaction_date, reference: t.transaction_id || `#${t.id}`, description: t.description || '' }
    if (type === 'transfers') {
      const fromWallet = isWallet(t.payment_method)
      const toWallet = isWallet(t.category)
      rows.push({
        ...base, kind: 'transfer', type: 'Transfer',
        counterparty: `${walletLabel(t.payment_method) || '—'} → ${walletLabel(t.category) || '—'}`,
        category: 'Account Transfer',
        walletKey: fromWallet ? WALLETS.find(w => same(w.key, t.payment_method)).key : '',
        walletToKey: toWallet ? WALLETS.find(w => same(w.key, t.category)).key : '',
        wallet: `${walletLabel(t.payment_method) || '—'} → ${walletLabel(t.category) || '—'}`,
        inflow: toWallet ? amount : 0, outflow: fromWallet ? amount : 0,
      })
    } else if (type === 'income' || type === 'expense') {
      const wallet = WALLETS.find(w => same(w.key, t.payment_method))
      rows.push({
        ...base, kind: type, type: type === 'income' ? 'Income' : 'Expense',
        counterparty: t.comments || '—',
        category: t.category || '—',
        walletKey: wallet?.key || '', wallet: wallet ? wallet.label : (t.payment_method || '—'),
        inflow: type === 'income' ? amount : 0, outflow: type === 'expense' ? amount : 0,
      })
    }
  })
  purchasePayments.forEach(pp => {
    const wallet = WALLETS.find(w => same(w.key, pp.payment_method))
    rows.push({
      id: `pp-${pp.id}`, kind: 'supplier', source: pp, date: pp.payment_date,
      reference: pp.purchase ? `PUR-${String(pp.purchase).padStart(4, '0')}` : `#${pp.id}`,
      type: 'Supplier Payment', counterparty: pp.supplier_name || '—', category: pp.purchase_category || 'Supplier Payment',
      walletKey: wallet?.key || '', wallet: wallet ? wallet.label : (pp.payment_method || '—'),
      inflow: 0, outflow: num(pp.amount),
      description: pp.notes || (pp.purchase ? `Payment for purchase #${pp.purchase}` : 'Supplier payment'),
    })
  })
  rows.forEach(r => { r.net = r.inflow - r.outflow })
  rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }))
  return rows
}
