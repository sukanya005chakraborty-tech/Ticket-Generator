'use strict';

/**
 * @fileoverview AiLog Mongoose model.
 * Tracks every AI API call made during ticket generation, including
 * the prompt, raw response, token usage, duration, and status.
 * Used for auditing, cost tracking, and debugging AI interactions.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ── Token Usage Sub-schema ────────────────────────────────────────────────────

/**
 * OpenAI token usage breakdown.
 */
const tokenUsageSchema = new Schema(
  {
    prompt: {
      type: Number,
      default: 0,
      min: 0,
    },
    completion: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

// ── AI Log Enums ──────────────────────────────────────────────────────────────

const AI_LOG_STATUS = ['success', 'error', 'retry'];

// ── Main Schema ───────────────────────────────────────────────────────────────

const aiLogSchema = new Schema(
  {
    /** Reference to the ticket that was generated (may be null if generation failed). */
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
      index: true,
    },

    /** Reference to the user who initiated the AI call. */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    /** The full prompt string sent to the AI model. */
    prompt: {
      type: String,
      required: [true, 'Prompt is required'],
    },

    /** The raw string response received from the AI model. */
    rawResponse: {
      type: String,
      default: '',
    },

    /** The AI model identifier used (e.g. "gpt-4o"). */
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },

    /** Token usage reported by the API. */
    tokensUsed: {
      type: tokenUsageSchema,
      default: () => ({ prompt: 0, completion: 0, total: 0 }),
    },

    /** Total wall-clock time in milliseconds from request to response. */
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Outcome of this AI call. */
    status: {
      type: String,
      enum: {
        values: AI_LOG_STATUS,
        message: `Status must be one of: ${AI_LOG_STATUS.join(', ')}`,
      },
      required: [true, 'Status is required'],
      default: 'success',
    },

    /** Populated only when status is "error" or "retry". */
    errorMessage: {
      type: String,
      default: null,
    },

    /** Attempt number (1 = first try, 2 = first retry, etc.). */
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Note: ticketId has `index: true` on the field definition; a separate
// schema.index() call for it would create a duplicate — omitted here.

aiLogSchema.index({ userId: 1, createdAt: -1 });
aiLogSchema.index({ status: 1 });
aiLogSchema.index({ createdAt: -1 });

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Override toJSON to rename _id to id.
 * @returns {Object}
 */
aiLogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Aggregate token usage statistics for a given user.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<{totalPromptTokens: number, totalCompletionTokens: number, totalTokens: number, totalCalls: number}>}
 */
aiLogSchema.statics.getUserStats = async function (userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'success' } },
    {
      $group: {
        _id: null,
        totalPromptTokens: { $sum: '$tokensUsed.prompt' },
        totalCompletionTokens: { $sum: '$tokensUsed.completion' },
        totalTokens: { $sum: '$tokensUsed.total' },
        totalCalls: { $sum: 1 },
      },
    },
  ]);

  return result[0] || {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCalls: 0,
  };
};

// ── Model Export ──────────────────────────────────────────────────────────────

const AiLog = mongoose.model('AiLog', aiLogSchema);

module.exports = AiLog;
module.exports.AI_LOG_STATUS = AI_LOG_STATUS;
