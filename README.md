# Smart Inventory & Order Management System

A full-stack inventory and order management system with a **REST API**, a **React web app** and an **Android app (React Native / Expo)**, all connected to one MongoDB database.

| Item | Link |
|---|---|
| Live web app | **[https://inventory-management-system-seven-omega.vercel.app/login]** |
| Backend API | **[https://inventory-management-system-4ztn.onrender.com]**/api/health |
| Android app | Run with Expo Go (see [Mobile setup](#3-mobile-app-android)) |
| API documentation | [documentation/API-Documentation.md](documentation/API-Documentation.md) |
| ER diagram | [documentation/ER-Diagram.md](documentation/ER-Diagram.md) |
| Postman collection | [documentation/Smart-Inventory-API.postman_collection.json](documentation/Smart-Inventory-API.postman_collection.json) |

## Features (assessment modules)

1. **Authentication and roles**: login, logout, JWT, three roles (admin, manager, staff). The first registered user becomes admin; later self-registrations are always staff. Admins create users from the Users page.
2. **Dashboard**: product, stock, sales and order summary, 7-day sales chart, stock by warehouse, low-stock list.
3. **Products**: add, edit, delete (soft), search by name/SKU/barcode/location, categories, warehouse, supplier, barcode.
4. **Inventory**: stock in, stock out, stock-take adjustment, full movement history, low-stock alerts.
5. **Customers**: add, edit, search, delete (blocked if the customer has orders).
6. **Orders**: create orders (stock is reduced automatically, all-or-nothing), cancel (stock is restored), payment status, printable invoice.
7. **Reports**: sales and estimated profit by day/month, top products, stock value by category, stock movement, best customers.

Extras: warehouses with capacity utilization, suppliers (GSTIN), barcode scanning on mobile.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 5, Mongoose, JWT, bcrypt, helmet, rate limiting |
| Database | MongoDB Atlas |
| Web | React 19, Vite, React Router |
| Mobile | React Native, Expo, React Navigation, expo-camera |
| Hosting | Render (API), Vercel (web), MongoDB Atlas (database) |

## Roles

| Role | Can do |
|---|---|
| **admin** | Everything, including managing users |
| **manager** | Everything except user management and deleting products. Stock out/adjust, edit products, suppliers, warehouses, reports, cancel orders |
| **staff** | View products (cost price hidden), stock in, create orders, manage customers, view own orders |

## Project structure

```
backend/   Express API (config, models, controllers, routes, middleware, utils)
web/       React web app (src/pages, components, services)
mobile/    Expo Android app (src/screens, navigation, services)
documentation/   API docs, ER diagram, Postman collection, test script
```

## Setup

Requirements: Node.js 20+, a MongoDB Atlas database (or local MongoDB), Git.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit the values
npm run dev               # or: npm start
```

`backend/.env`:

| Variable | Meaning |
|---|---|
| `MONGO_URI` | MongoDB connection string (include the database name) |
| `JWT_SECRET` | Long random string |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `CLIENT_URL` | Allowed web origins, comma separated, e.g. `http://localhost:5173` |
| `PORT` | Default `5000` |
| `TZ` | Time zone for daily report grouping, e.g. `Asia/Kolkata` |

Check it works: open `http://localhost:5000/api/health`. Then register the first user (`POST /api/auth/register`), who becomes the admin.

### 2. Web app

```bash
cd web
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm run dev               # http://localhost:5173
```

### 3. Mobile app (Android)

```bash
cd mobile
npm install
# create mobile/.env with your computer's Wi-Fi IP (or the deployed API URL):
#   EXPO_PUBLIC_API_URL=http://192.168.1.5:5000/api
npx expo start -c
```

Install **Expo Go** from the Play Store on an Android phone (same Wi-Fi as the computer) and scan the QR code. To use the live API, set `EXPO_PUBLIC_API_URL` to the deployed backend URL. The Scan tab uses the camera to read barcodes (adjust stock, or add items to a sale).

## Testing

- **Postman**: import `documentation/Smart-Inventory-API.postman_collection.json` and run the collection (start the backend first; set `adminEmail` / `adminPassword` in the collection variables). It contains ~120 automated checks covering auth, roles, validation, stock and orders.
- **PowerShell**: `documentation/test-api.ps1` runs a similar end-to-end test.

## Security

- Passwords hashed with bcrypt; JWT authentication on every route except login/register.
- Role checks on the server for every endpoint; deactivated users lose access immediately.
- Input validation, consistent error format, rate limiting on login, helmet headers, restricted CORS.
- Secrets live only in `.env` files, which are git-ignored.

## Author

Amanudheen CK
