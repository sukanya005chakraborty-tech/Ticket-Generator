'use strict';

const User = require('../models/User');

/**
 * User Repository – data access layer for User documents.
 * All methods return plain JS objects (lean) or null when not found.
 * No business logic lives here; this layer only speaks to MongoDB.
 */

/**
 * Find a user by their MongoDB ObjectId.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  try {
    const user = await User.findById(id).lean();
    return user || null;
  } catch (err) {
    // Invalid ObjectId format resolves to null instead of throwing
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Find a user by email address (case-insensitive).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isDeleted: { $ne: true },
  }).lean();
  return user || null;
}

/**
 * Find a user by email, including the password field (needed for auth).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmailWithPassword(email) {
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isDeleted: { $ne: true },
  })
    .select('+password')
    .lean();
  return user || null;
}

/**
 * Create a new user document.
 * @param {object} data  – fields to persist
 * @returns {Promise<object>}  plain user object (without password)
 */
async function create(data) {
  const user = new User({
    ...data,
    email: data.email.toLowerCase().trim(),
  });
  const saved = await user.save();
  // Return lean copy minus password
  const plain = saved.toObject();
  delete plain.password;
  return plain;
}

/**
 * Update a user by id.
 * @param {string} id
 * @param {object} data  – fields to set (never pass password here; use model hooks)
 * @returns {Promise<object|null>}
 */
async function update(id, data) {
  try {
    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();
    return updated || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Soft-delete a user by id (sets isDeleted + deletedAt).
 * @param {string} id
 * @returns {Promise<boolean>}  true if record existed and was marked deleted
 */
async function softDelete(id) {
  try {
    const result = await User.findByIdAndUpdate(id, {
      $set: { isDeleted: true, deletedAt: new Date(), isActive: false },
    });
    return result !== null;
  } catch (err) {
    if (err.name === 'CastError') return false;
    throw err;
  }
}

// Alias kept for the contract interface
const deleteById = softDelete;

/**
 * Find all users with optional search and pagination.
 * @param {object} filters  – { search, isActive, role }
 * @param {object} pagination – { page, limit, skip }
 * @param {object} sort       – mongoose sort object e.g. { createdAt: -1 }
 * @returns {Promise<{ users: object[], total: number }>}
 */
async function findAll(filters = {}, pagination = {}, sort = { createdAt: -1 }) {
  const query = { isDeleted: { $ne: true } };

  if (filters.search) {
    const regex = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { email: regex }];
  }

  if (typeof filters.isActive === 'boolean') {
    query.isActive = filters.isActive;
  }

  if (filters.role) {
    query.role = filters.role;
  }

  const { skip = 0, limit = 20 } = pagination;

  const [users, total] = await Promise.all([
    User.find(query).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);

  return { users, total };
}

/**
 * Update a user's refresh token list (add a new token).
 * @param {string} id
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
async function addRefreshToken(id, refreshToken) {
  await User.findByIdAndUpdate(id, {
    $push: {
      refreshTokens: {
        token: refreshToken,
        createdAt: new Date(),
      },
    },
  });
}

/**
 * Remove a specific refresh token from a user's token list.
 * @param {string} id
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
async function removeRefreshToken(id, refreshToken) {
  await User.findByIdAndUpdate(id, {
    $pull: { refreshTokens: { token: refreshToken } },
  });
}

/**
 * Remove all refresh tokens for a user (full logout).
 * @param {string} id
 * @returns {Promise<void>}
 */
async function removeAllRefreshTokens(id) {
  await User.findByIdAndUpdate(id, { $set: { refreshTokens: [] } });
}

/**
 * Find a user that holds a specific refresh token.
 * @param {string} refreshToken
 * @returns {Promise<object|null>}
 */
async function findByRefreshToken(refreshToken) {
  const user = await User.findOne({
    'refreshTokens.token': refreshToken,
    isDeleted: { $ne: true },
  }).lean();
  return user || null;
}

/**
 * Update user's last login timestamp.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function updateLastLogin(id) {
  await User.findByIdAndUpdate(id, { $set: { lastLoginAt: new Date() } });
}

/**
 * Store a hashed password-reset token with expiry.
 * @param {string} id
 * @param {string} hashedToken
 * @param {Date}   expiresAt
 */
async function setResetToken(id, hashedToken, expiresAt) {
  await User.findByIdAndUpdate(id, {
    $set: { passwordResetToken: hashedToken, passwordResetExpires: expiresAt },
  });
}

/**
 * Find a user whose (non-expired) hashed reset token matches.
 * @param {string} hashedToken
 * @returns {Promise<object|null>}
 */
async function findByResetToken(hashedToken) {
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    isDeleted: { $ne: true },
  })
    .select('+passwordResetToken +passwordResetExpires')
    .lean();
  return user || null;
}

/**
 * Update the password via the model instance so the pre-save hook hashes it,
 * then clear the reset token fields.
 * @param {string} id
 * @param {string} newPlainPassword
 * @returns {Promise<boolean>}
 */
async function updatePassword(id, newPlainPassword) {
  const user = await User.findById(id).select('+password +passwordResetToken +passwordResetExpires');
  if (!user) return false;
  user.password = newPlainPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();
  return true;
}

module.exports = {
  findById,
  findByEmail,
  findByEmailWithPassword,
  create,
  update,
  delete: deleteById,
  softDelete,
  findAll,
  addRefreshToken,
  removeRefreshToken,
  removeAllRefreshTokens,
  findByRefreshToken,
  updateLastLogin,
  setResetToken,
  findByResetToken,
  updatePassword,
};
