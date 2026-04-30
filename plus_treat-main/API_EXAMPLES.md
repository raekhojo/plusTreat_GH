# Plus Treats API Contract (Frontend Reference)

This file is the implementation-level API contract for the current backend.

## Base URLs

- API root: `/api/`
- Swagger UI: `/swagger/`
- OpenAPI JSON: `/swagger.json` and `/swagger.json/`

## Content Type

- Request: `Content-Type: application/json`
- Response: `application/json`

## ID Format

- Business entity IDs are UUIDs (string), not integers.
- Example UUID: `3fa85f64-5717-4562-b3fc-2c963f66afa6`
- Exception: nested Django auth `user.id` inside staff payloads remains the default Django user PK.

## Auth

- Current implementation has no auth enforcement yet.
- Frontend can call endpoints directly in development.

## Update Rule (Important)

- Any backend change to models/serializers/views/routes must update this file in the same commit.
- Regenerate and review schema after changes:
  - `python manage.py spectacular --file swagger.json`

## Common CRUD Pattern

For all `ModelViewSet` endpoints:

- `GET /api/<resource>/` list
- `POST /api/<resource>/` create
- `GET /api/<resource>/{id}/` detail
- `PUT /api/<resource>/{id}/` full update
- `PATCH /api/<resource>/{id}/` partial update
- `DELETE /api/<resource>/{id}/` delete (returns `204 No Content`)

## Endpoint Index

- `/api/customers/`
- `/api/products/`
- `/api/products/{id}/update-stock/` (custom action, POST)
- `/api/staff/`
- `/api/invoices/`
- `/api/payments/`
- `/api/suppliers/`
- `/api/raw-materials/`
- `/api/purchases/`
- `/api/purchase-payments/`
- `/api/production-batches/`
- `/api/account-transactions/`
- `/api/pricing-rules/`

## Customers

### Fields

- Read-only: `id`, `created_at`, `updated_at`
- Writable: `date`, `customer_code`, `name`, `customer_category`, `pricing_category`, `phone`, `email`, `address`, `previous_balance`

### GET list

- `GET /api/customers/`
- Optional filters:
  - `search=<name|phone|customer_code>`
  - `customer_code=<exact_code>`
  - `customer_category=<exact_category>`
  - `pricing_category=<exact_category>`

### POST create payload

```json
{
  "date": "2025-11-07",
  "customer_code": "CUST-0001-0060",
  "name": "Odorko McClean School",
  "customer_category": "Customer",
  "pricing_category": "Retail Price",
  "phone": "+233244000000",
  "email": "accounts@odorko.edu",
  "address": "Accra",
  "previous_balance": "0.00"
}
```

### PUT update payload

```json
{
  "date": "2025-11-08",
  "customer_code": "CUST-0001-0060",
  "name": "Odorko McClean School",
  "customer_category": "Customer",
  "pricing_category": "Retail Price",
  "phone": "+233244000999",
  "email": "accounts@odorko.edu",
  "address": "Accra - New Address",
  "previous_balance": "50.00"
}
```

### PATCH payload

```json
{
  "phone": "+233244001111"
}
```

## Products

### Fields

- Read-only: `id`, `created_at`, `updated_at`
- Writable: `sku`, `name`, `description`, `unit_price`, `stock_quantity`, `is_active`

### GET list

- `GET /api/products/`

### POST create payload

```json
{
  "sku": "PRD-200ML",
  "name": "200ml",
  "description": "200ml yoghurt bottle",
  "unit_price": "10.00",
  "stock_quantity": "100.00",
  "is_active": true
}
```

### PUT update payload

```json
{
  "sku": "PRD-200ML",
  "name": "200ml",
  "description": "Updated description",
  "unit_price": "10.50",
  "stock_quantity": "120.00",
  "is_active": true
}
```

### PATCH payload

```json
{
  "unit_price": "11.00"
}
```

### Custom stock update

- `POST /api/products/{id}/update-stock/`

```json
{
  "quantity_change": "-2.00",
  "reason": "Spoilage"
}
```

## Staff

### Fields

