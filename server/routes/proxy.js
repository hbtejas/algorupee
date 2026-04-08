/** Proxy routes to forward analysis/backtest calls to Python ML engine with optional Redis caching. */

const express = require("express");

const router = express.Router();

const MARKET_SYMBOLS = ["^NSEI", "^BSESN", "^NSEBANK"];
const MARKET_LABELS = {
  "^NSEI": "NIFTY 50",
  "^BSESN": "SENSEX",
  "^NSEBANK": "NIFTY BANK",
};

const NIFTY50_CONSTITUENTS = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "LT", "HINDUNILVR", "BHARTIARTL",
  "KOTAKBANK", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", "HCLTECH", "WIPRO", "TECHM", "MARUTI", "TATAMOTORS", "M&M",
  "ULTRACEMCO", "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "TATASTEEL", "JSWSTEEL", "HINDALCO", "ADANIENT", "ADANIPORTS",
  "POWERGRID", "NTPC", "ONGC", "COALINDIA", "ASIANPAINT", "NESTLEIND", "BRITANNIA", "TITAN", "GRASIM", "EICHERMOT",
  "HEROMOTOCO", "BPCL", "APOLLOHOSP", "INDUSINDBK", "BAJAJ-AUTO", "SHRIRAMFIN", "TATACONSUM", "SBILIFE", "HDFCLIFE", "UPL",
];

const SENSEX_CONSTITUENTS = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "LT", "HINDUNILVR", "BHARTIARTL",
  "KOTAKBANK", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", "HCLTECH", "MARUTI", "TATAMOTORS", "M&M", "ULTRACEMCO", "SUNPHARMA",
  "TATASTEEL", "POWERGRID", "NTPC", "ASIANPAINT", "NESTLEIND", "TITAN", "WIPRO", "TECHM", "INDUSINDBK", "ADANIPORTS",
];

let lastMarketOverview = [];
const lastHeatmapByIndex = {
  nifty50: null,
  sensex: null,
};
const lastQuoteBySymbol = new Map();
let nseCookieHeader = "";
let nseCookieExpiry = 0;

/**
 * Build full URL to ML engine endpoint.
 * @param {string} path
 * @returns {string}
 */
function mlUrl(path) {
  const base = process.env.ML_ENGINE_URL || "http://localhost:5001";
  return `${base}${path}`;
}

/**
 * Read cached JSON payload for a key.
 * @param {import('redis').RedisClientType|null} redis
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function cacheGet(redis, key) {
  try {
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Save JSON payload in cache.
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
  } catch (error) {
    return;
  }
}

/**
 * Forward JSON request to ML engine.
 * @param {'GET'|'POST'} method
 * @param {string} path
 * @param {object=} body
 * @returns {Promise<{status:number,data:any}>}
 */
async function forwardJson(method, path, body) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const resp = await fetch(mlUrl(path), {
        method,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      });
      let data = {};
      try {
        data = await resp.json();
      } catch (_) {
        data = { error: `Upstream returned ${resp.status}` };
      }
      return { status: resp.status, data };
    } catch (_) {
      // retry once
    }
  }
  return { status: 500, data: { error: "ML engine unavailable" } };
}

/**
 * Build synthetic analysis payload to keep UI functional when ML is unavailable.
 * @param {string} symbol
 * @returns {any}
 */
