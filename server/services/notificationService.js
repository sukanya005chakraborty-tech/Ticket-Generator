'use strict';

const notificationRepository = require('../repositories/notificationRepository');
const logger = require('../config/logger');

// Fire-and-forget wrapper — notification failures must never break the main flow
function fire(fn) {
  Promise.resolve().then(fn).catch((err) =>
    logger.warn('[notificationService] Failed to create notification', { error: err.message })
  );
}

async function getNotifications(userId, isAdmin = false) {
  const [notifications, unreadCount] = await Promise.all([
    isAdmin ? notificationRepository.findAll() : notificationRepository.findByUser(userId),
    isAdmin ? notificationRepository.countAllUnread() : notificationRepository.countUnread(userId),
  ]);
  return { notifications, unreadCount };
}

async function markRead(notificationId, userId, isAdmin = false) {
  return isAdmin
    ? notificationRepository.markReadById(notificationId)
    : notificationRepository.markRead(notificationId, userId);
}

async function markAllRead(userId, isAdmin = false) {
  return isAdmin
    ? notificationRepository.markAllReadGlobal()
    : notificationRepository.markAllRead(userId);
}

async function clearAllNotifications(userId, isAdmin = false) {
  return isAdmin
    ? notificationRepository.deleteAllGlobal()
    : notificationRepository.deleteByUser(userId);
}

async function deleteNotification(notificationId, userId, isAdmin = false) {
  return isAdmin
    ? notificationRepository.deleteOneById(notificationId)
    : notificationRepository.deleteOne(notificationId, userId);
}

// ── Trigger helpers (non-blocking) ────────────────────────────────────────────

function notifyTicketAssigned({ recipientId, actorId, actorName, ticketId, ticketRef }) {
  if (!recipientId || recipientId.toString() === actorId?.toString()) return;
  fire(() => notificationRepository.create({
    recipientId,
    type: 'ticket_assigned',
    message: `${actorName || 'Someone'} assigned you ticket ${ticketRef}`,
    ticketId,
    ticketRef,
    actorId,
    actorName,
  }));
}

function notifyStatusChanged({ recipientId, actorId, actorName, ticketId, ticketRef, oldStatus, newStatus }) {
  if (!recipientId || recipientId.toString() === actorId?.toString()) return;
  fire(() => notificationRepository.create({
    recipientId,
    type: 'ticket_status_changed',
    message: `${actorName || 'Someone'} moved ${ticketRef} from ${oldStatus} → ${newStatus}`,
    ticketId,
    ticketRef,
    actorId,
    actorName,
  }));
}

function notifyCommentAdded({ recipientId, actorId, actorName, ticketId, ticketRef }) {
  if (!recipientId || recipientId.toString() === actorId?.toString()) return;
  fire(() => notificationRepository.create({
    recipientId,
    type: 'comment_added',
    message: `${actorName || 'Someone'} commented on ${ticketRef}`,
    ticketId,
    ticketRef,
    actorId,
    actorName,
  }));
}

function notifyInviteAccepted({ recipientId, actorId, actorName, projectName }) {
  if (!recipientId || recipientId.toString() === actorId?.toString()) return;
  fire(() => notificationRepository.create({
    recipientId,
    type: 'invite_accepted',
    message: `${actorName || 'Someone'} accepted the invite to ${projectName}`,
    actorId,
    actorName,
  }));
}

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  clearAllNotifications,
  deleteNotification,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyCommentAdded,
  notifyInviteAccepted,
};
