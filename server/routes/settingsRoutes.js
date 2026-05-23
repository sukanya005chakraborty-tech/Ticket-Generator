'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');
const { AppError } = require('../middleware/errorHandler');
const userRepository = require('../repositories/userRepository');
const logger = require('../config/logger');

const router = Router();

/**
 * Settings Routes
 * Base path: /api/settings
 * All routes require authentication.
 *
 * Settings are stored as a nested object on the User document (user.settings).
 * This keeps the surface area small — no separate Settings model required.
 */

/**
 * GET /api/settings
 * Returns the authenticated user's settings object.
 */
router.get(
  '/',
  authenticate,
  asyncWrapper(async (req, res) => {
    const userId = req.user.id || req.user._id;

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Return the settings sub-document (or an empty object if not set)
    const settings = user.settings || {};

    return res.json(successResponse('Settings retrieved successfully', { settings }));
  })
);

/**
 * PUT /api/settings
 * Deep-merges the provided settings object into the user's existing settings.
 *
 * Accepted body fields (all optional):
 *   - theme: 'light' | 'dark' | 'system'
 *   - language: BCP-47 tag (e.g. 'en', 'fr')
 *   - notifications: { email: boolean, inApp: boolean }
 *   - defaultEnvironment: string
 *   - defaultBrowser: string
 *   - defaultDevice: string
 *   - aiModel: string (model identifier override)
 *   - timezone: IANA timezone string
 */
router.put(
  '/',
  authenticate,
  asyncWrapper(async (req, res) => {
    const userId = req.user.id || req.user._id;

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Whitelist allowed setting keys
    const ALLOWED_SETTING_KEYS = [
      'theme',
      'language',
      'notifications',
      'defaultEnvironment',
      'defaultBrowser',
      'defaultDevice',
      'aiModel',
      'timezone',
      'ticketsPerPage',
      'dateFormat',
    ];

    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw new AppError('Request body must be a settings object', 400, 'INVALID_BODY');
    }

    // Build a filtered update object
    const settingsUpdate = {};
    for (const key of ALLOWED_SETTING_KEYS) {
      if (incoming[key] !== undefined) {
        settingsUpdate[`settings.${key}`] = incoming[key];
      }
    }

    if (Object.keys(settingsUpdate).length === 0) {
      throw new AppError(
        `No recognised settings keys provided. Allowed: ${ALLOWED_SETTING_KEYS.join(', ')}`,
        400,
        'NO_VALID_SETTINGS'
      );
    }

    // Validate specific fields
    if (settingsUpdate['settings.theme'] && !['light', 'dark', 'system'].includes(settingsUpdate['settings.theme'])) {
      throw new AppError('Invalid theme. Must be light, dark, or system.', 400, 'INVALID_THEME');
    }

    if (settingsUpdate['settings.ticketsPerPage']) {
      const perPage = Number(settingsUpdate['settings.ticketsPerPage']);
      if (!Number.isInteger(perPage) || perPage < 5 || perPage > 100) {
        throw new AppError('ticketsPerPage must be an integer between 5 and 100', 400, 'INVALID_TICKETS_PER_PAGE');
      }
      settingsUpdate['settings.ticketsPerPage'] = perPage;
    }

    const updated = await userRepository.update(userId, settingsUpdate);
    if (!updated) {
      throw new AppError('Failed to update settings', 500, 'UPDATE_FAILED');
    }

    const settings = updated.settings || {};
    logger.info('[settingsRoutes] Settings updated', { userId, keys: Object.keys(settingsUpdate) });

    return res.json(successResponse('Settings updated successfully', { settings }));
  })
);

module.exports = router;
