const Product = require("../models/Product");
const StockTransaction = require("../models/StockTransaction");
const { HttpError } = require("../middleware/errorMiddleware");
const {
  getPagination,
  buildPagination,
  parsePositiveInt,
  parseNonNegativeInt,
  requireFields,
  parseDateRange,
} = require("../utils/helpers");

// The mobile scanner sends a barcode (or SKU) instead of a product id.
const resolveProductId = async (body) => {
  const id = body.productId || body.product;
  if (id) return id;

  if (body.barcode) {
    const code = String(body.barcode).trim();
    const product = await Product.findOne({
      isActive: true,
      $or: [{ barcode: code }, { sku: code.toUpperCase() }],
    }).select("_id");
    if (!product) throw new HttpError(404, "No product found for this barcode");
    return product._id;
  }

  throw new HttpError(400, "productId or barcode is required");
};

/**
 * Moves stock and writes the audit log. The stock change is a single atomic
 * database operation, so two simultaneous requests can never oversell.
 */
const applyMovement = async ({ productId, type, quantity, reason, userId }) => {
  const delta = type === "IN" ? quantity : -quantity;
  const product = await Product.changeStock(productId, delta);

  if (!product) {
    const existing = await Product.findOne({ _id: productId, isActive: true }).select("quantity");
    if (!existing) throw new HttpError(404, "Product not found");
    throw new HttpError(400, `Insufficient stock. Available: ${existing.quantity}`);
  }

  try {
    const transaction = await StockTransaction.create({
      product: product._id,
      type,
      quantity,
      previousQuantity: product.quantity - delta,
      newQuantity: product.quantity,
      reason,
      performedBy: userId,
    });
    return { product, transaction };
  } catch (err) {
    await Product.changeStock(productId, -delta, { includeInactive: true }); // undo
    throw err;
  }
};

// POST /api/inventory/in   { productId, quantity, reason? }
exports.stockIn = async (req, res) => {
  requireFields(req.body, ["quantity"]);
  const productId = await resolveProductId(req.body);

  const { product, transaction } = await applyMovement({
    productId,
    type: "IN",
    quantity: parsePositiveInt(req.body.quantity, "quantity"),
    reason: req.body.reason || "Stock received",
    userId: req.user._id,
  });

  res.json({ success: true, data: { product, transaction } });
};

// POST /api/inventory/out   { productId, quantity, reason? }
exports.stockOut = async (req, res) => {
  requireFields(req.body, ["quantity"]);
  const productId = await resolveProductId(req.body);

  const { product, transaction } = await applyMovement({
    productId,
    type: "OUT",
    quantity: parsePositiveInt(req.body.quantity, "quantity"),
    reason: req.body.reason || "Stock removed",
    userId: req.user._id,
  });

  res.json({
    success: true,
    data: { product, transaction },
    ...(product.quantity <= product.minStock ? { warning: "Stock is at or below the minimum level" } : {}),
  });
};

// POST /api/inventory/adjust   { productId, newQuantity, reason }  (stock-take correction)
exports.adjustStock = async (req, res) => {
  requireFields(req.body, ["newQuantity", "reason"]);
  const productId = await resolveProductId(req.body);
  const newQuantity = parseNonNegativeInt(req.body.newQuantity, "newQuantity");

  // new:false returns the document as it was *before* the update.
  const before = await Product.findOneAndUpdate(
    { _id: productId, isActive: true },
    { $set: { quantity: newQuantity } },
    { new: false }
  );
  if (!before) throw new HttpError(404, "Product not found");

  let transaction;
  try {
    transaction = await StockTransaction.create({
      product: before._id,
      type: "ADJUSTMENT",
      quantity: Math.abs(newQuantity - before.quantity),
      previousQuantity: before.quantity,
      newQuantity,
      reason: req.body.reason,
      performedBy: req.user._id,
    });
  } catch (err) {
    await Product.updateOne({ _id: before._id }, { $set: { quantity: before.quantity } }); // undo
    throw err;
  }

  const product = await Product.findById(before._id);
  res.json({ success: true, data: { product, transaction } });
};

// GET /api/inventory/history?product=&type=&from=&to=&page=&limit=
exports.getHistory = async (req, res) => {
  const { product, type } = req.query;
  const pagination = getPagination(req.query, 20);

  const filter = {};
  if (product) filter.product = product;
  if (type) {
    if (!["IN", "OUT", "ADJUSTMENT"].includes(type)) throw new HttpError(400, "Invalid type");
    filter.type = type;
  }
  if (req.query.from || req.query.to) {
    const { from, to } = parseDateRange(req.query, 3650);
    filter.createdAt = { $gte: from, $lte: to };
  }

  const [data, total] = await Promise.all([
    StockTransaction.find(filter)
      .populate("product", "name sku")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    StockTransaction.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: buildPagination(total, pagination) });
};

// GET /api/inventory/low-stock
exports.getLowStock = async (req, res) => {
  const filter = { isActive: true, $expr: { $lte: ["$quantity", "$minStock"] } };
  if (req.query.warehouse) filter.warehouse = req.query.warehouse;

  const products = await Product.find(filter)
    .populate("category", "name")
    .populate("warehouse", "name code")
    .sort({ quantity: 1 });

  res.json({
    success: true,
    count: products.length,
    data: products.map((p) => {
      const item = {
        ...p.toJSON(),
        shortage: Math.max(p.minStock - p.quantity, 0),
        outOfStock: p.quantity === 0,
      };
      if (req.user.role === "staff") delete item.costPrice;
      return item;
    }),
  });
};