- Read-only: `id`, `created_at`, `updated_at`, nested `user.id`
- Writable:
  - `phone`, `role`, `is_sales_staff`
  - nested `user`: `username`, `first_name`, `last_name`, `email`, `is_active`

### GET list

- `GET /api/staff/`

### POST create payload

```json
{
  "user": {
    "username": "sales1",
    "first_name": "Prod",
    "last_name": "Team",
    "email": "sales1@plustreats.com",
    "is_active": true
  },
  "phone": "+233244222222",
  "role": "Sales",
  "is_sales_staff": true
}
```

### PUT update payload

```json
{
  "user": {
    "username": "sales1",
    "first_name": "Production",
    "last_name": "Lead",
    "email": "sales1@plustreats.com",
    "is_active": true
  },
  "phone": "+233244222223",
  "role": "Sales Lead",
  "is_sales_staff": true
}
```

## Invoices

### Filters (list endpoint)

- `customer=<customer_id>`
- `staff=<user_id>`
- `status=<draft|issued|partially_paid|paid|cancelled>`
- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`

### Fields

- Read-only invoice fields:
  - `id`, `subtotal`, `total_amount`, `outstanding_balance`, `created_at`, `updated_at`
  - `customer_name`, `staff_name`
  - `payments` array
- Writable invoice fields:
  - `invoice_number`, `invoice_date`, `customer`, `staff`, `discount_amount`, `previous_balance`, `status`, `notes`, `items`
- Item fields:
  - Read-only: `id`, `line_total`, `product_name`
  - Writable: `product_id`, `description`, `unit_price`, `quantity`

### GET list

- `GET /api/invoices/?start_date=2026-01-01&end_date=2026-01-31&customer=1&staff=2`
  - Use UUID values for `customer` and `staff`.

### POST create payload (nested items)

```json
{
  "invoice_number": "INV-1769265153478",
  "invoice_date": "2026-01-24",
  "customer": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "staff": "7b9f6b84-5b6b-4ce9-a813-5d71f84f16db",
  "discount_amount": "0.00",
  "previous_balance": "0.00",
  "status": "issued",
  "notes": "Please send payment to MoMo or bank account",
  "items": [
    {
      "product_id": 1,
      "description": "500ml",
      "unit_price": "20.00",
      "quantity": "5.00"
    }
  ]
}
```

### PUT update payload

`items` update is blocked on update.

```json
{
  "invoice_number": "INV-1769265153478",
  "invoice_date": "2026-01-24",
  "customer": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "staff": "7b9f6b84-5b6b-4ce9-a813-5d71f84f16db",
  "discount_amount": "10.00",
  "previous_balance": "0.00",
  "status": "partially_paid",
  "notes": "Updated note"
}
```

### PATCH payload

```json
{
  "status": "paid"
}
```

## Payments (Sales Receipts)

### Fields

- Read-only: `id`, `created_at`
- Writable: `invoice`, `amount`, `payment_date`, `method`, `reference`, `notes`
- `method` values: `cash`, `momo`, `bank_transfer`, `other`

### GET list

- `GET /api/payments/`

### POST create payload

```json
{
  "invoice": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "amount": "125.00",
  "payment_date": "2026-01-25",
  "method": "momo",
  "reference": "RT-1768675971445",
  "notes": "Part payment"
}
```

### PUT update payload

```json
{
  "invoice": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "amount": "130.00",
  "payment_date": "2026-01-25",
  "method": "cash",
  "reference": "RT-1768675971445",
  "notes": "Adjusted payment"
}
```

## Suppliers

### Fields

- Read-only: `id`, `created_at`, `updated_at`
- Writable: `supplier_code`, `name`, `item_category`, `delivery_package`, `phone`, `notes`

### POST create payload

```json
{
  "supplier_code": "SUPP-0001-0001",
  "name": "SDTM Ghana Ltd",
  "item_category": "Milk",
  "delivery_package": "No",
  "phone": "+233244771077",
  "notes": "Primary milk supplier"
}
```

### PUT update payload

```json
{
  "supplier_code": "SUPP-0001-0001",
  "name": "SDTM Ghana Ltd",
  "item_category": "Milk",
  "delivery_package": "Yes",
  "phone": "+233244771077",
  "notes": "Updated delivery arrangement"
}
```

## Raw Materials

### Fields

- Read-only: `id`, `created_at`, `updated_at`, `stock_available`
- Writable:
  - `item_code`, `name`, `category`, `supplier`, `unit_per_item`, `item_price`
  - `unit`, `unit_price`, `opening_stock`, `stock_in`, `stock_out`, `reorder_level`

### POST create payload

```json
{
  "item_code": "RM-0001",
  "name": "Milk",
  "category": "Milk",
  "supplier": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "unit_per_item": "25.000",
  "item_price": "2100.00",
  "unit": "kg",
  "unit_price": "84.0000",
  "opening_stock": "25.000",
  "stock_in": "0.000",
  "stock_out": "0.000",
  "reorder_level": "50.000"
}
```

### PUT update payload

```json
{
  "item_code": "RM-0001",
  "name": "Milk",
  "category": "Milk",
  "supplier": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "unit_per_item": "25.000",
  "item_price": "2200.00",
  "unit": "kg",
  "unit_price": "88.0000",
  "opening_stock": "25.000",
  "stock_in": "100.000",
  "stock_out": "50.000",
  "reorder_level": "50.000"
}
```

## Purchases

### Filters

- `supplier=<supplier_id>`
- `status=<draft|open|partially_paid|paid>`
- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`

