'use strict';

/**
 * @fileoverview Joi validation schemas for all authentication and user-related endpoints.
 * Imported by route files and used with the `validate` middleware factory.
 */

const Joi = require('joi');

// ── Shared field definitions ──────────────────────────────────────────────────

/**
 * Reusable password complexity rule.
 * Requirements: 8–128 chars, at least one uppercase, lowercase, digit, and
 * special character.
 */
const passwordField = Joi.string()
  .min(8)
  .max(128)
  .pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).+$/
  )
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required',
    'string.empty': 'Password cannot be empty',
  });

// ── Auth Schemas ──────────────────────────────────────────────────────────────

/**
 * Schema for POST /api/auth/register
 *
 * @type {import('joi').ObjectSchema}
 */
const registerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required',
      'string.empty': 'Name cannot be empty',
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: true } })
    .max(255)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
      'string.empty': 'Email cannot be empty',
    }),

  password: passwordField.required(),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your password',
      'string.empty': 'Confirm password cannot be empty',
    }),
});

/**
 * Schema for POST /api/auth/login
 *
 * @type {import('joi').ObjectSchema}
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: true } })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
      'string.empty': 'Email cannot be empty',
    }),

  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
      'string.empty': 'Password cannot be empty',
    }),

  rememberMe: Joi.boolean().default(false),
});

/**
 * Schema for POST /api/auth/refresh-token
 * The refreshToken field is optional when delivered via httpOnly cookie.
 *
 * @type {import('joi').ObjectSchema}
 */
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .optional()
    .allow('')
    .messages({
      'string.base': 'Refresh token must be a string',
    }),
});

// ── User / Password Schemas ───────────────────────────────────────────────────

/**
 * Schema for PUT /api/users/password
 *
 * @type {import('joi').ObjectSchema}
 */
const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required',
      'string.empty': 'Current password cannot be empty',
    }),

  newPassword: passwordField
    .required()
    .disallow(Joi.ref('currentPassword'))
    .messages({
      'any.invalid': 'New password must be different from the current password',
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your new password',
      'string.empty': 'Confirm password cannot be empty',
    }),
});

/**
 * Schema for PUT /api/users/profile
 * All fields are optional; at least one must be provided.
 *
 * @type {import('joi').ObjectSchema}
 */
const updateProfileSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters',
    }),

  avatar: Joi.string()
    .uri({ scheme: ['http', 'https', 'data'] })
    .max(2048)
    .optional()
    .allow('', null)
    .messages({
      'string.uri': 'Avatar must be a valid URL',
      'string.max': 'Avatar URL cannot exceed 2048 characters',
    }),

  bio: Joi.string()
    .trim()
    .max(300)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Bio cannot exceed 300 characters',
    }),

  timezone: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Timezone cannot exceed 100 characters',
    }),

  preferences: Joi.object()
    .optional()
    .unknown(true), // Allow any preference keys; fine-grained validation happens at service layer
}).min(1).messages({
  'object.min': 'At least one field must be provided for profile update',
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updatePasswordSchema,
  updateProfileSchema,
};
