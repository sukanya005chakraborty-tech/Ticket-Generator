'use strict';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');

/**
 * Shared test helpers — database lifecycle and authenticated request helpers.
 */

/**
 * Connect mongoose to the in-memory MongoDB started by globalSetup.
 * Uses the URI injected into the environment by the global setup script.
 */
async function connectTestDB() {
  const uri = process.env.MONGODB_URI || process.env.__MONGOD_URI__;
  if (!uri) throw new Error('MONGODB_URI not set. Ensure globalSetup ran correctly.');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

/**
 * Drop all collections to ensure test isolation.
 */
async function clearDatabase() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  );
}

/**
 * Disconnect mongoose from the in-memory server.
 */
async function disconnectTestDB() {
  await mongoose.disconnect();
}

/**
 * Register a test user via the API and return their tokens + profile.
 * @param {object} [overrides]
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
async function registerTestUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    email: `testuser_${Date.now()}@example.com`,
    password: 'TestPass123!',
  };

  const payload = { ...defaults, ...overrides };

  const res = await request(app).post('/api/auth/register').send(payload).expect(201);

  return {
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    credentials: payload,
  };
}

/**
 * Build an Authorization header object from an access token.
 * @param {string} token
 * @returns {{ Authorization: string }}
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  connectTestDB,
  clearDatabase,
  disconnectTestDB,
  registerTestUser,
  authHeader,
};
