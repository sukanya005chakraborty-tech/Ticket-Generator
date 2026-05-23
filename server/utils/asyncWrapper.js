'use strict';

/**
 * @fileoverview Async route handler wrapper.
 * Eliminates the need for try/catch blocks inside every async Express handler
 * by forwarding any rejected promise to the central `next(err)` error handler.
 */

/**
 * Wrap an async Express route handler so that any unhandled rejection
 * is automatically forwarded to `next(err)`.
 *
 * Works with standard Express handlers that accept `(req, res, next)`.
 * The wrapped function is synchronous from Express's perspective, so it is
 * compatible with all Express router methods (get, post, put, delete, use, etc.).
 *
 * @param {Function} fn - Async route handler: `async (req, res, next) => void`
 * @returns {import('express').RequestHandler} Synchronous Express middleware.
 *
 * @example
 * const asyncWrapper = require('../utils/asyncWrapper');
 *
 * router.get('/tickets', asyncWrapper(async (req, res) => {
 *   const tickets = await Ticket.find({ createdBy: req.user._id });
 *   res.json({ success: true, data: tickets });
 * }));
 *
 * @example <caption>Using with error-first helpers</caption>
 * router.post('/tickets', authenticate, asyncWrapper(async (req, res, next) => {
 *   if (!req.body.rawInput) {
 *     return next(new AppError('rawInput is required', 400, 'VALIDATION_ERROR'));
 *   }
 *   const ticket = await ticketService.generate(req.body, req.user);
 *   res.status(201).json({ success: true, data: ticket });
 * }));
 */
const asyncWrapper = (fn) => {
  return (req, res, next) => {
    // Promise.resolve handles both async functions (which return Promises)
    // and regular functions (which return plain values).
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncWrapper;
module.exports.asyncWrapper = asyncWrapper; // Named export alias for destructured imports
module.exports.default = asyncWrapper;      // ES-module default-style compat