function syntheticAnalysisPayload(symbol) {
  const base = String(symbol || "").toUpperCase();
  return {
    symbol: base,
    company_name: base,
    current_price: 0,
    currency: "INR",
    analysis_timestamp: new Date().toISOString(),
    recommendation: {
      action: "HOLD",
      final_score: 50,
      confidence: 50,
      risk_level: "MEDIUM",
    },
    scores: {
      fundamental: { score: 50, weight: 0.4 },
      technical: { score: 50, weight: 0.3 },
      sentiment: { score: 50, weight: 0.2 },
      volume: { score: 50, weight: 0.1 },
    },
    prediction: {
      direction_7d: { prediction: "SIDEWAYS", probability: 0.5 },
      direction_30d: { prediction: "SIDEWAYS", probability: 0.5 },
      predicted_price_7d: 0,
      price_change_pct_7d: 0,
      confidence: 0.5,
    },
    technicals: {
      rsi: 50,
      macd: 0,
      macd_signal: 0,
      macd_histogram: 0,
      bb_percent: 50,
      bb_upper: 0,
      bb_lower: 0,
      ma_50: 0,
      ma_200: 0,
      ema_20: 0,
      volume_ratio: 1,
      golden_cross: false,
      above_ma50: false,
      above_ma200: false,
      ret_1d: 0,
      ret_5d: 0,
      ret_30d: 0,
    },
    fundamentals: {
      pe_ratio: null,
      forward_pe: null,
      pb_ratio: null,
      roe: null,
      roa: null,
      debt_to_equity: null,
      current_ratio: null,
      revenue_growth: null,
      earnings_growth: null,
      profit_margin: null,
      market_cap: null,
      dividend_yield: null,
      "52w_high": null,
      "52w_low": null,
      beta: null,
      sector: "Unknown",
      industry: "Unknown",
      business_model: `${base} fundamentals are temporarily unavailable due to upstream provider issues.`,
      promoter_holding_pct: null,
      institutional_holding_pct: null,
      website: `https://finance.yahoo.com/quote/${base}.NS`,
    },
    sentiment: {
      score: 50,
      label: "NEUTRAL",
      article_count: 0,
      recent_articles: [],
    },
    explainability: {
      positive_factors: ["Live fundamentals feed is delayed; default neutral model applied."],
      negative_factors: ["Realtime ML provider unavailable at this moment."],
      key_risks: ["Model signals are currently stale."],
    },
    chart_data: syntheticHistoryPayload(base).chart_data,
    stale: true,
    warning: "ML engine unavailable. Showing synthetic analysis fallback.",
  };
}

/**
 * Fetch realtime index quotes for Indian market overview.
 * @returns {Promise<any[]>}
 */
