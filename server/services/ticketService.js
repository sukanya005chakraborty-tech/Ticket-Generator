'use strict';

const ticketRepository    = require('../repositories/ticketRepository');
const projectRepository   = require('../repositories/projectRepository');
const aiService           = require('./aiService');
const cache               = require('./cacheService');
const notificationService = require('./notificationService');
const { AppError }        = require('../middleware/errorHandler');
const logger              = require('../config/logger');
const User                = require('../models/User');

/**
 * Ticket Service – business logic for ticket generation, CRUD, and export.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a ticket reference in the format TKT-XXXXXX.
 * Uses a random 6-digit suffix; the model can also handle this, but having it
 * here ensures uniqueness collision is handled at the service layer.
 * @returns {string}
 */
function generateTicketRef() {
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  return `TKT-${suffix}`;
}

/**
 * Build a Jira-compatible export object from a ticket document.
 * @param {object} ticket
 * @returns {object}
 */
function toJiraFormat(ticket) {
  return {
    fields: {
      project: { key: ticket.module ? ticket.module.toUpperCase().slice(0, 8).replace(/\s+/g, '') : 'GEN' },
      issuetype: { name: 'Bug' },
      summary: ticket.title,
      description: {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: ticket.description || ticket.summary }],
          },
        ],
      },
      priority: { name: ticket.priority },
      labels: ticket.labels || [],
      environment: ticket.environment || '',
      customfield_steps_to_reproduce: (ticket.stepsToReproduce || []).join('\n'),
      customfield_expected_result: ticket.expectedResult,
      customfield_actual_result: ticket.actualResult,
      customfield_acceptance_criteria: (ticket.acceptanceCriteria || []).join('\n'),
    },
    externalId: ticket.ticketRef,
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Generate a new AI-powered ticket and persist it.
 *
 * @param {string} userId
 * @param {{ rawInput: string, environment?: string, browser?: string, device?: string,
 *           projectId?: string, assignedTo?: string, dueDate?: string }} data
 * @returns {Promise<object>}  saved ticket document
 */
async function generateTicket(userId, data, userRole = 'user') {
  const { rawInput, environment, browser, device, projectId, assignedTo, dueDate } = data;

  // If projectId supplied, verify caller is a project member (admin bypasses)
  if (projectId && userRole !== 'admin') {
    const { isMember } = await projectRepository.getMembership(projectId, userId);
    if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
  }

  if (!rawInput || rawInput.trim().length < 10) {
    throw new AppError('Raw input must be at least 10 characters long', 400, 'INVALID_INPUT');
  }

  logger.info('[ticketService] Starting AI ticket generation', { userId, rawInputLength: rawInput.length });

  // Call OpenAI
  const aiResult = await aiService.generateTicketContent(rawInput, environment, browser, device);

  const { ticket: aiTicket, tokensUsed, estimatedCost, duration, model } = aiResult;

  // Merge AI output with user-supplied overrides
  const ticketData = {
    ...aiTicket,
    environment: environment || aiTicket.environment,
    browser: browser || undefined,
    device: device || undefined,
    rawInput: rawInput.trim(),
    userId,
    ticketRef: generateTicketRef(),
    status: 'draft',
    ...(projectId  && { projectId }),
    ...(assignedTo && { assignedTo }),
    ...(dueDate    && { dueDate: new Date(dueDate) }),
    aiMetadata: {
      model,
      tokensUsed,
      estimatedCost,
      generationDurationMs: duration,
    },
  };

  const saved = await ticketRepository.create(ticketData);

  // Persist AI log asynchronously — don't block the response
  setImmediate(async () => {
    try {
      const AiLog = require('../models/AiLog');
      await AiLog.create({
        userId,
        ticketId: saved._id,
        model,
        prompt:      rawInput.trim(),   // human-readable summary of what was submitted
        tokensUsed: {
          prompt:     tokensUsed.promptTokens,
          completion: tokensUsed.completionTokens,
          total:      tokensUsed.totalTokens,
        },
        duration: duration,
        status: 'success',
      });
    } catch (logErr) {
      logger.error('[ticketService] Failed to write AiLog', { error: logErr.message });
    }
  });

  // Persist activity log
  setImmediate(async () => {
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        userId,
        action: 'ticket_created',
        resourceType: 'ticket',
        resourceId: saved._id,
        metadata: { ticketRef: saved.ticketRef, title: saved.title },
      });
    } catch (logErr) {
      logger.error('[ticketService] Failed to write ActivityLog', { error: logErr.message });
    }
  });

  // Invalidate ticket list + analytics caches (non-blocking)
  cache.invalidateTicketCache(userId).catch((err) =>
    logger.warn('[ticketService] Cache invalidation failed after generate', { error: err.message })
  );

  logger.info('[ticketService] Ticket generated and saved', {
    userId,
    ticketId: saved._id,
    ticketRef: saved.ticketRef,
  });

  return saved;
}

/**
 * Retrieve paginated/filtered tickets.
 * If projectId supplied, scopes to project (caller must be a member).
 * Otherwise scopes to userId (solo mode).
 *
 * @param {string} userId
 * @param {object} query – validated query params
 * @returns {Promise<{ tickets: object[], total: number }>}
 */
