const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const TOKEN_KEY = 'plusTreatToken'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function request(path, options = {}) {
  const token = getStoredToken()
  const method = (options.method || 'GET').toUpperCase()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    let message = `API request failed: ${response.status}`
    try {
      const errorPayload = await response.json()
      if (typeof errorPayload?.detail === 'string') {
        message = errorPayload.detail
      } else if (Array.isArray(errorPayload)) {
        message = errorPayload.join(', ')
      } else if (errorPayload && typeof errorPayload === 'object') {
        const firstEntry = Object.entries(errorPayload)[0]
        if (firstEntry) {
          const [, value] = firstEntry
          message = Array.isArray(value) ? value.join(', ') : String(value)
        }
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

export function asCollection(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function loginUser(identifier, password) {
  return request('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username: identifier, password }),
  })
}

export function logoutUser() {
  return request('/auth/logout/', { method: 'POST' })
}

export function getMe() {
  return request('/auth/me/')
}

// ─── Customers ───────────────────────────────────────────────────────────────

export function getCustomers(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/customers/${qs ? `?${qs}` : ''}`)
}

export function createCustomer(payload) {
  return request('/customers/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCustomer(id, payload) {
  return request(`/customers/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteCustomer(id) {
  return request(`/customers/${id}/`, { method: 'DELETE' })
}

// ─── Products ────────────────────────────────────────────────────────────────

export function getProducts() {
  return request('/products/')
}

export function createProduct(payload) {
  return request('/products/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateProduct(id, payload) {
  return request(`/products/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteProduct(id) {
  return request(`/products/${id}/`, { method: 'DELETE' })
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export function getInvoices(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/invoices/${qs ? `?${qs}` : ''}`)
}

export function createInvoice(payload) {
  return request('/invoices/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateInvoice(id, payload) {
  return request(`/invoices/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteInvoice(id) {
  return request(`/invoices/${id}/`, { method: 'DELETE' })
}

// ─── Payments ────────────────────────────────────────────────────────────────

export function getPayments(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/payments/${qs ? `?${qs}` : ''}`)
}

export function createPayment(payload) {
  return request('/payments/', { method: 'POST', body: JSON.stringify(payload) })
}

export function deletePayment(id) {
  return request(`/payments/${id}/`, { method: 'DELETE' })
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export function getSuppliers() {
  return request('/suppliers/')
}

export function createSupplier(payload) {
  return request('/suppliers/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateSupplier(id, payload) {
  return request(`/suppliers/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteSupplier(id) {
  return request(`/suppliers/${id}/`, { method: 'DELETE' })
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export function getPurchases(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/purchases/${qs ? `?${qs}` : ''}`)
}

export function createPurchase(payload) {
  return request('/purchases/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updatePurchase(id, payload) {
  return request(`/purchases/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deletePurchase(id) {
  return request(`/purchases/${id}/`, { method: 'DELETE' })
}

// ─── Purchase Payments ───────────────────────────────────────────────────────

export function getPurchasePayments() {
  return request('/purchase-payments/')
}

export function createPurchasePayment(payload) {
  return request('/purchase-payments/', { method: 'POST', body: JSON.stringify(payload) })
}

export function deletePurchasePayment(id) {
  return request(`/purchase-payments/${id}/`, { method: 'DELETE' })
}

// ─── Production ──────────────────────────────────────────────────────────────

export function getProductionBatches(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/production-batches/${qs ? `?${qs}` : ''}`)
}

export function createProductionBatch(payload) {
  return request('/production-batches/', { method: 'POST', body: JSON.stringify(payload) })
}

export function createProductionOutput(payload) {
  return request('/production-outputs/', { method: 'POST', body: JSON.stringify(payload) })
}

export function deleteProductionBatch(id) {
  return request(`/production-batches/${id}/`, { method: 'DELETE' })
}

// ─── Raw Materials ───────────────────────────────────────────────────────────

export function getRawMaterials() {
  return request('/raw-materials/')
}

export function createRawMaterial(payload) {
  return request('/raw-materials/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateRawMaterial(id, payload) {
  return request(`/raw-materials/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteRawMaterial(id) {
  return request(`/raw-materials/${id}/`, { method: 'DELETE' })
}

// ─── Account Transactions ────────────────────────────────────────────────────

export function getAccountTransactions(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/account-transactions/${qs ? `?${qs}` : ''}`)
}

export function createAccountTransaction(payload) {
  return request('/account-transactions/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateAccountTransaction(id, payload) {
  return request(`/account-transactions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteAccountTransaction(id) {
  return request(`/account-transactions/${id}/`, { method: 'DELETE' })
}

// ─── Pricing Rules ───────────────────────────────────────────────────────────

export function getPricingRules() {
  return request('/pricing-rules/')
}

export function createPricingRule(payload) {
  return request('/pricing-rules/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updatePricingRule(id, payload) {
  return request(`/pricing-rules/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deletePricingRule(id) {
  return request(`/pricing-rules/${id}/`, { method: 'DELETE' })
}

// ─── Pricing Categories ───────────────────────────────────────────────────────

export function getPricingCategories() {
  return request('/pricing-categories/')
}

export function createPricingCategory(payload) {
  return request('/pricing-categories/', { method: 'POST', body: JSON.stringify(payload) })
}

// ─── Customer Categories ──────────────────────────────────────────────────────

export function getCustomerCategories() {
  return request('/customer-categories/')
}

export function createCustomerCategory(payload) {
  return request('/customer-categories/', { method: 'POST', body: JSON.stringify(payload) })
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export function getStaffProfiles() {
  return request('/staff/').then(asCollection)
}

// ─── Composite loaders ───────────────────────────────────────────────────────

export function getAnalyticsSummary() {
  return Promise.all([
    getInvoices(),
    getPayments(),
    getProducts(),
    getSuppliers(),
    getPurchases(),
    getPurchasePayments(),
    getProductionBatches(),
    getRawMaterials(),
    getAccountTransactions(),
    getPricingRules(),
    getCustomers(),
    getStaffProfiles(),
    getPricingCategories(),
    getCustomerCategories(),
  ]).then(([
    invoices, payments, products, suppliers, purchases,
    purchasePayments, productionBatches, rawMaterials,
    accountTransactions, pricingRules, customers, staffProfiles,
    pricingCategories, customerCategories,
  ]) => ({
    invoices: asCollection(invoices),
    payments: asCollection(payments),
    products: asCollection(products),
    suppliers: asCollection(suppliers),
    purchases: asCollection(purchases),
    purchasePayments: asCollection(purchasePayments),
    productionBatches: asCollection(productionBatches),
    rawMaterials: asCollection(rawMaterials),
    accountTransactions: asCollection(accountTransactions),
    pricingRules: asCollection(pricingRules),
    customers: asCollection(customers),
    staffProfiles: Array.isArray(staffProfiles) ? staffProfiles : [],
    pricingCategories: asCollection(pricingCategories),
    customerCategories: asCollection(customerCategories),
  }))
}