async function fetchMarketOverview() {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(MARKET_SYMBOLS.join(","))}`;
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) {
      return [];
    }
    const payload = await resp.json();
    const quotes = payload?.quoteResponse?.result || [];
    return quotes
      .filter((q) => MARKET_SYMBOLS.includes(q.symbol))
      .map((q) => ({
        symbol: q.symbol,
        name: MARKET_LABELS[q.symbol] || q.symbol,
        value: Number(q.regularMarketPrice || 0),
        changePct: Number(q.regularMarketChangePercent || 0),
        change: Number(q.regularMarketChange || 0),
        updatedAt: q.regularMarketTime ? new Date(Number(q.regularMarketTime) * 1000).toISOString() : new Date().toISOString(),
      }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetch URL with basic retry.
 * @param {string} url
 * @param {number} retries
 * @returns {Promise<Response|null>}
 */
async function fetchWithRetry(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const resp = await fetch(url, { method: "GET", signal: AbortSignal.timeout(6000) });
      if (resp.ok) {
        return resp;
      }
    } catch (_) {
      // ignore and retry
    }
  }
  return null;
}

/**
 * Fallback company list when ML search service is unavailable.
 * @returns {Array<{symbol:string,name:string,exchange:string,sector:string,current_price:number}>}
 */
function fallbackSearchList() {
  const symbols = Array.from(new Set([...NIFTY50_CONSTITUENTS, ...SENSEX_CONSTITUENTS])).slice(0, 60);
  return symbols.map((symbol) => ({
    symbol,
    name: `${symbol} (NSE/BSE)`,
    exchange: "NSE",
    sector: "Unknown",
    current_price: 0,
  }));
}

/**
 * Parse number from mixed string/number values.
 * @param {any} value
 * @returns {number}
 */
function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const raw = String(value ?? "").replace(/,/g, "").trim();
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Build synthetic chart series to keep chart UI functional when providers fail.
 * @param {string} symbol
 * @returns {{symbol:string, chart_data:any[], stale:boolean, warning:string}}
 */
function syntheticHistoryPayload(symbol) {
  const points = [];
  const price = 0.01;
  const days = 180;
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    points.push({
      date: d.toISOString().slice(0, 10),
      Open: price,
      High: price,
      Low: price,
      Close: price,
      Volume: 0,
      rsi: 50,
      macd: 0,
      macd_signal: 0,
      macd_histogram: 0,
      bb_upper: price,
      bb_lower: price,
      bb_percent: 50,
      ma_50: price,
      ma_200: price,
      ema_20: price,
      volume_ratio: 1,
      ret_1d: 0,
      ret_5d: 0,
      ret_30d: 0,
    });
  }

  return {
    symbol,
    chart_data: points,
    stale: true,
    warning: "Using synthetic history fallback",
  };
}

/**
 * Normalize heatmap payload shape for stable client rendering.
 * @param {any} payload
 * @param {number} total
 * @returns {any}
 */
function normalizeHeatmapPayload(payload, total = 0) {
  const rows = Array.isArray(payload?.constituents) ? payload.constituents : [];
  const normalizedRows = rows.map((row) => {
    const hasPrice = Number.isFinite(Number(row?.value)) && Number(row?.value) > 0;
    const status = row?.data_status || (hasPrice ? (row?.stale ? "cached" : "live") : "unavailable");
    return {
      ...row,
      data_status: status,
    };
  });

  const computedLive = normalizedRows.filter((r) => r.data_status === "live").length;
  const computedCached = normalizedRows.filter((r) => r.data_status === "cached").length;
  const computedUnavailable = Math.max(normalizedRows.length - computedLive - computedCached, 0);
  const computedUsable = computedLive + computedCached;

  return {
    ...payload,
    constituents: normalizedRows,
    coverage: {
      live: Number(payload?.coverage?.live ?? computedUsable),
      true_live: Number(payload?.coverage?.true_live ?? computedLive),
      cached: Number(payload?.coverage?.cached ?? computedCached),
      unavailable: Number(payload?.coverage?.unavailable ?? computedUnavailable),
      total: Number(payload?.coverage?.total ?? total ?? normalizedRows.length),
      pct: Number(payload?.coverage?.pct ?? (normalizedRows.length ? (computedUsable / normalizedRows.length) * 100 : 0)),
    },
  };
}

/**
 * Try ML analysis payload as a final price source when realtime quotes are blocked.
 * @param {string} symbol
 * @returns {Promise<any|null>}
 */
async function fetchAnalysisPriceFallback(symbol) {
  try {
    const key = String(symbol || "").toUpperCase();
    if (!key) {
      return null;
    }

    const analysisResult = await forwardJson("POST", "/api/analysis/analyze", { symbol: key, forceRefresh: false });
    if (analysisResult.status !== 200) {
      return null;
    }

    const data = analysisResult.data || {};
    const price = Number(data.current_price || 0);
    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    const ret1d = Number(data?.technicals?.ret_1d || 0);
    const changePct = Number.isFinite(ret1d) ? ret1d : 0;
    const change = Number((price * changePct) / 100);

    return {
      symbol: key,
      name: key,
      value: price,
      change,
      changePct,
      stale: true,
      data_status: "cached",
      source: "analysis-fallback",
    };
  } catch (_) {
    return null;
  }
}

/**
 * Get reusable NSE cookie header for quote endpoints.
 * @returns {Promise<string>}
 */
async function getNseCookieHeader() {
  const now = Date.now();
  if (nseCookieHeader && now < nseCookieExpiry) {
    return nseCookieHeader;
  }

  try {
    const resp = await fetch("https://www.nseindia.com/", {
      method: "GET",
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
      },
    });

    const setCookies = typeof resp.headers.getSetCookie === "function"
      ? resp.headers.getSetCookie()
      : [resp.headers.get("set-cookie")].filter(Boolean);

    if (!setCookies.length) {
      return "";
    }

    const cookieParts = setCookies
      .map((cookie) => String(cookie || "").trim().split(";")[0])
      .filter(Boolean);

    nseCookieHeader = cookieParts.join("; ");
    nseCookieExpiry = now + 5 * 60 * 1000;
    return nseCookieHeader;
  } catch (_) {
    return "";
  }
}

/**
 * Fetch realtime quote from NSE API as fallback.
 * @param {string} symbol
 * @returns {Promise<any|null>}
 */
async function fetchNseQuote(symbol) {
  try {
    const input = String(symbol || "").toUpperCase().replace(".NS", "").replace(".BO", "");
    if (!input || input.startsWith("^")) {
      return null;
    }

    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(input)}`;
    let payload = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const cookie = await getNseCookieHeader();
      if (!cookie) {
        continue;
      }

      const resp = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(7000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.nseindia.com/get-quotes/equity?symbol=INFY",
          Cookie: cookie,
        },
      });

      if (resp.ok) {
        payload = await resp.json();
        break;
      }

      // Force cookie refresh on next attempt.
      nseCookieHeader = "";
      nseCookieExpiry = 0;
    }

    if (!payload) {
      return null;
    }

    const priceInfo = payload?.priceInfo || {};
    const price = parseNumber(priceInfo.lastPrice);
    if (!price) {
      return null;
    }

    const change = parseNumber(priceInfo.change);
    const changePct = parseNumber(priceInfo.pChange);
    const previousClose = parseNumber(priceInfo.previousClose);

    return {
      inputSymbol: input,
      symbol: input,
      exchange: "NSE",
      marketSymbol: `${input}.NS`,
      price,
      change,
      changePct,
      previousClose,
      updatedAt: new Date().toISOString(),
      source: "nse-api",
    };
  } catch (_) {
    return null;
  }
}

