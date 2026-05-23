'use strict';

const Joi = require('joi');
const { MEMBER_ROLES } = require('../models/Project');

const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Project name is required',
    'string.min':   'Project name must be at least 2 characters',
    'string.max':   'Project name cannot exceed 100 characters',
  }),
  description: Joi.string().trim().max(500).allow('').default(''),
  key: Joi.string().trim().uppercase().alphanum().max(10).allow('').optional(),
});

const updateProjectSchema = Joi.object({
  name:        Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500).allow(''),
  isActive:    Joi.boolean(),
}).min(1).messages({ 'object.min': 'At least one field required to update' });

const addMemberSchema = Joi.object({
  userId: Joi.string().trim().required().messages({ 'any.required': 'userId is required' }),
  role:   Joi.string().valid(...MEMBER_ROLES).default('member'),
});

const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid(...MEMBER_ROLES).required().messages({
    'any.required': 'role is required',
    'any.only':     `role must be one of: ${MEMBER_ROLES.join(', ')}`,
  }),
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  addMemberSchema,
  updateMemberRoleSchema,
};
