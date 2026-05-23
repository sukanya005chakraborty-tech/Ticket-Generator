'use strict';

/**
 * @fileoverview Ticket Mongoose model.
 * Represents an AI-generated Jira-style bug/feature ticket with full QA metadata,
 * soft delete, auto-generated reference numbers, and virtuals.
 *
 * Field naming note:
 * The ownership reference is stored as `userId` (matching the repository and
 * service layer). The shared API contract calls this field `createdBy`; the
 * controller layer maps between the two at the boundary.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ── Enum constants (exported so validators can reuse them) ────────────────────

const PRIORITY_VALUES = ['Critical', 'High', 'Medium', 'Low'];
const SEVERITY_VALUES = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'];
const STATUS_VALUES   = ['draft', 'open', 'in-progress', 'resolved', 'closed'];

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const commentSchema = new Schema(
  {
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const timeEstimateSchema = new Schema(
  {
    value: { type: Number, min: 0, default: null },
    unit:  { type: String, enum: ['minutes', 'hours', 'days'], default: 'hours' },
  },
  { _id: false }
);

/**
 * Individual test case embedded within a ticket.
 */
const testCaseSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Test case title is required'],
      trim: true,
      maxlength: [200, 'Test case title cannot exceed 200 characters'],
    },
    steps: {
      type: [String],
      default: [],
    },
    expected: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

/**
 * AI generation metadata — stored alongside the ticket for cost tracking.
 */
const aiMetadataSchema = new Schema(
  {
    model:                 { type: String, default: '' },
    tokensUsed:            { type: Schema.Types.Mixed, default: null },
    estimatedCost:         { type: Number, default: 0 },
    generationDurationMs:  { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const ticketSchema = new Schema(
  {
    /**
     * Auto-generated reference like TKT-000001.
     * Set by the pre-save hook on first insert; also settable by the service
     * layer to allow sequential refs without a race condition.
     */
    ticketRef: {
      type: String,
      unique: true,
      sparse: true, // Allow null during the brief window before pre-save fires
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [255, 'Title cannot exceed 255 characters'],
    },

    summary: {
      type: String,
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters'],
      default: '',
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    priority: {
      type: String,
      enum: {
        values: PRIORITY_VALUES,
        message: `Priority must be one of: ${PRIORITY_VALUES.join(', ')}`,
      },
      default: 'Medium',
    },

    severity: {
      type: String,
      enum: {
        values: SEVERITY_VALUES,
        message: `Severity must be one of: ${SEVERITY_VALUES.join(', ')}`,
      },
      default: 'Major',
    },

    stepsToReproduce: {
      type: [String],
      default: [],
    },

    expectedResult: {
      type: String,
      trim: true,
      default: '',
    },

    actualResult: {
      type: String,
      trim: true,
      default: '',
    },

    acceptanceCriteria: {
      type: [String],
      default: [],
    },

    testCases: {
      type: [testCaseSchema],
      default: [],
    },

    labels: {
      type: [String],
      default: [],
    },

    module: {
      type: String,
      trim: true,
      maxlength: [100, 'Module name cannot exceed 100 characters'],
      default: '',
    },

    environment: {
      type: String,
      trim: true,
      maxlength: [100, 'Environment cannot exceed 100 characters'],
      default: '',
    },

    browser: {
      type: String,
      trim: true,
      maxlength: [100, 'Browser cannot exceed 100 characters'],
      default: '',
    },

    device: {
      type: String,
      trim: true,
      maxlength: [100, 'Device cannot exceed 100 characters'],
      default: '',
    },

    status: {
      type: String,
      enum: {
        values: STATUS_VALUES,
        message: `Status must be one of: ${STATUS_VALUES.join(', ')}`,
      },
      default: 'draft',
    },

    /** The raw user-supplied input that was sent to the AI for generation. */
    rawInput: {
      type: String,
      trim: true,
      default: '',
    },

    /**
     * Primary ownership reference.
     * Named `userId` to match the repository/service layer.
     * The API contract surface (JSON responses) exposes this as `createdBy`
     * via the virtual below.
     */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    /** Project this ticket belongs to. Optional for backward compat with solo tickets. */
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },

    /** User the ticket is assigned to. Null means unassigned. */
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    /** Deadline for resolving this ticket. */
    dueDate: {
      type: Date,
      default: null,
    },

    /** Metadata captured from the AI generation call. */
    aiMetadata: {
      type: aiMetadataSchema,
      default: null,
    },

    comments: {
      type: [commentSchema],
      default: [],
    },

    timeEstimate: {
      type: timeEstimateSchema,
      default: null,
    },

    completionPercentage: {
      type: Number,
      min: [0, 'Completion percentage cannot be less than 0'],
      max: [100, 'Completion percentage cannot exceed 100'],
      default: 0,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ projectId: 1, status: 1 });
ticketSchema.index({ projectId: 1, assignedTo: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ dueDate: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ isDeleted: 1 });
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });

// Text index for full-text search across key string fields
ticketSchema.index(
  { title: 'text', description: 'text', summary: 'text' },
  { weights: { title: 3, summary: 2, description: 1 } }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Virtual: createdBy
 * Exposes the `userId` field under the API-contract name `createdBy`
 * so JSON responses match the shared field naming convention.
 */
ticketSchema.virtual('createdBy').get(function () {
  return this.userId;
});

/**
 * Virtual: shortDescription
 * Returns the first 100 characters of the description, useful for list previews.
 */
ticketSchema.virtual('shortDescription').get(function () {
  if (!this.description) return '';
  return this.description.length > 100
    ? `${this.description.substring(0, 100)}...`
    : this.description;
});

// ── Pre-save Hook: Auto-generate ticketRef ────────────────────────────────────

/**
 * Generate a sequential ticket reference in the format TKT-XXXXXX on first insert.
 * If the service layer already set `ticketRef`, this hook is skipped.
 *
 * Uses the total document count + 1 as the sequence number. For high-concurrency
 * scenarios a separate counter collection should be used, but this is sufficient
 * for typical team workloads.
 */
ticketSchema.pre('save', async function (next) {
  if (!this.isNew || this.ticketRef) return next();

  try {
    const count = await mongoose.model('Ticket').countDocuments({});
    const seq = String(count + 1).padStart(6, '0');
    this.ticketRef = `TKT-${seq}`;
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Override toJSON to include virtuals and strip internal soft-delete fields.
 *
 * @returns {Object}
 */
ticketSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });

  // Promote _id → id
  obj.id = obj._id ? obj._id.toString() : undefined;
  delete obj._id;

  // Remove internal fields from the wire representation
  delete obj.isDeleted;
  delete obj.deletedAt;

  return obj;
};

// ── Model Export ──────────────────────────────────────────────────────────────

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
module.exports.PRIORITY_VALUES = PRIORITY_VALUES;
module.exports.SEVERITY_VALUES = SEVERITY_VALUES;
module.exports.STATUS_VALUES   = STATUS_VALUES;
