'use strict';

const analyticsService = require('../services/analyticsService');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/analytics/overview
 */
const getOverview = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { projectId } = req.query;

  const overview = await analyticsService.getOverview(userId, projectId || null, userRole);

  return res.json(successResponse('Analytics overview retrieved successfully', { overview }));
});

/**
 * GET /api/analytics/trends
 * Query param: ?period=week|month|quarter  (default: month)
 */
const getTrends = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const userRole = req.user.role;
  const period = req.query.period || 'month';

  const validPeriods = ['week', 'month', 'quarter'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({
      success: false,
      message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
      code: 'INVALID_PERIOD',
    });
  }

  const { projectId } = req.query;

  const trends = await analyticsService.getTrends(userId, period, projectId || null, userRole);

  return res.json(successResponse('Trends retrieved successfully', { trends }));
});

module.exports = {
  getOverview,
  getTrends,
};
