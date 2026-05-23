'use strict';

/**
 * @fileoverview Joi-based validation middleware factory.
 * Provides `validate`, `validateQuery`, and `validateParams` for validating
 * request body, query string, and URL parameters respectively.
 * All validation failures return HTTP 422 with field-level error details
 * in the standard API error envelope.
 */

/**
 * @typedef {Object} FieldError
 * @property {string} field   - Dot-notation path to the offending field.
 * @property {string} message - Human-readable validation message.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert Joi's ValidationError.details array into a flat array of FieldError objects.
 *
 * @param {import('joi').ValidationErrorItem[]} details - Joi error details.
 * @returns {FieldError[]}
 */
function mapJoiErrors(details) {
  return details.map((detail) => ({
    field: detail.path.join('.') || detail.context?.key || 'unknown',
    message: detail.message.replace(/['"]/g, ''), // Strip surrounding quotes from field names
  }));
}

/**
 * Build the standard 422 error response body.
 *
 * @param {FieldError[]} errors
 * @returns {Object}
 */
function buildValidationResponse(errors) {
  return {
    success: false,
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors,
  };
}

/**
 * Shared Joi options applied to every validation call.
 * - abortEarly: false — collect ALL validation errors before rejecting.
 * - stripUnknown: true — silently remove fields not in the schema.
 * - errors.wrap.label: false — don't wrap field names in quotes in messages.
 *
 * @type {import('joi').ValidationOptions}
 */
const JOI_OPTIONS = {
  abortEarly: false,
  stripUnknown: true,
  errors: {
    wrap: { label: false },
  },
};

// ── Middleware Factories ───────────────────────────────────────────────────────

/**
 * Validate `req.body` against a Joi schema.
 * On success, `req.body` is replaced with the validated (and stripped) value.
 * On failure, responds with HTTP 422 and field-level error details.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against.
 * @returns {import('express').RequestHandler}
 *
 * @example
 * const { registerSchema } = require('../validators/authValidator');
 * router.post('/register', validate(registerSchema), registerController);
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, JOI_OPTIONS);

    if (error) {
      const errors = mapJoiErrors(error.details);
      return res.status(422).json(buildValidationResponse(errors));
    }

    req.body = value; // Replace with stripped/coerced value
    next();
  };
};

/**
 * Validate `req.query` against a Joi schema.
 * On success, `req.query` is replaced with the validated value.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against.
 * @returns {import('express').RequestHandler}
 *
 * @example
 * const { ticketQuerySchema } = require('../validators/ticketValidator');
 * router.get('/tickets', authenticate, validateQuery(ticketQuerySchema), listTickets);
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, JOI_OPTIONS);

    if (error) {
      const errors = mapJoiErrors(error.details);
      return res.status(422).json(buildValidationResponse(errors));
    }

    req.query = value;
    next();
  };
};

/**
 * Validate `req.params` against a Joi schema.
 * On success, `req.params` is replaced with the validated value.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against.
 * @returns {import('express').RequestHandler}
 *
 * @example
 * const Joi = require('joi');
 * const idParamSchema = Joi.object({ id: Joi.string().hex().length(24).required() });
 * router.get('/tickets/:id', authenticate, validateParams(idParamSchema), getTicket);
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, JOI_OPTIONS);

    if (error) {
      const errors = mapJoiErrors(error.details);
      return res.status(422).json(buildValidationResponse(errors));
    }

    req.params = value;
    next();
  };
};

module.exports = { validate, validateQuery, validateParams };
