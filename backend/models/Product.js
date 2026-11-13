const mongoose = require("mongoose");

const generateSKU = () =>
  `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Product name is required"], trim: true },
    sku: { type: String, trim: true, uppercase: true, unique: true },
    // EAN/UPC/QR value printed on the item. Optional, but unique when present.
    barcode: { type: String, trim: true, unique: true, sparse: true },
    description: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    // Where the item sits inside the warehouse, e.g. "Aisle 2 · Shelf B-01".
    location: { type: String, trim: true },
    price: { type: Number, required: [true, "Price is required"], min: [0, "Price must be >= 0"] },
    costPrice: { type: Number, default: 0, min: [0, "Cost price must be >= 0"] },
    quantity: { type: Number, default: 0, min: [0, "Quantity cannot be negative"] },
    minStock: { type: Number, default: 0, min: [0, "Minimum stock must be >= 0"] },
    unit: { type: String, default: "pcs", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ name: 1 });
productSchema.index({ warehouse: 1, isActive: 1 });
productSchema.index({ supplier: 1 });

productSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.minStock;
});

// Runs *before* validation so the required/unique checks see the generated SKU.
productSchema.pre("validate", function () {
  if (!this.sku) this.sku = generateSKU();
});

/**
 * Atomically changes stock by `delta` (positive = add, negative = remove).
 * Removal only succeeds if enough stock exists, so quantity can never go
 * negative even with concurrent requests. Returns the updated document,
 * or null if the product wasn't found / stock was insufficient.
 */
productSchema.statics.changeStock = function (productId, delta, { includeInactive = false } = {}) {
  const filter = { _id: productId };
  if (!includeInactive) filter.isActive = true;
  if (delta < 0) filter.quantity = { $gte: -delta };

  return this.findOneAndUpdate(filter, { $inc: { quantity: delta } }, { new: true });
};

module.exports = mongoose.model("Product", productSchema);
