const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const StockTransaction = require("../models/StockTransaction");
const { HttpError } = require("../middleware/errorMiddleware");
const {
  escapeRegex,
  getPagination,
  buildPagination,
  parsePositiveInt,
  pick,
  round2,
  parseDateRange,
} = require("../utils/helpers");

const CUSTOMER_FIELDS = "name email phone address";

// Staff can only see orders they created; managers/admins see everything.
const loadOrder = async (req) => {
  const filter = { _id: req.params.id };
  if (req.user.role === "staff") filter.createdBy = req.user._id;

  const order = await Order.findOne(filter)
    .populate("customer", CUSTOMER_FIELDS)
    .populate("createdBy", "name");
  if (!order) throw new HttpError(404, "Order not found");
  return order;
};

// POST /api/orders
// body: { customer?, items: [{ productId, quantity }], discount?, taxRate?, paymentMethod?, paymentStatus?, notes? }
// Prices always come from the database, never from the client.
exports.createOrder = async (req, res) => {
  const { customer, items, notes } = req.body;
  const discount = req.body.discount === undefined ? 0 : Number(req.body.discount);
  const taxRate = req.body.taxRate === undefined ? 0 : Number(req.body.taxRate);

  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "items must be a non-empty array");
  if (items.length > 100) throw new HttpError(400, "An order can contain at most 100 lines");
  if (!Number.isFinite(discount) || discount < 0) throw new HttpError(400, "discount must be a number >= 0");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new HttpError(400, "taxRate must be between 0 and 100");
  }

  // Merge duplicate lines for the same product.
  // Items scanned on mobile carry a barcode (or SKU) instead of a product id.
  const codes = [
    ...new Set(
      items.filter((i) => i && !i.productId && !i.product && i.barcode).map((i) => String(i.barcode).trim())
    ),
  ];
  const byCode = new Map();
  if (codes.length) {
    const found = await Product.find({
      isActive: true,
      $or: [{ barcode: { $in: codes } }, { sku: { $in: codes.map((c) => c.toUpperCase()) } }],
    }).select("_id barcode sku");
    for (const p of found) {
      if (p.barcode) byCode.set(p.barcode, String(p._id));
      byCode.set(p.sku, String(p._id));
    }
  }

  const wanted = new Map();
  for (const item of items) {
    let id = String(item?.productId || item?.product || "");
    if (!id && item?.barcode) {
      const code = String(item.barcode).trim();
      id = byCode.get(code) || byCode.get(code.toUpperCase()) || "";
      if (!id) throw new HttpError(404, `No product found for barcode ${code}`);
    }
    if (!id) throw new HttpError(400, "Each item needs a productId or barcode");
    const qty = parsePositiveInt(item.quantity, "item quantity");
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  if (customer && !(await Customer.exists({ _id: customer }))) {
    throw new HttpError(404, "Customer not found");
  }

  const products = await Product.find({ _id: { $in: [...wanted.keys()] }, isActive: true });
  if (products.length !== wanted.size) throw new HttpError(404, "One or more products were not found");

  const lines = products.map((p) => {
    const quantity = wanted.get(String(p._id));
    return {
      product: p._id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      costPrice: p.costPrice,
      quantity,
      lineTotal: round2(p.price * quantity),
    };
  });

  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  if (discount > subtotal) throw new HttpError(400, "discount cannot exceed the subtotal");
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * taxRate) / 100);
  const total = round2(taxable + tax);

  // Reserve stock line by line. Each step is atomic; if anything fails we
  // put back what we already took (and remove the order if it was created).
  const reserved = [];
  let order;
  try {
    for (const line of lines) {
      const updated = await Product.changeStock(line.product, -line.quantity);
      if (!updated) throw new HttpError(400, `Insufficient stock for "${line.name}"`);
      reserved.push({ line, updated });
    }

    order = await Order.create({
      customer: customer || null,
      items: lines,
      subtotal,
      discount,
      taxRate,
      tax,
      total,
      paymentMethod: req.body.paymentMethod,
      paymentStatus: req.body.paymentStatus,
      notes,
      createdBy: req.user._id,
    });

    await StockTransaction.insertMany(
      reserved.map(({ line, updated }) => ({
        product: line.product,
        type: "OUT",
        quantity: line.quantity,
        previousQuantity: updated.quantity + line.quantity,
        newQuantity: updated.quantity,
        reason: `Sale ${order.orderNumber}`,
        order: order._id,
        performedBy: req.user._id,
      }))
    );
  } catch (err) {
    await Promise.all(
      reserved.map(({ line }) => Product.changeStock(line.product, line.quantity, { includeInactive: true }))
    );
    if (order) await Order.findByIdAndDelete(order._id);
    throw err;
  }

  const lowStock = reserved
    .filter(({ updated }) => updated.quantity <= updated.minStock)
    .map(({ updated }) => ({ product: updated._id, name: updated.name, quantity: updated.quantity }));

  await order.populate("customer", CUSTOMER_FIELDS);
  res.status(201).json({ success: true, data: order, ...(lowStock.length ? { lowStock } : {}) });
};

