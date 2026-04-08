/** Portfolio routes for user holdings and summary analytics. */

const express = require("express");
const Portfolio = require("../models/Portfolio");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * Validate portfolio add payload.
 * @param {any} body
 * @returns {{valid: boolean, message?: string}}
 */
function validateAddPayload(body) {
  const { symbol, quantity, buyPrice, buyDate } = body || {};
  if (!symbol || quantity == null || buyPrice == null || !buyDate) {
    return { valid: false, message: "symbol, quantity, buyPrice, buyDate are required" };
  }
  if (Number(quantity) <= 0 || Number(buyPrice) <= 0) {
    return { valid: false, message: "quantity and buyPrice must be positive" };
  }
  if (Number.isNaN(new Date(buyDate).getTime())) {
    return { valid: false, message: "buyDate must be a valid date" };
  }
  return { valid: true };
}

/**
 * Fetch close-price history from ML engine.
 * @param {string} symbol
 * @returns {Promise<number[]>}
 */
async function fetchCloseSeries(symbol) {
  try {
    const base = process.env.ML_ENGINE_URL || "http://localhost:5001";
    const resp = await fetch(`${base}/api/analysis/price-history/${encodeURIComponent(symbol)}?period=1y`);
    if (!resp.ok) {
      return [];
    }
    const data = await resp.json();
    const closes = (data.chart_data || [])
      .map((row) => Number(row.Close))
      .filter((value) => Number.isFinite(value) && value > 0);
    return closes;
  } catch (error) {
    return [];
  }
}

/**
 * Convert close series to daily return series.
 * @param {number[]} closes
 * @returns {number[]}
 */
function toReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const current = closes[i];
    if (prev > 0 && Number.isFinite(current)) {
      returns.push(current / prev - 1);
    }
  }
  return returns;
}

/**
 * Compute annualized mean return for a return series.
 * @param {number[]} series
 * @returns {number}
 */
function annualizedReturn(series) {
  if (!series.length) return 0;
  const mean = series.reduce((acc, x) => acc + x, 0) / series.length;
  return mean * 252;
}

/**
 * Compute covariance between two return series.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function covariance(a, b) {
  const n = Math.min(a.length, b.length);
  if (n <= 1) return 0;
  const aa = a.slice(-n);
  const bb = b.slice(-n);
  const meanA = aa.reduce((acc, x) => acc + x, 0) / n;
  const meanB = bb.reduce((acc, x) => acc + x, 0) / n;
  let cov = 0;
  for (let i = 0; i < n; i += 1) {
    cov += (aa[i] - meanA) * (bb[i] - meanB);
  }
  return cov / (n - 1);
}

/**
 * Generate random long-only weights summing to 1.
 * @param {number} n
 * @returns {number[]}
 */
function randomWeights(n) {
  const vals = Array.from({ length: n }, () => Math.random());
  const sum = vals.reduce((acc, x) => acc + x, 0) || 1;
  return vals.map((x) => x / sum);
}

/**
 * Compute portfolio variance from covariance matrix.
 * @param {number[]} weights
 * @param {number[][]} cov
 * @returns {number}
 */
function portfolioVariance(weights, cov) {
  let variance = 0;
  for (let i = 0; i < weights.length; i += 1) {
    for (let j = 0; j < weights.length; j += 1) {
      variance += weights[i] * weights[j] * cov[i][j];
    }
  }
  return variance;
}

router.get("/", auth, async (req, res) => {
  try {
    const rows = await Portfolio.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ holdings: rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

router.post("/add", auth, async (req, res) => {
  try {
    const check = validateAddPayload(req.body);
    if (!check.valid) {
      res.status(400).json({ error: check.message });
      return;
    }

    const { symbol, quantity, buyPrice, buyDate, notes } = req.body;
    const row = await Portfolio.create({
      userId: req.user.id,
      symbol: String(symbol).toUpperCase(),
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      buyDate: new Date(buyDate),
      notes: notes ? String(notes) : "",
    });

    res.status(201).json({ holding: row });
  } catch (error) {
    res.status(500).json({ error: "Failed to add holding" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await Portfolio.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) {
      res.status(404).json({ error: "Holding not found" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete holding" });
  }
});

router.get("/summary", auth, async (req, res) => {
  try {
    const rows = await Portfolio.find({ userId: req.user.id });

    let totalInvested = 0;
    let totalValue = 0;
    const holdings = rows.map((h) => {
      const invested = Number(h.quantity) * Number(h.buyPrice);
      const cmp = Number(h.buyPrice);
      const value = Number(h.quantity) * cmp;
      const pnl = value - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

      totalInvested += invested;
      totalValue += value;

      return {
        id: h._id,
        symbol: h.symbol,
        quantity: h.quantity,
        buyPrice: h.buyPrice,
        cmp,
        invested: Number(invested.toFixed(2)),
        value: Number(value.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2)),
      };
    });

    const totalPnl = totalValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    res.status(200).json({
      summary: {
        totalInvested: Number(totalInvested.toFixed(2)),
        totalValue: Number(totalValue.toFixed(2)),
        totalPnl: Number(totalPnl.toFixed(2)),
        totalPnlPct: Number(totalPnlPct.toFixed(2)),
      },
      holdings,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to build portfolio summary" });
  }
});

router.get("/optimize", auth, async (req, res) => {
  try {
    const rows = await Portfolio.find({ userId: req.user.id });
    const symbols = Array.from(new Set(rows.map((h) => String(h.symbol).toUpperCase())));

    if (symbols.length < 2) {
      res.status(400).json({ error: "At least 2 distinct holdings are required for optimization" });
      return;
    }

    const closeSeries = await Promise.all(symbols.map((s) => fetchCloseSeries(s)));
    const returnSeries = closeSeries.map((series) => toReturns(series));

    if (returnSeries.some((s) => s.length < 40)) {
      res.status(400).json({ error: "Insufficient historical data for one or more holdings" });
      return;
    }

    const means = returnSeries.map((series) => annualizedReturn(series));
    const cov = returnSeries.map((a, i) => returnSeries.map((b, j) => covariance(a, b) * 252));

    let best = null;
    const riskFree = 0.05;
    const iterations = 8000;

    for (let i = 0; i < iterations; i += 1) {
      const w = randomWeights(symbols.length);
      const expectedReturn = w.reduce((acc, wi, idx) => acc + wi * means[idx], 0);
      const vol = Math.sqrt(Math.max(0, portfolioVariance(w, cov)));
      const sharpe = vol > 0 ? (expectedReturn - riskFree) / vol : -Infinity;

      if (!best || sharpe > best.sharpe) {
        best = { weights: w, expectedReturn, volatility: vol, sharpe };
      }
    }

    if (!best) {
      res.status(500).json({ error: "Could not compute optimal allocation" });
      return;
    }

    const recommendations = symbols.map((symbol, idx) => ({
      symbol,
      weight: Number((best.weights[idx] * 100).toFixed(2)),
    }));

    res.status(200).json({
      method: "Modern Portfolio Theory (max Sharpe)",
      expected_return_pct: Number((best.expectedReturn * 100).toFixed(2)),
      volatility_pct: Number((best.volatility * 100).toFixed(2)),
      sharpe_ratio: Number(best.sharpe.toFixed(3)),
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to optimize portfolio" });
  }
});

module.exports = router;
