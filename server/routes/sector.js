/** Sector proxy routes with cache and ML fallback handling. */

const express = require("express");

const router = express.Router();
let lastOverviewPayload = null;
let lastRotationPayload = null;
let lastHeatmapPayload = null;

/**
 * Build ML engine URL.
 * @param {string} path
 * @returns {string}
 */
function mlUrl(path) {
  const base = process.env.ML_ENGINE_URL || "http://localhost:5001";
  return `${base}${path}`;
}

/**
 * Read JSON from redis cache.
 * @param {import('redis').RedisClientType|null} redis
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function cacheGet(redis, key) {
  try {
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Store JSON in redis cache.
 * @param {import('redis').RedisClientType|null} redis
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 * @returns {Promise<void>}
 */
async function cacheSet(redis, key, value, ttlSeconds) {
  try {
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (_) {
    return;
  }
}

/**
 * Forward request to ML engine.
 * @param {'GET'|'POST'} method
 * @param {string} path
 * @param {any=} body
 * @returns {Promise<{status:number,data:any}>}
 */
async function forward(method, path, body) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resp = await fetch(mlUrl(path), {
        method,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      });
      const data = await resp.json();
      return { status: resp.status, data };
    } catch (_) {
      // retry once
    }
  }
  return { status: 500, data: { error: "ML engine unavailable" } };
}

/**
 * Overview route.
 */
router.get("/overview", async (req, res) => {
  const redis = req.app.locals.redis || null;
  const cacheKey = "sector:overview";
  const cached = await cacheGet(redis, cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const forceRefresh = String(req.query.forceRefresh || "false").toLowerCase() === "true";
  const result = await forward("GET", `/api/sector/overview?forceRefresh=${forceRefresh}`);
  if (result.status === 200) {
    lastOverviewPayload = result.data;
    await cacheSet(redis, cacheKey, result.data, 60);
    res.status(200).json(result.data);
    return;
  }

  if (cached) {
    res.status(200).json({ ...cached, stale: true, warning: "Using cached sector overview" });
    return;
  }

  if (lastOverviewPayload) {
    res.status(200).json({ ...lastOverviewPayload, stale: true, warning: "Using latest in-memory sector overview" });
    return;
  }

  res.status(200).json({
    sectors: [],
    stale: true,
    warning: "Sector overview temporarily unavailable",
  });
});

/**
 * Rotation route.
 */
router.get("/rotation", async (req, res) => {
  const redis = req.app.locals.redis || null;
  const cacheKey = "sector:rotation";
  const cached = await cacheGet(redis, cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const result = await forward("GET", "/api/sector/rotation");
  if (result.status === 200) {
    lastRotationPayload = result.data;
    await cacheSet(redis, cacheKey, result.data, 60);
    res.status(200).json(result.data);
    return;
  }

  if (cached) {
    res.status(200).json({ ...cached, stale: true, warning: "Using cached rotation data" });
    return;
  }

  if (lastRotationPayload) {
    res.status(200).json({ ...lastRotationPayload, stale: true, warning: "Using latest in-memory rotation data" });
    return;
  }

  res.status(200).json({
    rotation: [],
    stale: true,
    warning: "Sector rotation temporarily unavailable",
  });
});

/**
 * Heatmap route.
 */
router.get("/heatmap", async (req, res) => {
  const redis = req.app.locals.redis || null;
  const cacheKey = "sector:heatmap";
  const cached = await cacheGet(redis, cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const result = await forward("GET", "/api/sector/heatmap");
  if (result.status === 200) {
    lastHeatmapPayload = result.data;
    await cacheSet(redis, cacheKey, result.data, 45);
    res.status(200).json(result.data);
    return;
  }

  if (cached) {
    res.status(200).json({ ...cached, stale: true, warning: "Using cached sector heatmap" });
    return;
  }

  if (lastHeatmapPayload) {
    res.status(200).json({ ...lastHeatmapPayload, stale: true, warning: "Using latest in-memory sector heatmap" });
    return;
  }

  res.status(200).json({
    sectors: [],
    stale: true,
    warning: "Sector heatmap temporarily unavailable",
  });
});

/**
 * Compare route.
 */
router.get("/compare", async (req, res) => {
  const sectors = String(req.query.sectors || "");
  const result = await forward("GET", `/api/sector/compare?sectors=${encodeURIComponent(sectors)}`);
  if (result.status === 200) {
    res.status(200).json(result.data);
    return;
  }
  res.status(200).json({
    comparison: {},
    stale: true,
    warning: "Sector compare temporarily unavailable",
  });
});

/**
 * Lookup stock sector context.
 */
router.get("/lookup/:symbol", async (req, res) => {
  const symbol = String(req.params.symbol || "").trim().toUpperCase();
  const result = await forward("GET", `/api/sector/lookup/${encodeURIComponent(symbol)}`);
  if (result.status === 200) {
    res.status(200).json(result.data);
    return;
  }
  res.status(200).json({
    symbol,
    sector_name: "Unknown",
    sector_score: 50,
    sector_signal: "HOLD",
    sector_change_1m: 0,
    stock_rank_in_sector: 0,
    stocks_count: 0,
    stale: true,
    warning: "Sector lookup temporarily unavailable",
  });
});

/**
 * Top stocks by sector route.
 */
router.get("/:sectorName/top-stocks", async (req, res) => {
  const sectorName = String(req.params.sectorName || "");
  const limit = Number(req.query.limit || 5);
  const sortBy = String(req.query.sort_by || "score");
  const result = await forward(
    "GET",
    `/api/sector/${encodeURIComponent(sectorName)}/top-stocks?limit=${encodeURIComponent(limit)}&sort_by=${encodeURIComponent(sortBy)}`
  );
  if (result.status === 200) {
    res.status(200).json(result.data);
    return;
  }

  res.status(200).json({
    stocks: [],
    stale: true,
    warning: `Top stocks temporarily unavailable for ${sectorName}`,
  });
});

/**
 * Sector details route.
 */
router.get("/:sectorName", async (req, res) => {
  const sectorName = String(req.params.sectorName || "");
  const result = await forward("GET", `/api/sector/${encodeURIComponent(sectorName)}`);
  if (result.status === 200) {
    res.status(200).json(result.data);
    return;
  }

  res.status(200).json({
    sector: {
      sector_name: sectorName,
      composite_score: 0,
      momentum_score: 0,
      breadth_score: 0,
      valuation_score: 0,
      strength_score: 0,
      signal: "HOLD",
      trend: "NEUTRAL",
      outlook: "Sector detail is temporarily unavailable. Please retry shortly.",
    },
    stocks: [],
    stale: true,
    warning: `Sector detail temporarily unavailable for ${sectorName}`,
  });
});

/**
 * Force refresh sectors.
 */
router.post("/refresh", async (_req, res) => {
  const redis = _req.app.locals.redis || null;
  const result = await forward("POST", "/api/sector/refresh", {});
  if (result.status === 200) {
    await cacheSet(redis, "sector:overview", result.data, 30);
  }
  res.status(result.status).json(result.data);
});

module.exports = router;
