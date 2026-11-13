const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: { type: String, enum: ["IN", "OUT", "ADJUSTMENT"], required: true },
    // Number of units moved (always >= 0). For ADJUSTMENT it is |new - previous|.
    quantity: { type: Number, required: true, min: 0 },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ product: 1, createdAt: -1 });
stockTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
