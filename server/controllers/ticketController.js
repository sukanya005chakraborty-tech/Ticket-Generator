'use strict';

const ticketService = require('../services/ticketService');
const asyncWrapper = require('../utils/asyncWrapper');
const { successResponse, paginatedResponse } = require('../utils/responseHelper');
const { getPaginationParams, buildPaginationMeta, buildSortQuery } = require('../utils/pagination');

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/tickets/generate
 */
const generateTicket = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { rawInput, environment, browser, device, projectId, assignedTo, dueDate } = req.body;

  const ticket = await ticketService.generateTicket(userId, {
    rawInput,
    environment,
    browser,
    device,
    projectId,
    assignedTo,
    dueDate,
  }, userRole);

  return res.status(201).json(
    successResponse('Ticket generated successfully', { ticket })
  );
});

/**
 * GET /api/tickets
 */
const getTickets = asyncWrapper(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const userRole = req.user.role;

  const pagination = getPaginationParams(req.query);
  const sort = buildSortQuery(req.query.sortBy, req.query.sortOrder, ['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'title']);

  const {
    status,
    priority,
    severity,
    search,
    startDate,
    endDate,
    labels,
    module,
    environment,
    projectId,
    assignedTo,
    dueDate,
  } = req.query;

  // labels can be comma-separated string or array
  const labelsArray = labels
    ? (Array.isArray(labels) ? labels : labels.split(',').map((l) => l.trim()))
    : undefined;

  const { tickets, total } = await ticketService.getTickets(userId, {
    ...pagination,
    sort,
    status,
    priority,
    severity,
    search,
    startDate,
    endDate,
    labels: labelsArray,
    module,
    environment,
    projectId,
    assignedTo,
    dueDate,
  }, userRole);

  const paginationMeta = buildPaginationMeta(total, pagination.page, pagination.limit);

  return res.json(
    paginatedResponse('Tickets retrieved successfully', tickets, paginationMeta)
  );
});

/**
 * GET /api/tickets/:id
 */
const getTicketById = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;

  const ticket = await ticketService.getTicketById(userId, id, userRole);

  return res.json(successResponse('Ticket retrieved successfully', { ticket }));
});

/**
 * PUT /api/tickets/:id
 */
const updateTicket = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;

  const ticket = await ticketService.updateTicket(userId, id, req.body, userRole);

  return res.json(successResponse('Ticket updated successfully', { ticket }));
});

/**
 * DELETE /api/tickets/:id
 */
const deleteTicket = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;

  await ticketService.deleteTicket(userId, id, userRole);

  return res.json(successResponse('Ticket deleted successfully'));
});

/**
 * POST /api/tickets/:id/comments
 */
const addComment = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Comment text is required' });
  }

  const ticket = await ticketService.addComment(userId, id, text, userRole);

  return res.status(201).json(
    successResponse('Comment added successfully', { ticket })
  );
});

/**
 * GET /api/tickets/:id/export
 * Query param: ?format=json|jira  (default: json)
 */
const exportTicket = asyncWrapper(async (req, res) => {
  const userId   = req.user.id || req.user._id;
  const userRole = req.user.role;
  const { id }   = req.params;
  const format   = (req.query.format || 'json').toLowerCase();

  const { data, filename } = await ticketService.exportTicket(userId, id, format, userRole);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  return res.json(
    successResponse('Ticket exported successfully', { ticket: data, format, filename })
  );
});

module.exports = {
  generateTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  exportTicket,
  addComment,
};
