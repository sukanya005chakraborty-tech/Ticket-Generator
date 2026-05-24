'use strict';

const ActivityLog = require('../models/ActivityLog');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');

/**
 * GET /api/admin/activity-logs
 * Query: page, limit, userId, action, startDate, endDate
 */
const getActivityLogs = asyncWrapper(async (req, res) => {
  const {
    page      = 1,
    limit     = 20,
    userId,
    action,
    startDate,
    endDate,
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const query = {};
  if (userId)    query.userId = userId;
  if (action)    query.action = action;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate)   query.createdAt.$lte = new Date(endDate);
  }

  const [docs, total] = await Promise.all([
    ActivityLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  return res.json(
    successResponse('Activity logs retrieved', {
      logs: docs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  );
});

module.exports = { getActivityLogs };
