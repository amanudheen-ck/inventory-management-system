# API Documentation

**Base URL:** `http://localhost:5000/api` (local) or `[ADD RENDER URL]/api` (live)
**Format:** JSON. Send `Content-Type: application/json`.
**Auth:** `Authorization: Bearer <token>` on every endpoint except login and register. Get a token from `POST /auth/login`.
A Postman collection with automated tests is in this folder.

## Responses

```json
{ "success": true, "data": { } }                                  // single item
{ "success": true, "data": [ ], "pagination": { "total": 25, "page": 1, "limit": 10, "pages": 3 } }
{ "success": false, "message": "Insufficient stock for \"USB Cable\"" }   // error
```

| Status | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Validation error (bad input) |
| 401 | Missing, invalid or expired token; deactivated user |
| 403 | Role not allowed |
| 404 | Not found |
| 409 | Conflict (duplicate email/SKU/barcode, or item still in use) |

List endpoints accept `page` and `limit` (max 100). Roles: **A** = admin, **M** = manager, **S** = staff.

## Auth

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | `{name, email, password}`. Creates a **staff** user (the very first user becomes admin) |
| POST | `/auth/login` | public | `{email, password}` returns `{token, user}` |
| GET | `/auth/me` | all | Current user |
| PUT | `/auth/me/password` | all | `{currentPassword, newPassword}` (min 8 characters) |
| GET | `/auth/users` | A | List users |
| POST | `/auth/users` | A | `{name, email, password, role}` |
| PUT | `/auth/users/:id` | A | `{name, role, isActive}` (cannot change own role/status) |
| DELETE | `/auth/users/:id` | A | Only if the user has no history; otherwise deactivate |

## Products and categories

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/products` | all | Query: `search` (name, SKU, barcode, location), `category`, `warehouse`, `supplier`, `lowStock=true`, `includeInactive`, `sortBy` (name, price, quantity, createdAt), `order` (asc, desc), `page`, `limit`. Staff do not receive `costPrice` |
| GET | `/products/barcode/:code` | all | Scanner lookup by barcode or SKU |
| GET | `/products/:id` | all | One product |
| POST | `/products` | A, M | `{name, price, costPrice, quantity, minStock, unit, sku, barcode, category, warehouse, supplier, location}`. SKU auto-generated if empty. Opening quantity creates a stock log |
| PUT | `/products/:id` | A, M | Same fields; **quantity cannot be edited here** |
| DELETE | `/products/:id` | A | Soft delete |
| GET | `/products/categories` | all | List categories |
| POST / PUT | `/products/categories`, `/products/categories/:id` | A, M | `{name, description}` |
| DELETE | `/products/categories/:id` | A | Blocked if products use it |

## Inventory

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/inventory/in` | all | `{productId or barcode, quantity, reason}` |
| POST | `/inventory/out` | A, M | Same body. 400 if not enough stock. Response includes `warning` when at or below minimum |
| POST | `/inventory/adjust` | A, M | `{productId or barcode, newQuantity, reason}` (stock-take) |
| GET | `/inventory/history` | all | Query: `product`, `type` (IN, OUT, ADJUSTMENT), `from`, `to`, `page`, `limit` |
| GET | `/inventory/low-stock` | all | Products at or below minimum stock. Optional `warehouse` |

## Customers

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/customers` | all | Query: `search`, `page`, `limit` |
| GET | `/customers/:id` | all | Includes `stats` (totalOrders, totalSpent, lastOrderAt) |
| POST / PUT | `/customers`, `/customers/:id` | all | `{name, phone, email, address, notes}` |
| DELETE | `/customers/:id` | A, M | 409 if the customer has orders |

## Orders

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/orders` | all | `{customer?, items: [{productId or barcode, quantity}], discount, taxRate, paymentMethod, paymentStatus, notes}`. Prices come from the database. Stock is reduced atomically; if any line fails, nothing is changed |
| GET | `/orders` | all | Query: `status`, `paymentStatus`, `customer`, `search`, `from`, `to`. Staff see only their own |
| GET | `/orders/:id` | all | One order |
| GET | `/orders/:id/invoice` | all | Invoice data |
| PATCH | `/orders/:id/cancel` | A, M | Cancels and restores stock (once only) |
| PATCH | `/orders/:id/payment` | A, M | `{paymentStatus, paymentMethod}` |

## Warehouses and suppliers

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/warehouses` | all | Each includes `stats` (units, activeSkus, lowStockItems, utilization %) |
| GET | `/warehouses/:id` | all | One warehouse with stats |
| POST / PUT | `/warehouses`, `/warehouses/:id` | A, M | `{name, code, city, state, address, capacity, status}` |
| DELETE | `/warehouses/:id` | A | 409 if it still has products |
| GET | `/suppliers` | A, M | Query: `search`, `includeInactive`, `page`, `limit` |
| GET | `/suppliers/:id` | A, M | Includes `productCount` |
| POST / PUT | `/suppliers`, `/suppliers/:id` | A, M | `{name, contactPerson, phone, email, address, gstin, isActive}` |
| DELETE | `/suppliers/:id` | A | 409 if products are linked |

## Dashboard and reports

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/dashboard` | all | Totals, today/month sales, last 7 days, top products, low stock, recent orders, stock by warehouse and category (inventory value hidden from staff) |
| GET | `/reports/inventory` | A, M | Stock value by category |
| GET | `/reports/sales` | A, M | Query: `from`, `to` (YYYY-MM-DD), `group` (day, month). Revenue, tax, discount, estimated profit |
| GET | `/reports/top-products` | A, M | Query: `from`, `to`, `limit` |
| GET | `/reports/stock-movement` | A, M | Units in/out per period |
| GET | `/reports/customers` | A, M | Best customers by spend |

## Example

```http
POST /api/orders
Authorization: Bearer <token>

{ "customer": "<customerId>",
  "items": [ { "productId": "<productId>", "quantity": 2 } ],
  "taxRate": 5, "paymentMethod": "upi" }
```
