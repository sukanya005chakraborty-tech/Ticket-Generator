'use strict';

/**
 * @fileoverview Winston logger configuration.
 * Provides structured logging with colorized console output (dev only),
 * rotating file transports for combined and error logs, and a Morgan-compatible
 * HTTP stream for request logging.
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');
const config = require('./env');

const { combine, timestamp, printf, colorize, errors, json, splat, metadata } = format;

/** Absolute path to the directory where log files are written. */
const LOG_DIR = path.join(__dirname, '..', 'logs');

// ── Custom Formats ────────────────────────────────────────────────────────────

/**
 * Human-readable format used for console (development) output.
 * Pattern: [timestamp] LEVEL: message  {metadata}
 */
const devConsoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr =
    Object.keys(meta).length > 0 && meta.metadata && Object.keys(meta.metadata).length > 0
      ? `\n  ${JSON.stringify(meta.metadata, null, 2)}`
      : '';

  if (stack) {
    return `[${ts}] ${level}: ${message}\n${stack}${metaStr}`;
  }
  return `[${ts}] ${level}: ${message}${metaStr}`;
});

/**
 * Format used for file transports (JSON, machine-parseable).
 */
const fileFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  splat(),
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'stack'] }),
  json()
);

/**
 * Format used for console transport in development.
 */
const consoleFormat = combine(
  colorize({ all: true }),
  errors({ stack: true }),
  timestamp({ format: 'HH:mm:ss' }),
  splat(),
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'stack'] }),
  devConsoleFormat
);

// ── Transports ────────────────────────────────────────────────────────────────

/** @type {import('winston').transport[]} */
const logTransports = [
  // Combined log — all levels
  new transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    level: 'http',
    format: fileFormat,
    maxsize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 5,
    tailable: true,
  }),

  // Error log — errors only
  new transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 5,
    tailable: true,
  }),
];

// Add colorized console transport only in development / test environments
if (!config.isProd) {
  logTransports.push(
    new transports.Console({
      level: config.logLevel,
      format: consoleFormat,
    })
  );
}

// ── Logger Instance ───────────────────────────────────────────────────────────

/**
 * Application-wide Winston logger instance.
 * @type {import('winston').Logger}
 */
const logger = createLogger({
  level: config.logLevel,
  silent: config.isTest, // Silence logs during automated tests
  transports: logTransports,
  exitOnError: false,
});

// ── Morgan HTTP Stream ────────────────────────────────────────────────────────

/**
 * Writable stream compatible with Morgan's `stream` option.
 * Each Morgan log line is trimmed and written at the `http` level.
 *
 * @example
 * const morgan = require('morgan');
 * const { httpStream } = require('./config/logger');
 * app.use(morgan('combined', { stream: httpStream }));
 */
const httpStream = {
  /**
   * @param {string} message - The log line produced by Morgan.
   */
  write(message) {
    logger.http(message.trim());
  },
};

module.exports = logger;
module.exports.httpStream = httpStream;
