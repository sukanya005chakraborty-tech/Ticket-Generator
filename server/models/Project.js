'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const MEMBER_ROLES = ['admin', 'member'];

const memberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: MEMBER_ROLES,
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },

    key: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Project key cannot exceed 10 characters'],
      // e.g. "PROJ", "TKT" — auto-generated from name if not provided
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    members: {
      type: [memberSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

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

projectSchema.index({ createdBy: 1 });
projectSchema.index({ 'members.userId': 1 });
projectSchema.index({ isDeleted: 1, isActive: 1 });
projectSchema.index({ key: 1 }, { sparse: true });

// ── Virtuals ──────────────────────────────────────────────────────────────────

projectSchema.virtual('memberCount').get(function () {
  return this.members ? this.members.length : 0;
});

// ── Pre-save: auto-generate project key ──────────────────────────────────────

projectSchema.pre('save', function (next) {
  if (!this.isNew || this.key) return next();
  // Take first 6 chars of name, strip non-alpha, uppercase
  this.key = this.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase() || 'PROJ';
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────

projectSchema.methods.isMember = function (userId) {
  return this.members.some((m) => m.userId.toString() === userId.toString());
};

projectSchema.methods.isProjectAdmin = function (userId) {
  return this.members.some(
    (m) => m.userId.toString() === userId.toString() && m.role === 'admin'
  );
};

projectSchema.methods.getMemberRole = function (userId) {
  const m = this.members.find((m) => m.userId.toString() === userId.toString());
  return m ? m.role : null;
};

projectSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  obj.id = obj._id ? obj._id.toString() : undefined;
  delete obj._id;
  delete obj.isDeleted;
  delete obj.deletedAt;
  return obj;
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
module.exports.MEMBER_ROLES = MEMBER_ROLES;
