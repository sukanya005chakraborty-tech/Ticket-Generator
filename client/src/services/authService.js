import api from './api';

export const register = async (data) => {
  return api.post('/auth/register', data);
};

export const login = async (data) => {
  return api.post('/auth/login', data);
};

export const logout = async () => {
  return api.post('/auth/logout');
};

export const getMe = async () => {
  return api.get('/auth/me');
};

export const refreshToken = async () => {
  return api.post('/auth/refresh-token');
};
