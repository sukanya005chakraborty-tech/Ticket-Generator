'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validators/authValidator');
const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const { getInvite, acceptInvite } = require('../controllers/inviteController');

const router = Router();

/**
 * Auth Routes
 * Base path: /api/auth
 */

// POST /api/auth/register
// Public — rate limited to prevent enumeration/spam
router.post('/register', authLimiter, validate(registerSchema), register);

// POST /api/auth/login
// Public — rate limited to prevent brute-force
router.post('/login', authLimiter, validate(loginSchema), login);

// POST /api/auth/refresh-token
// Public — accepts refresh token from httpOnly cookie or body
router.post('/refresh-token', refreshToken);

// POST /api/auth/logout
// Protected — clears refresh token
router.post('/logout', authenticate, logout);

// GET /api/auth/me
// Protected — returns current user's profile
router.get('/me', authenticate, getMe);

// POST /api/auth/forgot-password
// Public — rate limited; always 200 to prevent enumeration
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

// POST /api/auth/reset-password
// Public — validates token + new password
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

// GET  /api/auth/invite?token=xxx  — preview invite (public)
router.get('/invite', getInvite);

// POST /api/auth/accept-invite      — accept invite (public)
router.post('/accept-invite', acceptInvite);

module.exports = router;
