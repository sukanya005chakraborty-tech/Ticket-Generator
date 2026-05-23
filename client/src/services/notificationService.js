import api from './api';

export const getNotifications = () => api.get('/notifications');
export const markRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllRead = () => api.patch('/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);
export const clearAllNotifications = () => api.delete('/notifications/clear-all');