### Fields

- Read-only:
  - Purchase: `id`, `total_amount`, `total_paid`, `outstanding_amount`, `created_at`, `updated_at`, `supplier_name`, `payments`
  - Purchase item: `id`, `raw_material_name`, `total_units`, `line_total`
- Writable:
  - Purchase: `purchase_id`, `purchase_date`, `supplier`, `status`, `notes`, `items`
  - Purchase item: `raw_material`, `item_name`, `quantity`, `price_per_item`, `unit_per_item`, `price_per_unit`

### POST create payload (nested items)

```json
{
  "purchase_id": "PUR-012026-00033",
  "purchase_date": "2026-01-23",
  "supplier": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "open",
  "notes": "Restock",
  "items": [
    {
      "raw_material": "11111111-1111-1111-1111-111111111111",
      "item_name": "Milk",
      "quantity": "2.000",
      "price_per_item": "2100.00",
      "unit_per_item": "25.000"
    },
    {
      "raw_material": "22222222-2222-2222-2222-222222222222",
      "item_name": "Sugar",
      "quantity": "1.000",
      "price_per_item": "540.00",
      "unit_per_item": "50.000"
    }
  ]
}
```

### PUT update payload

`items` update is blocked on update.

```json
{
  "purchase_id": "PUR-012026-00033",
  "purchase_date": "2026-01-23",
  "supplier": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "partially_paid",
  "notes": "Updated note"
}
```

## Purchase Payments

### Fields

- Read-only: `id`, `created_at`
- Writable: `purchase`, `payment_date`, `amount`, `payment_method`, `notes`

### POST create payload

```json
{
  "purchase": "2f1fcb42-cf5e-4c5b-b594-6f6ca9b9f189",
  "payment_date": "2026-01-24",
  "amount": "500.00",
  "payment_method": "MoMo Wallet",
  "notes": "Advance payment"
}
```

### PUT update payload

```json
{
  "purchase": "2f1fcb42-cf5e-4c5b-b594-6f6ca9b9f189",
  "payment_date": "2026-01-24",
  "amount": "650.00",
  "payment_method": "Cash",
  "notes": "Adjusted amount"
}
```

## Production Batches

### Filters

- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`

### Fields

- Read-only batch fields:
  - `id`, `total_raw_material_cost`, `total_cost`, `total_production_value`, `profit`, `created_at`, `updated_at`
- Writable batch fields:
  - `batch_number`, `production_date`, `notes`, `electricity_cost`, `gas_cost`, `production_wages`
  - `outputs`, `material_usages`
- Output fields:
  - Read-only: `id`, `amount`, `product_name`
  - Writable: `product`, `product_size`, `quantity`, `unit_cost`, `batch_litres`, `total_litres`
- Material usage fields:
  - Read-only: `id`, `raw_material_name`
  - Writable: `raw_material`, `quantity_used`, `amount`, `notes`

### POST create payload (nested outputs + material usage)

```json
{
  "batch_number": "BATCH-001026-00004",
  "production_date": "2026-01-24",
  "notes": "Morning production",
  "electricity_cost": "30.00",
  "gas_cost": "20.00",
  "production_wages": "350.00",
  "material_usages": [
    {
      "raw_material": "11111111-1111-1111-1111-111111111111",
      "quantity_used": "25.000",
      "amount": "2100.00",
      "notes": "Milk used"
    },
    {
      "raw_material": "22222222-2222-2222-2222-222222222222",
      "quantity_used": "10.000",
      "amount": "108.00"
    }
  ],
  "outputs": [
    {
      "product": "33333333-3333-3333-3333-333333333333",
      "product_size": "200ml",
      "quantity": "250.00",
      "unit_cost": "5.50",
      "batch_litres": "150.000",
      "total_litres": "50.000"
    },
    {
      "product": "44444444-4444-4444-4444-444444444444",
      "product_size": "300ml",
      "quantity": "200.00",
      "unit_cost": "8.50",
      "batch_litres": "150.000",
      "total_litres": "60.000"
    }
  ]
}
```

### PUT update payload

For full replacement (no custom update logic defined for nested arrays; use with caution).

```json
{
  "batch_number": "BATCH-001026-00004",
  "production_date": "2026-01-24",
  "notes": "Updated production note",
  "electricity_cost": "35.00",
  "gas_cost": "20.00",
  "production_wages": "360.00",
  "material_usages": [],
  "outputs": []
}
```

## Account Transactions

### Filters

- `entry_type=<income|expense|asset|liability|equity>`
- `category=<string>`
- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`

### Fields

- Read-only: `id`, `created_at`
- Writable:
  - `transaction_id`, `transaction_date`, `entry_type`, `category`
  - `description`, `amount`, `payment_method`, `comments`, `production_batch`

### POST create payload

```json
{
  "transaction_id": "ACC-0126-00021",
  "transaction_date": "2026-01-23",
  "entry_type": "expense",
  "category": "Marketing",
  "description": "Rubber for yoghurt sale",
  "amount": "6.00",
  "payment_method": "Cash",
  "comments": "",
  "production_batch": null
}
```

### PUT update payload

```json
{
  "transaction_id": "ACC-0126-00021",
  "transaction_date": "2026-01-23",
  "entry_type": "expense",
  "category": "Fees and Charges",
  "description": "Transfer charges",
  "amount": "11.36",
  "payment_method": "MoMo Wallet",
  "comments": "Up to end of day",
  "production_batch": null
}
```

## Pricing Rules

### Fields

- Read-only: `id`, `created_at`, `updated_at`
- Writable: `price_id`, `size`, `pricing_category`, `price`

### POST create payload

```json
{
  "price_id": "PR-0010",
  "size": "500ml",
  "pricing_category": "Wholesale Price",
  "price": "20.00"
}
```

### PUT update payload

```json
{
  "price_id": "PR-0010",
  "size": "500ml",
  "pricing_category": "Wholesale Price",
  "price": "21.00"
}
```

## Standard Response Shapes

### GET list response

```json
[
  {
    "id": 1
  }
]
```

### GET detail response

```json
{
  "id": 1
}
```

### POST response

- `201 Created` with created object JSON.

### PUT/PATCH response

- `200 OK` with updated object JSON.

### DELETE response

- `204 No Content` with empty body.

## Validation/Error Shape

Common DRF validation response:

```json
{
  "field_name": ["Error message"]
}
```

Custom business rule examples:

```json
{
  "items": ["Insufficient stock for product '500ml'."]
}
```

```json
{
  "material_usages": ["['Insufficient stock for raw material \\'Milk\\'.']"]
}
```
