import api from './api';

export const getProfile = async () => {
  return api.get('/users/profile');
};

export const updateProfile = async (data) => {
  return api.put('/users/profile', data);
};

export const updatePassword = async (data) => {
  return api.put('/users/password', data);
};

export const getAllUsers = async () => {
  return api.get('/users');
};

export const updateUserRole = async ({ userId, role }) => {
  return api.patch(`/users/${userId}/role`, { role });
};

export const getSettings = async () => {
  return api.get('/settings');
};

export const updateSettings = async (data) => {
  return api.put('/settings', data);
};
