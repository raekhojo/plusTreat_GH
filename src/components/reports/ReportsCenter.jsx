import { useRef, useState } from 'react'
import { REPORTS, REPORT_CATEGORIES, REPORT_STATUS_OPTIONS, REPORT_WALLET_OPTIONS } from '../../lib/reports'
import { printReport } from '../../lib/printDocuments'
import './ReportsCenter.css'

function iso(date) { return date.toISOString().slice(0, 10) }
function today() { return iso(new Date()) }
function monthStart() { const n = new Date(); return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1))) }
function yearStart() { return `${new Date().getFullYear()}-01-01` }
const PERIODS = [
  { key: 'month', label: 'This month', range: () => ({ start: monthStart(), end: today() }) },
  { key: 'year', label: 'This year', range: () => ({ start: yearStart(), end: today() }) },
  { key: 'all', label: 'All time', range: () => ({ start: '', end: '' }) },
  { key: 'custom', label: 'Custom', range: null },
]
function periodLabel(f) {
  if (!f.start && !f.end) return 'All time'
  return `${f.start || '…'} → ${f.end || 'today'}`
}
const isNumeric = v => typeof v === 'number' || /^[-−]?[\d,]+(\.\d+)?\s*(%|L)?$/.test(String(v).trim())
function toExportRows(result) {
  const width = result.columns.length
  const pad = cells => [...cells, ...Array(Math.max(0, width - cells.length)).fill('')]
  const rows = result.rows.map(r => (r.section ? pad([r.section.toUpperCase()]) : r.subtotal ? pad(r.subtotal) : pad(r)))
  return [...rows, ...(result.totals || []).map(pad)].map((cells, i) => ({ id: i, cells }))
}

const Icon = {
  excel: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m9.5 12 5 5M14.5 12l-5 5" /></svg>,
  pdf: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>,
  chevron: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>,
}

