'use strict';

/**
 * @fileoverview Environment configuration loader and validator.
 * Loads variables from .env, applies defaults, and validates required values.
 *
 * Exported `config` object exposes settings via both flat keys (used by
 * newly-created infrastructure files) and nested namespaced keys (jwt, openai,
 * etc.) used by the existing service/controller layer. Both shapes are kept in
 * sync — there is no duplication of the underlying values.
 */

require('dotenv').config();

/**
 * Assert that a required environment variable is present in production.
 * @param {string} name - Variable name.
 * @param {string|undefined} value - Current value.
 * @returns {string|undefined} The value unchanged.
 * @throws {Error} If the variable is missing and NODE_ENV === 'production'.
 */
function requireInProduction(name, value) {
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable in production: ${name}`);
  }
  return value;
}

/**
 * Parse an integer environment variable with a fallback default.
 * @param {string|undefined} raw - Raw string from process.env.
 * @param {number} defaultValue - Fallback when raw is absent or NaN.
 * @returns {number}
 */
function parseIntEnv(raw, defaultValue) {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

// ── Resolved primitives ───────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev    = NODE_ENV === 'development';
const isProd   = NODE_ENV === 'production';
const isTest   = NODE_ENV === 'test';

const PORT = parseIntEnv(process.env.PORT, 5000);

const MONGODB_URI = requireInProduction(
  'MONGODB_URI',
  process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_jira_tickets'
);

const JWT_SECRET = requireInProduction(
  'JWT_SECRET',
  process.env.JWT_SECRET || 'dev_jwt_secret_not_for_production_use_ever'
);

const JWT_REFRESH_SECRET = requireInProduction(
  'JWT_REFRESH_SECRET',
  process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_not_for_production_use_ever'
);

const JWT_EXPIRES_IN         = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL || 'gpt-4o';

// AI provider: 'openai' (default) | 'groq' (free tier)
const AI_PROVIDER  = process.env.AI_PROVIDER || 'openai';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const RATE_LIMIT_WINDOW_MS = parseIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const RATE_LIMIT_MAX       = parseIntEnv(process.env.RATE_LIMIT_MAX, 100);

const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

const BCRYPT_ROUNDS = parseIntEnv(process.env.BCRYPT_ROUNDS, 12);

// Cookie secret — optional, used by cookieParser for signed cookies
const COOKIE_SECRET = process.env.COOKIE_SECRET || JWT_SECRET;

// ── Email ─────────────────────────────────────────────────────────────────────
const SMTP_HOST           = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT           = parseIntEnv(process.env.SMTP_PORT, 587);
const SMTP_SECURE         = process.env.SMTP_SECURE === 'true';
const SMTP_USER           = process.env.SMTP_USER || '';
const SMTP_PASS           = process.env.SMTP_PASS || '';
const EMAIL_FROM          = process.env.EMAIL_FROM || 'AI Ticket App <noreply@example.com>';
const INVITE_EXPIRES_HOURS = parseIntEnv(process.env.INVITE_EXPIRES_HOURS, 48);

// ── Redis ─────────────────────────────────────────────────────────────────────
const REDIS_HOST     = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT     = parseIntEnv(process.env.REDIS_PORT, 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_DB       = parseIntEnv(process.env.REDIS_DB, 0);
const REDIS_URL      = process.env.REDIS_URL || '';   // overrides host/port when set
// Default TTLs (seconds)
const CACHE_TTL_SHORT  = parseIntEnv(process.env.CACHE_TTL_SHORT, 60);       // 1 min
const CACHE_TTL_MEDIUM = parseIntEnv(process.env.CACHE_TTL_MEDIUM, 300);     // 5 min
const CACHE_TTL_LONG   = parseIntEnv(process.env.CACHE_TTL_LONG, 3600);      // 1 hr

// ── Exported config object ────────────────────────────────────────────────────

/**
 * @typedef {Object} AppConfig
 *
 * // Flat keys (used by new middleware / config files)
 * @property {string}  nodeEnv
 * @property {string}  env              - Alias for nodeEnv (used by legacy code)
 * @property {boolean} isDev
 * @property {boolean} isProd
 * @property {boolean} isTest
 * @property {number}  port
 * @property {string}  mongodbUri
 * @property {string}  jwtSecret
 * @property {string}  jwtRefreshSecret
 * @property {string}  jwtExpiresIn
 * @property {string}  jwtRefreshExpiresIn
 * @property {string}  openaiApiKey
 * @property {string}  openaiModel
 * @property {string}  clientUrl
 * @property {number}  rateLimitWindowMs
 * @property {number}  rateLimitMax
 * @property {string}  logLevel
 * @property {number}  bcryptRounds
 * @property {string}  cookieSecret
 *
 * // Nested namespaces (used by existing services / controllers)
 * @property {{ secret: string, refreshSecret: string, accessExpiry: string, refreshExpiry: string }} jwt
 * @property {{ apiKey: string, model: string }} openai
 */

/** @type {AppConfig} */
const config = {
  // ── Application ─────────────────────────────────────────────────────────────
  nodeEnv: NODE_ENV,
  env:     NODE_ENV,   // Legacy alias — existing code reads config.env
  isDev,
  isProd,
  isTest,
  port:    PORT,

  // ── Database ─────────────────────────────────────────────────────────────────
  mongodbUri: MONGODB_URI,

  // ── JWT — flat keys ──────────────────────────────────────────────────────────
  jwtSecret:          JWT_SECRET,
  jwtRefreshSecret:   JWT_REFRESH_SECRET,
  jwtExpiresIn:       JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: JWT_REFRESH_EXPIRES_IN,

  // ── JWT — nested namespace (used by authService, etc.) ──────────────────────
  jwt: {
    secret:        JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
    accessExpiry:  JWT_EXPIRES_IN,
    refreshExpiry: JWT_REFRESH_EXPIRES_IN,
  },

  // ── AI Provider ──────────────────────────────────────────────────────────────
  aiProvider: AI_PROVIDER,

  // ── OpenAI — flat keys ───────────────────────────────────────────────────────
  openaiApiKey: OPENAI_API_KEY,
  openaiModel:  OPENAI_MODEL,

  // ── OpenAI — nested namespace (used by aiService, etc.) ─────────────────────
  openai: {
    apiKey: OPENAI_API_KEY,
    model:  OPENAI_MODEL,
  },

  // ── Groq — free tier alternative ─────────────────────────────────────────────
  groqApiKey: GROQ_API_KEY,
  groqModel:  GROQ_MODEL,
  groq: {
    apiKey: GROQ_API_KEY,
    model:  GROQ_MODEL,
  },

  // ── CORS ──────────────────────────────────────────────────────────────────────
  clientUrl: CLIENT_URL,

  // ── Rate Limiting ─────────────────────────────────────────────────────────────
  rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMax:      RATE_LIMIT_MAX,

  // ── Logging ───────────────────────────────────────────────────────────────────
  logLevel: LOG_LEVEL,

  // ── Security ──────────────────────────────────────────────────────────────────
  bcryptRounds: BCRYPT_ROUNDS,
  cookieSecret: COOKIE_SECRET,

  // ── Redis ─────────────────────────────────────────────────────────────────────
  redisHost:    REDIS_HOST,
  redisPort:    REDIS_PORT,
  redisPassword: REDIS_PASSWORD,
  redisDb:      REDIS_DB,
  redisUrl:     REDIS_URL,
  redis: {
    host:     REDIS_HOST,
    port:     REDIS_PORT,
    password: REDIS_PASSWORD,
    db:       REDIS_DB,
    url:      REDIS_URL,
  },

  // ── Cache TTLs (seconds) ─────────────────────────────────────────────────────
  cacheTtlShort:  CACHE_TTL_SHORT,
  cacheTtlMedium: CACHE_TTL_MEDIUM,
  cacheTtlLong:   CACHE_TTL_LONG,
  cache: {
    ttl: {
      short:  CACHE_TTL_SHORT,
      medium: CACHE_TTL_MEDIUM,
      long:   CACHE_TTL_LONG,
    },
  },

  // ── Email ─────────────────────────────────────────────────────────────────────
  smtpHost:           SMTP_HOST,
  smtpPort:           SMTP_PORT,
  smtpSecure:         SMTP_SECURE,
  smtpUser:           SMTP_USER,
  smtpPass:           SMTP_PASS,
  emailFrom:          EMAIL_FROM,
  inviteExpiresHours: INVITE_EXPIRES_HOURS,
  email: {
    host:           SMTP_HOST,
    port:           SMTP_PORT,
    secure:         SMTP_SECURE,
    user:           SMTP_USER,
    pass:           SMTP_PASS,
    from:           EMAIL_FROM,
    inviteExpiresHours: INVITE_EXPIRES_HOURS,
  },
};

module.exports = config;