/**
 * Fetch batch quote details for heatmap constituents.
 * @param {string[]} symbols
 * @returns {Promise<any[]>}
 */
async function fetchHeatmapQuotes(symbols, isSensex = false) {
  try {
    const bySymbol = new Map();
    async function fetchChartFast(baseSymbol) {
      const key = String(baseSymbol || '').toUpperCase();
      const isInd = key.includes('.');
      const suffix = isSensex ? '.BO' : '.NS';
      const candidate = isInd ? key : key + suffix;
      try {
        const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(candidate) + "?interval=1d&range=1d";
        const resp = await fetchWithRetry(url, 2);
        if (!resp) return;
        const payload = await resp.json();
        const result = payload?.chart?.result?.[0];
        const meta = result?.meta;
        if (meta && Number.isFinite(Number(meta.regularMarketPrice))) {
          const prev = Number(meta.chartPreviousClose || meta.previousClose || 0);
          const px = Number(meta.regularMarketPrice);
          bySymbol.set(key, {
            symbol: key,
            name: key,
            value: px,
            change: px - prev,
            changePct: prev && px ? ((px - prev) / prev) * 100 : 0,
          });
        }
      } catch (err) {}
    }
    const parallel = 25;
    for (let i = 0; i < symbols.length; i += parallel) {
      const group = symbols.slice(i, i + parallel);
      await Promise.all(group.map((sym) => fetchChartFast(sym)));
      if (i > 0) await new Promise((r) => setTimeout(r, 400));
    }
    return Array.from(bySymbol.values());
  } catch (error) {
    return [];
  }
}

/**
 * Build candidate ticker symbols for Indian stocks.
 * @param {string} raw
 * @returns {string[]}
 */
function quoteCandidates(raw) {
  const symbol = String(raw || "").trim().toUpperCase();
  if (!symbol) {
    return [];
  }
  if (symbol.startsWith("^") || symbol.includes(".")) {
    return [symbol];
  }
  return [symbol, `${symbol}.NS`, `${symbol}.BO`];
}

/**
 * Fetch a realtime quote for a stock/index symbol.
 * @param {string} symbol
 * @returns {Promise<any|null>}
 */
