// Business Copilot: answers questions about the business from live app data,
// ported from PlusYoghurt-App's offline "semantic analyzer". It matches the
// question to a topic by keywords and computes every figure from real records
// in the browser — no external AI service is called and nothing is invented.
import { RECIPE, STANDARD_VOLUME, matchRecipeMaterial } from './recipe'

const DAY_MS = 86400000
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function ghs(v) { return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}` }
function count(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num(v)) }
function pct(v) { return `${num(v).toFixed(1)}%` }
function dayIndex(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS) : NaN
}
function todayIdx() { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS) }
function fmtDay(idx) { return Number.isFinite(idx) ? new Date(idx * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—' }
function mlOf(text) {
  const t = String(text || '').toLowerCase().replaceAll(',', '')
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (ml) return num(ml[1])
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/)
  return l ? num(l[1]) * 1000 : 0
}

export const SUGGESTED_PROMPTS = [
  'Give me today’s business briefing',
  'Who owes us the most money?',
  'What is our cash position?',
  'What stock needs attention?',
  'How many batches can we produce with current stock?',
  'How are sales doing this month?',
]

/** Pre-computes everything the Copilot can talk about. */
export function buildCopilotContext({ invoices = [], customers = [], treasury = null, inventoryLedger = [], rawMaterials = [], productionBatches = [], trialBalanceRows = [] }) {
  const today = todayIdx()
  const custById = new Map(customers.map(c => [String(c.id), c]))
  const orders = invoices.filter(i => !i.is_sample_sale && num(i.total_amount) > 0)

  const debtorMap = new Map()
  invoices.forEach(inv => {
    const due = Math.max(0, num(inv.outstanding_balance))
    if (!due) return
    const key = String(inv.customer ?? inv.customer_name)
    const d = debtorMap.get(key) || { name: inv.customer_name || 'Customer', phone: custById.get(String(inv.customer))?.phone || '', due: 0, invoices: 0, oldest: today }
    d.due += due
    d.invoices += 1
    const day = dayIndex(inv.invoice_date)
    if (Number.isFinite(day)) d.oldest = Math.min(d.oldest, day)
    debtorMap.set(key, d)
  })
  const debtors = [...debtorMap.values()].map(d => ({ ...d, age: today - d.oldest })).sort((a, b) => b.due - a.due)
  const totalAr = debtors.reduce((t, d) => t + d.due, 0)

  const salesIn = (from, to) => orders.filter(o => { const d = dayIndex(o.invoice_date); return d >= from && d <= to })
  const last30 = salesIn(today - 29, today)
  const prev30 = salesIn(today - 59, today - 30)
  const last90 = salesIn(today - 89, today)
  const sum = list => list.reduce((t, o) => t + num(o.total_amount), 0)

  const custRevenue = new Map()
  last90.forEach(o => { const k = o.customer_name || 'Customer'; const c = custRevenue.get(k) || { name: k, revenue: 0, orders: 0 }; c.revenue += num(o.total_amount); c.orders += 1; custRevenue.set(k, c) })
  const sizeRevenue = new Map()
  last90.forEach(o => (o.lines || []).forEach(l => { const k = l.product_size || '—'; const s = sizeRevenue.get(k) || { size: k, revenue: 0, qty: 0 }; s.revenue += num(l.line_total); s.qty += num(l.quantity); sizeRevenue.set(k, s) }))

  const materials = rawMaterials.map(m => ({ ...m, available: num(m.available ?? (num(m.opening_stock) + num(m.stock_in) - num(m.stock_out))) }))
  const reorders = materials.filter(m => m.available <= num(m.reorder_level) && (num(m.reorder_level) > 0 || m.available <= 0)).sort((a, b) => (a.available - num(a.reorder_level)) - (b.available - num(b.reorder_level)))
  const recipeStatus = RECIPE.map(item => {
    const mat = matchRecipeMaterial(item, materials)
    return { ...item, material: mat, batches: mat ? mat.available / item.baseQty : null }
  })
  const tracked = recipeStatus.filter(r => r.material)
  const bottleneck = tracked.length ? tracked.reduce((a, b) => (b.batches < a.batches ? b : a)) : null

  const fg = [...inventoryLedger].map(f => ({ size: f.size, available: num(f.available), produceNow: Boolean(f.prodRequired) })).sort((a, b) => mlOf(a.size) - mlOf(b.size))

  const batches = [...productionBatches].sort((a, b) => String(b.production_date || '').localeCompare(String(a.production_date || ''))).slice(0, 5).map(b => {
    const litres = (b.outputs || []).reduce((t, o) => t + (mlOf(o.product_size) * num(o.quantity)) / 1000, 0)
    const value = num(b.total_production_value)
    return { number: b.batch_number || `#${b.id}`, date: b.production_date, litres, value, cost: num(b.total_cost), surplus: num(b.profit), margin: value ? (num(b.profit) / value) * 100 : 0 }
  })

  const tb = trialBalanceRows.filter(r => r.account_type === 'Income Statement')
  const mv = r => num(r.acct_in) - num(r.acct_out)
  const netProfit = tb.length ? tb.reduce((t, r) => t + mv(r), 0) : null

  return {
    wallets: treasury?.wallets || [],
    totalCash: treasury?.total || 0,
    debtors,
    totalAr,
    sales: { last30: sum(last30), prev30: sum(prev30), last90: sum(last90), orders30: last30.length, orders90: last90.length },
    topCustomers: [...custRevenue.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    topSizes: [...sizeRevenue.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    reorders,
    recipeStatus,
    bottleneck,
    maxBatches: bottleneck ? Math.max(0, bottleneck.batches) : null,
    fg,
    fgUnits: fg.reduce((t, f) => t + Math.max(0, f.available), 0),
    batches,
    netProfit,
  }
}

const TOPICS = [
  { key: 'brief', words: ['brief', 'summary', 'overview', 'health', 'executive', 'status', 'today'] },
  { key: 'debtors', words: ['debt', 'owe', 'receivable', 'unpaid', 'overdue', 'credit', 'collect'] },
  { key: 'cash', words: ['cash', 'liquid', 'momo', 'wallet', 'bank', 'treasury', 'money', 'ghanapay', 'balance'] },
  { key: 'production', words: ['batch', 'produce', 'production', 'feasib', 'recipe', 'litre', 'liter', 'yield', 'make'] },
  { key: 'stock', words: ['stock', 'inventory', 'reorder', 'shortage', 'bottle', 'material', 'warehouse', 'finished'] },
  { key: 'sales', words: ['sale', 'revenue', 'customer', 'sell', 'turnover', 'month', 'best', 'top'] },
]

function detectTopic(prompt) {
  const p = String(prompt || '').toLowerCase()
  let best = null
  let bestScore = 0
  TOPICS.forEach(t => {
    const score = t.words.reduce((s, w) => s + (p.includes(w) ? 1 : 0), 0)
    if (score > bestScore) { best = t.key; bestScore = score }
  })
  return best
}

/** Returns a structured answer: { title, summary, kpis, table, bullets, followups }. */
export function answerQuestion(prompt, ctx) {
  const topic = detectTopic(prompt)
  const growth = ctx.sales.prev30 > 0 ? ((ctx.sales.last30 - ctx.sales.prev30) / ctx.sales.prev30) * 100 : null
  const top = ctx.debtors[0]

  if (topic === 'debtors') {
    return {
      title: 'Customers who owe us money',
      summary: ctx.debtors.length
        ? `${count(ctx.debtors.length)} customers owe a total of ${ghs(ctx.totalAr)}. ${top.name} owes the most (${ghs(top.due)}, ${pct((top.due / ctx.totalAr) * 100)} of all debt).`
        : 'No customer has an outstanding balance — everyone is paid up.',
      kpis: [{ label: 'Total owed', value: ghs(ctx.totalAr) }, { label: 'Debtors', value: count(ctx.debtors.length) }, { label: 'Older than 60 days', value: ghs(ctx.debtors.filter(d => d.age > 60).reduce((t, d) => t + d.due, 0)) }],
      table: ctx.debtors.length ? { columns: ['Customer', 'Owes', 'Invoices', 'Oldest unpaid'], rows: ctx.debtors.slice(0, 8).map(d => [d.name, ghs(d.due), count(d.invoices), `${count(d.age)} days`]) } : null,
      bullets: ctx.debtors.length ? [`Start collections with ${top.name}${top.phone ? ` (${top.phone})` : ''}.`, 'Print a customer statement from their profile and send it with the MoMo / bank details.'] : [],
      followups: ['What is our cash position?', 'How are sales doing this month?'],
    }
  }
  if (topic === 'cash') {
    return {
      title: 'Cash position',
      summary: `We hold ${ghs(ctx.totalCash)} across ${ctx.wallets.length} wallets, using the same rules as the trial balance.`,
      kpis: ctx.wallets.map(w => ({ label: w.label, value: ghs(w.balance), tone: w.balance < 0 ? 'bad' : '' })),
      table: { columns: ['Wallet', 'Balance', 'Share'], rows: ctx.wallets.map(w => [w.label, ghs(w.balance), ctx.totalCash > 0 ? pct((w.balance / ctx.totalCash) * 100) : '—']) },
      bullets: [
        ...ctx.wallets.filter(w => w.balance < 0).map(w => `${w.label} is below zero — some payments out of it may be recorded against the wrong wallet.`),
        ctx.totalAr > 0 ? `Collecting the ${ghs(ctx.totalAr)} customers owe would raise cash to ${ghs(ctx.totalCash + ctx.totalAr)}.` : null,
      ].filter(Boolean),
      followups: ['Who owes us the most money?', 'Give me today’s business briefing'],
    }
  }
  if (topic === 'production') {
    const missing = ctx.recipeStatus.filter(r => !r.material)
    return {
      title: 'Production capacity',
      summary: ctx.bottleneck
        ? `Current ingredient stock supports about ${ctx.maxBatches.toFixed(1)} standard batches (${(ctx.maxBatches * STANDARD_VOLUME).toFixed(1)} L). The limiting ingredient is ${ctx.bottleneck.name}.`
        : 'I could not match the recipe ingredients to your raw materials, so capacity cannot be calculated.',
      kpis: [{ label: 'Max batches', value: ctx.maxBatches === null ? '—' : ctx.maxBatches.toFixed(1) }, { label: 'Max litres', value: ctx.maxBatches === null ? '—' : `${(ctx.maxBatches * STANDARD_VOLUME).toFixed(1)} L` }, { label: 'Bottleneck', value: ctx.bottleneck?.name || '—' }],
      table: ctx.batches.length ? { columns: ['Batch', 'Date', 'Litres', 'Output value', 'Total cost', 'Surplus', 'Margin'], rows: ctx.batches.map(b => [b.number, fmtDay(dayIndex(b.date)), b.litres.toFixed(1), ghs(b.value), ghs(b.cost), ghs(b.surplus), pct(b.margin)]) } : null,
      bullets: [
        ...ctx.recipeStatus.filter(r => r.material && r.batches < 1).map(r => `${r.name}: only enough for ${r.batches.toFixed(2)} batches — restock before the next run.`),
        missing.length ? `Not found in your stock list: ${missing.map(m => m.name).join(', ')}.` : null,
        'Open Production Ops → Production Planner to plan a run and load it straight into a new batch.',
      ].filter(Boolean),
      followups: ['What stock needs attention?', 'How are sales doing this month?'],
    }
  }
  if (topic === 'stock') {
    const low = ctx.fg.filter(f => f.available <= 0 || f.produceNow)
    return {
      title: 'Stock that needs attention',
      summary: `${count(ctx.fgUnits)} finished bottles on hand. ${low.length ? `${low.length} size${low.length === 1 ? ' needs' : 's need'} producing` : 'Finished goods are above their production levels'}, and ${ctx.reorders.length ? `${ctx.reorders.length} raw material${ctx.reorders.length === 1 ? ' is' : 's are'} at or below reorder level` : 'no raw material is below its reorder level'}.`,
      kpis: [{ label: 'Finished bottles', value: count(ctx.fgUnits) }, { label: 'Sizes to produce', value: count(low.length), tone: low.length ? 'bad' : '' }, { label: 'Materials to reorder', value: count(ctx.reorders.length), tone: ctx.reorders.length ? 'bad' : '' }],
      table: { columns: ['Finished good', 'On hand', 'Status'], rows: ctx.fg.map(f => [f.size, count(f.available), f.available <= 0 ? 'Out of stock' : f.produceNow ? 'Produce now' : 'OK']) },
      bullets: ctx.reorders.slice(0, 8).map(m => `Reorder ${m.name}: ${m.available.toFixed(1)} ${m.unit || ''} left (reorder level ${num(m.reorder_level)}).`),
      followups: ['How many batches can we produce with current stock?', 'What is our cash position?'],
    }
  }
  if (topic === 'sales') {
    return {
      title: 'Sales performance',
      summary: `Sales in the last 30 days were ${ghs(ctx.sales.last30)} from ${count(ctx.sales.orders30)} orders${growth === null ? '' : ` — ${growth >= 0 ? 'up' : 'down'} ${Math.abs(growth).toFixed(1)}% on the 30 days before`}.`,
      kpis: [{ label: 'Last 30 days', value: ghs(ctx.sales.last30) }, { label: 'Previous 30 days', value: ghs(ctx.sales.prev30) }, { label: 'Last 90 days', value: ghs(ctx.sales.last90) }],
      table: ctx.topCustomers.length ? { columns: ['Top customers (90 days)', 'Revenue', 'Orders'], rows: ctx.topCustomers.map(c => [c.name, ghs(c.revenue), count(c.orders)]) } : null,
      bullets: ctx.topSizes.length ? [`Best-selling size over 90 days: ${ctx.topSizes[0].size} (${ghs(ctx.topSizes[0].revenue)}, ${count(ctx.topSizes[0].qty)} bottles).`, ...ctx.topSizes.slice(1, 3).map(s => `${s.size}: ${ghs(s.revenue)} (${count(s.qty)} bottles).`)] : [],
      followups: ['Who owes us the most money?', 'What stock needs attention?'],
    }
  }

  const known = topic === 'brief'
  return {
    title: known ? 'Business briefing' : 'Here is where things stand',
    summary: known
      ? `Cash ${ghs(ctx.totalCash)} · customers owe ${ghs(ctx.totalAr)} · ${count(ctx.fgUnits)} finished bottles · ${ctx.reorders.length} materials to reorder.`
      : `I didn’t recognise a specific topic in “${prompt}”, so here is the overall picture. Try one of the suggestions below.`,
    kpis: [
      { label: 'Cash & bank', value: ghs(ctx.totalCash) },
      { label: 'Owed by customers', value: ghs(ctx.totalAr) },
      { label: 'Sales, last 30 days', value: ghs(ctx.sales.last30) },
      ctx.netProfit === null ? null : { label: 'Net profit (trial balance)', value: ghs(ctx.netProfit), tone: ctx.netProfit < 0 ? 'bad' : '' },
    ].filter(Boolean),
    table: null,
    bullets: [
      top ? `Biggest debtor: ${top.name} owes ${ghs(top.due)}.` : 'No outstanding customer debt.',
      growth === null ? null : `Sales are ${growth >= 0 ? 'up' : 'down'} ${Math.abs(growth).toFixed(1)}% on the previous 30 days.`,
      ctx.maxBatches === null ? null : `Ingredients support about ${ctx.maxBatches.toFixed(1)} more standard batches (bottleneck: ${ctx.bottleneck.name}).`,
      ctx.reorders.length ? `${ctx.reorders.length} raw materials are at or below reorder level, starting with ${ctx.reorders[0].name}.` : null,
    ].filter(Boolean),
    followups: SUGGESTED_PROMPTS.slice(1, 5),
  }
}
