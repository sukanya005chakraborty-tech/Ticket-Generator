'use strict';

/**
 * @fileoverview Joi validation schemas for all ticket-related endpoints.
 * Reuses enum arrays from the Ticket model for single source of truth.
 */

const Joi = require('joi');
const { PRIORITY_VALUES, SEVERITY_VALUES, STATUS_VALUES } = require('../models/Ticket');

// ── Reusable field definitions ─────────────────────────────────────────────────

/** Array of short, trimmed strings (labels, steps, acceptance criteria). */
const stringArrayField = Joi.array().items(Joi.string().trim().max(500)).default([]);

// ── Test Case Sub-schema ──────────────────────────────────────────────────────

const testCaseSchema = Joi.object({
  title: Joi.string().trim().max(200).required().messages({
    'any.required': 'Test case title is required',
    'string.max': 'Test case title cannot exceed 200 characters',
  }),
  steps: Joi.array().items(Joi.string().trim().max(500)).default([]),
  expected: Joi.string().trim().max(1000).allow('').default(''),
});

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * Schema for POST /api/tickets — AI ticket generation.
 * `rawInput` is the only required field; additional context fields are optional.
 *
 * @type {import('joi').ObjectSchema}
 */
const generateTicketSchema = Joi.object({
  rawInput: Joi.string()
    .trim()
    .min(10)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 2000 characters',
      'any.required': 'Raw input description is required',
      'string.empty': 'Description cannot be empty',
    }),

  environment: Joi.string().trim().max(100).optional().allow('').default(''),
  browser:     Joi.string().trim().max(100).optional().allow('').default(''),
  device:      Joi.string().trim().max(100).optional().allow('').default(''),
  module:      Joi.string().trim().max(100).optional().allow('').default(''),

  projectId:  Joi.string().hex().length(24).optional().allow(null, ''),
  assignedTo: Joi.string().hex().length(24).optional().allow(null, ''),
  dueDate:    Joi.date().iso().optional().allow(null),
});

/**
 * Schema for PUT /api/tickets/:id — partial update.
 * All fields are optional; present fields are fully validated.
 *
 * @type {import('joi').ObjectSchema}
 */
const updateTicketSchema = Joi.object({
  title: Joi.string()
    .trim()
    .max(255)
    .optional()
    .messages({
      'string.max': 'Title cannot exceed 255 characters',
    }),

  summary: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Summary cannot exceed 500 characters',
    }),

  description: Joi.string()
    .trim()
    .optional()
    .allow(''),

  priority: Joi.string()
    .valid(...PRIORITY_VALUES)
    .optional()
    .messages({
      'any.only': `Priority must be one of: ${PRIORITY_VALUES.join(', ')}`,
    }),

  severity: Joi.string()
    .valid(...SEVERITY_VALUES)
    .optional()
    .messages({
      'any.only': `Severity must be one of: ${SEVERITY_VALUES.join(', ')}`,
    }),

  status: Joi.string()
    .valid(...STATUS_VALUES)
    .optional()
    .messages({
      'any.only': `Status must be one of: ${STATUS_VALUES.join(', ')}`,
    }),

  stepsToReproduce: stringArrayField.optional(),

  expectedResult: Joi.string().trim().optional().allow(''),

  actualResult: Joi.string().trim().optional().allow(''),

  acceptanceCriteria: stringArrayField.optional(),

  testCases: Joi.array().items(testCaseSchema).optional().default([]),

  labels: Joi.array()
    .items(Joi.string().trim().lowercase().max(50))
    .optional()
    .default([]),

  module: Joi.string().trim().max(100).optional().allow(''),

  environment: Joi.string().trim().max(100).optional().allow(''),

  browser: Joi.string().trim().max(100).optional().allow(''),

  device: Joi.string().trim().max(100).optional().allow(''),

  timeEstimate: Joi.object({
    value: Joi.number().min(0).optional().allow(null),
    unit: Joi.string().valid('minutes', 'hours', 'days').optional(),
  }).optional().allow(null),

  completionPercentage: Joi.number().integer().min(0).max(100).optional(),

  projectId:  Joi.string().hex().length(24).optional().allow(null, ''),
  assignedTo: Joi.string().hex().length(24).optional().allow(null, ''),
  dueDate:    Joi.date().iso().optional().allow(null),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

/**
 * Schema for GET /api/tickets — query string parameters.
 *
 * @type {import('joi').ObjectSchema}
 */
const ticketQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.min': 'Page must be a positive integer',
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),

  status: Joi.string()
    .valid(...STATUS_VALUES)
    .optional()
    .messages({
      'any.only': `Status must be one of: ${STATUS_VALUES.join(', ')}`,
    }),

  priority: Joi.string()
    .valid(...PRIORITY_VALUES)
    .optional()
    .messages({
      'any.only': `Priority must be one of: ${PRIORITY_VALUES.join(', ')}`,
    }),

  severity: Joi.string()
    .valid(...SEVERITY_VALUES)
    .optional()
    .messages({
      'any.only': `Severity must be one of: ${SEVERITY_VALUES.join(', ')}`,
    }),

  search: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Search query cannot exceed 200 characters',
    }),

  sortBy: Joi.string()
    .valid('createdAt', 'updatedAt', 'priority', 'severity', 'status', 'title')
    .default('createdAt')
    .messages({
      'any.only': 'Sort field must be one of: createdAt, updatedAt, priority, severity, status, title',
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be "asc" or "desc"',
    }),

  module: Joi.string().trim().max(100).optional().allow(''),

  labels: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim()).optional(),
      Joi.string().trim().optional()
    )
    .optional(),

  projectId:  Joi.string().hex().length(24).optional().allow(''),
  assignedTo: Joi.alternatives()
    .try(Joi.string().hex().length(24), Joi.string().valid('unassigned'))
    .optional(),
  dueDate: Joi.alternatives()
    .try(
      Joi.string().valid('overdue', 'today', 'week'),
      Joi.date().iso()
    )
    .optional(),
});

module.exports = {
  generateTicketSchema,
  updateTicketSchema,
  ticketQuerySchema,
};
