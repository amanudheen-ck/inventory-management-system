const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const { HttpError } = require("../middleware/errorMiddleware");
const { escapeRegex, getPagination, buildPagination, requireFields, pick } = require("../utils/helpers");

const FIELDS = ["name", "contactPerson", "email", "phone", "address", "gstin", "notes"];

// GET /api/suppliers?search=&includeInactive=true&page=&limit=
exports.getSuppliers = async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ name: rx }, { contactPerson: rx }, { phone: rx }, { gstin: rx }];
  }

  const [data, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit),
    Supplier.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: buildPagination(total, pagination) });
};

// GET /api/suppliers/:id   (includes how many active products they supply)
exports.getSupplierById = async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new HttpError(404, "Supplier not found");

  const productCount = await Product.countDocuments({ supplier: supplier._id, isActive: true });
  res.json({ success: true, data: { ...supplier.toJSON(), productCount } });
};

// POST /api/suppliers
exports.createSupplier = async (req, res) => {
  requireFields(req.body, ["name"]);
  const data = pick(req.body, FIELDS);
  for (const key of Object.keys(data)) if (data[key] === "") delete data[key];

  const supplier = await Supplier.create(data);
  res.status(201).json({ success: true, data: supplier });
};

// PUT /api/suppliers/:id   (set isActive:false to stop using a supplier)
exports.updateSupplier = async (req, res) => {
  const updates = pick(req.body, [...FIELDS, "isActive"]);
  if (updates.isActive !== undefined && typeof updates.isActive !== "boolean") {
    throw new HttpError(400, "isActive must be true or false");
  }

  const supplier = await Supplier.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!supplier) throw new HttpError(404, "Supplier not found");

  res.json({ success: true, data: supplier });
};

// DELETE /api/suppliers/:id
exports.deleteSupplier = async (req, res) => {
  if (await Product.exists({ supplier: req.params.id })) {
    throw new HttpError(409, "Products are linked to this supplier. Deactivate it instead (isActive: false).");
  }
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new HttpError(404, "Supplier not found");

  res.json({ success: true, message: "Supplier deleted" });
};
