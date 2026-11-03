import { useMemo, useState } from 'react'
import './ProductionPlanner.css'
import { BASE_OVERHEADS, RECIPE, STANDARD_VOLUME, matchRecipeMaterial } from '../../lib/recipe'

const SIZES = ['200ml', '300ml', '350ml', '500ml', '1,000ml', '2,000ml', '4,500ml']
const MIXES = [
  { key: 'balanced', label: 'Standard mix (500ml + 350ml + 200ml)' },
  { key: 'mostly_500', label: 'Mostly 500ml (80%) + 300ml' },
  { key: 'all_500', label: '100% 500ml' },
  { key: 'all_350', label: '100% 350ml' },
  { key: 'all_300', label: '100% 300ml' },
  { key: 'all_200', label: '100% 200ml' },
  { key: 'all_1000', label: '100% 1,000ml' },
  { key: 'custom', label: 'Custom quantities' },
]
const VOLUME_PRESETS = [
  { label: '½ batch', litres: STANDARD_VOLUME / 2 },
  { label: '1 batch (109.2 L)', litres: STANDARD_VOLUME },
  { label: '2 batches', litres: STANDARD_VOLUME * 2 },
  { label: '3 batches', litres: STANDARD_VOLUME * 3 },
]

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function money(v) { return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}` }
function qtyFmt(v, unit) {
  const n = num(v)
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: n >= 100 ? 1 : 2 }).format(n)} ${unit}`
}
function mlOf(text) {
  const t = String(text || '').toLowerCase().replaceAll(',', '')
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (ml) return num(ml[1])
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/)
  return l ? num(l[1]) * 1000 : 0
}

function bottleMix(litres, mix) {
  const out = {}
  const n = (vol, size) => Math.round(vol / (mlOf(size) / 1000))
  if (mix === 'all_500') out['500ml'] = n(litres, '500ml')
  else if (mix === 'all_350') out['350ml'] = n(litres, '350ml')
  else if (mix === 'all_300') out['300ml'] = n(litres, '300ml')
  else if (mix === 'all_200') out['200ml'] = n(litres, '200ml')
  else if (mix === 'all_1000') out['1,000ml'] = n(litres, '1,000ml')
  else if (mix === 'mostly_500') {
    out['500ml'] = n(litres * 0.8, '500ml')
    out['300ml'] = Math.round(Math.max(0, litres - out['500ml'] * 0.5) / 0.3)
  } else if (mix === 'balanced') {
    out['500ml'] = n(litres * (54.0 / 109.2), '500ml')
    out['350ml'] = n(litres * (36.4 / 109.2), '350ml')
    out['200ml'] = Math.round(Math.max(0, litres - out['500ml'] * 0.5 - out['350ml'] * 0.35) / 0.2)
  }
  return out
}

