'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validate, validateQuery } = require('../middleware/validate');
const {
  generateTicketSchema,
  updateTicketSchema,
  ticketQuerySchema,
} = require('../validators/ticketValidator');
const {
  generateTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  exportTicket,
  addComment,
} = require('../controllers/ticketController');

const router = Router();

/**
 * Ticket Routes
 * Base path: /api/tickets
 * All routes require authentication.
 */

// POST /api/tickets/generate
// AI ticket generation — rate limited separately (aiLimiter)
router.post('/generate', authenticate, aiLimiter, validate(generateTicketSchema), generateTicket);

// GET /api/tickets
// List tickets with filtering, pagination, sorting
router.get('/', authenticate, validateQuery(ticketQuerySchema), getTickets);

// GET /api/tickets/:id
// Get a single ticket by id
router.get('/:id', authenticate, getTicketById);

// PUT /api/tickets/:id
// Update ticket fields
router.put('/:id', authenticate, validate(updateTicketSchema), updateTicket);

// DELETE /api/tickets/:id
// Soft delete
router.delete('/:id', authenticate, deleteTicket);

// POST /api/tickets/:id/comments
// Append a comment to a ticket
router.post('/:id/comments', authenticate, addComment);

// GET /api/tickets/:id/export
// Export ticket as JSON or Jira format
// Must come after the specific /:id routes and declared with /export suffix
// Express matches routes in order — this is registered as /:id/export which
// won't conflict with the plain /:id routes above.
router.get('/:id/export', authenticate, exportTicket);

module.exports = router;
