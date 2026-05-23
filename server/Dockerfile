# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install ALL dependencies (including devDependencies)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install dumb-init for proper signal handling and build tools needed by native addons
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for potential build steps)
RUN npm ci

# Copy the rest of the source code
COPY . .

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — lean image with only production dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Copy dumb-init from builder
COPY --from=builder /usr/bin/dumb-init /usr/bin/dumb-init

# Set environment to production
ENV NODE_ENV=production
ENV PORT=5000

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy application source from builder stage
COPY --from=builder /app/config ./config
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/repositories ./repositories
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/validators ./validators
COPY --from=builder /app/index.js ./index.js

# Create logs directory (the app writes logs here)
RUN mkdir -p logs

# Use the built-in non-root 'node' user for security
USER node

# Expose the application port
EXPOSE 5000

# Health check — verifies the API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init to handle PID 1 responsibilities (signal forwarding, zombie reaping)
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "index.js"]