// GET /api/orders?status=&paymentStatus=&customer=&search=&from=&to=&page=&limit=
exports.getOrders = async (req, res) => {
  const { status, paymentStatus, customer, search } = req.query;
  const pagination = getPagination(req.query);

  const filter = {};
  if (req.user.role === "staff") filter.createdBy = req.user._id;
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (customer) filter.customer = customer;
  if (search) filter.orderNumber = new RegExp(escapeRegex(search), "i");
  if (req.query.from || req.query.to) {
    const { from, to } = parseDateRange(req.query, 3650);
    filter.createdAt = { $gte: from, $lte: to };
  }

  const [data, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name phone")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Order.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: buildPagination(total, pagination) });
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  res.json({ success: true, data: await loadOrder(req) });
};

// PATCH /api/orders/:id/cancel   (admin, manager) - returns the items to stock
exports.cancelOrder = async (req, res) => {
  // Atomic status flip: two concurrent cancels can't both restock.
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: "completed" },
    { status: "cancelled", cancelledAt: new Date() },
    { new: true }
  );

  if (!order) {
    const exists = await Order.exists({ _id: req.params.id });
    if (!exists) throw new HttpError(404, "Order not found");
    throw new HttpError(400, "Order is already cancelled");
  }

  const logs = [];
  for (const item of order.items) {
    const product = await Product.changeStock(item.product, item.quantity, { includeInactive: true });
    if (product) {
      logs.push({
        product: item.product,
        type: "IN",
        quantity: item.quantity,
        previousQuantity: product.quantity - item.quantity,
        newQuantity: product.quantity,
        reason: `Order ${order.orderNumber} cancelled`,
        order: order._id,
        performedBy: req.user._id,
      });
    }
  }
  if (logs.length) await StockTransaction.insertMany(logs);

  res.json({ success: true, message: "Order cancelled and stock restored", data: order });
};

// PATCH /api/orders/:id/payment   (admin, manager)   { paymentStatus?, paymentMethod? }
exports.updatePayment = async (req, res) => {
  const updates = pick(req.body, ["paymentStatus", "paymentMethod"]);
  if (Object.keys(updates).length === 0) throw new HttpError(400, "Provide paymentStatus and/or paymentMethod");

  const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!order) throw new HttpError(404, "Order not found");

  res.json({ success: true, data: order });
};

// GET /api/orders/:id/invoice  - structured invoice data the frontend can render/print as PDF
exports.getInvoice = async (req, res) => {
  const order = await loadOrder(req);

  res.json({
    success: true,
    data: {
      invoiceNumber: `INV-${order.orderNumber.replace(/^ORD-/, "")}`,
      orderNumber: order.orderNumber,
      date: order.createdAt,
      status: order.status,
      seller: { name: process.env.COMPANY_NAME || "Smart Inventory" },
      customer: order.customer || { name: "Walk-in customer" },
      items: order.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        unitPrice: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      taxRate: order.taxRate,
      tax: order.tax,
      total: order.total,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      issuedBy: order.createdBy?.name,
    },
  });
};
