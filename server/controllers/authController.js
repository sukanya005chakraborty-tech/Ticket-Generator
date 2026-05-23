'use strict';

const authService = require('../services/authService');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');
const config = require('../config/env');

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: config.env === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/auth',
  };
}

function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: config.env === 'production' ? 'strict' : 'lax',
    path: '/api/auth',
  };
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register
 */
const register = asyncWrapper(async (req, res) => {
  const { name, email, password } = req.body;

  const { user, accessToken, refreshToken } = await authService.register({
    name,
    email,
    password,
  });

  // Set refresh token as httpOnly cookie
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res
    .status(201)
    .json(
      successResponse('Account created successfully', {
        user,
        accessToken,
      })
    );
});

/**
 * POST /api/auth/login
 */
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } = await authService.login(email, password);

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res.json(
    successResponse('Logged in successfully', {
      user,
      accessToken,
    })
  );
});

/**
 * POST /api/auth/refresh-token
 * Accepts refresh token from httpOnly cookie OR request body (for mobile clients).
 */
const refreshToken = asyncWrapper(async (req, res) => {
  const token =
    req.cookies[REFRESH_TOKEN_COOKIE_NAME] ||
    req.body.refreshToken ||
    req.headers['x-refresh-token'];

  const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshToken(token);

  // Rotate cookie
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());

  return res.json(
    successResponse('Token refreshed successfully', {
      accessToken,
      user,
    })
  );
});

/**
 * POST /api/auth/logout
 * Requires authenticate middleware — req.user is set.
 */
const logout = asyncWrapper(async (req, res) => {
  const token =
    req.cookies[REFRESH_TOKEN_COOKIE_NAME] ||
    req.body.refreshToken ||
    req.headers['x-refresh-token'];

  await authService.logout(req.user.id || req.user._id, token);

  // Clear the httpOnly cookie
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getClearCookieOptions());

  return res.json(successResponse('Logged out successfully'));
});

/**
 * GET /api/auth/me
 * Requires authenticate middleware — req.user is set.
 */
const getMe = asyncWrapper(async (req, res) => {
  const user = await authService.getMe(req.user.id || req.user._id);

  return res.json(successResponse('Profile retrieved successfully', { user }));
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
};