async function fetchRealtimeQuote(symbol) {
  const candidates = quoteCandidates(symbol);
  for (const candidate of candidates) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(candidate)}`;
    const resp = await fetchWithRetry(url, 2);
    if (!resp) {
      continue;
    }
    try {
      const payload = await resp.json();
      const quote = payload?.quoteResponse?.result?.[0];
      if (!quote || !Number.isFinite(Number(quote.regularMarketPrice))) {
        continue;
      }
      const effectiveSymbol = String(quote.symbol || candidate).toUpperCase();
      return {
        inputSymbol: String(symbol || "").toUpperCase(),
        symbol: effectiveSymbol.replace(".NS", "").replace(".BO", ""),
        exchange: effectiveSymbol.endsWith(".BO") ? "BSE" : "NSE",
        marketSymbol: effectiveSymbol,
        price: Number(quote.regularMarketPrice || 0),
        change: Number(quote.regularMarketChange || 0),
        changePct: Number(quote.regularMarketChangePercent || 0),
        previousClose: Number(quote.regularMarketPreviousClose || 0),
        updatedAt: quote.regularMarketTime ? new Date(Number(quote.regularMarketTime) * 1000).toISOString() : new Date().toISOString(),
        source: "yahoo-finance",
      };
    } catch (_) {
      continue;
    }
  }

  // Fallback via Yahoo chart meta, useful when quote endpoint is blocked for specific symbols.
  for (const candidate of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?interval=1d&range=5d`;
      const resp = await fetchWithRetry(url, 1);
      if (!resp) {
        continue;
      }
      const payload = await resp.json();
      const result = payload?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta) {
        continue;
      }

      const price = Number(meta.regularMarketPrice || meta.chartPreviousClose || 0);
      const previousClose = Number(meta.previousClose || meta.chartPreviousClose || 0);
      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      const change = Number.isFinite(previousClose) && previousClose > 0 ? price - previousClose : 0;
      const changePct = Number.isFinite(previousClose) && previousClose > 0 ? (change / previousClose) * 100 : 0;
      const effectiveSymbol = String(meta.symbol || candidate).toUpperCase();

      return {
        inputSymbol: String(symbol || "").toUpperCase(),
        symbol: effectiveSymbol.replace(".NS", "").replace(".BO", ""),
        exchange: effectiveSymbol.endsWith(".BO") ? "BSE" : "NSE",
        marketSymbol: effectiveSymbol,
        price,
        change,
        changePct,
        previousClose,
        updatedAt: new Date().toISOString(),
        source: "yahoo-chart",
      };
    } catch (_) {
      continue;
    }
  }

  // Secondary provider fallback when Yahoo quote endpoints are blocked.
  const nseQuote = await fetchNseQuote(symbol);
  if (nseQuote) {
    return nseQuote;
  }

  return null;
}

router.post("/analysis/analyze", async (req, res) => {
  try {
    const symbol = String(req.body?.symbol || "").toUpperCase();
    const forceRefresh = Boolean(req.body?.forceRefresh);

    if (!symbol) {
      res.status(400).json({ error: "symbol is required" });
      return;
    }

    const redis = req.app.locals.redis || null;
    const cacheKey = `analysis:${symbol}`;

    if (!forceRefresh) {
      const cached = await cacheGet(redis, cacheKey);
      if (cached) {
        res.status(200).json(cached);
        return;
      }
    }

    const result = await forwardJson("POST", "/api/analysis/analyze", { symbol, forceRefresh });
    if (result.status === 200) {
      await cacheSet(redis, cacheKey, result.data, 300);
      res.status(result.status).json(result.data);
      return;
    }

    const staleCached = await cacheGet(redis, cacheKey);
    if (staleCached) {
      res.status(200).json({
        ...staleCached,
        stale: true,
        warning: "ML engine unavailable. Showing latest cached analysis.",
      });
      return;
    }

    const fallback = syntheticAnalysisPayload(symbol);
    await cacheSet(redis, cacheKey, fallback, 60);
    res.status(200).json(fallback);
  } catch (error) {
    const symbol = String(req.body?.symbol || "").toUpperCase();
    res.status(200).json(syntheticAnalysisPayload(symbol));
  }
});

