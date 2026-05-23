import api from './api';

export const generateTicket = async (data) => {
  return api.post('/tickets/generate', data);
};

export const getTickets = async (params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  return api.get('/tickets', { params: cleanParams });
};

export const getTicketById = async (id) => {
  return api.get(`/tickets/${id}`);
};

export const updateTicket = async (id, data) => {
  return api.put(`/tickets/${id}`, data);
};

export const deleteTicket = async (id) => {
  return api.delete(`/tickets/${id}`);
};

export const exportTicket = async (id) => {
  return api.get(`/tickets/${id}/export`);
};

export const addComment = async (id, text) => {
  return api.post(`/tickets/${id}/comments`, { text });
};
