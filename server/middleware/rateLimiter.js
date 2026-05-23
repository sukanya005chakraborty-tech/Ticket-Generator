'use strict';

/**
 * @fileoverview Rate limiter middleware instances.
 * Uses express-rate-limit with different configurations for general routes,
 * auth endpoints, and the AI generation endpoint.
 * All limiters return the standard API error envelope on rejection.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// ── Shared Handler ────────────────────────────────────────────────────────────

/**
 * Standard rate limit exceeded handler.
 * Returns a JSON error response matching the project's error envelope.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 * @param {Object} options - Rate limiter options provided by express-rate-limit.
 */
const rateLimitHandler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message: options.message,
    code: 'RATE_LIMIT_EXCEEDED',
    errors: [],
    retryAfter: Math.ceil(options.windowMs / 1000 / 60), // minutes
  });
};

/**
 * Helper to create a consistent rate limiter with sensible defaults.
 *
 * @param {Object} overrides - Overrides merged into the base config.
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function createLimiter(overrides) {
  return rateLimit({
    // Trust the first proxy (Nginx / ALB) so req.ip is the real client IP
    // rather than the proxy's address.
    // Adjust the number to match your infrastructure's proxy depth.
    legacyHeaders: false, // Disable X-RateLimit-* headers (use standardHeaders instead)
    standardHeaders: true, // Return `RateLimit-*` headers (RFC 6585)
    handler: rateLimitHandler,
    skip: (req) => {
      // Bypass rate limiting in test environments
      if (config.isTest) return true;
      // Bypass for health-check endpoint
      if (req.path === '/health') return true;
      return false;
    },
    ...overrides,
  });
}

// ── General Limiter ───────────────────────────────────────────────────────────

/**
 * General-purpose rate limiter applied to all API routes.
 * Allows 100 requests per 15-minute window per IP.
 *
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const generalLimiter = createLimiter({
  windowMs: config.rateLimitWindowMs, // Default: 15 minutes
  max: config.rateLimitMax,           // Default: 100 requests
  message: 'Too many requests from this IP address. Please try again later.',
});

// ── Auth Limiter ──────────────────────────────────────────────────────────────

/**
 * Strict rate limiter for authentication endpoints (login, register, refresh).
 * Allows 10 requests per 15-minute window per IP to mitigate brute-force attacks.
 *
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes — fixed, not configurable
  max: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  // Skip successful requests so only failures count towards the limit
  skipSuccessfulRequests: false,
});

// ── AI Generation Limiter ─────────────────────────────────────────────────────

/**
 * Limiter specifically for AI-powered ticket generation endpoints.
 * Allows 20 requests per hour per IP to control OpenAI API costs.
 *
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const aiLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message:
    'You have reached the AI generation limit (20 per hour). Please wait before generating more tickets.',
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
