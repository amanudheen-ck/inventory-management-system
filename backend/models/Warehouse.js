const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Warehouse name is required"], trim: true },
    code: {
      type: String,
      required: [true, "Warehouse code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    // Maximum number of units the site can hold. 0 = not set.
    capacity: { type: Number, default: 0, min: [0, "Capacity must be >= 0"] },
    status: { type: String, enum: ["online", "degraded", "offline"], default: "online" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Warehouse", warehouseSchema);
