# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install dependencies and compile the React app with Vite
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (devDependencies needed for Vite build)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the production bundle — output goes to /app/dist
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — serve the static bundle with nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy the compiled React app from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default nginx config with our SPA-aware config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove the default nginx.conf to avoid conflicts
RUN rm -f /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

# Expose port 80
EXPOSE 80

# Health check — verifies nginx is serving correctly
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# nginx image already has a proper ENTRYPOINT + CMD
CMD ["nginx", "-g", "daemon off;"]
