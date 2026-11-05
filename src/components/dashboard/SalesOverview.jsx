import { useEffect, useMemo, useRef, useState } from 'react'
import ExportMenu from '../ExportMenu'
import { WalletCards } from './PositionStats'
import './SalesOverview.css'

// ─── Palette (validated: scripts/validate_palette.js, light mode on #ffffff) ──
// Categorical slots are assigned in fixed order to entities ranked by LIFETIME
// revenue, so a customer category keeps its colour whatever period is selected.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const OTHER_COLOR = '#a3a29b'
const ACCENT = '#1c5cab'
const ACCENT_SOFT = '#86b6ef'
const HEAT = ['#cde2fb', '#9ec5f4', '#5598e7', '#256abf', '#104281']
const AGEING = ['#86b6ef', '#3987e5', '#1c5cab', '#0d366b']
const METHOD_ORDER = ['cash', 'momo', 'bank_transfer', 'ghanapay', 'other']
const METHOD_LABELS = { cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', ghanapay: 'GhanaPay', other: 'Other' }

const DAY_MS = 86400000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']
const QUIET_DAYS = 60
const LOOKBACK_DAYS = 182

// ─── Small helpers ────────────────────────────────────────────────────────────
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function dayIndex(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return NaN
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS)
}
function todayIndex() {
  const n = new Date()
  return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS)
}
function dateOf(idx) { return new Date(idx * DAY_MS) }
function weekdayOf(idx) { return (dateOf(idx).getUTCDay() + 6) % 7 } // Mon = 0
function fmtDay(idx, withYear = true) {
  return dateOf(idx).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}
function fmtMonth(idx) { return dateOf(idx).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) }
function money(v) {
  return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}`
}
function compact(v, digits = 1) {
  const n = num(v)
  if (Math.abs(n) < 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
  return new Intl.NumberFormat('en-US', { notation: 'compact', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}
function moneyCompact(v, digits = 1) { return `GHS ${compact(v, digits)}` }
function count(v) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num(v)) }
function pctChange(cur, prev) {
  if (prev === null || prev === undefined || !Number.isFinite(prev) || prev <= 0) return null
  return ((cur - prev) / prev) * 100
}
function sizeKey(v) { return String(v || '').toLowerCase().replaceAll(',', '').replace(/\s+/g, '') }
function sizeMl(v) {
  const text = sizeKey(v)
  const ml = text.match(/(\d+(?:\.\d+)?)ml/)
  if (ml) return num(ml[1])
  const l = text.match(/(\d+(?:\.\d+)?)l\b/)
  return l ? num(l[1]) * 1000 : 0
}
function niceStep(max, ticks = 4) {
  if (max <= 0) return 1
  const raw = max / ticks
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow
}

// Monotone cubic (Fritsch–Carlson) — smooth without overshooting the data.
function monotonePath(xs, ys) {
  const n = xs.length
  if (!n) return ''
  if (n === 1) return `M${xs[0]},${ys[0]}`
  const dx = []
  const m = []
  for (let i = 0; i < n - 1; i += 1) { dx[i] = xs[i + 1] - xs[i]; m[i] = (ys[i + 1] - ys[i]) / dx[i] }
  const t = new Array(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i += 1) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let d = `M${xs[0]},${ys[0]}`
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3
    d += `C${xs[i] + h},${ys[i] + t[i] * h} ${xs[i + 1] - h},${ys[i + 1] - t[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`
  }
  return d
}

function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => setWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// One tooltip for the whole overview, positioned at the pointer (or the focused mark).
function useTooltip() {
  const [tip, setTip] = useState(null)
  const show = (event, content) => {
    let x = event?.clientX
    let y = event?.clientY
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const r = event?.currentTarget?.getBoundingClientRect?.()
      if (r) { x = r.left + r.width / 2; y = r.top }
    }
    setTip({ x, y, content })
  }
  const hide = () => setTip(null)
  return { tip, show, hide }
}

function Tooltip({ tip }) {
  if (!tip) return null
  const left = Math.min(Math.max(tip.x + 14, 8), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260)
  const top = Math.max(tip.y - 12, 8)
  return <div className="so-tooltip" style={{ left, top }} role="status">{tip.content}</div>
}

function TipRow({ color, label, value, line = true }) {
  return (
    <div className="so-tip-row">
      {color ? <span className={line ? 'so-tip-key' : 'so-tip-swatch'} style={{ background: color }} /> : null}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function Delta({ value, upIsGood = true, suffix = 'vs prior period' }) {
  if (value === null || value === undefined) return <span className="so-delta so-delta-flat">No sales in prior period</span>
  const up = value >= 0
  const good = up === upIsGood
  return (
    <span className={`so-delta ${good ? 'so-delta-good' : 'so-delta-bad'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(value).toFixed(1)}%{suffix ? <em> {suffix}</em> : null}
    </span>
  )
}

