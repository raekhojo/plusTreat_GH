import { useMemo, useState } from 'react'
import { STANDARD_VOLUME } from '../../lib/recipe'
import { usePlanner } from '../../lib/usePlanner'
import { act, currency, day, inPeriod, litresOf, num } from '../format'

// Port of templates/production.html: Interactive Recipe Planner + Production Batches Master Log.
const PACKS = {
  milk: { icon: '🥛', packUnit: '25kg bag', packSize: 25 },
  sugar: { icon: '🍬', packUnit: '50kg sack', packSize: 50 },
  water: { icon: '💧', packUnit: '15L bottle', packSize: 15 },
  starch: { icon: '🌾', packUnit: '25kg bag', packSize: 25 },
  benzoate: { icon: '🧪', packUnit: '1kg pack', packSize: 1000 },
  culture: { icon: '🦠', packUnit: 'sachet', packSize: 1 },
  vanilla: { icon: '🌼', packUnit: 'bottle', packSize: 500 },
  fstraw: { icon: '🍓', packUnit: 'bottle', packSize: 500 },
  fpine: { icon: '🍍', packUnit: 'bottle', packSize: 500 },
  cstraw: { icon: '🎨', packUnit: 'bottle', packSize: 500 },
  cpine: { icon: '🎨', packUnit: 'bottle', packSize: 500 },
}
const PRESETS = [
  { label: '½ Batch (54.6L)', litres: 54.6 },
  { label: '1 Standard Batch (109.2L)', litres: 109.2 },
  { label: '2 Batches (218.4L)', litres: 218.4 },
  { label: '3 Batches (327.6L)', litres: 327.6 },
]
const MIX_OPTIONS = [
  ['custom', '✏️ Custom Specific Quantities'],
  ['balanced', 'Standard Balanced Mix (500ml + 300ml + 1L)'],
  ['mostly_500', '500ml Heavy Focus (~80% 500ml, 20% 300ml)'],
  ['all_500', '100% 500ml Packaged Bottles'],
  ['all_350', '100% 350ml Packaged Bottles'],
  ['all_300', '100% 300ml Packaged Bottles'],
  ['all_200', '100% 200ml Packaged Bottles'],
  ['all_1000', '100% 1,000ml Family Packs'],
]
const LBL = { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }

