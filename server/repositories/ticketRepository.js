'use strict';

const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');

/**
 * Ticket Repository – data access layer for Ticket documents.
 * All methods are index-aware and return plain JS objects.
 */

/**
 * Create a new ticket document.
 * @param {object} data
 * @returns {Promise<object>}
 */
async function create(data) {
  const ticket = new Ticket(data);
  const saved = await ticket.save();
  return saved.toObject();
}

/**
 * Find a ticket by id.
 * Pass userId to scope to owner only (legacy solo mode).
 * Pass projectId to scope to project (project mode).
 * Pass neither to find by id alone (service enforces auth).
 * @param {string} id
 * @param {string} [userId]
 * @returns {Promise<object|null>}
 */
async function findById(id, userId) {
  try {
    const query = {
      _id: id,
      isDeleted: { $ne: true },
    };

    if (userId) query.userId = userId;

    const ticket = await Ticket.findOne(query)
      .populate('assignedTo', 'name email avatar')
      .populate('projectId', 'name key')
      .lean();
    return ticket || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Find a ticket by id with no user/project scoping (service enforces auth).
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findByIdUnsafe(id) {
  try {
    const ticket = await Ticket.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate('assignedTo', 'name email avatar')
      .populate('projectId', 'name key')
      .lean();
    return ticket || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Update a ticket by id.
 * Pass userId to enforce ownership (legacy mode).
 * Omit userId when service handles auth (project mode).
 * @param {string} id
 * @param {string|null} userId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function update(id, userId, data) {
  try {
    const filter = { _id: id, isDeleted: { $ne: true } };
    if (userId) filter.userId = userId;

    const updated = await Ticket.findOneAndUpdate(
      filter,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name email avatar')
      .lean();
    return updated || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Append a single comment to a ticket's comments array.
 * Pass userId to enforce ownership (legacy). Omit for project tickets.
 * @param {string} id
 * @param {string|null} userId
 * @param {{ text: string, createdAt: Date }} comment
 * @returns {Promise<object|null>}
 */
async function pushComment(id, userId, comment) {
  try {
    const filter = { _id: id, isDeleted: { $ne: true } };
    if (userId) filter.userId = userId;

    const updated = await Ticket.findOneAndUpdate(
      filter,
      { $push: { comments: comment }, $set: { updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();
    return updated || null;
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}

/**
 * Soft-delete a ticket.
 * Pass userId to enforce ownership (legacy mode).
 * Omit userId when service handles auth (project mode).
 * @param {string} id
 * @param {string|null} userId
 * @returns {Promise<boolean>}
 */
async function softDelete(id, userId) {
  try {
    const filter = { _id: id, isDeleted: { $ne: true } };
    if (userId) filter.userId = userId;

    const result = await Ticket.findOneAndUpdate(
      filter,
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return result !== null;
  } catch (err) {
    if (err.name === 'CastError') return false;
    throw err;
  }
}

/**
 * Find all tickets with filtering, pagination, and sorting.
 * Scope by userId (solo mode) OR projectId (project mode) — one is required.
 *
 * @param {string|null} userId     – scope to owner (solo mode)
 * @param {object}      filters    – { projectId?, assignedTo?, status, priority, severity,
 *                                     search, startDate, endDate, dueDate, labels, module, environment }
 * @param {object}      pagination – { skip, limit }
 * @param {object}      sort       – mongoose sort object e.g. { createdAt: -1 }
 * @returns {Promise<{ tickets: object[], total: number }>}
 */
async function findAll(userId, filters = {}, pagination = {}, sort = { createdAt: -1 }) {
  const query = { isDeleted: { $ne: true } };

  if (filters.projectId && userId) {
    query.$or = [
      { projectId: new mongoose.Types.ObjectId(filters.projectId) },
      { userId: new mongoose.Types.ObjectId(userId), projectId: null },
    ];
  } else if (filters.projectId) {
    query.projectId = new mongoose.Types.ObjectId(filters.projectId);
  } else if (filters.userProjectIds && filters.userProjectIds.length > 0) {
    // Regular user "All Projects": tickets from all their projects + solo tickets
    query.$or = [
      { projectId: { $in: filters.userProjectIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { userId: new mongoose.Types.ObjectId(userId), projectId: null },
    ];
  } else if (userId) {
    query.userId = new mongoose.Types.ObjectId(userId);
  }

  // Exact enum filters
  if (filters.status) {
    query.status = Array.isArray(filters.status)
      ? { $in: filters.status }
      : filters.status;
  }

  if (filters.priority) {
    query.priority = Array.isArray(filters.priority)
      ? { $in: filters.priority }
      : filters.priority;
  }

  if (filters.severity) {
    query.severity = Array.isArray(filters.severity)
      ? { $in: filters.severity }
      : filters.severity;
  }

  if (filters.module) {
    query.module = filters.module;
  }

  if (filters.environment) {
    query.environment = filters.environment;
  }

  if (filters.labels && filters.labels.length > 0) {
    query.labels = { $in: Array.isArray(filters.labels) ? filters.labels : [filters.labels] };
  }

  if (filters.assignedTo) {
    query.assignedTo = filters.assignedTo === 'unassigned'
      ? null
      : new mongoose.Types.ObjectId(filters.assignedTo);
  }

  // dueDate filter: 'overdue' | 'today' | 'week' | specific ISO date
  if (filters.dueDate) {
    const now = new Date();
    if (filters.dueDate === 'overdue') {
      query.dueDate = { $lt: now, $ne: null };
    } else if (filters.dueDate === 'today') {
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      query.dueDate = { $gte: now, $lte: end };
    } else if (filters.dueDate === 'week') {
      const end = new Date(now); end.setDate(end.getDate() + 7);
      query.dueDate = { $gte: now, $lte: end };
    } else {
      const d = new Date(filters.dueDate);
      if (!isNaN(d)) query.dueDate = d;
    }
  }

  // Full-text / regex search on title and description
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const searchOr = [{ title: regex }, { description: regex }, { summary: regex }];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  // Date range on createdAt
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const { skip = 0, limit = 20 } = pagination;

  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .populate('assignedTo', 'name email avatar')
      .populate('projectId', 'name key')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(query),
  ]);

  return { tickets, total };
}

// ---------------------------------------------------------------------------
// Scope filter helper
// ---------------------------------------------------------------------------

/**
 * Build a base match filter scoped to a project (any member's tickets) or a user.
 * @param {string} userId
 * @param {string|null|undefined} projectId
 * @returns {object}
 */
function buildScopeFilter(userId, projectId, isAdmin = false, userProjectIds = [], assignedTo = null) {
  const base = { isDeleted: { $ne: true } };
  const assignedFilter = assignedTo ? { assignedTo: new mongoose.Types.ObjectId(assignedTo) } : {};
  if (projectId) {
    return { ...base, ...assignedFilter, projectId: new mongoose.Types.ObjectId(projectId) };
  }
  if (isAdmin) {
    return { ...base, ...assignedFilter };
  }
  if (userProjectIds.length > 0) {
    return {
      ...base,
      ...assignedFilter,
      $or: [
        { projectId: { $in: userProjectIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { userId: new mongoose.Types.ObjectId(userId), projectId: null },
      ],
    };
  }
  return { ...base, ...assignedFilter, userId: new mongoose.Types.ObjectId(userId) };
}

/**
 * Aggregate ticket counts by status, priority, and severity for a user/project.
 * @param {string} userId
 * @param {string} [projectId]
 * @returns {Promise<object>}
 */
async function findStats(userId, projectId, isAdmin = false, userProjectIds = [], assignedTo = null) {
  const matchStage = {
    $match: buildScopeFilter(userId, projectId, isAdmin, userProjectIds, assignedTo),
  };

  const [statusResult, priorityResult, severityResult] = await Promise.all([
    Ticket.aggregate([
      matchStage,
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      matchStage,
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      matchStage,
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (arr) =>
    arr.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

  return {
    byStatus: toMap(statusResult),
    byPriority: toMap(priorityResult),
    bySeverity: toMap(severityResult),
  };
}

/**
 * Fetch recent tickets for a user/project, ordered by updatedAt descending.
 * @param {string} userId
 * @param {number} limit  – defaults to 10
 * @param {string} [projectId]
 * @returns {Promise<object[]>}
 */
async function findRecentActivity(userId, limit = 10, projectId, isAdmin = false, userProjectIds = [], assignedTo = null) {
  const tickets = await Ticket.find(buildScopeFilter(userId, projectId, isAdmin, userProjectIds, assignedTo))
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('ticketRef title status priority severity updatedAt createdAt')
    .lean();

  return tickets;
}

/**
 * Count total tickets for a user/project (non-deleted).
 * @param {string} userId
 * @param {string} [projectId]
 * @returns {Promise<number>}
 */
async function countByUser(userId, projectId, isAdmin = false, userProjectIds = [], assignedTo = null) {
  return Ticket.countDocuments(buildScopeFilter(userId, projectId, isAdmin, userProjectIds, assignedTo));
}

/**
 * Count tickets created within a date range for a user/project.
 * @param {string} userId
 * @param {Date}   startDate
 * @param {Date}   endDate
 * @param {string} [projectId]
 * @returns {Promise<number>}
 */
async function countByDateRange(userId, startDate, endDate, projectId, isAdmin = false, userProjectIds = [], assignedTo = null) {
  return Ticket.countDocuments({
    ...buildScopeFilter(userId, projectId, isAdmin, userProjectIds, assignedTo),
    createdAt: { $gte: startDate, $lte: endDate },
  });
}

/**
 * Aggregate daily ticket creation counts for the last N days (for trend charts).
 * @param {string} userId
 * @param {number} days      – number of days to look back (default 30)
 * @param {string} [projectId]
 * @returns {Promise<Array<{ date: string, count: number }>>}
 */
async function findDailyTrends(userId, days = 30, projectId, isAdmin = false, userProjectIds = [], assignedTo = null) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const scopeFilter = buildScopeFilter(userId, projectId, isAdmin, userProjectIds, assignedTo);
  const results = await Ticket.aggregate([
    {
      $match: {
        ...scopeFilter,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day',
              },
            },
          },
        },
        count: 1,
      },
    },
  ]);

  // Fill gaps so every day in the range has an entry
  const dateMap = new Map(results.map((r) => [r.date, r.count]));
  const trend = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ date: key, count: dateMap.get(key) || 0 });
  }

  return trend;
}

module.exports = {
  create,
  findById,
  findByIdUnsafe,
  update,
  pushComment,
  softDelete,
  findAll,
  findStats,
  findRecentActivity,
  countByUser,
  countByDateRange,
  findDailyTrends,
};
