const Product = require("../models/Product");
const Category = require("../models/Category");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const StockTransaction = require("../models/StockTransaction");
const { parseDateRange, parsePositiveInt } = require("../utils/helpers");

const TZ = process.env.TZ || "UTC";
const periodFormat = (group) => (group === "month" ? "%Y-%m" : "%Y-%m-%d");

// GET /api/reports/inventory  - stock value by category
exports.getInventoryReport = async (req, res) => {
  const rows = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$category",
        products: { $sum: 1 },
        units: { $sum: "$quantity" },
        costValue: { $sum: { $multiply: ["$quantity", "$costPrice"] } },
        retailValue: { $sum: { $multiply: ["$quantity", "$price"] } },
      },
    },
    { $lookup: { from: Category.collection.name, localField: "_id", foreignField: "_id", as: "cat" } },
    { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        category: { $ifNull: ["$cat.name", "Uncategorized"] },
        products: 1,
        units: 1,
        costValue: 1,
        retailValue: 1,
      },
    },
    { $sort: { retailValue: -1 } },
  ]);

  const totals = rows.reduce(
    (t, r) => ({
      products: t.products + r.products,
      units: t.units + r.units,
      costValue: t.costValue + r.costValue,
      retailValue: t.retailValue + r.retailValue,
    }),
    { products: 0, units: 0, costValue: 0, retailValue: 0 }
  );

  res.json({ success: true, data: { totals, byCategory: rows } });
};

// GET /api/reports/sales?from=&to=&group=day|month  - revenue, tax, discounts and estimated profit
exports.getSalesReport = async (req, res) => {
  const { from, to } = parseDateRange(req.query, 30);
  const format = periodFormat(req.query.group);
  const match = { status: "completed", createdAt: { $gte: from, $lte: to } };
  const periodExpr = { $dateToString: { format, date: "$createdAt", timezone: TZ } };

  const [orderRows, profitRows] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: periodExpr,
          orders: { $sum: 1 },
          subtotal: { $sum: "$subtotal" },
          discount: { $sum: "$discount" },
          tax: { $sum: "$tax" },
          revenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: periodExpr,
          itemRevenue: { $sum: "$items.lineTotal" },
          cost: { $sum: { $multiply: ["$items.costPrice", "$items.quantity"] } },
        },
      },
    ]),
  ]);

  const profitByPeriod = new Map(profitRows.map((r) => [r._id, r.itemRevenue - r.cost]));
  const data = orderRows.map((r) => ({
    period: r._id,
    orders: r.orders,
    subtotal: r.subtotal,
    discount: r.discount,
    tax: r.tax,
    revenue: r.revenue,
    // Estimate = item margin (selling price - cost) minus order discounts; tax is excluded.
    estimatedProfit: (profitByPeriod.get(r._id) || 0) - r.discount,
  }));

  const totals = data.reduce(
    (t, r) => ({
      orders: t.orders + r.orders,
      revenue: t.revenue + r.revenue,
      tax: t.tax + r.tax,
      discount: t.discount + r.discount,
      estimatedProfit: t.estimatedProfit + r.estimatedProfit,
    }),
    { orders: 0, revenue: 0, tax: 0, discount: 0, estimatedProfit: 0 }
  );

  res.json({ success: true, range: { from, to }, data: { totals, series: data } });
};

// GET /api/reports/top-products?from=&to=&limit=
exports.getTopProducts = async (req, res) => {
  const { from, to } = parseDateRange(req.query, 30);
  const limit = Math.min(req.query.limit ? parsePositiveInt(req.query.limit, "limit") : 10, 50);

  const data = await Order.aggregate([
    { $match: { status: "completed", createdAt: { $gte: from, $lte: to } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        sku: { $first: "$items.sku" },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
        cost: { $sum: { $multiply: ["$items.costPrice", "$items.quantity"] } },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: 1,
        sku: 1,
        unitsSold: 1,
        revenue: 1,
        estimatedProfit: { $subtract: ["$revenue", "$cost"] },
      },
    },
    { $sort: { unitsSold: -1 } },
    { $limit: limit },
  ]);

  res.json({ success: true, range: { from, to }, data });
};

// GET /api/reports/stock-movement?from=&to=&group=day|month
exports.getStockMovementReport = async (req, res) => {
  const { from, to } = parseDateRange(req.query, 30);
  const format = periodFormat(req.query.group);

  const rows = await StockTransaction.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format, date: "$createdAt", timezone: TZ } },
        unitsIn: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0] } },
        unitsOut: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0] } },
        adjustments: { $sum: { $cond: [{ $eq: ["$type", "ADJUSTMENT"] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, period: "$_id", unitsIn: 1, unitsOut: 1, adjustments: 1 } },
    { $sort: { period: 1 } },
  ]);

  res.json({ success: true, range: { from, to }, data: rows });
};

// GET /api/reports/customers?from=&to=&limit=  - best customers by spend
exports.getCustomerReport = async (req, res) => {
  const { from, to } = parseDateRange(req.query, 90);
  const limit = Math.min(req.query.limit ? parsePositiveInt(req.query.limit, "limit") : 10, 50);

  const data = await Order.aggregate([
    { $match: { status: "completed", customer: { $ne: null }, createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: "$customer",
        orders: { $sum: 1 },
        totalSpent: { $sum: "$total" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
    { $lookup: { from: Customer.collection.name, localField: "_id", foreignField: "_id", as: "c" } },
    { $unwind: "$c" },
    {
      $project: {
        _id: 0,
        customerId: "$_id",
        name: "$c.name",
        phone: "$c.phone",
        orders: 1,
        totalSpent: 1,
        lastOrderAt: 1,
      },
    },
  ]);

  res.json({ success: true, range: { from, to }, data });
};
