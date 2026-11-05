import { useMemo, useState } from 'react'
import { BASE_OVERHEADS, RECIPE, STANDARD_VOLUME, matchRecipeMaterial } from './recipe'

// Production planner engine (ported from PlusYoghurt-App production.html):
// scales the benchmark recipe, checks live stock and forecasts cost and margin.

export const SIZES = ['200ml', '300ml', '350ml', '500ml', '1,000ml', '2,000ml', '4,500ml']
export const MIXES = [
  { key: 'balanced', label: 'Standard mix (500ml + 350ml + 200ml)' },
  { key: 'mostly_500', label: 'Mostly 500ml (80%) + 300ml' },
  { key: 'all_500', label: '100% 500ml' },
  { key: 'all_350', label: '100% 350ml' },
  { key: 'all_300', label: '100% 300ml' },
  { key: 'all_200', label: '100% 200ml' },
  { key: 'all_1000', label: '100% 1,000ml' },
  { key: 'custom', label: 'Custom quantities' },
]
export const VOLUME_PRESETS = [
  { label: '½ batch', litres: STANDARD_VOLUME / 2 },
  { label: '1 batch (109.2 L)', litres: STANDARD_VOLUME },
  { label: '2 batches', litres: STANDARD_VOLUME * 2 },
  { label: '3 batches', litres: STANDARD_VOLUME * 3 },
]

export function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
export function money(v) { return `GHS ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))}` }
export function qtyFmt(v, unit) {
  const n = num(v)
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: n >= 100 ? 1 : 2 }).format(n)} ${unit}`
}
export function mlOf(text) {
  const t = String(text || '').toLowerCase().replaceAll(',', '')
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (ml) return num(ml[1])
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/)
  return l ? num(l[1]) * 1000 : 0
}

export function bottleMix(litres, mix) {
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

export function usePlanner({ rawMaterials = [], pricingRules = [], isProductionPrice = () => false, onLoadIntoBatch } = {}) {
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

  return { bottleShort, bottledLitres, bottleneck, bottles, custom, factor, ingredientCost, ingredientShort, ingredients, litres, loadIntoBatch, margin, materials, maxBatches, missing, mix, outputValue, overheads, packagingCost, plannedMix, priceBySize, safeLitres, setCustom, setCustomQty, setLitres, setMix, setVolume, surplus, totalBottles, totalCost, tracked, volumeGap }
}