router.get("/analysis/price-history/:symbol", async (req, res) => {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const period = String(req.query.period || "1y");
    const redis = req.app.locals.redis || null;
    const cacheKey = `history:${symbol}:${period}`;

    const cached = await cacheGet(redis, cacheKey);
    if (cached && Array.isArray(cached.chart_data) && cached.chart_data.length) {
      res.status(200).json(cached);
      return;
    }

    const result = await forwardJson("GET", `/api/analysis/price-history/${symbol}?period=${encodeURIComponent(period)}`);
    if (result.status === 200) {
      await cacheSet(redis, cacheKey, result.data, 300);
      res.status(result.status).json(result.data);
      return;
    }

    // Fallback: reuse chart payload from analysis endpoint when direct history route fails.
    const analyzeResult = await forwardJson("POST", "/api/analysis/analyze", { symbol, forceRefresh: false });
    const chartData = analyzeResult?.data?.chart_data;
    if (analyzeResult.status === 200 && Array.isArray(chartData) && chartData.length) {
      const fallback = {
        symbol,
        chart_data: chartData,
        stale: true,
        warning: "Using analysis chart fallback",
      };
      await cacheSet(redis, cacheKey, fallback, 120);
      res.status(200).json(fallback);
      return;
    }

    const staleCached = await cacheGet(redis, cacheKey);
    if (staleCached && Array.isArray(staleCached.chart_data) && staleCached.chart_data.length) {
      res.status(200).json({ ...staleCached, stale: true });
      return;
    }

    const fallback = syntheticHistoryPayload(symbol);
    await cacheSet(redis, cacheKey, fallback, 120);
    res.status(200).json(fallback);
  } catch (error) {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const fallback = syntheticHistoryPayload(symbol);
    res.status(200).json(fallback);
  }
});

router.get("/analysis/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const result = await forwardJson("GET", `/api/analysis/search?q=${encodeURIComponent(q)}`);
    if (result.status !== 200 || !Array.isArray(result.data)) {
      res.status(200).json(fallbackSearchList());
      return;
    }
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(200).json(fallbackSearchList());
  }
});

router.post("/backtest/run", async (req, res) => {
  try {
    const result = await forwardJson("POST", "/api/backtest/run", req.body || {});
    if (result.status === 200) {
      res.status(200).json(result.data);
      return;
    }
    res.status(200).json({
      stale: true,
      warning: "Backtest engine temporarily unavailable",
      trades: [],
      metrics: {
        total_return_pct: 0,
        max_drawdown_pct: 0,
        win_rate_pct: 0,
        sharpe: 0,
      },
      equity_curve: [],
    });
  } catch (error) {
    res.status(200).json({
      stale: true,
      warning: "Backtest engine temporarily unavailable",
      trades: [],
      metrics: {
        total_return_pct: 0,
        max_drawdown_pct: 0,
        win_rate_pct: 0,
        sharpe: 0,
      },
      equity_curve: [],
    });
  }
});

