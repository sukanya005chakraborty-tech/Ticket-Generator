'use strict';

/**
 * @fileoverview Application entry point.
 * Bootstraps Express, connects to MongoDB, registers all middleware and routes,
 * then starts the HTTP server. Handles uncaught exceptions and unhandled rejections.
 */

// Must be loaded before any other module so all env vars are available
const config = require('./config/env');
const logger = require('./config/logger');

// ── Process-level Error Guards ────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION — shutting down', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

// ── Imports ───────────────────────────────────────────────────────────────────

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const { connectDatabase }          = require('./config/database');
const { connectRedis, disconnectRedis } = require('./config/redis');
const { requestLogger }            = require('./middleware/requestLogger');
const { generalLimiter }           = require('./middleware/rateLimiter');
const { errorHandler }             = require('./middleware/errorHandler');

// ── App Factory ───────────────────────────────────────────────────────────────

/**
 * Create and configure the Express application.
 * Separated from server.listen() so it can be imported cleanly in tests.
 *
 * @returns {import('express').Application}
 */
function createApp() {
  const app = express();

  // ── Security headers (Helmet) ───────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd ? undefined : false, // relax CSP in dev
      crossOriginEmbedderPolicy: false,
    })
  );

  // ── CORS ────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        const allowed = [
          config.clientUrl,
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ];

        if (allowed.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin "${origin}" not allowed`));
        }
      },
      credentials: true, // Required for httpOnly cookies
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    })
  );

  // ── Body parsers ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Cookie parser ─────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Compression ──────────────────────────────────────────────────────────
  app.use(compression());

  // ── HTTP request logging ─────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Global rate limiter ──────────────────────────────────────────────────
  app.use('/api', generalLimiter);

  // ── Health check (no auth, no rate limit) ────────────────────────────────
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
      },
    });
  });

  // ── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/auth',      require('./routes/authRoutes'));
  app.use('/api/tickets',   require('./routes/ticketRoutes'));
  app.use('/api/analytics', require('./routes/analyticsRoutes'));
  app.use('/api/users',     require('./routes/userRoutes'));
  app.use('/api/settings',       require('./routes/settingsRoutes'));
  app.use('/api/projects',       require('./routes/projectRoutes'));
  app.use('/api/notifications',  require('./routes/notificationRoutes'));

  // ── 404 handler ──────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${_req.method} ${_req.originalUrl} not found`,
      code: 'ROUTE_NOT_FOUND',
    });
  });

  // ── Central error handler (must be last) ─────────────────────────────────
  app.use(errorHandler);

  return app;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Connect to the database and start listening for connections.
 */
async function bootstrap() {
  try {
    await connectDatabase();
    await connectRedis();

    const app  = createApp();
    const port = config.port;

    const server = app.listen(port, () => {
      logger.info(`Server running on port ${port}`, {
        environment: config.nodeEnv,
        port,
        pid: process.pid,
      });
    });

    // Graceful shutdown — close HTTP server, then Redis, then process exit
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectRedis();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    return server;
  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

bootstrap();

module.exports = { createApp }; // Exported for integration tests
