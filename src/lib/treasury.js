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
const RECEIPT_METHOD_TO_WALLET = { cash: 'Cash', momo: 'MoMo Wallet', bank_transfer: 'CalBank' }

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
