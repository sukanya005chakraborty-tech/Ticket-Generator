'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getOverview, getTrends } = require('../controllers/analyticsController');

const router = Router();

/**
 * Analytics Routes
 * Base path: /api/analytics
 * All routes require authentication.
 */

// GET /api/analytics/overview
// Dashboard overview stats (totals, counts by status/priority/severity, AI usage)
router.get('/overview', authenticate, getOverview);

// GET /api/analytics/trends
// Daily ticket creation trend data for the last N days
// Query: ?period=week|month|quarter
router.get('/trends', authenticate, getTrends);

module.exports = router;
