import { useMemo, useState } from 'react'
import { REPORTS } from '../../lib/reports'
import { printReport } from '../../lib/printDocuments'
import { css, currency, num } from '../format'

// Port of templates/reports.html (Reports & Analytics Center), driven by this app's report builders.
const CARDS = [
  { key: 'income_statement', cat: 'financial', style: 'border: 2px solid #3b82f6; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', icon: '📈', badgeStyle: 'background: #1e3a8a; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px', badge: 'FINANCIAL STATEMENT', title: 'Statement of Comprehensive Income (P&L)', big: true, desc: 'Formal executive income statement detailing Commercial Revenue, Direct COGS, Gross Profit & Margins, Batch Manufacturing Surplus, Itemized Operating Expenses, and Net Operating Profit.', covStyle: 'background: #eff6ff; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #1e40af; margin-bottom: 16px; border: 1px solid #bfdbfe', covLabel: 'Core Coverage:', cov: () => 'Revenue • COGS • Manufacturing Gain • OpEx Schedule • Net Profit', btn: 'background: #1e3a8a' },
  { key: 'balance_sheet', cat: 'financial', style: 'border: 2px solid #059669; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', icon: '⚖️', badgeStyle: 'background: #065f46; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px', badge: 'FINANCIAL POSITION', title: 'Statement of Financial Position (Balance Sheet)', big: true, desc: 'Audited balance sheet schedule presenting Fixed Assets (PPE, Equipment), Current Assets (Liquid Wallets, Trade AR, Stock), Liabilities (AP, Other Payables), Stated Capital, and Retained Surplus.', covStyle: 'background: #ecfdf5; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #065f46; margin-bottom: 16px; border: 1px solid #a7f3d0', covLabel: 'Core Coverage:', cov: s => `${currency(s.assets)} Assets Balanced • Solvency • Working Capital`, btn: 'background: #059669' },
  { key: 'sales_summary', cat: 'sales', icon: '📊', badgeStyle: 'background: #e0e7ff; color: #4338ca', badge: 'SALES & REVENUE', title: 'Sales Performance & SKU Analysis', desc: 'Itemized sales volume (units & litres), average realized selling price, gross revenue, and invoice distribution per product size (330ml, 500ml, 1L, etc.).', cov: s => `${s.invoices} Invoices • Volume in Litres • Average Unit Pricing` },
  { key: 'ar_aging', cat: 'sales', icon: '👥', badgeStyle: 'background: #fef3c7; color: #b45309', badge: 'CREDIT CONTROL (AR)', title: 'Customer Receivables (AR) Aging Report', desc: 'Complete debt exposure statement categorizing outstanding balances by aging buckets: Current (0-30 days), 31-60 days, and Over 60 days overdue.', cov: s => `${s.debtors} Active Debtors • Total Exposure • Risk Classification` },
  { key: 'batch_overheads', cat: 'manufacturing', icon: '⚡', badgeStyle: 'background: #fee2e2; color: #b91c1c', badge: 'COST AUDIT', title: 'Batch Overhead Costs & Settlement Audit', desc: 'Itemized schedule of batch overheads (Electricity, Gas, Production Wages) across all production batches, reconciled against cashbook disbursements and outstanding liabilities.', cov: s => `${s.batches} Batches • ${currency(s.overheads)} Overheads • Wages & Energy Reconciliation` },
  { key: 'production_efficiency', cat: 'manufacturing', icon: '🏭', badgeStyle: 'background: #f1f5f9; color: #334155', badge: 'MANUFACTURING', title: 'Production Yield & Batch Efficiency', desc: 'Manufacturing performance tracking litres produced, total units yielded, actual production cost per litre, standard production value, and manufacturing surplus.', cov: s => `${s.litres.toLocaleString('en-US', { maximumFractionDigits: 1 })} Litres • Cost/Litre Benchmark • Efficiency Margin` },
  { key: 'batch_samples', cat: 'manufacturing sales', style: 'border: 2px solid #8b5cf6; background: linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)', icon: '🧪', badgeStyle: 'background: #6b21a8; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px', badge: 'SAMPLE AUDIT', title: 'Batch Samples & Promotional Goods Analysis', desc: 'Detailed audit analysing the quantity of yogurt used as tasting samples and promotional goods, their related imputed value, production cost, and output percentage for each production batch.', covStyle: 'background: #f3e8ff; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #6b21a8; margin-bottom: 16px; border: 1px solid #d8b4fe', cov: s => `${s.sampleBottles} Sample Bottles • ${currency(s.sampleValue)} Value • Batch Allocation • Recipient Tracking`, btn: 'background: #6b21a8' },
  { key: 'cash_flow', cat: 'financial', icon: '💰', badgeStyle: 'background: #dcfce7; color: #15803d', badge: 'TREASURY', title: 'Cash Flow & Treasury Activity Statement', desc: 'Chronological audit trail of all inflows, outflows, and net balances across MoMo Wallet, GhanaPay, CalBank, and Physical Cash.', cov: s => `${s.cashTx} Cashbook Records • Multi-Wallet Inflows & Outflows` },
  { key: 'inventory_valuation', cat: 'inventory', icon: '📦', badgeStyle: 'background: #e0f2fe; color: #0369a1', badge: 'INVENTORY', title: 'Inventory Movement & Valuation Ledger', desc: 'Finished goods stock movements (production stock in, sales stock out, available stock) alongside raw materials stock on hand, valuation, and reorder alerts.', cov: () => 'Finished Goods Units • Raw Material Depletion • Stock Valuation' },
  { key: 'operating_expenses', cat: 'opex', icon: '💼', badgeStyle: 'background: #fae8ff; color: #86198f', badge: 'OPEX AUDIT', title: 'Operating Expenses (OPEX) Ledger', desc: 'Categorized breakdown of operational expenses (Salaries, Packaging, Fuel/Transport, Certifications, Professional Fees, Repairs) with transaction vouchers.', cov: () => 'Expense Breakdown • Payment Channels • Payee Descriptions' },
  { key: 'invoices_register', cat: 'sales', icon: '🧾', badgeStyle: 'background: #f0fdf4; color: #166534', badge: 'BILLING AUDIT', title: 'Sales Invoices & Billing Register', desc: 'Complete audit list of all customer invoices issued, tracking customer name, pricing tier, gross invoice amount, discounts, collections, and settlement status.', cov: s => `${s.invoices} Invoices • Pricing Tiers • Payment Status` },
]
const CATS = [
  ['all', 'All Reports'],
  ['financial', '📈 Financial Statements & P&L'],
  ['sales', '🛍️ Sales & Receivables'],
  ['manufacturing', '🏭 Manufacturing & Overheads'],
  ['inventory', '📦 Inventory & Valuation'],
  ['opex', '💼 Operating Expenses'],
]
const SMALL_BADGE = 'font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px'
const PLAIN_CARD = 'border: 1px solid var(--border)'
const PLAIN_COV = 'background: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #475569; margin-bottom: 16px; border: 1px solid #e2e8f0'

