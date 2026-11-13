const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const { HttpError } = require("../middleware/errorMiddleware");
const { requireFields, pick } = require("../utils/helpers");

const FIELDS = ["name", "code", "address", "city", "state", "capacity", "status"];

// units / SKUs / low-stock count per warehouse, computed from the products stored there
const loadStats = async (ids) => {
  const rows = await Product.aggregate([
    { $match: { isActive: true, warehouse: ids ? { $in: ids } : { $ne: null } } },
    {
      $group: {
        _id: "$warehouse",
        units: { $sum: "$quantity" },
        skus: { $sum: 1 },
        lowStock: { $sum: { $cond: [{ $lte: ["$quantity", "$minStock"] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
};

const withStats = (warehouse, stats) => {
  const s = stats.get(String(warehouse._id)) || { units: 0, skus: 0, lowStock: 0 };
  return {
    ...warehouse.toJSON(),
    stats: {
      units: s.units,
      activeSkus: s.skus,
      lowStockItems: s.lowStock,
      utilization: warehouse.capacity > 0 ? Math.round((s.units / warehouse.capacity) * 1000) / 10 : null,
    },
  };
};

// GET /api/warehouses?includeInactive=true
exports.getWarehouses = async (req, res) => {
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };
  const warehouses = await Warehouse.find(filter).sort({ name: 1 });
  const stats = await loadStats(warehouses.map((w) => w._id));

  res.json({ success: true, data: warehouses.map((w) => withStats(w, stats)) });
};

// GET /api/warehouses/:id
exports.getWarehouseById = async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw new HttpError(404, "Warehouse not found");

  const stats = await loadStats([warehouse._id]);
  res.json({ success: true, data: withStats(warehouse, stats) });
};

// POST /api/warehouses   (admin, manager)
exports.createWarehouse = async (req, res) => {
  requireFields(req.body, ["name", "code"]);
  const warehouse = await Warehouse.create(pick(req.body, FIELDS));
  res.status(201).json({ success: true, data: warehouse });
};

// PUT /api/warehouses/:id   (admin, manager)  - set isActive:false to retire a site
exports.updateWarehouse = async (req, res) => {
  const updates = pick(req.body, [...FIELDS, "isActive"]);
  const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!warehouse) throw new HttpError(404, "Warehouse not found");

  res.json({ success: true, data: warehouse });
};

// DELETE /api/warehouses/:id   (admin)
exports.deleteWarehouse = async (req, res) => {
  if (await Product.exists({ warehouse: req.params.id })) {
    throw new HttpError(409, "This warehouse still has products. Move them first, or deactivate it (isActive: false).");
  }
  const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
  if (!warehouse) throw new HttpError(404, "Warehouse not found");

  res.json({ success: true, message: "Warehouse deleted" });
};