function ProductionPlanner({ rawMaterials = [], pricingRules = [], isProductionPrice = () => false, onLoadIntoBatch }) {
  const [litres, setLitres] = useState(STANDARD_VOLUME)
  const [mix, setMix] = useState('balanced')
  const [custom, setCustom] = useState({})

  const materials = useMemo(() => rawMaterials.map(m => ({
    id: m.id,
    name: String(m.name || ''),
    unit: m.unit || '',
    category: String(m.category || ''),
    unitCost: num(m.unit_price),
    available: num(m.available ?? (num(m.opening_stock) + num(m.stock_in) - num(m.stock_out))),
  })), [rawMaterials])

  const priceBySize = useMemo(() => {
    const map = new Map()
    pricingRules.forEach(r => {
      if (!isProductionPrice(r.pricing_category_name || r.pricing_category)) return
      map.set(mlOf(r.size), num(r.price))
    })
    return map
  }, [pricingRules, isProductionPrice])

  const safeLitres = Math.max(1, num(litres))
  const factor = safeLitres / STANDARD_VOLUME
  const plannedMix = mix === 'custom' ? custom : bottleMix(safeLitres, mix)

  const ingredients = RECIPE.map(item => {
    const material = matchRecipeMaterial(item, materials)
    const required = item.baseQty * factor
    const available = material ? material.available : 0
    return {
      ...item,
      material,
      required,
      available,
      cost: required * (material?.unitCost || 0),
      shortage: Math.max(0, required - available),
      batchesSupported: material ? available / item.baseQty : 0,
    }
  })
  const bottles = SIZES.map(size => {
    const qty = Math.max(0, Math.round(num(plannedMix[size])))
    const ml = mlOf(size)
    const material = materials.find(m => /bottle/i.test(m.name) && mlOf(m.name) === ml)
    const available = material ? material.available : 0
    const price = priceBySize.get(ml) || 0
    return { size, qty, ml, litres: (qty * ml) / 1000, material, available, value: qty * price, price, cost: qty * (material?.unitCost || 0), short: Math.max(0, qty - available) }
  })

  const ingredientCost = ingredients.reduce((t, i) => t + i.cost, 0)
  const packagingCost = bottles.reduce((t, b) => t + b.cost, 0)
  const overheads = (BASE_OVERHEADS.electricity + BASE_OVERHEADS.gas + BASE_OVERHEADS.wages) * factor
  const totalCost = ingredientCost + packagingCost + overheads
  const outputValue = bottles.reduce((t, b) => t + b.value, 0)
  const surplus = outputValue - totalCost
  const margin = outputValue > 0 ? (surplus / outputValue) * 100 : 0
  const bottledLitres = bottles.reduce((t, b) => t + b.litres, 0)
  const totalBottles = bottles.reduce((t, b) => t + b.qty, 0)
  const tracked = ingredients.filter(i => i.material)
  const bottleneck = tracked.length ? tracked.reduce((a, b) => (b.batchesSupported < a.batchesSupported ? b : a)) : null
  const maxBatches = bottleneck ? Math.max(0, bottleneck.batchesSupported) : 0
  const ingredientShort = ingredients.some(i => i.shortage > 0)
  const bottleShort = bottles.find(b => b.qty > 0 && b.short > 0)
  const missing = ingredients.filter(i => !i.material)
  const volumeGap = bottledLitres - safeLitres

  const setVolume = v => setLitres(Math.round(Math.max(1, v) * 100) / 100)
  const setCustomQty = (size, value) => {
    setMix('custom')
    setCustom(cur => ({ ...(mix === 'custom' ? cur : plannedMix), [size]: Math.max(0, Math.round(num(value))) }))
  }

  const loadIntoBatch = () => {
    const usages = {}
    ingredients.forEach(i => { if (i.material && i.required > 0) usages[i.material.name] = Math.round(i.required * 1000) / 1000 })
    bottles.forEach(b => { if (b.material && b.qty > 0) usages[b.material.name] = b.qty })
    onLoadIntoBatch?.({
      usages,
      overheads: {
        electricity: Math.round(BASE_OVERHEADS.electricity * factor * 100) / 100,
        gas: Math.round(BASE_OVERHEADS.gas * factor * 100) / 100,
        wages: Math.round(BASE_OVERHEADS.wages * factor * 100) / 100,
      },
      note: `Planned ${safeLitres.toFixed(1)} L (${factor.toFixed(2)} standard batches): ${bottles.filter(b => b.qty).map(b => `${b.qty}× ${b.size}`).join(', ')}`,
    })
  }

  return (
    <section className="pp-wrap" aria-label="Production planner">
      <header className="pp-head">
        <div>
          <h2>Production planner</h2>
          <p>Scale the standard recipe (109.2 L benchmark) to any volume, check it against live stock, and forecast cost and margin before you produce.</p>
        </div>
        {onLoadIntoBatch ? <button type="button" className="account-alert-button account-alert-button-dark" onClick={loadIntoBatch}>Load into new batch</button> : null}
      </header>

      <div className={`pp-banner ${bottleShort || ingredientShort ? 'is-bad' : 'is-good'}`} role="status">
        <span aria-hidden="true">{bottleShort || ingredientShort ? '!' : '✓'}</span>
        {bottleShort
          ? <>Bottle stock is short for this plan — bottleneck: <strong>{bottleShort.size} bottles</strong> ({bottleShort.short.toLocaleString()} short).</>
          : ingredientShort
            ? <>Raw material shortage: stock covers at most <strong>{maxBatches.toFixed(1)} batches ({(maxBatches * STANDARD_VOLUME).toFixed(1)} L)</strong> — bottleneck: <strong>{bottleneck?.name}</strong>.</>
            : <>Stock is sufficient for this run. Maximum feasible: <strong>{maxBatches.toFixed(1)} batches ({(maxBatches * STANDARD_VOLUME).toFixed(1)} L)</strong>.</>}
      </div>

      <div className="pp-grid">
        <article className="pp-card">
          <h3>Volume</h3>
          <div className="pp-volume">
            <label className="pp-field">
              <span>Target volume (litres)</span>
              <input type="number" min="1" step="0.5" value={litres} onChange={e => setLitres(e.target.value)} />
            </label>
            <span className="pp-factor">{factor.toFixed(2)} standard batch{factor === 1 ? '' : 'es'}</span>
          </div>
          <input className="pp-slider" type="range" min="10" max="550" step="0.5" value={Math.min(550, safeLitres)} onChange={e => setVolume(e.target.value)} aria-label="Target volume slider" />
          <div className="pp-presets">
            {VOLUME_PRESETS.map(p => (
              <button key={p.label} type="button" className={`pp-chip${Math.abs(p.litres - safeLitres) < 0.01 ? ' active' : ''}`} onClick={() => setVolume(p.litres)}>{p.label}</button>
            ))}
            <button type="button" className="pp-chip" disabled={!maxBatches} onClick={() => setVolume(Math.max(10, maxBatches * STANDARD_VOLUME))}>Max feasible</button>
          </div>

          <h3 className="pp-sub">Bottle mix</h3>
          <label className="pp-field">
            <span>Packaging plan</span>
            <select value={mix} onChange={e => { if (e.target.value === 'custom') setCustom(plannedMix); setMix(e.target.value) }}>
              {MIXES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <div className="pp-sizes">
            {bottles.map(b => (
              <div key={b.size} className={`pp-size${b.qty > 0 ? ' is-on' : ''}${b.qty > 0 && b.short > 0 ? ' is-short' : ''}`}>
                <span className="pp-size-name">{b.size}</span>
                <input type="number" min="0" step="1" value={b.qty} onChange={e => setCustomQty(b.size, e.target.value)} aria-label={`${b.size} bottles`} />
                <span className="pp-size-meta">{b.litres.toFixed(1)} L · {money(b.value)}</span>
                <span className={`pp-size-stock${b.qty > 0 && b.short > 0 ? ' is-short' : ''}`}>
                  {b.material ? (b.qty > 0 && b.short > 0 ? `! Short by ${b.short.toLocaleString()} (${b.available.toLocaleString()} in stock)` : `${b.available.toLocaleString()} bottles in stock`) : 'No bottle material found'}
                </span>
              </div>
            ))}
          </div>
          <p className={`pp-volcheck${Math.abs(volumeGap) < 0.05 ? ' ok' : ''}`}>
            {totalBottles.toLocaleString()} bottles · {bottledLitres.toFixed(1)} L bottled of {safeLitres.toFixed(1)} L
            {Math.abs(volumeGap) < 0.05 ? ' — exact match' : volumeGap < 0 ? ` — ${Math.abs(volumeGap).toFixed(1)} L unallocated` : ` — ${volumeGap.toFixed(1)} L over target`}
          </p>
        </article>

        <article className="pp-card">
          <h3>Ingredients required</h3>
          <div className="pp-table-scroll">
            <table className="pp-table">
              <thead><tr><th>Ingredient</th><th className="num">Needed</th><th className="num">In stock</th><th className="num">Cost</th><th>Status</th></tr></thead>
              <tbody>
                {ingredients.map(i => (
                  <tr key={i.key}>
                    <td>{i.name}{i.material ? <span className="pp-matched">{i.material.name}</span> : null}</td>
                    <td className="num">{qtyFmt(i.required, i.unit)}</td>
                    <td className="num">{i.material ? qtyFmt(i.available, i.material.unit || i.unit) : '—'}</td>
                    <td className="num">{i.material ? money(i.cost) : '—'}</td>
                    <td>
                      {!i.material
                        ? <span className="pp-badge pp-badge-muted">Not in stock list</span>
                        : i.shortage > 0
                          ? <span className="pp-badge pp-badge-bad">! Short {qtyFmt(i.shortage, i.unit)}</span>
                          : <span className="pp-badge pp-badge-good">✓ OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length ? <p className="pp-note">Not matched to a raw material: {missing.map(m => m.name).join(', ')}. Add them in Supplies &amp; Stock to include their stock and cost.</p> : null}

          <h3 className="pp-sub">Forecast</h3>
          <div className="pp-forecast">
            <div><span>Ingredients</span><strong>{money(ingredientCost)}</strong></div>
            <div><span>Bottles</span><strong>{money(packagingCost)}</strong></div>
            <div><span>Overheads</span><strong>{money(overheads)}</strong><em>electricity, gas &amp; wages</em></div>
            <div><span>Total cost</span><strong>{money(totalCost)}</strong><em>{money(totalCost / safeLitres)} per litre</em></div>
            <div><span>Output value</span><strong>{money(outputValue)}</strong><em>at production price</em></div>
            <div className={surplus >= 0 ? 'is-good' : 'is-bad'}><span>Projected surplus</span><strong>{surplus >= 0 ? '+' : ''}{money(surplus)}</strong><em>{margin.toFixed(1)}% margin</em></div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default ProductionPlanner
