// Standard benchmark recipe calibrated to BATCH-102026-00002 (109.2 L run),
// ported from PlusYoghurt-App. Shared by the Production Planner and Copilot.
// `match` finds the corresponding raw material in this app by name.
export const STANDARD_VOLUME = 109.2

export const RECIPE = [
  { key: 'milk', name: 'Milk powder', baseQty: 12.0, unit: 'kg', match: /milk/i },
  { key: 'sugar', name: 'Sugar', baseQty: 8.0, unit: 'kg', match: /sugar/i },
  { key: 'water', name: 'Water', baseQty: 103.5, unit: 'L', match: /water/i },
  { key: 'starch', name: 'Corn starch', baseQty: 1.2, unit: 'kg', match: /corn|starch/i },
  { key: 'benzoate', name: 'Sodium benzoate', baseQty: 40.0, unit: 'g', match: /benzoate|preserv/i },
  { key: 'culture', name: 'Starter culture', baseQty: 1.0, unit: 'pcs', match: /culture|starter/i },
  { key: 'vanilla', name: 'Flavour – vanilla', baseQty: 120.0, unit: 'g', match: /flavou?r.*vanilla|vanilla.*flavou?r/i },
  { key: 'fstraw', name: 'Flavour – strawberry', baseQty: 50.0, unit: 'g', match: /flavou?r.*strawberry|strawberry.*flavou?r/i },
  { key: 'fpine', name: 'Flavour – pineapple', baseQty: 32.5, unit: 'g', match: /flavou?r.*pineapple|pineapple.*flavou?r/i },
  { key: 'cstraw', name: 'Colour – strawberry', baseQty: 7.0, unit: 'g', match: /colou?r.*strawberry|strawberry.*colou?r/i },
  { key: 'cpine', name: 'Colour – pineapple', baseQty: 2.0, unit: 'g', match: /colou?r.*pineapple|pineapple.*colou?r/i },
]

export const BASE_OVERHEADS = { electricity: 30, gas: 30, wages: 350 }

/** Finds the raw material used for a recipe ingredient (never bottles or labels). */
export function matchRecipeMaterial(item, materials) {
  return materials.find(m => item.match.test(String(m.name || '')) && !/bottle|label/i.test(String(m.name || '')))
}
