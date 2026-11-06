// Report definitions for the Reports Center (ported from PlusYoghurt-App's
// report_generator.py), computed in the browser from data the app already
// loads. Income statement & balance sheet come from the backend trial balance.
import { WALLETS, buildTreasury, walletLabel } from './treasury'

const METHOD_LABELS = { cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', ghanapay: 'GhanaPay', other: 'Other' }
const DAY_MS = 86400000

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v)) }
function qty(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num(v)) }
function pct(v) { return `${num(v).toFixed(1)}%` }
function d(raw) { return String(raw || '').slice(0, 10) }
function inRange(raw, f) {
  const x = d(raw)
  if (!f?.start && !f?.end) return true
  if (!x) return false
  if (f.start && x < f.start) return false
  if (f.end && x > f.end) return false
  return true
}
function dayIndex(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS) : NaN
}
function todayIdx() { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS) }
function invNo(id) { return `INV-${String(id ?? '').padStart(4, '0')}` }
function mlOf(text) {
  const t = String(text || '').toLowerCase().replaceAll(',', '')
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (ml) return num(ml[1])
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/)
  return l ? num(l[1]) * 1000 : 0
}
function invoiceState(inv) {
  if (inv.is_sample_sale) return 'Sample'
  const out = num(inv.outstanding_balance)
  const total = num(inv.total_amount)
  const paid = Math.max(0, num(inv.previous_balance) + total - out)
  if (out < 0) return 'Overpaid'
  if (out === 0 && total > 0) return 'Paid'
  if (out > 0 && paid > 0) return 'Partially paid'
  return 'Unpaid'
}
function outputCostBySize(batches) {
  const agg = new Map()
  batches.forEach(b => (b.outputs || []).forEach(o => {
    const k = mlOf(o.product_size)
    const q = num(o.quantity)
    if (!k || q <= 0) return
    const c = agg.get(k) || { q: 0, a: 0 }
    c.q += q
    c.a += num(o.amount) || q * num(o.unit_cost)
    agg.set(k, c)
  }))
  return k => { const c = agg.get(k); return c && c.q > 0 ? c.a / c.q : 0 }
}
function tbMovement(row) { return num(row.acct_in) - num(row.acct_out) }

export const REPORT_CATEGORIES = ['Financial', 'Sales', 'Production', 'Inventory', 'Treasury']

