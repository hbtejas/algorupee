/** Express rate limiter configuration for API protection. */

const rateLimit = require("express-rate-limit");

/**
 * Create standard API limiter with 100 requests / 15 mins per IP.
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function createApiRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
}

module.exports = createApiRateLimiter;
