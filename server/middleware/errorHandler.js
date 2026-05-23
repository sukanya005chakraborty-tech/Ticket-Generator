'use strict';

/**
 * @fileoverview Centralized error handling middleware, AppError class, and asyncWrapper utility.
 * Transforms every error type (Mongoose, JWT, custom) into the standard API error envelope
 * and ensures stack traces are never leaked to production clients.
 */

const logger = require('../config/logger');
const config = require('../config/env');

// ── AppError Class ────────────────────────────────────────────────────────────

/**
 * Operational application error with a known HTTP status code and error code.
 * Throwing an AppError anywhere in route/middleware code will produce a
 * structured JSON response via the central errorHandler middleware.
 *
 * @extends {Error}
 *
 * @example
 * throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
 */
class AppError extends Error {
  /**
   * @param {string} message       - Human-readable error description.
   * @param {number} statusCode    - HTTP status code (defaults to 500).
   * @param {string} [code]        - Machine-readable error code (e.g. 'NOT_FOUND').
   * @param {boolean} [isOperational=true] - False for programming errors that must be fixed.
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);

    // Capture V8 stack trace, excluding this constructor frame
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── asyncWrapper ──────────────────────────────────────────────────────────────

/**
 * Wraps an async Express route handler and forwards any rejected promise
 * to the next() error handler, eliminating try/catch boilerplate.
 *
 * @param {Function} fn - Async route handler `(req, res, next) => Promise<void>`.
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/tickets', asyncWrapper(async (req, res) => {
 *   const tickets = await Ticket.find();
 *   res.json(tickets);
 * }));
 */
const asyncWrapper = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ── Error Normalisation Helpers ───────────────────────────────────────────────

/**
 * Convert a Mongoose ValidationError into an AppError.
 * Extracts per-field messages into a flat array.
 *
 * @param {import('mongoose').Error.ValidationError} err
 * @returns {{ appError: AppError, errors: Array<{field: string, message: string}> }}
 */
function handleMongooseValidationError(err) {
  const errors = Object.entries(err.errors).map(([field, error]) => ({
    field,
    message: error.message,
  }));

  const appError = new AppError(
    'Validation failed',
    422,
    'VALIDATION_ERROR'
  );

  return { appError, errors };
}

/**
 * Convert a Mongoose CastError (bad ObjectId, wrong type) into an AppError.
 *
 * @param {import('mongoose').Error.CastError} err
 * @returns {AppError}
 */
function handleCastError(err) {
  return new AppError(
    `Invalid value for field "${err.path}": ${err.value}`,
    400,
    'INVALID_INPUT'
  );
}

/**
 * Convert a MongoDB duplicate key error (code 11000) into an AppError.
 *
 * @param {{ keyValue: Object }} err
 * @returns {AppError}
 */
function handleDuplicateKeyError(err) {
  const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
  const value = err.keyValue ? Object.values(err.keyValue)[0] : '';
  return new AppError(
    `A record with ${field} "${value}" already exists`,
    409,
    'DUPLICATE_RESOURCE'
  );
}

/**
 * Convert JWT errors into AppErrors.
 *
 * @param {Error} err
 * @returns {AppError}
 */
function handleJwtError(err) {
  if (err.name === 'TokenExpiredError') {
    return new AppError('Access token has expired', 401, 'TOKEN_EXPIRED');
  }
  return new AppError('Invalid token', 401, 'TOKEN_INVALID');
}

// ── Central Error Handler Middleware ─────────────────────────────────────────

/**
 * Express error-handling middleware (4-argument signature).
 * Must be registered **last** in the Express middleware chain.
 *
 * Handles:
 *  - AppError (operational errors)
 *  - Mongoose ValidationError
 *  - Mongoose CastError
 *  - MongoServerError code 11000 (duplicate key)
 *  - JsonWebTokenError / TokenExpiredError
 *  - Generic errors (treated as 500 Internal Server Error)
 *
 * @type {import('express').ErrorRequestHandler}
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let errors = [];

  // ── Normalise known error types ───────────────────────────────────────────

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const { appError, errors: fieldErrors } = handleMongooseValidationError(err);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
    errors = fieldErrors;
  }

  // Mongoose bad ObjectId / type mismatch
  else if (err.name === 'CastError') {
    const appError = handleCastError(err);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
  }

  // MongoDB duplicate key
  else if (err.name === 'MongoServerError' && err.code === 11000) {
    const appError = handleDuplicateKeyError(err);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
  }

  // JWT errors
  else if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) {
    const appError = handleJwtError(err);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    userId: req.user ? req.user._id : undefined,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logMeta, stack: err.stack });
  } else {
    logger.warn(message, logMeta);
  }

  // ── Response ──────────────────────────────────────────────────────────────

  const body = {
    success: false,
    message,
    code,
    errors: errors.length > 0 ? errors : undefined,
  };

  // Never expose stack traces to clients in production
  if (!config.isProd && err.stack) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

module.exports = { errorHandler, AppError, asyncWrapper };
