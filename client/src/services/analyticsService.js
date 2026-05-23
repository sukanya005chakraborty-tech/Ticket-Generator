import api from './api';

export const getOverview = async (projectId) => {
  return api.get('/analytics/overview', { params: projectId ? { projectId } : {} });
};

export const getTrends = async (period = 'month', projectId) => {
  return api.get('/analytics/trends', { params: { period, ...(projectId ? { projectId } : {}) } });
};