function Planner({ ctx }) {
  const p = usePlanner({ rawMaterials: ctx.rawMaterials, pricingRules: ctx.data.pricingRules, isProductionPrice: ctx.isProductionPrice, onLoadIntoBatch: ctx.loadPlanIntoBatch })
  const [preset, setPreset] = useState(1)
  const [autoSync, setAutoSync] = useState(false)
  const maxLitres = p.maxBatches * STANDARD_VOLUME
  const mixLabel = MIX_OPTIONS.find(([k]) => k === p.mix)?.[1] || ''

  const setVolume = (v, idx = null) => { p.setVolume(v); setPreset(idx) }
  const setQty = (size, value) => {
    p.setCustomQty(size, value)
    if (autoSync) {
      const next = p.bottles.reduce((t, b) => t + (b.size === size ? Math.max(0, num(value)) : b.qty) * (b.ml / 1000), 0)
      if (next > 0) p.setVolume(next)
      setPreset(null)
    }
  }
  const step = ml => (ml >= 1000 ? 1 : ml >= 500 ? 5 : 10)

  return (
    <div className="card planner-card" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #fbfcfe 100%)', border: '1.5px solid #cbd5e1', borderLeft: '5px solid #0284c7', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)', marginBottom: '26px', borderRadius: 'var(--radius)' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', background: 'transparent', borderBottom: '1px solid #e2e8f0', padding: '18px 22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🧪</span>
            <h2 className="card-title" style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#0f172a' }}>Interactive Recipe Planner &amp; Production Feasibility Engine</h2>
          </div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
            Standard benchmark calibrated to <strong>BATCH-102026-00002</strong> (109.2 L): dynamic ingredient scaling, live warehouse stock feasibility, packaging yield simulator &amp; margin forecasting.
          </div>
        </div>
        {ctx.canManageProduction ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="btn btn-primary" onClick={p.loadIntoBatch} style={{ fontWeight: 700, fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 16px', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)' }}>
              <span>🚀</span><span>Load into Batch Run Form</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="card-body" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '24px', alignItems: 'center', marginBottom: '22px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', color: '#334155', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Target Production Volume</span>
              <span style={{ color: '#0284c7', fontWeight: 800 }}>{p.factor.toFixed(2)} Standard Batch{p.factor === 1 ? '' : 'es'}</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input type="number" className="form-control" value={p.litres} step="0.5" min="10" max="1000" onChange={e => setVolume(e.target.value)} style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', paddingRight: '48px', height: '46px', border: '2px solid #94a3b8', borderRadius: '8px' }} />
              <span style={{ position: 'absolute', right: '14px', top: '11px', fontWeight: 800, color: '#64748b', fontSize: '16px' }}>L</span>
            </div>
            <div style={{ marginTop: '10px' }}>
              <input type="range" min="20" max="500" step="5" value={Math.min(500, Math.max(20, p.safeLitres))} onChange={e => setVolume(e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: '#0284c7' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
                <span>20L (Pilot)</span><span>109.2L (1 Batch)</span><span>218.4L (2 Batches)</span><span>500L</span>
              </div>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: '14px' }}>
              <span style={LBL}>Quick Volume Presets (BATCH-102026-00002 Standard):</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {PRESETS.map((pr, i) => (
                  <button key={pr.label} type="button" className={`btn btn-sm ${preset === i ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVolume(pr.litres, i)} style={{ fontSize: '11.5px', fontWeight: preset === i ? 700 : 600, padding: '5px 11px', ...(preset === i ? null : { background: '#fff' }) }}>{pr.label}</button>
                ))}
                <button type="button" className={`btn btn-sm ${preset === 'max' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVolume(Math.max(10, maxLitres), 'max')} style={{ fontSize: '11.5px', fontWeight: 700, padding: '5px 11px', ...(preset === 'max' ? null : { color: '#047857', borderColor: '#86efac', background: '#f0fdf4' }) }}>
                  ⭐ Max from Stock ({maxLitres.toFixed(1)}L)
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>📦</span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>Planned Bottle Yield:</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1' }}>
                  ~{p.totalBottles.toLocaleString()} bottles ({p.bottles.filter(b => b.qty).length ? p.bottles.filter(b => b.qty).slice(0, 3).map(b => `${b.qty}x ${b.size}`).join(', ') + (p.bottles.filter(b => b.qty).length > 3 ? '...' : '') : 'none planned'})
                </span>
              </div>
              <a href="#plannerSizesSection" onClick={act(() => document.getElementById('classicPlannerSizes')?.scrollIntoView({ behavior: 'smooth' }))} style={{ fontSize: '11.5px', fontWeight: 700, color: '#0284c7', textDecoration: 'none' }}>Plan Specific Bottle Quantities ↓</a>
            </div>
          </div>
        </div>

        <div id="classicPlannerSizes" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '16px 18px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🍾</span>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Planned Product Sizes &amp; Output Quantities:</span>
                <span className="badge" style={{ background: p.mix === 'custom' ? '#fef3c7' : '#e0f2fe', color: p.mix === 'custom' ? '#92400e' : '#0369a1', fontWeight: 700, fontSize: '11px' }}>
                  {p.mix === 'custom' ? '✏️ Custom Specific Quantities' : `Preset: ${mixLabel.replace('100% ', '').replace('Standard ', '')}`}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Enter specific planned quantities for each bottle size below, or select a preset strategy. Overheads, ingredients &amp; warehouse bottle feasibility sync live.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label htmlFor="classicPackMix" style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', margin: 0 }}>Yield Strategy:</label>
                <select id="classicPackMix" value={p.mix} onChange={e => p.setMix(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 600, border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#1e293b', outline: 'none' }}>
                  {MIX_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => { p.setMix('custom'); p.setCustom({}) }} style={{ fontSize: '11.5px', fontWeight: 600, padding: '5px 10px', background: '#fff' }} title="Reset all planned sizes to 0">↺ Reset Sizes</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
            {p.bottles.map(b => {
              const short = b.qty > 0 && b.short > 0
              return (
                <div key={b.size} className="planner-size-card" style={{ background: short ? '#fef2f2' : b.qty > 0 ? '#f0f9ff' : '#f8fafc', border: `1.5px solid ${short ? '#f87171' : b.qty > 0 ? '#38bdf8' : '#e2e8f0'}`, borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'border-color 0.15s, background-color 0.15s' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#0f172a', fontSize: '13.5px', fontWeight: 800 }}>{b.size}</strong>
                      <span className="badge" style={{ fontSize: '10px', fontWeight: 700, background: '#e2e8f0', color: '#475569' }}>{b.ml / 1000}L</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setQty(b.size, Math.max(0, b.qty - step(b.ml)))} style={{ padding: '2px 7px', fontSize: '13px', fontWeight: 800, background: '#fff', lineHeight: 1, borderColor: '#cbd5e1' }} title="Decrease quantity">−</button>
                      <input type="number" min="0" step="1" className="form-control" value={b.qty} onChange={e => setQty(b.size, e.target.value)} style={{ textAlign: 'center', fontSize: '14px', fontWeight: 800, padding: '4px', height: '32px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }} aria-label={`${b.size} bottles`} />
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setQty(b.size, b.qty + step(b.ml))} style={{ padding: '2px 7px', fontSize: '13px', fontWeight: 800, background: '#fff', lineHeight: 1, borderColor: '#cbd5e1' }} title="Increase quantity">+</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      <span>{b.litres.toFixed(1)} L</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>{currency(b.value)}</span>
                    </div>
                    <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed #e2e8f0', fontSize: '10px', color: '#64748b' }}>
                      {short
                        ? <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ Short by {b.short.toLocaleString()} ({b.available.toLocaleString()} in stock)</span>
                        : <span>Stock: <strong style={{ color: '#475569' }}>{b.available.toLocaleString()}</strong> pcs</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Planned Output: <strong style={{ color: '#0369a1', fontWeight: 800 }}>{p.totalBottles.toLocaleString()} bottles</strong></span>
              <span>Packaged Volume: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{p.bottledLitres.toFixed(1)} L</strong></span>
              <span>Target Volume: <strong style={{ color: '#475569', fontWeight: 700 }}>{p.safeLitres.toFixed(1)} L</strong></span>
              <span style={{ fontSize: '11.5px', fontWeight: 700 }}>
                {Math.abs(p.volumeGap) < 0.05
                  ? <span style={{ color: '#059669', fontWeight: 700 }}>✓ Exact Volume Match</span>
                  : p.volumeGap < 0
                    ? <span style={{ color: '#0284c7', fontWeight: 700 }}>({Math.abs(p.volumeGap).toFixed(1)} L unallocated)</span>
                    : <span style={{ color: '#dc2626', fontWeight: 700 }}>(+{p.volumeGap.toFixed(1)} L over target)</span>}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', margin: 0 }} title="When checked, changing bottle quantities will automatically adjust the Target Production Volume">
                <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)} style={{ cursor: 'pointer' }} />
                Auto-scale batch volume to bottles
              </label>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => { if (p.bottledLitres > 0) setVolume(p.bottledLitres) }} style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 11px', color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }} title="Set Target Production Volume to match exact sum of planned bottles">⚡ Set Target Volume from Bottles</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '22px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
          <div>
            <div style={LBL}>Est. Raw Materials Cost</div>
            <div style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{currency(p.ingredientCost + p.packagingCost)}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Core ingredients + bottles</div>
          </div>
          <div>
            <div style={LBL}>Estimated Overheads</div>
            <div style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{currency(p.overheads)}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Power (30) + Gas (30) + Wages (350)</div>
          </div>
          <div>
            <div style={LBL}>Total Production Cost</div>
            <div style={{ fontSize: '19px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>{currency(p.totalCost)}</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>~{currency(p.totalCost / p.safeLitres)} / Litre</div>
          </div>
          <div>
            <div style={LBL}>Est. Wholesale Value</div>
            <div style={{ fontSize: '19px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{currency(p.outputValue)}</div>
            <div style={{ fontSize: '11px', color: '#059669' }}>Across ~{p.totalBottles} bottles</div>
          </div>
          <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ ...LBL, color: '#065f46' }}>Projected Efficiency Surplus</div>
            <div style={{ fontSize: '21px', fontWeight: 800, color: p.surplus >= 0 ? '#047857' : '#dc2626', marginTop: '2px' }}>{p.surplus >= 0 ? '+' : ''}{currency(p.surplus)}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: p.margin >= 35 ? '#059669' : p.margin >= 0 ? '#d97706' : '#dc2626' }}>{p.margin.toFixed(1)}% Projected Margin</div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📦</span><span>Core Ingredients Requirement vs Live Warehouse Inventory:</span>
            </div>
            {p.bottleShort ? (
              <div style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                ⚠️ <strong>Packaging Alert:</strong> Bottle stock shortage for planned sizes (Bottleneck: <strong>{p.bottleShort.size} Bottles</strong>)
              </div>
            ) : p.maxBatches >= p.factor ? (
              <div style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                ✅ Warehouse stock is <strong>sufficient</strong> for this run (Max feasible: <strong>{p.maxBatches.toFixed(1)} Batches / {maxLitres.toFixed(1)}L</strong>)
              </div>
            ) : (
              <div style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                ⚠️ <strong>Inventory Alert:</strong> Raw material stock shortage! Factory can produce max <strong>{p.maxBatches.toFixed(1)} Batches</strong> (Bottleneck: <strong>{p.bottleneck?.material?.name || p.bottleneck?.name}</strong>)
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            {p.ingredients.map(item => {
              const pack = PACKS[item.key] || { icon: '📦', packUnit: 'unit', packSize: 1 }
              const ok = item.available >= item.required
              return (
                <div key={item.key} style={{ background: '#ffffff', border: `1.5px solid ${ok ? '#e2e8f0' : '#fecaca'}`, borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{pack.icon}</span><span>{item.material?.name || item.name}</span>
                      </span>
                      <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px', fontWeight: 700 }}>{ok ? 'Stock OK' : 'Shortage'}</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>
                      {item.required >= 100 ? item.required.toFixed(1) : item.required.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{item.unit}</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600 }}>~{(item.required / pack.packSize).toFixed(2)} {pack.packUnit}</div>
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '2px' }}>
                      <span>Warehouse Stock:</span>
                      <strong style={{ color: ok ? '#0f172a' : '#dc2626' }}>{item.available.toFixed(1)} {item.unit}</strong>
                    </div>
                    {item.shortage > 0
                      ? <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '10.5px' }}>⚠️ Short by {item.shortage.toFixed(1)} {item.unit}</div>
                      : <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0284c7', fontWeight: 600 }}><span>Line Cost:</span><span>{currency(item.cost)}</span></div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassicProduction({ ctx, period }) {
  const batches = useMemo(() => ctx.data.productionBatches
    .filter(b => inPeriod(b.production_date, period))
    .map(b => {
      const value = num(b.total_production_value) || (b.outputs || []).reduce((t, o) => t + num(o.amount), 0)
      const overhead = num(b.electricity_cost) + num(b.gas_cost) + num(b.production_wages)
      return {
        b,
        value,
        overhead,
        litres: (b.outputs || []).reduce((t, o) => t + (num(o.total_litres) || litresOf(o.product_size, o.quantity)), 0),
        surplus: value - num(b.total_cost),
      }
    })
    .sort((x, y) => day(y.b.production_date).localeCompare(day(x.b.production_date)) || num(y.b.id) - num(x.b.id)), [ctx.data.productionBatches, period])

  return (
    <>
      <Planner ctx={ctx} />
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Production Batches Master Log</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Batches: <strong>{batches.length}</strong></div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th className="text-center">Batch Number</th>
                <th className="text-center">Date</th>
                <th className="text-right">Total Litres</th>
                <th className="text-right">Output Value</th>
                <th className="text-right">Raw Materials</th>
                <th className="text-right">Overheads (E/G/W)</th>
                <th className="text-right">Total Cost</th>
                <th className="text-right">Efficiency Surplus</th>
                {ctx.canManageProduction ? <th className="text-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {batches.map(({ b, value, overhead, litres, surplus }) => (
                <tr key={b.id}>
                  <td className="text-center"><strong style={{ color: 'var(--primary)' }}>{b.batch_number || `#${b.id}`}</strong></td>
                  <td className="text-center">{day(b.production_date)}</td>
                  <td className="text-right"><strong>{litres.toFixed(1)} L</strong></td>
                  <td className="text-right"><strong style={{ color: '#059669' }}>{currency(value)}</strong></td>
                  <td className="text-right">
                    <strong>{currency(b.total_raw_material_cost)}</strong>
                    {ctx.canManageProduction ? (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => ctx.openModal('batch', b)} style={{ fontSize: '10.5px', padding: '2px 7px', marginLeft: '6px', background: '#fff' }} title="Edit Raw Materials Used">🧪 Edit RM</button>
                    ) : null}
                  </td>
                  <td className="text-right">{currency(overhead)}</td>
                  <td className="text-right"><strong>{currency(b.total_cost)}</strong></td>
                  <td className="text-right">
                    {surplus > 0 ? <span className="badge badge-success">+{currency(surplus)}</span> : <span className="badge badge-danger">{currency(surplus)}</span>}
                  </td>
                  {ctx.canManageProduction ? (
                    <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <a href="#edit" onClick={act(() => ctx.openModal('batch', b))} className="btn btn-sm btn-secondary" style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 600 }}>✏️ Edit</a>
                        <button type="button" onClick={() => ctx.deleteBatch(b)} className="btn btn-sm btn-secondary" style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 600, color: '#dc2626', borderColor: '#fecaca' }}>🗑️ Delete</button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default ClassicProduction
