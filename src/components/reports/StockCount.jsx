import { useMemo, useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import { printReport } from '../../lib/printDocuments'
import './StockCount.css'

// Physical asset count vs. book balances (ported from PlusYoghurt-App's asset
// reconciliation). Counts are kept as a draft in this browser — the backend has
// no audit table — and can be exported to Excel / PDF as the audit record.
const DRAFT_KEY = 'plusTreatStockCountDraft'

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v)) }
function qty(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(num(v)) }
function mlOf(text) {
  const t = String(text || '').toLowerCase().replaceAll(',', '')
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (ml) return num(ml[1])
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/)
  return l ? num(l[1]) * 1000 : 0
}
function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || null } catch { return null }
}

function StockCount({ treasury, invoices = [], otherReceivablesBalance = 0, inventoryLedger = [], rawMaterials = [], productionBatches = [], onExport, defaultAuditor = '' }) {
  const draft = readDraft()
  const [counts, setCounts] = useState(() => draft?.counts || {})
  const [notes, setNotes] = useState(() => draft?.notes || {})
  const [meta, setMeta] = useState(() => draft?.meta || { auditor: defaultAuditor, date: new Date().toISOString().slice(0, 10), remarks: '' })
  const [message, setMessage] = useState('')
  const [onlyVariances, setOnlyVariances] = useState(false)
  const fileRef = useRef(null)

  const items = useMemo(() => {
    const costAgg = new Map()
    productionBatches.forEach(b => (b.outputs || []).forEach(o => {
      const k = mlOf(o.product_size); const q = num(o.quantity)
      if (!k || q <= 0) return
      const c = costAgg.get(k) || { q: 0, a: 0 }; c.q += q; c.a += num(o.amount) || q * num(o.unit_cost); costAgg.set(k, c)
    }))
    const fgCost = ml => { const c = costAgg.get(ml); return c && c.q > 0 ? c.a / c.q : 0 }
    const list = []
    ;(treasury?.wallets || []).forEach(w => list.push({ key: `CASH-${w.key}`, group: 'Cash & bank', label: w.label, unit: 'GHS', book: w.balance, unitCost: 1 }))
    list.push({ key: 'AR-TRADE', group: 'Receivables', label: 'Customer trade receivables', unit: 'GHS', book: invoices.reduce((t, i) => t + Math.max(0, num(i.outstanding_balance)), 0), unitCost: 1 })
    list.push({ key: 'AR-OTHER', group: 'Receivables', label: 'Other receivables (staff & home advances)', unit: 'GHS', book: otherReceivablesBalance, unitCost: 1 })
    ;[...inventoryLedger].sort((a, b) => mlOf(a.size) - mlOf(b.size)).forEach(f => list.push({ key: `FG-${f.size}`, group: 'Finished goods', label: `Plus Yoghurt ${f.size}`, unit: 'Bottles', book: num(f.available), unitCost: fgCost(mlOf(f.size)) }))
    ;[...rawMaterials].sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name).localeCompare(String(b.name))).forEach(m => list.push({
      key: `RM-${m.id}`,
      group: `Raw materials${m.category ? ` · ${m.category}` : ''}`,
      label: m.name,
      unit: m.unit || '',
      book: num(m.available ?? (num(m.opening_stock) + num(m.stock_in) - num(m.stock_out))),
      unitCost: num(m.unit_price),
    }))
    return list
  }, [treasury, invoices, otherReceivablesBalance, inventoryLedger, rawMaterials, productionBatches])

  const rows = items.map(it => {
    const raw = counts[it.key]
    const counted = raw !== undefined && raw !== ''
    const physical = counted ? num(raw) : null
    const varQty = counted ? physical - it.book : 0
    const varValue = varQty * it.unitCost
    const status = !counted ? 'Not counted' : Math.abs(varValue) < 0.005 && Math.abs(varQty) < 0.0005 ? 'Balanced' : varQty > 0 ? 'Surplus' : 'Shortage'
    return { ...it, counted, physical, varQty, varValue, status, note: notes[it.key] || '' }
  })
  const countedRows = rows.filter(r => r.counted)
  const bookValue = rows.reduce((t, r) => t + r.book * r.unitCost, 0)
  const physicalValue = countedRows.reduce((t, r) => t + r.physical * r.unitCost, 0) + rows.filter(r => !r.counted).reduce((t, r) => t + r.book * r.unitCost, 0)
  const netVariance = countedRows.reduce((t, r) => t + r.varValue, 0)
  const varianceRows = countedRows.filter(r => r.status !== 'Balanced')
  const shown = onlyVariances ? varianceRows : rows
  const groups = [...new Set(shown.map(r => r.group))]

  const persist = (nextCounts = counts, nextNotes = notes, nextMeta = meta) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ counts: nextCounts, notes: nextNotes, meta: nextMeta, savedAt: new Date().toISOString() }))
  }
  const setCount = (key, value) => { const next = { ...counts, [key]: value }; setCounts(next); persist(next) }
  const setNote = (key, value) => { const next = { ...notes, [key]: value }; setNotes(next); persist(counts, next) }
  const setMetaField = (field, value) => { const next = { ...meta, [field]: value }; setMeta(next); persist(counts, notes, next) }
  const copyBook = () => { const next = Object.fromEntries(items.map(it => [it.key, String(Math.round(it.book * 1000) / 1000)])); setCounts(next); persist(next); setMessage('Book balances copied into the physical count. Now adjust anything that differs.') }
  const clearAll = () => { setCounts({}); setNotes({}); persist({}, {}); setMessage('Count cleared.') }

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Count sheet')
    ws.columns = [
      { header: 'Key', key: 'key', width: 22 },
      { header: 'Group', key: 'group', width: 26 },
      { header: 'Item', key: 'label', width: 36 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Book Qty', key: 'book', width: 14 },
      { header: 'Unit Cost', key: 'unitCost', width: 12 },
      { header: 'Physical Count', key: 'physical', width: 16 },
      { header: 'Notes', key: 'note', width: 30 },
    ]
    items.forEach(it => ws.addRow({ ...it, book: Math.round(it.book * 1000) / 1000, unitCost: Math.round(it.unitCost * 10000) / 10000, physical: '', note: '' }))
    ws.getRow(1).font = { bold: true }
    ws.getColumn('physical').eachCell((cell, n) => { if (n > 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7D6' } } })
    const buf = await wb.xlsx.writeBuffer()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    link.download = `Plus_Treats_Stock_Count_Sheet_${meta.date || 'today'}.xlsx`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const uploadSheet = async (file) => {
    if (!file) return
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      const header = ws.getRow(1).values.map(v => String(v || '').trim().toLowerCase())
      const keyCol = header.indexOf('key')
      const physCol = header.findIndex(h => h.startsWith('physical'))
      const noteCol = header.indexOf('notes')
      if (keyCol < 0 || physCol < 0) throw new Error('This file is not a count sheet — download the template first.')
      const nextCounts = { ...counts }
      const nextNotes = { ...notes }
      let n = 0
      ws.eachRow((row, idx) => {
        if (idx === 1) return
        const key = String(row.getCell(keyCol).value ?? '').trim()
        const phys = row.getCell(physCol).value
        const physValue = typeof phys === 'object' && phys !== null ? phys.result : phys
        if (!key || physValue === null || physValue === undefined || physValue === '') return
        nextCounts[key] = String(physValue)
        if (noteCol > 0 && row.getCell(noteCol).value) nextNotes[key] = String(row.getCell(noteCol).value)
        n += 1
      })
      setCounts(nextCounts); setNotes(nextNotes); persist(nextCounts, nextNotes)
      setMessage(`Imported ${n} counted item${n === 1 ? '' : 's'} from “${file.name}”.`)
    } catch (err) {
      setMessage(err.message || 'Could not read that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const resultColumns = ['Item', 'Group', 'Unit', 'Book qty', 'Physical', 'Variance qty', 'Unit cost', 'Variance (GHS)', 'Status', 'Notes']
  const resultCells = r => [r.label, r.group, r.unit, qty(r.book), r.counted ? qty(r.physical) : '—', r.counted ? qty(r.varQty) : '—', money(r.unitCost), r.counted ? money(r.varValue) : '—', r.status, r.note]
  const exportExcel = () => onExport?.(`Plus_Treats_Stock_Count_${meta.date || ''}`, resultColumns, rows.map((r, i) => ({ id: i, cells: resultCells(r) })))
  const exportPdf = () => printReport({
    title: 'Stock count & asset reconciliation',
    subtitle: `${meta.date || ''} · counted by ${meta.auditor || '—'}`,
    columns: ['Item', 'Unit', 'Book qty', 'Physical', 'Variance qty', 'Variance (GHS)', 'Status'],
    rows: groups.flatMap(g => [{ section: g }, ...shown.filter(r => r.group === g).map(r => [r.label, r.unit, qty(r.book), r.counted ? qty(r.physical) : '—', r.counted ? qty(r.varQty) : '—', r.counted ? money(r.varValue) : '—', r.status])]),
    totals: [['Net variance', '', '', '', '', money(netVariance), `${varianceRows.length} item(s) differ`]],
    note: meta.remarks || '',
  })

  return (
    <section className="sc-wrap" aria-label="Stock count">
      <header className="sc-head">
        <div>
          <h2>Stock count &amp; asset reconciliation</h2>
          <p>Count cash, receivables, finished goods and raw materials, and compare with the books. Your count is saved as a draft in this browser — export it to keep a record.</p>
        </div>
        <div className="sc-actions">
          <button type="button" className="rc-btn" onClick={downloadTemplate}>Download count sheet</button>
          <button type="button" className="rc-btn" onClick={() => fileRef.current?.click()}>Upload filled sheet</button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={e => uploadSheet(e.target.files?.[0])} />
          <button type="button" className="rc-btn" onClick={exportExcel}>Export Excel</button>
          <button type="button" className="rc-btn rc-btn-primary" onClick={exportPdf}>Print / PDF</button>
        </div>
      </header>

      <div className="sc-meta">
        <label><span>Counted by</span><input type="text" value={meta.auditor} onChange={e => setMetaField('auditor', e.target.value)} /></label>
        <label><span>Count date</span><input type="date" value={meta.date} onChange={e => setMetaField('date', e.target.value)} /></label>
        <label className="sc-meta-wide"><span>Remarks</span><input type="text" value={meta.remarks} onChange={e => setMetaField('remarks', e.target.value)} placeholder="Anything the reviewer should know" /></label>
        <div className="sc-meta-btns">
          <button type="button" className="rc-btn" onClick={copyBook}>Copy book → physical</button>
          <button type="button" className="rc-btn" onClick={clearAll}>Clear count</button>
        </div>
      </div>
      {message ? <p className="sc-message" role="status">{message}</p> : null}

      <div className="sc-stats">
        <div><span>Items</span><strong>{countedRows.length} / {rows.length}</strong><em>counted</em></div>
        <div><span>Book value</span><strong>GHS {money(bookValue)}</strong></div>
        <div><span>Physical value</span><strong>GHS {money(physicalValue)}</strong><em>uncounted items at book</em></div>
        <div className={Math.abs(netVariance) < 0.005 ? 'is-good' : 'is-bad'}><span>Net variance</span><strong>GHS {money(netVariance)}</strong><em>{varianceRows.length} item{varianceRows.length === 1 ? '' : 's'} differ</em></div>
      </div>

      <label className="sc-toggle"><input type="checkbox" checked={onlyVariances} onChange={e => setOnlyVariances(e.target.checked)} /> Show only items that differ</label>

      <div className="sc-table-scroll">
        <table className="sc-table">
          <thead><tr><th>Item</th><th>Unit</th><th className="num">Book qty</th><th className="num">Physical count</th><th className="num">Variance</th><th className="num">Variance (GHS)</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            {groups.map(g => [
              <tr key={`g-${g}`} className="sc-group"><td colSpan={8}>{g}</td></tr>,
              ...shown.filter(r => r.group === g).map(r => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td className="sc-muted">{r.unit}</td>
                  <td className="num">{qty(r.book)}</td>
                  <td className="num"><input type="number" step="any" value={counts[r.key] ?? ''} placeholder="—" onChange={e => setCount(r.key, e.target.value)} aria-label={`Physical count for ${r.label}`} /></td>
                  <td className={`num${r.counted && r.status !== 'Balanced' ? ' sc-diff' : ''}`}>{r.counted ? qty(r.varQty) : '—'}</td>
                  <td className={`num${r.counted && r.status !== 'Balanced' ? ' sc-diff' : ''}`}>{r.counted ? money(r.varValue) : '—'}</td>
                  <td><span className={`sc-badge sc-${r.status.replace(' ', '-').toLowerCase()}`}>{r.status === 'Balanced' ? '✓ ' : r.status === 'Not counted' ? '' : '! '}{r.status}</span></td>
                  <td><input type="text" className="sc-note" value={notes[r.key] || ''} onChange={e => setNote(r.key, e.target.value)} aria-label={`Notes for ${r.label}`} /></td>
                </tr>
              )),
            ])}
            {!shown.length ? <tr><td colSpan={8} className="rc-empty">{onlyVariances ? 'No variances — everything counted matches the books.' : 'Nothing to count yet.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default StockCount