function ReportsCenter({ context, onExport }) {
  const [period, setPeriod] = useState('month')
  const [range, setRange] = useState(() => PERIODS[0].range())
  const [extra, setExtra] = useState({ wallet: '', status: '' })
  const [search, setSearch] = useState('')
  const [activeKey, setActiveKey] = useState('')
  const previewRef = useRef(null)

  const filters = { ...range, ...extra }
  const term = search.trim().toLowerCase()
  const visible = REPORTS.filter(r => !term || `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(term))
  const active = REPORTS.find(r => r.key === activeKey)
  const result = active ? active.build(context, filters) : null
  // Right-align a column only when its values are numbers (amounts, %, litres).
  const numericCols = new Set()
  if (result) {
    const dataRows = result.rows.filter(r => Array.isArray(r))
    result.columns.forEach((_, i) => {
      const vals = dataRows.map(r => r[i]).filter(v => v !== '' && v !== undefined && v !== null && v !== '—')
      if (i > 0 && vals.length && vals.every(isNumeric)) numericCols.add(i)
    })
  }

  const choosePeriod = key => {
    setPeriod(key)
    const p = PERIODS.find(x => x.key === key)
    if (p?.range) setRange(p.range())
  }
  const scopeOf = r => (r.usesDates ? periodLabel(range) : 'As of today')
  const exportExcel = r => { const res = r.build(context, filters); onExport?.(`Plus_Treats_${r.key}`, res.columns, toExportRows(res)) }
  const exportPdf = r => { const res = r.build(context, filters); printReport({ title: r.title, subtitle: scopeOf(r), ...res }) }
  const open = r => {
    setActiveKey(r.key)
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }

  return (
    <section className="rc-wrap" aria-label="Reports center">
      <div className="rc-toolbar">
        <div className="rc-period" role="group" aria-label="Report period">
          {PERIODS.map(p => (
            <button key={p.key} type="button" className={period === p.key ? 'is-active' : ''} aria-pressed={period === p.key} onClick={() => choosePeriod(p.key)}>{p.label}</button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="rc-dates">
            <input type="date" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} aria-label="From date" />
            <span aria-hidden="true">→</span>
            <input type="date" value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} aria-label="To date" />
          </div>
        ) : <span className="rc-period-label">{periodLabel(range)}</span>}
        <input className="rc-search" type="search" placeholder="Search reports" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search reports" />
      </div>

      <div className="rc-groups">
        {REPORT_CATEGORIES.map(cat => {
          const items = visible.filter(r => r.category === cat)
          if (!items.length) return null
          return (
            <div key={cat} className="rc-group">
              <h3 className="rc-group-title">{cat}</h3>
              <ul className="rc-list">
                {items.map(r => (
                  <li key={r.key} className={`rc-row${r.key === activeKey ? ' is-active' : ''}`}>
                    <button type="button" className="rc-row-main" onClick={() => open(r)}>
                      <span className="rc-row-title">{r.title}</span>
                      <span className="rc-row-desc">{r.description}</span>
                    </button>
                    <span className="rc-row-scope">{r.usesDates ? 'By period' : 'As of today'}</span>
                    <div className="rc-row-actions">
                      <button type="button" className="rc-icon-btn" onClick={() => exportExcel(r)} title="Download Excel" aria-label={`Download ${r.title} as Excel`}>{Icon.excel}</button>
                      <button type="button" className="rc-icon-btn" onClick={() => exportPdf(r)} title="Print / PDF" aria-label={`Print ${r.title} or save as PDF`}>{Icon.pdf}</button>
                      <button type="button" className="rc-open-btn" onClick={() => open(r)}>View {Icon.chevron}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {!visible.length ? <p className="rc-empty">No reports match “{search}”.</p> : null}
      </div>

      {active && result ? (
        <article className="rc-preview" ref={previewRef} aria-label={`${active.title} preview`}>
          <header className="rc-preview-head">
            <div>
              <span className="rc-preview-cat">{active.category}</span>
              <h3>{active.title}</h3>
              <p>{scopeOf(active)}{result.note ? ` · ${result.note}` : ''}</p>
            </div>
            <div className="rc-preview-actions">
              {active.usesWallet ? (
                <select value={extra.wallet} onChange={e => setExtra(x => ({ ...x, wallet: e.target.value }))} aria-label="Wallet">
                  <option value="">All wallets</option>
                  {REPORT_WALLET_OPTIONS.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
                </select>
              ) : null}
              {active.usesStatus ? (
                <select value={extra.status} onChange={e => setExtra(x => ({ ...x, status: e.target.value }))} aria-label="Invoice status">
                  <option value="">All statuses</option>
                  {REPORT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : null}
              <button type="button" className="rc-text-btn" onClick={() => exportExcel(active)}>{Icon.excel} Excel</button>
              <button type="button" className="rc-text-btn rc-text-btn-primary" onClick={() => exportPdf(active)}>{Icon.pdf} Print / PDF</button>
              <button type="button" className="rc-icon-btn" onClick={() => setActiveKey('')} aria-label="Close preview" title="Close">{Icon.close}</button>
            </div>
          </header>
          <div className="rc-table-scroll">
            <table className="rc-table">
              <thead><tr>{result.columns.map((c, i) => <th key={`${c}-${i}`} className={numericCols.has(i) ? 'num' : ''}>{c}</th>)}</tr></thead>
              <tbody>
                {result.rows.length ? result.rows.map((r, idx) => {
                  if (r.section) return <tr key={idx} className="rc-sec"><td colSpan={result.columns.length}>{r.section}</td></tr>
                  const cells = r.subtotal || r
                  return <tr key={idx} className={r.subtotal ? 'rc-sub' : ''}>{cells.map((c, i) => <td key={i} className={numericCols.has(i) ? 'num' : ''}>{c}</td>)}</tr>
                }) : <tr><td colSpan={result.columns.length} className="rc-empty">No records for this period.</td></tr>}
              </tbody>
              {result.totals?.length ? (
                <tfoot>{result.totals.map((t, idx) => <tr key={idx}>{t.map((c, i) => <td key={i} className={numericCols.has(i) ? 'num' : ''}>{c}</td>)}</tr>)}</tfoot>
              ) : null}
            </table>
          </div>
        </article>
      ) : null}
    </section>
  )
}

export default ReportsCenter
