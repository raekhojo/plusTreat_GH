import './ReportingOverview.css'

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) {
  const n = num(v)
  return `${n < 0 ? '−' : ''}GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))}`
}

// One figure in a statement line. Costs are passed as positive amounts and
// shown after a "−" operator, so the line reads like the statement itself.
function Figure({ label, value, result = false }) {
  return (
    <div className={`ro-figure${result ? ' is-result' : ''}${result && num(value) < 0 ? ' is-negative' : ''}`}>
      <span className="ro-label">{label}</span>
      <strong className="ro-value">{money(value)}</strong>
    </div>
  )
}
const Op = ({ children }) => <span className="ro-op" aria-hidden="true">{children}</span>

function ReportingOverview({ pl, position, periodNote = '', tabs = [], activeTab, onTab, actions = null }) {
  return (
    <div className="ro-wrap">
      <section className="ro-card" aria-label="Financial summary">
        <div className="ro-line" aria-label="Profit and loss">
          <span className="ro-kicker">Profit &amp; loss</span>
          <div className="ro-flow">
            <Figure label="Income" value={pl.income} />
            <Op>−</Op>
            <Figure label="Direct cost" value={Math.abs(num(pl.directCost))} />
            <Op>=</Op>
            <Figure label="Gross profit" value={pl.gross} />
            <Op>−</Op>
            <Figure label="Expenses" value={Math.abs(num(pl.expenses))} />
            <Op>=</Op>
            <Figure label="Net profit" value={pl.net} result />
          </div>
        </div>
        <div className="ro-line" aria-label="Financial position">
          <span className="ro-kicker">Position</span>
          <div className="ro-flow">
            <Figure label="Assets" value={position.assets} />
            <Op>−</Op>
            <Figure label="Liabilities" value={Math.abs(num(position.liabilities))} />
            <Op>=</Op>
            <Figure label="Equity" value={position.equity} result />
          </div>
        </div>
        {periodNote ? <p className="ro-note">{periodNote}</p> : null}
      </section>

      <div className="ro-bar">
        <div className="ro-tabs" role="tablist" aria-label="Reporting views">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === activeTab}
              className={t.key === activeTab ? 'is-active' : ''}
              onClick={() => onTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {actions ? <div className="ro-actions">{actions}</div> : null}
      </div>
    </div>
  )
}

export default ReportingOverview
