import { Children, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import plusLogo from '../assets/plusLogo.png'
import { AppAutocomplete, AppSelect } from '../components/FormSelects'
import {
  createAccountTransaction, createCustomer, createInvoice, createPayment,
  createPricingRule, createProductionBatch, createProductionOutput, createPurchase, createSupplier,
  createPurchasePayment, createProduct, createRawMaterial,
  updateCustomer, deleteCustomer,
  updateSupplier, deleteSupplier,
  updateAccountTransaction, deleteAccountTransaction,
  updatePricingRule, deletePricingRule,
  updateProduct, deleteProduct,
  updateRawMaterial, deleteRawMaterial,
  getAnalyticsSummary,
} from '../lib/api'

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'dashboard',       label: 'Dashboard',          icon: 'home',      subtitle: 'Live summary pulled from Dashboard and Financials workbook logic.',                                          sheets: ['Dashboard', 'Financials'] },
  { key: 'sales_hub',       label: 'Sales Hub',          icon: 'sales',     subtitle: 'Sales entry, invoices, receipts, and customer collections.',                                                sheets: ['Sales_Entry', 'Sales_Dtls', 'Invoice', 'SalesReceipt_Entry', 'SalesReceipt_Dtls', 'Sales'] },
  { key: 'production_ops',  label: 'Production Ops',     icon: 'production',subtitle: 'Batch production, finished stock, and raw material usage.',                                                sheets: ['Production_Entry', 'Production_Dtls', 'Inventory', 'RM_Usage_Dtls', 'Prod Planner'] },
  { key: 'supplies_stock',  label: 'Supplies & Stock',   icon: 'inventory', subtitle: 'Purchases, suppliers, raw materials, and stock control.',                                                   sheets: ['RMPurchases_Entry', 'Purchase_Dtls', 'PurchasePmt_Dtls', 'RawMaterials'] },
  { key: 'customers',       label: 'Customers',          icon: 'customers', subtitle: 'Customer records, invoice history, and outstanding balances.',                                          sheets: ['Customers_Dtls', 'Customers'] },
  { key: 'suppliers',       label: 'Suppliers',          icon: 'suppliers', subtitle: 'Supplier records, purchases, and payable balances.',                                                       sheets: ['Supplier_Dtls'] },
  { key: 'accounts_pricing',label: 'Accounts & Pricing', icon: 'finance',   subtitle: 'Accounts entries, pricing rules, trial balance, and configuration.',                                       sheets: ['Accounts_Entry', 'Accounts_Dtls', 'Trial Balance', 'Pricing'] },
]

const INITIAL_DATA = {
  invoices: [], payments: [], products: [], suppliers: [], purchases: [],
  purchasePayments: [], productionBatches: [], rawMaterials: [],
  accountTransactions: [], pricingRules: [], customers: [], staffProfiles: [],
  pricingCategories: [], customerCategories: [],
}

const PRODUCTION_RAW_MATERIAL_TEMPLATES = [
  'Milk',
  'Sugar',
  'Water',
  'Corn starch',
  'CMC',
  'Sodium Benzoate',
  'Flavour-Vanilla',
  'Flavour-Strawberry',
  'Flavour-Pineapple',
  'Color-Strawberry',
  'Color-Pineapple',
  'Bottles - 200ml',
  'Bottles - 300ml',
  'Bottles - 500ml',
  'Bottles - 1l',
  'Bottles - 2l',
  'Bottles - 4.5l',
  'Labels - 200ml Strawberry',
  'Labels - 300ml Strawberry',
  'Labels - 500ml Strawberry',
  'Labels - 200ml Vanilla',
  'Labels - 300ml Vanilla',
  'Labels - 500ml Vanilla',
  'Labels - 200ml Pineapple',
  'Labels - 300ml Pineapple',
  'Labels - 500ml Pineapple',
]

const FINISHED_GOODS_SIZE_TEMPLATES = [
  '200ml',
  '300ml',
  '500ml',
  '1,000ml',
  '2,000ml',
  '4,500ml',
]

const RAW_MATERIAL_TEMPLATE_DEFAULTS = {
  Milk: { category: 'Ingredients', unit: 'kg' },
  Sugar: { category: 'Ingredients', unit: 'kg' },
  Water: { category: 'Ingredients', unit: 'litres' },
  'Corn starch': { category: 'Ingredients', unit: 'kg' },
  CMC: { category: 'Ingredients', unit: 'kg' },
  'Sodium Benzoate': { category: 'Ingredients', unit: 'g' },
  'Flavour-Vanilla': { category: 'Ingredients', unit: 'ml' },
  'Flavour-Strawberry': { category: 'Ingredients', unit: 'ml' },
  'Flavour-Pineapple': { category: 'Ingredients', unit: 'ml' },
  'Color-Strawberry': { category: 'Ingredients', unit: 'g' },
  'Color-Pineapple': { category: 'Ingredients', unit: 'g' },
  'Bottles - 200ml': { category: 'Packaging', unit: 'Pcs' },
  'Bottles - 300ml': { category: 'Packaging', unit: 'Pcs' },
  'Bottles - 500ml': { category: 'Packaging', unit: 'Pcs' },
  'Bottles - 1l': { category: 'Packaging', unit: 'Pcs' },
  'Bottles - 2l': { category: 'Packaging', unit: 'Pcs' },
  'Bottles - 4.5l': { category: 'Packaging', unit: 'Pcs' },
  'Labels - 200ml Strawberry': { category: 'Labels', unit: 'Pcs' },
  'Labels - 300ml Strawberry': { category: 'Labels', unit: 'Pcs' },
  'Labels - 500ml Strawberry': { category: 'Labels', unit: 'Pcs' },
  'Labels - 200ml Vanilla': { category: 'Labels', unit: 'Pcs' },
  'Labels - 300ml Vanilla': { category: 'Labels', unit: 'Pcs' },
  'Labels - 500ml Vanilla': { category: 'Labels', unit: 'Pcs' },
  'Labels - 200ml Pineapple': { category: 'Labels', unit: 'Pcs' },
  'Labels - 300ml Pineapple': { category: 'Labels', unit: 'Pcs' },
  'Labels - 500ml Pineapple': { category: 'Labels', unit: 'Pcs' },
}

const TRIAL_BALANCE_PERIOD_START = '2026-01-01'
const TRIAL_BALANCE_EXPENSE_START = '2025-10-01'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayValue  = () => new Date().toISOString().slice(0, 10)

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function sumBy(rows, fn) { return rows.reduce((s, r) => s + toNumber(fn(r)), 0) }
function clampRows(rows, n = 5) { return rows.slice(0, n) }
function isThisYear(v) {
  if (!v) return false
  const d = new Date(v)
  return !Number.isNaN(d.getTime()) && d.getFullYear() === new Date().getFullYear()
}

function fmt(v)   { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 }).format(toNumber(v)) }
function fmtQ(v)  { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(toNumber(v)) }
function fmtD(v)  {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}
function fmtStatus(v) { return String(v || '').replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase()) }
function truncateText(value, maxLength = 12) {
  const text = String(value || '').trim()
  if (!text) return '—'
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}…`
}
function normalizeFilterValue(value) {
  return String(value || '').trim().toLowerCase()
}
function getInvoiceCollectionState(invoice) {
  const outstanding = toNumber(invoice?.outstanding_balance)
  const total = toNumber(invoice?.total_amount)
  const paidAmount = total - outstanding
  if (outstanding <= 0 && total > 0) return 'paid'
  if (outstanding > 0 && paidAmount > 0) return 'partial'
  return 'unpaid'
}
function getPriceBand(price) {
  const amount = toNumber(price)
  if (amount < 10) return 'budget'
  if (amount < 30) return 'standard'
  return 'premium'
}
function buildSelectOptions(values, formatter = value => value) {
  return [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map(value => ({ value, label: formatter(value) }))
}
function matchesSelectFilter(actualValue, selectedValue) {
  if (!selectedValue) return true
  return normalizeFilterValue(actualValue) === normalizeFilterValue(selectedValue)
}
function smoothScrollIntoView(target) {
  if (!target || typeof target.scrollIntoView !== 'function') return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })
}
function fmtInv(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return 'INV-00000'
  if (raw.toUpperCase().startsWith('INV-')) return raw.toUpperCase()
  if (/^\d+$/.test(raw)) return `INV-${raw.padStart(5, '0')}`
  return `INV-${raw}`
}
function formatLocalDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function formatDateRange(values) {
  const unique = [...new Set((values || []).filter(Boolean))]
  if (!unique.length) return '—'
  unique.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  if (unique.length === 1) return fmtD(unique[0])
  return `${fmtD(unique[0])} - ${fmtD(unique[unique.length - 1])}`
}
function hasDateRange(range) {
  return Boolean(range?.start || range?.end)
}
function summarizeDateRange(range) {
  if (!hasDateRange(range)) return 'All dates'
  if (range?.start && range?.end) return `${fmtD(range.start)} - ${fmtD(range.end)}`
  if (range?.start) return `From ${fmtD(range.start)}`
  return `Until ${fmtD(range.end)}`
}
function buildDatePresetRange(presetKey) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (presetKey === 'today') {
    const value = formatLocalDateInput(today)
    return { start: value, end: value }
  }
  if (presetKey === 'yesterday') {
    const date = new Date(today)
    date.setDate(date.getDate() - 1)
    const value = formatLocalDateInput(date)
    return { start: value, end: value }
  }
  if (presetKey === 'this_week') {
    const start = new Date(today)
    const dayOfWeek = start.getDay()
    const daysSinceMonday = (dayOfWeek + 6) % 7
    start.setDate(start.getDate() - daysSinceMonday)
    return { start: formatLocalDateInput(start), end: formatLocalDateInput(today) }
  }
  if (presetKey === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: formatLocalDateInput(start), end: formatLocalDateInput(today) }
  }
  return EMPTY_DATE_RANGE
}
function matchesDateRange(rawDate, range) {
  if (!hasDateRange(range)) return true
  if (!rawDate) return false
  const ts = new Date(rawDate).getTime()
  if (Number.isNaN(ts)) return false
  const startTs = range?.start ? new Date(range.start).setHours(0, 0, 0, 0) : null
  const endTs = range?.end ? new Date(range.end).setHours(23, 59, 59, 999) : null
  if (Number.isFinite(startTs) && ts < startTs) return false
  if (Number.isFinite(endTs) && ts > endTs) return false
  return true
}
function filterByDateRange(rows, getDate, range) {
  if (!hasDateRange(range)) return rows
  return rows.filter(row => matchesDateRange(getDate(row), range))
}
function normalizeCategoryValue(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value).trim()
  if (value && typeof value === 'object') {
    const candidate = value.name || value.label || value.category || value.item_category || value.value
    return typeof candidate === 'string' ? candidate.trim() : ''
  }
  return ''
}
function isNumericCategoryValue(value) {
  return /^\d+$/.test(normalizeCategoryValue(value))
}
function resolveSupplierItemCategory(supplier, purchases = [], rawMaterials = []) {
  const directCategory = normalizeCategoryValue(supplier?.item_category)
  if (directCategory && !isNumericCategoryValue(directCategory)) return directCategory

  const supplierId = String(supplier?.id || '')
  const materialCategories = rawMaterials
    .filter(material => String(material.supplier) === supplierId)
    .map(material => normalizeCategoryValue(material.category))
    .filter(category => category && !isNumericCategoryValue(category))
  const purchaseCategories = purchases
    .filter(purchase => String(purchase.supplier) === supplierId)
    .map(purchase => normalizeCategoryValue(purchase.category))
    .filter(category => category && !isNumericCategoryValue(category))
  const uniqueCategories = [...new Set([...materialCategories, ...purchaseCategories])]

  if (!uniqueCategories.length) return directCategory || 'General'
  return uniqueCategories.slice(0, 2).join(', ')
}
function buildCustomerLedger(customers, invoices) {
  return customers.map(c => {
    const invs = invoices.filter(inv => String(inv.customer) === String(c.id))
    const total = sumBy(invs, inv => inv.total_amount)
    const outstanding = sumBy(invs, inv => inv.outstanding_balance)
    return { ...c, invoiceCount: invs.length, paid: total - outstanding, outstanding }
  }).sort((a, b) => b.outstanding - a.outstanding)
}
function buildSupplierLedger(suppliers, purchases) {
  return suppliers.map(s => {
    const purch = purchases.filter(p => String(p.supplier) === String(s.id))
    return { ...s, purchaseCount: purch.length, paid: sumBy(purch, p => p.total_paid), outstanding: sumBy(purch, p => p.outstanding_amount) }
  }).sort((a, b) => b.outstanding - a.outstanding)
}
function normalizeSizeKey(v) {
  return String(v || '').toLowerCase().replaceAll(',', '').replace(/\s+/g, '')
}
function inferTotalLitres(sizeLabel, quantity) {
  const text = String(sizeLabel || '').toLowerCase().replaceAll(',', '').trim()
  const qty = toNumber(quantity)
  if (!text || qty <= 0) return 0
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*ml/)
  if (mlMatch) return (toNumber(mlMatch[1]) / 1000) * qty
  const lMatch = text.match(/(\d+(?:\.\d+)?)\s*l\b/)
  if (lMatch) return toNumber(lMatch[1]) * qty
  return 0
}
function ratioPct(value, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, (toNumber(value) / toNumber(total)) * 100))
}

// ─── Form initialisers ────────────────────────────────────────────────────────

const mkSaleLine       = ()              => ({ productSize: '', pricingRule: '', quantity: '1', unitPrice: '' })
const mkSalePayment    = ()              => ({ amount: '', method: 'cash', reference: '', notes: '' })
const mkSaleForm       = (staffId = '') => ({ customer: '', pricingCategoryId: '', invoiceDate: todayValue(), staff: staffId, discountAmount: '0', notes: '', payments: [mkSalePayment()], lines: [mkSaleLine()] })
const mkReceiptForm    = ()              => ({ invoice: '', paymentDate: todayValue(), payments: [mkSalePayment()] })
const mkBatchUsage     = (materialName = '') => ({ rawMaterial: '', materialName, quantityUsed: '', isTemplate: Boolean(materialName) })
const mkBatchForm      = ()              => ({ productionDate: todayValue(), electricityCost: '', gasCost: '', productionWages: '', notes: '', usages: PRODUCTION_RAW_MATERIAL_TEMPLATES.map(name => mkBatchUsage(name)) })
const mkFinishedGoodsLine = (productSize = '') => ({ productSize, quantity: '' })
const mkFinishedGoodsForm = ()           => ({ batch: '', lines: FINISHED_GOODS_SIZE_TEMPLATES.map(size => mkFinishedGoodsLine(size)) })
const mkPurchaseItem   = ()              => ({ rawMaterial: '', isNewRM: false, newRMName: '', newRMCategory: '', newRMUnit: '', newRMOpeningStock: '0', newRMReorderLevel: '0', quantity: '', unitPerItem: '1', pricePerItem: '' })
const mkPurchaseForm   = ()              => ({ purchaseDate: todayValue(), supplier: '', category: '', notes: '', items: [mkPurchaseItem()], paymentAmount: '', paymentMethod: 'cash', paymentNotes: '' })
const mkPurPayForm     = ()              => ({ purchase: '', paymentDate: todayValue(), amount: '', paymentMethod: 'cash', notes: '' })
const mkCustomerForm   = ()              => ({ name: '', customer_category: '', pricing_category: '', phone: '', email: '', address: '', date: todayValue(), previousBalance: '0', _editId: null })
const mkSupplierForm   = ()              => ({ name: '', item_category: '', delivery_package: false, phone: '', notes: '', _editId: null })
const mkProductForm    = ()              => ({ name: '', description: '', unit_price: '', stock_quantity: '0', production_level: '0', _editId: null })
const mkRawMatForm     = ()              => ({ name: '', category: '', supplier: '', unit: '', unit_per_item: '1', item_price: '0', unit_price: '0', opening_stock: '0', reorder_level: '0', _editId: null })
const mkAccountForm    = ()              => ({ transaction_date: todayValue(), entry_type: 'expense', category: '', description: '', amount: '', payment_method: '', comments: '', _editId: null })
const mkPricingForm    = ()              => ({ product: '', size: '', pricing_category: '', price: '', _editId: null })

const ACCOUNT_TRANS_TYPE_OPTIONS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfers', label: 'Transfers' },
]

const ACCOUNT_SUB_ACCOUNTS_BY_TYPE = {
  transfers: [
    'PPE',
    'Equipment',
    'Cash',
    'MoMo Wallet',
    'CalBank',
    'GhanaPay',
    'Other Receivables',
    'Other Items',
    'Other Payables',
    'Equity',
    'Retained Profit',
  ],
  expense: [
    'Salaries and Wages',
    'Rent and Utilities',
    'Transportation',
    'Marketing and Advertising',
    'Repairs and Maintenance',
    'Depreciation',
    'Raw Material Expenses',
    'Packaging Expenses',
    'Bank Charges',
    'Taxes and Levies',
    'Professional Fees',
    'Miscellaneous Expenses',
  ],
  income: ['Other Income', 'Other Sales'],
}

const ACCOUNT_PAYMENT_RECEIPT_OPTIONS = [
  'Cash',
  'MoMo Wallet',
  'CalBank',
  'GhanaPay',
  'Trade Receivables',
  'Other Receivables',
  'Other Payables',
  'Equity',
]

const BASIC_PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

const DELIVERY_PACKAGE_OPTIONS = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
]

const ACCOUNT_SECTION_TABS = [
  { key: 'entries', label: 'Account Entries' },
  { key: 'pricing', label: 'Pricing Rules' },
  { key: 'trial_balance', label: 'Trial Balance' },
]

const SECTION_TABS = {
  sales_hub: [
    { key: 'sales_list', label: 'Sales List' },
    { key: 'recent_receipts', label: 'Recent Receipts' },
  ],
  production_ops: [
    { key: 'batches', label: 'Production Batches' },
    { key: 'inventory', label: 'Finished Inventory' },
  ],
  supplies_stock: [
    { key: 'purchases', label: 'Purchase Register' },
    { key: 'materials', label: 'Raw Materials' },
    { key: 'balances', label: 'Supplier Balances' },
  ],
  customers: [
    { key: 'customers', label: 'Customers' },
    { key: 'receivables', label: 'Top Receivables' },
  ],
  suppliers: [
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'balances', label: 'Open Balances' },
  ],
}

const SECTION_DEFAULT_TABS = {
  sales_hub: 'sales_list',
  production_ops: 'batches',
  supplies_stock: 'purchases',
  customers: 'customers',
  suppliers: 'suppliers',
}

const EMPTY_DATE_RANGE = { start: '', end: '' }
const DATE_FILTER_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
]

// ─── UI Components ────────────────────────────────────────────────────────────

function NavIcon({ type }) {
  const icons = {
    finance:    <><path d="M5 18h14" /><path d="M7 18V10" /><path d="M12 18V6" /><path d="M17 18V12" /></>,
    sales:      <><path d="M4 7h16v10H4z" /><path d="M8 11h8" /><path d="M8 15h5" /></>,
    production: <><path d="M7 5h10v14H7z" /><path d="M10 2v3" /><path d="M14 2v3" /><path d="M9.5 10h5" /><path d="M9.5 14h5" /></>,
    inventory:  <><path d="M4 8l8-4 8 4-8 4-8-4z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /></>,
    customers:  <><circle cx="9" cy="9" r="3" /><path d="M4.5 18c1.1-2.2 7-2.2 8.9 0" /><circle cx="17" cy="10" r="2.2" /><path d="M14.8 17.2c.7-1.4 4.2-1.4 5.2 0" /></>,
    suppliers:  <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></>,
    home:       <><path d="M4 10.5L12 4l8 6.5V20h-5v-5H9v5H4z" /></>,
    menu:       <><path d="M5 7h14" /><path d="M5 12h14" /><path d="M5 17h14" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[type] || icons.home}</svg>
}

function SummaryGrid({ items }) {
  const slides = Array.isArray(items) ? items : []
  const [index, setIndex] = useState(0)
  const maxIndex = Math.max(0, slides.length - 1)

  useEffect(() => {
    if (index > maxIndex) setIndex(0)
  }, [index, maxIndex])

  return (
    <>
      <section className="dashboard-snippet-stats">
        {items.map(item => (
          <article key={item.label} className="dashboard-snippet-stat">
            <span>{item.label}</span><strong>{item.value}</strong><p>{item.note}</p>
          </article>
        ))}
      </section>

      <section className="summary-mobile-carousel" aria-label="Summary cards">
        <div className="dashboard-mobile-carousel-head">
          <div className="dashboard-mobile-carousel-actions">
            <button
              type="button"
              className="dashboard-mobile-carousel-btn"
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              disabled={index <= 0}
              aria-label="Previous summary card"
            >
              ‹
            </button>
            <button
              type="button"
              className="dashboard-mobile-carousel-btn"
              onClick={() => setIndex((current) => Math.min(maxIndex, current + 1))}
              disabled={index >= maxIndex}
              aria-label="Next summary card"
            >
              ›
            </button>
          </div>
        </div>

        <div className="dashboard-mobile-carousel-viewport">
          <div
            className="dashboard-mobile-carousel-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((item) => (
              <div key={item.label} className="dashboard-mobile-carousel-slide">
                <article className="dashboard-snippet-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-mobile-carousel-dots" aria-label="Summary indicators">
          {slides.map((item, dotIndex) => (
            <button
              key={item.label}
              type="button"
              className={`dashboard-mobile-carousel-dot${dotIndex === index ? ' active' : ''}`}
              onClick={() => setIndex(dotIndex)}
              aria-label={`Go to summary card ${dotIndex + 1}`}
            />
          ))}
        </div>
      </section>
    </>
  )
}

function SkeletonLine({ className = '' }) {
  return <span className={`dashboard-skeleton-line ${className}`.trim()} aria-hidden="true" />
}

function SummaryGridSkeleton({ count = 4 }) {
  return (
    <section className="dashboard-snippet-stats" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="dashboard-snippet-stat dashboard-skeleton-card">
          <SkeletonLine className="dashboard-skeleton-label" />
          <SkeletonLine className="dashboard-skeleton-value" />
          <SkeletonLine className="dashboard-skeleton-note" />
        </article>
      ))}
    </section>
  )
}

function SnippetCard({ title, rows, onItemClick, actionLabel, onAction }) {
  return (
    <article className="account-feature-card dashboard-snippet-card">
      <div className="account-feature-body">
        <div className="dashboard-card-head">
          <h2>{title}</h2>
          {onAction ? <button type="button" className="dashboard-card-link" onClick={onAction}>{actionLabel || 'Open'}</button> : null}
        </div>
        <div className="dashboard-snippet-list">
          {rows.length
            ? rows.map(item => (
                <div
                  key={item.id}
                  className={`dashboard-snippet-row${onItemClick ? ' dashboard-snippet-row-clickable' : ''}`}
                  onClick={() => onItemClick && onItemClick(item.id)}
                >
                  <div><strong>{item.title}</strong><span>{item.meta}</span></div>
                  <em>{item.value}</em>
                </div>
              ))
            : <p className="workspace-empty">No records yet.</p>}
        </div>
      </div>
    </article>
  )
}

function SnippetCardSkeleton({ title, rows = 5 }) {
  return (
    <article className="account-feature-card dashboard-snippet-card dashboard-skeleton-card">
      <div className="account-feature-body">
        <h2>{title}</h2>
        <div className="dashboard-snippet-list">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="dashboard-snippet-row dashboard-skeleton-row">
              <div className="dashboard-skeleton-copy">
                <SkeletonLine className="dashboard-skeleton-title" />
                <SkeletonLine className="dashboard-skeleton-meta" />
              </div>
              <SkeletonLine className="dashboard-skeleton-chip" />
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function DashboardCardCarousel({ children, className = '' }) {
  const slides = Children.toArray(children)
  const [index, setIndex] = useState(0)
  const maxIndex = Math.max(0, slides.length - 1)

  useEffect(() => {
    if (index > maxIndex) setIndex(0)
  }, [index, maxIndex])

  if (!slides.length) return null

  return (
    <>
      <section className={`dashboard-snippet-grid ${className}`.trim()}>
        {slides}
      </section>

      <section className="dashboard-mobile-carousel" aria-label="Dashboard cards">
        <div className="dashboard-mobile-carousel-head">
          <div className="dashboard-mobile-carousel-actions">
            <button
              type="button"
              className="dashboard-mobile-carousel-btn"
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              disabled={index <= 0}
              aria-label="Previous card"
            >
              ‹
            </button>
            <button
              type="button"
              className="dashboard-mobile-carousel-btn"
              onClick={() => setIndex((current) => Math.min(maxIndex, current + 1))}
              disabled={index >= maxIndex}
              aria-label="Next card"
            >
              ›
            </button>
          </div>
        </div>

        <div className="dashboard-mobile-carousel-viewport">
          <div
            className="dashboard-mobile-carousel-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, slideIndex) => (
              <div key={slideIndex} className="dashboard-mobile-carousel-slide">
                {slide}
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-mobile-carousel-dots" aria-label="Slide indicators">
          {slides.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              className={`dashboard-mobile-carousel-dot${dotIndex === index ? ' active' : ''}`}
              onClick={() => setIndex(dotIndex)}
              aria-label={`Go to card ${dotIndex + 1}`}
            />
          ))}
        </div>
      </section>
    </>
  )
}

function TrendChartCard({ title, subtitle, points, legend, actionLabel, onAction }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const maxValue = Math.max(1, ...points.flatMap(point => [toNumber(point.sales), toNumber(point.receipts)]))

  return (
    <article className="account-feature-card dashboard-analytics-card">
      <div className="account-feature-body">
        <div className="dashboard-card-head">
          <div>
          <h2>{title}</h2>
          {subtitle ? <p className="account-feature-sheets">{subtitle}</p> : null}
          </div>
          {onAction ? <button type="button" className="dashboard-card-link" onClick={onAction}>{actionLabel || 'Open'}</button> : null}
        </div>
        <div className="dashboard-trend-chart">
          {points.map(point => (
            <div
              key={point.label}
              className={`dashboard-trend-month${hoveredPoint?.label === point.label ? ' is-active' : ''}`}
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(current => current?.label === point.label ? null : current)}
              onFocus={() => setHoveredPoint(point)}
              onBlur={() => setHoveredPoint(current => current?.label === point.label ? null : current)}
              tabIndex={0}
            >
              {hoveredPoint?.label === point.label ? (
                <div className="dashboard-trend-tooltip" role="status" aria-live="polite">
                  <strong>{point.label}</strong>
                  <span>Sales: {fmt(point.sales)}</span>
                  <span>Receipts: {fmt(point.receipts)}</span>
                </div>
              ) : null}
              <div className="dashboard-trend-bars">
                <span
                  className="dashboard-trend-bar tone-sales"
                  style={{ height: `${Math.max(6, (toNumber(point.sales) / maxValue) * 100)}%` }}
                  title={`${point.label} sales: ${fmt(point.sales)}`}
                />
                <span
                  className="dashboard-trend-bar tone-expense"
                  style={{ height: `${Math.max(6, (toNumber(point.receipts) / maxValue) * 100)}%` }}
                  title={`${point.label} receipts: ${fmt(point.receipts)}`}
                />
              </div>
              <span className="dashboard-trend-label">{point.label}</span>
            </div>
          ))}
        </div>
        <div className="dashboard-trend-legend">
          {legend.map(item => (
            <span key={item.label}>
              <i className={item.tone} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

function DonutBreakdownCard({ title, subtitle, segments, centerLabel, centerValue, actionLabel, onAction }) {
  const [activeSegment, setActiveSegment] = useState(null)
  const total = Math.max(0, sumBy(segments, segment => segment.value))
  const normalized = total > 0 ? segments.filter(segment => toNumber(segment.value) > 0) : []
  const displaySegments = normalized.length ? normalized : [{ label: 'No data yet', value: 0, meta: 'Add records to populate this chart.', color: '#cbd5e1' }]
  const highlightedSegment = activeSegment || displaySegments[0]
  const highlightedValue = total > 0 ? fmt(highlightedSegment?.value || 0) : centerValue
  const highlightedShare = total > 0 ? `${ratioPct(highlightedSegment?.value || 0, total).toFixed(0)}% share` : centerLabel
  const ringSegments = (() => {
    if (!normalized.length || total <= 0) return []
    const radius = 42
    const circumference = 2 * Math.PI * radius
    const gapLength = Math.max(4, circumference * 0.028)
    let offset = circumference * 0.25
    return normalized.map(segment => {
      const rawLength = (toNumber(segment.value) / total) * circumference
      const segmentLength = Math.max(0, rawLength - gapLength)
      const next = {
        ...segment,
        radius,
        circumference,
        dashArray: `${segmentLength} ${circumference}`,
        dashOffset: -offset,
      }
      offset += rawLength
      return next
    })
  })()

  return (
    <article className="account-feature-card dashboard-analytics-card dashboard-donut-card">
      <div className="account-feature-body">
        <div className="dashboard-card-head">
          <div>
          <h2>{title}</h2>
          {subtitle ? <p className="account-feature-sheets">{subtitle}</p> : null}
          </div>
          {onAction ? <button type="button" className="dashboard-card-link" onClick={onAction}>{actionLabel || 'Open'}</button> : null}
        </div>
        <div className="dashboard-donut-layout">
          <div className="dashboard-donut-wrap">
            <div className="dashboard-donut-glow" aria-hidden="true" />
            <svg className="dashboard-donut-chart" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <filter id="dashboard-donut-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="rgba(15,23,42,0.16)" />
                </filter>
              </defs>
              <circle className="dashboard-donut-track" cx="50" cy="50" r="42" />
              {ringSegments.map(segment => (
                <circle
                  key={segment.label}
                  cx="50"
                  cy="50"
                  r={segment.radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={segment.dashArray}
                  strokeDashoffset={segment.dashOffset}
                  filter="url(#dashboard-donut-shadow)"
                  className={activeSegment?.label === segment.label ? 'dashboard-donut-arc is-active' : 'dashboard-donut-arc'}
                />
              ))}
            </svg>
            <div className="dashboard-donut-chart-inner-ring" aria-hidden="true" />
            <div className="dashboard-donut-center">
              <span>{highlightedSegment?.label || centerLabel}</span>
              <strong>{highlightedValue}</strong>
              <em>{highlightedShare}</em>
            </div>
          </div>
          <div className="dashboard-donut-legend">
            {displaySegments.map(segment => (
              <button
                key={segment.label}
                type="button"
                className={`dashboard-donut-legend-row${activeSegment?.label === segment.label ? ' active' : ''}`}
                onMouseEnter={() => setActiveSegment(segment)}
                onMouseLeave={() => setActiveSegment(current => current?.label === segment.label ? null : current)}
                onFocus={() => setActiveSegment(segment)}
                onBlur={() => setActiveSegment(current => current?.label === segment.label ? null : current)}
              >
                <i style={{ background: segment.color }} aria-hidden="true" />
                <div>
                  <strong>{segment.label}</strong>
                  <span>{segment.meta || fmt(segment.value)}</span>
                </div>
                <em>{total > 0 ? `${ratioPct(segment.value, total).toFixed(0)}%` : '0%'}</em>
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

function MeterCard({ title, subtitle, rows, actionLabel, onAction }) {
  return (
    <article className="account-feature-card dashboard-analytics-card">
      <div className="account-feature-body">
        <div className="dashboard-card-head">
          <div>
          <h2>{title}</h2>
          {subtitle ? <p className="account-feature-sheets">{subtitle}</p> : null}
          </div>
          {onAction ? <button type="button" className="dashboard-card-link" onClick={onAction}>{actionLabel || 'Open'}</button> : null}
        </div>
        <div className="dashboard-story-meters">
          {rows.map(row => (
            <div key={row.label} className="dashboard-story-meter-row">
              <div className="dashboard-story-meter-head">
                <strong>{row.label}</strong>
                <em>{row.value}</em>
              </div>
              <span>{row.meta}</span>
              <div className="dashboard-story-meter-track">
                <span
                  className="dashboard-story-meter-fill"
                  style={{
                    width: `${Math.max(4, Math.min(100, toNumber(row.percent)))}%`,
                    background: row.color || 'linear-gradient(90deg, #1d4ed8, #2563eb)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function TableCard({
  title,
  subtitle,
  columns,
  colWidths,
  className = '',
  rows,
  onRowClick,
  search,
  onSearch,
  defaultRowsPerPage = 10,
  rowsPerPageOptions = [10, 20, 50],
  mobileVariant = 'default',
}) {
  const filtered = search
    ? rows.filter(row => row.cells.some(c => String(c).toLowerCase().includes(search.toLowerCase())))
    : rows
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage)
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [search, rowsPerPage, rows.length])

  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * rowsPerPage
  const pageEnd = pageStart + rowsPerPage
  const visibleRows = filtered.slice(pageStart, pageEnd)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const normalizeColWidth = (width) => {
    const raw = String(width || '').trim()
    if (!raw) return 'max-content'
    if (raw.includes('fr')) {
      const px = parseInt(raw, 10)
      return `minmax(${Number.isFinite(px) && px > 0 ? px : 120}px, max-content)`
    }
    if (raw.includes('minmax(') || raw.includes('max-content')) return raw
    return `minmax(${raw}, max-content)`
  }

  const hasCustomWidths = Array.isArray(colWidths) && colWidths.length > 0
  const colTemplate = colWidths
    ? colWidths.map(normalizeColWidth).join(' ')
    : columns.map(col => col === '' ? '72px' : 'minmax(160px, 1fr)').join(' ')
  const mobileColumns = columns.map((col, index) => ({
    key: `${col || 'action'}-${index}`,
    label: col || 'Action',
  }))
  return (
    <article className={`account-feature-card sales-list-card ${className}`.trim()}>
      <div className="workspace-panel-header">
        <div><h2>{title}</h2>{subtitle ? <p className="account-feature-sheets">{subtitle}</p> : null}</div>
        <div className="workspace-panel-controls">
          {onSearch !== undefined && (
            <input
              type="search"
              className="workspace-search"
              placeholder="Search…"
              value={search || ''}
              onChange={e => onSearch(e.target.value)}
            />
          )}
          <span className="workspace-table-count">{totalRows} row{totalRows === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="workspace-table-scroll">
        <div
          className="sales-list-table workspace-table"
          style={{
            '--table-cols': colTemplate,
            width: hasCustomWidths ? 'max-content' : '100%',
            minWidth: '100%',
          }}
        >
          <div className="sales-list-head workspace-table-head">
            {columns.map((col, i) => <span key={i}>{col}</span>)}
          </div>
          {visibleRows.length
            ? visibleRows.map(row => (
                <div
                  key={row.key}
                  className={`sales-list-row workspace-table-row${onRowClick ? ' workspace-table-row-clickable' : ''}`}
                  onClick={() => onRowClick && onRowClick(row.key)}
                >
                  {row.cells.map((cell, i) => (
                    <span key={i} className={i === row.emphasisIndex ? 'workspace-table-strong' : ''}>{cell}</span>
                  ))}
                </div>
              ))
            : <div className="workspace-empty-row">No records yet.</div>}
        </div>
      </div>
      <div className="workspace-mobile-list">
        {visibleRows.length
          ? visibleRows.map(row => {
              if (mobileVariant === 'sales-list') {
                const [date, invoice, customer] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-sales${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <strong className="workspace-mobile-sales-invoice">{invoice}</strong>
                      <span className="workspace-mobile-sales-date">{date}</span>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <span className="workspace-mobile-sales-customer">{customer}</span>
                      <span className="workspace-mobile-sales-arrow" aria-hidden="true">›</span>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'production-batches') {
                const [date, batchNumber, expiryDate, outputs, totalCost, profit] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-production-list${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <strong className="workspace-mobile-sales-invoice">{batchNumber}</strong>
                      <span className="workspace-mobile-sales-date">{date}</span>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <div className="workspace-mobile-production-list-copy">
                        <span className="workspace-mobile-sales-customer">{outputs} outputs</span>
                        <span className="workspace-mobile-production-list-meta">Expiry {expiryDate}</span>
                      </div>
                    </div>
                  </article>
                )
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-production${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-production-top">
                      <div className="workspace-mobile-production-copy">
                        <strong className="workspace-mobile-production-title">{batchNumber}</strong>
                        <span className="workspace-mobile-production-meta">{date}</span>
                      </div>
                      <span className="workspace-mobile-sales-arrow" aria-hidden="true">â€º</span>
                    </div>
                    <div className="workspace-mobile-production-grid">
                      <div className="workspace-mobile-production-stat">
                        <span>Expiry</span>
                        <strong>{expiryDate}</strong>
                      </div>
                      <div className="workspace-mobile-production-stat">
                        <span>Outputs</span>
                        <strong>{outputs}</strong>
                      </div>
                      <div className="workspace-mobile-production-stat">
                        <span>Total Cost</span>
                        <strong>{totalCost}</strong>
                      </div>
                      <div className="workspace-mobile-production-stat">
                        <span>Profit</span>
                        <strong>{profit}</strong>
                      </div>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'customers-list') {
                const [customer, phone, invoices, paid, outstanding] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-customer${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <strong className="workspace-mobile-sales-customer">{customer}</strong>
                      <span className="workspace-mobile-sales-date">{outstanding}</span>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <div className="workspace-mobile-production-list-copy">
                        <span className="workspace-mobile-production-list-meta">{phone}</span>
                        <span className="workspace-mobile-production-list-meta">{invoices} invoices · Paid {paid}</span>
                      </div>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'suppliers-list') {
                const [supplier, itemCategory, purchases, paid, outstanding] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-supplier${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <strong className="workspace-mobile-sales-customer">{supplier}</strong>
                      <span className="workspace-mobile-sales-date">{outstanding}</span>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <div className="workspace-mobile-production-list-copy">
                        <span className="workspace-mobile-production-list-meta">{itemCategory}</span>
                        <span className="workspace-mobile-production-list-meta">{purchases} purchases · Paid {paid}</span>
                      </div>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'accounts-list') {
                const [date, transactionId, _entryType, category, amount] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-account${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <strong className="workspace-mobile-sales-invoice">{transactionId}</strong>
                      <span className="workspace-mobile-sales-date">{date}</span>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <span className="workspace-mobile-sales-customer">{category}</span>
                      <strong className="workspace-mobile-supply-amount">{amount}</strong>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'purchases-list') {
                const [date, purchaseId, supplier, category, status, paid, outstanding] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-supply${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <span className="workspace-mobile-sales-invoice">{purchaseId}</span>
                      <span className="workspace-mobile-sales-date">{date}</span>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <span className="workspace-mobile-sales-customer">{supplier}</span>
                      <strong className="workspace-mobile-supply-amount">{outstanding}</strong>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <div className="workspace-mobile-production-list-copy">
                        <div className="workspace-mobile-supply-tags">
                          <span className="workspace-mobile-supply-tag">{category}</span>
                          <span className="workspace-mobile-supply-tag workspace-mobile-supply-tag-soft">{status}</span>
                        </div>
                        <span className="workspace-mobile-production-list-meta">Paid {paid}</span>
                      </div>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'materials-list') {
                const [material, category, unit, opening, stockIn, available, reorder, status] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-supply${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-sales-top">
                      <strong className="workspace-mobile-sales-customer">{material}</strong>
                      <strong className="workspace-mobile-supply-amount">{available}</strong>
                    </div>
                    <div className="workspace-mobile-sales-bottom">
                      <div className="workspace-mobile-production-list-copy">
                        <div className="workspace-mobile-supply-tags">
                          <span className="workspace-mobile-supply-tag">{category}</span>
                          <span className="workspace-mobile-supply-tag workspace-mobile-supply-tag-soft">{unit}</span>
                        </div>
                        <span className="workspace-mobile-production-list-meta">Opening {opening} · In {stockIn} · Reorder {reorder}</span>
                      </div>
                      <span className="workspace-mobile-supply-status">{status}</span>
                    </div>
                  </article>
                )
              }

              if (mobileVariant === 'inventory-list') {
                const [item, available, stockBalance, prodLevel, prodRequired] = row.cells
                return (
                  <article
                    key={`mobile-${row.key}`}
                    className={`workspace-mobile-card workspace-mobile-card-production${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(row.key)}
                  >
                    <div className="workspace-mobile-production-top">
                      <div className="workspace-mobile-production-copy">
                        <strong className="workspace-mobile-production-title">{item}</strong>
                        <span className="workspace-mobile-production-meta">Finished goods</span>
                      </div>
                      <span className="workspace-mobile-sales-arrow" aria-hidden="true">â€º</span>
                    </div>
                    <div className="workspace-mobile-production-grid">
                      <div className="workspace-mobile-production-stat">
                        <span>Available</span>
                        <strong>{available}</strong>
                      </div>
                      <div className="workspace-mobile-production-stat">
                        <span>Stock Balance</span>
                        <strong>{stockBalance}</strong>
                      </div>
                      <div className="workspace-mobile-production-stat">
                        <span>Prod Level</span>
                        <strong>{prodLevel}</strong>
                      </div>
                      <div className="workspace-mobile-production-stat">
                        <span>Prod Required</span>
                        <strong>{prodRequired}</strong>
                      </div>
                    </div>
                  </article>
                )
              }

              return (
                <article
                  key={`mobile-${row.key}`}
                  className={`workspace-mobile-card${onRowClick ? ' workspace-mobile-card-clickable' : ''}`}
                  onClick={() => onRowClick && onRowClick(row.key)}
                >
                  {row.cells.map((cell, index) => (
                    <div key={mobileColumns[index]?.key || index} className={`workspace-mobile-field${index === row.emphasisIndex ? ' is-strong' : ''}`}>
                      <span className="workspace-mobile-label">{mobileColumns[index]?.label || 'Detail'}</span>
                      <div className="workspace-mobile-value">{cell}</div>
                    </div>
                  ))}
                </article>
              )
            })
          : <div className="workspace-empty-row">No records yet.</div>}
      </div>
      {totalRows > 0 && (
        <div className="workspace-table-pagination">
          <label className="workspace-page-size">
            <span>Rows</span>
            <select value={rowsPerPage} onChange={e => setRowsPerPage(Number(e.target.value) || defaultRowsPerPage)}>
              {rowsPerPageOptions.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span className="workspace-page-status">
            {pageStart + 1}-{Math.min(pageEnd, totalRows)} of {totalRows}
          </span>
          <div className="workspace-page-actions">
            <button type="button" className="workspace-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>Previous</button>
            <button type="button" className="workspace-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</button>
          </div>
        </div>
      )}
    </article>
  )
}

