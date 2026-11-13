const Product = require("../models/Product");
const Category = require("../models/Category");
const Warehouse = require("../models/Warehouse");
const Supplier = require("../models/Supplier");
const StockTransaction = require("../models/StockTransaction");
const { HttpError } = require("../middleware/errorMiddleware");
const {
  escapeRegex,
  getPagination,
  buildPagination,
  parseNonNegativeInt,
  requireFields,
  pick,
} = require("../utils/helpers");

const EDITABLE_FIELDS = [
  "name", "sku", "barcode", "description", "category", "warehouse", "supplier",
  "location", "price", "costPrice", "minStock", "unit", "isActive",
];
const REF_FIELDS = ["category", "warehouse", "supplier"];
const SORTABLE = ["name", "price", "quantity", "createdAt"];
const POPULATE = [
  { path: "category", select: "name" },
  { path: "warehouse", select: "name code" },
  { path: "supplier", select: "name" },
];

// Make sure every reference the client sent actually exists.
const assertRefs = async ({ category, warehouse, supplier }) => {
  if (category && !(await Category.exists({ _id: category }))) throw new HttpError(400, "Category not found");
  if (warehouse && !(await Warehouse.exists({ _id: warehouse, isActive: true }))) {
    throw new HttpError(400, "Warehouse not found or inactive");
  }
  if (supplier && !(await Supplier.exists({ _id: supplier, isActive: true }))) {
    throw new HttpError(400, "Supplier not found or inactive");
  }
};

// Staff don't need to see what the business paid for stock.
const hideCostFor = (user) => (user.role === "staff" ? "-costPrice" : null);

// ------------------------------------------------------------------ products

// GET /api/products?search=&category=&warehouse=&supplier=&lowStock=true&includeInactive=true&sortBy=&order=&page=&limit=
exports.getProducts = async (req, res) => {
  const { search, category, warehouse, supplier, lowStock, includeInactive, sortBy, order } = req.query;
  const pagination = getPagination(req.query);

  const filter = {};
  if (includeInactive !== "true") filter.isActive = true;
  if (category) filter.category = category;
  if (warehouse) filter.warehouse = warehouse;
  if (supplier) filter.supplier = supplier;
  if (lowStock === "true") filter.$expr = { $lte: ["$quantity", "$minStock"] };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { sku: rx }, { barcode: rx }, { location: rx }];
  }

  const sortField = SORTABLE.includes(sortBy) ? sortBy : "createdAt";
  const sortDir = order === "asc" ? 1 : -1;

  const query = Product.find(filter)
    .populate(POPULATE)
    .sort({ [sortField]: sortDir })
    .skip(pagination.skip)
    .limit(pagination.limit);
  const projection = hideCostFor(req.user);
  if (projection) query.select(projection);

  const [products, total] = await Promise.all([query, Product.countDocuments(filter)]);

  res.json({ success: true, data: products, pagination: buildPagination(total, pagination) });
};

// GET /api/products/barcode/:code   - scanner lookup (matches barcode or SKU)
exports.getProductByBarcode = async (req, res) => {
  const code = String(req.params.code).trim();
  const query = Product.findOne({
    isActive: true,
    $or: [{ barcode: code }, { sku: code.toUpperCase() }],
  }).populate(POPULATE);
  const projection = hideCostFor(req.user);
  if (projection) query.select(projection);

  const product = await query;
  if (!product) throw new HttpError(404, "No product found for this barcode");

  res.json({ success: true, data: product });
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  const query = Product.findById(req.params.id).populate(POPULATE);
  const projection = hideCostFor(req.user);
  if (projection) query.select(projection);

  const product = await query;
  if (!product) throw new HttpError(404, "Product not found");

  res.json({ success: true, data: product });
};

// POST /api/products   (admin, manager)
exports.createProduct = async (req, res) => {
  requireFields(req.body, ["name", "price"]);

  const data = pick(req.body, [...EDITABLE_FIELDS.filter((f) => f !== "isActive"), "quantity"]);
  for (const f of [...REF_FIELDS, "barcode", "location"]) if (!data[f]) delete data[f];
  if (data.barcode) data.barcode = String(data.barcode).trim();
  await assertRefs(data);

  if (data.quantity !== undefined) data.quantity = parseNonNegativeInt(data.quantity, "quantity");
  if (data.minStock !== undefined) data.minStock = parseNonNegativeInt(data.minStock, "minStock");

  const product = await Product.create(data);

  if (product.quantity > 0) {
    await StockTransaction.create({
      product: product._id,
      type: "IN",
      quantity: product.quantity,
      previousQuantity: 0,
      newQuantity: product.quantity,
      reason: "Initial stock",
      performedBy: req.user._id,
    });
  }

  await product.populate(POPULATE);
  res.status(201).json({ success: true, data: product });
};

// PUT /api/products/:id   (admin, manager)
// Quantity is intentionally NOT editable here: every stock change must go
// through /api/inventory so it is logged and race-safe.
exports.updateProduct = async (req, res) => {
  if (req.body.quantity !== undefined) {
    throw new HttpError(400, "Quantity cannot be edited here. Use /api/inventory/in, /out or /adjust");
  }

  const updates = pick(req.body, EDITABLE_FIELDS);
  const unset = {};

  for (const f of REF_FIELDS) if (f in updates && !updates[f]) updates[f] = null;
  if ("barcode" in updates) {
    if (updates.barcode) updates.barcode = String(updates.barcode).trim();
    else {
      delete updates.barcode; // an empty string would collide in the unique index
      unset.barcode = 1;
    }
  }
  if ("location" in updates && !updates.location) updates.location = "";
  if (updates.minStock !== undefined) updates.minStock = parseNonNegativeInt(updates.minStock, "minStock");
  await assertRefs(updates);

  const update = { $set: updates };
  if (Object.keys(unset).length) update.$unset = unset;

  const product = await Product.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  }).populate(POPULATE);
  if (!product) throw new HttpError(404, "Product not found");

  res.json({ success: true, data: product });
};

// DELETE /api/products/:id   (admin) - soft delete keeps order/stock history intact
exports.deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw new HttpError(404, "Product not found");

  res.json({ success: true, message: "Product deactivated" });
};

// ---------------------------------------------------------------- categories

// GET /api/products/categories
exports.getCategories = async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ success: true, data: categories });
};

// POST /api/products/categories   (admin, manager)
exports.createCategory = async (req, res) => {
  requireFields(req.body, ["name"]);
  const category = await Category.create(pick(req.body, ["name", "description"]));
  res.status(201).json({ success: true, data: category });
};

// PUT /api/products/categories/:id   (admin, manager)
exports.updateCategory = async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, pick(req.body, ["name", "description"]), {
    new: true,
    runValidators: true,
  });
  if (!category) throw new HttpError(404, "Category not found");
  res.json({ success: true, data: category });
};

// DELETE /api/products/categories/:id   (admin)
exports.deleteCategory = async (req, res) => {
  if (await Product.exists({ category: req.params.id })) {
    throw new HttpError(409, "Category is used by products. Reassign them first.");
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new HttpError(404, "Category not found");
  res.json({ success: true, message: "Category deleted" });
};
