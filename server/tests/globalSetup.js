'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

/**
 * Global setup — runs ONCE before all test suites.
 * Starts an in-memory MongoDB instance and exposes its URI via an environment variable.
 */
module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'ai-jira-test',
    },
  });

  const uri = mongod.getUri();

  // Make the URI available to all test workers via an env var
  process.env.MONGODB_URI = uri;
  process.env.__MONGOD_URI__ = uri;

  // Store the server reference so globalTeardown can stop it
  global.__MONGOD__ = mongod;
};
