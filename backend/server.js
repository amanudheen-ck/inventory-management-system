require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Fail fast on missing configuration instead of crashing on the first request.
const missing = ["MONGO_URI", "JWT_SECRET"].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();

// Needed behind a reverse proxy (Railway, Render, Nginx...) so rate limiting sees real client IPs.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "1mb" }));
// Express 5 leaves req.body undefined when a request has no body.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Slow down brute-force attempts on credentials.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.get("/", (req, res) => res.json({ success: true, message: "Smart Inventory API is running" }));
app.get("/api/health", (req, res) => res.json({ success: true, uptime: process.uptime() }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/warehouses", require("./routes/warehouseRoutes"));
app.use("/api/suppliers", require("./routes/supplierRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`)))
  .catch((err) => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });
