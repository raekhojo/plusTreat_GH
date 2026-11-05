import { useMemo, useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import { printReport } from '../../lib/printDocuments'
import { currency, num, unitCostBySize } from '../format'

// Port of the Asset Reconciliation tab of templates/financials.html.
// Counts share the draft (and count-sheet format) of the new interface's Stock Count,
// so a count started in either view carries over. The backend has no audit table,
// so saved snapshots are kept in this browser.
const DRAFT_KEY = 'plusTreatStockCountDraft'
const LOG_KEY = 'plusTreatAuditSnapshots'

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback } catch { return fallback }
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

function VarCell({ value, style }) {
  const v = num(value)
  const color = Math.abs(v) < 0.005 ? '#059669' : v > 0 ? '#2563eb' : '#dc2626'
  return <td style={{ textAlign: 'right', fontWeight: 700, ...style }}><span style={{ color }}>{v > 0.005 ? '+' : ''}{currency(v)}</span></td>
}
function StatusBadge({ value, size = '11px' }) {
  const v = num(value)
  if (Math.abs(v) < 0.005) return <span className="badge badge-success" style={{ fontSize: size }}>Balanced</span>
  return v > 0 ? <span className="badge badge-info" style={{ fontSize: size }}>Surplus</span> : <span className="badge badge-danger" style={{ fontSize: size }}>Shortage</span>
}

const YELLOW_TH = { background: '#fef3c7', color: '#92400e' }
const YELLOW_TD = { padding: '4px 8px', textAlign: 'right', background: '#fffbeb' }
const INPUT = { fontWeight: 800, background: '#fef9c3', border: '1.5px solid #f59e0b', textAlign: 'right', padding: '4px 8px', fontSize: '12px' }

