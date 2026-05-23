'use strict';

/**
 * @fileoverview ActivityLog Mongoose model.
 * Records all significant user actions for auditing and analytics.
 * Documents are automatically expired after 90 days via a MongoDB TTL index.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ── Action Enum ───────────────────────────────────────────────────────────────

const ACTIVITY_ACTIONS = [
  'ticket_created',
  'ticket_updated',
  'ticket_deleted',
  'ticket_exported',
  'user_login',
  'user_logout',
  'settings_updated',
  'password_changed',
  'profile_updated',
];

// ── Main Schema ───────────────────────────────────────────────────────────────

const activityLogSchema = new Schema(
  {
    /** The user who performed the action. */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    /** Standardized action identifier. */
    action: {
      type: String,
      enum: {
        values: ACTIVITY_ACTIONS,
        message: `Action must be one of: ${ACTIVITY_ACTIONS.join(', ')}`,
      },
      required: [true, 'Action is required'],
    },

    /** ID of the resource affected by the action (e.g. ticket ID). */
    resourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    /** Human-readable type of the resource (e.g. "Ticket", "User"). */
    resourceType: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Additional context for the action.
     * Free-form object — use sparingly to avoid schema bloat.
     * Examples: { ticketRef: 'TKT-000001', oldStatus: 'draft', newStatus: 'open' }
     */
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },

    /** IP address of the client at the time of the action. */
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },

    /** User-Agent string from the request. */
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ resourceId: 1, resourceType: 1 });

/**
 * TTL index: MongoDB automatically deletes documents 90 days after createdAt.
 * This keeps the collection lean without manual cleanup jobs.
 */
activityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days
);

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Override toJSON to rename _id to id.
 * @returns {Object}
 */
activityLogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Create and persist a new activity log entry in a fire-and-forget fashion.
 * Errors are swallowed to prevent logging failures from disrupting the main request flow.
 *
 * @param {Object} params
 * @param {string|import('mongoose').Types.ObjectId} params.userId
 * @param {string} params.action - One of ACTIVITY_ACTIONS.
 * @param {string|import('mongoose').Types.ObjectId} [params.resourceId]
 * @param {string} [params.resourceType]
 * @param {Object} [params.metadata]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {void} Does not return a promise — non-blocking.
 */
activityLogSchema.statics.record = function ({
  userId,
  action,
  resourceId = null,
  resourceType = null,
  metadata = null,
  ipAddress = null,
  userAgent = null,
}) {
  this.create({
    userId,
    action,
    resourceId,
    resourceType,
    metadata,
    ipAddress,
    userAgent,
  }).catch((err) => {
    // Import logger lazily to avoid circular dependencies
    try {
      const logger = require('../config/logger');
      logger.error('Failed to record activity log', { error: err.message, action, userId });
    } catch (_) {
      // If logger is unavailable, fail silently
    }
  });
};

/**
 * Get paginated activity logs for a specific user.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<{docs: Array, total: number}>}
 */
activityLogSchema.statics.getForUser = async function (userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    this.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ userId }),
  ]);

  return { docs, total };
};

// ── Model Export ──────────────────────────────────────────────────────────────

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
module.exports.ACTIVITY_ACTIONS = ACTIVITY_ACTIONS;