function iso(d) { return d.toISOString().slice(0, 10) }
function toExportRows(result) {
  const width = result.columns.length
  const pad = cells => [...cells, ...Array(Math.max(0, width - cells.length)).fill('')]
  const rows = result.rows.map(r => (r.section ? pad([r.section.toUpperCase()]) : r.subtotal ? pad(r.subtotal) : pad(r)))
  return [...rows, ...(result.totals || []).map(pad)].map((cells, i) => ({ id: i, cells }))
}

function ClassicReports({ ctx }) {
  const [range, setRange] = useState({ start: '', end: iso(new Date()) })
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [previewKey, setPreviewKey] = useState('')
  const context = ctx.reportsContext
  const filters = { ...range, wallet: '', status: '' }

  const stats = useMemo(() => {
    const d = ctx.data
    const batches = d.productionBatches
    const sampleLines = d.invoices.filter(inv => inv.is_sample_sale).flatMap(inv => inv.lines || [])
    const assetRows = (context.trialBalanceRows || []).filter(r => r.account_type === 'Balance Sheet' && r.account_class === 'Assets')
    return {
      invoices: d.invoices.length,
      debtors: new Set(d.invoices.filter(inv => ctx.outstandingOf(inv) > 0.005).map(inv => inv.customer)).size,
      batches: batches.length,
      overheads: batches.reduce((t, b) => t + num(b.electricity_cost) + num(b.gas_cost) + num(b.production_wages), 0),
      litres: batches.reduce((t, b) => t + (b.outputs || []).reduce((s, o) => s + num(o.total_litres), 0), 0),
      sampleBottles: sampleLines.reduce((t, l) => t + num(l.quantity), 0),
      sampleValue: sampleLines.reduce((t, l) => t + num(l.line_total), 0),
      cashTx: (ctx.cashbook || []).length,
      assets: assetRows.reduce((t, r) => t + num(r.available), 0),
    }
  }, [ctx, context])

  const term = search.trim().toLowerCase()
  const shown = CARDS.filter(c => (cat === 'all' || c.cat.split(' ').includes(cat)) && (!term || `${c.title} ${c.desc} ${c.badge}`.toLowerCase().includes(term)))
  const count = key => (key === 'all' ? CARDS.length : CARDS.filter(c => c.cat.split(' ').includes(key)).length)
  const scope = range.start || range.end ? `${range.start || '…'} → ${range.end || 'today'}` : 'All time'
  const reportOf = key => REPORTS.find(r => r.key === key)
  const exportExcel = key => { const r = reportOf(key); const res = r.build(context, filters); ctx.exportTable(`Plus_Treats_${key}`, res.columns, toExportRows(res)) }
  const exportPdf = key => { const r = reportOf(key); const res = r.build(context, filters); printReport({ title: CARDS.find(c => c.key === key)?.title || r.title, subtitle: scope, ...res }) }
  const setPreset = p => {
    const now = new Date()
    if (p === 'all') setRange({ start: '', end: iso(now) })
    if (p === 'this_month') setRange({ start: iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))), end: iso(now) })
    if (p === 'last_30') setRange({ start: iso(new Date(Date.now() - 29 * 86400000)), end: iso(now) })
  }

  const preview = previewKey ? reportOf(previewKey)?.build(context, filters) : null
  const previewCard = CARDS.find(c => c.key === previewKey)

  return (
    <>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}><span>📑</span> Reports &amp; Analytics Center</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Analyze business performance and export publication-ready reports in <strong>Excel (.xlsx)</strong> and <strong>PDF (.pdf)</strong>.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => { setPreset('all'); setSearch(''); setCat('all') }}><span>🔄</span> Reset Filters</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', background: '#ffffff', border: '1px solid var(--border)' }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📅 Date Filters:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>From:</label>
                <input type="date" className="form-control" style={{ width: '145px', padding: '6px 10px', fontSize: '13px' }} value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>To:</label>
                <input type="date" className="form-control" style={{ width: '145px', padding: '6px 10px', fontSize: '13px' }} value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPreset('all')}>All Time</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPreset('this_month')}>This Month</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPreset('last_30')}>Last 30 Days</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Search Reports:</span>
              <input type="text" className="form-control" placeholder="Filter reports by keyword..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '220px', padding: '6px 10px', fontSize: '13px' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
        {CATS.map(([key, label]) => (
          <button key={key} type="button" className={`btn ${cat === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCat(key)} style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label} ({count(key)})</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {shown.map(c => (
          <div key={c.key} className="report-card card" style={{ ...css(c.style || PLAIN_CARD), marginBottom: 0, transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}>
            <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '30px' }}>{c.icon}</span>
                  <span className="badge" style={css(c.badgeStyle.includes('padding') ? c.badgeStyle : `${c.badgeStyle}; ${SMALL_BADGE}`)}>{c.badge}</span>
                </div>
                <h3 style={{ fontSize: c.big ? '17px' : '16px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>{c.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, marginBottom: '14px' }}>{c.desc}</p>
                <div style={css(c.covStyle || PLAIN_COV)}><strong>{c.covLabel || 'Key Coverage:'}</strong> {c.cov(stats)}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => exportExcel(c.key)} style={{ flex: 1, minWidth: '100px', ...css(c.btn) }}><span>📥</span> Excel (.xlsx)</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => exportPdf(c.key)} style={{ flex: 1, minWidth: '90px' }}><span>📄</span> PDF</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPreviewKey(c.key)} title="Preview on screen and print"><span>👁️</span></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setPreviewKey('') }} style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(2px)' }}>
          <div className="card" style={{ width: '92%', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', overflow: 'hidden', marginBottom: 0 }}>
            <div className="card-header" style={{ background: '#1e3a8a', color: '#ffffff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#ffffff' }}>{previewCard?.title}</h3>
                <span style={{ fontSize: '12px', color: '#bfdbfe' }}>Live ERP Snapshot · {scope}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="button" className="btn btn-sm" onClick={() => exportExcel(previewKey)} style={{ background: '#10b981', color: 'white', border: 'none', fontWeight: 600 }}>📥 Download Excel</button>
                <button type="button" className="btn btn-sm" onClick={() => exportPdf(previewKey)} style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 600 }}>📄 Download PDF</button>
                <button type="button" className="btn btn-sm" onClick={() => exportPdf(previewKey)} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', fontWeight: 600 }}>🖨️ Print</button>
                <button type="button" className="btn btn-sm" onClick={() => setPreviewKey('')} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '20px', lineHeight: 1 }}>&times;</button>
              </div>
            </div>
            <div className="card-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    {preview.columns.map((col, i) => <th key={col} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right' }}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, idx) => (r.section
                    ? <tr key={idx} style={{ background: '#f8fafc' }}><td colSpan={preview.columns.length} style={{ padding: '10px 14px', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>{r.section}</td></tr>
                    : (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', ...(r.subtotal ? { fontWeight: 700, background: '#f8fafc' } : null) }}>
                        {(r.subtotal || r).map((cell, i) => <td key={i} style={{ padding: '8px 14px', textAlign: i === 0 ? 'left' : 'right' }}>{cell}</td>)}
                      </tr>
                    )))}
                  {!preview.rows.length ? <tr><td colSpan={preview.columns.length} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No records in this period.</td></tr> : null}
                </tbody>
                {preview.totals?.length ? (
                  <tfoot>
                    {preview.totals.map((t, i) => (
                      <tr key={i} style={{ background: '#ecfdf5', fontWeight: 800, borderTop: '2px solid #a7f3d0' }}>
                        {t.map((cell, j) => <td key={j} style={{ padding: '10px 14px', textAlign: j === 0 ? 'left' : 'right', color: '#065f46' }}>{cell}</td>)}
                      </tr>
                    ))}
                  </tfoot>
                ) : null}
              </table>
              {preview.note ? <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>{preview.note}</p> : null}
            </div>
            <div style={{ background: '#f8fafc', borderTop: '1px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PLUS TREATS ERP • Data current as at {iso(new Date())}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewKey('')}>Close Preview</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default ClassicReports