function ClassicReconciliation({ ctx, user }) {
  const { data, treasury, inventoryLedger, rawMaterials, otherReceivables, outstandingOf } = ctx
  const draft = readJson(DRAFT_KEY, null)
  const [counts, setCounts] = useState(() => draft?.counts || {})
  const [meta, setMeta] = useState(() => draft?.meta || { auditor: user?.name || 'admin', date: today(), remarks: '' })
  const [log, setLog] = useState(() => readJson(LOG_KEY, []))
  const [showImport, setShowImport] = useState(false)
  const [showRm, setShowRm] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)

  const persist = (nextCounts, nextMeta = meta) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...(readJson(DRAFT_KEY, {})), counts: nextCounts, meta: nextMeta, savedAt: new Date().toISOString() }))
  }
  const setCount = (key, value) => { const next = { ...counts, [key]: value }; setCounts(next); persist(next) }
  const setMetaField = (field, value) => { const next = { ...meta, [field]: value }; setMeta(next); persist(counts, next) }
  const phys = (key, book) => (counts[key] === undefined || counts[key] === '' ? book : num(counts[key]))

  const model = useMemo(() => {
    const cost = unitCostBySize(data.productionBatches)
    const wallets = treasury.wallets.map(w => ({ key: `CASH-${w.key}`, label: w.label, book: w.balance }))
    const cashbook = ctx.cashbook || []
    const debtors = new Map()
    data.invoices.forEach(inv => {
      const due = outstandingOf(inv)
      if (due <= 0.005) return
      const d = debtors.get(inv.customer_name) || { name: inv.customer_name || 'Unknown', open: 0, due: 0 }
      d.open += 1
      d.due += due
      debtors.set(d.name, d)
    })
    const fg = inventoryLedger.map(f => ({ key: `FG-${f.size}`, size: f.size, unitCost: cost.get(f.size) || 0, book: num(f.available) }))
    const rm = rawMaterials.map(m => {
      const unitCost = num(m.unit_price)
      return { key: `RM-${m.id}`, code: /^\d+$/.test(String(m.id)) ? `RM-${String(m.id).padStart(4, '0')}` : String(m.id), name: m.name, category: m.category || 'Uncategorised', unit: m.unit || '', unitCost, book: num(m.available), open: num(m.opening_stock) * unitCost, purchased: num(m.stock_in) * unitCost, used: num(m.stock_out) * unitCost }
    }).sort((a, b) => a.category.localeCompare(b.category) || String(a.name).localeCompare(String(b.name)))
    const categories = [...new Set(rm.map(r => r.category))].map(c => {
      const items = rm.filter(r => r.category === c)
      return { category: c, count: items.length, open: items.reduce((t, r) => t + r.open, 0), purchased: items.reduce((t, r) => t + r.purchased, 0), used: items.reduce((t, r) => t + r.used, 0), book: items.reduce((t, r) => t + r.book * r.unitCost, 0) }
    })
    const tradeBilled = data.invoices.reduce((t, inv) => t + num(inv.previous_balance) + num(inv.total_amount), 0)
    const tradeAr = data.invoices.reduce((t, inv) => t + outstandingOf(inv), 0)
    const produced = data.productionBatches.reduce((t, b) => t + (b.outputs || []).reduce((s, o) => s + num(o.quantity), 0), 0)
    const soldLines = data.invoices.flatMap(inv => (inv.lines || []).map(l => ({ q: num(l.quantity), sample: inv.is_sample_sale })))
    return {
      wallets,
      cashIn: cashbook.reduce((t, r) => t + (r.kind === 'transfer' ? 0 : r.inflow), 0),
      cashOut: cashbook.reduce((t, r) => t + (r.kind === 'transfer' ? 0 : r.outflow), 0),
      cashBook: treasury.total,
      debtors: [...debtors.values()].sort((a, b) => b.due - a.due),
      tradeBilled,
      tradeCollected: tradeBilled - tradeAr,
      tradeAr,
      otherIn: otherReceivables.totalIn,
      otherOut: otherReceivables.totalOut,
      otherAr: otherReceivables.balance,
      fg,
      produced,
      commercial: soldLines.filter(l => !l.sample).reduce((t, l) => t + l.q, 0),
      samples: soldLines.filter(l => l.sample).reduce((t, l) => t + l.q, 0),
      fgUnits: fg.reduce((t, f) => t + f.book, 0),
      fgBook: fg.reduce((t, f) => t + Math.max(0, f.book) * f.unitCost, 0),
      rm,
      categories,
      rmOpen: rm.reduce((t, r) => t + r.open, 0),
      rmPurchased: rm.reduce((t, r) => t + r.purchased, 0),
      rmUsed: rm.reduce((t, r) => t + r.used, 0),
      rmBook: rm.reduce((t, r) => t + Math.max(0, r.book) * r.unitCost, 0),
    }
  }, [data, treasury, inventoryLedger, rawMaterials, otherReceivables, outstandingOf, ctx.cashbook])

  const cashPhys = model.wallets.reduce((t, w) => t + phys(w.key, w.book), 0)
  const tradePhys = phys('AR-TRADE', model.tradeAr)
  const otherPhys = phys('AR-OTHER', model.otherAr)
  const fgPhysUnits = model.fg.reduce((t, f) => t + phys(f.key, f.book), 0)
  const fgPhys = model.fg.reduce((t, f) => t + Math.max(0, phys(f.key, f.book)) * f.unitCost, 0)
  const rmPhys = model.rm.reduce((t, r) => t + Math.max(0, phys(r.key, r.book)) * r.unitCost, 0)
  const bookTotal = model.cashBook + model.tradeAr + model.otherAr + model.fgBook + model.rmBook
  const physTotal = cashPhys + tradePhys + otherPhys + fgPhys + rmPhys
  const netVar = physTotal - bookTotal
  const balanced = Math.abs(netVar) < 0.005
  const lastAudit = log[0]

  const master = [
    { key: 'cash', label: '📱 Cash and Cash Equivalents', note: 'MoMo, GhanaPay, Physical Cash, Cal Bank', open: currency(0), add: model.cashIn, out: model.cashOut, book: model.cashBook, bookColor: '#2563eb', phys: cashPhys, inputColor: '#1e3a8a', readOnly: true },
    { key: 'AR-TRADE', label: '👥 Customer Trade Receivables', note: 'Cumulative Sales Billed − Customer Collections', open: currency(0), add: model.tradeBilled, out: model.tradeCollected, book: model.tradeAr, bookColor: '#b45309', phys: tradePhys, inputColor: '#b45309' },
    { key: 'AR-OTHER', label: '📋 Other Receivables (Staff & Home Advances)', note: 'Disbursed Advances − Cash Refunds Received', open: currency(0), add: model.otherIn, out: model.otherOut, book: model.otherAr, bookColor: '#6366f1', phys: otherPhys, inputColor: '#6366f1' },
    { key: 'fg', label: `🥛 Finished Goods Inventory (${model.fg.length} Pack Sizes)`, note: `Manufactured ${model.produced} btls − Sold ${model.commercial} − Samples ${model.samples}`, open: '0 btls', addText: `+${model.produced} btls`, outText: `-${model.commercial + model.samples} btls`, book: model.fgBook, bookSub: `(${model.fgUnits} btls)`, bookColor: '#059669', phys: fgPhys, inputColor: '#059669', readOnly: true },
    { key: 'rm', label: '🧪 Raw Materials & Packaging Supplies', note: `${model.rm.length} Tracked Items (Ingredients, Bottles, Labels, Flavours)`, open: currency(model.rmOpen), add: model.rmPurchased, out: model.rmUsed, book: model.rmBook, bookColor: '#7c3aed', phys: rmPhys, inputColor: '#7c3aed', readOnly: true },
  ]

  const copyBook = () => {
    const next = {
      ...Object.fromEntries(model.wallets.map(w => [w.key, String(Math.round(w.book * 100) / 100)])),
      'AR-TRADE': String(Math.round(model.tradeAr * 100) / 100),
      'AR-OTHER': String(Math.round(model.otherAr * 100) / 100),
      ...Object.fromEntries(model.fg.map(f => [f.key, String(f.book)])),
      ...Object.fromEntries(model.rm.map(r => [r.key, String(Math.round(r.book * 1000) / 1000)])),
    }
    setCounts(next)
    persist(next)
    setMessage('Book balances copied into every physical count field.')
  }

  const sheetRows = () => [
    ...model.wallets.map(w => ({ key: w.key, group: 'Cash & bank', label: w.label, unit: 'GHS', book: w.book, unitCost: 1 })),
    { key: 'AR-TRADE', group: 'Receivables', label: 'Customer trade receivables', unit: 'GHS', book: model.tradeAr, unitCost: 1 },
    { key: 'AR-OTHER', group: 'Receivables', label: 'Other receivables (staff & home advances)', unit: 'GHS', book: model.otherAr, unitCost: 1 },
    ...model.fg.map(f => ({ key: f.key, group: 'Finished goods', label: `Plus Yoghurt ${f.size}`, unit: 'Bottles', book: f.book, unitCost: f.unitCost })),
    ...model.rm.map(r => ({ key: r.key, group: `Raw materials · ${r.category}`, label: r.name, unit: r.unit, book: r.book, unitCost: r.unitCost })),
  ]
  const download = async format => {
    const rows = sheetRows()
    const header = ['Key', 'Group', 'Item', 'Unit', 'Book Qty', 'Unit Cost', 'Physical Count', 'Notes']
    let blob
    if (format === 'csv') {
      const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`
      blob = new Blob([[header, ...rows.map(r => [r.key, r.group, r.label, r.unit, Math.round(r.book * 1000) / 1000, Math.round(r.unitCost * 10000) / 10000, '', ''])].map(line => line.map(esc).join(',')).join('\n')], { type: 'text/csv' })
    } else {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Count sheet')
      ws.columns = header.map(h => ({ header: h, width: h === 'Item' ? 36 : h === 'Group' ? 26 : 16 }))
      rows.forEach(r => ws.addRow([r.key, r.group, r.label, r.unit, Math.round(r.book * 1000) / 1000, Math.round(r.unitCost * 10000) / 10000, '', '']))
      ws.getRow(1).font = { bold: true }
      blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Plus_Treats_Reconciliation_Template_${meta.date || today()}.${format}`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const importSheet = async file => {
    if (!file) return
    try {
      let table = []
      if (/\.csv$/i.test(file.name)) {
        table = (await file.text()).split(/\r?\n/).filter(Boolean).map(line => (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"')))
      } else {
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await file.arrayBuffer())
        wb.worksheets[0].eachRow(row => table.push(row.values.slice(1).map(v => (typeof v === 'object' && v !== null ? v.result ?? v.text ?? '' : v))))
      }
      const head = (table[0] || []).map(h => String(h || '').trim().toLowerCase())
      const keyCol = head.indexOf('key')
      const physCol = head.findIndex(h => h.startsWith('physical'))
      if (keyCol < 0 || physCol < 0) throw new Error('This file is not a count sheet — download the template first.')
      const next = { ...counts }
      let n = 0
      table.slice(1).forEach(r => {
        const key = String(r[keyCol] ?? '').trim()
        const value = r[physCol]
        if (!key || value === '' || value === null || value === undefined) return
        next[key] = String(value)
        n += 1
      })
      setCounts(next)
      persist(next)
      setShowImport(false)
      setMessage(`Imported ${n} counted item${n === 1 ? '' : 's'} from “${file.name}”.`)
    } catch (err) {
      setMessage(err.message || 'Could not read that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const saveSnapshot = (source = 'In-System') => {
    if (!meta.auditor || !meta.date) { setMessage('Enter the auditor name and audit date first.'); return }
    const entry = { id: (log[0]?.id || 0) + 1, date: meta.date, auditor: meta.auditor, source, book: bookTotal, physical: physTotal, variance: netVar, notes: meta.remarks || '', savedAt: new Date().toISOString() }
    const next = [entry, ...log].slice(0, 25)
    setLog(next)
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
    setMessage(`Audit snapshot AUD-REC-${entry.id} saved (${balanced ? 'balanced' : `variance ${currency(netVar)}`}).`)
  }
  const printSchedule = () => printReport({
    title: 'Executive Current Assets Reconciliation',
    subtitle: `${meta.date || today()} · audited by ${meta.auditor || '—'}`,
    columns: ['Asset class', 'System book balance', 'Physical / verified', 'Variance', 'Status'],
    rows: master.map(m => [m.label.replace(/^\S+\s/, ''), currency(m.book), currency(m.phys), currency(m.phys - m.book), Math.abs(m.phys - m.book) < 0.005 ? 'Balanced' : m.phys > m.book ? 'Surplus' : 'Shortage']),
    totals: [['Total current assets', currency(bookTotal), currency(physTotal), currency(netVar), balanced ? '100% reconciled' : 'Variance']],
    note: meta.remarks || '',
  })

  const TD = { padding: '9px 12px' }
  return (
    <div>
      <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '14px 18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚖️ Physical Asset Audit &amp; Reconciliation Center</span>
            <span className={`badge ${balanced ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px', padding: '3px 8px' }}>{balanced ? 'BALANCED' : 'VARIANCE'}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Input verified physical audit counts <strong>within the system</strong> or generate templates for stocktaking <strong>outside the system</strong>.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => download('xlsx')} style={{ fontSize: '12px', fontWeight: 700, background: '#1e3a8a', borderColor: '#1e3a8a' }}>📥 Download Template (Excel)</button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => download('csv')} style={{ fontSize: '12px', fontWeight: 600 }} title="Download CSV for Google Sheets / Numbers">CSV</button>
          <button type="button" className="btn btn-sm" onClick={() => setShowImport(v => !v)} style={{ fontSize: '12px', fontWeight: 700, background: '#fef3c7', border: '1.5px solid #f59e0b', color: '#92400e' }}>📤 Import Completed Sheet</button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={copyBook} style={{ fontSize: '12px' }} title="Reset all physical count fields to match current book balances">📋 Copy Book Balances</button>
          <button type="button" className="btn btn-sm" onClick={() => saveSnapshot()} style={{ fontSize: '12px', fontWeight: 700, background: '#059669', borderColor: '#059669', color: '#fff' }}>💾 Save Audit Snapshot</button>
        </div>
      </div>

      {message ? <div className="alert alert-info"><span>{message}</span><button type="button" onClick={() => setMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button></div> : null}

      {showImport ? (
        <div style={{ background: '#fffbeb', border: '1.5px dashed #f59e0b', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#92400e' }}>📤 Import Offline Stocktake / Count Sheet (.xlsx or .csv)</h5>
              <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>Upload the Excel or CSV template that was filled out of the system during physical counting.</div>
            </div>
            <button type="button" onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#92400e' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>Select Count Sheet File (.xlsx / .csv)</label>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="form-control" style={{ fontSize: '12px', padding: '5px', height: 'auto', background: '#fff' }} onChange={e => importSheet(e.target.files?.[0])} />
            </div>
            <div style={{ width: '170px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>Auditor / Verifier Name</label>
              <input type="text" value={meta.auditor} onChange={e => setMetaField('auditor', e.target.value)} className="form-control" style={{ fontSize: '12px', height: '35px', background: '#fff' }} />
            </div>
            <div style={{ width: '150px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>Count Date</label>
              <input type="date" value={meta.date} onChange={e => setMetaField('date', e.target.value)} className="form-control" style={{ fontSize: '12px', height: '35px', background: '#fff' }} />
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '1.5px solid #a7f3d0', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>⚖️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#065f46', fontWeight: 800 }}>Executive Current Assets Reconciliation Matrix</h3>
            <div style={{ fontSize: '12.5px', color: '#047857', marginTop: '2px' }}>
              System Book Balance: <strong>{currency(bookTotal)}</strong>
              {lastAudit ? <> | Last Saved Audit: <strong style={{ color: '#1e3a8a' }}>{lastAudit.date} by {lastAudit.auditor}</strong> (Ref: AUD-REC-{lastAudit.id})</> : null}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#047857', fontWeight: 700 }}>Verified Physical Assets Total</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46' }}>{currency(physTotal)}</div>
          <div style={{ fontSize: '12px', color: balanced ? '#059669' : '#dc2626', fontWeight: 800 }}>Net Variance: {currency(netVar)} ({balanced ? 'Balanced' : netVar > 0 ? 'Surplus' : 'Shortage'})</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary)', margin: 0, whiteSpace: 'nowrap' }}>Auditor / Verifier:</label>
          <input type="text" className="form-control" value={meta.auditor} onChange={e => setMetaField('auditor', e.target.value)} style={{ width: '150px', fontSize: '12px', padding: '5px 8px' }} required />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary)', margin: 0, whiteSpace: 'nowrap' }}>Audit Date:</label>
          <input type="date" className="form-control" value={meta.date} onChange={e => setMetaField('date', e.target.value)} style={{ width: '140px', fontSize: '12px', padding: '5px 8px' }} required />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary)', margin: 0, whiteSpace: 'nowrap' }}>Audit Notes / Observations:</label>
          <input type="text" className="form-control" value={meta.remarks || ''} onChange={e => setMetaField('remarks', e.target.value)} placeholder="e.g. Physical stocktake verified in cold room and warehouse" style={{ fontSize: '12px', padding: '5px 8px' }} />
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--secondary)' }}>📑 Master Asset Equilibrium &amp; Verified Balance Input</h4>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Yellow input fields represent verified physical counts / balances. Real-time variances calculate automatically.</span>
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Asset Class</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Opening Balance</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Additions (+)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Dispatches (−)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>System Book Balance</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', background: '#fef3c7', color: '#92400e', fontWeight: 800, borderLeft: '1.5px solid #f59e0b', borderRight: '1.5px solid #f59e0b' }}>Physical / Verified Count (GHS)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Reconciliation Variance</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Audit Status</th>
              </tr>
            </thead>
            <tbody>
              {master.map(m => (
                <tr key={m.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...TD, fontWeight: 700, color: '#1e293b' }}>
                    <span>{m.label}</span>
                    <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>{m.note}</div>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: '#64748b' }}>{m.open}</td>
                  <td style={{ ...TD, textAlign: 'right', color: '#059669', fontWeight: 600 }}>{m.addText || `+${currency(m.add)}`}</td>
                  <td style={{ ...TD, textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{m.outText || `-${currency(m.out)}`}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: m.bookColor }}>
                    {currency(m.book)}
                    {m.bookSub ? <div style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>{m.bookSub}</div> : null}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', background: '#fffbeb', borderLeft: '1.5px solid #f59e0b', borderRight: '1.5px solid #f59e0b' }}>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      style={{ ...INPUT, color: m.inputColor, ...(m.readOnly ? { background: '#fefce8', cursor: 'not-allowed' } : null) }}
                      value={m.readOnly ? Math.round(m.phys * 100) / 100 : (counts[m.key] ?? Math.round(m.book * 100) / 100)}
                      readOnly={m.readOnly}
                      title={m.readOnly ? 'Calculated from the schedule below' : 'Verified balance'}
                      onChange={e => { if (!m.readOnly) setCount(m.key, e.target.value) }}
                    />
                  </td>
                  <VarCell value={m.phys - m.book} style={TD} />
                  <td style={{ ...TD, textAlign: 'center' }}><StatusBadge value={m.phys - m.book} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#ecfdf5', borderTop: '2.5px solid #10b981', fontWeight: 800, fontSize: '13.5px' }}>
                <td style={{ padding: '12px', color: '#065f46' }}>TOTAL CURRENT ASSETS RECONCILED</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>{currency(model.rmOpen)}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#059669' }}>+{currency(model.cashIn + model.tradeBilled + model.otherIn + model.rmPurchased)}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#dc2626' }}>-{currency(model.cashOut + model.tradeCollected + model.otherOut + model.rmUsed)}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#065f46', fontSize: '15px' }}>{currency(bookTotal)}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#065f46', fontSize: '16px', background: '#dcfce7', borderLeft: '1.5px solid #10b981', borderRight: '1.5px solid #10b981' }}>{currency(physTotal)}</td>
                <VarCell value={netVar} style={{ padding: '12px', fontSize: '15px' }} />
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span className={`badge ${balanced ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11.5px', padding: '4px 8px' }}>{balanced ? '100% RECONCILED' : 'VARIANCE FOUND'}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>📱 Schedule 1: Liquid Wallets Physical Verification</h5>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified cash count by account</span>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Wallet Account</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Book Balance</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', ...YELLOW_TH }}>Verified Balance (GHS)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Variance</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {model.wallets.map(w => {
                  const v = phys(w.key, w.book)
                  return (
                    <tr key={w.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--secondary)' }}>{w.label}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#2563eb', fontWeight: 700 }}>{currency(w.book)}</td>
                      <td style={YELLOW_TD}><input type="number" step="0.01" className="form-control" style={{ ...INPUT, color: '#1e3a8a' }} value={counts[w.key] ?? Math.round(w.book * 100) / 100} onChange={e => setCount(w.key, e.target.value)} /></td>
                      <VarCell value={v - w.book} style={{ padding: '8px 10px', fontWeight: 600 }} />
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}><StatusBadge value={v - w.book} size="10px" /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px' }}>Total Liquid Cash Position</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#2563eb', fontSize: '13px' }}>{currency(model.cashBook)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1e3a8a', fontSize: '13px' }}>{currency(cashPhys)}</td>
                  <VarCell value={cashPhys - model.cashBook} style={{ padding: '8px 10px' }} />
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><StatusBadge value={cashPhys - model.cashBook} size="10px" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>👥 Schedule 2: Receivables Debtors &amp; Advances</h5>
            <a href="#receivables" onClick={e => { e.preventDefault(); ctx.goTo('receivables') }} className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '2px 8px' }}>Receivables Hub →</a>
          </div>
          <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Customer / Party</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Open Invoices</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Outstanding Due</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Classification</th>
                </tr>
              </thead>
              <tbody>
                {model.debtors.map(d => (
                  <tr key={d.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--secondary)' }}>{d.name}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{d.open} invoices</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{currency(d.due)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}><span className="badge badge-warning" style={{ fontSize: '10px' }}>Trade AR</span></td>
                  </tr>
                ))}
                <tr style={{ background: '#fdf4ff', borderTop: '1px dashed #d8b4fe' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#6366f1' }}>Other Receivables (Staff Advances)</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{(otherReceivables.statement || []).length} records</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{currency(model.otherAr)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><span className="badge badge-info" style={{ fontSize: '10px' }}>Advances</span></td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
                  <td colSpan={2} style={{ padding: '8px 10px' }}>Total Combined Receivables</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309', fontSize: '13px' }}>{currency(model.tradeAr + model.otherAr)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><span className="badge badge-success" style={{ fontSize: '10.5px' }}>Reconciled</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>🥛 Schedule 3: Finished Goods Physical Stocktake ({model.fg.length} Sizes)</h5>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Valued at unit batch cost</span>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>Size</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Book Btls</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', ...YELLOW_TH }}>Physical Btls</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Physical Value</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Variance</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {model.fg.map(f => {
                  const q = phys(f.key, f.book)
                  const v = (q - f.book) * f.unitCost
                  return (
                    <tr key={f.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--secondary)' }}>{f.size}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#64748b' }}>{currency(f.unitCost)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{f.book}</td>
                      <td style={{ ...YELLOW_TD, padding: '4px 6px' }}><input type="number" min="0" step="1" className="form-control" style={{ ...INPUT, color: '#059669' }} value={counts[f.key] ?? f.book} onChange={e => setCount(f.key, e.target.value)} /></td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{currency(Math.max(0, q) * f.unitCost)}</td>
                      <VarCell value={v} style={{ padding: '8px 6px', fontWeight: 600 }} />
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}><StatusBadge value={v} size="9.5px" /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
                  <td colSpan={2} style={{ padding: '8px 6px' }}>Total Finished Goods</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>{model.fgUnits} btls</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>{fgPhysUnits} btls</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669', fontSize: '13px' }}>{currency(fgPhys)}</td>
                  <VarCell value={fgPhys - model.fgBook} style={{ padding: '8px 6px' }} />
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}><StatusBadge value={fgPhys - model.fgBook} size="10px" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>🧪 Schedule 4: Raw Materials &amp; Supplies Categories</h5>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowRm(v => !v)} style={{ fontSize: '11px', padding: '2px 8px' }}>{showRm ? 'Hide Items ↑' : `🔍 Itemize ${model.rm.length} SKUs ↓`}</button>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>SKUs</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Opening Val</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Purchased (+)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Used (−)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Book Stock Value</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {model.categories.map(c => {
                  const items = model.rm.filter(r => r.category === c.category)
                  const v = items.reduce((t, r) => t + (Math.max(0, phys(r.key, r.book)) - Math.max(0, r.book)) * r.unitCost, 0)
                  return (
                    <tr key={c.category} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: 'var(--secondary)' }}>{c.category}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{c.count} items</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{currency(c.open)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#059669' }}>+{currency(c.purchased)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>-{currency(c.used)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{currency(c.book)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}><StatusBadge value={v} size="10px" /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px' }}>Total Raw Materials</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{model.rm.length} items</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{currency(model.rmOpen)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#059669' }}>+{currency(model.rmPurchased)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>-{currency(model.rmUsed)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#7c3aed', fontSize: '13px' }}>{currency(model.rmBook)}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><StatusBadge value={rmPhys - model.rmBook} size="10.5px" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {showRm ? (
        <div style={{ background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '14px 16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>🧪 Item-by-Item Physical Count Sheet (All {model.rm.length} Raw Materials)</h5>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Record physical quantity on hand for each material SKU. Valuation multiplies by unit cost automatically.</div>
            </div>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowRm(false)} style={{ fontSize: '11px' }}>Hide Table ↑</button>
          </div>
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Item Code</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Item Name</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Unit</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Book Qty</th>
                  <th style={{ padding: '8px', textAlign: 'right', ...YELLOW_TH }}>Physical Count</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Physical Value</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Variance</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {model.rm.map(r => {
                  const q = phys(r.key, r.book)
                  const v = (q - r.book) * r.unitCost
                  return (
                    <tr key={r.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', color: 'var(--secondary)' }}>{r.code}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{r.category}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{r.unit}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>{currency(r.unitCost)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Math.round(r.book * 1000) / 1000}</td>
                      <td style={{ ...YELLOW_TD, padding: '4px 6px' }}><input type="number" min="0" step="0.01" className="form-control" style={{ ...INPUT, color: '#7c3aed' }} value={counts[r.key] ?? Math.round(r.book * 1000) / 1000} onChange={e => setCount(r.key, e.target.value)} /></td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{currency(Math.max(0, q) * r.unitCost)}</td>
                      <VarCell value={v} style={{ padding: '6px 8px', fontWeight: 600 }} />
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}><StatusBadge value={v} size="9.5px" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🛡️</span>
          <span>Ready to certify? Saving records this snapshot in the audit log on this device and flags any shrinkage or discrepancy.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-sm btn-secondary" onClick={printSchedule} style={{ fontSize: '12px' }}>🖨️ Print Reconciliation Schedule</button>
          <button type="button" className="btn btn-sm" onClick={() => saveSnapshot()} style={{ fontSize: '12.5px', fontWeight: 700, padding: '6px 16px', background: '#059669', borderColor: '#059669', color: '#fff' }}>💾 Save &amp; Certify Reconciliation Snapshot</button>
        </div>
      </div>

      {log.length ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>📜 Physical Reconciliation Audit Log &amp; Verification History</h5>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last {log.length} recorded audits</span>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Audit Ref</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Audit Date</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Auditor</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Source</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>System Book Assets</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Verified Physical Assets</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Variance</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {log.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--primary)' }}>AUD-REC-{a.id}</td>
                    <td style={{ padding: '8px 10px' }}>{a.date}</td>
                    <td style={{ padding: '8px 10px' }}>{a.auditor}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}><span className="badge badge-secondary" style={{ fontSize: '10px' }}>{a.source}</span></td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{currency(a.book)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{currency(a.physical)}</td>
                    <VarCell value={a.variance} style={{ padding: '8px 10px' }} />
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}><StatusBadge value={a.variance} size="10px" /></td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{a.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ClassicReconciliation
