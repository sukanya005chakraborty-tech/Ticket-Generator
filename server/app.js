'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./config/env');
const logger = require('./config/logger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

// Route modules
const authRoutes     = require('./routes/authRoutes');
const ticketRoutes   = require('./routes/ticketRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes     = require('./routes/userRoutes');
const settingsRoutes      = require('./routes/settingsRoutes');
const projectRoutes       = require('./routes/projectRoutes');
const notificationRoutes  = require('./routes/notificationRoutes');

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = [
  config.clientUrl,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`[CORS] Rejected origin: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Total-Count'],
    maxAge: 86400, // 24 hours preflight cache
  })
);

// Handle preflight requests
app.options('*', cors());

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Cookie parser
// ---------------------------------------------------------------------------
app.use(cookieParser(config.cookieSecret));

// ---------------------------------------------------------------------------
// Response compression
// ---------------------------------------------------------------------------
app.use(
  compression({
    threshold: 1024, // only compress responses larger than 1 KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------
if (config.env !== 'test') {
  // Morgan HTTP request log (brief format)
  const morganFormat = config.env === 'production' ? 'combined' : 'dev';
  app.use(
    morgan(morganFormat, {
      stream: { write: (message) => logger.http(message.trim()) },
      skip: (req) => req.path === '/health', // skip health checks from logs
    })
  );
}

// Custom structured request logger (adds request-id, timing)
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Global rate limiter
// ---------------------------------------------------------------------------
app.use(generalLimiter);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/notifications', notificationRoutes);

// ---------------------------------------------------------------------------
// 404 handler — catch all unmatched routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// ---------------------------------------------------------------------------
// Global error handler (must be last middleware)
// ---------------------------------------------------------------------------
app.use(errorHandler);

module.exports = app;