router.get("/market/overview", async (req, res) => {
  try {
    const redis = req.app.locals.redis || null;
    const cacheKey = "market:overview";
    const cached = await cacheGet(redis, cacheKey);
    if (cached && Array.isArray(cached) && cached.length) {
      res.status(200).json(cached);
      return;
    }

    let live = [];
    const mlResult = await forwardJson("GET", "/api/analysis/market-overview");
    if (mlResult.status === 200 && Array.isArray(mlResult.data)) {
      live = mlResult.data;
    } else {
      live = await fetchMarketOverview();
    }

    if (live.length) {
      lastMarketOverview = live;
      await cacheSet(redis, cacheKey, live, 10);
      res.status(200).json(live);
      return;
    }

    if (lastMarketOverview.length) {
      res.status(200).json(lastMarketOverview.map((item) => ({ ...item, stale: true })));
      return;
    }

    res.status(200).json([
      {
        symbol: "^NSEI",
        name: "NIFTY 50",
        value: 0,
        changePct: 0,
        change: 0,
        stale: true,
        updatedAt: new Date().toISOString(),
      },
      {
        symbol: "^BSESN",
        name: "SENSEX",
        value: 0,
        changePct: 0,
        change: 0,
        stale: true,
        updatedAt: new Date().toISOString(),
      },
      {
        symbol: "^NSEBANK",
        name: "NIFTY BANK",
        value: 0,
        changePct: 0,
        change: 0,
        stale: true,
        updatedAt: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch market overview" });
  }
});

router.get("/market/quote/:symbol", async (req, res) => {
  try {
    const symbol = String(req.params.symbol || "").trim().toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: "symbol is required" });
      return;
    }

    const redis = req.app.locals.redis || null;
    const cacheKey = `quote:${symbol}`;
    const cached = await cacheGet(redis, cacheKey);
    if (cached && Number.isFinite(Number(cached.price))) {
      res.status(200).json(cached);
      return;
    }

    let quote = await fetchRealtimeQuote(symbol);
    if (!quote) {
      const mlResult = await forwardJson("GET", `/api/analysis/quote/${encodeURIComponent(symbol)}`);
      if (mlResult.status === 200 && mlResult.data && Number.isFinite(Number(mlResult.data.price))) {
        quote = mlResult.data;
      }
    }

    if (!quote) {
      // Fallback to analysis payload when realtime providers are unavailable.
      const analysisResult = await forwardJson("POST", "/api/analysis/analyze", { symbol, forceRefresh: false });
      const analysis = analysisResult.status === 200 ? analysisResult.data : null;
      if (analysis && Number.isFinite(Number(analysis.current_price))) {
        quote = {
          inputSymbol: symbol,
          symbol,
          exchange: "NSE",
          marketSymbol: `${symbol}.NS`,
          price: Number(analysis.current_price || 0),
          change: 0,
          changePct: Number(analysis?.technicals?.ret_1d || 0),
          previousClose: 0,
          updatedAt: new Date().toISOString(),
          source: "analysis-fallback",
          stale: true,
        };
      }
    }

    if (!quote) {
      const stale = lastQuoteBySymbol.get(symbol);
      if (stale) {
        res.status(200).json({ ...stale, stale: true, updatedAt: new Date().toISOString() });
        return;
      }
      res.status(200).json({
        inputSymbol: symbol,
        symbol,
        exchange: "NSE",
        marketSymbol: `${symbol}.NS`,
        price: null,
        change: 0,
        changePct: 0,
        previousClose: null,
        updatedAt: new Date().toISOString(),
        source: "unavailable",
        stale: true,
        error: `Realtime quote not found for ${symbol}`,
      });
      return;
    }

    await cacheSet(redis, cacheKey, quote, 5);
    lastQuoteBySymbol.set(symbol, quote);
    res.status(200).json(quote);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch realtime quote" });
  }
});

