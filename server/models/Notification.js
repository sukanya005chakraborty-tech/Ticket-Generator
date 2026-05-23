'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const NOTIFICATION_TYPES = [
  'ticket_assigned',
  'ticket_status_changed',
  'comment_added',
  'invite_accepted',
];

const notificationSchema = new Schema(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },

    ticketRef: {
      type: String,
      default: null,
    },

    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    actorName: {
      type: String,
      default: null,
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });
// TTL: auto-delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

notificationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
