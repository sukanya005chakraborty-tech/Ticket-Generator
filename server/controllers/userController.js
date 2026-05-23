'use strict';

const userRepository = require('../repositories/userRepository');
const { AppError } = require('../middleware/errorHandler');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');
const logger = require('../config/logger');

/**
 * User Controller – profile and password management.
 */

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/users/profile
 */
const getProfile = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  return res.json(successResponse('Profile retrieved successfully', { user: safeUser }));
});

/**
 * PUT /api/users/profile
 * Allowed updates: name, avatar, bio, settings (non-sensitive fields only).
 */
const updateProfile = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;

  // Whitelist of updatable fields
  const allowedFields = ['name', 'avatar', 'bio', 'timezone', 'preferences'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided for update', 400, 'NO_UPDATE_FIELDS');
  }

  const updated = await userRepository.update(userId, updates);
  if (!updated) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const safeUser = { ...updated };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  logger.info('[userController] Profile updated', { userId, fields: Object.keys(updates) });

  return res.json(successResponse('Profile updated successfully', { user: safeUser }));
});

/**
 * PUT /api/users/password
 * Requires current password verification before allowing a change.
 */
const updatePassword = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('currentPassword and newPassword are required', 400, 'MISSING_FIELDS');
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400, 'WEAK_PASSWORD');
  }

  if (currentPassword === newPassword) {
    throw new AppError('New password must be different from the current password', 400, 'SAME_PASSWORD');
  }

  // Fetch user including password field
  const User = require('../models/User');
  const userDoc = await User.findById(userId).select('+password');
  if (!userDoc) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password using bcrypt
  const bcrypt = require('bcryptjs');
  const isMatch = await bcrypt.compare(currentPassword, userDoc.password);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401, 'WRONG_CURRENT_PASSWORD');
  }

  // Hash new password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update password and invalidate all refresh tokens (force re-login on all devices)
  await Promise.all([
    userRepository.update(userId, { password: hashedPassword }),
    userRepository.removeAllRefreshTokens(userId),
  ]);

  logger.info('[userController] Password changed', { userId });

  return res.json(
    successResponse(
      'Password updated successfully. Please log in again on all devices.',
      {}
    )
  );
});

/**
 * GET /api/users
 * Returns all active users. Includes role field for admin callers.
 */
const getAllUsers = asyncWrapper(async (req, res) => {
  const { users } = await userRepository.findAll(
    { isActive: true },
    { limit: 200 },
    { name: 1 }
  );

  const isAdmin = req.user?.role === 'admin';
  const safeUsers = users.map(({ _id, name, email, avatar, role }) =>
    isAdmin ? { _id, name, email, avatar, role } : { _id, name, email, avatar }
  );

  return res.json(successResponse('Users retrieved successfully', { users: safeUsers }));
});

/**
 * PATCH /api/users/:id/role
 * Admin-only. Updates a user's global platform role.
 */
const updateUserRole = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    throw new AppError('Role must be admin or user', 400, 'INVALID_ROLE');
  }

  if (String(req.user.id || req.user._id) === String(id)) {
    throw new AppError('Cannot change your own role', 400, 'SELF_ROLE_CHANGE');
  }

  const updated = await userRepository.update(id, { role });
  if (!updated) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  logger.info('[userController] Global role updated', { targetUserId: id, newRole: role, byAdmin: req.user.id });

  return res.json(successResponse('User role updated', { userId: id, role }));
});

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
  getAllUsers,
  updateUserRole,
};
