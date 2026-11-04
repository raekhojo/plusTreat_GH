import './PositionStats.css'

function money(v) {
  const n = Number(v)
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0)}`
}

const WALLET_ICONS = {
  Cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /></>,
  'MoMo Wallet': <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></>,
  GhanaPay: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M3 10.5h18M16 15h2" /></>,
  CalBank: <><path d="M3 9.5 12 4l9 5.5" /><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17" /></>,
}
const WALLET_ORDER = ['Cash', 'MoMo Wallet', 'GhanaPay', 'CalBank']

// One small card per wallet (balance today), each with a View button that opens its statement.
export function WalletCards({ treasury, onViewWallet }) {
  const wallets = treasury ? WALLET_ORDER.map(k => treasury.wallets.find(w => w.key === k)).filter(Boolean) : []
  if (!wallets.length) return null
  return (
    <div className="ps-wallets" aria-label="Wallet balances">
      {wallets.map(w => (
        <div key={w.key} className={`ps-wallet${w.balance < 0 ? ' is-negative' : ''}`}>
          <span className="ps-wallet-copy">
            <span className="ps-wallet-name">
              <svg viewBox="0 0 24 24" aria-hidden="true">{WALLET_ICONS[w.key]}</svg>
              {w.label}
            </span>
            <strong className="ps-wallet-amount">{money(w.balance)}</strong>
          </span>
          {onViewWallet ? <button type="button" className="ps-view" onClick={() => onViewWallet(w.key)} aria-label={`View ${w.label} statement`}>View</button> : null}
        </div>
      ))}
    </div>
  )
}
