'use strict';

const request = require('supertest');
const app = require('../app');
const {
  connectTestDB,
  clearDatabase,
  disconnectTestDB,
  registerTestUser,
  authHeader,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Mock aiService to avoid real OpenAI calls
// ---------------------------------------------------------------------------

jest.mock('../services/aiService', () => ({
  generateTicketContent: jest.fn(),
  calculateTokenCost: jest.fn().mockReturnValue(0.005),
}));

// Mock AiLog and ActivityLog model creation to avoid DB dependency in service
jest.mock('../models/AiLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../models/ActivityLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const aiService = require('../services/aiService');

/**
 * Build a realistic AI response object matching the ticket schema.
 */
function mockAiResponse() {
  return {
    ticket: {
      title: 'Login button unresponsive after failed authentication attempt',
      summary: 'Login button stops responding after one failed login attempt, forcing a page refresh.',
      description: '## Overview\nThe login button becomes unresponsive...\n## Impact\nUsers are locked out.',
      priority: 'High',
      severity: 'Major',
      stepsToReproduce: [
        'Step 1: Navigate to /login',
        'Step 2: Enter invalid credentials and click Login',
        'Step 3: Observe the error message',
        'Step 4: Correct the credentials and click Login again',
      ],
      expectedResult: 'The login button should process the request and log the user in.',
      actualResult: 'The login button does nothing — no network request is made.',
      acceptanceCriteria: [
        'Given a user enters invalid credentials When they click Login Then an error is shown',
        'Given a user corrects their credentials When they click Login again Then they are logged in',
      ],
      testCases: [
        {
          title: 'Verify successful login after a failed attempt',
          steps: ['Enter wrong password', 'Enter correct password', 'Click login'],
          expected: 'User is redirected to the dashboard',
        },
      ],
      labels: ['bug', 'authentication', 'frontend'],
      module: 'Authentication',
      environment: 'Production',
    },
    tokensUsed: { promptTokens: 500, completionTokens: 800, totalTokens: 1300 },
    estimatedCost: 0.005,
    duration: 1800,
    model: 'gpt-4o',
  };
}

// ---------------------------------------------------------------------------
// Test suite: Ticket endpoints
// ---------------------------------------------------------------------------

describe('Tickets API', () => {
  let accessToken;
  let otherUserToken; // Second user for ownership tests

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Register primary test user
    const { accessToken: token } = await registerTestUser({
      email: `ticket.user_${Date.now()}@example.com`,
    });
    accessToken = token;

    // Register a second user
    const { accessToken: token2 } = await registerTestUser({
      email: `other.user_${Date.now()}@example.com`,
    });
    otherUserToken = token2;

    // Reset mock before each test
    aiService.generateTicketContent.mockReset();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  // -------------------------------------------------------------------------
  // POST /api/tickets/generate
  // -------------------------------------------------------------------------

  describe('POST /api/tickets/generate', () => {
    const endpoint = '/api/tickets/generate';

    const validPayload = {
      rawInput:
        'The login button stops working after a failed login attempt. Users have to refresh the page to try again. This is happening in production.',
      environment: 'Production',
      browser: 'Chrome 124',
      device: 'Desktop',
    };

    it('should generate and return a ticket (201) when AI succeeds', async () => {
      aiService.generateTicketContent.mockResolvedValueOnce(mockAiResponse());

      const res = await request(app)
        .post(endpoint)
        .set(authHeader(accessToken))
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ticket');
      const ticket = res.body.data.ticket;
      expect(ticket).toHaveProperty('ticketRef');
      expect(ticket.ticketRef).toMatch(/^TKT-\d{6}$/);
      expect(ticket).toHaveProperty('title');
      expect(ticket).toHaveProperty('status', 'draft');
      expect(ticket).toHaveProperty('priority', 'High');
      expect(aiService.generateTicketContent).toHaveBeenCalledTimes(1);
      expect(aiService.generateTicketContent).toHaveBeenCalledWith(
        validPayload.rawInput,
        validPayload.environment,
        validPayload.browser,
        validPayload.device
      );
    });

    it('should return 400 when rawInput is missing', async () => {
      const res = await request(app)
        .post(endpoint)
        .set(authHeader(accessToken))
        .send({ environment: 'Production' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(aiService.generateTicketContent).not.toHaveBeenCalled();
    });

    it('should return 400 when rawInput is too short', async () => {
      const res = await request(app)
        .post(endpoint)
        .set(authHeader(accessToken))
        .send({ rawInput: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when no access token is provided', async () => {
      const res = await request(app).post(endpoint).send(validPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 when AI service throws an error', async () => {
      aiService.generateTicketContent.mockRejectedValueOnce(
        new Error('OpenAI API unavailable')
      );

      const res = await request(app)
        .post(endpoint)
        .set(authHeader(accessToken))
        .send(validPayload);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/tickets
  // -------------------------------------------------------------------------

  describe('GET /api/tickets', () => {
    const endpoint = '/api/tickets';

    beforeEach(async () => {
      // Seed 3 tickets for the primary user
      aiService.generateTicketContent.mockResolvedValue(mockAiResponse());

      const payload = {
        rawInput: 'The checkout button does not work when cart has more than 10 items in the production environment.',
        environment: 'Production',
      };

      await Promise.all([
        request(app).post('/api/tickets/generate').set(authHeader(accessToken)).send(payload),
        request(app).post('/api/tickets/generate').set(authHeader(accessToken)).send(payload),
        request(app).post('/api/tickets/generate').set(authHeader(accessToken)).send(payload),
      ]);
    });

    it('should return paginated tickets for the authenticated user', async () => {
      const res = await request(app)
        .get(endpoint)
        .set(authHeader(accessToken))
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(3);
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('total', 3);
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
    });

    it('should return empty array when user has no tickets', async () => {
      const res = await request(app)
        .get(endpoint)
        .set(authHeader(otherUserToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(0);
      expect(res.body.meta.pagination.total).toBe(0);
    });

    it('should respect the limit query parameter', async () => {
      const res = await request(app)
        .get(endpoint)
        .set(authHeader(accessToken))
        .query({ limit: 2, page: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.pagination.totalPages).toBe(2);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get(endpoint);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get(endpoint)
        .set(authHeader(accessToken))
        .query({ status: 'open' });

      expect(res.status).toBe(200);
      // All seeded tickets are 'draft', so filtering for 'open' should return 0
      expect(res.body.data.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/tickets/:id
  // -------------------------------------------------------------------------

  describe('GET /api/tickets/:id', () => {
    let ticketId;

    beforeEach(async () => {
      aiService.generateTicketContent.mockResolvedValue(mockAiResponse());

      const res = await request(app)
        .post('/api/tickets/generate')
        .set(authHeader(accessToken))
        .send({
          rawInput: 'Dashboard charts fail to load when the date range exceeds 90 days on Safari browser.',
        });

      ticketId = res.body.data.ticket._id;
    });

    it('should return the ticket when it belongs to the authenticated user', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ticket');
      expect(res.body.data.ticket._id).toBe(ticketId);
    });

    it('should return 404 for a non-existent ticket id', async () => {
      const fakeId = '64a000000000000000000001';
      const res = await request(app)
        .get(`/api/tickets/${fakeId}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TICKET_NOT_FOUND');
    });

    it('should return 404 when another user tries to access the ticket', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set(authHeader(otherUserToken));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}`);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/tickets/:id
  // -------------------------------------------------------------------------

  describe('PUT /api/tickets/:id', () => {
    let ticketId;

    beforeEach(async () => {
      aiService.generateTicketContent.mockResolvedValue(mockAiResponse());

      const res = await request(app)
        .post('/api/tickets/generate')
        .set(authHeader(accessToken))
        .send({
          rawInput: 'User profile photo upload fails with a 500 error when the image is larger than 5MB on Chrome browser.',
        });

      ticketId = res.body.data.ticket._id;
    });

    it('should update ticket fields and return the updated ticket', async () => {
      const updates = {
        status: 'open',
        priority: 'Critical',
        title: 'Updated: Profile photo upload fails for images > 5MB',
      };

      const res = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set(authHeader(accessToken))
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket.status).toBe('open');
      expect(res.body.data.ticket.priority).toBe('Critical');
      expect(res.body.data.ticket.title).toBe(updates.title);
    });

    it('should return 404 when updating a non-existent ticket', async () => {
      const res = await request(app)
        .put('/api/tickets/64a000000000000000000001')
        .set(authHeader(accessToken))
        .send({ status: 'open' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TICKET_NOT_FOUND');
    });

    it('should return 404 when another user tries to update the ticket', async () => {
      const res = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set(authHeader(otherUserToken))
        .send({ status: 'open' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .send({ status: 'open' });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/tickets/:id
  // -------------------------------------------------------------------------

  describe('DELETE /api/tickets/:id', () => {
    let ticketId;

    beforeEach(async () => {
      aiService.generateTicketContent.mockResolvedValue(mockAiResponse());

      const res = await request(app)
        .post('/api/tickets/generate')
        .set(authHeader(accessToken))
        .send({
          rawInput: 'Notifications dropdown does not close when clicking outside on mobile devices running iOS 17.',
        });

      ticketId = res.body.data.ticket._id;
    });

    it('should soft-delete a ticket and return 200', async () => {
      const res = await request(app)
        .delete(`/api/tickets/${ticketId}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('should make the ticket inaccessible after deletion', async () => {
      // Delete it
      await request(app)
        .delete(`/api/tickets/${ticketId}`)
        .set(authHeader(accessToken))
        .expect(200);

      // Should now return 404
      const res = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(404);
    });

    it('should return 404 for a non-existent ticket', async () => {
      const res = await request(app)
        .delete('/api/tickets/64a000000000000000000001')
        .set(authHeader(accessToken));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TICKET_NOT_FOUND');
    });

    it('should return 404 when another user tries to delete the ticket', async () => {
      const res = await request(app)
        .delete(`/api/tickets/${ticketId}`)
        .set(authHeader(otherUserToken));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app).delete(`/api/tickets/${ticketId}`);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/tickets/:id/export
  // -------------------------------------------------------------------------

  describe('GET /api/tickets/:id/export', () => {
    let ticketId;

    beforeEach(async () => {
      aiService.generateTicketContent.mockResolvedValue(mockAiResponse());

      const res = await request(app)
        .post('/api/tickets/generate')
        .set(authHeader(accessToken))
        .send({
          rawInput: 'Payment confirmation email is not sent after successful checkout when using PayPal as payment method in staging environment.',
        });

      ticketId = res.body.data.ticket._id;
    });

    it('should export ticket as JSON by default', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketId}/export`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ticket');
      expect(res.body.data).toHaveProperty('format', 'json');
      expect(res.body.data).toHaveProperty('filename');
      expect(res.headers['content-disposition']).toMatch(/attachment/i);
    });

    it('should export ticket in Jira format when format=jira', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketId}/export`)
        .set(authHeader(accessToken))
        .query({ format: 'jira' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.format).toBe('jira');
      expect(res.body.data.ticket).toHaveProperty('fields');
      expect(res.body.data.ticket.fields).toHaveProperty('summary');
    });

    it('should return 400 for an unsupported export format', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketId}/export`)
        .set(authHeader(accessToken))
        .query({ format: 'csv' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_FORMAT');
    });

    it('should return 404 for a non-existent ticket', async () => {
      const res = await request(app)
        .get('/api/tickets/64a000000000000000000001/export')
        .set(authHeader(accessToken));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
