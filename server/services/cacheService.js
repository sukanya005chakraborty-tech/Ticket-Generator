'use strict';

/**
 * @fileoverview Thin wrapper around the Redis client that adds:
 * - JSON serialisation/deserialisation
 * - Namespace-prefixed keys for multi-tenant safety
 * - Pattern-based key deletion (cache invalidation)
 * - Silent error recovery (cache miss on error, never throws)
 *
 * Key naming convention: ticketai:<namespace>:<identifier>
 * Examples:
 *   ticketai:analytics:overview:<userId>
 *   ticketai:tickets:list:<userId>:page:1:limit:10:status:open
 */

const { redisClient } = require('../config/redis');
const config          = require('../config/env');
const logger          = require('../config/logger');

const KEY_PREFIX = 'ticketai';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a namespaced cache key. */
function buildKey(...parts) {
  return [KEY_PREFIX, ...parts].join(':');
}

/** Safe JSON parse — returns null on failure. */
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Core operations ────────────────────────────────────────────────────────

/**
 * Retrieve a cached value.
 *
 * @param {string} key - Full cache key (use buildKey() to construct).
 * @returns {Promise<any|null>} Parsed value, or null on miss/error.
 */
async function get(key) {
  try {
    const raw = await redisClient.get(key);
    if (raw === null) return null;
    return safeParse(raw);
  } catch (err) {
    logger.warn(`Cache GET error [${key}]: ${err.message}`);
    return null;
  }
}

/**
 * Store a value in the cache.
 *
 * @param {string} key     - Full cache key.
 * @param {any}    value   - Value to cache (will be JSON serialised).
 * @param {number} [ttl]   - TTL in seconds. Defaults to medium TTL (5 min).
 */
async function set(key, value, ttl = config.cacheTtlMedium) {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    logger.warn(`Cache SET error [${key}]: ${err.message}`);
  }
}

/**
 * Delete one or more exact keys.
 *
 * @param {...string} keys
 */
async function del(...keys) {
  if (!keys.length) return;
  try {
    await redisClient.del(...keys);
  } catch (err) {
    logger.warn(`Cache DEL error [${keys.join(', ')}]: ${err.message}`);
  }
}

/**
 * Delete all keys matching a glob pattern.
 * Uses SCAN to avoid blocking Redis with KEYS on large datasets.
 *
 * @param {string} pattern - Glob pattern, e.g. "ticketai:tickets:list:userId123:*"
 */
async function delByPattern(pattern) {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 100
      );
      cursor = nextCursor;
      if (keys.length) {
        await redisClient.del(...keys);
        logger.debug(`Cache: invalidated ${keys.length} key(s) matching "${pattern}"`);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn(`Cache pattern DEL error [${pattern}]: ${err.message}`);
  }
}

/**
 * Cache-aside helper (read-through).
 * Returns cached value if present; otherwise executes `fn`, caches and returns its result.
 *
 * @param {string}            key   - Cache key.
 * @param {() => Promise<any>} fn   - Async factory producing the value on cache miss.
 * @param {number}            [ttl] - TTL in seconds.
 * @returns {Promise<any>}
 */
async function remember(key, fn, ttl = config.cacheTtlMedium) {
  const cached = await get(key);
  if (cached !== null) {
    logger.debug(`Cache HIT: ${key}`);
    return cached;
  }

  logger.debug(`Cache MISS: ${key}`);
  const value = await fn();
  await set(key, value, ttl);
  return value;
}

// ── Domain key builders ────────────────────────────────────────────────────
// Centralised so key shapes are never duplicated across services.

const keys = {
  analyticsOverview: (userId, projectId) => buildKey('analytics', 'overview', userId, projectId || 'all'),
  analyticsTrends:   (userId, period, projectId) => buildKey('analytics', 'trends', userId, period || 'default', projectId || 'all'),
  ticketList:        (userId, query) => buildKey('tickets', 'list', userId, query),
  ticketById:        (userId, ticketId) => buildKey('tickets', 'item', userId, ticketId),
  userProfile:       (userId) => buildKey('user', 'profile', userId),
  settings:          (userId) => buildKey('settings', userId),
};

/** Invalidate all ticket-list and analytics caches for a given user (on create/update/delete). */
async function invalidateTicketCache(userId) {
  await Promise.all([
    delByPattern(buildKey('tickets', 'list', userId, '*')),
    delByPattern(buildKey('analytics', 'overview', userId, '*')),
    delByPattern(buildKey('analytics', 'trends', userId, '*')),
  ]);
}

/** Invalidate a single ticket's detail cache. */
async function invalidateTicketById(userId, ticketId) {
  await del(keys.ticketById(userId, ticketId));
}

module.exports = {
  get,
  set,
  del,
  delByPattern,
  remember,
  keys,
  invalidateTicketCache,
  invalidateTicketById,
};
