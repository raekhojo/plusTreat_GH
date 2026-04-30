# Plus Treats Spreadsheet Tab Build Plan

Workbook analyzed: `Sample_Plus Treats Management System (1).xlsx`

## 1) Tab Classification

`Entry/UI tabs` (layout/forms, not source-of-truth records):
- Dashboard
- Sales_Entry
- Invoice
- SalesReceipt_Entry
- Production_Entry
- RMPurchases_Entry
- Customer_Supplier_Entry
- Accounts_Entry
- Drop Down Config

`Data tabs` (actual business rows):
- Customers_Dtls
- Supplier_Dtls
- Pricing
- RawMaterials
- Inventory
- Sales_Dtls
- Sales
- SalesReceipt_Dtls
- Production_Dtls
- RM_Usage_Dtls
- Purchase_Dtls
- PurchasePmt_Dtls
- Accounts_Dtls
- Trial Balance
- Financials
- Prod Planner

## 2) Mapping to Current Backend

Already present endpoints:
- `/api/customers/` -> `Customers_Dtls`, `Customers`
- `/api/suppliers/` -> `Supplier_Dtls`
- `/api/pricing-rules/` -> `Pricing`
- `/api/raw-materials/` -> `RawMaterials`, `Inventory`
- `/api/products/` -> product sizes used by sales/production tabs
- `/api/staff/` -> salesperson/staff identity in sales
- `/api/invoices/` + `/api/payments/` -> `Sales_Dtls`, `Sales`, `SalesReceipt_Dtls`
- `/api/purchases/` + `/api/purchase-payments/` -> `Purchase_Dtls`, `PurchasePmt_Dtls`
- `/api/production-batches/` -> `Production_Dtls`, `RM_Usage_Dtls`, `Prod Planner`
- `/api/account-transactions/` -> `Accounts_Dtls`

Report tabs derived from transactional data:
- Trial Balance
- Financials
- Dashboard

## 3) Recommended Build Order (Tab-by-Tab)

0. Schema normalization (ID strategy + migration consistency across apps)
1. `Customers_Dtls` + `Supplier_Dtls` + `Pricing`
2. `RawMaterials` + `Inventory`
3. `Purchase_Dtls` + `PurchasePmt_Dtls`
4. `Production_Dtls` + `RM_Usage_Dtls` + `Prod Planner`
5. `Sales_Dtls` + `Sales` + `SalesReceipt_Dtls`
6. `Accounts_Dtls`
7. Reporting tabs: `Trial Balance` -> `Financials` -> `Dashboard`

Why this order:
- It respects dependencies (masters -> stock inputs -> production -> sales -> accounting -> reports).
- It minimizes rework in formulas/aggregations.
- Phase 0 prevents runtime crashes from DB/model ID type mismatches.

## 4) Execution Mode for Each Tab

For each tab, implement in this sequence:
1. Confirm field mapping (column -> model field).
2. Add/adjust serializer validation rules.
3. Add endpoint filters/actions needed by that tab.
4. Load 3-5 real sample rows from the sheet as test fixtures.
5. Verify API response shape matches spreadsheet expectations.

## 5) First Tab Scope (Ready Now)

Start with `Customers_Dtls`:
- Ensure fields: date, customer id/code, name, category, pricing category, phone
- Confirm relation to pricing rules and sales workflows
- Add any missing filters (`search by name/phone/id`) for frontend table behavior

Current status:
- `Customers_Dtls` implementation started in backend (customer code/category/pricing/date + list filters).
- Next immediate step: run migration for customer fields, then validate `/api/customers/` list/create/update against sample rows.
