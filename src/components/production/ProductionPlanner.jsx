import './ProductionPlanner.css'
import { STANDARD_VOLUME } from '../../lib/recipe'
import { MIXES, SIZES, VOLUME_PRESETS, money, qtyFmt, usePlanner } from '../../lib/usePlanner'

function ProductionPlanner({ rawMaterials = [], pricingRules = [], isProductionPrice = () => false, onLoadIntoBatch }) {
  const { bottleShort, bottledLitres, bottleneck, bottles, factor, ingredientCost, ingredientShort, ingredients, litres, loadIntoBatch, margin, maxBatches, missing, mix, outputValue, overheads, packagingCost, plannedMix, safeLitres, setCustom, setCustomQty, setLitres, setMix, setVolume, surplus, totalBottles, totalCost, volumeGap } = usePlanner({ rawMaterials, pricingRules, isProductionPrice, onLoadIntoBatch })
  return (
    <section className="pp-wrap" aria-label="Production planner">
      <div className="pp-bar">
        <div className={`pp-banner ${bottleShort || ingredientShort ? 'is-bad' : 'is-good'}`} role="status">
          <span aria-hidden="true">{bottleShort || ingredientShort ? '!' : '✓'}</span>
          {bottleShort
            ? <>Bottle stock is short — bottleneck: <strong>{bottleShort.size} bottles</strong> ({bottleShort.short.toLocaleString()} short)</>
            : ingredientShort
              ? <>Raw material shortage — stock covers <strong>{maxBatches.toFixed(1)} batches ({(maxBatches * STANDARD_VOLUME).toFixed(1)} L)</strong>, bottleneck: <strong>{bottleneck?.name}</strong></>
              : <>Stock is sufficient · max feasible <strong>{maxBatches.toFixed(1)} batches ({(maxBatches * STANDARD_VOLUME).toFixed(1)} L)</strong></>}
        </div>
        {onLoadIntoBatch ? <button type="button" className="account-alert-button account-alert-button-dark" onClick={loadIntoBatch}>Load into new batch</button> : null}
      </div>

      <div className="pp-grid">
        <article className="pp-card">
          <h3>Target volume</h3>
          <div className="pp-volume">
            <label className="pp-field">
              <span>Litres</span>
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
