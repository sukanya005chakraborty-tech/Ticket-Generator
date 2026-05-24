'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../config/logger');
const userRepository = require('../repositories/userRepository');
const emailService = require('./emailService');
const { AppError } = require('../middleware/errorHandler');

/**
 * Auth Service – business logic for authentication and token management.
 */

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Sign a JWT access token (short-lived).
 * Payload includes sub (userId), role, name, email for client-side use without extra API calls.
 * @param {string} userId
 * @param {string} role
 * @param {string} name
 * @param {string} email
 * @returns {string}
 */
function signAccessToken(userId, role, name = '', email = '') {
  return jwt.sign(
    { sub: userId, role, name, email, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry || '15m', issuer: 'ai-jira-generator' }
  );
}

/**
 * Sign a JWT refresh token (long-lived).
 * @param {string} userId
 * @param {string} role
 * @returns {string}
 */
function signRefreshToken(userId, role) {
  return jwt.sign(
    { sub: userId, role, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry || '7d', issuer: 'ai-jira-generator' }
  );
}

/**
 * Generate both access and refresh tokens for a user.
 * @param {string} userId
 * @param {string} role
 * @param {string} name
 * @param {string} email
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(userId, role, name = '', email = '') {
  const accessToken = signAccessToken(userId, role, name, email);
  const refreshToken = signRefreshToken(userId, role);
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Auth operations
// ---------------------------------------------------------------------------

/**
 * Register a new user.
 *
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
async function register(data) {
  const { name, email, password } = data;

  // Check for duplicate email
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL');
  }

  // Create user — password hashing is handled by the User model's pre-save hook
  const user = await userRepository.create({ name, email, password, role: data.role || 'user' });

  // Generate tokens with user identity embedded in access token payload
  const { accessToken, refreshToken } = generateTokens(String(user._id), user.role, user.name, user.email);

  // Persist refresh token in user document
  await userRepository.addRefreshToken(String(user._id), refreshToken);
  await userRepository.updateLastLogin(String(user._id));

  logger.info('[authService] New user registered', { userId: user._id, email: user.email });

  // Return user without sensitive fields
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Authenticate a user with email and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
async function login(email, password) {
  // Fetch user including password field (excluded by default)
  const user = await userRepository.findByEmailWithPassword(email);

  if (!user) {
    // Avoid timing attacks — always respond with the same generic message
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_INACTIVE');
  }

  // Compare password using bcrypt (lean object, so we cannot use model instance method)
  const bcrypt = require('bcryptjs');
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    logger.warn('[authService] Failed login attempt', { email });
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const { accessToken, refreshToken } = generateTokens(String(user._id), user.role, user.name, user.email);

  // Store refresh token + update last login
  await Promise.all([
    userRepository.addRefreshToken(String(user._id), refreshToken),
    userRepository.updateLastLogin(String(user._id)),
  ]);

  logger.info('[authService] User logged in', { userId: user._id, email: user.email });

  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Issue a new access token using a valid refresh token.
 *
 * @param {string} token – refresh token from cookie or body
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
async function refreshToken(token) {
  if (!token) {
    throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
  }

  // Verify the refresh token signature
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.refreshSecret, { issuer: 'ai-jira-generator' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Refresh token has expired, please log in again', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  if (payload.type !== 'refresh') {
    throw new AppError('Token type mismatch', 401, 'INVALID_TOKEN_TYPE');
  }

  // Confirm the token is still stored against the user (token rotation check)
  const user = await userRepository.findByRefreshToken(token);
  if (!user) {
    // Token has been used or revoked — potential token theft
    logger.warn('[authService] Refresh token not found (possible token reuse attack)', {
      userId: payload.sub,
    });
    throw new AppError('Refresh token is invalid or has been revoked', 401, 'REFRESH_TOKEN_REVOKED');
  }

  if (!user.isActive) {
    throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
  }

  // Rotate tokens: remove old refresh token, issue new pair
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(
    String(user._id),
    user.role,
    user.name,
    user.email
  );

  await Promise.all([
    userRepository.removeRefreshToken(String(user._id), token),
    userRepository.addRefreshToken(String(user._id), newRefreshToken),
  ]);

  logger.info('[authService] Tokens refreshed', { userId: user._id });

  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: safeUser };
}

/**
 * Invalidate a specific refresh token (logout).
 *
 * @param {string} userId
 * @param {string} refreshTokenValue
 * @returns {Promise<void>}
 */
async function logout(userId, refreshTokenValue) {
  if (refreshTokenValue) {
    await userRepository.removeRefreshToken(userId, refreshTokenValue);
  }
  logger.info('[authService] User logged out', { userId });
}

/**
 * Retrieve the authenticated user's profile (no sensitive fields).
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getMe(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  return safeUser;
}

/**
 * Issue access + refresh tokens for an existing user and persist the refresh token.
 * Used after invite acceptance so the new user is immediately authenticated.
 *
 * @param {object} user - User document (must have _id, role, name, email)
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function issueTokens(user) {
  const { accessToken, refreshToken: rt } = generateTokens(
    String(user._id), user.role, user.name, user.email
  );
  await userRepository.addRefreshToken(String(user._id), rt);
  await userRepository.updateLastLogin(String(user._id));
  return { accessToken, refreshToken: rt };
}

const RESET_TOKEN_EXPIRES_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a password-reset token, store its hash, and email the raw token.
 * Always resolves without revealing whether the email exists.
 * @param {string} email
 * @param {string} origin  - request origin used to build the reset URL
 */
async function forgotPassword(email, origin) {
  const user = await userRepository.findByEmail(email);
  if (!user) return; // silent — prevent email enumeration

  const rawToken    = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt   = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);

  await userRepository.setResetToken(String(user._id), hashedToken, expiresAt);

  const resetUrl = `${origin}/reset-password?token=${rawToken}`;
  await emailService.sendPasswordResetEmail({ to: user.email, resetUrl, expiresMinutes: 15 });

  logger.info('[authService] Password reset email sent', { userId: user._id });
}

/**
 * Validate a raw reset token and update the user's password.
 * @param {string} rawToken
 * @param {string} newPassword  - plain text; model pre-save hook hashes it
 */
async function resetPassword(rawToken, newPassword) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await userRepository.findByResetToken(hashedToken);
  if (!user) {
    throw new AppError('Password reset token is invalid or has expired', 400, 'INVALID_RESET_TOKEN');
  }

  await userRepository.updatePassword(String(user._id), newPassword);
  logger.info('[authService] Password reset successful', { userId: user._id });
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  generateTokens,
  signAccessToken,
  signRefreshToken,
  issueTokens,
  forgotPassword,
  resetPassword,
};
