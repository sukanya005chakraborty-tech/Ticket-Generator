'use strict';

/**
 * @fileoverview User Mongoose model.
 * Handles authentication, RBAC roles, per-user settings, soft delete,
 * password hashing, refresh-token rotation, and secure JSON serialization.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

const { Schema } = mongoose;

// ── Sub-schemas ───────────────────────────────────────────────────────────────

/**
 * User preference settings — embedded document.
 */
const userSettingsSchema = new Schema(
  {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light',
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    defaultPriority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium',
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    defaultEnvironment: { type: String, default: '', trim: true },
    defaultBrowser:     { type: String, default: '', trim: true },
    defaultDevice:      { type: String, default: '', trim: true },
    ticketsPerPage:     { type: Number, default: 20, min: 5, max: 100 },
    dateFormat:         { type: String, default: 'YYYY-MM-DD', trim: true },
    aiModel:            { type: String, default: '', trim: true },
  },
  { _id: false }
);

/**
 * Stored refresh token entry — each active session gets one entry.
 * Keeping a list supports multi-device login with per-device revocation.
 */
const refreshTokenEntrySchema = new Schema(
  {
    token:     { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned by default queries
    },

    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },

    avatar: {
      type: String,
      default: null,
      trim: true,
    },

    /** Optional short bio / display text. */
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Bio cannot exceed 300 characters'],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    settings: {
      type: userSettingsSchema,
      default: () => ({}),
    },

    /**
     * List of active refresh tokens — one per logged-in session / device.
     * Stored as an embedded array so we can validate, rotate, and revoke
     * individual tokens without a separate collection.
     * The field is never returned by default queries (select: false).
     */
    refreshTokens: {
      type: [refreshTokenEntrySchema],
      default: [],
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Note: the email unique index is declared via `unique: true` on the field itself;
// a separate schema.index() call for email would create a duplicate — omitted here.

userSchema.index({ role: 1 });
userSchema.index({ isDeleted: 1, isActive: 1 });
// Sparse index on refresh token values for O(1) lookup during token rotation
userSchema.index({ 'refreshTokens.token': 1 }, { sparse: true });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Virtual: fullProfile
 * Returns a sanitized plain object representing the user's public profile.
 * Does not include password or refresh tokens.
 */
userSchema.virtual('fullProfile').get(function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar,
    bio: this.bio,
    isActive: this.isActive,
    settings: this.settings,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
});

// ── Pre-save Hooks ────────────────────────────────────────────────────────────

/**
 * Hash the password before saving when it has been modified.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(config.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Compare a plaintext candidate password against the stored bcrypt hash.
 * The document must have been queried with `.select('+password')`.
 *
 * @param {string} candidatePassword - Plaintext password to verify.
 * @returns {Promise<boolean>} True if passwords match.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Override toJSON to strip sensitive and internal fields from serialized output.
 * Called automatically when JSON.stringify is used on a User document.
 *
 * @returns {Object} Safe user object without password, refreshTokens, soft-delete fields.
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: false });

  delete obj.password;
  delete obj.refreshTokens;
  delete obj.isDeleted;
  delete obj.deletedAt;

  // Rename _id → id
  obj.id = obj._id.toString();
  delete obj._id;

  return obj;
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Find an active, non-deleted user by email address.
 * Does NOT include the password field — add `.select('+password')` when needed.
 *
 * @param {string} email - Email to look up (case-insensitive).
 * @returns {import('mongoose').Query}
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({
    email: email.toLowerCase().trim(),
    isDeleted: false,
  });
};

/**
 * Soft-delete a user by ID (sets isDeleted, isActive = false, deletedAt).
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<import('mongoose').Document|null>}
 */
userSchema.statics.softDelete = function (userId) {
  return this.findByIdAndUpdate(
    userId,
    {
      isDeleted: true,
      isActive: false,
      deletedAt: new Date(),
    },
    { new: true }
  );
};

// ── Model Export ──────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);

module.exports = User;
