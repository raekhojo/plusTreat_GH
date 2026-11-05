import './AuditMonitor.css'
import { useMemo, useState } from 'react'

// System integrity findings, after the ERP's audit monitor: problems found in the
// live records, each with a recommended action. Acknowledged ones are remembered on this device.
const ACK_KEY = 'plusTreatAcknowledgedFlags'
function readAck() {
  try { return JSON.parse(localStorage.getItem(ACK_KEY) || '[]') } catch { return [] }
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) {
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}`
}
function qty(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num(v)) }

const SEVERITY = { danger: ['Critical', 'is-bad'], warning: ['Warning', 'is-warn'], info: ['Info', 'is-info'] }

function AuditMonitor({ treasury, batches, inventoryLedger, rawMaterials }) {
  const [ack, setAck] = useState(readAck)
  const flags = useMemo(() => {
    const list = []
    treasury.wallets.filter(w => w.balance < 0).forEach(w => list.push({
      id: `wallet-${w.key}`, severity: 'danger', title: `${w.label} wallet balance is negative`, ref: w.label,
      description: `The book balance is ${money(w.balance)}: more money has been recorded out of this wallet than in.`,
      action: 'Check the cashbook for a missing receipt, a transfer recorded the wrong way, or an expense against the wrong wallet.',
    }))
    const loss = batches.filter(b => {
      const value = num(b.total_production_value) || (b.outputs || []).reduce((t, o) => t + num(o.amount), 0)
      return value - num(b.total_cost) < 0
    })
    if (loss.length) list.push({
      id: `batches-loss-${loss.map(b => b.id).join('-')}`, severity: 'warning', title: `${loss.length} production batch${loss.length === 1 ? '' : 'es'} recorded at a loss`,
      ref: loss.slice(0, 4).map(b => b.batch_number || `#${b.id}`).join(', ') + (loss.length > 4 ? '…' : ''),
      description: 'Total cost is higher than the output value for these batches.',
      action: 'Verify the raw material quantities and overheads entered for each batch.',
    })
    inventoryLedger.filter(i => num(i.productionLevel) > 0 && num(i.available) <= num(i.productionLevel)).forEach(i => list.push({
      id: `fg-${i.size}`, severity: 'warning', title: `${i.size} finished goods at reorder level`, ref: i.size,
      description: `Only ${qty(i.available)} bottles in stock (minimum ${qty(i.productionLevel)}).`,
      action: 'Schedule a production batch for this size.',
    }))
    const low = rawMaterials.filter(m => num(m.available) <= num(m.reorder_level))
    if (low.length) list.push({
      id: `rm-low-${low.map(m => m.id).join('-')}`, severity: 'info', title: `${low.length} raw material${low.length === 1 ? '' : 's'} below reorder level`,
      ref: low.slice(0, 4).map(m => m.name).join(', ') + (low.length > 4 ? '…' : ''),
      description: 'Stock on hand is at or below the reorder level.',
      action: 'Raise purchases with the suppliers.',
    })
    return list
  }, [treasury.wallets, batches, inventoryLedger, rawMaterials])

  const open = flags.filter(f => !ack.includes(f.id))
  const acknowledge = id => {
    const next = [...new Set([...ack, id])]
    setAck(next)
    try { localStorage.setItem(ACK_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }

  return (
    <section className="fa-card" aria-label="Audit findings">
      <header className="fa-head">
        <h2>Audit Monitor</h2>
        <span className={`fa-status ${open.length ? 'is-open' : 'is-clear'}`}>{open.length ? `${open.length} open finding${open.length === 1 ? '' : 's'}` : 'All clear'}</span>
      </header>
      {open.length ? (
        <div className="fa-list">
          {open.map(flag => {
            const [label, cls] = SEVERITY[flag.severity]
            return (
              <div key={flag.id} className="fa-flag">
                <div className="fa-flag-main">
                  <div className="fa-flag-title">
                    <span className={`fa-badge ${cls}`}>{label}</span>
                    <strong>{flag.title}</strong>
                    <span className="fa-ref">{flag.ref}</span>
                  </div>
                  <p>{flag.description}</p>
                  <p className="fa-action">{flag.action}</p>
                </div>
                <button type="button" className="fa-ack" onClick={() => acknowledge(flag.id)}>Acknowledge</button>
              </div>
            )
          })}
        </div>
      ) : <p className="fa-empty">No open audit findings.</p>}
    </section>
  )
}

export default AuditMonitor
