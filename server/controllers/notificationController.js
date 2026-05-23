'use strict';

const notificationService = require('../services/notificationService');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse } = require('../utils/responseHelper');

const list = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const isAdmin = req.user.role === 'admin';
  const { notifications, unreadCount } = await notificationService.getNotifications(userId, isAdmin);
  return res.json(successResponse('Notifications retrieved', { notifications, unreadCount }));
});

const markRead = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const isAdmin = req.user.role === 'admin';
  const { id } = req.params;
  await notificationService.markRead(id, userId, isAdmin);
  return res.json(successResponse('Notification marked as read'));
});

const markAllRead = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const isAdmin = req.user.role === 'admin';
  await notificationService.markAllRead(userId, isAdmin);
  return res.json(successResponse('All notifications marked as read'));
});

const remove = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const isAdmin = req.user.role === 'admin';
  const { id } = req.params;
  const deleted = await notificationService.deleteNotification(id, userId, isAdmin);
  if (!deleted) {
    const { AppError } = require('../middleware/errorHandler');
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }
  return res.json(successResponse('Notification deleted'));
});

const clearAll = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const isAdmin = req.user.role === 'admin';
  await notificationService.clearAllNotifications(userId, isAdmin);
  return res.json(successResponse('All notifications cleared'));
});

module.exports = { list, markRead, markAllRead, remove, clearAll };
