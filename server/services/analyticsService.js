'use strict';

const mongoose           = require('mongoose');
const ticketRepository   = require('../repositories/ticketRepository');
const projectRepository  = require('../repositories/projectRepository');
const logger             = require('../config/logger');
const cache            = require('./cacheService');
const config           = require('../config/env');

/**
 * Analytics Service – business logic for dashboard metrics and trend data.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns start of current week (Monday 00:00 UTC).
 * @returns {Date}
 */
function startOfWeek() {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns start of current month (1st day 00:00 UTC).
 * @returns {Date}
 */
function startOfMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Get dashboard overview statistics for a user or project.
 *
 * @param {string} userId
 * @param {string} [projectId]
 * @returns {Promise<object>}
 */
async function getOverview(userId, projectId, userRole = 'user') {
  const cacheKey = cache.keys.analyticsOverview(userId, projectId);
  return cache.remember(cacheKey, () => _fetchOverview(userId, projectId, userRole), config.cacheTtlMedium);
}

async function _fetchOverview(userId, projectId, userRole) {
  const objectId = new mongoose.Types.ObjectId(userId);
  const isAdmin = userRole === 'admin';
  const assignedTo = isAdmin ? null : userId;

  let userProjectIds = [];
  if (!isAdmin && !projectId) {
    const userProjects = await projectRepository.findByMember(userId);
    userProjectIds = userProjects.map((p) => p._id);
  }

  // Parallelise all aggregations
  const [
    totalTickets,
    ticketsThisWeek,
    ticketsThisMonth,
    stats,
    aiStats,
    recentActivity,
  ] = await Promise.all([
    ticketRepository.countByUser(userId, projectId, isAdmin, userProjectIds, assignedTo),
    ticketRepository.countByDateRange(userId, startOfWeek(), new Date(), projectId, isAdmin, userProjectIds, assignedTo),
    ticketRepository.countByDateRange(userId, startOfMonth(), new Date(), projectId, isAdmin, userProjectIds, assignedTo),
    ticketRepository.findStats(userId, projectId, isAdmin, userProjectIds, assignedTo),
    getAiStats(objectId),
    ticketRepository.findRecentActivity(userId, 5, projectId, isAdmin, userProjectIds, assignedTo),
  ]);

  // Build default-filled maps
  const countByStatus = {
    draft: 0,
    open: 0,
    'in-progress': 0,
    resolved: 0,
    closed: 0,
    ...stats.byStatus,
  };

  const countByPriority = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    ...stats.byPriority,
  };

  const countBySeverity = {
    Blocker: 0,
    Critical: 0,
    Major: 0,
    Minor: 0,
    Trivial: 0,
    ...stats.bySeverity,
  };

  logger.info('[analyticsService] Overview generated', { userId, totalTickets });

  return {
    totalTickets,
    ticketsThisWeek,
    ticketsThisMonth,
    countByStatus,
    countByPriority,
    countBySeverity,
    averageGenerationTimeMs: aiStats.averageGenerationTimeMs,
    totalTokensUsed: aiStats.totalTokensUsed,
    aiCallsCount: aiStats.aiCallsCount,
    recentActivity,
  };
}

/**
 * Aggregate AI usage statistics from the AiLog collection.
 * @param {mongoose.Types.ObjectId} objectId
 * @returns {Promise<{ averageGenerationTimeMs: number, totalTokensUsed: number, aiCallsCount: number }>}
 */
async function getAiStats(objectId) {
  const zero = { averageGenerationTimeMs: 0, totalTokensUsed: 0, aiCallsCount: 0 };
  try {
    const AiLog = require('../models/AiLog');

    const result = await AiLog.aggregate([
      { $match: { userId: objectId, status: 'success' } },
      {
        $group: {
          _id: null,
          averageGenerationTimeMs: { $avg: '$duration' },
          totalTokensUsed: { $sum: '$tokensUsed.total' },
          aiCallsCount: { $sum: 1 },
        },
      },
    ]);

    if (!result || result.length === 0) return zero;

    const row = result[0];
    return {
      averageGenerationTimeMs: Math.round(row.averageGenerationTimeMs || 0),
      totalTokensUsed: row.totalTokensUsed || 0,
      aiCallsCount: row.aiCallsCount || 0,
    };
  } catch (err) {
    logger.warn('[analyticsService] Failed to fetch AI stats', { error: err.message });
    return zero;
  }
}

/**
 * Get ticket creation trend data for charting.
 *
 * @param {string} userId
 * @param {string} [period]    – 'week' (7 days) | 'month' (30 days, default) | 'quarter' (90 days)
 * @param {string} [projectId]
 * @returns {Promise<{ period: string, days: number, trend: Array<{ date: string, count: number }> }>}
 */
async function getTrends(userId, period = 'month', projectId, userRole = 'user') {
  const cacheKey = cache.keys.analyticsTrends(userId, period, projectId);
  return cache.remember(cacheKey, () => _fetchTrends(userId, period, projectId, userRole), config.cacheTtlMedium);
}

async function _fetchTrends(userId, period, projectId, userRole) {
  const periodDaysMap = { week: 7, month: 30, quarter: 90 };
  const days = periodDaysMap[period] || 30;
  const isAdmin = userRole === 'admin';
  const assignedTo = isAdmin ? null : userId;

  let userProjectIds = [];
  if (!isAdmin && !projectId) {
    const userProjects = await projectRepository.findByMember(userId);
    userProjectIds = userProjects.map((p) => p._id);
  }

  const trend = await ticketRepository.findDailyTrends(userId, days, projectId, isAdmin, userProjectIds, assignedTo);

  logger.info('[analyticsService] Trends generated', { userId, period, days, points: trend.length });

  return { period, days, trend };
}

module.exports = {
  getOverview,
  getTrends,
};
