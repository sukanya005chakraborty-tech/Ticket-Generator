'use strict';

/**
 * Global teardown — runs ONCE after all test suites complete.
 * Stops the in-memory MongoDB instance.
 */
module.exports = async function globalTeardown() {
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};
