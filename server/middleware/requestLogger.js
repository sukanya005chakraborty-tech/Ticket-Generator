'use strict';

/**
 * @fileoverview Morgan-based HTTP request logger middleware.
 * Routes Morgan output through the Winston logger stream so all application
 * logs are written to the same transports and in a consistent format.
 */

const morgan = require('morgan');
const logger = require('../config/logger');

// ── Custom Morgan Tokens ──────────────────────────────────────────────────────

/**
 * Custom token: :user-id
 * Extracts the authenticated user's ID from req.user (populated by auth middleware).
 * Returns a dash if the request is unauthenticated.
 */
morgan.token('user-id', (req) => {
  return req.user ? req.user._id.toString() : '-';
});

/**
 * Custom token: :real-ip
 * Returns the original client IP, honouring X-Forwarded-For when behind a proxy.
 */
morgan.token('real-ip', (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    '-'
  );
});

// ── Morgan Format ─────────────────────────────────────────────────────────────

/**
 * Log format string.
 * Fields: method, URL, HTTP version, status, content-length, response time, real IP, user ID.
 *
 * Example output:
 *   POST /api/auth/login HTTP/1.1 200 312 - 45.123 ms ::1 6685abc...
 */
const LOG_FORMAT =
  ':method :url HTTP/:http-version :status :res[content-length] - :response-time ms :real-ip :user-id';

// ── Skip Logic ────────────────────────────────────────────────────────────────

/**
 * Routes that should be excluded from request logging to reduce noise.
 * @type {string[]}
 */
const SKIP_PATHS = ['/health', '/favicon.ico'];

/**
 * Determines whether a request should be skipped by Morgan.
 *
 * @param {import('express').Request} req
 * @returns {boolean} True if the request should NOT be logged.
 */
function shouldSkip(req) {
  return SKIP_PATHS.some((path) => req.originalUrl.startsWith(path));
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Morgan HTTP request logger middleware.
 * Uses the Winston HTTP stream so log lines appear alongside application logs.
 *
 * @type {import('express').RequestHandler}
 *
 * @example
 * const { requestLogger } = require('./middleware/requestLogger');
 * app.use(requestLogger);
 */
const requestLogger = morgan(LOG_FORMAT, {
  stream: logger.httpStream,
  skip: shouldSkip,
});

module.exports = { requestLogger };
