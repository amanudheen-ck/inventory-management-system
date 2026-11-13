const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const StockTransaction = require("../models/StockTransaction");
const Warehouse = require("../models/Warehouse");
const Category = require("../models/Category");
const { daysAgo, startOfDay } = require("../utils/helpers");

const TZ = process.env.TZ || "UTC";
const dayKey = (date) => date.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

const salesSince = async (from) => {
  const [row] = await Order.aggregate([
    { $match: { status: "completed", createdAt: { $gte: from } } },
    { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
  ]);
  return { revenue: row?.revenue || 0, orders: row?.orders || 0 };
};

// GET /api/dashboard
exports.getDashboard = async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const canSeeValue = req.user.role !== "staff";

  const [
    stockStats,
    customerCount,
    today,
    month,
    dailySales,
    topProducts,
    lowStockItems,
    recentOrders,
    recentMovements,
    byWarehouse,
    byCategory,
  ] = await Promise.all([
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalUnits: { $sum: "$quantity" },
          costValue: { $sum: { $multiply: ["$quantity", "$costPrice"] } },
          retailValue: { $sum: { $multiply: ["$quantity", "$price"] } },
          lowStock: {
            $sum: {
              $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$minStock"] }] }, 1, 0],
            },
          },
          outOfStock: { $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] } },
        },
      },
    ]),
    Customer.estimatedDocumentCount(),
    salesSince(startOfDay()),
    salesSince(monthStart),
    Order.aggregate([
      { $match: { status: "completed", createdAt: { $gte: daysAgo(6) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { status: "completed", createdAt: { $gte: daysAgo(29) } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          unitsSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
    ]),
    Product.find({ isActive: true, $expr: { $lte: ["$quantity", "$minStock"] } })
      .select("name sku quantity minStock")
      .sort({ quantity: 1 })
      .limit(5),
    Order.find()
      .where(req.user.role === "staff" ? { createdBy: req.user._id } : {})
      .populate("customer", "name")
      .select("orderNumber customer total status createdAt")
      .sort({ createdAt: -1 })
      .limit(5),
    StockTransaction.find()
      .populate("product", "name sku")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .limit(5),
    Product.aggregate([
      { $match: { isActive: true, warehouse: { $ne: null } } },
      { $group: { _id: "$warehouse", units: { $sum: "$quantity" }, skus: { $sum: 1 } } },
      { $lookup: { from: Warehouse.collection.name, localField: "_id", foreignField: "_id", as: "w" } },
      { $unwind: "$w" },
      {
        $project: {
          _id: 0,
          warehouseId: "$_id",
          name: "$w.name",
          code: "$w.code",
          units: 1,
          skus: 1,
          capacity: "$w.capacity",
          utilization: {
            $cond: [
              { $gt: ["$w.capacity", 0] },
              { $round: [{ $multiply: [{ $divide: ["$units", "$w.capacity"] }, 100] }, 1] },
              null,
            ],
          },
        },
      },
      { $sort: { units: -1 } },
    ]),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", units: { $sum: "$quantity" }, skus: { $sum: 1 } } },
      { $lookup: { from: Category.collection.name, localField: "_id", foreignField: "_id", as: "c" } },
      { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ["$c.name", "Uncategorized"] }, units: 1, skus: 1 } },
      { $sort: { skus: -1 } },
    ]),
  ]);

  // Fill days with no sales so charts get a continuous 7-day series.
  const byDay = new Map(dailySales.map((d) => [d._id, d]));
  const salesLast7Days = [];
  for (let i = 6; i >= 0; i--) {
    const key = dayKey(daysAgo(i));
    const row = byDay.get(key);
    salesLast7Days.push({ date: key, revenue: row?.revenue || 0, orders: row?.orders || 0 });
  }

  const s = stockStats[0] || {};
  res.json({
    success: true,
    data: {
      totals: {
        products: s.totalProducts || 0,
        units: s.totalUnits || 0,
        customers: customerCount,
        lowStock: s.lowStock || 0,
        outOfStock: s.outOfStock || 0,
        ...(canSeeValue ? { inventoryCostValue: s.costValue || 0, inventoryRetailValue: s.retailValue || 0 } : {}),
      },
      sales: { today, thisMonth: month },
      salesLast7Days,
      topProducts,
      lowStockItems,
      recentOrders,
      recentMovements,
      stockByWarehouse: byWarehouse,
      stockByCategory: byCategory,
    },
  });
};