export const REPORTS = [
  {
    key: 'income_statement',
    title: 'Income statement (P&L)',
    category: 'Financial',
    description: 'Income, direct costs, gross profit, expenses and net profit, from the trial balance.',
    usesDates: false,
    build(ctx) {
      const rows = (ctx.trialBalanceRows || []).filter(r => r.account_type === 'Income Statement')
      const groups = ['Income', 'Direct Cost', 'Expenses']
      const out = []
      const totals = {}
      groups.forEach(g => {
        const items = rows.filter(r => r.account_class === g)
        if (!items.length) return
        out.push({ section: g })
        items.forEach(r => out.push([r.account_id || '', r.description || r.sub_accounts || '', money(tbMovement(r))]))
        totals[g] = items.reduce((t, r) => t + tbMovement(r), 0)
        out.push({ subtotal: [`Total ${g.toLowerCase()}`, '', money(totals[g])] })
      })
      const gross = (totals.Income || 0) + (totals['Direct Cost'] || 0)
      const net = gross + (totals.Expenses || 0)
      return {
        columns: ['Account', 'Description', 'Amount (GHS)'],
        rows: out,
        totals: [['Gross profit / loss', '', money(gross)], ['Net profit / loss', '', money(net)]],
        note: rows.length ? 'Movements for the trial balance period. Costs and expenses show as negative amounts.' : 'Trial balance not loaded yet — open the Trial Balance tab first.',
      }
    },
  },
  {
    key: 'balance_sheet',
    title: 'Balance sheet',
    category: 'Financial',
    description: 'Assets, liabilities and equity balances from the trial balance.',
    usesDates: false,
    build(ctx) {
      const rows = (ctx.trialBalanceRows || []).filter(r => r.account_type === 'Balance Sheet')
      const classes = [...new Set(rows.map(r => r.account_class || 'Other'))]
      const out = []
      const sums = {}
      classes.forEach(c => {
        const items = rows.filter(r => (r.account_class || 'Other') === c)
        out.push({ section: c })
        items.forEach(r => out.push([r.account_id || '', r.description || r.sub_accounts || '', money(r.available)]))
        sums[c] = items.reduce((t, r) => t + num(r.available), 0)
        out.push({ subtotal: [`Total ${c.toLowerCase()}`, '', money(sums[c])] })
      })
      return {
        columns: ['Account', 'Description', 'Balance (GHS)'],
        rows: out,
        totals: [],
        note: rows.length ? 'Closing balances (opening + in − out) from the trial balance.' : 'Trial balance not loaded yet — open the Trial Balance tab first.',
      }
    },
  },
  {
    key: 'sales_summary',
    title: 'Sales summary',
    category: 'Sales',
    description: 'Revenue, bottles, litres and gross margin by bottle size.',
    usesDates: true,
    build(ctx, f) {
      const cost = outputCostBySize(ctx.productionBatches)
      const by = new Map()
      ctx.invoices.filter(i => !i.is_sample_sale && inRange(i.invoice_date, f)).forEach(inv => (inv.lines || []).forEach(l => {
        const k = mlOf(l.product_size) || l.product_size
        const r = by.get(k) || { size: l.product_size || '—', ml: mlOf(l.product_size), qty: 0, rev: 0, cogs: 0, lines: 0 }
        r.qty += num(l.quantity)
        r.rev += num(l.line_total)
        r.cogs += num(l.quantity) * cost(mlOf(l.product_size))
        r.lines += 1
        by.set(k, r)
      }))
      const list = [...by.values()].sort((a, b) => b.rev - a.rev)
      const t = list.reduce((a, r) => ({ qty: a.qty + r.qty, rev: a.rev + r.rev, cogs: a.cogs + r.cogs, litres: a.litres + (r.qty * r.ml) / 1000 }), { qty: 0, rev: 0, cogs: 0, litres: 0 })
      return {
        columns: ['Size', 'Lines', 'Bottles', 'Litres', 'Revenue', 'Production cost', 'Gross margin', 'Margin %'],
        rows: list.map(r => [r.size, r.lines, qty(r.qty), qty((r.qty * r.ml) / 1000), money(r.rev), money(r.cogs), money(r.rev - r.cogs), pct(r.rev ? ((r.rev - r.cogs) / r.rev) * 100 : 0)]),
        totals: [['Total', '', qty(t.qty), qty(t.litres), money(t.rev), money(t.cogs), money(t.rev - t.cogs), pct(t.rev ? ((t.rev - t.cogs) / t.rev) * 100 : 0)]],
        note: 'Line totals before invoice discounts; sample invoices excluded. Cost uses the average production cost per bottle size.',
      }
    },
  },
  {
    key: 'ar_aging',
    title: 'Receivables ageing',
    category: 'Sales',
    description: 'Open customer balances split into 0–30, 31–60, 61–90 and 90+ days.',
    usesDates: false,
    build(ctx) {
      const today = todayIdx()
      const by = new Map()
      ctx.invoices.forEach(inv => {
        const due = Math.max(0, num(inv.outstanding_balance))
        if (!due) return
        const age = Math.max(0, today - (Number.isFinite(dayIndex(inv.invoice_date)) ? dayIndex(inv.invoice_date) : today))
        const key = String(inv.customer ?? inv.customer_name)
        const r = by.get(key) || { name: inv.customer_name || 'Customer', a: 0, b: 0, c: 0, e: 0, n: 0 }
        if (age <= 30) r.a += due; else if (age <= 60) r.b += due; else if (age <= 90) r.c += due; else r.e += due
        r.n += 1
        by.set(key, r)
      })
      const list = [...by.values()].map(r => ({ ...r, t: r.a + r.b + r.c + r.e })).sort((x, y) => y.t - x.t)
      const s = list.reduce((acc, r) => ({ a: acc.a + r.a, b: acc.b + r.b, c: acc.c + r.c, e: acc.e + r.e, t: acc.t + r.t, n: acc.n + r.n }), { a: 0, b: 0, c: 0, e: 0, t: 0, n: 0 })
      return {
        columns: ['Customer', 'Open invoices', '0–30 days', '31–60 days', '61–90 days', '90+ days', 'Total due'],
        rows: list.map(r => [r.name, r.n, money(r.a), money(r.b), money(r.c), money(r.e), money(r.t)]),
        totals: [['Total', s.n, money(s.a), money(s.b), money(s.c), money(s.e), money(s.t)]],
        note: 'As of today, across all open invoices.',
      }
    },
  },
  {
    key: 'invoices_register',
    title: 'Invoice register',
    category: 'Sales',
    description: 'Every invoice with billed, paid, outstanding and status.',
    usesDates: true,
    usesStatus: true,
    build(ctx, f) {
      const list = ctx.invoices
        .filter(i => inRange(i.invoice_date, f))
        .filter(i => !f?.status || invoiceState(i) === f.status)
        .sort((a, b) => d(a.invoice_date).localeCompare(d(b.invoice_date)) || num(a.id) - num(b.id))
      const t = list.reduce((acc, i) => {
        const total = num(i.previous_balance) + num(i.total_amount)
        const out = Math.max(0, num(i.outstanding_balance))
        return { total: acc.total + total, paid: acc.paid + Math.max(0, total - num(i.outstanding_balance)), out: acc.out + out }
      }, { total: 0, paid: 0, out: 0 })
      return {
        columns: ['Date', 'Invoice', 'Customer', 'Status', 'Discount', 'Billed', 'Paid', 'Outstanding'],
        rows: list.map(i => {
          const total = num(i.previous_balance) + num(i.total_amount)
          return [d(i.invoice_date), invNo(i.id), i.customer_name || '—', invoiceState(i), money(i.discount_amount), money(total), money(Math.max(0, total - num(i.outstanding_balance))), money(Math.max(0, num(i.outstanding_balance)))]
        }),
        totals: [['Total', `${list.length} invoices`, '', '', '', money(t.total), money(t.paid), money(t.out)]],
      }
    },
  },
  {
    key: 'batch_samples',
    title: 'Samples issued',
    category: 'Sales',
    description: 'Tasting and promotional samples: bottles given out and their value.',
    usesDates: true,
    build(ctx, f) {
      const cost = outputCostBySize(ctx.productionBatches)
      const rows = []
      let bottles = 0
      let value = 0
      let costTotal = 0
      ctx.invoices.filter(i => i.is_sample_sale && inRange(i.invoice_date, f)).forEach(inv => (inv.lines || []).forEach(l => {
        const c = num(l.quantity) * cost(mlOf(l.product_size))
        bottles += num(l.quantity)
        value += num(l.line_total)
        costTotal += c
        rows.push([d(inv.invoice_date), invNo(inv.id), inv.customer_name || '—', l.product_size || '—', qty(l.quantity), money(l.line_total), money(c)])
      }))
      return {
        columns: ['Date', 'Invoice', 'Customer', 'Size', 'Bottles', 'Sales value', 'Production cost'],
        rows,
        totals: [['Total', '', '', '', qty(bottles), money(value), money(costTotal)]],
      }
    },
  },
  {
    key: 'production_efficiency',
    title: 'Production efficiency',
    category: 'Production',
    description: 'Each batch: litres, output value, total cost, surplus and margin.',
    usesDates: true,
    build(ctx, f) {
      const list = ctx.productionBatches.filter(b => inRange(b.production_date, f)).sort((a, b) => d(a.production_date).localeCompare(d(b.production_date)))
      const rows = list.map(b => {
        const litres = (b.outputs || []).reduce((t, o) => t + (mlOf(o.product_size) * num(o.quantity)) / 1000, 0)
        const bottles = (b.outputs || []).reduce((t, o) => t + num(o.quantity), 0)
        const value = num(b.total_production_value)
        const profit = num(b.profit)
        return { b, litres, bottles, value, cost: num(b.total_cost), profit }
      })
      const t = rows.reduce((a, r) => ({ litres: a.litres + r.litres, bottles: a.bottles + r.bottles, value: a.value + r.value, cost: a.cost + r.cost, profit: a.profit + r.profit }), { litres: 0, bottles: 0, value: 0, cost: 0, profit: 0 })
      return {
        columns: ['Date', 'Batch', 'Type', 'Bottles', 'Litres', 'Output value', 'Total cost', 'Surplus', 'Margin %', 'Cost / litre'],
        rows: rows.map(r => [d(r.b.production_date), r.b.batch_number || `#${r.b.id}`, r.b.batch_type === 'development' ? 'Development' : 'Production', qty(r.bottles), qty(r.litres), money(r.value), money(r.cost), money(r.profit), pct(r.value ? (r.profit / r.value) * 100 : 0), money(r.litres ? r.cost / r.litres : 0)]),
        totals: [['Total', `${rows.length} batches`, '', qty(t.bottles), qty(t.litres), money(t.value), money(t.cost), money(t.profit), pct(t.value ? (t.profit / t.value) * 100 : 0), money(t.litres ? t.cost / t.litres : 0)]],
      }
    },
  },
  {
    key: 'batch_overheads',
    title: 'Batch overheads',
    category: 'Production',
    description: 'Raw material, electricity, gas and wages cost for every batch.',
    usesDates: true,
    build(ctx, f) {
      const list = ctx.productionBatches.filter(b => inRange(b.production_date, f)).sort((a, b) => d(a.production_date).localeCompare(d(b.production_date)))
      const t = { rm: 0, el: 0, gas: 0, wg: 0, tot: 0 }
      const rows = list.map(b => {
        const rm = num(b.total_raw_material_cost)
        const el = num(b.electricity_cost)
        const gas = num(b.gas_cost)
        const wg = num(b.production_wages)
        t.rm += rm; t.el += el; t.gas += gas; t.wg += wg; t.tot += num(b.total_cost)
        return [d(b.production_date), b.batch_number || `#${b.id}`, money(rm), money(el), money(gas), money(wg), money(el + gas + wg), money(b.total_cost)]
      })
      return {
        columns: ['Date', 'Batch', 'Raw materials', 'Electricity', 'Gas', 'Wages', 'Total overheads', 'Total cost'],
        rows,
        totals: [['Total', `${rows.length} batches`, money(t.rm), money(t.el), money(t.gas), money(t.wg), money(t.el + t.gas + t.wg), money(t.tot)]],
      }
    },
  },
  {
    key: 'inventory_valuation',
    title: 'Inventory valuation',
    category: 'Inventory',
    description: 'Finished goods and raw materials on hand, with their value.',
    usesDates: false,
    build(ctx) {
      const cost = outputCostBySize(ctx.productionBatches)
      const out = [{ section: 'Finished goods' }]
      let fg = 0
      ;[...ctx.inventoryLedger].sort((a, b) => mlOf(a.size) - mlOf(b.size)).forEach(i => {
        const unit = cost(mlOf(i.size))
        const v = Math.max(0, num(i.available)) * unit
        fg += v
        out.push([i.size, 'Bottles', qty(i.available), money(unit), money(v)])
      })
      out.push({ subtotal: ['Finished goods total', '', '', '', money(fg)] })
      out.push({ section: 'Raw materials' })
      let rm = 0
      ;[...ctx.rawMaterials].sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name).localeCompare(String(b.name))).forEach(m => {
        const avail = num(m.available ?? (num(m.opening_stock) + num(m.stock_in) - num(m.stock_out)))
        const v = Math.max(0, avail) * num(m.unit_price)
        rm += v
        out.push([m.name, m.unit || m.category || '', qty(avail), money(m.unit_price), money(v)])
      })
      out.push({ subtotal: ['Raw materials total', '', '', '', money(rm)] })
      return {
        columns: ['Item', 'Unit', 'On hand', 'Unit cost', 'Value'],
        rows: out,
        totals: [['Total inventory value', '', '', '', money(fg + rm)]],
        note: 'Finished goods valued at average production cost per bottle size; raw materials at their unit price.',
      }
    },
  },
  {
    key: 'operating_expenses',
    title: 'Operating expenses',
    category: 'Financial',
    description: 'Expense entries grouped by category, with their share of the total.',
    usesDates: true,
    build(ctx, f) {
      const list = ctx.accountTransactions.filter(t => String(t.entry_type).toLowerCase() === 'expense' && inRange(t.transaction_date, f))
      const by = new Map()
      list.forEach(t => { const r = by.get(t.category || 'Uncategorised') || { n: 0, a: 0 }; r.n += 1; r.a += num(t.amount); by.set(t.category || 'Uncategorised', r) })
      const total = list.reduce((a, t) => a + num(t.amount), 0)
      const rows = [...by.entries()].sort((a, b) => b[1].a - a[1].a).map(([c, r]) => [c, r.n, money(r.a), pct(total ? (r.a / total) * 100 : 0)])
      return { columns: ['Category', 'Entries', 'Amount', 'Share'], rows, totals: [['Total', list.length, money(total), pct(total ? 100 : 0)]] }
    },
  },
  {
    key: 'cash_flow',
    title: 'Cash flow by wallet',
    category: 'Treasury',
    description: 'Money in and out of every wallet, and closing balances.',
    usesDates: true,
    usesWallet: true,
    build(ctx, f) {
      const treasury = buildTreasury(ctx.treasuryInput, f?.start || f?.end ? f : null)
      const wallets = treasury.wallets.filter(w => !f?.wallet || w.key === f.wallet)
      if (f?.wallet) {
        const w = wallets[0]
        const rows = w.statement.filter(r => inRange(r.date, f)).slice().reverse().map(r => [d(r.date), r.type, r.detail || '—', r.inflow ? money(r.inflow) : '', r.outflow ? money(r.outflow) : '', money(r.balance)])
        return { columns: ['Date', 'Type', 'Details', 'In', 'Out', 'Balance'], rows, totals: [['Total', '', '', money(w.periodIn), money(w.periodOut), money(w.balance)]], note: `${walletLabel(w.key)} statement.` }
      }
      const t = wallets.reduce((a, w) => ({ i: a.i + w.periodIn, o: a.o + w.periodOut, b: a.b + w.balance }), { i: 0, o: 0, b: 0 })
      return {
        columns: ['Wallet', 'Money in', 'Money out', 'Net flow', 'Balance today'],
        rows: wallets.map(w => [w.label, money(w.periodIn), money(w.periodOut), money(w.periodIn - w.periodOut), money(w.balance)]),
        totals: [['Total', money(t.i), money(t.o), money(t.i - t.o), money(t.b)]],
        note: 'Uses the same wallet rules as the trial balance.',
      }
    },
  },
]

export const REPORT_STATUS_OPTIONS = ['Paid', 'Partially paid', 'Unpaid', 'Overpaid', 'Sample']
export const REPORT_WALLET_OPTIONS = WALLETS
export { METHOD_LABELS }
