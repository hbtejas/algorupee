/** Mongoose alert model for user-defined analysis and price triggers. */

const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    alertType: {
      type: String,
      enum: ["PRICE_ABOVE", "PRICE_BELOW", "SCORE_BUY", "SCORE_SELL"],
      required: true,
    },
    threshold: { type: Number, required: true },
    active: { type: Boolean, default: true },
    triggeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);
