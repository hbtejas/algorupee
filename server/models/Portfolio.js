/** Mongoose portfolio holding model for user investments. */

const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    buyPrice: { type: Number, required: true, min: 0 },
    buyDate: { type: Date, required: true },
    notes: { type: String, default: "", maxlength: 400 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);
