'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const {
  connectTestDB,
  clearDatabase,
  disconnectTestDB,
  registerTestUser,
  authHeader,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Test suite: Auth endpoints
// ---------------------------------------------------------------------------

describe('Auth API', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/register
  // -------------------------------------------------------------------------

  describe('POST /api/auth/register', () => {
    const endpoint = '/api/auth/register';
    const validPayload = {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      password: 'SecurePass123!',
    };

    it('should register a new user and return 201 with tokens', async () => {
      const res = await request(app).post(endpoint).send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/created/i);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).toHaveProperty('email', validPayload.email.toLowerCase());
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).not.toHaveProperty('refreshTokens');
    });

    it('should set an httpOnly refreshToken cookie on registration', async () => {
      const res = await request(app).post(endpoint).send(validPayload);

      const setCookieHeader = res.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      const refreshCookie = setCookieHeader.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    it('should return 409 when registering with a duplicate email', async () => {
      // Register once
      await request(app).post(endpoint).send(validPayload).expect(201);

      // Attempt duplicate registration
      const res = await request(app).post(endpoint).send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DUPLICATE_EMAIL');
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ email: 'test@example.com', password: 'Pass123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ name: 'Test', email: 'not-an-email', password: 'Pass123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ name: 'Test', email: 'test@example.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when body is empty', async () => {
      const res = await request(app).post(endpoint).send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------------

  describe('POST /api/auth/login', () => {
    const endpoint = '/api/auth/login';
    const credentials = {
      name: 'Login User',
      email: 'login.user@example.com',
      password: 'MyPassword99!',
    };

    beforeEach(async () => {
      // Ensure user exists before login tests
      await request(app).post('/api/auth/register').send(credentials).expect(201);
    });

    it('should log in successfully and return 200 with access token', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ email: credentials.email, password: credentials.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('should set httpOnly refresh token cookie on login', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ email: credentials.email, password: credentials.password });

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ email: credentials.email, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ email: 'nobody@example.com', password: 'SomePass123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app).post(endpoint).send({ password: 'SomePass123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ email: credentials.email });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when body is empty', async () => {
      const res = await request(app).post(endpoint).send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/refresh-token
  // -------------------------------------------------------------------------

  describe('POST /api/auth/refresh-token', () => {
    let refreshTokenValue;
    let accessToken;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Refresh User',
          email: 'refresh.user@example.com',
          password: 'Pass123456!',
        })
        .expect(201);

      accessToken = registerRes.body.data.accessToken;

      // Extract refresh token from cookie
      const cookies = registerRes.headers['set-cookie'];
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      if (refreshCookie) {
        refreshTokenValue = refreshCookie.split(';')[0].replace('refreshToken=', '');
      }
    });

    it('should issue a new access token given a valid refresh token in body', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: refreshTokenValue });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.accessToken).not.toBe(accessToken);
    });

    it('should return 401 for an invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'totally.invalid.token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when no refresh token is provided', async () => {
      const res = await request(app).post('/api/auth/refresh-token').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('MISSING_REFRESH_TOKEN');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------------------------

  describe('GET /api/auth/me', () => {
    let accessToken;
    let registeredUser;

    beforeEach(async () => {
      const { user, accessToken: token } = await registerTestUser({
        email: `me.user_${Date.now()}@example.com`,
      });
      accessToken = token;
      registeredUser = user;
    });

    it('should return the current user profile when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', registeredUser.email);
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).not.toHaveProperty('refreshTokens');
    });

    it('should return 401 when no Authorization header is sent', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when an invalid access token is sent', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this.is.not.valid');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when the Bearer token is malformed (no scheme)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', accessToken); // Missing "Bearer " prefix

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------------------------------------

  describe('POST /api/auth/logout', () => {
    let accessToken;

    beforeEach(async () => {
      const { accessToken: token } = await registerTestUser({
        email: `logout.user_${Date.now()}@example.com`,
      });
      accessToken = token;
    });

    it('should log out successfully and clear the refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/logged out/i);
    });

    it('should return 401 when attempting to log out without a token', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Health check (sanity)
  // -------------------------------------------------------------------------

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