async function serveMarketHeatmap(req, res) {
  try {
    const index = String(req.query.index || "nifty50").toLowerCase();
    const normalizedIndex = index === "sensex" ? "sensex" : "nifty50";
    const symbols = normalizedIndex === "sensex" ? SENSEX_CONSTITUENTS : NIFTY50_CONSTITUENTS;

    const redis = req.app.locals.redis || null;
    const cacheKey = `market:heatmap:${normalizedIndex}`;
    const cached = await cacheGet(redis, cacheKey);
    if (cached && Array.isArray(cached.constituents)) {
      res.status(200).json(normalizeHeatmapPayload(cached, symbols.length));
      return;
    }

    let constituents = await Promise.race([
      fetchHeatmapQuotes(symbols, normalizedIndex === "sensex"),
      new Promise((resolve) => setTimeout(() => resolve([]), 15000)),
    ]);

    // Recovery pass with a shorter universe for quick partial real-data response.
    if (!constituents.length) {
      const shortlist = symbols.slice(0, 12);
      constituents = await fetchHeatmapQuotes(shortlist, normalizedIndex === "sensex");
    }

      const payload = {
      index: normalizedIndex,
      indexName: normalizedIndex === "sensex" ? "SENSEX" : "NIFTY 50",
      updatedAt: new Date().toISOString(),
      constituents,
    };

    // Always return full index members: prefer live quote, then previous snapshot, then neutral placeholder.
    const liveMap = new Map((constituents || []).map((item) => [String(item.symbol || "").toUpperCase(), item]));
    const previousRows = lastHeatmapByIndex[normalizedIndex]?.constituents || [];
    const previousMap = new Map(previousRows.map((item) => [String(item.symbol || "").toUpperCase(), item]));

    // Fast backfill pass for missing symbols improves realtime coverage for NIFTY/SENSEX.
    const missing = symbols.filter((s) => !liveMap.has(String(s || "").toUpperCase()));
    if (missing.length) {
      const deadline = Date.now() + 12000;
      const parallel = 3;
      for (let i = 0; i < missing.length; i += parallel) {
        if (Date.now() > deadline) {
          break;
        }
        const group = missing.slice(i, i + parallel);
        await Promise.all(
          group.map(async (symbolKey) => {
            const key = String(symbolKey || "").toUpperCase();
            try {
              const quote = await fetchRealtimeQuote(key);
              if (quote && Number.isFinite(Number(quote.price)) && Number(quote.price) > 0) {
                liveMap.set(key, {
                  symbol: key,
                  name: key,
                  value: Number(quote.price || 0),
                  change: Number(quote.change || 0),
                  changePct: Number(quote.changePct || 0),
                  data_status: "live",
                  source: quote.source || "realtime",
                });
                return;
              }

              const analysisBackfill = await fetchAnalysisPriceFallback(key);
              if (analysisBackfill) {
                liveMap.set(key, analysisBackfill);
              }
            } catch (_) {
              return;
            }
          })
        );
      }
    }

    const normalizedConstituents = symbols.map((symbol) => {
        const key = String(symbol || "").toUpperCase();
        const live = liveMap.get(key);
        if (live) {
          return { ...live, stale: false, data_status: "live" };
        }
        const quoteCached = lastQuoteBySymbol.get(key);
        if (quoteCached && Number.isFinite(Number(quoteCached.price)) && Number(quoteCached.price) > 0) {
          return {
            symbol: key,
            name: key,
            value: Number(quoteCached.price || 0),
            change: Number(quoteCached.change || 0),
            changePct: Number(quoteCached.changePct || 0),
            stale: true,
            data_status: "cached",
            source: quoteCached.source || "cache",
          };
        }
        const prev = previousMap.get(key);
        if (prev) {
          return { ...prev, stale: true, data_status: "cached" };
        }
        return {
          symbol: key,
          name: key,
          value: null,
          change: null,
          changePct: null,
          stale: true,
          unavailable: false,
          data_status: "cached",
          source: "placeholder",
        };
      });

    const liveCount = normalizedConstituents.filter((row) => row.data_status === "live").length;
    const cachedCount = normalizedConstituents.filter((row) => row.data_status === "cached").length;
    const unavailableCount = normalizedConstituents.filter((row) => row.data_status === "unavailable").length;
    const usableCount = liveCount + cachedCount;
    payload.constituents = normalizedConstituents;
    payload.coverage = {
      live: usableCount,
      true_live: liveCount,
      cached: cachedCount,
      unavailable: unavailableCount,
      total: symbols.length,
      pct: symbols.length ? Number(((usableCount / symbols.length) * 100).toFixed(2)) : 0,
    };

    const minDepth = normalizedIndex === "sensex" ? 8 : 12;
    const hasUsefulDepth = liveCount >= minDepth;

    if (liveCount && hasUsefulDepth) {
      lastHeatmapByIndex[normalizedIndex] = payload;
      await cacheSet(redis, cacheKey, payload, 8);
      res.status(200).json(normalizeHeatmapPayload(payload, symbols.length));
      return;
    }

    if (liveCount && !hasUsefulDepth && lastHeatmapByIndex[normalizedIndex]?.constituents?.length >= liveCount) {
      res.status(200).json({
        ...normalizeHeatmapPayload(lastHeatmapByIndex[normalizedIndex], symbols.length),
        stale: true,
        realDataOnly: true,
        warning: "Using latest fuller heatmap snapshot",
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (lastHeatmapByIndex[normalizedIndex]?.constituents?.length) {
      res.status(200).json({
        ...normalizeHeatmapPayload(lastHeatmapByIndex[normalizedIndex], symbols.length),
        stale: true,
        realDataOnly: true,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // Real-data-only fallback: return empty stale payload instead of synthetic numbers.
    res.status(200).json({
      index: normalizedIndex,
      indexName: normalizedIndex === "sensex" ? "SENSEX" : "NIFTY 50",
      updatedAt: new Date().toISOString(),
      stale: true,
      realDataOnly: true,
      ...normalizeHeatmapPayload({ constituents: normalizedConstituents, coverage: payload.coverage }, symbols.length),
    });
    return;
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch heatmap data" });
  }
}

router.get("/market/heatmap", serveMarketHeatmap);

// Backward-compatible alias for older clients expecting /api/heatmap
router.get("/heatmap", serveMarketHeatmap);

module.exports = router;
