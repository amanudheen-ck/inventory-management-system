const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Supplier name is required"], trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    // Indian GST number (15 characters), optional.
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[0-9A-Z]{15}$/, "GSTIN must be 15 letters/digits"],
    },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ name: 1 });

module.exports = mongoose.model("Supplier", supplierSchema);
