'use strict';

/**
 * Jest setup file — runs before each test file.
 * Sets required environment variables so modules don't fail on import.
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-jira-test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.OPENAI_API_KEY = 'sk-test-dummy-key-for-unit-tests';
process.env.OPENAI_MODEL = 'gpt-4o';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.COOKIE_SECRET = 'test-cookie-secret';
process.env.LOG_LEVEL = 'error'; // silence logs during tests
