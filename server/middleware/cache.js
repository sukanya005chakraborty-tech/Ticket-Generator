'use strict';

/**
 * @fileoverview HTTP-layer caching middleware.
 *
 * `cacheResponse(ttl, keyFn)` — stores the JSON response body in Redis.
 * On subsequent requests the cached payload is returned immediately,
 * skipping all downstream middleware and DB/AI calls.
 *
 * Cache key defaults to: ticketai:http:<method>:<path>:<userId>
 * A custom `keyFn(req)` can override this for fine-grained control.
 *
 * The middleware sets:
 *   X-Cache: HIT | MISS
 *   X-Cache-TTL: <remaining seconds>
 */

const { redisClient } = require('../config/redis');
const config          = require('../config/env');
const logger          = require('../config/logger');

const KEY_PREFIX = 'ticketai:http';

/**
 * Build a default cache key from the request.
 * Includes the authenticated user ID so users never share each other's cache.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function defaultKeyFn(req) {
  const userId = req.user?._id || req.user?.id || 'anon';
  // Stable query-string representation (sorted keys)
  const qs = Object.keys(req.query).sort()
    .map((k) => `${k}=${req.query[k]}`)
    .join('&');
  return `${KEY_PREFIX}:${req.method}:${req.path}:${userId}${qs ? `:${qs}` : ''}`;
}

/**
 * Express middleware: cache the JSON response body.
 *
 * @param {number}   [ttl]    - TTL in seconds (default: config.cacheTtlMedium).
 * @param {Function} [keyFn]  - Custom key builder: (req) => string.
 * @returns {import('express').RequestHandler}
 *
 * @example
 * // Cache analytics overview for 5 minutes
 * router.get('/overview', authenticate, cacheResponse(300), getOverview);
 *
 * @example
 * // Custom key
 * router.get('/tickets', authenticate, cacheResponse(60, (req) => `tickets:${req.user._id}:${req.query.page}`), listTickets);
 */
function cacheResponse(ttl = config.cacheTtlMedium, keyFn = defaultKeyFn) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = keyFn(req);

    try {
      const cached = await redisClient.get(key);

      if (cached !== null) {
        const ttlRemaining = await redisClient.ttl(key);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', String(ttlRemaining));
        logger.debug(`Cache HIT (HTTP): ${key}`);
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      // Redis unavailable — proceed without cache
      logger.warn(`Cache middleware GET error: ${err.message}`);
      return next();
    }

    // Intercept res.json to capture the response body
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await redisClient.setex(key, ttl, JSON.stringify(body));
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-TTL', String(ttl));
          logger.debug(`Cache SET (HTTP): ${key} TTL=${ttl}s`);
        } catch (err) {
          logger.warn(`Cache middleware SET error: ${err.message}`);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { cacheResponse };