function TableCardSkeleton({ title, subtitle, columns = 5, rows = 5 }) {
  return (
    <article className="account-feature-card sales-list-card dashboard-skeleton-card">
      <div className="workspace-panel-header"><div><h2>{title}</h2>{subtitle ? <p className="account-feature-sheets">{subtitle}</p> : null}</div></div>
      <div className="sales-list-table workspace-table" style={{ '--table-cols': `repeat(${columns}, minmax(0, 1fr))` }}>
        <div className="sales-list-head workspace-table-head">
          {Array.from({ length: columns }).map((_, i) => <SkeletonLine key={i} className="dashboard-skeleton-table-head" />)}
        </div>
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="sales-list-row workspace-table-row dashboard-skeleton-table-row">
            {Array.from({ length: columns }).map((_, ci) => <SkeletonLine key={ci} className="dashboard-skeleton-table-cell" />)}
          </div>
        ))}
      </div>
    </article>
  )
}

function WorkspaceToolbar({ title, subtitle, actions, className = '' }) {
  return (
    <section className={`workspace-toolbar ${className}`.trim()}>
      {title || subtitle ? (
        <div><h2>{title}</h2><p className="account-feature-sheets">{subtitle}</p></div>
      ) : null}
      <div className="workspace-toolbar-actions">{actions}</div>
    </section>
  )
}

