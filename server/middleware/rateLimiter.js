/** Express rate limiter configuration for API protection. */

const rateLimit = require("express-rate-limit");

/**
 * Create standard API limiter with 100 requests / 15 mins per IP.
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function createApiRateLimiter() {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 300 : 2000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const ip = String(req.ip || req.socket?.remoteAddress || "").toLowerCase();
      return !isProd && (ip.includes("127.0.0.1") || ip.includes("::1") || ip.includes("localhost"));
    },
    message: { error: "Too many requests, please try again later." },
  });
}

module.exports = createApiRateLimiter;
