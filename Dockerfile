# ── Build stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all deps (including devDependencies for any build tooling)
RUN pnpm install --frozen-lockfile

# ── Production stage ──────────────────────────────────────────────────
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source (scraper-service excluded via .dockerignore)
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "import('http').then(h=>h.get('http://localhost:'+(process.env.PORT||4000)+'/health',r=>{process.exit(r.statusCode===200?0:1)}))"

# Default: start API server. Override via docker-compose command for workers.
CMD ["node", "server.js"]