function DateFilterControl({ range, onOpen, onClear, onPresetSelect, activePreset = '', inlineTitle = '' }) {
  const active = hasDateRange(range)
  const presetsRef = useRef(null)

  function scrollPresets(direction) {
    const node = presetsRef.current
    if (!node) return
    node.scrollBy({ left: direction * 160, behavior: 'smooth' })
  }

  return (
    <section className="workspace-filter-row" aria-label="Section filters">
      {inlineTitle ? (
        <div className="workspace-filter-header-row">
          <h1>{inlineTitle}</h1>
          <button type="button" className="account-alert-button account-alert-button-light workspace-date-range-button" onClick={onOpen}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M8 3v4" />
              <path d="M16 3v4" />
              <path d="M3 10h18" />
            </svg>
            Date Range
          </button>
        </div>
      ) : (
        <button type="button" className="account-alert-button account-alert-button-light workspace-date-range-button" onClick={onOpen}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M8 3v4" />
            <path d="M16 3v4" />
            <path d="M3 10h18" />
          </svg>
          Date Range
        </button>
      )}
      <div className="workspace-filter-presets-wrap">
        <button
          type="button"
          className="workspace-filter-arrow"
          aria-label="Scroll date filters left"
          onClick={() => scrollPresets(-1)}
        >
          ‹
        </button>
        <div ref={presetsRef} className="workspace-filter-presets" aria-label="Quick date filters">
          {DATE_FILTER_PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              className={`workspace-filter-preset${activePreset === preset.key ? ' active' : ''}`}
              onClick={() => onPresetSelect && onPresetSelect(preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="workspace-filter-arrow"
          aria-label="Scroll date filters right"
          onClick={() => scrollPresets(1)}
        >
          ›
        </button>
      </div>
      {active ? (
        <div className="workspace-filter-active-row">
          <span className="workspace-filter-pill">{summarizeDateRange(range)}</span>
          <button type="button" className="workspace-filter-clear" onClick={onClear}>
            Clear
          </button>
        </div>
      ) : null}
    </section>
  )
}

function ScrollableTabsControl({ tabs = [], activeKey = '', onSelect, ariaLabel = 'Section tabs' }) {
  const tabsRef = useRef(null)

  function scrollTabs(direction) {
    const node = tabsRef.current
    if (!node) return
    node.scrollBy({ left: direction * 160, behavior: 'smooth' })
  }

  return (
    <section className="workspace-inline-tabs-wrap" role="presentation">
      <button
        type="button"
        className="workspace-filter-arrow workspace-inline-tabs-arrow"
        aria-label="Scroll tabs left"
        onClick={() => scrollTabs(-1)}
      >
        â€¹
      </button>
      <section ref={tabsRef} className="workspace-inline-tabs" role="tablist" aria-label={ariaLabel}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeKey}
            className={`workspace-inline-tab ${tab.key === activeKey ? 'active' : ''}`}
            onClick={() => onSelect && onSelect(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </section>
      <button
        type="button"
        className="workspace-filter-arrow workspace-inline-tabs-arrow"
        aria-label="Scroll tabs right"
        onClick={() => scrollTabs(1)}
      >
        â€º
      </button>
    </section>
  )
}

function WorkspaceToolbarSkeleton() {
  return (
    <section className="workspace-toolbar dashboard-skeleton-toolbar">
      <div className="dashboard-skeleton-copy">
        <SkeletonLine className="dashboard-skeleton-heading" />
        <SkeletonLine className="dashboard-skeleton-subtitle" />
      </div>
      <div className="workspace-toolbar-actions">
        <span className="dashboard-skeleton-button" aria-hidden="true" />
        <span className="dashboard-skeleton-button dashboard-skeleton-button-light" aria-hidden="true" />
      </div>
    </section>
  )
}

function WorkbookReference({ title = 'Workbook Coverage', sheets }) {
  return (
    <article className="account-feature-card workspace-meta-card">
      <div className="account-feature-body">
        <h2>{title}</h2>
        <div className="workspace-chip-list">
          {sheets.map(sheet => <span key={sheet} className="workspace-chip">{sheet}</span>)}
        </div>
      </div>
    </article>
  )
}

function WorkbookReferenceSkeleton({ title = 'Workbook Coverage', chips = 6 }) {
  return (
    <article className="account-feature-card workspace-meta-card dashboard-skeleton-card">
      <div className="account-feature-body">
        <h2>{title}</h2>
        <div className="workspace-chip-list">
          {Array.from({ length: chips }).map((_, i) => <span key={i} className="dashboard-skeleton-button dashboard-skeleton-chip" aria-hidden="true" />)}
        </div>
      </div>
    </article>
  )
}

function ModalShell({ kicker, title, subtitle, stat, onClose, children, cardClassName = '', headerAside = null, layer = 60 }) {
  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{ zIndex: layer }}
    >
      <article className={`account-feature-card sales-form-card sales-modal-card ${cardClassName}`.trim()} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="account-feature-body">
          <span className="sales-modal-sheet-handle" aria-hidden="true" />
          <div className="sales-modal-header">
            <div className="sales-modal-copy">
              <span className="sales-modal-kicker">{kicker}</span>
              <h2>{title}</h2>
              {subtitle ? <p className="account-feature-sheets">{subtitle}</p> : null}
            </div>
            <div className="sales-modal-actions">
              {stat ? <span className="sales-modal-stat">{stat}</span> : null}
              {headerAside}
              <button type="button" className="sales-modal-close" onClick={onClose}>Close</button>
            </div>
          </div>
          <div className="sales-modal-content">{children}</div>
        </div>
      </article>
    </div>
  )
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const mobileMenuRef = useRef(null)
  const accountContentRef = useRef(null)

  const [activeSection,    setActiveSection]    = useState('dashboard')
  const [activeAccountsTab,setActiveAccountsTab]= useState('entries')
  const [isMobileNavOpen,  setIsMobileNavOpen]  = useState(false)
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false)
  const [sectionTabs,      setSectionTabs]      = useState(SECTION_DEFAULT_TABS)
  const [activeModal,      setActiveModal]      = useState('')
  const [data,             setData]             = useState(INITIAL_DATA)
  const [isLoading,        setIsLoading]        = useState(true)
  const [loadError,        setLoadError]        = useState('')

  const [saleForm,         setSaleForm]         = useState(() => mkSaleForm(user?.staffProfileId || ''))
  const [receiptForm,      setReceiptForm]      = useState(mkReceiptForm)
  const [batchForm,        setBatchForm]        = useState(mkBatchForm)
  const [finishedGoodsForm,setFinishedGoodsForm]= useState(mkFinishedGoodsForm)
  const [purchaseForm,     setPurchaseForm]     = useState(mkPurchaseForm)
  const [purPayForm,       setPurPayForm]       = useState(mkPurPayForm)
  const [customerForm,     setCustomerForm]     = useState(mkCustomerForm)
  const [supplierForm,     setSupplierForm]     = useState(mkSupplierForm)
  const [productForm,      setProductForm]      = useState(mkProductForm)
  const [rawMatForm,       setRawMatForm]       = useState(mkRawMatForm)
  const [accountForm,      setAccountForm]      = useState(mkAccountForm)
  const [pricingForm,      setPricingForm]      = useState(mkPricingForm)

  const [feedback,         setFeedback]         = useState({})
  const [submitting,       setSubmitting]       = useState({})
  const [searchTerms,      setSearchTerms]      = useState({})
  const [sectionFilters,   setSectionFilters]   = useState({})
  const [sectionDateFilters, setSectionDateFilters] = useState({})
  const [sectionDatePresets, setSectionDatePresets] = useState({})
  const [dateFilterDraft, setDateFilterDraft] = useState(EMPTY_DATE_RANGE)
  const [customItemCategories, setCustomItemCategories] = useState([])
  const [categoryModalTarget, setCategoryModalTarget] = useState('')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [selectedInvoice,     setSelectedInvoice]     = useState(null)
  const [selectedBatch,       setSelectedBatch]       = useState(null)
  const [selectedCustomer,    setSelectedCustomer]    = useState(null)
  const [selectedReceipt,     setSelectedReceipt]     = useState(null)
  const [selectedPurchase,      setSelectedPurchase]      = useState(null)
  const [selectedRawMaterial,   setSelectedRawMaterial]   = useState(null)
  const [selectedSupplier,      setSelectedSupplier]      = useState(null)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null)
  const [selectedAccountEntry,  setSelectedAccountEntry]  = useState(null)
  const batchUsageTailRef = useRef(null)
  const purchaseItemsTailRef = useRef(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getAnalyticsSummary()
      .then(summary => { if (active) { setData({ ...INITIAL_DATA, ...summary }); setLoadError('') } })
      .catch(() => { if (active) setLoadError('Could not load data. Check the API server and refresh.') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    function handlePointerDown(event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setIsMobileProfileOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMobileProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useLayoutEffect(() => {
    function scrollAllTargets() {
      const node = accountContentRef.current
      if (node) {
        node.scrollTo({ top: 0, behavior: 'smooth' })
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      if (typeof document !== 'undefined') {
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
        document.body.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    scrollAllTargets()
    const frame = requestAnimationFrame(() => {
      scrollAllTargets()
    })

    return () => cancelAnimationFrame(frame)
  }, [activeSection, activeAccountsTab, sectionTabs])

  async function refreshData() {
    try {
      const summary = await getAnalyticsSummary()
      setData({ ...INITIAL_DATA, ...summary })
      setLoadError('')
    } catch {
      setLoadError('Data refresh failed. Your view may be stale.')
    }
  }

  // ── Derived maps ──────────────────────────────────────────────────────────

  const productMap = useMemo(() => new Map(data.products.map(p => [String(p.id), p])), [data.products])
  const rawMaterialMap = useMemo(() => new Map(data.rawMaterials.map(m => [String(m.id), m])), [data.rawMaterials])
  const sortedRawMaterials = useMemo(
    () => [...data.rawMaterials].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [data.rawMaterials]
  )
  const pricingRuleMap = useMemo(() => new Map(data.pricingRules.map(r => [String(r.id), r])), [data.pricingRules])
  const invoiceOptions = useMemo(() => data.invoices.filter(inv => toNumber(inv.outstanding_balance) > 0).map(inv => ({ id: inv.id, label: `${fmtInv(inv.id)} — ${inv.customer_name || 'Customer'}`, outstanding: inv.outstanding_balance })), [data.invoices])
  const openPurchases  = useMemo(() => data.purchases.filter(p => p.status === 'open' || p.status === 'partially_paid'), [data.purchases])
  const accountSubAccountOptions = useMemo(
    () => ACCOUNT_SUB_ACCOUNTS_BY_TYPE[accountForm.entry_type] || [],
    [accountForm.entry_type]
  )

  // Shared product-size suggestions from pricing rules
  const productSizes = useMemo(() =>
    [...new Set(data.pricingRules.map(r => r.size).filter(Boolean))].sort()
  , [data.pricingRules])

  // Shared item-category suggestions across raw materials, purchases, and suppliers
  const itemCategories = useMemo(() => {
    const all = [
      ...data.rawMaterials.map(m => m.category),
      ...data.purchases.map(p => p.category),
      ...data.suppliers.map(s => s.item_category),
    ]
    return [...new Set([
      ...all.map(normalizeCategoryValue).filter(category => category && !isNumericCategoryValue(category)),
      ...customItemCategories.map(normalizeCategoryValue).filter(category => category && !isNumericCategoryValue(category)),
    ])].sort((a, b) => a.localeCompare(b))
  }, [customItemCategories, data.rawMaterials, data.purchases, data.suppliers])
  const customerSelectOptions = useMemo(
    () => data.customers
      .map(customer => ({ value: String(customer.id), label: customer.name, meta: customer.phone || customer.customer_category_name || '' }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [data.customers]
  )
  const invoiceSelectOptions = useMemo(
    () => invoiceOptions.map(invoice => ({
      value: String(invoice.id),
      label: invoice.label,
      meta: fmt(invoice.outstanding),
      searchText: `${invoice.label} ${fmt(invoice.outstanding)}`,
    })),
    [invoiceOptions]
  )
  const rawMaterialSelectOptions = useMemo(
    () => sortedRawMaterials.map(material => {
      const available = toNumber(material.opening_stock) + toNumber(material.stock_in) - toNumber(material.stock_out)
      return {
        value: String(material.id),
        label: material.name,
        meta: `${fmtQ(available)} ${material.unit || ''}`.trim(),
      }
    }),
    [sortedRawMaterials]
  )
  const supplierSelectOptions = useMemo(
    () => data.suppliers
      .map(supplier => ({ value: String(supplier.id), label: supplier.name, meta: resolveSupplierItemCategory(supplier, data.purchases, data.rawMaterials) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [data.purchases, data.rawMaterials, data.suppliers]
  )
  const purchaseSelectOptions = useMemo(
    () => openPurchases.map(purchase => ({
      value: String(purchase.id),
      label: `#${purchase.id} — ${purchase.supplier_name || 'Supplier'}`,
      meta: fmt(purchase.outstanding_amount),
    })),
    [openPurchases]
  )
  const itemCategoryOptions = useMemo(
    () => itemCategories.map(category => ({ value: category, label: category })),
    [itemCategories]
  )
  const customerCategoryOptions = useMemo(
    () => data.customerCategories.map(category => ({ value: String(category.id), label: category.name })),
    [data.customerCategories]
  )
  const pricingCategoryOptions = useMemo(
    () => data.pricingCategories.map(category => ({ value: String(category.id), label: category.name })),
    [data.pricingCategories]
  )
  const productSelectOptions = useMemo(
    () => [...data.products]
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map(product => ({ value: String(product.id), label: product.name, meta: fmtQ(product.stock_quantity) })),
    [data.products]
  )
  const batchSelectOptions = useMemo(
    () => data.productionBatches.map(batch => ({
      value: String(batch.id),
      label: batch.batch_number || `Batch #${batch.id}`,
      meta: fmtD(batch.production_date),
      searchText: `${batch.batch_number || `Batch #${batch.id}`} ${fmtD(batch.production_date)}`,
    })),
    [data.productionBatches]
  )
  const accountTypeOptions = useMemo(
    () => ACCOUNT_TRANS_TYPE_OPTIONS.map(option => ({ value: option.value, label: option.label })),
    []
  )
  const accountSubAccountSelectOptions = useMemo(
    () => accountSubAccountOptions.map(option => ({ value: option, label: option })),
    [accountSubAccountOptions]
  )
  const accountPaymentOptions = useMemo(
    () => ACCOUNT_PAYMENT_RECEIPT_OPTIONS.map(option => ({ value: option, label: option })),
    []
  )

  const customerLedger = useMemo(() => buildCustomerLedger(data.customers, data.invoices), [data.customers, data.invoices])
  const supplierLedger = useMemo(() => buildSupplierLedger(data.suppliers, data.purchases), [data.suppliers, data.purchases])

  const dashboardDateFilter = sectionDateFilters.dashboard || EMPTY_DATE_RANGE
  const salesDateFilter = sectionDateFilters.sales_hub || EMPTY_DATE_RANGE
  const productionDateFilter = sectionDateFilters.production_ops || EMPTY_DATE_RANGE
  const suppliesDateFilter = sectionDateFilters.supplies_stock || EMPTY_DATE_RANGE
  const customersDateFilter = sectionDateFilters.customers || EMPTY_DATE_RANGE
  const suppliersDateFilter = sectionDateFilters.suppliers || EMPTY_DATE_RANGE
  const accountsDateFilter = sectionDateFilters.accounts_pricing || EMPTY_DATE_RANGE

  const dashboardInvoices = useMemo(() => filterByDateRange(data.invoices, inv => inv.invoice_date, dashboardDateFilter), [data.invoices, dashboardDateFilter])
  const dashboardPayments = useMemo(() => filterByDateRange(data.payments, p => p.payment_date, dashboardDateFilter), [data.payments, dashboardDateFilter])
  const dashboardBatches = useMemo(() => filterByDateRange(data.productionBatches, b => b.production_date, dashboardDateFilter), [data.productionBatches, dashboardDateFilter])
  const dashboardAccounts = useMemo(() => filterByDateRange(data.accountTransactions, e => e.transaction_date, dashboardDateFilter), [data.accountTransactions, dashboardDateFilter])

  const salesInvoices = useMemo(() => filterByDateRange(data.invoices, inv => inv.invoice_date, salesDateFilter), [data.invoices, salesDateFilter])
  const salesPayments = useMemo(() => filterByDateRange(data.payments, p => p.payment_date, salesDateFilter), [data.payments, salesDateFilter])
  const productionBatchesFiltered = useMemo(() => filterByDateRange(data.productionBatches, b => b.production_date, productionDateFilter), [data.productionBatches, productionDateFilter])
  const purchasesFiltered = useMemo(() => filterByDateRange(data.purchases, p => p.purchase_date, suppliesDateFilter), [data.purchases, suppliesDateFilter])
  const customerInvoicesFiltered = useMemo(() => filterByDateRange(data.invoices, inv => inv.invoice_date, customersDateFilter), [data.invoices, customersDateFilter])
  const customerPaymentsFiltered = useMemo(() => filterByDateRange(data.payments, p => p.payment_date, customersDateFilter), [data.payments, customersDateFilter])
  const supplierPurchasesFiltered = useMemo(() => filterByDateRange(data.purchases, p => p.purchase_date, suppliersDateFilter), [data.purchases, suppliersDateFilter])
  const accountTransactionsFiltered = useMemo(() => filterByDateRange(data.accountTransactions, e => e.transaction_date, accountsDateFilter), [data.accountTransactions, accountsDateFilter])

  const salesFilterScope = `sales_hub:${sectionTabs.sales_hub || SECTION_DEFAULT_TABS.sales_hub}`
  const pricingFilterScope = `accounts_pricing:${activeAccountsTab}`

  const filteredSalesInvoices = useMemo(() => {
    const filters = sectionFilters[salesFilterScope] || {}
    return salesInvoices.filter(invoice => {
      if (!matchesSelectFilter(invoice.customer_name, filters.customer)) return false
      if (!matchesSelectFilter(getInvoiceCollectionState(invoice), filters.status)) return false
      return true
    })
  }, [salesFilterScope, salesInvoices, sectionFilters])

  const filteredSalesPayments = useMemo(() => {
    const filters = sectionFilters[salesFilterScope] || {}
    return salesPayments.filter(payment => {
      if (!matchesSelectFilter(payment.customer_name, filters.customer)) return false
      if (!matchesSelectFilter(payment.method, filters.method)) return false
      return true
    })
  }, [salesFilterScope, salesPayments, sectionFilters])

  const filteredPricingRules = useMemo(() => {
    const filters = sectionFilters[pricingFilterScope] || {}
    return data.pricingRules.filter(rule => {
      if (!matchesSelectFilter(rule.pricing_category_name, filters.price_type)) return false
      if (!matchesSelectFilter(rule.size, filters.size)) return false
      if (!matchesSelectFilter(rule.product_name || rule.size, filters.item)) return false
      if (!matchesSelectFilter(getPriceBand(rule.price), filters.price_band)) return false
      return true
    })
  }, [data.pricingRules, pricingFilterScope, sectionFilters])

  const filteredCustomerLedger = useMemo(() => buildCustomerLedger(data.customers, customerInvoicesFiltered), [data.customers, customerInvoicesFiltered])
  const filteredSupplierLedgerForSupplies = useMemo(() => buildSupplierLedger(data.suppliers, purchasesFiltered), [data.suppliers, purchasesFiltered])
  const filteredSupplierLedger = useMemo(() => buildSupplierLedger(data.suppliers, supplierPurchasesFiltered), [data.suppliers, supplierPurchasesFiltered])

  const lowStockRows = useMemo(() => data.rawMaterials.map(m => ({
    ...m, available: toNumber(m.opening_stock) + toNumber(m.stock_in) - toNumber(m.stock_out)
  })).sort((a, b) => a.available - b.available), [data.rawMaterials])

  // Finished goods inventory — derived by product size, matching the Inventory sheet logic
  const inventoryLedger = useMemo(() => {
    // Master size list from pricing rules; fall back to any size seen in production or sales
    const sizeSet = new Set([
      ...data.pricingRules.map(r => r.size).filter(Boolean),
      ...data.productionBatches.flatMap(b => (b.outputs || []).map(o => o.product_size)).filter(Boolean),
      ...data.invoices.flatMap(inv => (inv.lines || []).map(l => l.product_size)).filter(Boolean),
    ])
    const allOutputs = data.productionBatches.flatMap(b =>
      (b.outputs || []).map(o => ({ ...o, production_date: b.production_date, batch_number: b.batch_number, batch_id: b.id }))
    )
    const allSaleLines = data.invoices.flatMap(inv =>
      (inv.lines || []).map(l => ({ ...l, invoice_date: inv.invoice_date, invoice_id: inv.id, customer_name: inv.customer_name }))
    )
    return [...sizeSet].sort().map((size, idx) => {
      const outputs   = allOutputs.filter(o => o.product_size === size)
      const saleLines = allSaleLines.filter(l => l.product_size === size)
      const stockIn   = sumBy(outputs, o => o.quantity)
      const stockOut  = sumBy(saleLines, l => l.quantity)
      const opening   = 0
      // Use lowest pricing rule price for stock balance valuation
      const sizeRules = data.pricingRules.filter(r => r.size === size)
      const price     = sizeRules.length ? Math.min(...sizeRules.map(r => toNumber(r.price))) : 0
      // Production level from Product whose name matches the size
      const matchingProduct = data.products.find(p => normalizeSizeKey(p.name) === normalizeSizeKey(size))
      const availableByMovements = opening + stockIn - stockOut
      const available = matchingProduct ? toNumber(matchingProduct.stock_quantity) : availableByMovements
      const stockBalance = price * available
      const productionLevel = matchingProduct ? toNumber(matchingProduct.production_level) : 0
      const prodRequired    = productionLevel > 0 && available <= productionLevel
      return {
        id: `INV-${String(idx + 1).padStart(4, '0')}`,
        size,
        unit: 'Pcs',
        opening,
        stockIn,
        stockOut,
        available,
        price,
        stockBalance,
        productionLevel,
        prodRequired,
        productionHistory: outputs.sort((a, b) => new Date(b.production_date) - new Date(a.production_date)),
        salesHistory: saleLines.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date)),
      }
    })
  }, [data.pricingRules, data.productionBatches, data.invoices, data.products])

  const dashboardContent = useMemo(() => {
    const ytdInv   = dashboardInvoices.filter(inv => isThisYear(inv.invoice_date))
    const ytdBatch = dashboardBatches.filter(b => isThisYear(b.production_date))
    const ytdAcct  = dashboardAccounts.filter(e => isThisYear(e.transaction_date))

    const totalSales       = sumBy(ytdInv, inv => inv.total_amount)
    const outstanding      = sumBy(dashboardInvoices, inv => inv.outstanding_balance)
    const totalCost        = sumBy(ytdBatch, b => b.total_cost)
    const receiptsTotal    = sumBy(dashboardPayments, p => p.amount)
    const expenseTotal     = sumBy(ytdAcct.filter(e => e.entry_type === 'expense'), e => e.amount)
    const grossProfit      = totalSales - totalCost
    const netProfit        = grossProfit - expenseTotal
    const openInvoices     = dashboardInvoices.filter(inv => toNumber(inv.outstanding_balance) > 0)
    const avgInvoiceValue  = ytdInv.length ? totalSales / ytdInv.length : 0
    const collectionRate   = ratioPct(receiptsTotal, Math.max(totalSales, receiptsTotal))
    const grossMarginPct   = ratioPct(grossProfit, totalSales)
    const lowStockCount    = lowStockRows.filter(m => toNumber(m.available) <= toNumber(m.reorder_level || 0)).length
    const stockRiskPct     = ratioPct(lowStockCount, Math.max(data.rawMaterials.length, 1))

    const custSales = data.customers.map(c => {
      const invs = dashboardInvoices.filter(inv => String(inv.customer) === String(c.id))
      return { id: c.id, title: c.name, meta: `${invs.length} invoices`, salesValue: sumBy(invs, inv => inv.total_amount), outstanding: sumBy(invs, inv => inv.outstanding_balance) }
    }).sort((a, b) => b.salesValue - a.salesValue)

    const prodMap = new Map()
    dashboardInvoices.forEach(inv => (inv.lines || []).forEach(line => {
      const k = String(line.pricing_rule || line.id)
      const cur = prodMap.get(k) || { id: k, title: line.product_size || line.pricing_category || 'Product', quantity: 0, amount: 0 }
      cur.quantity += toNumber(line.quantity)
      cur.amount   += toNumber(line.line_total)
      prodMap.set(k, cur)
    }))
    const prodSales = [...prodMap.values()].sort((a, b) => b.amount - a.amount)

    const finishedGoods = data.products.map(p => {
      const sold = prodSales.find(s => s.id === String(p.id) || s.title === p.name)
      return { id: p.id, title: p.name, meta: `${fmtQ(sold?.quantity || 0)} sold`, left: toNumber(p.stock_quantity) }
    }).sort((a, b) => a.left - b.left)

    const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date()
      monthDate.setDate(1)
      monthDate.setMonth(monthDate.getMonth() - (5 - index))
      const month = monthDate.getMonth()
      const year = monthDate.getFullYear()

      const monthSales = sumBy(dashboardInvoices.filter(inv => {
        const invoiceDate = new Date(inv.invoice_date)
        return !Number.isNaN(invoiceDate.getTime()) && invoiceDate.getMonth() === month && invoiceDate.getFullYear() === year
      }), inv => inv.total_amount)

      const monthReceipts = sumBy(dashboardPayments.filter(payment => {
        const paymentDate = new Date(payment.payment_date)
        return !Number.isNaN(paymentDate.getTime()) && paymentDate.getMonth() === month && paymentDate.getFullYear() === year
      }), payment => payment.amount)

      return {
        label: monthDate.toLocaleString('en-US', { month: 'short' }),
        sales: monthSales,
        receipts: monthReceipts,
      }
    })

    const invoiceStatusSegments = [
      {
        label: 'Collected',
        value: sumBy(dashboardInvoices.filter(inv => toNumber(inv.outstanding_balance) <= 0), inv => inv.total_amount),
        meta: `${dashboardInvoices.filter(inv => toNumber(inv.outstanding_balance) <= 0).length} invoices settled`,
        color: '#2492da',
      },
      {
        label: 'Partially Paid',
        value: sumBy(dashboardInvoices.filter(inv => {
          const paidAmount = toNumber(inv.previous_balance) + toNumber(inv.total_amount) - toNumber(inv.outstanding_balance)
          return toNumber(inv.outstanding_balance) > 0 && paidAmount > 0
        }), inv => inv.outstanding_balance),
        meta: `${dashboardInvoices.filter(inv => {
          const paidAmount = toNumber(inv.previous_balance) + toNumber(inv.total_amount) - toNumber(inv.outstanding_balance)
          return toNumber(inv.outstanding_balance) > 0 && paidAmount > 0
        }).length} invoices still collecting`,
        color: '#f2b13a',
      },
      {
        label: 'Unpaid',
        value: sumBy(dashboardInvoices.filter(inv => {
          const paidAmount = toNumber(inv.previous_balance) + toNumber(inv.total_amount) - toNumber(inv.outstanding_balance)
          return toNumber(inv.outstanding_balance) > 0 && paidAmount <= 0
        }), inv => inv.outstanding_balance),
        meta: `${dashboardInvoices.filter(inv => {
          const paidAmount = toNumber(inv.previous_balance) + toNumber(inv.total_amount) - toNumber(inv.outstanding_balance)
          return toNumber(inv.outstanding_balance) > 0 && paidAmount <= 0
        }).length} invoices untouched`,
        color: '#ef4444',
      },
    ]

    const paymentMethodSegments = Object.entries(
      dashboardPayments.reduce((acc, payment) => {
        const key = fmtStatus(payment.method || 'other')
        acc[key] = (acc[key] || 0) + toNumber(payment.amount)
        return acc
      }, {})
    )
      .map(([label, value]) => ({
        label,
        value,
        meta: `${fmt(value)} collected`,
      }))
      .sort((a, b) => b.value - a.value)
      .map((segment, index) => ({
        ...segment,
        color: ['#2492da', '#f2b13a', '#14b8a6', '#7c3aed', '#ef4444'][index % 5],
      }))

    const dashboardSignals = [
      {
        label: 'Collection Rate',
        value: `${collectionRate.toFixed(0)}%`,
        meta: 'Receipts collected versus sales booked',
        percent: collectionRate,
        color: 'linear-gradient(90deg, #2492da, #48b1ec)',
      },
      {
        label: 'Gross Margin',
        value: `${grossMarginPct.toFixed(0)}%`,
        meta: 'Sales left after production cost',
        percent: grossMarginPct,
        color: 'linear-gradient(90deg, #f2b13a, #c7851d)',
      },
      {
        label: 'Average Invoice',
        value: fmt(avgInvoiceValue),
        meta: `${ytdInv.length} YTD invoices averaged`,
        percent: ratioPct(avgInvoiceValue, Math.max(...ytdInv.map(inv => toNumber(inv.total_amount)), avgInvoiceValue, 1)),
        color: 'linear-gradient(90deg, #14b8a6, #0f766e)',
      },
      {
        label: 'Raw Material Risk',
        value: `${lowStockCount} low stock`,
        meta: 'Materials at or below reorder level',
        percent: stockRiskPct,
        color: 'linear-gradient(90deg, #ef4444, #b91c1c)',
      },
    ]

    return {
      metrics: [
        { label: 'Total Sales (YTD)',         value: fmt(totalSales),    note: `${ytdInv.length} invoices this year` },
        { label: 'Outstanding Receivables',   value: fmt(outstanding),   note: `${dashboardInvoices.filter(inv => toNumber(inv.outstanding_balance) > 0).length} open invoices` },
        { label: 'Production Batches (YTD)',  value: fmtQ(ytdBatch.length), note: 'Batches recorded this year' },
        { label: 'Production Cost (YTD)',     value: fmt(totalCost),     note: 'Sum of batch costs' },
        { label: 'Gross Profit (YTD)',        value: fmt(grossProfit),   note: 'Sales minus production cost' },
        { label: 'Average Invoice (YTD)',     value: fmt(avgInvoiceValue), note: 'Average value per YTD invoice' },
      ],
      monthlyTrend,
      invoiceStatusSegments,
      paymentMethodSegments,
      dashboardSignals,
      topCustomers:   clampRows(custSales).map(c => ({ id: c.id,    title: c.title, meta: c.meta, value: fmt(c.salesValue) })),
      topProducts:    clampRows(prodSales).map(p => ({ id: p.id,    title: p.title, meta: `${fmtQ(p.quantity)} sold`, value: fmt(p.amount) })),
      rawMaterials:   clampRows(lowStockRows).map(m => ({ id: m.id, title: m.name,  meta: `Reorder at ${fmtQ(m.reorder_level)} ${m.unit || ''}`.trim(), value: fmtQ(m.available) })),
      finishedGoods:  clampRows(finishedGoods).map(p => ({ id: p.id, title: p.title, meta: p.meta, value: fmtQ(p.left) })),
      plStatement: [
        { id: 'revenue',   title: 'Revenue',              meta: 'YTD invoice value',        value: fmt(totalSales) },
        { id: 'cogs',      title: 'Cost of Sales',        meta: 'Production batch cost',    value: fmt(totalCost) },
        { id: 'gross',     title: 'Gross Profit',         meta: 'Revenue minus cost',       value: fmt(grossProfit) },
        { id: 'receipts',  title: 'Receipts Collected',   meta: 'Payments received',        value: fmt(receiptsTotal) },
        { id: 'expenses',  title: 'Operating Expenses',   meta: 'Expense account entries',  value: fmt(expenseTotal) },
        { id: 'net',       title: 'Net Profit / Loss',    meta: 'Gross profit minus expenses', value: fmt(netProfit) },
      ],
      receivables:    clampRows(custSales.filter(c => c.outstanding > 0)).map(c => ({ id: c.id, title: c.title, meta: 'Amount outstanding', value: fmt(c.outstanding) })),
      openInvoices:   clampRows(openInvoices).map(inv => ({ id: inv.id, title: fmtInv(inv.id), meta: inv.customer_name || 'Customer', value: fmt(inv.outstanding_balance) })),
    }
  }, [dashboardAccounts, dashboardBatches, dashboardInvoices, dashboardPayments, data.customers, data.products, data.rawMaterials.length, lowStockRows])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function setFB(key, val) { setFeedback(f => ({ ...f, [key]: val })) }
  function setSub(key, val) { setSubmitting(s => ({ ...s, [key]: val })) }
  function setSearch(key, val) { setSearchTerms(t => ({ ...t, [key]: val })) }
  function addBatchUsageLine() {
    setBatchForm(current => ({ ...current, usages: [...current.usages, mkBatchUsage('')] }))
    smoothScrollIntoView(batchUsageTailRef.current)
  }
  function addPurchaseItemLine() {
    setPurchaseForm(current => ({ ...current, items: [...current.items, mkPurchaseItem()] }))
    smoothScrollIntoView(purchaseItemsTailRef.current)
  }
  function getScopedFilters(scope) {
    return sectionFilters[scope] || {}
  }
  function setScopedFilter(scope, key, value) {
    setSectionFilters(current => {
      const existing = current[scope] || {}
      const nextValues = { ...existing }
      if (value) nextValues[key] = value
      else delete nextValues[key]
      const updated = { ...current }
      if (Object.keys(nextValues).length) updated[scope] = nextValues
      else delete updated[scope]
      return updated
    })
  }
  function clearScopedFilters(scope) {
    setSectionFilters(current => {
      const updated = { ...current }
      delete updated[scope]
      return updated
    })
  }
  function openCategoryModal(target) {
    setCategoryModalTarget(target)
    setCategoryDraft('')
  }
  function closeCategoryModal() {
    setCategoryModalTarget('')
    setCategoryDraft('')
  }
  function saveCategoryFromModal(e) {
    e.preventDefault()
    const value = normalizeCategoryValue(categoryDraft)
    if (!value) return
    setCustomItemCategories(current => current.includes(value) ? current : [...current, value])
    if (categoryModalTarget === 'supplier') {
      setSupplierForm(current => ({ ...current, item_category: value }))
    }
    if (categoryModalTarget === 'purchase') {
      setPurchaseForm(current => ({ ...current, category: value }))
    }
    if (categoryModalTarget === 'raw_mat') {
      setRawMatForm(current => ({ ...current, category: value }))
    }
    closeCategoryModal()
  }
  function openDateFilter() {
    setDateFilterDraft(sectionDateFilters[activeSection] || EMPTY_DATE_RANGE)
    setActiveModal('date_filter')
  }
  function applyDateFilter(e) {
    e.preventDefault()
    const next = {
      start: dateFilterDraft.start || '',
      end: dateFilterDraft.end || '',
    }
    setSectionDateFilters(current => {
      const updated = { ...current }
      if (hasDateRange(next)) updated[activeSection] = next
      else delete updated[activeSection]
      return updated
    })
    setSectionDatePresets(current => {
      const updated = { ...current }
      delete updated[activeSection]
      return updated
    })
    setActiveModal('')
  }
  function clearDateFilter(sectionKey = activeSection) {
    setSectionDateFilters(current => {
      const updated = { ...current }
      delete updated[sectionKey]
      return updated
    })
    setSectionDatePresets(current => {
      const updated = { ...current }
      delete updated[sectionKey]
      return updated
    })
    if (activeModal === 'date_filter') setActiveModal('')
  }
  function applyQuickDatePreset(sectionKey, presetKey) {
    const next = buildDatePresetRange(presetKey)
    setSectionDateFilters(current => ({ ...current, [sectionKey]: next }))
    setSectionDatePresets(current => ({ ...current, [sectionKey]: presetKey }))
    if (activeModal === 'date_filter') setActiveModal('')
  }

  function openModal(type, entity = null) {
    setActiveModal(type)
    setFB(type, '')
    if (type === 'sale')        setSaleForm(mkSaleForm(user?.staffProfileId || ''))
    if (type === 'receipt')     setReceiptForm(mkReceiptForm())
    if (type === 'batch')       setBatchForm(mkBatchForm())
    if (type === 'finished_goods') setFinishedGoodsForm(mkFinishedGoodsForm())
    if (type === 'purchase')    setPurchaseForm(mkPurchaseForm())
    if (type === 'pur_pay')     setPurPayForm(mkPurPayForm())
    if (type === 'customer')    setCustomerForm(entity ? { ...mkCustomerForm(), ...entity, pricing_category: entity.pricing_category_id || '', previousBalance: entity.previous_balance || '0', _editId: entity.id } : mkCustomerForm())
    if (type === 'supplier')    setSupplierForm(entity ? { ...entity, item_category: resolveSupplierItemCategory(entity, data.purchases, data.rawMaterials), delivery_package: Boolean(entity.delivery_package), _editId: entity.id } : mkSupplierForm())
    if (type === 'product')     setProductForm(entity ? { ...entity, _editId: entity.id } : mkProductForm())
    if (type === 'raw_mat')     setRawMatForm(entity ? {
      ...mkRawMatForm(),
      ...entity,
      supplier: entity.supplier ? String(entity.supplier) : '',
      unit_per_item: entity.unit_per_item ? String(entity.unit_per_item) : '1',
      item_price: entity.item_price ? String(entity.item_price) : '0',
      unit_price: entity.unit_price ? String(entity.unit_price) : '0',
      opening_stock: entity.opening_stock ? String(entity.opening_stock) : '0',
      reorder_level: entity.reorder_level ? String(entity.reorder_level) : '0',
      _editId: entity.id,
    } : mkRawMatForm())
    if (type === 'account') {
      if (entity) {
        const legacyType = String(entity.entry_type || '').toLowerCase()
        const normalizedType = ACCOUNT_TRANS_TYPE_OPTIONS.some(option => option.value === legacyType)
          ? legacyType
          : 'expense'
        const subAccounts = ACCOUNT_SUB_ACCOUNTS_BY_TYPE[normalizedType] || []
        const normalizedCategory = subAccounts.includes(entity.category) ? entity.category : ''
        setAccountForm({
          ...mkAccountForm(),
          ...entity,
          entry_type: normalizedType,
          category: normalizedCategory,
          payment_method: entity.payment_method || '',
          _editId: entity.id,
        })
      } else {
        setAccountForm(mkAccountForm())
      }
    }
    if (type === 'pricing')     setPricingForm(entity ? { ...mkPricingForm(), ...entity, product: entity.product ? String(entity.product) : '', _editId: entity.id } : mkPricingForm())
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  async function handleDelete(label, deleteFn) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return
    try {
      await deleteFn()
      await refreshData()
    } catch (err) {
      alert(err.message || `Failed to delete ${label}.`)
    }
  }

  // ── Form submit handlers ──────────────────────────────────────────────────

  async function handleSaleSubmit(e) {
    e.preventDefault()
    setSub('sale', true); setFB('sale', '')
    try {
      const requestedBySize = saleForm.lines.reduce((map, line) => {
        const sizeKey = normalizeSizeKey(line.productSize)
        const qty = toNumber(line.quantity)
        if (!sizeKey || qty <= 0) return map
        map.set(sizeKey, (map.get(sizeKey) || 0) + qty)
        return map
      }, new Map())
      const lines = saleForm.lines.filter(it => it.pricingRule && toNumber(it.quantity) > 0).map(it => {
        const rule = pricingRuleMap.get(it.pricingRule)
        return { pricing_rule: it.pricingRule, quantity: it.quantity, unit_price: it.unitPrice || rule?.price || '0' }
      })
      const validPayments = saleForm.payments
        .filter(payment => toNumber(payment.amount) > 0)
        .map(payment => ({
          amount: String(toNumber(payment.amount)),
          method: payment.method || 'cash',
          reference: payment.reference || '',
          notes: payment.notes || '',
        }))
      const noRuleLines = saleForm.lines.filter(it => it.productSize && !it.pricingRule)
      if (noRuleLines.length) throw new Error(`No pricing rule found for: ${noRuleLines.map(l => l.productSize).join(', ')}. Add the pricing rule first.`)
      if (!saleForm.customer || !lines.length) throw new Error('Choose a customer and at least one valid product line.')
      const outOfStockSizes = Array.from(requestedBySize.entries()).flatMap(([sizeKey, requestedQty]) => {
        const matchedProduct = data.products.find(product => normalizeSizeKey(product.name) === sizeKey)
        const availableStock = matchedProduct ? toNumber(matchedProduct.stock_quantity) : 0
        if (availableStock >= requestedQty) return []
        return [`${matchedProduct?.name || sizeKey} - ${fmtQ(availableStock)} available, ${fmtQ(requestedQty)} requested`]
      })
      if (outOfStockSizes.length) {
        throw new Error(`Cannot process sale. Out of stock: ${outOfStockSizes.join(', ')}.`)
      }
      const createdInvoice = await createInvoice({
        invoice_date: saleForm.invoiceDate,
        customer: saleForm.customer,
        staff: saleForm.staff || null,
        discount_amount: saleForm.discountAmount || '0',
        previous_balance: '0',
        status: 'issued',
        notes: saleForm.notes || '',
        lines,
      })
      if (validPayments.length) {
        await Promise.all(validPayments.map(payment => createPayment({
          invoice: createdInvoice.id,
          amount: payment.amount,
          payment_date: saleForm.invoiceDate,
          method: payment.method,
          reference: payment.reference,
          notes: payment.notes,
        })))
      }
      await refreshData(); setFB('sale', 'Sale saved successfully.'); setActiveModal('')
    } catch (err) { setFB('sale', err.message || 'Sale could not be saved.') }
    finally { setSub('sale', false) }
  }

  async function handleReceiptSubmit(e) {
    e.preventDefault()
    setSub('receipt', true); setFB('receipt', '')
    try {
      const validPayments = receiptForm.payments
        .filter(payment => toNumber(payment.amount) > 0)
        .map(payment => ({
          amount: String(toNumber(payment.amount)),
          method: payment.method || 'cash',
          reference: payment.reference || '',
          notes: payment.notes || '',
        }))
      if (!receiptForm.invoice || !validPayments.length) throw new Error('Choose an invoice and enter at least one payment amount received.')
      const selectedInvoice = data.invoices.find(inv => String(inv.id) === String(receiptForm.invoice))
      const outstandingBalance = toNumber(selectedInvoice?.outstanding_balance)
      const totalReceived = sumBy(validPayments, payment => payment.amount)
      if (selectedInvoice && totalReceived > outstandingBalance) {
        throw new Error(`Amount received exceeds the outstanding balance of ${fmt(outstandingBalance)}.`)
      }
      for (const payment of validPayments) {
        await createPayment({
          invoice: receiptForm.invoice,
          amount: payment.amount,
          payment_date: receiptForm.paymentDate,
          method: payment.method,
          reference: payment.reference,
          notes: payment.notes,
        })
      }
      await refreshData(); setFB('receipt', 'Receipt recorded.'); setActiveModal('')
    } catch (err) { setFB('receipt', err.message || 'Receipt could not be recorded.') }
    finally { setSub('receipt', false) }
  }

  async function handleBatchSubmit(e) {
    e.preventDefault()
    setSub('batch', true); setFB('batch', '')
    try {
      const rmByName = new Map(data.rawMaterials.map(m => [String(m.name || '').trim().toLowerCase(), m]))
      const resolveRawMaterialId = (usage) => {
        if (usage.rawMaterial) return usage.rawMaterial
        if (usage.materialName) {
          const matched = rmByName.get(String(usage.materialName).trim().toLowerCase())
          return matched ? String(matched.id) : ''
        }
        return ''
      }
      const qtyRows = batchForm.usages.filter(it => toNumber(it.quantityUsed) > 0)
      const unresolved = qtyRows.filter(it => !resolveRawMaterialId(it))
      if (unresolved.length) {
        const names = unresolved.map(it => it.materialName || 'Unknown material').join(', ')
        throw new Error(`Add these raw materials first in Supplies & Stock: ${names}.`)
      }
      const material_usages = qtyRows.map(it => {
        const resolvedId = resolveRawMaterialId(it)
        const mat = rawMaterialMap.get(resolvedId)
        const uc = toNumber(mat?.unit_price || 0)
        return { raw_material: resolvedId, quantity_used: it.quantityUsed, amount: String(uc * toNumber(it.quantityUsed)), notes: '' }
      })
      if (!material_usages.length) throw new Error('Add at least one raw material quantity.')
      await createProductionBatch({
        production_date: batchForm.productionDate,
        notes: batchForm.notes,
        electricity_cost: batchForm.electricityCost || '0',
        gas_cost: batchForm.gasCost || '0',
        production_wages: batchForm.productionWages || '0',
        outputs: [],
        material_usages,
      })
      await refreshData(); setFB('batch', 'Batch saved.'); setActiveModal('')
    } catch (err) { setFB('batch', err.message || 'Batch could not be saved.') }
    finally { setSub('batch', false) }
  }

  async function handleFinishedGoodsSubmit(e) {
    e.preventDefault()
    setSub('finished_goods', true); setFB('finished_goods', '')
    try {
      if (!finishedGoodsForm.batch) throw new Error('Select a batch number first.')
      const validLines = finishedGoodsForm.lines.filter(it => it.productSize && toNumber(it.quantity) > 0)
      if (!validLines.length) throw new Error('Add at least one finished good with quantity.')
      await Promise.all(validLines.map(async (line) => {
        const targetSize = normalizeSizeKey(line.productSize)
        const matchedProduct = data.products.find(p => normalizeSizeKey(p.name) === targetSize)
        const litres = inferTotalLitres(line.productSize, line.quantity)
        const unitCost = toNumber(matchedProduct?.unit_price || 0)
        await createProductionOutput({
          batch: finishedGoodsForm.batch,
          product: matchedProduct ? matchedProduct.id : null,
          product_size: line.productSize,
          quantity: line.quantity,
          unit_cost: String(unitCost),
          batch_litres: String(litres),
          total_litres: String(litres),
        })
      }))
      await refreshData(); setFB('finished_goods', 'Finished goods recorded.'); setActiveModal('')
    } catch (err) { setFB('finished_goods', err.message || 'Could not record finished goods.') }
    finally { setSub('finished_goods', false) }
  }

  async function handlePurchaseSubmit(e) {
    e.preventDefault()
    setSub('purchase', true); setFB('purchase', '')
    try {
      if (!purchaseForm.supplier) throw new Error('Choose a supplier.')
      const validItems = purchaseForm.items.filter(it =>
        (it.isNewRM ? it.newRMName.trim() : it.rawMaterial) && toNumber(it.quantity) > 0
      )
      if (!validItems.length) throw new Error('Add at least one item with a quantity.')
      const resolvedItems = await Promise.all(validItems.map(async it => {
        let rmId = it.rawMaterial
        let rmName = rawMaterialMap.get(it.rawMaterial)?.name || 'Raw Material'
        if (it.isNewRM) {
          const newRM = await createRawMaterial({
            name: it.newRMName.trim(),
            category: it.newRMCategory.trim(),
            unit: it.newRMUnit.trim(),
            opening_stock: it.newRMOpeningStock || '0',
            reorder_level: it.newRMReorderLevel || '0',
          })
          rmId = String(newRM.id)
          rmName = newRM.name
        }
        const ppi = toNumber(it.pricePerItem)
        const upi = toNumber(it.unitPerItem || 1) || 1
        return { raw_material: rmId, item_name: rmName, quantity: it.quantity, price_per_item: String(ppi), unit_per_item: String(upi), price_per_unit: String(ppi / upi) }
      }))
      const purchase = await createPurchase({ purchase_date: purchaseForm.purchaseDate, supplier: purchaseForm.supplier, category: purchaseForm.category, status: 'open', notes: purchaseForm.notes, items: resolvedItems })
      if (purchase?.id && toNumber(purchaseForm.paymentAmount) > 0) {
        await createPurchasePayment({ purchase: purchase.id, payment_date: purchaseForm.purchaseDate, amount: purchaseForm.paymentAmount, payment_method: purchaseForm.paymentMethod, notes: purchaseForm.paymentNotes })
      }
      await refreshData(); setFB('purchase', 'Purchase recorded.'); setActiveModal('')
    } catch (err) { setFB('purchase', err.message || 'Purchase could not be saved.') }
    finally { setSub('purchase', false) }
  }

  async function handlePurPaySubmit(e) {
    e.preventDefault()
    setSub('pur_pay', true); setFB('pur_pay', '')
    try {
      if (!purPayForm.purchase || !purPayForm.amount) throw new Error('Select a purchase and enter the amount.')
      await createPurchasePayment({ purchase: purPayForm.purchase, payment_date: purPayForm.paymentDate, amount: purPayForm.amount, payment_method: purPayForm.paymentMethod, notes: purPayForm.notes })
      await refreshData(); setFB('pur_pay', 'Supplier payment recorded.'); setActiveModal('')
    } catch (err) { setFB('pur_pay', err.message || 'Payment could not be saved.') }
    finally { setSub('pur_pay', false) }
  }

  async function handleCustomerSubmit(e) {
    e.preventDefault()
    setSub('customer', true); setFB('customer', '')
    try {
      if (!customerForm.name) throw new Error('Customer name is required.')
      if (!customerForm.pricing_category) throw new Error('Pricing category is required.')
      const payload = {
        name: customerForm.name,
        customer_category: customerForm.customer_category || null,
        pricing_category_id: customerForm.pricing_category,
        phone: customerForm.phone,
        email: customerForm.email,
        address: customerForm.address,
        date: customerForm.date,
        previous_balance: customerForm.previousBalance || '0',
      }
      customerForm._editId ? await updateCustomer(customerForm._editId, payload) : await createCustomer(payload)
      await refreshData(); setFB('customer', `Customer ${customerForm._editId ? 'updated' : 'created'}.`); setActiveModal('')
    } catch (err) { setFB('customer', err.message || 'Customer could not be saved.') }
    finally { setSub('customer', false) }
  }

  async function handleSupplierSubmit(e) {
    e.preventDefault()
    setSub('supplier', true); setFB('supplier', '')
    try {
      if (!supplierForm.name) throw new Error('Supplier name is required.')
      const { _editId, ...supplierPayload } = supplierForm
      supplierForm._editId ? await updateSupplier(supplierForm._editId, supplierPayload) : await createSupplier(supplierPayload)
      await refreshData(); setFB('supplier', `Supplier ${supplierForm._editId ? 'updated' : 'created'}.`); setActiveModal('')
    } catch (err) { setFB('supplier', err.message || 'Supplier could not be saved.') }
    finally { setSub('supplier', false) }
  }

  async function handleProductSubmit(e) {
    e.preventDefault()
    setSub('product', true); setFB('product', '')
    try {
      if (!productForm.name) throw new Error('Product name is required.')
      const payload = { name: productForm.name, description: productForm.description, unit_price: productForm.unit_price, stock_quantity: productForm.stock_quantity, production_level: productForm.production_level || '0', is_active: true }
      productForm._editId ? await updateProduct(productForm._editId, payload) : await createProduct(payload)
      await refreshData(); setFB('product', `Product ${productForm._editId ? 'updated' : 'created'}.`); setActiveModal('')
    } catch (err) { setFB('product', err.message || 'Product could not be saved.') }
    finally { setSub('product', false) }
  }

  async function handleRawMatSubmit(e) {
    e.preventDefault()
    setSub('raw_mat', true); setFB('raw_mat', '')
    try {
      if (!rawMatForm.name) throw new Error('Name is required.')
      const payload = {
        name: rawMatForm.name,
        category: rawMatForm.category,
        supplier: rawMatForm.supplier || null,
        unit: rawMatForm.unit || '',
        unit_per_item: rawMatForm.unit_per_item || '1',
        item_price: rawMatForm.item_price || '0',
        unit_price: rawMatForm.unit_price || '0',
        opening_stock: rawMatForm.opening_stock || '0',
        reorder_level: rawMatForm.reorder_level || '0',
      }
      rawMatForm._editId ? await updateRawMaterial(rawMatForm._editId, payload) : await createRawMaterial(payload)
      await refreshData(); setFB('raw_mat', `Material ${rawMatForm._editId ? 'updated' : 'created'}.`); setActiveModal('')
    } catch (err) { setFB('raw_mat', err.message || 'Material could not be saved.') }
    finally { setSub('raw_mat', false) }
  }

  async function handleAccountSubmit(e) {
    e.preventDefault()
    setSub('account', true); setFB('account', '')
    try {
      if (!accountForm.transaction_date || !accountForm.entry_type || !accountForm.category || !accountForm.description || !accountForm.payment_method || !accountForm.amount) {
        throw new Error('Transaction date, trans type, sub account, description, payment/receipt account, and amount are required.')
      }
      const { _editId, ...accountPayload } = accountForm
      accountForm._editId ? await updateAccountTransaction(accountForm._editId, accountPayload) : await createAccountTransaction(accountPayload)
      await refreshData(); setFB('account', `Entry ${accountForm._editId ? 'updated' : 'saved'}.`); setActiveModal('')
    } catch (err) { setFB('account', err.message || 'Entry could not be saved.') }
    finally { setSub('account', false) }
  }

  async function handlePricingSubmit(e) {
    e.preventDefault()
    setSub('pricing', true); setFB('pricing', '')
    try {
      if (!pricingForm.product || !pricingForm.pricing_category || !pricingForm.price) throw new Error('Finished good, pricing category, and price are required.')
      const { _editId, ...pricingPayload } = pricingForm
      const selectedProduct = productMap.get(String(pricingForm.product))
      pricingPayload.size = selectedProduct?.name || pricingForm.size
      pricingForm._editId ? await updatePricingRule(pricingForm._editId, pricingPayload) : await createPricingRule(pricingPayload)
      await refreshData(); setFB('pricing', `Pricing rule ${pricingForm._editId ? 'updated' : 'saved'}.`); setActiveModal('')
    } catch (err) { setFB('pricing', err.message || 'Pricing rule could not be saved.') }
    finally { setSub('pricing', false) }
  }

  // ── Sale form helpers ─────────────────────────────────────────────────────

  function updateSaleLine(index, field, val) {
    setSaleForm(cur => ({
      ...cur,
      lines: cur.lines.map((line, i) => i !== index ? line : { ...line, [field]: val }),
    }))
  }

  function updateSalePayment(index, field, val) {
    setSaleForm(cur => ({
      ...cur,
      payments: cur.payments.map((payment, i) => i !== index ? payment : { ...payment, [field]: val }),
    }))
  }

  function updateReceiptPayment(index, field, val) {
    setReceiptForm(cur => ({
      ...cur,
      payments: cur.payments.map((payment, i) => i !== index ? payment : { ...payment, [field]: val }),
    }))
  }

  function updateSaleLineSize(index, size, filteredRules) {
    const rule = filteredRules.find(r => r.size === size)
    setSaleForm(cur => ({
      ...cur,
      lines: cur.lines.map((line, i) => i !== index ? line : {
        ...line,
        productSize: size,
        pricingRule: rule ? String(rule.id) : '',
        unitPrice: rule ? String(rule.price) : line.unitPrice,
      }),
    }))
  }

  function changeSaleCustomer(customerId) {
    const cust = data.customers.find(c => String(c.id) === String(customerId))
    const pricingCategoryId = cust?.pricing_category_id ? String(cust.pricing_category_id) : ''
    setSaleForm(cur => ({ ...cur, customer: customerId, pricingCategoryId, lines: [mkSaleLine()] }))
  }

  function updateBatchUsage(index, field, val) {
    setBatchForm(cur => ({
      ...cur,
      usages: cur.usages.map((item, i) => {
        if (i !== index) return item
        return { ...item, [field]: val, ...(field === 'rawMaterial' && rawMaterialMap.get(val) ? { amount: String(rawMaterialMap.get(val).unit_price) } : {}) }
      }),
    }))
  }

  function updateFinishedGoodsLine(index, field, val) {
    setFinishedGoodsForm(cur => ({
      ...cur,
      lines: cur.lines.map((line, i) => i !== index ? line : { ...line, [field]: val }),
    }))
  }

  function updatePurchaseItem(index, field, val) {
    setPurchaseForm(cur => ({
      ...cur,
      items: cur.items.map((item, i) => {
        if (i !== index) return item
        if (field === '_toggleRM') return { ...item, isNewRM: !item.isNewRM, rawMaterial: '', newRMName: '', newRMCategory: '' }
        return { ...item, [field]: val }
      }),
    }))
  }

  function updateRawMatName(name) {
    const defaults = RAW_MATERIAL_TEMPLATE_DEFAULTS[name]
    setRawMatForm(cur => ({
      ...cur,
      name,
      category: defaults ? (cur.category || defaults.category) : cur.category,
      unit: defaults ? (cur.unit || defaults.unit) : cur.unit,
    }))
  }

  async function createNewPurchaseRM(index) {
    const item = purchaseForm.items[index]
    if (!item.newRMName.trim()) return
    setSub('purchase_rm_' + index, true)
    try {
      const newRM = await createRawMaterial({
        name: item.newRMName.trim(),
        category: item.newRMCategory.trim(),
        unit: item.newRMUnit.trim(),
        opening_stock: item.newRMOpeningStock || '0',
        reorder_level: item.newRMReorderLevel || '0',
      })
      await refreshData()
      setPurchaseForm(cur => ({
        ...cur,
        items: cur.items.map((it, i) =>
          i !== index ? it : { ...it, isNewRM: false, rawMaterial: String(newRM.id), newRMName: '', newRMCategory: '', newRMUnit: '', newRMOpeningStock: '0', newRMReorderLevel: '0' }
        ),
      }))
    } catch (err) {
      setFB('purchase', err.message || 'Could not create raw material.')
    } finally {
      setSub('purchase_rm_' + index, false)
    }
  }

  // ── Row data ──────────────────────────────────────────────────────────────

  const salesSummary      = [
    { label: 'Invoices',    value: String(filteredSalesInvoices.length),                                       note: `${filteredSalesInvoices.filter(i => i.status === 'issued').length} open` },
    { label: 'Total Billed',value: fmt(sumBy(filteredSalesInvoices, inv => inv.total_amount)),                note: `${filteredSalesInvoices.length} invoices` },
    { label: 'Total Paid',  value: fmt(sumBy(filteredSalesPayments, p => p.amount)),                          note: `${filteredSalesPayments.length} receipts` },
    { label: 'Outstanding', value: fmt(sumBy(filteredSalesInvoices, inv => inv.outstanding_balance)),         note: `${filteredSalesInvoices.filter(i => toNumber(i.outstanding_balance) > 0).length} unpaid` },
  ]
  const productionSummary = [{ label: 'Batches', value: String(productionBatchesFiltered.length), note: 'Production_Dtls' }, { label: 'RM Cost', value: fmt(sumBy(productionBatchesFiltered, b => b.total_raw_material_cost)), note: 'Material usage' }, { label: 'Profit', value: fmt(sumBy(productionBatchesFiltered, b => b.profit)), note: 'Batch value less cost' }, { label: 'Stock Units', value: fmtQ(sumBy(data.products, p => p.stock_quantity)), note: 'Finished goods on hand' }]
  const suppliesSummary   = [{ label: 'Suppliers', value: String(data.suppliers.length), note: 'Supplier_Dtls' }, { label: 'Raw Materials', value: String(data.rawMaterials.length), note: 'RawMaterials tracked' }, { label: 'Purchases', value: fmt(sumBy(purchasesFiltered, p => p.total_amount)), note: `${purchasesFiltered.length} records` }, { label: 'Supplier Due', value: fmt(sumBy(purchasesFiltered, p => p.outstanding_amount)), note: 'Open balances' }]
  const customersSummary  = [{ label: 'Customers', value: String(data.customers.length), note: `${filteredCustomerLedger.filter(c => c.invoiceCount > 0).length} already billed` }, { label: 'Outstanding', value: fmt(sumBy(filteredCustomerLedger, c => c.outstanding)), note: 'Total receivables due' }, { label: 'Receipts', value: fmt(sumBy(customerPaymentsFiltered, p => p.amount)), note: 'Total collected' }, { label: 'Open Invoices', value: String(customerInvoicesFiltered.filter(inv => toNumber(inv.outstanding_balance) > 0).length), note: 'Invoices with balance' }]
  const suppliersSummary  = [{ label: 'Suppliers', value: String(data.suppliers.length), note: 'Vendor records' }, { label: 'Purchases', value: fmt(sumBy(supplierPurchasesFiltered, p => p.total_amount)), note: `${supplierPurchasesFiltered.length} purchase records` }, { label: 'Paid', value: fmt(sumBy(supplierPurchasesFiltered, p => p.total_paid)), note: 'Total paid to suppliers' }, { label: 'Due', value: fmt(sumBy(filteredSupplierLedger, s => s.outstanding)), note: 'Outstanding payables' }]
  const accountsSummary   = [{ label: 'Entries', value: String(accountTransactionsFiltered.length), note: 'Accounts_Dtls rows' }, { label: 'Income', value: fmt(sumBy(accountTransactionsFiltered.filter(e => e.entry_type === 'income'), e => e.amount)), note: 'Income rows' }, { label: 'Expenses', value: fmt(sumBy(accountTransactionsFiltered.filter(e => e.entry_type === 'expense'), e => e.amount)), note: 'Expense rows' }, { label: 'Pricing Rules', value: String(filteredPricingRules.length), note: 'Filtered pricing sheet' }]
  const mobilePrimarySections = ['dashboard', 'sales_hub', 'production_ops', 'customers']
  const mobileExtraSections = SECTIONS.filter(section => !mobilePrimarySections.includes(section.key))
  const mobileHeroStatsBySection = {
    dashboard: dashboardContent.metrics.slice(0, 2),
    sales_hub: salesSummary.slice(0, 2),
    production_ops: productionSummary.slice(0, 2),
    supplies_stock: suppliesSummary.slice(0, 2),
    customers: customersSummary.slice(0, 2),
    suppliers: suppliersSummary.slice(0, 2),
    accounts_pricing: accountsSummary.slice(0, 2),
  }
  const mobileHeroStats = mobileHeroStatsBySection[activeSection] || dashboardContent.metrics.slice(0, 2)
  const avatarText = (user?.name || 'PT')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleMobileLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const salesRows    = filteredSalesInvoices.map(inv => ({
    key: inv.id,
    emphasisIndex: 3,
    cells: [
      fmtD(inv.invoice_date),
      fmtInv(inv.id),
      inv.customer_name || '—',
      fmt(inv.total_amount),
      fmt(toNumber(inv.total_amount) - toNumber(inv.outstanding_balance)),
      fmt(inv.outstanding_balance),
    ],
  }))
  const batchRows    = productionBatchesFiltered.map(b => ({ key: b.id, emphasisIndex: 5, cells: [fmtD(b.production_date), b.batch_number || `#${b.id}`, fmtD(b.expiry_date), String(b.outputs?.length || 0), fmt(b.total_cost), fmt(b.profit)] }))
  const purchaseRows = purchasesFiltered.map(p => ({ key: p.id, emphasisIndex: 6, cells: [fmtD(p.purchase_date), `#${p.id}`, p.supplier_name || 'Supplier', fmtStatus(p.category || 'other'), fmtStatus(p.status), fmt(p.total_paid), fmt(p.outstanding_amount)] }))
  const inventoryRows = inventoryLedger.map(item => ({
    key: item.size,
    emphasisIndex: 2,
    cells: [
      item.size,
      `${fmtQ(item.available)} ${item.unit}`,
      fmt(item.stockBalance),
      fmtQ(item.productionLevel),
      <span key="pr" style={{ color: item.prodRequired ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{item.prodRequired ? 'Yes' : 'No'}</span>,
    ],
  }))
  const materialRows = lowStockRows.map(m => {
    const isLow = toNumber(m.reorder_level) > 0 && m.available <= toNumber(m.reorder_level)
    const isOut = m.available <= 0
    const stockColor = isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a'
    return {
      key: m.id,
      emphasisIndex: 5,
      cells: [
        m.name,
        m.category || '—',
        m.unit || '—',
        fmtQ(m.opening_stock),
        fmtQ(m.stock_in),
        <span key="avail" style={{ color: stockColor, fontWeight: 600 }}>{fmtQ(m.available)}</span>,
        fmtQ(m.reorder_level),
        <span key="status" style={{ color: stockColor, fontSize: '0.78rem', fontWeight: 700 }}>{isOut ? 'Out' : isLow ? 'Low' : 'OK'}</span>,
        <button key="edit" type="button" className="workspace-action-btn" onClick={e => { e.stopPropagation(); openModal('raw_mat', m) }}>Edit</button>,
      ],
    }
  })
  const customerRows = filteredCustomerLedger.map(c => ({ key: c.id, emphasisIndex: 4, cells: [c.name, c.phone || '—', String(c.invoiceCount), fmt(c.paid), fmt(c.outstanding), <button key="edit" type="button" className="workspace-action-btn" onClick={e => { e.stopPropagation(); openModal('customer', c) }}>Edit</button>] }))
  const supplierRows = filteredSupplierLedger.map(s => ({ key: s.id, emphasisIndex: 4, cells: [s.name, resolveSupplierItemCategory(s, data.purchases, data.rawMaterials), String(s.purchaseCount), fmt(s.paid), fmt(s.outstanding), <button key="edit" type="button" className="workspace-action-btn" onClick={e => { e.stopPropagation(); openModal('supplier', s) }}>Edit</button>] }))
  const accountRows  = accountTransactionsFiltered.map(e => ({
    key: e.id,
    emphasisIndex: 4,
    cells: [
      fmtD(e.transaction_date),
      e.transaction_id || '—',
      fmtStatus(e.entry_type),
      truncateText(e.category, 12),
      fmt(e.amount),
    ],
  }))
  const pricingRows  = filteredPricingRules.map(r => ({ key: r.id, emphasisIndex: 3, cells: [r.product_name || r.size || '—', r.size, r.pricing_category_name || '—', fmt(r.price), <button key="edit" type="button" className="workspace-action-btn" onClick={e => { e.stopPropagation(); openModal('pricing', r) }}>Edit</button>] }))

  const salesFilterOptions = useMemo(() => {
    if ((sectionTabs.sales_hub || SECTION_DEFAULT_TABS.sales_hub) === 'recent_receipts') {
      return [
        {
          key: 'customer',
          label: 'Customer',
          placeholder: 'All customers',
          options: buildSelectOptions(salesPayments.map(payment => payment.customer_name || `Invoice ${fmtInv(payment.invoice)}`)),
        },
        {
          key: 'method',
          label: 'Method',
          placeholder: 'All methods',
          options: buildSelectOptions(salesPayments.map(payment => payment.method), value => fmtStatus(value)),
        },
      ]
    }
    return [
      {
        key: 'customer',
        label: 'Customer',
        placeholder: 'All customers',
        options: buildSelectOptions(salesInvoices.map(invoice => invoice.customer_name)),
      },
      {
        key: 'status',
        label: 'Collection State',
        placeholder: 'All states',
        options: [
          { value: 'paid', label: 'Collected' },
          { value: 'partial', label: 'Partially Paid' },
          { value: 'unpaid', label: 'Unpaid' },
        ],
      },
    ]
  }, [salesInvoices, salesPayments, sectionTabs.sales_hub])

  const pricingFilterOptions = useMemo(() => ([
    {
      key: 'price_type',
      label: 'Price Type',
      placeholder: 'All price types',
      options: buildSelectOptions(data.pricingRules.map(rule => rule.pricing_category_name)),
    },
    {
      key: 'size',
      label: 'Size',
      placeholder: 'All sizes',
      options: buildSelectOptions(data.pricingRules.map(rule => rule.size)),
    },
    {
      key: 'item',
      label: 'Item',
      placeholder: 'All items',
      options: buildSelectOptions(data.pricingRules.map(rule => rule.product_name || rule.size)),
    },
    {
      key: 'price_band',
      label: 'Price Band',
      placeholder: 'All bands',
      options: [
        { value: 'budget', label: 'Budget (< GHS 10)' },
        { value: 'standard', label: 'Standard (GHS 10 - 29.99)' },
        { value: 'premium', label: 'Premium (GHS 30+)' },
      ],
    },
  ]), [data.pricingRules])

  const acctByType = (type) => data.accountTransactions.filter(e => e.entry_type === type)
  const acctSum = (type) => sumBy(acctByType(type), e => e.amount)

  const toTs = (v) => {
    if (!v) return NaN
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? NaN : d.getTime()
  }
  const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  const uniqueDatesSorted = (values) => [...new Set((values || []).filter(Boolean))].sort((a, b) => toTs(a) - toTs(b))

  const saleLines = data.invoices.flatMap(inv => (inv.lines || []).map(line => ({ ...line, invoice_date: inv.invoice_date })))
  const productionOutputs = data.productionBatches.flatMap(batch => (batch.outputs || []).map(output => ({ ...output, production_date: batch.production_date })))
  const materialUsageRows = data.productionBatches.flatMap(batch => (batch.material_usages || []).map(usage => ({ ...usage, production_date: batch.production_date })))

  const periodStartTs = toTs(TRIAL_BALANCE_PERIOD_START)
  const expenseStartTs = toTs(TRIAL_BALANCE_EXPENSE_START)
  const inPeriod = (rawDate, startTs, beforeStart = false) => {
    const ts = toTs(rawDate)
    if (!Number.isFinite(ts) || !Number.isFinite(startTs)) return false
    return beforeStart ? ts < startTs : ts >= startTs
  }
  const isSampleLine = (line) => String(line.pricing_category || '').toLowerCase().includes('sample')

  const outputCostBySize = (() => {
    const acc = new Map()
    productionOutputs.forEach(output => {
      const size = String(output.product_size || '').trim()
      if (!size) return
      const cur = acc.get(size) || { amount: 0, qty: 0 }
      cur.amount += toNumber(output.amount)
      cur.qty += toNumber(output.quantity)
      acc.set(size, cur)
    })
    const avg = new Map()
    acc.forEach((val, key) => avg.set(key, val.qty > 0 ? val.amount / val.qty : 0))
    return avg
  })()

  const sumSalesRevenue = ({ startTs = null, beforeStart = false, samplesOnly = false } = {}) =>
    sumBy(
      saleLines.filter(line => {
        if (samplesOnly && !isSampleLine(line)) return false
        if (startTs == null) return true
        return inPeriod(line.invoice_date, startTs, beforeStart)
      }),
      line => line.line_total
    )

  const sumSalesCost = ({ startTs = null, beforeStart = false, samplesOnly = false } = {}) =>
    sumBy(
      saleLines.filter(line => {
        if (samplesOnly && !isSampleLine(line)) return false
        if (startTs == null) return true
        return inPeriod(line.invoice_date, startTs, beforeStart)
      }),
      line => {
        const unitCost = outputCostBySize.get(String(line.product_size || '').trim()) || 0
        return toNumber(line.quantity) * unitCost
      }
    )

  const salesDates = ({ startTs = null, beforeStart = false, samplesOnly = false } = {}) =>
    uniqueDatesSorted(
      saleLines
        .filter(line => {
          if (samplesOnly && !isSampleLine(line)) return false
          if (startTs == null) return true
          return inPeriod(line.invoice_date, startTs, beforeStart)
        })
        .map(line => line.invoice_date)
    )

  const invoiceDates = ({ onlyOutstanding = null } = {}) =>
    uniqueDatesSorted(
      data.invoices
        .filter(inv => {
          if (onlyOutstanding === true) return toNumber(inv.outstanding_balance) > 0
          if (onlyOutstanding === false) return toNumber(inv.outstanding_balance) <= 0
          return true
        })
        .map(inv => inv.invoice_date)
    )

  const sumAccountEntries = ({ entryType, category, paymentAccount, startTs = null, beforeStart = false } = {}) =>
    sumBy(
      data.accountTransactions.filter(entry => {
        if (entryType && !sameText(entry.entry_type, entryType)) return false
        if (category && !sameText(entry.category, category)) return false
        if (paymentAccount && !sameText(entry.payment_method, paymentAccount)) return false
        if (startTs == null) return true
        return inPeriod(entry.transaction_date, startTs, beforeStart)
      }),
      entry => entry.amount
    )

  const accountEntryDates = ({ entryType, category, paymentAccount, startTs = null, beforeStart = false } = {}) =>
    uniqueDatesSorted(
      data.accountTransactions
        .filter(entry => {
          if (entryType && !sameText(entry.entry_type, entryType)) return false
          if (category && !sameText(entry.category, category)) return false
          if (paymentAccount && !sameText(entry.payment_method, paymentAccount)) return false
          if (startTs == null) return true
          return inPeriod(entry.transaction_date, startTs, beforeStart)
        })
        .map(entry => entry.transaction_date)
    )

  const sumReceipts = ({ accountName, startTs = null, beforeStart = false } = {}) =>
    sumBy(
      data.payments.filter(payment => {
        if (accountName && !sameText(payment.method, accountName)) return false
        if (startTs == null) return true
        return inPeriod(payment.payment_date, startTs, beforeStart)
      }),
      payment => payment.amount
    )

  const receiptDates = ({ accountName, startTs = null, beforeStart = false } = {}) =>
    uniqueDatesSorted(
      data.payments
        .filter(payment => {
          if (accountName && !sameText(payment.method, accountName)) return false
          if (startTs == null) return true
          return inPeriod(payment.payment_date, startTs, beforeStart)
        })
        .map(payment => payment.payment_date)
    )

  const sumPurchasePayments = ({ accountName, startTs = null, beforeStart = false } = {}) =>
    sumBy(
      data.purchasePayments.filter(payment => {
        if (accountName && !sameText(payment.payment_method, accountName)) return false
        if (startTs == null) return true
        return inPeriod(payment.payment_date, startTs, beforeStart)
      }),
      payment => payment.amount
    )

  const purchasePaymentDates = ({ accountName, startTs = null, beforeStart = false } = {}) =>
    uniqueDatesSorted(
      data.purchasePayments
        .filter(payment => {
          if (accountName && !sameText(payment.payment_method, accountName)) return false
          if (startTs == null) return true
          return inPeriod(payment.payment_date, startTs, beforeStart)
        })
        .map(payment => payment.payment_date)
    )

  const sumPurchaseItems = ({ startTs = null, beforeStart = false } = {}) =>
    sumBy(
      data.purchases.filter(purchase => {
        if (startTs == null) return true
        return inPeriod(purchase.purchase_date, startTs, beforeStart)
      }).flatMap(purchase => purchase.items || []),
      item => item.line_total
    )

  const purchaseDates = ({ startTs = null, beforeStart = false } = {}) =>
    uniqueDatesSorted(
      data.purchases
        .filter(purchase => {
          if (startTs == null) return true
          return inPeriod(purchase.purchase_date, startTs, beforeStart)
        })
        .map(purchase => purchase.purchase_date)
    )

  const sumProductionOutputs = ({ startTs = null, beforeStart = false } = {}) =>
    sumBy(
      productionOutputs.filter(output => {
        if (startTs == null) return true
        return inPeriod(output.production_date, startTs, beforeStart)
      }),
      output => output.amount
    )

  const productionDates = ({ startTs = null, beforeStart = false } = {}) =>
    uniqueDatesSorted(
      productionOutputs
        .filter(output => {
          if (startTs == null) return true
          return inPeriod(output.production_date, startTs, beforeStart)
        })
        .map(output => output.production_date)
    )

  const sumMaterialUsage = ({ startTs = null, beforeStart = false } = {}) =>
    sumBy(
      materialUsageRows.filter(usage => {
        if (startTs == null) return true
        return inPeriod(usage.production_date, startTs, beforeStart)
      }),
      usage => usage.amount
    )

  const materialUsageDates = ({ startTs = null, beforeStart = false } = {}) =>
    uniqueDatesSorted(
      materialUsageRows
        .filter(usage => {
          if (startTs == null) return true
          return inPeriod(usage.production_date, startTs, beforeStart)
        })
        .map(usage => usage.production_date)
    )

  const accountLedgerDates = (accountName, startTs, beforeStart = false) => uniqueDatesSorted([
    ...accountEntryDates({ entryType: 'transfers', category: accountName, startTs, beforeStart }),
    ...accountEntryDates({ entryType: 'income', paymentAccount: accountName, startTs, beforeStart }),
    ...accountEntryDates({ entryType: 'transfers', paymentAccount: accountName, startTs, beforeStart }),
    ...accountEntryDates({ entryType: 'expense', paymentAccount: accountName, startTs, beforeStart }),
    ...receiptDates({ accountName, startTs, beforeStart }),
    ...purchasePaymentDates({ accountName, startTs, beforeStart }),
  ])

  const accountLedgerBalance = (accountName, startTs, beforeStart = false) => (
    sumAccountEntries({ entryType: 'transfers', category: accountName, startTs, beforeStart })
    + sumAccountEntries({ entryType: 'income', paymentAccount: accountName, startTs, beforeStart })
    - sumAccountEntries({ entryType: 'transfers', paymentAccount: accountName, startTs, beforeStart })
    - sumAccountEntries({ entryType: 'expense', paymentAccount: accountName, startTs, beforeStart })
    + sumReceipts({ accountName, startTs, beforeStart })
    - sumPurchasePayments({ accountName, startTs, beforeStart })
  )

  const incomeCreditSalesMovement = sumBy(data.invoices.filter(inv => toNumber(inv.outstanding_balance) > 0), inv => inv.total_amount)
  const incomeCashSalesMovement = sumBy(data.invoices.filter(inv => toNumber(inv.outstanding_balance) <= 0), inv => inv.total_amount)
  const otherIncomeMovement = sumAccountEntries({ entryType: 'income', category: 'Other Income', startTs: expenseStartTs })

  const productionMovement = sumProductionOutputs({ startTs: periodStartTs })
  const soldCostMovement = sumSalesCost({ startTs: periodStartTs })
  const sampleRevenueMovement = sumSalesRevenue({ startTs: periodStartTs, samplesOnly: true })

  const finishedGoodsOpening = accountLedgerBalance('Finished Goods', periodStartTs, true)
  const finishedGoodsMovement = productionMovement - soldCostMovement

  const rawMaterialsOpening = (
    accountLedgerBalance('Raw Materials', periodStartTs, true)
    + sumPurchaseItems({ startTs: periodStartTs, beforeStart: true })
    - sumMaterialUsage({ startTs: periodStartTs, beforeStart: true })
  )
  const rawMaterialsMovement = (
    sumPurchaseItems({ startTs: periodStartTs })
    - sumMaterialUsage({ startTs: periodStartTs })
  )

  const tradeReceivablesOpening = (
    sumSalesRevenue({ startTs: periodStartTs, beforeStart: true })
    - sumReceipts({ startTs: periodStartTs, beforeStart: true })
  )
  const tradeReceivablesMovement = (
    sumSalesRevenue({ startTs: periodStartTs })
    - sumReceipts({ startTs: periodStartTs })
    - sampleRevenueMovement
  )

  const payablesOpening = (
    -sumPurchaseItems({ startTs: periodStartTs, beforeStart: true })
    + sumPurchasePayments({ startTs: periodStartTs, beforeStart: true })
  )
  const payablesMovement = (
    -sumPurchaseItems({ startTs: periodStartTs })
    + sumPurchasePayments({ startTs: periodStartTs })
  )

  const expenseByCategory = (category, startTs) => sumAccountEntries({ entryType: 'expense', category, startTs })

  const trialBalanceSheetRows = [
    { accountId: 'ACC-00011-01', accountType: 'Income Statement', accountClass: 'Income', subAccounts: 'Sales', description: 'Credit Sales', opening: 0, movement: incomeCreditSalesMovement, dates: invoiceDates({ onlyOutstanding: true }) },
    { accountId: 'ACC-00012-01', accountType: 'Income Statement', accountClass: 'Income', subAccounts: 'Sales', description: 'Cash Sales', opening: 0, movement: incomeCashSalesMovement, dates: invoiceDates({ onlyOutstanding: false }) },
    { accountId: 'ACC-00013-01', accountType: 'Income Statement', accountClass: 'Income', subAccounts: 'Sales', description: 'Other Income', opening: 0, movement: otherIncomeMovement, dates: accountEntryDates({ entryType: 'income', category: 'Other Income', startTs: expenseStartTs }) },

    { accountId: 'ACC-00021-02', accountType: 'Income Statement', accountClass: 'Direct Cost', subAccounts: 'Cost of Goods Sold', description: 'Production', opening: 0, movement: productionMovement, dates: productionDates({ startTs: periodStartTs }) },
    { accountId: 'ACC-00022-02', accountType: 'Income Statement', accountClass: 'Direct Cost', subAccounts: 'Cost of Goods Sold', description: 'Less: Inventory', opening: 0, movement: -(productionMovement - soldCostMovement), dates: uniqueDatesSorted([...productionDates({ startTs: periodStartTs }), ...salesDates({ startTs: periodStartTs })]) },
    { accountId: 'ACC-00023-02', accountType: 'Income Statement', accountClass: 'Direct Cost', subAccounts: 'Cost of Goods Sold', description: 'Less: Samples', opening: 0, movement: -sampleRevenueMovement, dates: salesDates({ startTs: periodStartTs, samplesOnly: true }) },

    { accountId: 'ACC-00024-02', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Delivery', opening: 0, movement: expenseByCategory('Delivery', periodStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Delivery', startTs: periodStartTs }) },
    { accountId: 'ACC-00031-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Fuel and Transport', opening: 0, movement: expenseByCategory('Fuel and Transport', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Fuel and Transport', startTs: expenseStartTs }) },
    { accountId: 'ACC-00032-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Staff Salary', opening: 0, movement: expenseByCategory('Staff Salary', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Staff Salary', startTs: expenseStartTs }) },
    { accountId: 'ACC-00033-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Marketing', opening: 0, movement: expenseByCategory('Marketing', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Marketing', startTs: expenseStartTs }) },
    { accountId: 'ACC-00034-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Samples', opening: 0, movement: sampleRevenueMovement, dates: salesDates({ startTs: periodStartTs, samplesOnly: true }) },
    { accountId: 'ACC-00035-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Accessories', opening: 0, movement: expenseByCategory('Accessories', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Accessories', startTs: expenseStartTs }) },
    { accountId: 'ACC-00036-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Licensing & Certification', opening: 0, movement: expenseByCategory('Licensing & Certification', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Licensing & Certification', startTs: expenseStartTs }) },
    { accountId: 'ACC-00037-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Souvenirs and Branding', opening: 0, movement: expenseByCategory('Souvenirs and Branding', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Souvenirs and Branding', startTs: expenseStartTs }) },
    { accountId: 'ACC-00038-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Internet & Communication', opening: 0, movement: expenseByCategory('Internet & Communication', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Internet & Communication', startTs: expenseStartTs }) },
    { accountId: 'ACC-00039-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Advertisement', opening: 0, movement: expenseByCategory('Advertisement', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Advertisement', startTs: expenseStartTs }) },
    { accountId: 'ACC-00040-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Repairs and Maintenance', opening: 0, movement: expenseByCategory('Repairs and Maintenance', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Repairs and Maintenance', startTs: expenseStartTs }) },
    { accountId: 'ACC-00041-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Cleaning and Sanitation', opening: 0, movement: expenseByCategory('Cleaning and Sanitation', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Cleaning and Sanitation', startTs: expenseStartTs }) },
    { accountId: 'ACC-00042-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Other Expenses', opening: 0, movement: expenseByCategory('Other Expenses', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Other Expenses', startTs: expenseStartTs }) },
    { accountId: 'ACC-00043-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Fees and Charges', opening: 0, movement: expenseByCategory('Fees and Charges', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Fees and Charges', startTs: expenseStartTs }) },
    { accountId: 'ACC-00044-03', accountType: 'Income Statement', accountClass: 'Expenses', subAccounts: 'Expenses', description: 'Gifts and Donation', opening: 0, movement: expenseByCategory('Gifts and Donation', expenseStartTs), dates: accountEntryDates({ entryType: 'expense', category: 'Gifts and Donation', startTs: expenseStartTs }) },

    { accountId: 'ACC-00041-04', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Non Current Assets', description: 'PPE', opening: accountLedgerBalance('PPE', periodStartTs, true), movement: accountLedgerBalance('PPE', periodStartTs), dates: accountLedgerDates('PPE', periodStartTs) },
    { accountId: 'ACC-00042-04', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Non Current Assets', description: 'Equipment', opening: accountLedgerBalance('Equipment', periodStartTs, true), movement: accountLedgerBalance('Equipment', periodStartTs), dates: accountLedgerDates('Equipment', periodStartTs) },
    { accountId: 'ACC-00051-05', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Cash and Cash Equivalent', description: 'Cash', opening: accountLedgerBalance('Cash', periodStartTs, true), movement: accountLedgerBalance('Cash', periodStartTs), dates: accountLedgerDates('Cash', periodStartTs) },
    { accountId: 'ACC-00052-05', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Cash and Cash Equivalent', description: 'MoMo Wallet', opening: accountLedgerBalance('MoMo Wallet', periodStartTs, true), movement: accountLedgerBalance('MoMo Wallet', periodStartTs), dates: accountLedgerDates('MoMo Wallet', periodStartTs) },
    { accountId: 'ACC-00053-05', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Cash and Cash Equivalent', description: 'CalBank', opening: accountLedgerBalance('CalBank', periodStartTs, true), movement: accountLedgerBalance('CalBank', periodStartTs), dates: accountLedgerDates('CalBank', periodStartTs) },
    { accountId: 'ACC-00054-05', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Cash and Cash Equivalent', description: 'GhanaPay', opening: accountLedgerBalance('GhanaPay', periodStartTs, true), movement: accountLedgerBalance('GhanaPay', periodStartTs), dates: accountLedgerDates('GhanaPay', periodStartTs) },

    { accountId: 'ACC-00061-06', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Other Current Assets', description: 'Trade Receivables', opening: tradeReceivablesOpening, movement: tradeReceivablesMovement, dates: uniqueDatesSorted([...salesDates({ startTs: periodStartTs }), ...receiptDates({ startTs: periodStartTs })]) },
    { accountId: 'ACC-00062-06', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Other Current Assets', description: 'Other Receivables', opening: accountLedgerBalance('Other Receivables', periodStartTs, true), movement: accountLedgerBalance('Other Receivables', periodStartTs), dates: accountLedgerDates('Other Receivables', periodStartTs) },

    { accountId: 'ACC-00071-07', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Inventory', description: 'Finished Goods', opening: finishedGoodsOpening, movement: finishedGoodsMovement, dates: uniqueDatesSorted([...productionDates({ startTs: periodStartTs }), ...salesDates({ startTs: periodStartTs })]) },
    { accountId: 'ACC-00072-07', accountType: 'Balance Sheet', accountClass: 'Assets', subAccounts: 'Inventory', description: 'Raw Materials', opening: rawMaterialsOpening, movement: rawMaterialsMovement, dates: uniqueDatesSorted([...purchaseDates({ startTs: periodStartTs }), ...materialUsageDates({ startTs: periodStartTs })]) },

    { accountId: 'ACC-00081-08', accountType: 'Balance Sheet', accountClass: 'Liability', subAccounts: 'Payables', description: 'Payables', opening: payablesOpening, movement: payablesMovement, dates: uniqueDatesSorted([...purchaseDates({ startTs: periodStartTs }), ...purchasePaymentDates({ startTs: periodStartTs })]) },
    { accountId: 'ACC-00082-08', accountType: 'Balance Sheet', accountClass: 'Liability', subAccounts: 'Payables', description: 'Other Payables', opening: accountLedgerBalance('Other Payables', periodStartTs, true), movement: accountLedgerBalance('Other Payables', periodStartTs), dates: accountLedgerDates('Other Payables', periodStartTs) },

    { accountId: 'ACC-00091-09', accountType: 'Balance Sheet', accountClass: 'Equity', subAccounts: 'Net Worth', description: 'Equity', opening: accountLedgerBalance('Equity', periodStartTs, true), movement: accountLedgerBalance('Equity', periodStartTs), dates: accountLedgerDates('Equity', periodStartTs) },
  ]

  const retainedOpenBaseIncome = sumBy(trialBalanceSheetRows.slice(0, 3), row => row.opening)
  const retainedOpenBaseCostAndExpenses = sumBy(trialBalanceSheetRows.slice(3, 21), row => row.opening)
  const retainedMoveIncome = sumBy(trialBalanceSheetRows.slice(0, 3), row => row.movement)
  const retainedMoveDirect = sumBy(trialBalanceSheetRows.slice(3, 7), row => row.movement)
  const retainedMoveExpense = sumBy(trialBalanceSheetRows.slice(7, 21), row => row.movement)
  const rmProfitAll = sumBy(data.productionBatches, batch => batch.profit)

  trialBalanceSheetRows.push({
    accountId: 'ACC-00092-09',
    accountType: 'Balance Sheet',
    accountClass: 'Equity',
    subAccounts: 'Net Worth',
    description: 'Retained (Profit) Loss',
    opening: -(retainedOpenBaseIncome - retainedOpenBaseCostAndExpenses),
    movement: -(retainedMoveIncome - retainedMoveDirect - retainedMoveExpense) - rmProfitAll,
    dates: uniqueDatesSorted(trialBalanceSheetRows.flatMap(row => row.dates || [])),
  })

  const trialBalanceRows = trialBalanceSheetRows
    .filter(row => Math.abs(toNumber(row.opening)) > 0.000001 || Math.abs(toNumber(row.movement)) > 0.000001)
    .map(row => {
      const opening = toNumber(row.opening)
      const movement = toNumber(row.movement)
      const total = opening + movement
      return {
        key: row.accountId,
        emphasisIndex: 7,
        cells: [
          row.accountId,
          row.accountType,
          row.accountClass,
          row.subAccounts,
          row.description,
          formatDateRange(row.dates),
          fmt(opening),
          fmt(movement),
          fmt(total),
        ],
      }
    })

  const activeContent = useMemo(() => SECTIONS.find(s => s.key === activeSection) || SECTIONS[0], [activeSection])
  const getSectionTab = (sectionKey) => sectionTabs[sectionKey] || SECTION_DEFAULT_TABS[sectionKey]
  const setSectionTab = (sectionKey, tabKey) => setSectionTabs(cur => ({ ...cur, [sectionKey]: tabKey }))
  const activeSalesFilterScope = `sales_hub:${getSectionTab('sales_hub')}`
  const activeSalesFilters = getScopedFilters(activeSalesFilterScope)
  const activePricingFilterScope = `accounts_pricing:${activeAccountsTab}`
  const activePricingFilters = getScopedFilters(activePricingFilterScope)
  const jumpToSection = (sectionKey, tabKey = null) => {
    setActiveSection(sectionKey)
    setIsMobileNavOpen(false)
    if (tabKey) setSectionTab(sectionKey, tabKey)
  }
  const handleSectionSelect = (sectionKey) => {
    setActiveSection(sectionKey)
    setIsMobileNavOpen(false)
  }

  // ── Section renderer ──────────────────────────────────────────────────────

  function renderSection() {
    if (isLoading) {
      if (activeSection === 'dashboard') return <><SummaryGridSkeleton count={5} /><section className="dashboard-snippet-grid"><SnippetCardSkeleton title="Top Customers" /><SnippetCardSkeleton title="Top Products" /><SnippetCardSkeleton title="Raw Materials" /><SnippetCardSkeleton title="Finished Goods" /></section><section className="dashboard-snippet-grid sales-history-grid"><SnippetCardSkeleton title="P&L Statement" rows={6} /><SnippetCardSkeleton title="Receivables" /><SnippetCardSkeleton title="Open Invoices" /></section></>
      if (activeSection === 'sales_hub') return (
        <>
          <SummaryGridSkeleton />
          <WorkspaceToolbarSkeleton />
          <section className="workspace-inline-tabs">
          {SECTION_TABS.sales_hub.map(tab => <span key={tab.key} className={`workspace-inline-tab ${tab.key === getSectionTab('sales_hub') ? 'active' : ''}`}>{tab.label}</span>)}
          </section>
          {getSectionTab('sales_hub') === 'sales_list' && <TableCardSkeleton title="Sales List" columns={11} rows={6} />}
          {getSectionTab('sales_hub') === 'recent_receipts' && <SnippetCardSkeleton title="Recent Receipts" rows={6} />}
        </>
      )
      if (activeSection === 'production_ops') return (
        <>
          <SummaryGridSkeleton />
          <WorkspaceToolbarSkeleton />
          <section className="workspace-inline-tabs">
            {SECTION_TABS.production_ops.map(tab => <span key={tab.key} className={`workspace-inline-tab ${tab.key === getSectionTab('production_ops') ? 'active' : ''}`}>{tab.label}</span>)}
          </section>
          {getSectionTab('production_ops') === 'batches' && <TableCardSkeleton title="Production Batches" columns={6} rows={5} />}
          {getSectionTab('production_ops') === 'inventory' && <TableCardSkeleton title="Finished Inventory" columns={5} rows={5} />}
        </>
      )
      if (activeSection === 'supplies_stock') return (
        <>
          <SummaryGridSkeleton />
          <WorkspaceToolbarSkeleton />
          <section className="workspace-inline-tabs">
            {SECTION_TABS.supplies_stock.map(tab => <span key={tab.key} className={`workspace-inline-tab ${tab.key === getSectionTab('supplies_stock') ? 'active' : ''}`}>{tab.label}</span>)}
          </section>
          {getSectionTab('supplies_stock') === 'purchases' && <TableCardSkeleton title="Purchase Register" columns={7} rows={5} />}
          {getSectionTab('supplies_stock') === 'materials' && <TableCardSkeleton title="Raw Materials" columns={9} rows={6} />}
          {getSectionTab('supplies_stock') === 'balances' && <SnippetCardSkeleton title="Open Supplier Balances" rows={6} />}
        </>
      )
      if (activeSection === 'customers') return (
        <>
          <SummaryGridSkeleton />
          <WorkspaceToolbarSkeleton />
          <section className="workspace-inline-tabs">
          {SECTION_TABS.customers.map(tab => <span key={tab.key} className={`workspace-inline-tab ${tab.key === getSectionTab('customers') ? 'active' : ''}`}>{tab.label}</span>)}
          </section>
          {getSectionTab('customers') === 'customers' && <TableCardSkeleton title="Customers" columns={6} rows={6} />}
          {getSectionTab('customers') === 'receivables' && <SnippetCardSkeleton title="Top Receivables" rows={5} />}
        </>
      )
      if (activeSection === 'suppliers') return (
        <>
          <SummaryGridSkeleton />
          <WorkspaceToolbarSkeleton />
          <section className="workspace-inline-tabs">
          {SECTION_TABS.suppliers.map(tab => <span key={tab.key} className={`workspace-inline-tab ${tab.key === getSectionTab('suppliers') ? 'active' : ''}`}>{tab.label}</span>)}
          </section>
          {getSectionTab('suppliers') === 'suppliers' && <TableCardSkeleton title="Suppliers" columns={6} rows={6} />}
          {getSectionTab('suppliers') === 'balances' && <SnippetCardSkeleton title="Open Balances" rows={5} />}
        </>
      )
      return (
        <>
          <SummaryGridSkeleton />
          <WorkspaceToolbarSkeleton />
          <section className="workspace-inline-tabs">
            {ACCOUNT_SECTION_TABS.map(tab => (
              <span key={tab.key} className={`workspace-inline-tab ${tab.key === activeAccountsTab ? 'active' : ''}`}>{tab.label}</span>
            ))}
          </section>
          {activeAccountsTab === 'entries' && <TableCardSkeleton title="Account Entries" columns={5} rows={6} />}
          {activeAccountsTab === 'pricing' && <TableCardSkeleton title="Pricing Rules" columns={5} rows={6} />}
          {activeAccountsTab === 'trial_balance' && <TableCardSkeleton title="Trial Balance" columns={9} rows={10} />}
        </>
      )
    }

    if (activeSection === 'dashboard') return (
      <>
        <DateFilterControl range={dashboardDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('dashboard')} onPresetSelect={preset => applyQuickDatePreset('dashboard', preset)} activePreset={sectionDatePresets.dashboard || ''} inlineTitle="Dashboard" />
        <SummaryGrid items={dashboardContent.metrics} />
        <section className="dashboard-snippet-grid dashboard-snippet-grid-hero">
          <TrendChartCard
            title="Sales vs Receipts"
            subtitle="Last six months of invoices booked against cash collected."
            points={dashboardContent.monthlyTrend}
            actionLabel="Open Sales"
            onAction={() => jumpToSection('sales_hub', 'sales_list')}
            legend={[
              { label: 'Sales', tone: 'tone-sales' },
              { label: 'Receipts', tone: 'tone-expense' },
            ]}
          />
          <DonutBreakdownCard
            title="Invoice Status Mix"
            subtitle="Current invoice book split by collection state."
            segments={dashboardContent.invoiceStatusSegments}
            centerLabel="Outstanding"
            centerValue={fmt(sumBy(dashboardContent.invoiceStatusSegments.slice(1), segment => segment.value))}
            actionLabel="View Invoices"
            onAction={() => jumpToSection('sales_hub', 'sales_list')}
          />
        </section>
        <section className="dashboard-snippet-grid dashboard-snippet-grid-hero">
          <DonutBreakdownCard
            title="Payment Method Mix"
            subtitle="How cash is coming in across recorded payments."
            segments={dashboardContent.paymentMethodSegments}
            centerLabel="Collected"
            centerValue={fmt(sumBy(dashboardContent.paymentMethodSegments, segment => segment.value))}
            actionLabel="View Receipts"
            onAction={() => jumpToSection('sales_hub', 'recent_receipts')}
          />
          <MeterCard
            title="Business Health"
            subtitle="A quick operating read from collections, margin, ticket size, and stock pressure."
            rows={dashboardContent.dashboardSignals}
            actionLabel="Open Accounts"
            onAction={() => { setActiveAccountsTab('trial_balance'); jumpToSection('accounts_pricing') }}
          />
        </section>
        <DashboardCardCarousel className="dashboard-snippet-grid-compact">
          <SnippetCard title="Top Customers by Value"  rows={dashboardContent.topCustomers} actionLabel="Open Customers" onAction={() => jumpToSection('customers', 'customers')} />
          <SnippetCard title="Top Products Sold"       rows={dashboardContent.topProducts} actionLabel="Open Inventory" onAction={() => jumpToSection('production_ops', 'inventory')} />
          <SnippetCard title="Raw Materials Status"    rows={dashboardContent.rawMaterials} actionLabel="Open Materials" onAction={() => jumpToSection('supplies_stock', 'materials')} />
          <SnippetCard title="Finished Goods Status"   rows={dashboardContent.finishedGoods} actionLabel="Open Stock" onAction={() => jumpToSection('production_ops', 'inventory')} />
        </DashboardCardCarousel>
        <DashboardCardCarousel className="dashboard-snippet-grid-compact sales-history-grid">
          <SnippetCard title="P&L Statement (YTD)"     rows={dashboardContent.plStatement} actionLabel="Open Accounts" onAction={() => { setActiveAccountsTab('trial_balance'); jumpToSection('accounts_pricing') }} />
          <SnippetCard title="Top 5 Receivables"       rows={dashboardContent.receivables} actionLabel="Open Receivables" onAction={() => jumpToSection('customers', 'receivables')} />
          <SnippetCard title="Open Invoices"           rows={dashboardContent.openInvoices} actionLabel="Open Sales" onAction={() => jumpToSection('sales_hub', 'sales_list')} />
        </DashboardCardCarousel>
      </>
    )

    if (activeSection === 'sales_hub') return (
      <>
        <DateFilterControl range={salesDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('sales_hub')} onPresetSelect={preset => applyQuickDatePreset('sales_hub', preset)} activePreset={sectionDatePresets.sales_hub || ''} inlineTitle="Sales Hub" />
        <WorkspaceToolbar
          className="workspace-toolbar-sales"
          title=""
          subtitle=""
          actions={<>
            <button type="button" className="account-alert-button account-alert-button-dark"  onClick={() => openModal('sale')}>Add Sale</button>
            <button type="button" className="account-alert-button account-alert-button-light" onClick={() => openModal('receipt')}>Add Receipt</button>
          </>}
        />
        <FilterSelectRow
          className="sales-mobile-filters"
          filters={salesFilterOptions}
          values={activeSalesFilters}
          onChange={(key, value) => setScopedFilter(activeSalesFilterScope, key, value)}
          onClear={() => clearScopedFilters(activeSalesFilterScope)}
        />
        <SummaryGrid items={salesSummary} />
        <section className="workspace-inline-tabs" role="tablist" aria-label="Sales page tabs">
          {SECTION_TABS.sales_hub.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === getSectionTab('sales_hub')}
              className={`workspace-inline-tab ${tab.key === getSectionTab('sales_hub') ? 'active' : ''}`}
              onClick={() => setSectionTab('sales_hub', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>
        {getSectionTab('sales_hub') === 'sales_list' && (
          <TableCard
            title="Sales List"
            subtitle="Mirrors Sales, Sales_Dtls, and Invoice workbook rows."
            columns={['Date', 'Invoice', 'Customer', 'Total', 'Paid', 'Outstanding']}
            rows={salesRows}
            mobileVariant="sales-list"
            search={searchTerms.sales_hub}
            onSearch={v => setSearch('sales_hub', v)}
            onRowClick={id => setSelectedInvoice(data.invoices.find(inv => inv.id === id) || null)}
          />
        )}
        {getSectionTab('sales_hub') === 'recent_receipts' && (
          <SnippetCard
            title="Recent Receipts"
            rows={clampRows(filteredSalesPayments, 6).map(p => ({ id: p.id, title: p.customer_name || `Invoice ${fmtInv(p.invoice)}`, meta: `${fmtD(p.payment_date)} · ${fmtStatus(p.method)}`, value: fmt(p.amount) }))}
            onItemClick={id => setSelectedReceipt(filteredSalesPayments.find(p => p.id === id) || null)}
          />
        )}
      </>
    )

    if (activeSection === 'production_ops') return (
      <>
        <DateFilterControl range={productionDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('production_ops')} onPresetSelect={preset => applyQuickDatePreset('production_ops', preset)} activePreset={sectionDatePresets.production_ops || ''} inlineTitle="Production Ops" />
        <WorkspaceToolbar
          className="workspace-toolbar-production"
          title=""
          subtitle=""
          actions={<>
            <button type="button" className="account-alert-button account-alert-button-dark"  onClick={() => openModal('batch')}>Add Batch</button>
            <button type="button" className="account-alert-button account-alert-button-light" onClick={() => openModal('finished_goods')}>Finished Goods Produced</button>
          </>}
        />
        <div className="production-summary-offset">
          <SummaryGrid items={productionSummary} />
        </div>
        <section className="workspace-inline-tabs" role="tablist" aria-label="Production page tabs">
          {SECTION_TABS.production_ops.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === getSectionTab('production_ops')}
              className={`workspace-inline-tab ${tab.key === getSectionTab('production_ops') ? 'active' : ''}`}
              onClick={() => setSectionTab('production_ops', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>
        {getSectionTab('production_ops') === 'batches' && (
          <TableCard
            title="Production Batches"
            subtitle="Track batch production and finished stock."
            columns={['Date', 'Batch Number', 'Expiry Date', 'Outputs', 'Total Cost', 'Profit']}
            rows={batchRows}
            mobileVariant="production-batches"
            search={searchTerms.production_ops}
            onSearch={v => setSearch('production_ops', v)}
            onRowClick={id => setSelectedBatch(data.productionBatches.find(b => b.id === id) || null)}
          />
        )}
        {getSectionTab('production_ops') === 'inventory' && (
          <TableCard
            title="Finished Inventory"
            subtitle="Stock by product size — matches the Inventory sheet. Click a row to see full history."
            columns={['Item', 'Available', 'Stock Balance', 'Prod Level', 'Prod Required']}
            rows={inventoryRows}
            mobileVariant="inventory-list"
            onRowClick={size => setSelectedInventoryItem(inventoryLedger.find(i => i.size === size) || null)}
            search={searchTerms.inventory}
            onSearch={v => setSearch('inventory', v)}
          />
        )}
      </>
    )

    if (activeSection === 'supplies_stock') return (
      <>
        <DateFilterControl range={suppliesDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('supplies_stock')} onPresetSelect={preset => applyQuickDatePreset('supplies_stock', preset)} activePreset={sectionDatePresets.supplies_stock || ''} inlineTitle="Supplies & Stock" />
        <SummaryGrid items={suppliesSummary} />
        <WorkspaceToolbar
          className="workspace-toolbar-supplies"
          title=""
          subtitle=""
          actions={<>
            <button type="button" className="account-alert-button account-alert-button-dark"  onClick={() => openModal('purchase')}>Add Purchase</button>
            <button type="button" className="account-alert-button account-alert-button-light" onClick={() => openModal('pur_pay')}>Record Supplier Payment</button>
            <button type="button" className="account-alert-button account-alert-button-light" onClick={() => openModal('raw_mat')}>Add Raw Material</button>
          </>}
        />
        <ScrollableTabsControl
          tabs={SECTION_TABS.supplies_stock}
          activeKey={getSectionTab('supplies_stock')}
          onSelect={tabKey => setSectionTab('supplies_stock', tabKey)}
          ariaLabel="Supplies page tabs"
        />
        {getSectionTab('supplies_stock') === 'purchases' && (
          <TableCard
            className="supplies-purchases-card"
            title="Purchase Register"
            subtitle="Click a row to view full details and payments."
            columns={['Date', '#', 'Supplier', 'Category', 'Status', 'Paid', 'Outstanding']}
            rows={purchaseRows}
            mobileVariant="purchases-list"
            search={searchTerms.supplies_stock}
            onSearch={v => setSearch('supplies_stock', v)}
            onRowClick={id => setSelectedPurchase(data.purchases.find(p => p.id === id) || null)}
          />
        )}
        {getSectionTab('supplies_stock') === 'materials' && (
          <TableCard
            className="supplies-materials-card"
            title="Raw Materials"
            subtitle="Stock levels (RawMaterials sheet). Click a row for full details."
            columns={['Material', 'Category', 'Unit', 'Opening', 'Stock In', 'Available', 'Reorder', 'Status', '']}
            rows={materialRows}
            mobileVariant="materials-list"
            onRowClick={id => setSelectedRawMaterial(data.rawMaterials.find(m => m.id === id) || null)}
          />
        )}
        {getSectionTab('supplies_stock') === 'balances' && (
          <SnippetCard
            title="Open Supplier Balances"
            rows={clampRows(filteredSupplierLedgerForSupplies).map(s => ({ id: s.id, title: s.name, meta: `${s.purchaseCount} purchases`, value: fmt(s.outstanding) }))}
          />
        )}
      </>
    )

    if (activeSection === 'customers') return (
      <>
        <DateFilterControl range={customersDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('customers')} onPresetSelect={preset => applyQuickDatePreset('customers', preset)} activePreset={sectionDatePresets.customers || ''} inlineTitle="Customers" />
        <SummaryGrid items={customersSummary} />
        <WorkspaceToolbar
          className="workspace-toolbar-customers"
          title=""
          subtitle=""
          actions={<button type="button" className="account-alert-button account-alert-button-dark" onClick={() => openModal('customer')}>Add Customer</button>}
        />
        <section className="workspace-inline-tabs" role="tablist" aria-label="Customers page tabs">
          {SECTION_TABS.customers.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === getSectionTab('customers')}
              className={`workspace-inline-tab ${tab.key === getSectionTab('customers') ? 'active' : ''}`}
              onClick={() => setSectionTab('customers', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>
        {getSectionTab('customers') === 'customers' && (
          <TableCard
            title="Customers"
            subtitle="Click a row to view full history. Click Edit to update."
            columns={['Customer', 'Phone', 'Invoices', 'Paid', 'Outstanding', '']}
            rows={customerRows}
            mobileVariant="customers-list"
            search={searchTerms.customers}
            onSearch={v => setSearch('customers', v)}
            onRowClick={id => setSelectedCustomer(customerLedger.find(c => c.id === id) || null)}
          />
        )}
        {getSectionTab('customers') === 'receivables' && (
          <SnippetCard
            title="Top Receivables"
            rows={clampRows(filteredCustomerLedger.filter(c => c.outstanding > 0)).map(c => ({ id: c.id, title: c.name, meta: `${c.invoiceCount} invoices`, value: fmt(c.outstanding) }))}
          />
        )}
      </>
    )

    if (activeSection === 'suppliers') return (
      <>
        <DateFilterControl range={suppliersDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('suppliers')} onPresetSelect={preset => applyQuickDatePreset('suppliers', preset)} activePreset={sectionDatePresets.suppliers || ''} inlineTitle="Suppliers" />
        <SummaryGrid items={suppliersSummary} />
        <WorkspaceToolbar
          className="workspace-toolbar-suppliers"
          title=""
          subtitle=""
          actions={<button type="button" className="account-alert-button account-alert-button-dark" onClick={() => openModal('supplier')}>Add Supplier</button>}
        />
        <section className="workspace-inline-tabs" role="tablist" aria-label="Suppliers page tabs">
          {SECTION_TABS.suppliers.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === getSectionTab('suppliers')}
              className={`workspace-inline-tab ${tab.key === getSectionTab('suppliers') ? 'active' : ''}`}
              onClick={() => setSectionTab('suppliers', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>
        {getSectionTab('suppliers') === 'suppliers' && (
          <TableCard
            title="Suppliers"
            subtitle="Balances and purchase history. Click Edit to update."
            columns={['Supplier', 'Item Category', 'Purchases', 'Paid', 'Outstanding', '']}
            rows={supplierRows}
            mobileVariant="suppliers-list"
            onRowClick={id => {
              const supplier = supplierLedger.find(s => s.id === id)
              setSelectedSupplier(supplier ? { ...supplier, item_category: resolveSupplierItemCategory(supplier, data.purchases, data.rawMaterials) } : null)
            }}
            search={searchTerms.suppliers}
            onSearch={v => setSearch('suppliers', v)}
          />
        )}
        {getSectionTab('suppliers') === 'balances' && (
          <SnippetCard
            title="Open Supplier Balances"
            rows={clampRows(filteredSupplierLedger.filter(s => s.outstanding > 0)).map(s => ({ id: s.id, title: s.name, meta: `${s.purchaseCount} purchases`, value: fmt(s.outstanding) }))}
          />
        )}
      </>
    )

    // accounts_pricing
    return (
      <>
        <DateFilterControl range={accountsDateFilter} onOpen={openDateFilter} onClear={() => clearDateFilter('accounts_pricing')} onPresetSelect={preset => applyQuickDatePreset('accounts_pricing', preset)} activePreset={sectionDatePresets.accounts_pricing || ''} inlineTitle="Accounts & Pricing" />
        <SummaryGrid items={accountsSummary} />
        <WorkspaceToolbar
          className="workspace-toolbar-accounts"
          title=""
          subtitle=""
          actions={<>
            <button type="button" className="account-alert-button account-alert-button-dark"  onClick={() => openModal('account')}>Add Account Entry</button>
            <button type="button" className="account-alert-button account-alert-button-light" onClick={() => openModal('pricing')}>Add Pricing Rule</button>
          </>}
        />
        <section className="workspace-inline-tabs" role="tablist" aria-label="Accounts page tabs">
          {ACCOUNT_SECTION_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === activeAccountsTab}
              className={`workspace-inline-tab ${tab.key === activeAccountsTab ? 'active' : ''}`}
              onClick={() => setActiveAccountsTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {activeAccountsTab === 'entries' && (
          <TableCard
            className="account-entries-table-card"
            title="Account Entries"
            subtitle="Simple transaction summary table. Click a row to view the full account entry details."
            columns={['Date', 'Transaction ID', 'Type', 'Category', 'Amount']}
            colWidths={['150px', '220px', '140px', 'minmax(280px, 1.5fr)', '180px']}
            rows={accountRows}
            mobileVariant="accounts-list"
            search={searchTerms.accounts}
            onSearch={v => setSearch('accounts', v)}
            onRowClick={key => { const e = data.accountTransactions.find(t => String(t.id) === String(key)); if (e) setSelectedAccountEntry(e) }}
            defaultRowsPerPage={20}
          />
        )}

        {activeAccountsTab === 'pricing' && (
          <>
            <FilterSelectRow
              className="pricing-filter-row"
              filters={pricingFilterOptions}
              values={activePricingFilters}
              onChange={(key, value) => setScopedFilter(activePricingFilterScope, key, value)}
              onClear={() => clearScopedFilters(activePricingFilterScope)}
            />
            <TableCard
              title="Pricing Rules"
              subtitle="Pricing sheet maintained from backend pricing rules, with detailed live filters by price type, size, item, and price band."
              columns={['Finished Good Size', 'Size', 'Pricing Category', 'Price', '']}
              colWidths={['420px', '220px', '420px', '180px', '100px']}
              rows={pricingRows}
              search={searchTerms.pricing}
              onSearch={v => setSearch('pricing', v)}
              defaultRowsPerPage={20}
            />
          </>
        )}

        {activeAccountsTab === 'trial_balance' && (
          <TableCard
            title="Trial Balance"
            subtitle={`Workbook column structure reproduced with period logic from ${TRIAL_BALANCE_PERIOD_START} (expenses baseline ${TRIAL_BALANCE_EXPENSE_START}).`}
            columns={['Account ID', 'Account Type', 'Account Class', 'Sub-Accounts', 'Account Description', 'Date', 'Opening Bal', 'Movement', 'Total']}
            colWidths={['140px', '170px', '150px', '170px', '280px', '200px', '140px', '140px', '140px']}
            rows={trialBalanceRows}
            search={searchTerms.trial_balance}
            onSearch={v => setSearch('trial_balance', v)}
            defaultRowsPerPage={20}
          />
        )}

      </>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="account-page-shell">
      {/* Shared datalists */}
      <datalist id="item-categories">
        {itemCategories.map(cat => <option key={cat} value={cat} />)}
      </datalist>
      <datalist id="product-sizes">
        {productSizes.map(s => <option key={s} value={s} />)}
      </datalist>
      <datalist id="raw-material-template-names">
        {PRODUCTION_RAW_MATERIAL_TEMPLATES.map(name => <option key={name} value={name} />)}
      </datalist>

      <section className="mobile-app-shell">
        <div className="mobile-app-topbar">
          <div className="mobile-app-brand">
            <img src={plusLogo} alt="Plus Treat logo" className="mobile-app-brand-logo" />
          </div>
          <div className="mobile-app-profile">
            <div className="mobile-app-profile-copy">
              <small>Welcome back</small>
              <strong>{user?.name || 'Plus Treat Team'}</strong>
            </div>
          </div>
          <div className="mobile-app-user" ref={mobileMenuRef}>
            <button
              type="button"
              className={`app-layout-menu-trigger mobile-app-menu-trigger${isMobileProfileOpen ? ' is-open' : ''}`}
              onClick={() => setIsMobileProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMobileProfileOpen}
            >
              <span className="app-layout-avatar" aria-hidden="true">{avatarText}</span>
              <span className="app-layout-caret" aria-hidden="true">▾</span>
              <span className="app-layout-sr-only">Open profile menu</span>
            </button>

            {isMobileProfileOpen ? (
              <div className="app-layout-menu mobile-app-profile-menu" role="menu" aria-label="Mobile account menu">
                <button
                  type="button"
                  className="app-layout-menu-item"
                  onClick={() => setIsMobileProfileOpen(false)}
                >
                  <span>Profile</span>
                </button>

                <div className="app-layout-profile-card">
                  <strong>{user?.name || 'Staff'}</strong>
                  <span>{user?.role || 'Staff'}</span>
                  <span>{user?.email || user?.username || 'No contact info'}</span>
                  {user?.phone ? <span>{user.phone}</span> : null}
                </div>

                <button
                  type="button"
                  className="app-layout-menu-item app-layout-menu-item-danger"
                  onClick={handleMobileLogout}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {activeSection !== 'sales_hub' && activeSection !== 'production_ops' && activeSection !== 'dashboard' && activeSection !== 'customers' && activeSection !== 'supplies_stock' && activeSection !== 'suppliers' && activeSection !== 'accounts_pricing' ? (
          <article className="mobile-section-hero-card">
            <div className="mobile-section-hero-copy">
              <span className="mobile-section-hero-kicker">{activeContent.label}</span>
              <h2>{activeContent.subtitle}</h2>
            </div>
          </article>
        ) : null}
      </section>

      <section className="account-page-layout">
        <aside className="account-side-nav">
          <nav className="account-nav-list" aria-label="Workbook sections">
            {SECTIONS.map(s => (
              <button key={s.key} type="button" className={`account-nav-item ${s.key === activeSection ? 'active' : ''}`} onClick={() => handleSectionSelect(s.key)}>
                <span className="account-nav-icon"><NavIcon type={s.icon} /></span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <section ref={accountContentRef} className="account-content">
          <header className={`account-content-header section-${activeSection}`}>
            <h1>{activeContent.label}</h1>
            <p>{activeContent.subtitle}</p>
          </header>
          {loadError ? <div className="workspace-error-banner">{loadError}</div> : null}
          {renderSection()}
        </section>
      </section>

      {/* ── SALE MODAL ── */}
      <nav className="mobile-bottom-dock" aria-label="Mobile primary navigation">
        {mobilePrimarySections.map((sectionKey) => {
          const section = SECTIONS.find((entry) => entry.key === sectionKey)
          if (!section) return null
          return (
            <button
              key={section.key}
              type="button"
              className={`mobile-bottom-dock-item ${activeSection === section.key ? 'active' : ''}`}
              onClick={() => handleSectionSelect(section.key)}
            >
              <span className="mobile-bottom-dock-icon"><NavIcon type={section.icon} /></span>
              <span>{section.label.replace(' Ops', '').replace(' Hub', '')}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="mobile-bottom-dock-item mobile-bottom-dock-item-accent"
          onClick={() => setIsMobileNavOpen(true)}
          aria-label="Open all sections"
        >
          <span className="mobile-bottom-dock-icon"><NavIcon type="menu" /></span>
          <span>More</span>
        </button>
      </nav>

      {isMobileNavOpen ? (
        <div className="mobile-section-sheet-backdrop" role="presentation" onClick={() => setIsMobileNavOpen(false)}>
          <section
            className="mobile-section-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Section navigation"
            onClick={e => e.stopPropagation()}
          >
            <div className="mobile-section-sheet-handle" aria-hidden="true" />
            <div className="mobile-section-sheet-header">
              <div>
                <span className="sales-form-eyebrow">More</span>
                <h3>Other sections</h3>
              </div>
            </div>
            <nav className="mobile-section-sheet-list" aria-label="Mobile workbook sections">
              {mobileExtraSections.map(s => (
                <button
                  key={s.key}
                  type="button"
                  className={`mobile-section-sheet-item ${s.key === activeSection ? 'active' : ''}`}
                  onClick={() => handleSectionSelect(s.key)}
                >
                  <span className="mobile-section-sheet-icon"><NavIcon type={s.icon} /></span>
                  <span className="mobile-section-sheet-copy">
                    <strong>{s.label}</strong>
                  </span>
                </button>
              ))}
            </nav>
          </section>
        </div>
      ) : null}

      {activeModal === 'date_filter' && (
        <ModalShell
          kicker="Workspace Filter"
          title={`${activeContent.label} Date Range`}
          subtitle="Choose a start date, end date, or both to narrow the records shown in this section."
          onClose={() => setActiveModal('')}
        >
          <form className="sales-form" onSubmit={applyDateFilter}>
            <div className="sales-form-grid">
              <label className="sales-field">
                <span>Start Date</span>
                <input
                  type="date"
                  value={dateFilterDraft.start}
                  onChange={e => setDateFilterDraft(current => ({ ...current, start: e.target.value }))}
                />
              </label>
              <label className="sales-field">
                <span>End Date</span>
                <input
                  type="date"
                  value={dateFilterDraft.end}
                  onChange={e => setDateFilterDraft(current => ({ ...current, end: e.target.value }))}
                />
              </label>
            </div>
            <div className="sales-form-actions">
              <button type="button" className="account-alert-button account-alert-button-light" onClick={() => clearDateFilter(activeSection)}>
                Clear Filter
              </button>
              <button type="submit" className="account-alert-button account-alert-button-dark">
                Apply Filter
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {activeModal === 'sale' && (() => {
        const selectedCust      = data.customers.find(c => String(c.id) === String(saleForm.customer))
        const activePricingCatId = saleForm.pricingCategoryId
        const activePricingCategoryName = activePricingCatId
          ? data.pricingCategories.find(pc => String(pc.id) === activePricingCatId)?.name || ''
          : ''
        const selectedSalesperson = data.staffProfiles.find(sp => String(sp.id) === String(saleForm.staff))
        const salespersonName = selectedSalesperson
          ? `${selectedSalesperson.user?.first_name || ''} ${selectedSalesperson.user?.last_name || ''}`.trim()
          : (user?.name || '')
        const filteredRules     = activePricingCatId
          ? data.pricingRules.filter(r => String(r.pricing_category) === activePricingCatId)
          : data.pricingRules
        const subtotal = saleForm.lines.reduce((s, l) => {
          const rule = filteredRules.find(r => r.size === l.productSize)
          return s + toNumber(l.quantity) * toNumber(l.unitPrice || rule?.price || 0)
        }, 0)
        const discountAmount = Math.min(subtotal, Math.max(0, toNumber(saleForm.discountAmount)))
        const invoiceTotal = Math.max(0, subtotal - discountAmount)
        const paidNow = sumBy(saleForm.payments, payment => payment.amount)
        const balanceAfterPayments = Math.max(0, invoiceTotal - paidNow)
        return (
        <ModalShell
          kicker="Plus Treat Sales Desk"
          title="Sales Entry"
          stat={invoiceTotal > 0 ? fmt(invoiceTotal) : undefined}
          onClose={() => setActiveModal('')}
          headerAside={salespersonName ? <span className="sales-modal-inline-meta">{salespersonName}</span> : null}
          cardClassName="sales-modal-card-xwide"
        >
          <form className="sales-form sales-form-redesign" onSubmit={handleSaleSubmit}>
            <div className="sales-form-grid sales-form-grid-primary">
              <label className="sales-field"><span>Invoice Date</span><input type="date" value={saleForm.invoiceDate} onChange={e => setSaleForm(c => ({ ...c, invoiceDate: e.target.value }))} /></label>
              <label className="sales-field">
                <span>Customer</span>
                <AppAutocomplete
                  ariaLabel="Customer"
                  options={customerSelectOptions}
                  placeholder="Select customer"
                  searchPlaceholder="Search customers..."
                  value={saleForm.customer}
                  onChange={changeSaleCustomer}
                />
              </label>
              <label className="sales-field">
                <span>Pricing Category</span>
                <input type="text" value={activePricingCategoryName || 'All prices'} readOnly />
              </label>
            </div>

            {/* Customer info strip */}
            {selectedCust && (
              <div className="sale-customer-info">
                {selectedCust.customer_category_name && (
                  <div className="sale-customer-info-item">
                    <span>Customer Category</span>
                    <strong>{selectedCust.customer_category_name}</strong>
                  </div>
                )}
                {selectedCust.pricing_category && (
                  <div className="sale-customer-info-item">
                    <span>Default Pricing Tier</span>
                    <strong>{selectedCust.pricing_category}</strong>
                  </div>
                )}
                {selectedCust.phone && (
                  <div className="sale-customer-info-item">
                    <span>Phone</span>
                    <strong>{selectedCust.phone}</strong>
                  </div>
                )}
              </div>
            )}

            <section className="sales-lines-panel">
              <div className="sales-lines-panel-header">
                <div>
                  <span className="sales-form-eyebrow">Line Items</span>
                  <h3>
                    Products on this sale
                    {activePricingCatId && (
                      <span className="sale-lines-tier-badge">
                        {data.pricingCategories.find(pc => String(pc.id) === activePricingCatId)?.name}
                      </span>
                    )}
                  </h3>
                </div>
                <button type="button" className="account-alert-button account-alert-button-light sales-add-line-button" onClick={() => setSaleForm(c => ({ ...c, lines: [...c.lines, mkSaleLine()] }))}>Add Line</button>
              </div>
              <div className="sales-lines">
                {saleForm.lines.map((line, idx) => {
                  const matchedRule = filteredRules.find(r => r.size === line.productSize)
                  const noRule = line.productSize && !matchedRule
                  const matchedProduct = data.products.find(product => normalizeSizeKey(product.name) === normalizeSizeKey(line.productSize))
                  const currentStock = toNumber(matchedProduct?.stock_quantity)
                  const requestedQty = toNumber(line.quantity)
                  const projectedStock = currentStock - requestedQty
                  return (
                    <div key={idx} className="sales-line-row sales-line-row-sale">
                      <div className="sales-line-index">{idx + 1}</div>
                      <label className="sales-field">
                        <span>Product Size {noRule && <span style={{ color: '#d97706', fontWeight: 600 }}>⚠ no price rule</span>}</span>
                        <input
                          list="product-sizes"
                          placeholder="e.g. 200ml"
                          value={line.productSize}
                          onChange={e => updateSaleLineSize(idx, e.target.value, filteredRules)}
                        />
                      </label>
                      <label className="sales-field"><span>Qty</span><input type="number" min="1" step="1" value={line.quantity} onChange={e => updateSaleLine(idx, 'quantity', e.target.value)} /></label>
                      <label className="sales-field">
                        <span>Unit Price</span>
                        <input type="number" min="0" step="0.01" placeholder={matchedRule ? matchedRule.price : '0.00'} value={line.unitPrice || (matchedRule ? String(matchedRule.price) : '')} readOnly />
                      </label>
                      <div className="sales-inline-stock">
                        <span>Stock Left</span>
                        <strong style={{ color: projectedStock < 0 ? '#dc2626' : '#111827' }}>
                          {matchedProduct ? `${fmtQ(currentStock)} now · ${fmtQ(projectedStock)} after sale` : 'No stock record'}
                        </strong>
                      </div>
                      <span className="sale-line-total">{fmt(toNumber(line.quantity) * toNumber(line.unitPrice || matchedRule?.price || 0))}</span>
                      <button type="button" className="sales-line-remove" onClick={() => setSaleForm(c => ({ ...c, lines: c.lines.filter((_, i) => i !== idx) }))} disabled={saleForm.lines.length === 1}>Remove</button>
                    </div>
                  )
                })}
              </div>
            </section>
            <section className="sales-lines-panel">
              <div className="sales-lines-panel-header">
                <div>
                  <span className="sales-form-eyebrow">Adjustments</span>
                  <h3>Discount and payment methods</h3>
                </div>
                <button type="button" className="account-alert-button account-alert-button-light" onClick={() => setSaleForm(c => ({ ...c, payments: [...c.payments, mkSalePayment()] }))}>Add Payment</button>
              </div>
              <div className="sales-form-grid sales-form-grid-primary">
                <label className="sales-field">
                  <span>Discount</span>
                  <input type="number" min="0" step="0.01" value={saleForm.discountAmount} onChange={e => setSaleForm(c => ({ ...c, discountAmount: e.target.value }))} />
                </label>
              </div>
              <div className="sales-payment-list">
                {saleForm.payments.map((payment, idx) => (
                  <div key={idx} className="sales-payment-row">
                    <div className="sales-line-index">{idx + 1}</div>
                    <label className="sales-field">
                      <span>Amount</span>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={payment.amount} onChange={e => updateSalePayment(idx, 'amount', e.target.value)} />
                    </label>
                    <label className="sales-field">
                      <span>Method</span>
                      <AppSelect
                        ariaLabel="Payment method"
                        options={BASIC_PAYMENT_METHOD_OPTIONS}
                        value={payment.method}
                        onChange={value => updateSalePayment(idx, 'method', value)}
                      />
                    </label>
                    <label className="sales-field">
                      <span>Reference</span>
                      <input type="text" placeholder="Optional reference" value={payment.reference} onChange={e => updateSalePayment(idx, 'reference', e.target.value)} />
                    </label>
                    <label className="sales-field">
                      <span>Notes</span>
                      <input type="text" placeholder="Optional note" value={payment.notes} onChange={e => updateSalePayment(idx, 'notes', e.target.value)} />
                    </label>
                    <button
                      type="button"
                      className="sales-line-remove"
                      onClick={() => setSaleForm(c => {
                        const nextPayments = c.payments.filter((_, i) => i !== idx)
                        return { ...c, payments: nextPayments.length ? nextPayments : [mkSalePayment()] }
                      })}
                      disabled={saleForm.payments.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="sales-form-summary">
                <span>Subtotal <strong>{fmt(subtotal)}</strong></span>
                <span>Discount <strong>−{fmt(discountAmount)}</strong></span>
                <span>Total <strong>{fmt(invoiceTotal)}</strong></span>
                <span>Paid Now <strong>{fmt(paidNow)}</strong></span>
                <span>Balance <strong style={{ color: balanceAfterPayments > 0 ? '#dc2626' : '#16a34a' }}>{fmt(balanceAfterPayments)}</strong></span>
              </div>
            </section>
            <label className="sales-field"><span>Notes</span><textarea rows="2" value={saleForm.notes} onChange={e => setSaleForm(c => ({ ...c, notes: e.target.value }))} /></label>
            <div className="sales-form-actions sales-form-actions-split">
              <button type="button" className="account-alert-button account-alert-button-light" onClick={() => setActiveModal('')}>Cancel</button>
              <button type="submit" className="account-alert-button account-alert-button-dark" disabled={submitting.sale}>{submitting.sale ? 'Saving…' : 'Save Sale'}</button>
            </div>
            {feedback.sale ? <p className={`sales-form-message${feedback.sale === 'Sale saved successfully.' ? '' : ' sales-form-message-error'}`}>{feedback.sale}</p> : null}
          </form>
        </ModalShell>
        )
      })()}

      {/* ── RECEIPT MODAL ── */}
      {activeModal === 'receipt' && (() => {
          const selectedInvoice = data.invoices.find(inv => String(inv.id) === String(receiptForm.invoice))
          const outstandingBalance = toNumber(selectedInvoice?.outstanding_balance)
          const paidNow = sumBy(receiptForm.payments, payment => payment.amount)
          const balanceAfterPayments = Math.max(0, outstandingBalance - paidNow)
          return (
          <ModalShell kicker="Plus Treat Collections" title="Receipt Entry" stat={`${invoiceOptions.length} open invoices`} onClose={() => setActiveModal('')}>
          <form className="sales-form sales-form-redesign" onSubmit={handleReceiptSubmit}>
            <label className="sales-field"><span>Outstanding Invoice</span>
              <AppAutocomplete
                ariaLabel="Outstanding invoice"
                options={invoiceSelectOptions}
                placeholder="Select invoice"
                searchPlaceholder="Search invoices..."
                value={receiptForm.invoice}
                onChange={value => setReceiptForm(c => ({ ...c, invoice: value }))}
              />
            </label>
            <label className="sales-field"><span>Date</span><input type="date" value={receiptForm.paymentDate} onChange={e => setReceiptForm(c => ({ ...c, paymentDate: e.target.value }))} /></label>
            <section className="sales-lines-panel">
              <div className="sales-lines-panel-header">
                <div>
                  <span className="sales-form-eyebrow">Collection Split</span>
                  <h3>Receipt payment methods</h3>
                </div>
                <button type="button" className="account-alert-button account-alert-button-light" onClick={() => setReceiptForm(c => ({ ...c, payments: [...c.payments, mkSalePayment()] }))}>Add Payment</button>
              </div>
              <div className="sales-payment-list">
                {receiptForm.payments.map((payment, idx) => (
                  <div key={idx} className="sales-payment-row">
                    <div className="sales-line-index">{idx + 1}</div>
                    <label className="sales-field">
                      <span>Amount</span>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={payment.amount} onChange={e => updateReceiptPayment(idx, 'amount', e.target.value)} />
                    </label>
                    <label className="sales-field">
                      <span>Method</span>
                      <AppSelect
                        ariaLabel="Receipt payment method"
                        options={BASIC_PAYMENT_METHOD_OPTIONS}
                        value={payment.method}
                        onChange={value => updateReceiptPayment(idx, 'method', value)}
                      />
                    </label>
                    <label className="sales-field">
                      <span>Reference</span>
                      <input type="text" placeholder="Optional reference" value={payment.reference} onChange={e => updateReceiptPayment(idx, 'reference', e.target.value)} />
                    </label>
                    <label className="sales-field">
                      <span>Notes</span>
                      <input type="text" placeholder="Optional note" value={payment.notes} onChange={e => updateReceiptPayment(idx, 'notes', e.target.value)} />
                    </label>
                    <button
                      type="button"
                      className="sales-line-remove"
                      onClick={() => setReceiptForm(c => {
                        const nextPayments = c.payments.filter((_, i) => i !== idx)
                        return { ...c, payments: nextPayments.length ? nextPayments : [mkSalePayment()] }
                      })}
                      disabled={receiptForm.payments.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            <div className="sales-form-summary">
              <span>Outstanding <strong>{fmt(outstandingBalance)}</strong></span>
              <span>Paid Now <strong>{fmt(paidNow)}</strong></span>
              <span>Balance <strong style={{ color: balanceAfterPayments > 0 ? '#dc2626' : '#16a34a' }}>{fmt(balanceAfterPayments)}</strong></span>
            </div>
            </section>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.receipt}>{submitting.receipt ? 'Saving…' : 'Record Receipt'}</button>
            </div>
            {feedback.receipt ? <p className="sales-form-message">{feedback.receipt}</p> : null}
          </form>
        </ModalShell>
        )
      })()}

      {/* ── BATCH MODAL ── */}
      {activeModal === 'batch' && (() => {
        const expiryPreview = batchForm.productionDate
          ? fmtD(new Date(new Date(batchForm.productionDate).getTime() + 55 * 86400000).toISOString().slice(0, 10))
          : '—'
        const rawMaterialPreviewTotal = batchForm.usages.reduce((sum, item) => {
          const matched = item.rawMaterial ? rawMaterialMap.get(String(item.rawMaterial)) : data.rawMaterials.find(m => String(m.name || '').trim().toLowerCase() === String(item.materialName || '').trim().toLowerCase())
          return sum + (toNumber(matched?.unit_price) * toNumber(item.quantityUsed))
        }, 0)
        const overheadPreviewTotal = toNumber(batchForm.productionWages) + toNumber(batchForm.electricityCost) + toNumber(batchForm.gasCost)
        const batchCostPreview = rawMaterialPreviewTotal + overheadPreviewTotal
        return (
          <ModalShell kicker="Plus Treat Production" title="New Production Batch" onClose={() => setActiveModal('')} cardClassName="sales-modal-card-wide">
            <form className="sales-form sales-form-redesign" onSubmit={handleBatchSubmit}>

              {/* ── Batch header ── */}
              <div className="sales-form-grid sales-form-grid-primary">
                <label className="sales-field">
                  <span>Production Date</span>
                  <input type="date" value={batchForm.productionDate} onChange={e => setBatchForm(c => ({ ...c, productionDate: e.target.value }))} />
                </label>
                <label className="sales-field">
                  <span>Batch Number</span>
                  <input type="text" value="Auto-generated" disabled style={{ opacity: 0.5 }} />
                </label>
                <label className="sales-field">
                  <span>Expiry Date</span>
                  <input type="text" value={expiryPreview} disabled style={{ opacity: 0.5 }} />
                </label>
              </div>

              {/* ── Raw materials used ── */}
              <section className="sales-lines-panel">
                <div className="sales-lines-panel-header">
                  <div><span className="sales-form-eyebrow">Inputs</span><h3>Raw materials used</h3></div>
                  <button type="button" className="account-alert-button account-alert-button-light" onClick={addBatchUsageLine}>Add Extra Material</button>
                </div>
                <div className="purchase-lines-head production-compact-head" style={{ '--col-count': 3, gridTemplateColumns: '2fr 1fr 40px' }}>
                  <span>Material</span><span>Qty Used</span><span></span>
                </div>
                <div className="production-compact-grid">
                  {batchForm.usages.map((item, idx) => {
                    const matched = item.materialName
                      ? data.rawMaterials.find(m => String(m.name || '').trim().toLowerCase() === String(item.materialName).trim().toLowerCase())
                      : null
                    const selectedMaterial = item.rawMaterial ? rawMaterialMap.get(String(item.rawMaterial)) : matched
                    const stockAvailable = selectedMaterial ? (toNumber(selectedMaterial.opening_stock) + toNumber(selectedMaterial.stock_in) - toNumber(selectedMaterial.stock_out)) : null
                    const projectedRemaining = stockAvailable == null ? null : stockAvailable - toNumber(item.quantityUsed)
                    return (
                      <div key={idx} className="purchase-line-row production-compact-row" style={{ gridTemplateColumns: '2fr 1fr 40px' }}>
                        <div className="purchase-rm-cell production-compact-material">
                          {item.isTemplate ? (
                            <div className="sales-field production-compact-primary-field" style={{ width: '100%' }}>
                              <input type="text" value={item.materialName} readOnly />
                              <small style={{ color: matched ? '#16a34a' : '#d97706', fontSize: '0.72rem' }}>
                                {matched ? 'Material found' : 'Material not found'}
                              </small>
                              {matched ? (
                                <small style={{ color: projectedRemaining != null && projectedRemaining < 0 ? '#dc2626' : '#64748b', fontSize: '0.72rem' }}>
                                  {`${fmtQ(stockAvailable)} ${matched.unit || ''} on hand${projectedRemaining != null ? ` · ${fmtQ(projectedRemaining)} after use` : ''}`}
                                </small>
                              ) : null}
                            </div>
                          ) : (
                            <div className="sales-field production-compact-primary-field" style={{ width: '100%' }}>
                              <AppAutocomplete
                                ariaLabel="Raw material"
                                className="app-form-select-compact"
                                options={rawMaterialSelectOptions}
                                placeholder="Select material"
                                searchPlaceholder="Search materials..."
                                value={item.rawMaterial}
                                onChange={value => updateBatchUsage(idx, 'rawMaterial', value)}
                              />
                              {selectedMaterial ? (
                                <small style={{ color: projectedRemaining != null && projectedRemaining < 0 ? '#dc2626' : '#64748b', fontSize: '0.72rem' }}>
                                  {`${fmtQ(stockAvailable)} ${selectedMaterial.unit || ''} on hand · ${fmtQ(projectedRemaining)} after use`}
                                </small>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <label className="sales-field production-compact-qty-field">
                          <input type="number" min="0" step="0.001" placeholder="0.000" value={item.quantityUsed} onChange={e => updateBatchUsage(idx, 'quantityUsed', e.target.value)} />
                        </label>
                        <button
                          type="button"
                          className="sales-line-remove"
                          onClick={() => setBatchForm(c => ({ ...c, usages: c.usages.filter((_, i) => i !== idx) }))}
                          disabled={item.isTemplate}
                          title={item.isTemplate ? 'Template materials cannot be removed' : 'Remove'}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                  <div ref={batchUsageTailRef} />
                </div>
              </section>

              {/* ── Overhead costs ── */}
              <section className="sales-lines-panel">
                <div className="sales-lines-panel-header">
                  <div><span className="sales-form-eyebrow">Overheads</span><h3>Batch costs</h3></div>
                </div>
                <div className="sales-form-grid">
                  <label className="sales-field"><span>Wages</span><input type="number" min="0" step="0.01" placeholder="0.00" value={batchForm.productionWages} onChange={e => setBatchForm(c => ({ ...c, productionWages: e.target.value }))} /></label>
                  <label className="sales-field"><span>Electricity</span><input type="number" min="0" step="0.01" placeholder="0.00" value={batchForm.electricityCost} onChange={e => setBatchForm(c => ({ ...c, electricityCost: e.target.value }))} /></label>
                  <label className="sales-field"><span>Gas</span><input type="number" min="0" step="0.01" placeholder="0.00" value={batchForm.gasCost} onChange={e => setBatchForm(c => ({ ...c, gasCost: e.target.value }))} /></label>
                  <label className="sales-field"><span>Notes</span><input type="text" value={batchForm.notes} onChange={e => setBatchForm(c => ({ ...c, notes: e.target.value }))} /></label>
                </div>
                <div className="sales-form-summary">
                  <span>RM Cost <strong>{fmt(rawMaterialPreviewTotal)}</strong></span>
                  <span>Overheads <strong>{fmt(overheadPreviewTotal)}</strong></span>
                  <span>Total Batch Cost <strong>{fmt(batchCostPreview)}</strong></span>
                </div>
              </section>

              <div className="sales-form-actions">
                <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.batch}>{submitting.batch ? 'Saving…' : 'Save Batch'}</button>
              </div>
              {feedback.batch ? <p className="sales-form-message">{feedback.batch}</p> : null}
            </form>
          </ModalShell>
        )
      })()}

      {/* ── FINISHED GOODS MODAL ── */}
      {activeModal === 'finished_goods' && (() => {
        const selectedBatchRecord = data.productionBatches.find(b => String(b.id) === String(finishedGoodsForm.batch))
        const finishedGoodsPreview = finishedGoodsForm.lines
          .filter(line => toNumber(line.quantity) > 0)
          .map(line => {
            const matchedProduct = data.products.find(product => normalizeSizeKey(product.name) === normalizeSizeKey(line.productSize))
            const quantity = toNumber(line.quantity)
            const unitValue = toNumber(matchedProduct?.unit_price)
            return {
              size: line.productSize,
              quantity,
              unitValue,
              totalValue: quantity * unitValue,
              litres: inferTotalLitres(line.productSize, quantity),
            }
          })
        const finishedGoodsValue = sumBy(finishedGoodsPreview, line => line.totalValue)
        const batchCost = toNumber(selectedBatchRecord?.total_cost)
        const projectedProfit = finishedGoodsValue - batchCost
        return (
        <ModalShell kicker="Plus Treat Production" title="Finished Goods Produced" stat={finishedGoodsValue > 0 ? fmt(finishedGoodsValue) : undefined} onClose={() => setActiveModal('')}>
          <form className="sales-form sales-form-redesign" onSubmit={handleFinishedGoodsSubmit}>
            <div className="sales-form-grid sales-form-grid-primary">
              <label className="sales-field">
                <span>Batch Number</span>
                <AppAutocomplete
                  ariaLabel="Batch number"
                  options={batchSelectOptions}
                  placeholder="Select batch"
                  searchPlaceholder="Search batches..."
                  value={finishedGoodsForm.batch}
                  onChange={value => setFinishedGoodsForm(cur => ({ ...cur, batch: value }))}
                />
              </label>
            </div>
            {selectedBatchRecord ? (
              <div className="sales-form-summary">
                <span>Batch Cost <strong>{fmt(selectedBatchRecord.total_cost)}</strong></span>
                <span>Current RM Cost <strong>{fmt(selectedBatchRecord.total_raw_material_cost)}</strong></span>
                <span>Projected Output Value <strong>{fmt(finishedGoodsValue)}</strong></span>
                <span>Projected Profit <strong style={{ color: projectedProfit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(projectedProfit)}</strong></span>
              </div>
            ) : null}

            {selectedBatchRecord ? (
            <section className="sales-lines-panel">
              <div className="sales-lines-panel-header">
                <div><span className="sales-form-eyebrow">Outputs</span><h3>Goods produced for this batch</h3></div>
              </div>
              <div className="purchase-lines-head production-output-head" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <span>Product Size</span><span>Qty Produced</span>
              </div>
              {finishedGoodsForm.lines.map((line, idx) => (
                <div key={idx} className="purchase-line-row production-output-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <label className="sales-field">
                    <input type="text" value={line.productSize} readOnly />
                  </label>
                  <label className="sales-field">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={line.quantity}
                      onChange={e => updateFinishedGoodsLine(idx, 'quantity', e.target.value)}
                    />
                    {(() => {
                      const matchedProduct = data.products.find(product => normalizeSizeKey(product.name) === normalizeSizeKey(line.productSize))
                      const currentStock = toNumber(matchedProduct?.stock_quantity)
                      const projectedStock = currentStock + toNumber(line.quantity)
                      const lineValue = toNumber(line.quantity) * toNumber(matchedProduct?.unit_price)
                      return (
                        <>
                          <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                            {matchedProduct ? `${fmtQ(currentStock)} on hand · ${fmtQ(projectedStock)} after posting` : `${fmtQ(projectedStock)} after posting`}
                          </small>
                          <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                            {matchedProduct ? `${fmt(matchedProduct.unit_price)} each · ${fmt(lineValue)} total value` : `${fmt(lineValue)} total value`}
                          </small>
                        </>
                      )
                    })()}
                  </label>
                </div>
              ))}
            </section>
            ) : null}

            <div className="sales-form-actions sales-form-actions-split">
              <button type="button" className="account-alert-button account-alert-button-light" onClick={() => setActiveModal('')}>Cancel</button>
              <button type="submit" className="account-alert-button account-alert-button-dark" disabled={submitting.finished_goods}>
                {submitting.finished_goods ? 'Saving…' : 'Save Finished Goods'}
              </button>
            </div>
            {feedback.finished_goods ? <p className="sales-form-message">{feedback.finished_goods}</p> : null}
          </form>
        </ModalShell>
        )
      })()}

      {/* ── PURCHASE MODAL ── */}
      {activeModal === 'purchase' && (() => {
        const linesTotal = purchaseForm.items.reduce((s, it) => s + toNumber(it.quantity) * toNumber(it.pricePerItem), 0)
        const outstanding = linesTotal - toNumber(purchaseForm.paymentAmount)
        return (
          <ModalShell kicker="Plus Treat Supply Desk" title="RM Purchase Entry" stat={`${purchaseForm.items.length} line${purchaseForm.items.length !== 1 ? 's' : ''}`} onClose={() => setActiveModal('')}>
            <form className="sales-form sales-form-redesign" onSubmit={handlePurchaseSubmit}>
              {/* Header fields */}
              <div className="sales-form-grid sales-form-grid-primary">
                <label className="sales-field"><span>Purchase Date</span><input type="date" value={purchaseForm.purchaseDate} onChange={e => setPurchaseForm(c => ({ ...c, purchaseDate: e.target.value }))} /></label>
                <label className="sales-field"><span>Supplier</span>
                  <AppAutocomplete
                    ariaLabel="Supplier"
                    options={supplierSelectOptions}
                    placeholder="Select supplier"
                    searchPlaceholder="Search suppliers..."
                    value={purchaseForm.supplier}
                    onChange={value => setPurchaseForm(c => ({ ...c, supplier: value }))}
                  />
                </label>
                <label className="sales-field"><span>Item Category</span>
                  <AppSelect
                    ariaLabel="Item category"
                    options={itemCategoryOptions}
                    placeholder="Select category"
                    value={purchaseForm.category}
                    onChange={value => setPurchaseForm(c => ({ ...c, category: value }))}
                  />
                </label>
                <div className="category-field-actions">
                  <button type="button" className="account-alert-button account-alert-button-dark" onClick={() => openCategoryModal('purchase')}>Add Category</button>
                </div>
              </div>

              {/* Line items */}
              <section className="sales-lines-panel">
                <div className="sales-lines-panel-header">
                  <div><span className="sales-form-eyebrow">Items</span><h3>Raw materials to purchase</h3></div>
                  <button type="button" className="account-alert-button account-alert-button-light" onClick={addPurchaseItemLine}>Add Item</button>
                </div>
                {/* Column headers — only for existing-RM rows */}
                <div className="purchase-lines-head">
                  <span>Item</span><span>Qty</span><span>Units/Item</span><span>Price/Item</span><span>Line Total</span><span></span>
                </div>
                {purchaseForm.items.map((item, idx) => {
                  const lineTotal = toNumber(item.quantity) * toNumber(item.pricePerItem)
                  return item.isNewRM ? (
                    <div key={idx} className="purchase-line-row-new-rm">
                      <div className="purchase-new-rm-panel">
                        <div className="purchase-new-rm-header">
                          <strong>New Raw Material</strong>
                          <div className="purchase-new-rm-header-actions">
                            <button type="button" className="account-alert-button account-alert-button-light" disabled={!item.newRMName.trim() || submitting['purchase_rm_' + idx]} onClick={() => createNewPurchaseRM(idx)}>
                              {submitting['purchase_rm_' + idx] ? 'Saving…' : 'Save Material'}
                            </button>
                            <button type="button" className="purchase-rm-toggle" onClick={() => updatePurchaseItem(idx, '_toggleRM', null)}>← Use existing</button>
                          </div>
                        </div>
                        <div className="purchase-new-rm-fields">
                          <label className="sales-field"><span>Name *</span><input type="text" placeholder="e.g. Sugar" value={item.newRMName} onChange={e => updatePurchaseItem(idx, 'newRMName', e.target.value)} /></label>
                          <label className="sales-field"><span>Category</span><input list="item-categories" placeholder="e.g. Dairy" value={item.newRMCategory} onChange={e => updatePurchaseItem(idx, 'newRMCategory', e.target.value)} /></label>
                          <label className="sales-field"><span>Unit</span><input type="text" placeholder="kg / litres…" value={item.newRMUnit} onChange={e => updatePurchaseItem(idx, 'newRMUnit', e.target.value)} /></label>
                          <label className="sales-field"><span>Opening Stock</span><input type="number" min="0" step="0.001" value={item.newRMOpeningStock} onChange={e => updatePurchaseItem(idx, 'newRMOpeningStock', e.target.value)} /></label>
                          <label className="sales-field"><span>Reorder Level</span><input type="number" min="0" step="0.001" value={item.newRMReorderLevel} onChange={e => updatePurchaseItem(idx, 'newRMReorderLevel', e.target.value)} /></label>
                        </div>
                      </div>
                      <div className="purchase-new-rm-pricing">
                        <label className="sales-field"><span>Qty</span><input type="number" min="0" step="0.001" placeholder="0" value={item.quantity} onChange={e => updatePurchaseItem(idx, 'quantity', e.target.value)} /></label>
                        <label className="sales-field"><span>Units/Item</span><input type="number" min="0" step="0.001" placeholder="1" value={item.unitPerItem} onChange={e => updatePurchaseItem(idx, 'unitPerItem', e.target.value)} /></label>
                        <label className="sales-field"><span>Price/Item</span><input type="number" min="0" step="0.01" placeholder="0.00" value={item.pricePerItem} onChange={e => updatePurchaseItem(idx, 'pricePerItem', e.target.value)} /></label>
                        <div className="purchase-new-rm-total"><span>Line Total</span><strong>{fmt(lineTotal)}</strong></div>
                        <button type="button" className="sales-line-remove" onClick={() => setPurchaseForm(c => ({ ...c, items: c.items.filter((_, i) => i !== idx) }))} disabled={purchaseForm.items.length === 1}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="purchase-line-row">
                      <div className="purchase-rm-cell">
                        <AppAutocomplete
                          ariaLabel="Purchase raw material"
                          className="app-form-select-compact"
                          options={rawMaterialSelectOptions}
                          placeholder="Select material"
                          searchPlaceholder="Search materials..."
                          value={item.rawMaterial}
                          onChange={value => updatePurchaseItem(idx, 'rawMaterial', value)}
                        />
                        <button type="button" className="purchase-rm-toggle" onClick={() => updatePurchaseItem(idx, '_toggleRM', null)}>+ New material</button>
                      </div>
                      <label className="sales-field"><input type="number" min="0" step="0.001" placeholder="0" value={item.quantity} onChange={e => updatePurchaseItem(idx, 'quantity', e.target.value)} /></label>
                      <label className="sales-field"><input type="number" min="0" step="0.001" placeholder="1" value={item.unitPerItem} onChange={e => updatePurchaseItem(idx, 'unitPerItem', e.target.value)} /></label>
                      <label className="sales-field"><input type="number" min="0" step="0.01" placeholder="0.00" value={item.pricePerItem} onChange={e => updatePurchaseItem(idx, 'pricePerItem', e.target.value)} /></label>
                      <span className="purchase-line-total">{fmt(lineTotal)}</span>
                      <button type="button" className="sales-line-remove" onClick={() => setPurchaseForm(c => ({ ...c, items: c.items.filter((_, i) => i !== idx) }))} disabled={purchaseForm.items.length === 1}>✕</button>
                    </div>
                  )
                })}
                <div ref={purchaseItemsTailRef} />
                <div className="purchase-lines-subtotal">
                  <span>Purchase Total</span><strong>{fmt(linesTotal)}</strong>
                </div>
              </section>

              {/* Initial payment */}
              <section className="sales-lines-panel">
                <div className="sales-lines-panel-header">
                  <div><span className="sales-form-eyebrow">Payment</span><h3>Record initial payment (optional)</h3></div>
                </div>
                <div className="sales-form-grid">
                  <label className="sales-field"><span>Amount Paid</span><input type="number" min="0" step="0.01" placeholder="0.00" value={purchaseForm.paymentAmount} onChange={e => setPurchaseForm(c => ({ ...c, paymentAmount: e.target.value }))} /></label>
                  <label className="sales-field"><span>Payment Method</span>
                    <AppSelect
                      ariaLabel="Purchase payment method"
                      options={BASIC_PAYMENT_METHOD_OPTIONS}
                      value={purchaseForm.paymentMethod}
                      onChange={value => setPurchaseForm(c => ({ ...c, paymentMethod: value }))}
                    />
                  </label>
                  <label className="sales-field"><span>Payment Notes</span><input type="text" value={purchaseForm.paymentNotes} onChange={e => setPurchaseForm(c => ({ ...c, paymentNotes: e.target.value }))} /></label>
                  <div className="purchase-outstanding-badge">
                    <span>Outstanding</span>
                    <strong style={{ color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>{fmt(Math.max(0, outstanding))}</strong>
                  </div>
                </div>
              </section>

              <label className="sales-field"><span>Notes</span><textarea rows="2" value={purchaseForm.notes} onChange={e => setPurchaseForm(c => ({ ...c, notes: e.target.value }))} /></label>
              <div className="sales-form-actions sales-form-actions-split">
                <button type="button" className="account-alert-button account-alert-button-light" onClick={() => setActiveModal('')}>Cancel</button>
                <button type="submit" className="account-alert-button account-alert-button-dark" disabled={submitting.purchase}>{submitting.purchase ? 'Saving…' : 'Save Purchase'}</button>
              </div>
              {feedback.purchase ? <p className="sales-form-message">{feedback.purchase}</p> : null}
            </form>
          </ModalShell>
        )
      })()}

      {/* ── SUPPLIER PAYMENT MODAL ── */}
      {activeModal === 'pur_pay' && (
        <ModalShell kicker="Plus Treat Payables" title="Supplier Payment" stat={`${openPurchases.length} open purchases`} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handlePurPaySubmit}>
            <label className="sales-field"><span>Purchase</span>
              <AppAutocomplete
                ariaLabel="Purchase"
                options={purchaseSelectOptions}
                placeholder="Select purchase"
                searchPlaceholder="Search purchases..."
                value={purPayForm.purchase}
                onChange={value => setPurPayForm(c => ({ ...c, purchase: value }))}
              />
            </label>
            <div className="sales-form-grid">
              <label className="sales-field"><span>Payment Date</span><input type="date" value={purPayForm.paymentDate} onChange={e => setPurPayForm(c => ({ ...c, paymentDate: e.target.value }))} /></label>
              <label className="sales-field"><span>Amount</span><input type="number" min="0" step="0.01" value={purPayForm.amount} onChange={e => setPurPayForm(c => ({ ...c, amount: e.target.value }))} /></label>
              <label className="sales-field"><span>Method</span>
                <AppSelect
                  ariaLabel="Supplier payment method"
                  options={BASIC_PAYMENT_METHOD_OPTIONS}
                  value={purPayForm.paymentMethod}
                  onChange={value => setPurPayForm(c => ({ ...c, paymentMethod: value }))}
                />
              </label>
            </div>
            <label className="sales-field"><span>Notes</span><textarea rows="2" value={purPayForm.notes} onChange={e => setPurPayForm(c => ({ ...c, notes: e.target.value }))} /></label>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.pur_pay}>{submitting.pur_pay ? 'Saving…' : 'Record Payment'}</button>
            </div>
            {feedback.pur_pay ? <p className="sales-form-message">{feedback.pur_pay}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── CUSTOMER MODAL ── */}
      {activeModal === 'customer' && (
        <ModalShell kicker="Plus Treat Relationships" title={customerForm._editId ? 'Edit Customer' : 'New Customer'} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handleCustomerSubmit}>
            <div className="sales-form-grid">
              <label className="sales-field"><span>Name *</span><input type="text" value={customerForm.name} onChange={e => setCustomerForm(c => ({ ...c, name: e.target.value }))} /></label>
              <label className="sales-field"><span>Customer Category</span>
                <AppSelect
                  ariaLabel="Customer category"
                  options={customerCategoryOptions}
                  placeholder="— None —"
                  value={customerForm.customer_category}
                  onChange={value => setCustomerForm(c => ({ ...c, customer_category: value }))}
                />
              </label>
              <label className="sales-field"><span>Pricing Category *</span>
                <AppAutocomplete
                  ariaLabel="Pricing category"
                  options={pricingCategoryOptions}
                  placeholder="— Select —"
                  searchPlaceholder="Search pricing categories..."
                  value={customerForm.pricing_category}
                  onChange={value => setCustomerForm(c => ({ ...c, pricing_category: value }))}
                  isRequired
                />
              </label>
              <label className="sales-field"><span>Phone</span><input type="text" value={customerForm.phone} onChange={e => setCustomerForm(c => ({ ...c, phone: e.target.value }))} /></label>
              <label className="sales-field"><span>Email</span><input type="email" value={customerForm.email} onChange={e => setCustomerForm(c => ({ ...c, email: e.target.value }))} /></label>
              <label className="sales-field"><span>Registration Date</span><input type="date" value={customerForm.date} onChange={e => setCustomerForm(c => ({ ...c, date: e.target.value }))} /></label>
              <label className="sales-field"><span>Previous Balance</span><input type="number" min="0" step="0.01" value={customerForm.previousBalance} onChange={e => setCustomerForm(c => ({ ...c, previousBalance: e.target.value }))} /></label>
              <label className="sales-field"><span>Address</span><input type="text" value={customerForm.address} onChange={e => setCustomerForm(c => ({ ...c, address: e.target.value }))} /></label>
            </div>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.customer}>{submitting.customer ? 'Saving…' : customerForm._editId ? 'Update Customer' : 'Save Customer'}</button>
              {customerForm._editId && <button type="button" className="account-alert-button account-alert-button-danger" onClick={() => handleDelete('customer', () => deleteCustomer(customerForm._editId)).then(() => setActiveModal(''))}>Delete</button>}
            </div>
            {feedback.customer ? <p className="sales-form-message">{feedback.customer}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── SUPPLIER MODAL ── */}
      {activeModal === 'supplier' && (
        <ModalShell kicker="Plus Treat Relationships" title={supplierForm._editId ? 'Edit Supplier' : 'New Supplier'} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handleSupplierSubmit}>
            <div className="sales-form-grid">
              <label className="sales-field"><span>Name *</span><input type="text" value={supplierForm.name} onChange={e => setSupplierForm(c => ({ ...c, name: e.target.value }))} /></label>
              <label className="sales-field"><span>Phone</span><input type="text" value={supplierForm.phone} onChange={e => setSupplierForm(c => ({ ...c, phone: e.target.value }))} /></label>
              <label className="sales-field"><span>Item Category</span>
                <AppSelect
                  ariaLabel="Supplier item category"
                  options={itemCategoryOptions}
                  placeholder="Select category"
                  value={normalizeCategoryValue(supplierForm.item_category)}
                  onChange={value => setSupplierForm(c => ({ ...c, item_category: value }))}
                />
              </label>
              <div className="category-field-actions">
                <button type="button" className="account-alert-button account-alert-button-dark" onClick={() => openCategoryModal('supplier')}>Add Category</button>
              </div>
              <label className="sales-field"><span>Delivery Package</span>
                <AppSelect
                  ariaLabel="Delivery package"
                  options={DELIVERY_PACKAGE_OPTIONS}
                  value={supplierForm.delivery_package ? 'true' : 'false'}
                  onChange={value => setSupplierForm(c => ({ ...c, delivery_package: value === 'true' }))}
                />
              </label>
              <label className="sales-field"><span>Notes</span><input type="text" value={supplierForm.notes} onChange={e => setSupplierForm(c => ({ ...c, notes: e.target.value }))} /></label>
            </div>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.supplier}>{submitting.supplier ? 'Saving…' : supplierForm._editId ? 'Update Supplier' : 'Save Supplier'}</button>
              {supplierForm._editId && <button type="button" className="account-alert-button account-alert-button-danger" onClick={() => handleDelete('supplier', () => deleteSupplier(supplierForm._editId)).then(() => setActiveModal(''))}>Delete</button>}
            </div>
            {feedback.supplier ? <p className="sales-form-message">{feedback.supplier}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── PRODUCT MODAL ── */}
      {activeModal === 'product' && (
        <ModalShell kicker="Plus Treat Inventory" title={productForm._editId ? 'Edit Product' : 'New Product'} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handleProductSubmit}>
            <div className="sales-form-grid">
              <label className="sales-field"><span>Name / Size *</span><input list="product-sizes" value={productForm.name} onChange={e => setProductForm(c => ({ ...c, name: e.target.value }))} placeholder="e.g. 200ml" /></label>
              <label className="sales-field"><span>Unit Price</span><input type="number" min="0" step="0.01" value={productForm.unit_price} onChange={e => setProductForm(c => ({ ...c, unit_price: e.target.value }))} /></label>
              <label className="sales-field"><span>Stock Qty</span><input type="number" min="0" step="0.01" value={productForm.stock_quantity} onChange={e => setProductForm(c => ({ ...c, stock_quantity: e.target.value }))} /></label>
              <label className="sales-field"><span>Production Level</span><input type="number" min="0" step="1" value={productForm.production_level} onChange={e => setProductForm(c => ({ ...c, production_level: e.target.value }))} placeholder="0 = no threshold" /></label>
              <label className="sales-field"><span>Description</span><input type="text" value={productForm.description} onChange={e => setProductForm(c => ({ ...c, description: e.target.value }))} /></label>
            </div>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.product}>{submitting.product ? 'Saving…' : productForm._editId ? 'Update Product' : 'Save Product'}</button>
              {productForm._editId && <button type="button" className="account-alert-button account-alert-button-danger" onClick={() => handleDelete('product', () => deleteProduct(productForm._editId)).then(() => setActiveModal(''))}>Delete</button>}
            </div>
            {feedback.product ? <p className="sales-form-message">{feedback.product}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── RAW MATERIAL MODAL ── */}
      {activeModal === 'raw_mat' && (
        <ModalShell kicker="Plus Treat Stock" title={rawMatForm._editId ? 'Edit Raw Material' : 'New Raw Material'} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handleRawMatSubmit}>
            <div className="sales-form-grid">
              <label className="sales-field">
                <span>Name * (linked to Production template)</span>
                <input list="raw-material-template-names" value={rawMatForm.name} onChange={e => updateRawMatName(e.target.value)} placeholder="Pick from template or type custom" />
              </label>
              <label className="sales-field"><span>Category</span>
                <AppSelect
                  ariaLabel="Raw material category"
                  options={itemCategoryOptions}
                  placeholder="Select category"
                  value={normalizeCategoryValue(rawMatForm.category)}
                  onChange={value => setRawMatForm(c => ({ ...c, category: value }))}
                />
              </label>
              <div className="category-field-actions">
                <button type="button" className="account-alert-button account-alert-button-dark" onClick={() => openCategoryModal('raw_mat')}>Add Category</button>
              </div>
              <label className="sales-field"><span>Supplier</span>
                <AppAutocomplete
                  ariaLabel="Raw material supplier"
                  options={supplierSelectOptions}
                  placeholder="— None —"
                  searchPlaceholder="Search suppliers..."
                  value={rawMatForm.supplier}
                  onChange={value => setRawMatForm(c => ({ ...c, supplier: value }))}
                />
              </label>
              <label className="sales-field"><span>Unit</span><input type="text" placeholder="kg / litres / Pcs" value={rawMatForm.unit} onChange={e => setRawMatForm(c => ({ ...c, unit: e.target.value }))} /></label>
              <label className="sales-field"><span>Unit Per Item</span><input type="number" min="0" step="0.001" value={rawMatForm.unit_per_item} onChange={e => setRawMatForm(c => ({ ...c, unit_per_item: e.target.value }))} /></label>
              <label className="sales-field"><span>Item Price</span><input type="number" min="0" step="0.01" value={rawMatForm.item_price} onChange={e => setRawMatForm(c => ({ ...c, item_price: e.target.value }))} /></label>
              <label className="sales-field"><span>Unit Price</span><input type="number" min="0" step="0.0001" value={rawMatForm.unit_price} onChange={e => setRawMatForm(c => ({ ...c, unit_price: e.target.value }))} /></label>
              <label className="sales-field"><span>Opening Stock</span><input type="number" min="0" step="0.001" value={rawMatForm.opening_stock} onChange={e => setRawMatForm(c => ({ ...c, opening_stock: e.target.value }))} /></label>
              <label className="sales-field"><span>Reorder Level</span><input type="number" min="0" step="0.001" value={rawMatForm.reorder_level} onChange={e => setRawMatForm(c => ({ ...c, reorder_level: e.target.value }))} /></label>
            </div>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.raw_mat}>{submitting.raw_mat ? 'Saving…' : rawMatForm._editId ? 'Update Material' : 'Save Material'}</button>
              {rawMatForm._editId && <button type="button" className="account-alert-button account-alert-button-danger" onClick={() => handleDelete('raw material', () => deleteRawMaterial(rawMatForm._editId)).then(() => setActiveModal(''))}>Delete</button>}
            </div>
            {feedback.raw_mat ? <p className="sales-form-message">{feedback.raw_mat}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── ACCOUNT MODAL ── */}
      {activeModal === 'account' && (
        <ModalShell kicker="Plus Treat Accounts" title={accountForm._editId ? 'Edit Account Entry' : 'Accounts Entry'} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handleAccountSubmit}>
            <div className="sales-form-grid">
              <label className="sales-field"><span>Transaction Date *</span><input type="date" value={accountForm.transaction_date} onChange={e => setAccountForm(c => ({ ...c, transaction_date: e.target.value }))} /></label>
              <label className="sales-field"><span>Trans Type *</span>
                <AppSelect
                  ariaLabel="Transaction type"
                  options={accountTypeOptions}
                  value={accountForm.entry_type}
                  onChange={value =>
                    setAccountForm(c => {
                      const nextType = value
                      const nextOptions = ACCOUNT_SUB_ACCOUNTS_BY_TYPE[nextType] || []
                      const keepCategory = nextOptions.includes(c.category)
                      return { ...c, entry_type: nextType, category: keepCategory ? c.category : '' }
                    })
                  }
                  isRequired
                />
              </label>
              <label className="sales-field"><span>Sub Accounts *</span>
                <AppAutocomplete
                  ariaLabel="Sub account"
                  options={accountSubAccountSelectOptions}
                  placeholder="— Select sub account —"
                  searchPlaceholder="Search sub accounts..."
                  value={accountForm.category}
                  onChange={value => setAccountForm(c => ({ ...c, category: value }))}
                  isRequired
                />
              </label>
              <label className="sales-field"><span>Transaction Description *</span><input type="text" value={accountForm.description} onChange={e => setAccountForm(c => ({ ...c, description: e.target.value }))} /></label>
              <label className="sales-field"><span>Amount *</span><input type="number" min="0" step="0.01" value={accountForm.amount} onChange={e => setAccountForm(c => ({ ...c, amount: e.target.value }))} /></label>
              <label className="sales-field"><span>Payment / Receipt Account *</span>
                <AppAutocomplete
                  ariaLabel="Payment or receipt account"
                  options={accountPaymentOptions}
                  placeholder="— Select account —"
                  searchPlaceholder="Search accounts..."
                  value={accountForm.payment_method}
                  onChange={value => setAccountForm(c => ({ ...c, payment_method: value }))}
                  isRequired
                />
              </label>
              <label className="sales-field"><span>Comments</span><input type="text" value={accountForm.comments} onChange={e => setAccountForm(c => ({ ...c, comments: e.target.value }))} /></label>
            </div>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.account}>{submitting.account ? 'Saving…' : accountForm._editId ? 'Update Entry' : 'Save Entry'}</button>
              {accountForm._editId && <button type="button" className="account-alert-button account-alert-button-danger" onClick={() => handleDelete('account entry', () => deleteAccountTransaction(accountForm._editId)).then(() => setActiveModal(''))}>Delete</button>}
            </div>
            {feedback.account ? <p className="sales-form-message">{feedback.account}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── PRICING MODAL ── */}
      {activeModal === 'pricing' && (
        <ModalShell kicker="Plus Treat Pricing" title={pricingForm._editId ? 'Edit Pricing Rule' : 'New Pricing Rule'} onClose={() => setActiveModal('')}>
          <form className="sales-form" onSubmit={handlePricingSubmit}>
            <div className="sales-form-grid">
              <label className="sales-field"><span>Finished Good Size</span>
                <AppAutocomplete
                  ariaLabel="Finished good size"
                  options={productSelectOptions}
                  placeholder="— Select size —"
                  searchPlaceholder="Search finished goods..."
                  value={pricingForm.product}
                  onChange={productId => {
                    const product = productMap.get(String(productId))
                    setPricingForm(c => ({ ...c, product: productId, size: product?.name || '' }))
                  }}
                />
              </label>
              <label className="sales-field"><span>Size (Linked)</span><input type="text" value={pricingForm.size} readOnly /></label>
              <label className="sales-field"><span>Pricing Category</span>
                <AppAutocomplete
                  ariaLabel="Pricing category"
                  options={pricingCategoryOptions}
                  placeholder="— Select —"
                  searchPlaceholder="Search pricing categories..."
                  value={pricingForm.pricing_category}
                  onChange={value => setPricingForm(c => ({ ...c, pricing_category: value }))}
                />
              </label>
              <label className="sales-field"><span>Price</span><input type="number" min="0" step="0.01" value={pricingForm.price} onChange={e => setPricingForm(c => ({ ...c, price: e.target.value }))} /></label>
            </div>
            <div className="sales-form-actions">
              <button type="submit" className="account-alert-button account-alert-button-light" disabled={submitting.pricing}>{submitting.pricing ? 'Saving…' : pricingForm._editId ? 'Update Rule' : 'Save Rule'}</button>
              {pricingForm._editId && <button type="button" className="account-alert-button account-alert-button-danger" onClick={() => handleDelete('pricing rule', () => deletePricingRule(pricingForm._editId)).then(() => setActiveModal(''))}>Delete</button>}
            </div>
            {feedback.pricing ? <p className="sales-form-message">{feedback.pricing}</p> : null}
          </form>
        </ModalShell>
      )}

      {/* ── RECEIPT DETAIL MODAL ── */}
      {selectedReceipt && (() => {
        const inv = data.invoices.find(i => String(i.id) === String(selectedReceipt.invoice))
        return (
          <ModalShell
            kicker="Receipt"
            title={`Receipt #${selectedReceipt.id}`}
            subtitle={selectedReceipt.customer_name || (inv ? inv.customer_name : '—')}
            stat={fmt(selectedReceipt.amount)}
            onClose={() => setSelectedReceipt(null)}
          >
            <div className="detail-receipt-grid">
              <div className="detail-receipt-field">
                <span>Date</span>
                <strong>{fmtD(selectedReceipt.payment_date)}</strong>
              </div>
              <div className="detail-receipt-field">
                <span>Invoice</span>
                <strong>{fmtInv(selectedReceipt.invoice)}</strong>
              </div>
              <div className="detail-receipt-field">
                <span>Customer</span>
                <strong>{selectedReceipt.customer_name || (inv ? inv.customer_name : '—')}</strong>
              </div>
              <div className="detail-receipt-field">
                <span>Amount Paid</span>
                <strong>{fmt(selectedReceipt.amount)}</strong>
              </div>
              <div className="detail-receipt-field">
                <span>Method</span>
                <strong>{fmtStatus(selectedReceipt.method)}</strong>
              </div>
              <div className="detail-receipt-field">
                <span>Reference</span>
                <strong>{selectedReceipt.reference || '—'}</strong>
              </div>
              {selectedReceipt.notes && (
                <div className="detail-receipt-field detail-receipt-field-full">
                  <span>Notes</span>
                  <strong>{selectedReceipt.notes}</strong>
                </div>
              )}
            </div>
            {selectedReceipt.receipt_download_url && (
              <div className="sales-form-actions" style={{ marginTop: "12px" }}>
                <a
                  href={selectedReceipt.receipt_download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="account-alert-button account-alert-button-dark"
                >
                  Download Receipt PDF
                </a>
              </div>
            )}
            {inv && (
              <div className="detail-modal-section" style={{ marginTop: '20px' }}>
                <h3>Invoice Summary</h3>
                <div className="detail-modal-totals">
                  <span>Invoice Total: <strong>{fmt(inv.total_amount)}</strong></span>
                  <span>Previously Paid: <strong>{fmt(toNumber(inv.total_amount) - toNumber(inv.outstanding_balance))}</strong></span>
                  <span>Remaining Balance: <strong style={{ color: toNumber(inv.outstanding_balance) > 0 ? '#dc2626' : '#16a34a' }}>{fmt(inv.outstanding_balance)}</strong></span>
                </div>
              </div>
            )}
          </ModalShell>
        )
      })()}

      {/* ── INVOICE DETAIL MODAL ── */}
      {selectedInvoice && (() => {
        const inv = selectedInvoice
        const totalPaid = toNumber(inv.total_amount) - toNumber(inv.outstanding_balance)
        const outstanding = toNumber(inv.outstanding_balance)
        return (
          <ModalShell
            kicker="Invoice Detail"
            title={fmtInv(inv.id)}
            subtitle={`${inv.customer_name} · ${fmtD(inv.invoice_date)}`}
            stat={fmtStatus(inv.status)}
            onClose={() => setSelectedInvoice(null)}
          >
            {/* Header info grid */}
            <div className="detail-purchase-header">
              <div className="detail-purchase-field">
                <span>Invoice Date</span>
                <strong>{fmtD(inv.invoice_date)}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Customer</span>
                <strong>{inv.customer_name || '—'}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Salesperson</span>
                <strong>{inv.staff_name || '—'}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Status</span>
                <strong style={{ color: inv.status === 'paid' ? '#16a34a' : inv.status === 'partially_paid' ? '#d97706' : inv.status === 'cancelled' ? '#6b7280' : '#dc2626' }}>{fmtStatus(inv.status)}</strong>
              </div>
              {toNumber(inv.previous_balance) !== 0 && (
                <div className="detail-purchase-field">
                  <span>Previous Balance</span>
                  <strong>{fmt(inv.previous_balance)}</strong>
                </div>
              )}
              {toNumber(inv.discount_amount) > 0 && (
                <div className="detail-purchase-field">
                  <span>Discount</span>
                  <strong>{fmt(inv.discount_amount)}</strong>
                </div>
              )}
              {inv.notes && (
                <div className="detail-purchase-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Notes</span>
                  <strong>{inv.notes}</strong>
                </div>
              )}
            </div>

            {/* Financial totals */}
            <div className="detail-modal-totals">
              <span>Subtotal: <strong>{fmt(inv.subtotal)}</strong></span>
              {toNumber(inv.discount_amount) > 0 && <span>Discount: <strong>−{fmt(inv.discount_amount)}</strong></span>}
              <span>Invoice Total: <strong>{fmt(inv.total_amount)}</strong></span>
              {toNumber(inv.previous_balance) !== 0 && <span>Previous Balance: <strong>{fmt(inv.previous_balance)}</strong></span>}
              <span>Total Paid: <strong>{fmt(totalPaid)}</strong></span>
              <span>Outstanding: <strong style={{ color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>{fmt(outstanding)}</strong></span>
            </div>

            {/* Line items */}
            <div className="detail-modal-section">
              <h3>Line Items ({(inv.lines || []).length})</h3>
              {(inv.lines || []).length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 1fr 1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Product Size</span><span>Pricing Category</span><span>Qty</span><span>Unit Price</span><span>Line Total</span>
                  </div>
                  {(inv.lines || []).map(line => (
                    <div key={line.id} className="sales-list-row workspace-table-row">
                      <span>{line.product_size || '—'}</span>
                      <span>{line.pricing_category || '—'}</span>
                      <span>{fmtQ(line.quantity)}</span>
                      <span>{fmt(line.unit_price)}</span>
                      <span>{fmt(line.line_total)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No line items.</p>}
            </div>

            {/* Payments */}
            <div className="detail-modal-section">
              <h3>Payments ({(inv.payments || []).length})</h3>
              {(inv.payments || []).length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 70px 1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>ID</span><span>Method</span><span>Reference</span><span>Amount</span>
                  </div>
                  {(inv.payments || []).map(p => (
                    <div key={p.id} className="sales-list-row workspace-table-row">
                      <span>{fmtD(p.payment_date)}</span>
                      <span>#{p.id}</span>
                      <span>{fmtStatus(p.method)}</span>
                      <span>{p.reference || '—'}</span>
                      <span>{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No payments recorded yet.</p>}
            </div>
          </ModalShell>
        )
      })()}

      {/* ── BATCH DETAIL MODAL ── */}
      {selectedBatch && (
        <ModalShell
          kicker="Batch Detail"
          title={selectedBatch.batch_number || `Batch #${selectedBatch.id}`}
          subtitle={`Produced: ${fmtD(selectedBatch.production_date)} · Expires: ${fmtD(selectedBatch.expiry_date)}`}
          stat={`Profit: ${fmt(selectedBatch.profit)}`}
          onClose={() => setSelectedBatch(null)}
        >
          {/* Batch info grid */}
          <div className="detail-purchase-header">
            <div className="detail-purchase-field">
              <span>Batch Number</span>
              <strong>{selectedBatch.batch_number || `#${selectedBatch.id}`}</strong>
            </div>
            <div className="detail-purchase-field">
              <span>Production Date</span>
              <strong>{fmtD(selectedBatch.production_date)}</strong>
            </div>
            <div className="detail-purchase-field">
              <span>Expiry Date</span>
              <strong>{fmtD(selectedBatch.expiry_date)}</strong>
            </div>
            <div className="detail-purchase-field">
              <span>Total Outputs</span>
              <strong>{(selectedBatch.outputs || []).length} line{(selectedBatch.outputs || []).length !== 1 ? 's' : ''}</strong>
            </div>
            {selectedBatch.notes && (
              <div className="detail-purchase-field" style={{ gridColumn: '1 / -1' }}>
                <span>Notes</span>
                <strong>{selectedBatch.notes}</strong>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="detail-modal-totals">
            <span>RM Cost: <strong>{fmt(selectedBatch.total_raw_material_cost)}</strong></span>
            <span>Wages: <strong>{fmt(selectedBatch.production_wages)}</strong></span>
            <span>Electricity: <strong>{fmt(selectedBatch.electricity_cost)}</strong></span>
            <span>Gas: <strong>{fmt(selectedBatch.gas_cost)}</strong></span>
            <span>Total Cost: <strong>{fmt(selectedBatch.total_cost)}</strong></span>
            <span>Output Value: <strong>{fmt(selectedBatch.total_production_value)}</strong></span>
            <span>Profit: <strong style={{ color: toNumber(selectedBatch.profit) >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(selectedBatch.profit)}</strong></span>
          </div>

          {/* Raw material usage */}
          <div className="detail-modal-section">
            <h3>Raw Materials Used ({(selectedBatch.material_usages || []).length})</h3>
            {(selectedBatch.material_usages || []).length ? (
              <div className="sales-list-table workspace-table" style={{ '--table-cols': '2fr 1fr 1fr' }}>
                <div className="sales-list-head workspace-table-head">
                  <span>Material</span><span>Qty Used</span><span>Amount</span>
                </div>
                {(selectedBatch.material_usages || []).map(u => (
                  <div key={u.id} className="sales-list-row workspace-table-row">
                    <span>{u.raw_material_name || '—'}</span>
                    <span>{fmtQ(u.quantity_used)}</span>
                    <span>{fmt(u.amount)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="workspace-empty">No material usage recorded.</p>}
          </div>

          {/* Finished goods produced */}
          <div className="detail-modal-section">
            <h3>Finished Goods Produced ({(selectedBatch.outputs || []).length})</h3>
            {(selectedBatch.outputs || []).length ? (
              <div className="sales-list-table workspace-table" style={{ '--table-cols': '2fr 1fr 1fr 1fr 1fr' }}>
                <div className="sales-list-head workspace-table-head">
                  <span>Product</span><span>Size</span><span>Qty Produced</span><span>Unit Value</span><span>Total Value</span>
                </div>
                {(selectedBatch.outputs || []).map(o => (
                  <div key={o.id} className="sales-list-row workspace-table-row">
                    <span>{o.product_name || '—'}</span>
                    <span>{o.product_size}</span>
                    <span>{fmtQ(o.quantity)}</span>
                    <span>{fmt(o.unit_cost)}</span>
                    <span>{fmt(o.amount)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="workspace-empty">No outputs recorded.</p>}
          </div>
        </ModalShell>
      )}

      {/* ── RAW MATERIAL DETAIL MODAL ── */}
      {selectedRawMaterial && (() => {
        const m = selectedRawMaterial
        const openingStock  = toNumber(m.opening_stock)
        const stockIn       = toNumber(m.stock_in)
        const stockOut      = toNumber(m.stock_out)
        const available     = openingStock + stockIn - stockOut
        const reorderLevel  = toNumber(m.reorder_level)
        const isOut         = available <= 0
        const isLow         = reorderLevel > 0 && available <= reorderLevel
        const stockColor    = isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a'
        const stockLabel    = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'

        // Pull all purchase line items for this material
        const rmPurchaseLines = data.purchases.flatMap(p =>
          (p.items || [])
            .filter(it => String(it.raw_material) === String(m.id))
            .map(it => ({ ...it, purchase_date: p.purchase_date, purchase_id: p.id, supplier_name: p.supplier_name }))
        ).sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))

        // Pull all production usages for this material
        const rmUsages = data.productionBatches.flatMap(b =>
          (b.material_usages || [])
            .filter(u => String(u.raw_material) === String(m.id))
            .map(u => ({ ...u, production_date: b.production_date, batch_id: b.id }))
        ).sort((a, b) => new Date(b.production_date) - new Date(a.production_date))

        const totalPurchased = rmPurchaseLines.reduce((s, it) => s + toNumber(it.total_units || toNumber(it.quantity) * toNumber(it.unit_per_item || 1)), 0)
        const totalUsed      = rmUsages.reduce((s, u) => s + toNumber(u.quantity_used), 0)
        const totalSpent     = rmPurchaseLines.reduce((s, it) => s + toNumber(it.line_total), 0)

        const supplierName = data.suppliers.find(s => String(s.id) === String(m.supplier))?.name || m.supplier_name || '—'

        return (
          <ModalShell
            kicker="Raw Material"
            title={m.name}
            subtitle={[m.category, supplierName !== '—' ? `Supplier: ${supplierName}` : null].filter(Boolean).join(' · ') || 'No category'}
            stat={<span style={{ color: stockColor }}>{stockLabel}</span>}
            onClose={() => setSelectedRawMaterial(null)}
          >
            {/* Stock summary */}
            <div className="rm-stock-grid">
              <div className="rm-stock-card">
                <span>Opening Stock</span>
                <strong>{fmtQ(openingStock)} {m.unit || ''}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Total Stock In</span>
                <strong>{fmtQ(stockIn)} {m.unit || ''}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Total Stock Out</span>
                <strong>{fmtQ(stockOut)} {m.unit || ''}</strong>
              </div>
              <div className="rm-stock-card rm-stock-card-highlight" style={{ borderColor: stockColor }}>
                <span>Available</span>
                <strong style={{ color: stockColor }}>{fmtQ(available)} {m.unit || ''}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Reorder Level</span>
                <strong>{fmtQ(reorderLevel)} {m.unit || ''}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Unit / Item</span>
                <strong>{fmtQ(m.unit_per_item)} {m.unit || ''}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Price / Item</span>
                <strong>{fmt(m.item_price)}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Price / Unit</span>
                <strong>{fmt(m.unit_price)}</strong>
              </div>
            </div>

            {/* Totals bar */}
            <div className="detail-modal-totals" style={{ marginTop: '4px' }}>
              <span>Total Purchased: <strong>{fmtQ(totalPurchased)} {m.unit || ''}</strong></span>
              <span>Total Used: <strong>{fmtQ(totalUsed)} {m.unit || ''}</strong></span>
              <span>Total Spent: <strong>{fmt(totalSpent)}</strong></span>
            </div>

            {/* Purchase history */}
            <div className="detail-modal-section">
              <h3>Purchase History ({rmPurchaseLines.length})</h3>
              {rmPurchaseLines.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 80px 1fr 80px 80px 100px 100px' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>Purchase</span><span>Supplier</span><span>Qty</span><span>Units/Item</span><span>Price/Item</span><span>Line Total</span>
                  </div>
                  {rmPurchaseLines.map((it, i) => (
                    <div key={i} className="sales-list-row workspace-table-row">
                      <span>{fmtD(it.purchase_date)}</span>
                      <span>#{it.purchase_id}</span>
                      <span>{it.supplier_name || '—'}</span>
                      <span>{fmtQ(it.quantity)}</span>
                      <span>{fmtQ(it.unit_per_item)}</span>
                      <span>{fmt(it.price_per_item)}</span>
                      <span>{fmt(it.line_total)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No purchases recorded for this material.</p>}
            </div>

            {/* Production usage history */}
            <div className="detail-modal-section">
              <h3>Production Usage ({rmUsages.length})</h3>
              {rmUsages.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 80px 1fr 100px' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>Batch</span><span>Qty Used</span><span>Amount</span>
                  </div>
                  {rmUsages.map((u, i) => (
                    <div key={i} className="sales-list-row workspace-table-row">
                      <span>{fmtD(u.production_date)}</span>
                      <span>#{u.batch_id}</span>
                      <span>{fmtQ(u.quantity_used)} {m.unit || ''}</span>
                      <span>{fmt(u.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No production usage recorded yet.</p>}
            </div>
          </ModalShell>
        )
      })()}

      {/* ── PURCHASE DETAIL MODAL ── */}
      {selectedPurchase && (() => {
        const p = selectedPurchase
        const outstanding = toNumber(p.outstanding_amount)
        return (
          <ModalShell
            kicker="Purchase Detail"
            title={`Purchase #${p.id}`}
            subtitle={`${p.supplier_name || 'Supplier'} · ${fmtStatus(p.category || 'other')}`}
            stat={fmtStatus(p.status)}
            onClose={() => setSelectedPurchase(null)}
          >
            {/* Header info */}
            <div className="detail-purchase-header">
              <div className="detail-purchase-field">
                <span>Date</span>
                <strong>{fmtD(p.purchase_date)}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Supplier</span>
                <strong>{p.supplier_name || '—'}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Category</span>
                <strong>{fmtStatus(p.category || 'other')}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Status</span>
                <strong>{fmtStatus(p.status)}</strong>
              </div>
              {p.notes && (
                <div className="detail-purchase-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Notes</span>
                  <strong>{p.notes}</strong>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="detail-modal-section">
              <h3>Items ({(p.items || []).length})</h3>
              <div className="sales-list-table workspace-table" style={{ '--table-cols': '2fr 80px 100px 100px' }}>
                <div className="sales-list-head workspace-table-head">
                  <span>Item</span><span>Qty</span><span>Price/Item</span><span>Line Total</span>
                </div>
                {(p.items || []).length
                  ? (p.items || []).map(item => (
                      <div key={item.id} className="sales-list-row workspace-table-row">
                        <span>{item.item_name || item.raw_material_name || '—'}</span>
                        <span>{fmtQ(item.quantity)}</span>
                        <span>{fmt(item.price_per_item)}</span>
                        <span>{fmt(item.line_total)}</span>
                      </div>
                    ))
                  : <div className="workspace-empty-row">No items.</div>}
              </div>
            </div>

            {/* Payments table */}
            <div className="detail-modal-section">
              <h3>Payments ({(p.payments || []).length})</h3>
              <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 1fr 1fr 1fr 1fr' }}>
                <div className="sales-list-head workspace-table-head">
                  <span>Date</span><span>ID</span><span>Method</span><span>Amount</span><span>Notes</span>
                </div>
                {(p.payments || []).length
                  ? (p.payments || []).map(pay => (
                      <div key={pay.id} className="sales-list-row workspace-table-row">
                        <span>{fmtD(pay.payment_date)}</span>
                        <span>#{pay.id}</span>
                        <span>{fmtStatus(pay.payment_method)}</span>
                        <span>{fmt(pay.amount)}</span>
                        <span>{pay.notes || '—'}</span>
                      </div>
                    ))
                  : <div className="workspace-empty-row">No payments recorded.</div>}
              </div>
            </div>

            {/* Totals */}
            <div className="detail-modal-totals">
              <span>Total Amount: <strong>{fmt(p.total_amount)}</strong></span>
              <span>Total Paid: <strong>{fmt(p.total_paid)}</strong></span>
              <span>Outstanding: <strong style={{ color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>{fmt(outstanding)}</strong></span>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── SUPPLIER DETAIL MODAL ── */}
      {selectedSupplier && (() => {
        const s = selectedSupplier
        const supplierPurchases = data.purchases.filter(p => String(p.supplier) === String(s.id))
          .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
        const allPayments = supplierPurchases.flatMap(p =>
          (p.payments || []).map(pay => ({ ...pay, purchase_id: p.id, purchase_date: p.purchase_date }))
        ).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
        const totalAmount  = sumBy(supplierPurchases, p => p.total_amount)
        const totalPaid    = sumBy(supplierPurchases, p => p.total_paid)
        const outstanding  = sumBy(supplierPurchases, p => p.outstanding_amount)
        // Raw materials linked to this supplier
        const supplierMaterials = data.rawMaterials.filter(m => String(m.supplier) === String(s.id))
        return (
          <ModalShell
            kicker="Supplier Profile"
            title={s.name}
            subtitle={[s.item_category, s.phone].filter(Boolean).join(' · ') || 'No details'}
            stat={outstanding > 0 ? `${fmt(outstanding)} outstanding` : 'Fully paid'}
            onClose={() => setSelectedSupplier(null)}
          >
            {/* Info grid */}
            <div className="detail-purchase-header">
              <div className="detail-purchase-field">
                <span>Phone</span>
                <strong>{s.phone || '—'}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Item Category</span>
                <strong>{s.item_category || '—'}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Delivery Package</span>
                <strong>{s.delivery_package ? 'Yes' : 'No'}</strong>
              </div>
              <div className="detail-purchase-field">
                <span>Purchases</span>
                <strong>{supplierPurchases.length}</strong>
              </div>
              {s.notes && (
                <div className="detail-purchase-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Notes</span>
                  <strong>{s.notes}</strong>
                </div>
              )}
            </div>

            {/* Financial totals */}
            <div className="detail-modal-totals">
              <span>Total Purchased: <strong>{fmt(totalAmount)}</strong></span>
              <span>Total Paid: <strong>{fmt(totalPaid)}</strong></span>
              <span>Outstanding: <strong style={{ color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>{fmt(outstanding)}</strong></span>
            </div>

            {/* Raw materials from this supplier */}
            {supplierMaterials.length > 0 && (
              <div className="detail-modal-section">
                <h3>Raw Materials Supplied ({supplierMaterials.length})</h3>
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Material</span><span>Category</span><span>Unit</span><span>Available</span><span>Price/Item</span><span>Price/Unit</span>
                  </div>
                  {supplierMaterials.map(m => {
                    const available = toNumber(m.opening_stock) + toNumber(m.stock_in) - toNumber(m.stock_out)
                    const reorder   = toNumber(m.reorder_level)
                    const isLow     = reorder > 0 && available <= reorder
                    return (
                      <div key={m.id} className="sales-list-row workspace-table-row">
                        <span>{m.name}</span>
                        <span>{m.category || '—'}</span>
                        <span>{m.unit || '—'}</span>
                        <span style={{ color: available <= 0 ? '#dc2626' : isLow ? '#d97706' : '#16a34a' }}>{fmtQ(available)} {m.unit || ''}</span>
                        <span>{fmt(m.item_price)}</span>
                        <span>{fmt(m.unit_price)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Purchase history */}
            <div className="detail-modal-section">
              <h3>Purchase History ({supplierPurchases.length})</h3>
              {supplierPurchases.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 70px 1fr 1fr 1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>Ref</span><span>Category</span><span>Items</span><span>Total</span><span>Paid</span><span>Status</span>
                  </div>
                  {supplierPurchases.map(p => (
                    <div key={p.id} className="sales-list-row workspace-table-row">
                      <span>{fmtD(p.purchase_date)}</span>
                      <span>#{p.id}</span>
                      <span>{p.category || '—'}</span>
                      <span>{(p.items || []).length} item{(p.items || []).length !== 1 ? 's' : ''}</span>
                      <span>{fmt(p.total_amount)}</span>
                      <span>{fmt(p.total_paid)}</span>
                      <span style={{ color: p.status === 'paid' ? '#16a34a' : p.status === 'partially_paid' ? '#d97706' : '#dc2626' }}>{fmtStatus(p.status)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No purchases recorded for this supplier.</p>}
            </div>

            {/* Payment history */}
            <div className="detail-modal-section">
              <h3>Payment History ({allPayments.length})</h3>
              {allPayments.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 70px 1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>Purchase</span><span>Method</span><span>Amount</span><span>Notes</span>
                  </div>
                  {allPayments.map((pay, i) => (
                    <div key={i} className="sales-list-row workspace-table-row">
                      <span>{fmtD(pay.payment_date)}</span>
                      <span>#{pay.purchase_id}</span>
                      <span>{fmtStatus(pay.payment_method)}</span>
                      <span>{fmt(pay.amount)}</span>
                      <span>{pay.notes || '—'}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No payments recorded yet.</p>}
            </div>
          </ModalShell>
        )
      })()}

      {/* ── INVENTORY ITEM DETAIL MODAL ── */}
      {selectedInventoryItem && (() => {
        const item = selectedInventoryItem
        const stockColor = item.available <= 0 ? '#dc2626' : item.prodRequired ? '#d97706' : '#16a34a'
        const stockLabel = item.available <= 0 ? 'Out of Stock' : item.prodRequired ? 'Produce Now' : 'Adequate'
        return (
          <ModalShell
            kicker="Finished Inventory"
            title={`${item.size} — ${item.id}`}
            subtitle={`Unit: ${item.unit} · Balance: ${fmt(item.stockBalance)}`}
            stat={<span style={{ color: stockColor }}>{stockLabel}</span>}
            onClose={() => setSelectedInventoryItem(null)}
          >
            {/* Stock summary grid */}
            <div className="rm-stock-grid">
              <div className="rm-stock-card">
                <span>Opening Stock</span>
                <strong>{fmtQ(item.opening)} {item.unit}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Stock In (Produced)</span>
                <strong>{fmtQ(item.stockIn)} {item.unit}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Stock Out (Sold)</span>
                <strong>{fmtQ(item.stockOut)} {item.unit}</strong>
              </div>
              <div className="rm-stock-card rm-stock-card-highlight" style={{ borderColor: stockColor }}>
                <span>Stock Available</span>
                <strong style={{ color: stockColor }}>{fmtQ(item.available)} {item.unit}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Stock Balance (Value)</span>
                <strong>{fmt(item.stockBalance)}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Production Level</span>
                <strong>{fmtQ(item.productionLevel)} {item.unit}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Prod Required</span>
                <strong style={{ color: item.prodRequired ? '#dc2626' : '#16a34a' }}>{item.prodRequired ? 'Yes' : 'No'}</strong>
              </div>
              <div className="rm-stock-card">
                <span>Price (min)</span>
                <strong>{fmt(item.price)}</strong>
              </div>
            </div>

            {/* Production history */}
            <div className="detail-modal-section">
              <h3>Production History ({item.productionHistory.length})</h3>
              {item.productionHistory.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>Batch</span><span>Qty Produced</span>
                  </div>
                  {item.productionHistory.map((o, i) => (
                    <div key={i} className="sales-list-row workspace-table-row">
                      <span>{fmtD(o.production_date)}</span>
                      <span>{o.batch_number || `#${o.batch_id}`}</span>
                      <span>{fmtQ(o.quantity)} {item.unit}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No production recorded for this size.</p>}
            </div>

            {/* Sales history */}
            <div className="detail-modal-section">
              <h3>Sales History ({item.salesHistory.length})</h3>
              {item.salesHistory.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': '1fr 70px 1fr 1fr 1fr 1fr' }}>
                  <div className="sales-list-head workspace-table-head">
                    <span>Date</span><span>Invoice</span><span>Customer</span><span>Qty</span><span>Unit Price</span><span>Line Total</span>
                  </div>
                  {item.salesHistory.map((l, i) => (
                    <div key={i} className="sales-list-row workspace-table-row">
                      <span>{fmtD(l.invoice_date)}</span>
                      <span>{fmtInv(l.invoice_id)}</span>
                      <span>{l.customer_name || '—'}</span>
                      <span>{fmtQ(l.quantity)}</span>
                      <span>{fmt(l.unit_price)}</span>
                      <span>{fmt(l.line_total)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No sales recorded for this size.</p>}
            </div>
          </ModalShell>
        )
      })()}

      {/* ── ACCOUNT ENTRY DETAIL MODAL ── */}
      {selectedAccountEntry && (() => {
        const e = selectedAccountEntry
        const typeColor = { income: '#16a34a', expense: '#dc2626', asset: '#2563eb', liability: '#d97706', equity: '#7c3aed' }[e.entry_type] || '#6b7280'
        return (
          <ModalShell
            kicker="Account Entry"
            title={e.transaction_id || `Entry #${e.id}`}
            subtitle={fmtD(e.transaction_date)}
            stat={fmt(e.amount)}
            onClose={() => setSelectedAccountEntry(null)}
          >
            {/* Info row */}
            <div className="detail-modal-section">
              <div className="detail-modal-totals" style={{ flexWrap: 'wrap', gap: '16px 32px' }}>
                <span>Type: <strong style={{ color: typeColor }}>{fmtStatus(e.entry_type)}</strong></span>
                <span>Category: <strong>{e.category || '—'}</strong></span>
                <span>Amount: <strong>{fmt(e.amount)}</strong></span>
                {e.payment_method && <span>Payment Method: <strong>{fmtStatus(e.payment_method)}</strong></span>}
              </div>
            </div>

            <div className="detail-modal-section">
              <div className="detail-purchase-header">
                <div className="detail-purchase-field">
                  <span>Transaction ID</span>
                  <strong>{e.transaction_id || `Entry #${e.id}`}</strong>
                </div>
                <div className="detail-purchase-field">
                  <span>Date</span>
                  <strong>{fmtD(e.transaction_date)}</strong>
                </div>
                <div className="detail-purchase-field">
                  <span>Category</span>
                  <strong>{e.category || '—'}</strong>
                </div>
                <div className="detail-purchase-field">
                  <span>Payment Method</span>
                  <strong>{e.payment_method ? fmtStatus(e.payment_method) : '—'}</strong>
                </div>
                {e.production_batch ? (
                  <div className="detail-purchase-field">
                    <span>Linked Batch</span>
                    <strong>#{e.production_batch}</strong>
                  </div>
                ) : null}
                {e.created_at ? (
                  <div className="detail-purchase-field">
                    <span>Recorded</span>
                    <strong>{fmtD(e.created_at)}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Description */}
            <div className="detail-modal-section">
              <h3>Description</h3>
              <p style={{ margin: '6px 0 0', lineHeight: 1.55 }}>{e.description || '—'}</p>
            </div>

            {/* Comments — only when present */}
            {e.comments ? (
              <div className="detail-modal-section">
                <h3>Comments</h3>
                <p style={{ margin: '6px 0 0', lineHeight: 1.55, color: '#555' }}>{e.comments}</p>
              </div>
            ) : null}

            <div className="detail-modal-section" style={{ paddingTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="account-alert-button account-alert-button-dark" onClick={() => { setSelectedAccountEntry(null); openModal('account', e) }}>Edit Entry</button>
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── CUSTOMER DETAIL MODAL ── */}
      {selectedCustomer && (() => {
        const custInvoices = data.invoices.filter(inv => String(inv.customer) === String(selectedCustomer.id))
        const custInvoiceIds = new Set(custInvoices.map(inv => String(inv.id)))
        const custPayments = data.payments.filter(p => custInvoiceIds.has(String(p.invoice)))
        const totalBilled = sumBy(custInvoices, inv => inv.total_amount)
        const totalPaid = sumBy(custPayments, p => p.amount)
        const outstanding = sumBy(custInvoices, inv => inv.outstanding_balance)
        return (
          <ModalShell
            kicker="Customer Profile"
            title={selectedCustomer.name}
            subtitle={[selectedCustomer.phone, selectedCustomer.email].filter(Boolean).join(' · ') || 'No contact info'}
            stat={outstanding > 0 ? `${fmt(outstanding)} outstanding` : 'Fully paid'}
            onClose={() => setSelectedCustomer(null)}
          >
            <div className="detail-modal-section">
              <div className="detail-customer-meta">
                {selectedCustomer.address && <span><strong>Address:</strong> {selectedCustomer.address}</span>}
                <span><strong>Category:</strong> {selectedCustomer.customer_category_name || selectedCustomer.pricing_category || '—'}</span>
                <span><strong>Since:</strong> {fmtD(selectedCustomer.date)}</span>
                {toNumber(selectedCustomer.previous_balance) > 0 && <span><strong>Opening Balance:</strong> {fmt(selectedCustomer.previous_balance)}</span>}
              </div>
            </div>
            <div className="detail-modal-section">
              <div className="detail-modal-totals" style={{ marginBottom: '12px' }}>
                <span>Total Billed: <strong>{fmt(totalBilled)}</strong></span>
                <span>Total Received: <strong>{fmt(totalPaid)}</strong></span>
                <span>Outstanding: <strong>{fmt(outstanding)}</strong></span>
              </div>
            </div>
            <div className="detail-modal-section">
              <h3>Invoice History ({custInvoices.length})</h3>
              {custInvoices.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': 'minmax(min-content,1fr) minmax(min-content,1fr) minmax(min-content,1fr) minmax(min-content,1fr) minmax(min-content,1fr)' }}>
                  <div className="sales-list-head workspace-table-head"><span>Date</span><span>Invoice</span><span>Lines</span><span>Total</span><span>Outstanding</span></div>
                  {custInvoices.map(inv => (
                    <div key={inv.id} className="sales-list-row workspace-table-row">
                      <span>{fmtD(inv.invoice_date)}</span>
                      <span>{fmtInv(inv.id)}</span>
                      <span>{(inv.lines || []).length} line{(inv.lines || []).length !== 1 ? 's' : ''}</span>
                      <span>{fmt(inv.total_amount)}</span>
                      <span style={{ color: toNumber(inv.outstanding_balance) > 0 ? '#dc2626' : '#16a34a' }}>{fmt(inv.outstanding_balance)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No invoices yet.</p>}
            </div>
            <div className="detail-modal-section">
              <h3>Receipt History ({custPayments.length})</h3>
              {custPayments.length ? (
                <div className="sales-list-table workspace-table" style={{ '--table-cols': 'minmax(min-content,1fr) minmax(min-content,1fr) minmax(min-content,1fr) minmax(min-content,1fr)' }}>
                  <div className="sales-list-head workspace-table-head"><span>Date</span><span>Invoice</span><span>Method</span><span>Amount</span></div>
                  {custPayments.map(p => (
                    <div key={p.id} className="sales-list-row workspace-table-row">
                      <span>{fmtD(p.payment_date)}</span>
                      <span>{fmtInv(p.invoice)}</span>
                      <span>{fmtStatus(p.method)}</span>
                      <span>{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="workspace-empty">No payments recorded yet.</p>}
            </div>
          </ModalShell>
        )
      })()}

      {categoryModalTarget ? (
        <ModalShell
          kicker="Item Category"
          title="Add Category"
          subtitle="Create a category and use it immediately in the current form."
          onClose={closeCategoryModal}
          layer={80}
        >
          <form className="sales-form" onSubmit={saveCategoryFromModal}>
            <label className="sales-field">
              <span>Category Name</span>
              <input
                type="text"
                placeholder="e.g. Packaging"
                value={categoryDraft}
                onChange={e => setCategoryDraft(e.target.value)}
              />
            </label>
            <div className="sales-form-actions">
              <button type="button" className="account-alert-button account-alert-button-light" onClick={closeCategoryModal}>Cancel</button>
              <button type="submit" className="account-alert-button account-alert-button-dark">Save Category</button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </main>
  )
}

function FilterSelectRow({ filters = [], values = {}, onChange, onClear, className = '' }) {
  if (!filters.length) return null
  const hasActive = filters.some(filter => Boolean(values?.[filter.key]))

  return (
    <section className={`workspace-filter-row workspace-filter-row-secondary ${className}`.trim()} aria-label="Detailed filters">
      {filters.map(filter => (
        <label key={filter.key} className="workspace-filter-select">
          <span>{filter.label}</span>
          <select value={values?.[filter.key] || ''} onChange={e => onChange(filter.key, e.target.value)}>
            <option value="">{filter.placeholder || `All ${filter.label}`}</option>
            {filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      {hasActive ? <button type="button" className="workspace-filter-clear" onClick={onClear}>Reset Filters</button> : null}
    </section>
  )
}

export default HomePage
