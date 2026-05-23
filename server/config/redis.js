'use strict';

/**
 * @fileoverview ioredis client singleton with connection lifecycle management.
 *
 * Strategy:
 * - If REDIS_URL is set, connect via URL (Upstash, Redis Cloud, etc.)
 * - Otherwise connect via host/port with optional password and DB index.
 * - In test env, Redis is disabled — every cache call becomes a no-op.
 * - Connection errors are logged but never crash the app; the app degrades
 *   gracefully (cache misses, live DB reads).
 */

const Redis  = require('ioredis');
const config = require('./env');
const logger = require('./logger');

// ── Null client (test env / Redis unavailable) ─────────────────────────────

/** Minimal interface matching ioredis so callers don't need to guard. */
const nullClient = {
  get:    async () => null,
  set:    async () => 'OK',
  setex:  async () => 'OK',
  del:    async (..._keys) => 0,
  keys:   async () => [],
  flushdb: async () => 'OK',
  quit:   async () => 'OK',
  status: 'disabled',
  isNull: true,
};

// ── Client factory ─────────────────────────────────────────────────────────

function createClient() {
  if (config.isTest) {
    logger.info('Redis: disabled in test environment');
    return nullClient;
  }

  /** @type {import('ioredis').RedisOptions} */
  const baseOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck:     true,
    lazyConnect:          true,        // connect() called explicitly below
    connectTimeout:       10_000,
    commandTimeout:       5_000,
    retryStrategy(times) {
      if (times > 5) {
        logger.warn(`Redis: max reconnect attempts reached (${times}), giving up`);
        return null;                   // stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis: reconnect attempt ${times}, retry in ${delay}ms`);
      return delay;
    },
  };

  const client = config.redisUrl
    ? new Redis(config.redisUrl, baseOptions)
    : new Redis({
        ...baseOptions,
        host:     config.redisHost,
        port:     config.redisPort,
        password: config.redisPassword || undefined,
        db:       config.redisDb,
      });

  client.on('connect',   () => logger.info('Redis: connection established'));
  client.on('ready',     () => logger.info('Redis: client ready'));
  client.on('error',     (err) => logger.error(`Redis error: ${err.message}`));
  client.on('close',     () => logger.warn('Redis: connection closed'));
  client.on('reconnecting', (ms) => logger.info(`Redis: reconnecting in ${ms}ms`));

  return client;
}

// ── Singleton ──────────────────────────────────────────────────────────────

const redisClient = createClient();

/**
 * Explicitly open the Redis connection.
 * Call once at app startup (after DB connect).
 */
async function connectRedis() {
  if (redisClient.isNull) return;
  try {
    await redisClient.connect();
    logger.info('Redis: connected successfully');
  } catch (err) {
    logger.error(`Redis: initial connection failed — ${err.message}`);
    logger.warn('Redis: app will continue without caching');
  }
}

/**
 * Gracefully close the Redis connection.
 * Called during app shutdown.
 */
async function disconnectRedis() {
  if (redisClient.isNull) return;
  try {
    await redisClient.quit();
    logger.info('Redis: connection closed gracefully');
  } catch (err) {
    logger.error(`Redis: error during shutdown — ${err.message}`);
  }
}

module.exports = { redisClient, connectRedis, disconnectRedis };
