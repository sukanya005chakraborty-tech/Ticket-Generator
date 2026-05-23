'use strict';

/**
 * @fileoverview Standardized API response helpers.
 *
 * USAGE PATTERN — these helpers return plain objects that are then
 * passed to `res.json()` by the caller. This keeps controllers clean and
 * lets the caller set the HTTP status separately when needed.
 *
 * Success envelope:
 *   { success: true, message, data, meta }
 *
 * Error envelope:
 *   { success: false, message, code, errors }
 *
 * Paginated envelope:
 *   { success: true, message, data, meta: { pagination: {...} } }
 *
 * @example
 *   // In a controller:
 *   return res.json(successResponse('User retrieved', { user }));
 *   return res.status(201).json(successResponse('Created', { ticket }));
 *   return res.json(paginatedResponse('Tickets retrieved', tickets, paginationMeta));
 */

// ── Success Response ──────────────────────────────────────────────────────────

/**
 * Build a success response envelope.
 *
 * Supports two call signatures:
 *   1. successResponse(message, data, meta?)         → plain object
 *   2. successResponse(res, data, message, status, meta) → sends the response directly
 *
 * The first signature is preferred in controllers; the second is available
 * for convenience when you want a single-call sender.
 *
 * @overload
 * @param {string} message - Human-readable success message.
 * @param {*} [data=null] - Payload included under `data`.
 * @param {Object} [meta={}] - Additional metadata (e.g. counts).
 * @returns {Object} Response envelope.
 *
 * @overload
 * @param {import('express').Response} res - Express response object.
 * @param {*} [data=null] - Payload included under `data`.
 * @param {string} [message='Success'] - Success message.
 * @param {number} [statusCode=200] - HTTP status code.
 * @param {Object} [meta={}] - Additional metadata.
 * @returns {import('express').Response}
 */
function successResponse(resOrMessage, dataOrMaybeData, messageOrMeta, statusCode, meta) {
  // Detect which overload is being used
  if (resOrMessage && typeof resOrMessage === 'object' && typeof resOrMessage.json === 'function') {
    // Overload 2: successResponse(res, data, message, statusCode, meta)
    const res = resOrMessage;
    const data = dataOrMaybeData !== undefined ? dataOrMaybeData : null;
    const message = messageOrMeta || 'Success';
    const code = statusCode || 200;
    const extraMeta = meta || {};

    const body = { success: true, message, data };
    if (Object.keys(extraMeta).length > 0) body.meta = extraMeta;

    return res.status(code).json(body);
  }

  // Overload 1: successResponse(message, data, meta)  → returns plain object
  const message = resOrMessage || 'Success';
  const data = dataOrMaybeData !== undefined ? dataOrMaybeData : null;
  const extraMeta = messageOrMeta || {};

  const body = { success: true, message, data };
  if (extraMeta && typeof extraMeta === 'object' && Object.keys(extraMeta).length > 0) {
    body.meta = extraMeta;
  }

  return body;
}

// ── Error Response ────────────────────────────────────────────────────────────

/**
 * Build or send an error response envelope.
 *
 * Supports two call signatures:
 *   1. errorResponse(message, statusCode?, code?, errors?) → plain object
 *   2. errorResponse(res, message, statusCode, code, errors) → sends directly
 *
 * @overload
 * @param {string} message - Human-readable error message.
 * @param {number} [statusCode] - HTTP status code (for reference only in plain-object mode).
 * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code.
 * @param {Array} [errors=[]] - Field-level validation errors.
 * @returns {Object} Error envelope.
 *
 * @overload
 * @param {import('express').Response} res - Express response object.
 * @param {string} message - Human-readable error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code.
 * @param {Array} [errors=[]] - Field-level errors.
 * @returns {import('express').Response}
 */
function errorResponse(resOrMessage, messageOrStatusCode, statusCodeOrCode, codeOrErrors, errorsArg) {
  if (resOrMessage && typeof resOrMessage === 'object' && typeof resOrMessage.json === 'function') {
    // Overload 2: errorResponse(res, message, statusCode, code, errors)
    const res = resOrMessage;
    const message = messageOrStatusCode || 'An error occurred';
    const code = statusCodeOrCode || 500;
    const errorCode = codeOrErrors || 'INTERNAL_ERROR';
    const errors = errorsArg || [];

    const body = { success: false, message, code: errorCode };
    if (errors.length > 0) body.errors = errors;

    return res.status(code).json(body);
  }

  // Overload 1: errorResponse(message, statusCode?, code?, errors?)  → plain object
  const message = resOrMessage || 'An error occurred';
  const errorCode = codeOrErrors || statusCodeOrCode || 'INTERNAL_ERROR';
  const errors = errorsArg || [];

  const body = { success: false, message, code: errorCode };
  if (errors && errors.length > 0) body.errors = errors;

  return body;
}

// ── Paginated Response ────────────────────────────────────────────────────────

/**
 * Build a paginated success response envelope.
 *
 * Supports two call signatures:
 *   1. paginatedResponse(message, data, pagination, extraMeta?) → plain object
 *   2. paginatedResponse(res, data, pagination, message, extraMeta?) → sends directly
 *
 * @overload
 * @param {string} message - Success message.
 * @param {Array} data - Result array for the current page.
 * @param {Object} pagination - Pagination metadata from `buildPaginationMeta`.
 * @param {Object} [extraMeta={}] - Additional top-level meta fields.
 * @returns {Object} Paginated response envelope.
 *
 * @overload
 * @param {import('express').Response} res - Express response object.
 * @param {Array} data - Result array for the current page.
 * @param {Object} pagination - Pagination metadata.
 * @param {string} message - Success message.
 * @param {Object} [extraMeta={}] - Additional metadata.
 * @returns {import('express').Response}
 */
function paginatedResponse(resOrMessage, dataArg, paginationArg, messageOrExtra, extraMetaArg) {
  if (resOrMessage && typeof resOrMessage === 'object' && typeof resOrMessage.json === 'function') {
    // Overload 2: paginatedResponse(res, data, pagination, message, extraMeta)
    const res = resOrMessage;
    const data = dataArg || [];
    const pagination = paginationArg || {};
    const message = messageOrExtra || 'Data retrieved successfully';
    const extraMeta = extraMetaArg || {};

    return res.status(200).json({
      success: true,
      message,
      data,
      meta: { pagination, ...extraMeta },
    });
  }

  // Overload 1: paginatedResponse(message, data, pagination, extraMeta)
  const message = resOrMessage || 'Data retrieved successfully';
  const data = dataArg || [];
  const pagination = paginationArg || {};
  const extraMeta = messageOrExtra && typeof messageOrExtra === 'object' ? messageOrExtra : {};

  return {
    success: true,
    message,
    data,
    meta: { pagination, ...extraMeta },
  };
}

// ── Convenience Wrappers ──────────────────────────────────────────────────────

/**
 * Send a 201 Created success response directly.
 *
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message='Resource created successfully']
 * @returns {import('express').Response}
 */
function createdResponse(res, data, message = 'Resource created successfully') {
  return res.status(201).json({ success: true, message, data });
}

/**
 * Send a 204 No Content response directly.
 * Note: 204 responses must not include a body.
 *
 * @param {import('express').Response} res
 * @returns {import('express').Response}
 */
function noContentResponse(res) {
  return res.status(204).send();
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
};
