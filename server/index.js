/** Express API gateway bootstrap with auth, portfolio, alerts, and ML proxy routes. */

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { createClient } = require("redis");
const { Server } = require("socket.io");

const createApiRateLimiter = require("./middleware/rateLimiter");
const authRoutes = require("./routes/auth");
const portfolioRoutes = require("./routes/portfolio");
const alertsRoutes = require("./routes/alerts");
const proxyRoutes = require("./routes/proxy");
const sectorRoutes = require("./routes/sector");

dotenv.config();

const app = express();
const server = http.createServer(app);

/**
 * Initialize MongoDB connection.
 * @returns {Promise<void>}
 */
async function connectMongo() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is required");
    }
    await mongoose.connect(uri);
    // eslint-disable-next-line no-console
    console.log("MongoDB connected");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection error:", error.message);
  }
}

/**
 * Initialize Redis client if configured.
 * @returns {Promise<import('redis').RedisClientType|null>}
 */
async function connectRedis() {
  try {
    if (!process.env.REDIS_URL) {
      return null;
    }
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("Redis error:", err.message);
    });
    await client.connect();
    // eslint-disable-next-line no-console
    console.log("Redis connected");
    return client;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Redis init failed:", error.message);
    return null;
  }
}

/**
 * Apply common HTTP middleware.
 * @returns {void}
 */
function configureMiddleware() {
  app.use(helmet());
  app.use(cors());
  app.use(require('compression')());
  app.use(require('helmet')());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use(createApiRateLimiter());
}

/**
 * Register all application routes.
 * @returns {void}
 */
function configureRoutes() {
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "server" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/portfolio", portfolioRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api/sector", sectorRoutes);
  app.use("/api", proxyRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });
}

/**
 * Initialize websocket support for future live updates.
 * @returns {void}
 */
function configureSocket() {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  /**
   * Check if market is open for NSE hours (09:15-15:30 IST, weekdays).
   * @returns {boolean}
   */
  function isMarketOpenIST() {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);

      const weekday = parts.find((p) => p.type === "weekday")?.value || "Mon";
      const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
      const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
      const mins = hour * 60 + minute;

      if (weekday === "Sat" || weekday === "Sun") {
        return false;
      }
      return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
    } catch (error) {
      return false;
    }
  }

  const subscriptions = new Map();
  let lastSectorOverview = null;
  let lastSectorEmitAt = 0;

  /**
   * Increase subscriber count for symbol.
   * @param {string} symbol
   */
  function addSubscription(symbol) {
    const s = String(symbol || "").toUpperCase();
    if (!s) return;
    subscriptions.set(s, (subscriptions.get(s) || 0) + 1);
  }

  /**
   * Decrease subscriber count for symbol.
   * @param {string} symbol
   */
  function removeSubscription(symbol) {
    const s = String(symbol || "").toUpperCase();
    if (!s) return;
    const current = subscriptions.get(s) || 0;
    if (current <= 1) {
      subscriptions.delete(s);
      return;
    }
    subscriptions.set(s, current - 1);
  }

  /**
   * Pull latest analysis score and emit to subscribers.
   * @param {string} symbol
   * @returns {Promise<void>}
   */
  async function emitScoreUpdate(symbol) {
    try {
      const base = process.env.ML_ENGINE_URL || "http://localhost:5001";
      const resp = await fetch(`${base}/api/analysis/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, forceRefresh: true }),
      });
      if (!resp.ok) return;
      const analysis = await resp.json();
      io.to(`symbol:${symbol}`).emit("score:update", {
        symbol,
        timestamp: new Date().toISOString(),
        recommendation: analysis.recommendation,
        scores: analysis.scores,
      });
    } catch (error) {
      return;
    }
  }

  /**
   * Emit full sector overview payload.
   * @returns {Promise<void>}
   */
  async function emitSectorUpdate() {
    try {
      const resp = await fetch("http://localhost:5000/api/sector/overview", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
      });
      if (!resp.ok) {
        return;
      }
      const payload = await resp.json();
      if (!payload || !Array.isArray(payload.sectors)) {
        return;
      }

      lastSectorOverview = payload;
      io.emit("sector_update", {
        timestamp: new Date().toISOString(),
        ...payload,
      });
    } catch (_) {
      if (lastSectorOverview) {
        io.emit("sector_update", {
          timestamp: new Date().toISOString(),
          ...lastSectorOverview,
          stale: true,
        });
      }
    }
  }

  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true, id: socket.id });

    socket.data.subscribedSymbols = new Set();

    socket.on("subscribe:score", (payload) => {
      const symbol = String(payload?.symbol || "").toUpperCase();
      if (!symbol) return;
      socket.join(`symbol:${symbol}`);
      socket.data.subscribedSymbols.add(symbol);
      addSubscription(symbol);
    });

    socket.on("unsubscribe:score", (payload) => {
      const symbol = String(payload?.symbol || "").toUpperCase();
      if (!symbol) return;
      socket.leave(`symbol:${symbol}`);
      socket.data.subscribedSymbols.delete(symbol);
      removeSubscription(symbol);
    });

    socket.on("disconnect", () => {
      for (const symbol of socket.data.subscribedSymbols || []) {
        removeSubscription(symbol);
      }
    });

    if (lastSectorOverview) {
      socket.emit("sector_update", {
        timestamp: new Date().toISOString(),
        ...lastSectorOverview,
      });
    }
  });

  setInterval(async () => {
    try {
      if (!isMarketOpenIST()) {
        return;
      }
      const symbols = Array.from(subscriptions.keys());
      if (!symbols.length) {
        return;
      }
      await Promise.all(symbols.map((symbol) => emitScoreUpdate(symbol)));
    } catch (error) {
      return;
    }
  }, 60 * 1000);

  setInterval(async () => {
    try {
      const targetGap = isMarketOpenIST() ? 60 * 1000 : 5 * 60 * 1000;
      const now = Date.now();
      if (now - lastSectorEmitAt < targetGap) {
        return;
      }
      await emitSectorUpdate();
      lastSectorEmitAt = now;
    } catch (_) {
      return;
    }
  }, 15 * 1000);
}

/**
 * Start server and external connections.
 * @returns {Promise<void>}
 */
async function bootstrap() {
  const port = Number(process.env.PORT || 5000);

  // If same service is already running, treat startup as successful and exit cleanly.
  try {
    const resp = await fetch(`http://localhost:${port}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    });
    if (resp.ok) {
      // eslint-disable-next-line no-console
      console.log(`Server already running on port ${port}. Reusing existing instance.`);
      return;
    }
  } catch (_) {
    // Port likely free or service not ready, continue normal startup.
  }

  configureMiddleware();
  configureRoutes();
  configureSocket();

  await connectMongo();
  app.locals.redis = await connectRedis();

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap server:", error.message);
});
