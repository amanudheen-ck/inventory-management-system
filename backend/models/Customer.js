const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Customer name is required"], trim: true },
    // Optional, but unique when present (sparse index ignores missing values).
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });

module.exports = mongoose.model("Customer", customerSchema);
