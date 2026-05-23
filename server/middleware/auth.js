'use strict';

/**
 * @fileoverview JWT authentication and RBAC authorization middleware.
 * Supports token delivery via Authorization header (Bearer) and httpOnly cookies.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AppError } = require('./errorHandler');
const User = require('../models/User');

// ── Token Extraction ──────────────────────────────────────────────────────────

/**
 * Extract a raw JWT string from the incoming request.
 * Priority: Authorization header (Bearer) → accessToken cookie.
 *
 * @param {import('express').Request} req
 * @returns {string|null} Raw token string or null if not found.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null;
  }

  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken || null;
  }

  return null;
}

/**
 * Verify a JWT access token synchronously and return the decoded payload.
 *
 * @param {string} token - Raw JWT string.
 * @returns {Object} Decoded payload.
 * @throws {AppError} On invalid or expired token.
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'TOKEN_INVALID');
  }
}

// ── Middleware: authenticate ──────────────────────────────────────────────────

/**
 * Protect a route by requiring a valid JWT access token.
 * On success, attaches `req.user` (the full User document) and `req.tokenPayload`.
 * On failure, passes an AppError to `next()`.
 *
 * @type {import('express').RequestHandler}
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(new AppError('Authentication token is missing', 401, 'TOKEN_MISSING'));
    }

    const decoded = verifyAccessToken(token);

    // Fetch fresh user to catch deactivated / deleted accounts
    const user = await User.findById(decoded.sub).select('-password -refreshToken');

    if (!user) {
      return next(new AppError('User no longer exists', 401, 'TOKEN_INVALID'));
    }

    if (!user.isActive || user.isDeleted) {
      return next(new AppError('Account is inactive or has been deleted', 403, 'ACCOUNT_INACTIVE'));
    }

    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (err) {
    next(err);
  }
};

// ── Middleware: authorize ─────────────────────────────────────────────────────

/**
 * Role-based access control (RBAC) middleware factory.
 * Must be placed **after** `authenticate` in the middleware chain.
 *
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'user').
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.delete('/users/:id', authenticate, authorize('admin'), deleteUser);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'TOKEN_MISSING'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role(s): ${roles.join(', ')}`,
          403,
          'UNAUTHORIZED'
        )
      );
    }

    next();
  };
};

// ── Middleware: optionalAuth ──────────────────────────────────────────────────

/**
 * Optional authentication middleware.
 * Attempts to authenticate the request; if a valid token is found, `req.user`
 * is populated. If the token is missing or invalid, the request continues
 * unauthenticated (no error is thrown).
 *
 * @type {import('express').RequestHandler}
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(); // No token — continue as anonymous
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (_) {
      return next(); // Invalid/expired token — continue as anonymous
    }

    const user = await User.findById(decoded.sub).select('-password -refreshToken');

    if (user && user.isActive && !user.isDeleted) {
      req.user = user;
      req.tokenPayload = decoded;
    }

    next();
  } catch (err) {
    // Swallow all errors — this middleware must never block the request
    next();
  }
};

module.exports = { authenticate, authorize, optionalAuth };
