# Database Structure (ER Diagram)

Database: **MongoDB** (Atlas), accessed through **Mongoose**. Collections: `users`, `categories`, `warehouses`, `suppliers`, `products`, `customers`, `orders`, `stocktransactions`.

```mermaid
erDiagram
    USER ||--o{ ORDER : creates
    USER ||--o{ STOCK_TRANSACTION : performs
    CUSTOMER |o--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : "contains (embedded)"
    PRODUCT ||--o{ ORDER_ITEM : "sold as"
    PRODUCT ||--o{ STOCK_TRANSACTION : "has history"
    ORDER |o--o{ STOCK_TRANSACTION : causes
    CATEGORY |o--o{ PRODUCT : groups
    WAREHOUSE |o--o{ PRODUCT : stores
    SUPPLIER |o--o{ PRODUCT : supplies

    USER {
        ObjectId _id PK
        string name
        string email UK
        string password "bcrypt hash"
        string role "admin | manager | staff"
        boolean isActive
    }
    CATEGORY {
        ObjectId _id PK
        string name UK
        string description
    }
    WAREHOUSE {
        ObjectId _id PK
        string name
        string code UK
        string city
        string state
        number capacity
        string status "online | degraded | offline"
        boolean isActive
    }
    SUPPLIER {
        ObjectId _id PK
        string name
        string contactPerson
        string email
        string phone
        string gstin
        boolean isActive
    }
    PRODUCT {
        ObjectId _id PK
        string name
        string sku UK
        string barcode UK
        ObjectId category FK
        ObjectId warehouse FK
        ObjectId supplier FK
        string location
        number price
        number costPrice
        number quantity
        number minStock
        string unit
        boolean isActive
    }
    CUSTOMER {
        ObjectId _id PK
        string name
        string phone
        string email UK
        string address
    }
    ORDER {
        ObjectId _id PK
        string orderNumber UK
        ObjectId customer FK
        ObjectId createdBy FK
        number subtotal
        number discount
        number taxRate
        number tax
        number total
        string status "completed | cancelled"
        string paymentStatus "paid | unpaid | partial"
        string paymentMethod
    }
    ORDER_ITEM {
        ObjectId product FK
        string name "snapshot"
        string sku "snapshot"
        number price "snapshot"
        number costPrice "snapshot"
        number quantity
        number lineTotal
    }
    STOCK_TRANSACTION {
        ObjectId _id PK
        ObjectId product FK
        string type "IN | OUT | ADJUSTMENT"
        number quantity
        number previousQuantity
        number newQuantity
        string reason
        ObjectId order FK
        ObjectId performedBy FK
    }
```

## Design notes

- **Order items are embedded** in the order and store a snapshot of the product name, SKU, price and cost, so old invoices stay correct if a product changes later.
- **`products.quantity` is the live stock.** Every change also writes a `stocktransactions` row (previous and new quantity, reason, who did it), so there is a full audit trail.
- **Stock updates are atomic** (`$inc` with a `quantity >= n` filter), so two simultaneous requests can never oversell or push stock below zero.
- **Soft deletes:** products, warehouses and suppliers are deactivated (`isActive: false`) instead of removed, so history is never broken.
- **Indexes:** unique on `email`, `sku`, `barcode` (sparse), `orderNumber`, warehouse `code`; compound indexes on stock history and orders by date.
- You can view this diagram as an image by pasting the code above into https://mermaid.live and exporting PNG.
