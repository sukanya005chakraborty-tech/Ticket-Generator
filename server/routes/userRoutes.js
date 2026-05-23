'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileSchema, updatePasswordSchema } = require('../validators/authValidator');
const { getProfile, updateProfile, updatePassword, getAllUsers, updateUserRole } = require('../controllers/userController');

const router = Router();

/**
 * User Routes
 * Base path: /api/users
 * All routes require authentication.
 */

// GET /api/users
router.get('/', authenticate, getAllUsers);

// GET /api/users/profile
router.get('/profile', authenticate, getProfile);

// PUT /api/users/profile
// Update display name, avatar, bio, preferences
router.put('/profile', authenticate, validate(updateProfileSchema), updateProfile);

// PUT /api/users/password
// Change password (requires current password verification)
router.put('/password', authenticate, validate(updatePasswordSchema), updatePassword);

// PATCH /api/users/:id/role
// Admin-only: update a user's global platform role
router.patch('/:id/role', authenticate, authorize('admin'), updateUserRole);

module.exports = router;