function Card({ title, subtitle, actions, className = '', children }) {
  return (
    <article className={`so-card ${className}`.trim()}>
      {(title || actions) ? (
        <header className="so-card-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="so-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </article>
  )
}

function Empty({ children = 'No sales recorded in this period.' }) {
  return <p className="so-empty">{children}</p>
}

// ─── Period control ───────────────────────────────────────────────────────────
function PeriodBar({ presets, activePreset, onSelect, onCustom, rangeLabel, onExport }) {
  return (
    <div className="so-period-row">
      <div className="so-period-pills" role="group" aria-label="Dashboard period">
        {presets.map(p => (
          <button
            key={p.key || 'all'}
            type="button"
            className={`so-pill${activePreset === p.key ? ' is-active' : ''}`}
            aria-pressed={activePreset === p.key}
            onClick={() => onSelect(p.key)}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className={`so-pill${activePreset === 'custom' ? ' is-active' : ''}`} onClick={onCustom}>Custom…</button>
      </div>
      <span className="so-period-label">{rangeLabel}</span>
      {onExport ? <ExportMenu onExport={onExport} className="so-export" /> : null}
    </div>
  )
}

// ─── Tall segmented bar (revenue by customer category) ───────────────────────
function SegmentedBar({ segments, total, tooltip }) {
  const visible = segments.filter(s => s.value > 0)
  if (!visible.length || total <= 0) return null
  const label = visible.map(s => `${s.name} ${money(s.value)} (${((s.value / total) * 100).toFixed(0)}%)`).join(', ')
  return (
    <section className="so-segments" aria-label="Revenue by customer category">
      <div className="so-segbar" role="img" aria-label={`Revenue by customer category: ${label}`}>
        {visible.map(s => {
          const share = (s.value / total) * 100
          const content = (
            <>
              <div className="so-tip-title">{s.name}</div>
              <TipRow color={s.color} line={false} label={`${share.toFixed(1)}% of revenue`} value={money(s.value)} />
            </>
          )
          return (
            <div
              key={s.name}
              className="so-segbar-block"
              style={{ flexGrow: s.value, background: s.color, color: s.ink }}
              tabIndex={0}
              aria-label={`${s.name}: ${money(s.value)}, ${share.toFixed(1)}%`}
              onPointerMove={e => tooltip.show(e, content)}
              onPointerLeave={tooltip.hide}
              onFocus={e => tooltip.show(e, content)}
              onBlur={tooltip.hide}
            >
              {share >= 7 ? <span>{share.toFixed(0)}%</span> : null}
            </div>
          )
        })}
      </div>
      <ul className="so-seg-legend" style={{ '--so-seg-count': segments.length }}>
        {segments.map(s => (
          <li key={s.name} className="so-seg-legend-item" style={{ '--so-seg-color': s.color }}>
            <span className="so-seg-name" title={s.name}>{s.name}</span>
            <strong className="so-seg-value">{moneyCompact(s.value, 2)}</strong>
            {s.prevValue === null
              ? null
              : s.prevValue <= 0 && s.value > 0
                ? <span className="so-delta so-delta-good"><span aria-hidden="true">▲</span> New</span>
                : <Delta value={s.delta} suffix="" />}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Stat tiles ───────────────────────────────────────────────────────────────
function Sparkline({ values }) {
  const w = 180
  const h = 34
  if (!values?.length) return null
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const xs = values.map((_, i) => (values.length === 1 ? w : (i / (values.length - 1)) * (w - 6)) + 2)
  const ys = values.map(v => h - 4 - ((v - min) / span) * (h - 10))
  const line = monotonePath(xs, ys)
  const area = `${line}L${xs[xs.length - 1]},${h}L${xs[0]},${h}Z`
  return (
    <svg className="so-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={ACCENT} opacity="0.1" />
      <path d={line} fill="none" stroke={ACCENT_SOFT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.5" fill={ACCENT} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Stat-strip tile for balances "as of today" (a note instead of a period-on-period change).
function PositionTile({ label, value, fullValue, note, alert, trend }) {
  return (
    <div className="so-stat" title={fullValue}>
      <span className="so-stat-label">{label}</span>
      <strong className="so-stat-value">{value}</strong>
      <span className="so-delta so-delta-flat">{note}</span>
      {alert ? <span className="so-position-alert"><span aria-hidden="true">!</span> {alert}</span> : null}
      <Sparkline values={trend} />
    </div>
  )
}

// ─── Stacked area: revenue over time by customer category ────────────────────
function StackedArea({ buckets, series, tooltip }) {
  const [ref, width] = useElementWidth()
  const [hover, setHover] = useState(null)
  const plotH = 240
  const pad = { top: 10, right: 16, bottom: 26, left: 48 }
  const totals = buckets.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0))
  const step = niceStep(Math.max(...totals, 0))
  const yMax = Math.max(step * Math.ceil(Math.max(...totals, 0) / step), step)
  const innerW = Math.max(width - pad.left - pad.right, 10)
  const x = i => pad.left + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW)
  const y = v => pad.top + plotH - (v / yMax) * plotH
  const ticks = []
  for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v)

  const layers = useMemo(() => {
    const cum = buckets.map(() => 0)
    return series.map(ser => {
      const lower = [...cum]
      ser.values.forEach((v, i) => { cum[i] += v })
      return { ...ser, lower, upper: [...cum] }
    })
  }, [buckets, series])

  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(innerW / 56))))

  const showAt = (i, evt) => {
    setHover(i)
    const b = buckets[i]
    tooltip.show(evt, (
      <>
        <div className="so-tip-title">{b.longLabel}</div>
        {[...series].reverse().map(ser => (
          <TipRow key={ser.name} color={ser.color} label={ser.name} value={money(ser.values[i])} />
        ))}
        <div className="so-tip-total"><strong>{money(totals[i])}</strong><span>Total</span></div>
      </>
    ))
  }
  const onMove = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect()
    const px = evt.clientX - rect.left
    const ratio = buckets.length === 1 ? 0 : (px - pad.left) / innerW
    const i = Math.min(buckets.length - 1, Math.max(0, Math.round(ratio * (buckets.length - 1))))
    showAt(i, evt)
  }
  const onKey = (evt) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(evt.key)) return
    evt.preventDefault()
    const cur = hover ?? buckets.length - 1
    const next = Math.min(buckets.length - 1, Math.max(0, cur + (evt.key === 'ArrowRight' ? 1 : -1)))
    const rect = evt.currentTarget.getBoundingClientRect()
    showAt(next, { clientX: rect.left + x(next), clientY: rect.top + pad.top + 20 })
  }
  const clear = () => { setHover(null); tooltip.hide() }

  return (
    <div ref={ref} className="so-area-wrap">
      {width > 0 ? (
        <svg
          width={width}
          height={plotH + pad.top + pad.bottom}
          className="so-area"
          tabIndex={0}
          role="img"
          aria-label="Revenue over time, stacked by customer category. Use left and right arrow keys to read each period."
          onPointerMove={onMove}
          onPointerLeave={clear}
          onKeyDown={onKey}
          onFocus={e => showAt(buckets.length - 1, { clientX: e.currentTarget.getBoundingClientRect().left + x(buckets.length - 1), clientY: e.currentTarget.getBoundingClientRect().top + 30 })}
          onBlur={clear}
        >
          {ticks.map(v => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'so-axis-base' : 'so-gridline'} />
              <text x={pad.left - 8} y={y(v)} className="so-axis-text" textAnchor="end" dominantBaseline="middle">{compact(v, v >= 1000 && v % 1000 ? 1 : 0)}</text>
            </g>
          ))}
          {layers.map(layer => {
            const xs = buckets.map((_, i) => x(i))
            const upper = monotonePath(xs, layer.upper.map(y))
            const lower = monotonePath([...xs].reverse(), [...layer.lower].reverse().map(y))
            return (
              <g key={layer.name}>
                <path d={`${upper}L${lower.slice(1)}Z`} fill={layer.color} />
                <path d={upper} fill="none" stroke="#ffffff" strokeWidth="2" />
              </g>
            )
          })}
          {buckets.map((b, i) => (i % labelEvery === 0 || i === buckets.length - 1) && !(i !== buckets.length - 1 && buckets.length - 1 - i < labelEvery) ? (
            <text key={b.key} x={x(i)} y={pad.top + plotH + 18} className="so-axis-text" textAnchor="middle">{b.label}</text>
          ) : null)}
          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} className="so-crosshair" />
          ) : null}
        </svg>
      ) : null}
    </div>
  )
}