async function getTickets(userId, query = {}, userRole = 'user') {
  const {
    page = 1,
    limit = 20,
    skip = 0,
    sort = { createdAt: -1 },
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
  } = query;

  const filters = {
    status, priority, severity, search, startDate, endDate,
    labels, module, environment, projectId, assignedTo, dueDate,
  };
  const pagination = { page, limit, skip };

  if (userRole !== 'admin' && !projectId) {
    const userProjects = await projectRepository.findByMember(userId);
    if (userProjects.length > 0) {
      filters.userProjectIds = userProjects.map((p) => p._id);
    }
  }

  const scopeUserId = (userRole === 'admin' && !projectId) ? null : userId;
  return ticketRepository.findAll(scopeUserId, filters, pagination, sort);
}

/**
 * Get a single ticket by id.
 * Project tickets: any project member can view.
 * Solo tickets: must be owner.
 *
 * @param {string} userId
 * @param {string} ticketId
 * @returns {Promise<object>}
 */
async function getTicketById(userId, ticketId, userRole = 'user') {
  const isAdmin = userRole === 'admin';
  const ticket = await ticketRepository.findByIdUnsafe(ticketId);
  if (!ticket) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

  if (!isAdmin) {
    if (ticket.projectId) {
      const { isMember } = await projectRepository.getMembership(ticket.projectId, userId);
      if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
    } else if (ticket.userId.toString() !== userId.toString()) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
  }

  return ticket;
}

/**
 * Update ticket fields.
 * Project tickets: any project member can update.
 * Solo tickets: must be owner.
 *
 * @param {string} userId
 * @param {string} ticketId
 * @param {object} data  – allowed update fields
 * @returns {Promise<object>}
 */
async function updateTicket(userId, ticketId, data, userRole = 'user') {
  const isAdmin = userRole === 'admin';
  const existing = await ticketRepository.findByIdUnsafe(ticketId);
  if (!existing) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

  if (existing.projectId) {
    if (!isAdmin) {
      const { isMember } = await projectRepository.getMembership(existing.projectId, userId);
      if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
    }
  } else if (!isAdmin && existing.userId.toString() !== userId.toString()) {
    throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
  }

  // If projectId is being changed, verify user is a member of the new project (admin bypasses)
  if (!isAdmin && data.projectId && data.projectId.toString() !== (existing.projectId || '').toString()) {
    const { isMember } = await projectRepository.getMembership(data.projectId, userId);
    if (!isMember) throw new AppError('Access denied: not a member of the target project', 403, 'UNAUTHORIZED');
  }

  // Strip fields that should not be changed via update
  const sanitized = { ...data };
  delete sanitized._id;
  delete sanitized.userId;
  delete sanitized.ticketRef;
  delete sanitized.rawInput;
  delete sanitized.aiMetadata;
  delete sanitized.createdAt;
  delete sanitized.comments; // managed via POST /:id/comments

  // Pass userId only for solo tickets (enforces ownership in DB)
  const scopeUserId = existing.projectId ? null : userId;
  const updated = await ticketRepository.update(ticketId, scopeUserId, sanitized);
  if (!updated) {
    throw new AppError('Failed to update ticket', 500, 'UPDATE_FAILED');
  }

  // Activity log + notifications (non-blocking)
  setImmediate(async () => {
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        userId,
        action: 'ticket_updated',
        resourceType: 'ticket',
        resourceId: ticketId,
        metadata: { ticketRef: updated.ticketRef, changedFields: Object.keys(sanitized) },
      });
    } catch (err) {
      logger.error('[ticketService] Failed to write ActivityLog for update', { error: err.message });
    }

    try {
      const actor = await User.findById(userId).select('name').lean();
      const actorName = actor?.name || 'Someone';

      // Notify new assignee when ticket assigned
      if (sanitized.assignedTo && sanitized.assignedTo.toString() !== existing.assignedTo?.toString()) {
        notificationService.notifyTicketAssigned({
          recipientId: sanitized.assignedTo,
          actorId: userId,
          actorName,
          ticketId,
          ticketRef: updated.ticketRef,
        });
      }

      // Notify assignee when status changed
      if (sanitized.status && sanitized.status !== existing.status && updated.assignedTo) {
        notificationService.notifyStatusChanged({
          recipientId: updated.assignedTo,
          actorId: userId,
          actorName,
          ticketId,
          ticketRef: updated.ticketRef,
          oldStatus: existing.status,
          newStatus: sanitized.status,
        });
      }
    } catch (err) {
      logger.warn('[ticketService] Failed to send notifications for update', { error: err.message });
    }
  });

  // Invalidate this ticket's detail cache + list cache
  Promise.all([
    cache.invalidateTicketById(userId, ticketId),
    cache.invalidateTicketCache(userId),
  ]).catch((err) =>
    logger.warn('[ticketService] Cache invalidation failed after update', { error: err.message })
  );

  logger.info('[ticketService] Ticket updated', { userId, ticketId, fields: Object.keys(sanitized) });

  return updated;
}

