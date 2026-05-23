'use strict';

const Notification = require('../models/Notification');

async function create({ recipientId, type, message, ticketId = null, ticketRef = null, actorId = null, actorName = null }) {
  return Notification.create({ recipientId, type, message, ticketId, ticketRef, actorId, actorName });
}

async function findByUser(recipientId, limit = 30) {
  return Notification.find({ recipientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function countUnread(recipientId) {
  return Notification.countDocuments({ recipientId, read: false });
}

async function markRead(notificationId, recipientId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipientId },
    { $set: { read: true } },
    { new: true }
  ).lean();
}

async function markAllRead(recipientId) {
  return Notification.updateMany({ recipientId, read: false }, { $set: { read: true } });
}

async function markAllReadGlobal() {
  return Notification.updateMany({ read: false }, { $set: { read: true } });
}

async function deleteOne(notificationId, recipientId) {
  return Notification.findOneAndDelete({ _id: notificationId, recipientId });
}

async function deleteByUser(recipientId) {
  return Notification.deleteMany({ recipientId });
}

async function markReadById(notificationId) {
  return Notification.findByIdAndUpdate(notificationId, { $set: { read: true } }, { new: true }).lean();
}

async function deleteOneById(notificationId) {
  return Notification.findByIdAndDelete(notificationId);
}

async function deleteAllGlobal() {
  return Notification.deleteMany({});
}

async function findAll(limit = 100) {
  return Notification.find()
    .populate('recipientId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function countAllUnread() {
  return Notification.countDocuments({ read: false });
}

module.exports = { create, findByUser, countUnread, findAll, countAllUnread, markRead, markReadById, markAllRead, markAllReadGlobal, deleteOne, deleteOneById, deleteByUser, deleteAllGlobal };
