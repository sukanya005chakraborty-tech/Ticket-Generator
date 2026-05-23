'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const INVITE_STATUS = ['pending', 'accepted', 'expired', 'revoked'];

const inviteTokenSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },

    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'invitedBy is required'],
    },

    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: INVITE_STATUS,
      default: 'pending',
    },

    // Set when accepted
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inviteTokenSchema.index({ email: 1, projectId: 1, status: 1 });
// TTL index — MongoDB auto-removes expired tokens 1 hour after expiry
inviteTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

inviteTokenSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

inviteTokenSchema.methods.isUsable = function () {
  return this.status === 'pending' && !this.isExpired();
};

const InviteToken = mongoose.model('InviteToken', inviteTokenSchema);

module.exports = InviteToken;
module.exports.INVITE_STATUS = INVITE_STATUS;