/**
 * Soft-delete a ticket.
 * Project tickets: admin deletes any; member deletes only their own.
 * Solo tickets: must be owner.
 *
 * @param {string} userId
 * @param {string} ticketId
 * @param {string} [userRole] – global role ('admin'|'user'), used for project admin check
 * @returns {Promise<void>}
 */
async function deleteTicket(userId, ticketId, userRole = 'user') {
  const existing = await ticketRepository.findByIdUnsafe(ticketId);
  if (!existing) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

  if (existing.projectId) {
    const { isMember, role: projectRole } = await projectRepository.getMembership(existing.projectId, userId);
    if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');

    const isOwner = existing.userId.toString() === userId.toString();
    const isAdmin = projectRole === 'admin' || userRole === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Only admins can delete other members\' tickets', 403, 'UNAUTHORIZED');
    }
  } else if (existing.userId.toString() !== userId.toString()) {
    throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
  }

  const deleted = await ticketRepository.softDelete(ticketId, null);
  if (!deleted) {
    throw new AppError('Failed to delete ticket', 500, 'DELETE_FAILED');
  }

  // Activity log (non-blocking)
  setImmediate(async () => {
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        userId,
        action: 'ticket_deleted',
        resourceType: 'ticket',
        resourceId: ticketId,
        metadata: { ticketRef: existing.ticketRef },
      });
    } catch (err) {
      logger.error('[ticketService] Failed to write ActivityLog for delete', { error: err.message });
    }
  });

  // Invalidate caches
  Promise.all([
    cache.invalidateTicketById(userId, ticketId),
    cache.invalidateTicketCache(userId),
  ]).catch((err) =>
    logger.warn('[ticketService] Cache invalidation failed after delete', { error: err.message })
  );

  logger.info('[ticketService] Ticket soft-deleted', { userId, ticketId });
}

/**
 * Append a comment to a ticket.
 * Project tickets: any project member can comment.
 * Solo tickets: must be owner.
 *
 * @param {string} userId
 * @param {string} ticketId
 * @param {string} text
 * @returns {Promise<object>} updated ticket
 */
async function addComment(userId, ticketId, text, userRole = 'user') {
  const isAdmin = userRole === 'admin';
  const existing = await ticketRepository.findByIdUnsafe(ticketId);
  if (!existing) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

  if (!isAdmin) {
    if (existing.projectId) {
      const { isMember } = await projectRepository.getMembership(existing.projectId, userId);
      if (!isMember) throw new AppError('Access denied: not a project member', 403, 'UNAUTHORIZED');
    } else if (existing.userId.toString() !== userId.toString()) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
  }

  const comment = { text: text.trim(), createdAt: new Date() };
  const scopeUserId = existing.projectId ? null : userId;
  const updated = await ticketRepository.pushComment(ticketId, scopeUserId, comment);
  if (!updated) {
    throw new AppError('Failed to add comment', 500, 'UPDATE_FAILED');
  }

  cache.invalidateTicketById(userId, ticketId).catch((err) =>
    logger.warn('[ticketService] Cache invalidation failed after addComment', { error: err.message })
  );

  // Notify ticket owner and assignee (non-blocking)
  setImmediate(async () => {
    try {
      const actor = await User.findById(userId).select('name').lean();
      const actorName = actor?.name || 'Someone';
      const recipients = new Set();
      if (existing.userId) recipients.add(existing.userId.toString());
      if (existing.assignedTo) recipients.add(existing.assignedTo.toString());
      recipients.delete(userId.toString());
      for (const recipientId of recipients) {
        notificationService.notifyCommentAdded({
          recipientId,
          actorId: userId,
          actorName,
          ticketId,
          ticketRef: existing.ticketRef,
        });
      }
    } catch (err) {
      logger.warn('[ticketService] Failed to send notifications for comment', { error: err.message });
    }
  });

  return updated;
}

/**
 * Export a ticket in the requested format.
 *
 * @param {string} userId
 * @param {string} ticketId
 * @param {string} [format]  – 'json' (default) | 'jira'
 * @returns {Promise<{ data: object, format: string, filename: string }>}
 */
async function exportTicket(userId, ticketId, format = 'json', userRole = 'user') {
  const ticket = userRole === 'admin'
    ? await ticketRepository.findByIdUnsafe(ticketId)
    : await ticketRepository.findById(ticketId, userId);
  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
  }

  const normalizedFormat = (format || 'json').toLowerCase();

  if (!['json', 'jira'].includes(normalizedFormat)) {
    throw new AppError('Unsupported export format. Use "json" or "jira".', 400, 'INVALID_FORMAT');
  }

  let exportData;
  if (normalizedFormat === 'jira') {
    exportData = toJiraFormat(ticket);
  } else {
    // Clean JSON export: strip internal fields
    const { __v, isDeleted, deletedAt, aiMetadata, ...publicTicket } = ticket;
    exportData = publicTicket;
  }

  const filename = `${ticket.ticketRef || ticketId}.${normalizedFormat === 'jira' ? 'json' : 'json'}`;

  return { data: exportData, format: normalizedFormat, filename };
}

module.exports = {
  generateTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  exportTicket,
  addComment,
};