function SeriesTable({ buckets, series }) {
  return (
    <div className="so-table-scroll">
      <table className="so-table">
        <thead>
          <tr><th>Period</th>{series.map(s => <th key={s.name} className="num">{s.name}</th>)}<th className="num">Total</th></tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => (
            <tr key={b.key}>
              <td>{b.longLabel}</td>
              {series.map(s => <td key={s.name} className="num">{money(s.values[i])}</td>)}
              <td className="num"><strong>{money(series.reduce((t, s) => t + s.values[i], 0))}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Waffles: share of revenue by pricing tier ───────────────────────────────
function Waffle({ name, value, share, tooltip }) {
  const filled = Math.round(share)
  const content = (
    <>
      <div className="so-tip-title">{name}</div>
      <TipRow color={ACCENT} line={false} label={`${share.toFixed(1)}% of line revenue`} value={money(value)} />
    </>
  )
  return (
    <div
      className="so-waffle"
      tabIndex={0}
      aria-label={`${name}: ${share.toFixed(0)}% of revenue, ${money(value)}`}
      onPointerMove={e => tooltip.show(e, content)}
      onPointerLeave={tooltip.hide}
      onFocus={e => tooltip.show(e, content)}
      onBlur={tooltip.hide}
    >
      <div className="so-waffle-grid" aria-hidden="true">
        {Array.from({ length: 100 }, (_, i) => <span key={i} className={i >= 100 - filled ? 'is-on' : ''} />)}
      </div>
      <strong className="so-waffle-pct">{share.toFixed(0)}%</strong>
      <span className="so-waffle-name">{name} · {moneyCompact(value, 2)}</span>
    </div>
  )
}

// ─── Product ranking ──────────────────────────────────────────────────────────
function BottleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="so-bottle">
      <path d="M9.5 2h5v3.2c0 .6.3 1.1.7 1.5l.6.6c.7.7 1.2 1.7 1.2 2.7V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10c0-1 .4-2 1.2-2.7l.6-.6c.4-.4.7-.9.7-1.5V2Z" fill="#e8f1fc" stroke={ACCENT} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.2 12.5h9.6V20a1.2 1.2 0 0 1-1.2 1.2H8.4A1.2 1.2 0 0 1 7.2 20v-7.5Z" fill={ACCENT_SOFT} />
    </svg>
  )
}

function ProductRanking({ rows, tooltip }) {
  if (!rows.length) return <Empty />
  const max = Math.max(...rows.map(r => r.revenue), 1)
  return (
    <table className="so-table so-rank">
      <thead><tr><th colSpan={2}>Product</th><th aria-label="Revenue bar" /><th className="num">Revenue</th><th className="num">Margin</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const content = (
            <>
              <div className="so-tip-title">{r.size}</div>
              <TipRow label="bottles sold" value={count(r.qty)} />
              <TipRow label="litres" value={count(r.litres)} />
              <TipRow label="customers" value={count(r.customers)} />
            </>
          )
          return (
            <tr key={r.key} tabIndex={0} onPointerMove={e => tooltip.show(e, content)} onPointerLeave={tooltip.hide} onFocus={e => tooltip.show(e, content)} onBlur={tooltip.hide}>
              <td className="so-rank-icon"><BottleIcon /></td>
              <td><span className="so-rank-name">{r.size}</span><span className="so-rank-sub">{count(r.qty)} bottles · {count(r.litres)} L</span></td>
              <td className="so-rank-bar"><span style={{ width: `${(r.revenue / max) * 100}%` }} /></td>
              <td className="num"><strong>{moneyCompact(r.revenue, 2)}</strong></td>
              <td className="num so-muted">{r.margin === null ? '—' : `${r.margin.toFixed(1)}%`}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Sales rhythm: calendar heatmap + weekday averages ───────────────────────
function SalesRhythm({ rhythm, tooltip }) {
  const [ref, width] = useElementWidth()
  const { weekStart, cols, start, end, daily, thresholds, weekday, best, worst, biggest } = rhythm
  const gap = 3
  const cell = Math.max(6, Math.min(14, Math.floor((width - 30) / Math.max(cols, 1)) - gap))
  const stepPx = cell + gap
  const colorFor = (v) => {
    if (!v) return '#eef1f6'
    let k = 0
    while (k < thresholds.length && v > thresholds[k]) k += 1
    return HEAT[k]
  }
  const months = []
  for (let c = 0; c < cols; c += 1) {
    const first = weekStart + c * 7
    for (let d = 0; d < 7; d += 1) {
      const idx = first + d
      if (idx >= start && idx <= end && dateOf(idx).getUTCDate() === 1) months.push({ c, label: fmtMonth(idx) })
    }
  }
  if (!months.length || months[0].c > 2) months.unshift({ c: 0, label: fmtMonth(Math.max(start, weekStart)) })
  const maxAvg = Math.max(...weekday.map(w => w.avg), 1)

  return (
    <div className="so-rhythm">
      <div ref={ref} className="so-heat-wrap">
        {width > 0 ? (
          <svg width={30 + cols * stepPx} height={18 + 7 * stepPx} role="img" aria-label={`Daily revenue calendar from ${fmtDay(start)} to ${fmtDay(end)}. Darker means more revenue.`}>
            {months.map(m => <text key={`${m.c}-${m.label}`} x={30 + m.c * stepPx} y={10} className="so-axis-text">{m.label}</text>)}
            {[0, 2, 4].map(d => <text key={d} x={0} y={18 + d * stepPx + cell - 2} className="so-axis-text">{WEEKDAYS[d]}</text>)}
            {Array.from({ length: cols }, (_, c) => Array.from({ length: 7 }, (_, d) => {
              const idx = weekStart + c * 7 + d
              if (idx < start || idx > end) return null
              const rec = daily.get(idx)
              const v = rec?.revenue || 0
              const content = (
                <>
                  <div className="so-tip-title">{dateOf(idx).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</div>
                  <TipRow color={colorFor(v)} line={false} label={`${rec?.orders || 0} order${rec?.orders === 1 ? '' : 's'}`} value={money(v)} />
                </>
              )
              return (
                <rect
                  key={idx}
                  x={30 + c * stepPx}
                  y={18 + d * stepPx}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={colorFor(v)}
                  className="so-heat-cell"
                  onPointerMove={e => tooltip.show(e, content)}
                  onPointerLeave={tooltip.hide}
                />
              )
            }))}
          </svg>
        ) : null}
      </div>
      <div className="so-heat-legend" aria-hidden="true">
        <span>Less</span>
        <i style={{ background: '#eef1f6' }} />
        {HEAT.map(c => <i key={c} style={{ background: c }} />)}
        <span>More</span>
      </div>

      <h3 className="so-subhead">Average revenue by weekday</h3>
      <div className="so-weekdays">
        {weekday.map(w => {
          const isBest = best && w.day === best.day
          const content = (
            <>
              <div className="so-tip-title">{WEEKDAY_NAMES[w.day]}</div>
              <TipRow label={`average across ${w.days} day${w.days === 1 ? '' : 's'}`} value={money(w.avg)} />
            </>
          )
          return (
            <div key={w.day} className="so-weekday" tabIndex={0} onPointerMove={e => tooltip.show(e, content)} onPointerLeave={tooltip.hide} onFocus={e => tooltip.show(e, content)} onBlur={tooltip.hide}>
              <div className="so-weekday-track">
                <span style={{ height: `${Math.max(w.avg > 0 ? 3 : 0, (w.avg / maxAvg) * 100)}%`, background: isBest ? ACCENT : ACCENT_SOFT }} />
              </div>
              <span className="so-weekday-label">{WEEKDAYS[w.day]}</span>
              <span className="so-weekday-value">{moneyCompact(w.avg)}</span>
            </div>
          )
        })}
      </div>
      {best ? (
        <p className="so-insight">
          {WEEKDAY_NAMES[best.day]} are the strongest day, averaging <strong>{money(best.avg)}</strong>;
          {' '}{WEEKDAY_NAMES[worst.day].toLowerCase()} are the quietest at <strong>{money(worst.avg)}</strong>.
          {biggest ? <> The biggest single day was <strong>{fmtDay(biggest.idx)}</strong>, with <strong>{money(biggest.revenue)}</strong>.</> : null}
        </p>
      ) : null}
    </div>
  )
}

// ─── Customers ────────────────────────────────────────────────────────────────
function BiggestCustomers({ rows, onOpen }) {
  if (!rows.length) return <Empty />
  const max = Math.max(...rows.map(r => r.revenue), 1)
  return (
    <table className="so-table">
      <thead><tr><th>Customer</th><th>Category</th><th className="num">Revenue</th><th className="num">Orders</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>
              <button type="button" className="so-cust-btn" onClick={() => onOpen?.(r)}>{r.name}</button>
              <span className="so-rank-sub">Last order {fmtDay(r.lastDay)}</span>
            </td>
            <td className="so-muted">{r.category}</td>
            <td className="num">
              <strong>{moneyCompact(r.revenue, 2)}</strong>
              <span className="so-inline-bar"><span style={{ width: `${(r.revenue / max) * 100}%` }} /></span>
            </td>
            <td className="num">{count(r.orders)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CustomersToCall({ rows, total }) {
  if (!rows.length) return <Empty>Every customer who bought in the last six months has ordered within {QUIET_DAYS} days.</Empty>
  return (
    <>
      <ul className="so-call-list">
        {rows.map(r => (
          <li key={r.id} className="so-call">
            <div className="so-call-days"><strong>{count(r.daysQuiet)}</strong><span>days quiet</span></div>
            <div className="so-call-main">
              <strong>{r.name}</strong>
              <span>{[r.category, r.phone].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="so-call-value"><strong>{moneyCompact(r.revenue, 2)}</strong><span>in prior 6 months</span></div>
          </li>
        ))}
      </ul>
      {total > rows.length ? <p className="so-footnote">+ {total - rows.length} more customers have gone quiet.</p> : null}
    </>
  )
}

// ─── Operations cards (brought over from PlusYoghurt-App) ────────────────────
function Collections({ ageing, outstanding, collected, billed, openCount, tooltip }) {
  const max = Math.max(...ageing.map(a => a.amount), 1)
  const rate = billed > 0 ? Math.min(100, (collected / billed) * 100) : null
  return (
    <>
      <div className="so-mini-stats">
        <div><span>Outstanding today</span><strong>{moneyCompact(outstanding, 2)}</strong><em>{count(openCount)} open invoices</em></div>
        <div><span>Collected in period</span><strong>{moneyCompact(collected, 2)}</strong><em>{rate === null ? 'No sales billed' : `${rate.toFixed(0)}% of billed sales`}</em></div>
      </div>
      <h3 className="so-subhead">Debt ageing</h3>
      <div className="so-hbars">
        {ageing.map((a, i) => {
          const content = (
            <>
              <div className="so-tip-title">{a.label}</div>
              <TipRow color={AGEING[i]} line={false} label={`${a.count} invoice${a.count === 1 ? '' : 's'}`} value={money(a.amount)} />
            </>
          )
          return (
            <div key={a.label} className="so-hbar" tabIndex={0} onPointerMove={e => tooltip.show(e, content)} onPointerLeave={tooltip.hide} onFocus={e => tooltip.show(e, content)} onBlur={tooltip.hide}>
              <span className="so-hbar-label">{a.label}</span>
              <span className="so-hbar-track"><span style={{ width: `${(a.amount / max) * 100}%`, background: AGEING[i] }} /></span>
              <span className="so-hbar-value">{moneyCompact(a.amount, 1)}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

function MethodMix({ rows, total, tooltip }) {
  if (total <= 0) return <Empty>No payments received in this period.</Empty>
  return (
    <>
      <div className="so-segbar so-segbar-sm" role="img" aria-label={rows.filter(r => r.value > 0).map(r => `${r.label} ${money(r.value)}`).join(', ')}>
        {rows.filter(r => r.value > 0).map(r => {
          const share = (r.value / total) * 100
          const content = (
            <>
              <div className="so-tip-title">{r.label}</div>
              <TipRow color={r.color} line={false} label={`${share.toFixed(1)}% · ${r.count} payment${r.count === 1 ? '' : 's'}`} value={money(r.value)} />
            </>
          )
          return (
            <div key={r.key} className="so-segbar-block" style={{ flexGrow: r.value, background: r.color, color: r.ink }} tabIndex={0} onPointerMove={e => tooltip.show(e, content)} onPointerLeave={tooltip.hide} onFocus={e => tooltip.show(e, content)} onBlur={tooltip.hide}>
              {share >= 12 ? <span>{share.toFixed(0)}%</span> : null}
            </div>
          )
        })}
      </div>
      <ul className="so-legend-list">
        {rows.map(r => (
          <li key={r.key}><i style={{ background: r.color }} /><span>{r.label}</span><strong>{money(r.value)}</strong></li>
        ))}
      </ul>
    </>
  )
}

function ProductionSnapshot({ prod }) {
  const margin = prod.value > 0 ? (prod.surplus / prod.value) * 100 : null
  return (
    <div className="so-mini-grid">
      <div><span>Batches</span><strong>{count(prod.batches)}</strong><em>{prod.devBatches ? `+ ${prod.devBatches} development` : 'production runs'}</em></div>
      <div><span>Litres made</span><strong>{compact(prod.litres, 1)} L</strong><em>{count(prod.bottles)} bottles</em></div>
      <div><span>Production value</span><strong>{moneyCompact(prod.value, 2)}</strong><em>at production price</em></div>
      <div><span>Production cost</span><strong>{moneyCompact(prod.cost, 2)}</strong><em>materials + overheads</em></div>
      <div className="so-mini-wide"><span>Efficiency surplus</span><strong>{moneyCompact(prod.surplus, 2)}</strong><em>{margin === null ? 'No batches in period' : `${margin.toFixed(1)}% of production value`}</em></div>
    </div>
  )
}

function StatusBadge({ tone, children }) {
  const icon = tone === 'good' ? '✓' : tone === 'critical' ? '✕' : '!'
  return <span className={`so-badge so-badge-${tone}`}><span aria-hidden="true">{icon}</span>{children}</span>
}

function StockWatch({ finished, materials, materialsAtRisk }) {
  return (
    <div className="so-stock">
      <div>
        <h3 className="so-subhead">Finished goods</h3>
        <ul className="so-stock-list">
          {finished.length ? finished.map(f => (
            <li key={f.size}>
              <span className="so-stock-name">{f.size}</span>
              <span className="so-stock-qty">{count(f.available)} <em>bottles</em></span>
              {f.available <= 0
                ? <StatusBadge tone="critical">Out of stock</StatusBadge>
                : f.produceNow ? <StatusBadge tone="serious">Produce now</StatusBadge> : <StatusBadge tone="good">Stock OK</StatusBadge>}
            </li>
          )) : <li className="so-muted">No finished goods recorded.</li>}
        </ul>
      </div>
      <div>
        <h3 className="so-subhead">Raw materials at reorder level</h3>
        <ul className="so-stock-list">
          {materials.length ? materials.map(m => (
            <li key={m.id}>
              <span className="so-stock-name">{m.name}</span>
              <span className="so-stock-qty">{compact(m.available, 1)} <em>{m.unit || ''} · reorder {compact(m.reorder, 1)}</em></span>
              <StatusBadge tone={m.available <= 0 ? 'critical' : 'warning'}>{m.available <= 0 ? 'Out' : 'Reorder'}</StatusBadge>
            </li>
          )) : <li><StatusBadge tone="good">All materials above reorder level</StatusBadge></li>}
        </ul>
        {materialsAtRisk > materials.length ? <p className="so-footnote">+ {materialsAtRisk - materials.length} more materials at or below reorder level.</p> : null}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SalesOverview({
  invoices = [],
  payments = [],
  customers = [],
  productionBatches = [],
  inventoryLedger = [],
  rawMaterials = [],
  treasury = null,
  position = null,
  onViewWallet = null,
  range,
  activePreset = '',
  onPresetSelect,
  onCustomRange,
  onExport,
  onNavigate,
  loading = false,
}) {
  const tooltip = useTooltip()
  const [showTable, setShowTable] = useState(false)

  // Lifetime facts: customer lookup, unit cost per size, normalised sales.
  const base = useMemo(() => {
    const customerMap = new Map(customers.map(c => [String(c.id), {
      name: c.name || 'Customer',
      category: String(c.customer_category_name || '').trim() || 'Uncategorised',
      phone: c.phone || '',
    }]))

    const costAgg = new Map()
    productionBatches.forEach(b => (b.outputs || []).forEach(o => {
      const k = sizeKey(o.product_size)
      const qty = num(o.quantity)
      if (!k || qty <= 0) return
      const cur = costAgg.get(k) || { qty: 0, amount: 0 }
      cur.qty += qty
      cur.amount += num(o.amount) || qty * num(o.unit_cost)
      costAgg.set(k, cur)
    }))
    const unitCost = k => { const c = costAgg.get(k); return c && c.qty > 0 ? c.amount / c.qty : 0 }

    const sales = invoices
      .filter(inv => !['cancelled', 'draft'].includes(String(inv.status || '').toLowerCase()))
      .map(inv => {
        const cust = customerMap.get(String(inv.customer)) || { name: inv.customer_name || 'Customer', category: 'Uncategorised', phone: '' }
        const lines = (inv.lines || []).map(l => {
          const k = sizeKey(l.product_size)
          const qty = num(l.quantity)
          return {
            key: k,
            size: l.product_size || 'Unknown size',
            tier: String(l.pricing_category || '').trim() || 'Unassigned tier',
            qty,
            amount: num(l.line_total) || qty * num(l.unit_price),
            cost: qty * unitCost(k),
            litres: (sizeMl(l.product_size) / 1000) * qty,
          }
        })
        const total = num(inv.total_amount)
        return {
          id: inv.id,
          day: dayIndex(inv.invoice_date),
          total,
          customerId: String(inv.customer ?? inv.customer_name),
          customer: cust,
          isOrder: !inv.is_sample_sale && total > 0,
          outstanding: Math.max(0, num(inv.outstanding_balance)),
          lines,
        }
      })
      .filter(s => Number.isFinite(s.day))

    // Stable colours: rank categories by lifetime revenue.
    const lifetimeByCat = new Map()
    sales.forEach(s => { if (s.isOrder) lifetimeByCat.set(s.customer.category, (lifetimeByCat.get(s.customer.category) || 0) + s.total) })
    const ranked = [...lifetimeByCat.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
    const colored = ranked.length <= SERIES.length ? ranked : ranked.slice(0, SERIES.length - 1)
    const catColor = new Map(colored.map((name, i) => [name, SERIES[i]]))
    const foldCat = name => (catColor.has(name) ? name : 'Other')
    const catOrder = ranked.length > colored.length ? [...colored, 'Other'] : colored

    const firstDay = sales.length ? Math.min(...sales.map(s => s.day)) : todayIndex() - 364
    return { sales, catColor, foldCat, catOrder, firstDay }
  }, [customers, invoices, productionBatches])

  const view = useMemo(() => {
    const today = todayIndex()
    const isAll = !range?.start
    const start = isAll ? Math.min(base.firstDay, today) : dayIndex(range.start)
    const endRaw = range?.end ? dayIndex(range.end) : today
    const end = Number.isFinite(endRaw) ? endRaw : today
    const len = Math.max(1, end - start + 1)
    const prior = isAll ? null : { start: start - len, end: start - 1 }
    const inRange = (d, s, e) => d >= s && d <= e
    const orders = base.sales.filter(s => s.isOrder)

    const summarize = (s, e) => {
      const rows = orders.filter(o => inRange(o.day, s, e))
      const revenue = rows.reduce((t, o) => t + o.total, 0)
      const cogs = rows.reduce((t, o) => t + o.lines.reduce((u, l) => u + l.cost, 0), 0)
      const custs = new Set(rows.map(o => o.customerId)).size
      return { revenue, gross: revenue - cogs, orders: rows.length, customers: custs, avg: rows.length ? revenue / rows.length : 0 }
    }
    const cur = summarize(start, end)
    const prev = prior ? summarize(prior.start, prior.end) : null

    const nSpark = Math.min(12, len)
    const spark = Array.from({ length: nSpark }, (_, b) => {
      const s = start + Math.floor((b * len) / nSpark)
      const e = start + Math.floor(((b + 1) * len) / nSpark) - 1
      return summarize(s, e)
    })

    // Category segments
    const catRev = (s, e) => {
      const m = new Map()
      orders.forEach(o => { if (inRange(o.day, s, e)) { const k = base.foldCat(o.customer.category); m.set(k, (m.get(k) || 0) + o.total) } })
      return m
    }
    const catCur = catRev(start, end)
    const catPrev = prior ? catRev(prior.start, prior.end) : null
    const colorOf = name => base.catColor.get(name) || OTHER_COLOR
    const inkOf = color => (color === '#eda100' ? '#0b0b0b' : '#ffffff')
    const segments = base.catOrder
      .map(name => ({ name, value: catCur.get(name) || 0, prevValue: catPrev ? (catPrev.get(name) || 0) : null, delta: catPrev ? pctChange(catCur.get(name) || 0, catPrev.get(name) || 0) : null, color: colorOf(name), ink: inkOf(colorOf(name)) }))
      .filter(s => s.value > 0 || (catPrev?.get(s.name) || 0) > 0)
      .sort((a, b) => b.value - a.value)

    // Revenue over time buckets (weekly up to ~3 months, monthly beyond)
    const buckets = []
    if (len <= 100) {
      for (let s = start; s <= end; s += 7) {
        const e = Math.min(end, s + 6)
        buckets.push({ key: `w${s}`, s, e, label: fmtDay(s, false), longLabel: `Week of ${fmtDay(s)}` })
      }
    } else {
      let d = dateOf(start)
      let s = start
      while (s <= end) {
        const next = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY_MS)
        const e = Math.min(end, next - 1)
        const multiYear = dateOf(start).getUTCFullYear() !== dateOf(end).getUTCFullYear()
        const label = multiYear && d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : fmtMonth(s)
        buckets.push({ key: `m${s}`, s, e, label, longLabel: dateOf(s).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) })
        s = next
        d = dateOf(s)
      }
    }
    const stackOrder = [...segments].filter(s => s.value > 0).sort((a, b) => base.catOrder.indexOf(a.name) - base.catOrder.indexOf(b.name))
    const areaSeries = stackOrder.map(seg => ({
      name: seg.name,
      color: seg.color,
      values: buckets.map(b => orders.reduce((t, o) => t + (inRange(o.day, b.s, b.e) && base.foldCat(o.customer.category) === seg.name ? o.total : 0), 0)),
    }))

    // Line-level breakdowns: pricing tier & product size
    const periodOrders = orders.filter(o => inRange(o.day, start, end))
    const tierMap = new Map()
    const prodMap = new Map()
    periodOrders.forEach(o => o.lines.forEach(l => {
      tierMap.set(l.tier, (tierMap.get(l.tier) || 0) + l.amount)
      const p = prodMap.get(l.key) || { key: l.key, size: l.size, revenue: 0, cost: 0, qty: 0, litres: 0, custs: new Set() }
      p.revenue += l.amount
      p.cost += l.cost
      p.qty += l.qty
      p.litres += l.litres
      p.custs.add(o.customerId)
      prodMap.set(l.key, p)
    }))
    const lineTotal = [...tierMap.values()].reduce((t, v) => t + v, 0)
    let tiers = [...tierMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    if (tiers.length > 6) {
      const rest = tiers.slice(5).reduce((t, x) => t + x.value, 0)
      tiers = [...tiers.slice(0, 5), { name: 'Other tiers', value: rest }]
    }
    tiers = tiers.map(t => ({ ...t, share: lineTotal > 0 ? (t.value / lineTotal) * 100 : 0 }))
    const products = [...prodMap.values()]
      .map(p => ({ ...p, customers: p.custs.size, margin: p.revenue > 0 && p.cost > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : null }))
      .sort((a, b) => b.revenue - a.revenue)

    // Sales rhythm
    const hStart = len > 371 ? end - 370 : start
    const weekStart = hStart - weekdayOf(hStart)
    const cols = Math.ceil((end - weekStart + 1) / 7)
    const daily = new Map()
    periodOrders.forEach(o => {
      if (o.day < hStart) return
      const r = daily.get(o.day) || { revenue: 0, orders: 0 }
      r.revenue += o.total
      r.orders += 1
      daily.set(o.day, r)
    })
    const nz = [...daily.values()].map(r => r.revenue).filter(v => v > 0).sort((a, b) => a - b)
    const q = p => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))]
    const thresholds = nz.length ? [q(0.2), q(0.4), q(0.6), q(0.8)] : []
    const wdSum = Array(7).fill(0)
    const wdDays = Array(7).fill(0)
    for (let d = start; d <= end; d += 1) wdDays[weekdayOf(d)] += 1
    periodOrders.forEach(o => { wdSum[weekdayOf(o.day)] += o.total })
    const weekday = wdSum.map((s, day) => ({ day, avg: wdDays[day] ? s / wdDays[day] : 0, days: wdDays[day] }))
    const activeWd = weekday.filter(w => w.days > 0)
    const best = cur.revenue > 0 ? activeWd.reduce((a, b) => (b.avg > a.avg ? b : a), activeWd[0]) : null
    const worst = cur.revenue > 0 ? activeWd.reduce((a, b) => (b.avg < a.avg ? b : a), activeWd[0]) : null
    const allDaily = new Map()
    periodOrders.forEach(o => allDaily.set(o.day, (allDaily.get(o.day) || 0) + o.total))
    const biggest = [...allDaily.entries()].reduce((a, [idx, revenue]) => (!a || revenue > a.revenue ? { idx, revenue } : a), null)

    // Customers
    const lastOrderDay = new Map()
    orders.forEach(o => { if (o.day <= end) lastOrderDay.set(o.customerId, Math.max(lastOrderDay.get(o.customerId) ?? -Infinity, o.day)) })
    const custAgg = new Map()
    periodOrders.forEach(o => {
      const c = custAgg.get(o.customerId) || { id: o.customerId, name: o.customer.name, category: o.customer.category, revenue: 0, orders: 0 }
      c.revenue += o.total
      c.orders += 1
      custAgg.set(o.customerId, c)
    })
    const biggestCustomers = [...custAgg.values()]
      .map(c => ({ ...c, lastDay: lastOrderDay.get(c.id) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    const quietCut = end - QUIET_DAYS
    const lookStart = quietCut - LOOKBACK_DAYS
    const callAgg = new Map()
    orders.forEach(o => {
      if (!inRange(o.day, lookStart, quietCut)) return
      const last = lastOrderDay.get(o.customerId)
      if (last === undefined || last > quietCut) return
      const c = callAgg.get(o.customerId) || { id: o.customerId, name: o.customer.name, category: o.customer.category, phone: o.customer.phone, revenue: 0, daysQuiet: end - last }
      c.revenue += o.total
      callAgg.set(o.customerId, c)
    })
    const callAll = [...callAgg.values()].sort((a, b) => b.revenue - a.revenue)

    // Collections (ageing is as of today, across every open invoice)
    const buckets4 = [
      { label: '0–30 days', max: 30, amount: 0, count: 0 },
      { label: '31–60 days', max: 60, amount: 0, count: 0 },
      { label: '61–90 days', max: 90, amount: 0, count: 0 },
      { label: '90+ days', max: Infinity, amount: 0, count: 0 },
    ]
    let outstanding = 0
    let openCount = 0
    base.sales.forEach(s => {
      if (s.outstanding <= 0) return
      outstanding += s.outstanding
      openCount += 1
      const age = today - s.day
      const b = buckets4.find(x => age <= x.max)
      b.amount += s.outstanding
      b.count += 1
    })
    const periodPayments = payments.filter(p => inRange(dayIndex(p.payment_date), start, end))
    const collected = periodPayments.reduce((t, p) => t + num(p.amount), 0)
    const methodRows = METHOD_ORDER.map((key, i) => {
      const rows = periodPayments.filter(p => (METHOD_ORDER.includes(p.method) ? p.method : 'other') === key)
      return { key, label: METHOD_LABELS[key], color: SERIES[i], ink: SERIES[i] === '#eda100' ? '#0b0b0b' : '#ffffff', value: rows.reduce((t, p) => t + num(p.amount), 0), count: rows.length }
    })

    // Production
    const periodBatches = productionBatches.filter(b => inRange(dayIndex(b.production_date), start, end))
    const prodBatches = periodBatches.filter(b => String(b.batch_type || 'production').toLowerCase() !== 'development')
    const prod = {
      batches: prodBatches.length,
      devBatches: periodBatches.length - prodBatches.length,
      litres: prodBatches.reduce((t, b) => t + (b.outputs || []).reduce((u, o) => u + (sizeMl(o.product_size) / 1000) * num(o.quantity), 0), 0),
      bottles: prodBatches.reduce((t, b) => t + (b.outputs || []).reduce((u, o) => u + num(o.quantity), 0), 0),
      value: prodBatches.reduce((t, b) => t + num(b.total_production_value), 0),
      cost: prodBatches.reduce((t, b) => t + num(b.total_cost), 0),
      surplus: prodBatches.reduce((t, b) => t + num(b.profit), 0),
    }

    return {
      start, end, len, prior, isAll, cur, prev, spark, segments, buckets, areaSeries, tiers, products,
      rhythm: { weekStart, cols, start: hStart, end, daily, thresholds, weekday, best, worst, biggest },
      biggestCustomers, callRows: callAll.slice(0, 6), callTotal: callAll.length,
      ageing: buckets4, outstanding, openCount, collected, methodRows, prod,
    }
  }, [base, payments, productionBatches, range])

  const positionTrend = useMemo(() => {
    if (!position) return null
    const nSpark = Math.min(12, view.len)
    const ends = Array.from({ length: nSpark }, (_, b) => view.start + Math.floor(((b + 1) * view.len) / nSpark) - 1)
    const live = invoices.filter(inv => !['cancelled', 'draft'].includes(String(inv.status || '').toLowerCase()))
    const paidByInvoice = new Map()
    payments.forEach(p => {
      const list = paidByInvoice.get(String(p.invoice)) || []
      list.push({ day: dayIndex(p.payment_date), amount: num(p.amount) })
      paidByInvoice.set(String(p.invoice), list)
    })
    const outputs = productionBatches.flatMap(b => (b.outputs || []).map(o => ({ day: dayIndex(b.production_date), qty: num(o.quantity) })))
    const sold = live.flatMap(inv => (inv.lines || []).map(l => ({ day: dayIndex(inv.invoice_date), qty: num(l.quantity) })))
    const walletAt = e => (treasury ? treasury.wallets.reduce((t, w) => {
      const row = w.statement.find(r => dayIndex(r.date) <= e) // statement is newest first
      return t + (row ? row.balance : 0)
    }, 0) : 0)
    const series = ends.map(e => {
      const billed = live.filter(inv => dayIndex(inv.invoice_date) <= e)
      return {
        cash: walletAt(e),
        ar: billed.reduce((t, inv) => {
          const paid = (paidByInvoice.get(String(inv.id)) || []).filter(p => p.day <= e).reduce((u, p) => u + p.amount, 0)
          return t + Math.max(0, num(inv.total_amount) - paid)
        }, 0),
        units: Math.max(0, outputs.filter(o => o.day <= e).reduce((t, o) => t + o.qty, 0) - sold.filter(x => x.day <= e).reduce((t, x) => t + x.qty, 0)),
        revenue: billed.reduce((t, inv) => t + num(inv.total_amount), 0),
      }
    })
    // The last point is today's figure exactly, so the line ends on the number shown.
    if (series.length && view.end >= todayIndex()) {
      const last = series[series.length - 1]
      if (treasury) last.cash = treasury.total
      last.ar = position.receivables
      last.units = position.stock.units
    }
    return {
      cash: series.map(p => p.cash),
      ar: series.map(p => p.ar),
      units: series.map(p => p.units),
      revenue: series.map(p => p.revenue),
    }
  }, [position, treasury, invoices, payments, productionBatches, view.start, view.len, view.end])

  const stock = useMemo(() => {
    const finished = [...inventoryLedger]
      .map(f => ({ size: f.size, available: num(f.available), produceNow: Boolean(f.prodRequired) }))
      .sort((a, b) => sizeMl(a.size) - sizeMl(b.size))
    const atRisk = rawMaterials
      .map(m => ({ id: m.id, name: m.name, unit: m.unit, available: num(m.available ?? (num(m.opening_stock) + num(m.stock_in) - num(m.stock_out))), reorder: num(m.reorder_level) }))
      .filter(m => m.available <= m.reorder && (m.reorder > 0 || m.available <= 0))
      .sort((a, b) => (a.available - a.reorder) - (b.available - b.reorder))
    return { finished, materials: atRisk.slice(0, 7), materialsAtRisk: atRisk.length }
  }, [inventoryLedger, rawMaterials])

  const thisYear = new Date().getFullYear()
  const years = [...new Set(base.sales.map(s => dateOf(s.day).getUTCFullYear()))].filter(y => y < thisYear).sort((a, b) => b - a).slice(0, 2)
  const presets = [
    { key: 'last_30', label: '30 days' },
    { key: 'last_90', label: '3 months' },
    { key: 'last_365', label: '12 months' },
    { key: 'this_year', label: 'This year' },
    ...years.map(y => ({ key: `year_${y}`, label: String(y) })),
    { key: '', label: 'All time' },
  ]
  const presetKnown = presets.some(p => p.key === activePreset)
  const shownPreset = presetKnown ? activePreset : (range?.start ? 'custom' : '')
  const rangeLabel = `${fmtDay(view.start)} to ${fmtDay(view.end)}`
  const { cur } = view

  const handleExport = onExport ? (format = 'xlsx') => {
    const rows = [
      ['Summary', 'Revenue', money(cur.revenue)],
      ['Summary', 'Gross profit', money(cur.gross)],
      ['Summary', 'Orders', count(cur.orders)],
      ['Summary', 'Customers buying', count(cur.customers)],
      ['Summary', 'Average order', money(cur.avg)],
      ...view.segments.map(s => ['Customer category', s.name, money(s.value)]),
      ...view.tiers.map(t => ['Pricing tier', t.name, money(t.value)]),
      ...view.products.map(p => ['Product', p.size, money(p.revenue)]),
      ...view.biggestCustomers.map(c => ['Customer', c.name, money(c.revenue)]),
    ].map((cells, i) => ({ id: i, cells }))
    onExport(`Dashboard_${rangeLabel.replaceAll(' ', '_')}`, ['Section', 'Item', 'Value'], rows, format)
  } : null

  // While the records load, draw the same layout with shimmer in place of the figures.
  if (loading) {
    const Skel = ({ w = '100%', h = 12 }) => <span className="so-skel" style={{ width: w, height: h }} aria-hidden="true" />
    const Lines = ({ n = 5 }) => (
      <div className="so-skel-lines">
        {Array.from({ length: n }, (_, i) => <div key={i} className="so-skel-row"><Skel w={`${58 - (i % 3) * 12}%`} /><Skel w="18%" /></div>)}
      </div>
    )
    const Chart = ({ h = 220 }) => <Skel h={h} />
    return (
      <div className="so-root" aria-busy="true">
        <PeriodBar presets={presets} activePreset={shownPreset} onSelect={onPresetSelect} onCustom={onCustomRange} rangeLabel={rangeLabel} onExport={null} />
        <section className="so-card so-stats so-stats-position" aria-label="Position today">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="so-stat">
              <Skel w="55%" h={11} />
              <Skel w="70%" h={28} />
              <Skel w="80%" h={11} />
              <Skel h={28} />
            </div>
          ))}
        </section>
        <div className="ps-wallets" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="ps-wallet">
              <span className="ps-wallet-copy"><Skel w={90} h={11} /><Skel w={120} h={18} /></span>
            </div>
          ))}
        </div>
        <section className="so-segments"><Skel h={14} /></section>
        <Card title="Stock watch" subtitle="Live stock today: what to produce and what to reorder."><Lines n={4} /></Card>
        <div className="so-grid">
          <Card title="Biggest customers" subtitle="Revenue in the selected period."><Lines n={5} /></Card>
          <Card title="Customers to call" subtitle={`Bought in the 6 months before, then no order for ${QUIET_DAYS} days or more.`}><Lines n={5} /></Card>
        </div>
        <div className="so-grid so-grid-3">
          <Card title="Collections" subtitle="Cash collected in the period, and open invoices by age today."><Chart h={160} /></Card>
          <Card title="Cash in by method" subtitle="Customer payments received in the period."><Chart h={160} /></Card>
          <Card title="Production" subtitle="Batches made in the period (development batches counted separately)."><Chart h={160} /></Card>
        </div>
        <div className="so-grid so-grid-wide">
          <Card title="Revenue over time" subtitle="Revenue in GHS, stacked by customer category."><Chart h={240} /></Card>
          <Card title="Where it sells" subtitle="Share of line revenue by pricing tier. Each square is 1%."><Chart h={240} /></Card>
        </div>
        <div className="so-grid">
          <Card title="What sells" subtitle="Bottle sizes ranked by revenue, with gross margin after production cost."><Lines n={5} /></Card>
          <Card title="Sales rhythm" subtitle="Revenue per day. Darker means a bigger day."><Chart h={180} /></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="so-root">
      <PeriodBar presets={presets} activePreset={shownPreset} onSelect={onPresetSelect} onCustom={onCustomRange} rangeLabel={rangeLabel} onExport={handleExport} />

      {position ? (
        <>
          <section className="so-card so-stats so-stats-position" aria-label="Position today">
            {treasury ? (
              <PositionTile label="Total liquid funds" value={moneyCompact(treasury.total, 2)} fullValue={money(treasury.total)} note="Across Cash, MoMo, GhanaPay & Cal Bank" trend={positionTrend.cash} />
            ) : null}
            <PositionTile label="Trade receivables (AR)" value={moneyCompact(position.receivables, 2)} fullValue={money(position.receivables)} note={`Owed on ${count(position.receivableInvoices)} open invoice${position.receivableInvoices === 1 ? '' : 's'}`} trend={positionTrend.ar} />
            <PositionTile
              label="Finished goods stock"
              value={`${count(position.stock.units)} bottles`}
              note={`Valued at ${moneyCompact(position.stock.value, 2)}`}
              alert={position.stock.critical ? `${position.stock.critical} size${position.stock.critical === 1 ? '' : 's'} at reorder level` : ''}
              trend={positionTrend.units}
            />
            <PositionTile label="Lifetime revenue" value={moneyCompact(position.lifetimeRevenue, 2)} fullValue={money(position.lifetimeRevenue)} note={`Billed across all ${count(position.lifetimeInvoices)} invoices`} trend={positionTrend.revenue} />
          </section>
          {treasury ? <WalletCards treasury={treasury} onViewWallet={onViewWallet} /> : null}
        </>
      ) : null}

      <SegmentedBar segments={view.segments} total={cur.revenue} tooltip={tooltip} />

      <Card title="Stock watch" subtitle="Live stock today: what to produce and what to reorder." actions={<button type="button" className="so-link-btn" onClick={() => onNavigate?.('supplies_stock', 'materials')}>Raw materials</button>}>
        <StockWatch finished={stock.finished} materials={stock.materials} materialsAtRisk={stock.materialsAtRisk} />
      </Card>

      <div className="so-grid">
        <Card title="Biggest customers" subtitle="Revenue in the selected period." actions={<button type="button" className="so-link-btn" onClick={() => onNavigate?.('customers', 'customers')}>All customers</button>}>
          <BiggestCustomers rows={view.biggestCustomers} onOpen={() => onNavigate?.('customers', 'customers')} />
        </Card>
        <Card title="Customers to call" subtitle={`Bought in the 6 months before, then no order for ${QUIET_DAYS} days or more (as of ${fmtDay(view.end)}).`}>
          <CustomersToCall rows={view.callRows} total={view.callTotal} />
        </Card>
      </div>

      <div className="so-grid so-grid-3">
        <Card title="Collections" subtitle="Cash collected in the period, and open invoices by age today." actions={<button type="button" className="so-link-btn" onClick={() => onNavigate?.('customers', 'receivables')}>Receivables</button>}>
          <Collections ageing={view.ageing} outstanding={view.outstanding} openCount={view.openCount} collected={view.collected} billed={cur.revenue} tooltip={tooltip} />
        </Card>
        <Card title="Cash in by method" subtitle="Customer payments received in the period." actions={<button type="button" className="so-link-btn" onClick={() => onNavigate?.('sales_hub', 'recent_receipts')}>Receipts</button>}>
          <MethodMix rows={view.methodRows} total={view.collected} tooltip={tooltip} />
        </Card>
        <Card title="Production" subtitle="Batches made in the period (development batches counted separately)." actions={<button type="button" className="so-link-btn" onClick={() => onNavigate?.('production_ops', 'batches')}>Batches</button>}>
          <ProductionSnapshot prod={view.prod} />
        </Card>
      </div>

      <div className="so-grid so-grid-wide">
        <Card
          title="Revenue over time"
          subtitle={`${view.len <= 100 ? 'Weekly' : 'Monthly'} revenue in GHS, stacked by customer category.`}
          actions={view.areaSeries.length ? <button type="button" className="so-link-btn" aria-pressed={showTable} onClick={() => setShowTable(v => !v)}>{showTable ? 'Show chart' : 'Show table'}</button> : null}
        >
          {view.areaSeries.length ? (
            <>
              <ul className="so-legend-inline">
                {view.areaSeries.map(s => <li key={s.name}><i style={{ background: s.color }} />{s.name}</li>)}
              </ul>
              {showTable ? <SeriesTable buckets={view.buckets} series={view.areaSeries} /> : <StackedArea buckets={view.buckets} series={view.areaSeries} tooltip={tooltip} />}
            </>
          ) : <Empty />}
        </Card>
        <Card title="Where it sells" subtitle="Share of line revenue by pricing tier. Each square is 1%.">
          {view.tiers.length ? (
            <div className="so-waffles">
              {view.tiers.map(t => <Waffle key={t.name} name={t.name} value={t.value} share={t.share} tooltip={tooltip} />)}
            </div>
          ) : <Empty />}
        </Card>
      </div>

      <div className="so-grid">
        <Card title="What sells" subtitle="Bottle sizes ranked by revenue, with gross margin after production cost." actions={<button type="button" className="so-link-btn" onClick={() => onNavigate?.('supplies_stock', 'finished')}>Open inventory</button>}>
          <ProductRanking rows={view.products} tooltip={tooltip} />
        </Card>
        <Card title="Sales rhythm" subtitle="Revenue per day. Darker means a bigger day.">
          {cur.revenue > 0 ? <SalesRhythm rhythm={view.rhythm} tooltip={tooltip} /> : <Empty />}
        </Card>
      </div>

      <Tooltip tip={tooltip.tip} />
    </div>
  )
}
