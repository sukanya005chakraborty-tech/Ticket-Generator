import api from './api';

export const createProject = (data) =>
  api.post('/projects', data);

export const listProjects = () =>
  api.get('/projects');

export const getProject = (id) =>
  api.get(`/projects/${id}`);

export const updateProject = (id, data) =>
  api.put(`/projects/${id}`, data);

export const deleteProject = (id) =>
  api.delete(`/projects/${id}`);

// Members
export const listMembers = (id) =>
  api.get(`/projects/${id}/members`);

export const addMember = (id, data) =>
  api.post(`/projects/${id}/members`, data);

export const removeMember = (id, userId) =>
  api.delete(`/projects/${id}/members/${userId}`);

export const updateMemberRole = (id, userId, role) =>
  api.patch(`/projects/${id}/members/${userId}`, { role });

// Invites
export const sendInvite = (id, data) =>
  api.post(`/projects/${id}/invites`, data);

export const listInvites = (id) =>
  api.get(`/projects/${id}/invites`);

export const revokeInvite = (id, inviteId) =>
  api.delete(`/projects/${id}/invites/${inviteId}`);

// Public
export const getInviteByToken = (token) =>
  api.get(`/auth/invite?token=${token}`);

export const acceptInvite = (data) =>
  api.post('/auth/accept-invite', data);
