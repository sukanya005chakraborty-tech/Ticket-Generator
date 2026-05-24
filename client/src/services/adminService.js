import api from './api';

export const getActivityLogs = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  return api.get('/admin/activity-logs', { params: clean });
};
