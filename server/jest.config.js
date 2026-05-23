'use strict';

/**
 * Jest configuration for the server test suite.
 */

module.exports = {
  // Run tests in a Node.js environment (not jsdom)
  testEnvironment: 'node',

  // Glob patterns Jest uses to detect test files
  testMatch: ['**/*.test.js', '**/*.spec.js'],

  // Directories to ignore
  testPathIgnorePatterns: ['/node_modules/', '/client/'],

  // Coverage collection
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'repositories/**/*.js',
    'routes/**/*.js',
    'prompts/**/*.js',
    '!**/node_modules/**',
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },

  // Setup environment variables before any test runs
  setupFiles: ['<rootDir>/tests/setup.js'],

  // Global setup/teardown (start/stop in-memory MongoDB)
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Timeout for each test (ms)
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mock state between tests automatically
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Force Jest to exit after all tests complete (prevents hanging async handles)
  forceExit: true,
};
