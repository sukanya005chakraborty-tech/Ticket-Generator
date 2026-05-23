'use strict';

/**
 * @fileoverview MongoDB connection manager using Mongoose.
 * Implements retry logic with exponential backoff, connection event handlers,
 * and graceful shutdown on process termination signals.
 */

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

/** Maximum number of connection attempts before giving up. */
const MAX_RETRIES = 5;

/** Base delay in ms for exponential backoff. Each retry doubles this. */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Mongoose connection options.
 * @type {mongoose.ConnectOptions}
 */
const MONGOOSE_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
};

/**
 * Attach Mongoose connection lifecycle event listeners.
 * Should be called once, before any connection attempt.
 */
function attachConnectionListeners() {
  const db = mongoose.connection;

  db.on('connected', () => {
    logger.info('MongoDB connected successfully', {
      host: db.host,
      port: db.port,
      name: db.name,
    });
  });

  db.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  db.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  db.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  db.on('close', () => {
    logger.info('MongoDB connection closed');
  });
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms - Duration to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to connect to MongoDB with exponential backoff retry logic.
 * @param {number} [attempt=1] - Current attempt number (1-based).
 * @returns {Promise<void>}
 * @throws {Error} After all retries are exhausted.
 */
async function attemptConnection(attempt = 1) {
  try {
    logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})...`);
    await mongoose.connect(config.mongodbUri, MONGOOSE_OPTIONS);
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      logger.error('MongoDB connection failed after maximum retries', {
        attempts: attempt,
        error: err.message,
      });
      throw err;
    }

    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // exponential backoff
    logger.warn(`MongoDB connection failed. Retrying in ${delay}ms...`, {
      attempt,
      maxRetries: MAX_RETRIES,
      error: err.message,
    });

    await sleep(delay);
    return attemptConnection(attempt + 1);
  }
}

/**
 * Register a graceful shutdown handler that closes the Mongoose connection
 * before the process exits on SIGINT or SIGTERM.
 */
function registerGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`${signal} received — closing MongoDB connection...`);
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed gracefully');
    } catch (err) {
      logger.error('Error while closing MongoDB connection', { error: err.message });
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Connect to MongoDB.
 * Attaches lifecycle listeners, attempts connection with retry/backoff,
 * and registers graceful shutdown hooks.
 *
 * @returns {Promise<void>}
 * @throws {Error} If unable to connect after all retries.
 *
 * @example
 * const { connectDatabase } = require('./config/database');
 * await connectDatabase();
 */
async function connectDatabase() {
  attachConnectionListeners();
  registerGracefulShutdown();
  await attemptConnection();
}

module.exports = { connectDatabase };
