/** Alert routes for creating and managing stock/score alert rules. */

const express = require("express");
const Alert = require("../models/Alert");
const auth = require("../middleware/auth");

const router = express.Router();
const VALID_TYPES = ["PRICE_ABOVE", "PRICE_BELOW", "SCORE_BUY", "SCORE_SELL"];

/**
 * Validate alert payload.
 * @param {any} body
 * @returns {{valid: boolean, message?: string}}
 */
function validateAlertPayload(body) {
  const { symbol, type, threshold } = body || {};
  if (!symbol || !type || threshold == null) {
    return { valid: false, message: "symbol, type, threshold are required" };
  }
  if (!VALID_TYPES.includes(String(type))) {
    return { valid: false, message: "Invalid alert type" };
  }
  if (Number.isNaN(Number(threshold))) {
    return { valid: false, message: "threshold must be numeric" };
  }
  return { valid: true };
}

router.get("/", auth, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ alerts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.post("/create", auth, async (req, res) => {
  try {
    const check = validateAlertPayload(req.body);
    if (!check.valid) {
      res.status(400).json({ error: check.message });
      return;
    }

    const { symbol, type, threshold } = req.body;
    const created = await Alert.create({
      userId: req.user.id,
      symbol: String(symbol).toUpperCase(),
      alertType: String(type),
      threshold: Number(threshold),
      active: true,
    });

    res.status(201).json({ alert: created });
  } catch (error) {
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await Alert.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

module.exports = router;
