# syntax=docker/dockerfile:1

# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps

# libc6-compat is needed for some native modules on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ─── Stage 2: Build the application ───────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Copy the standalone server bundle (enabled via output: 'standalone' in next.config.js)
# This includes only the minimal server files — no full node_modules needed
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Migration SQL files — read from disk at boot via drizzle-orm's migrate(),
# not bundled automatically by Next's standalone output tracing.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle/migrations ./drizzle/migrations
COPY --from=builder --chown=nextjs:nodejs /app/drizzle/migrations-sqlite ./drizzle/migrations-sqlite

# Allow the app to write config/state files to /app at runtime
RUN chown nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Database connection — override these at runtime via -e or docker-compose env_file.
#
# MySQL / MariaDB:
#   ENV DB_TYPE=mysql
#   ENV DB_HOST=
#   ENV DB_PORT=3306
#   ENV DB_USER=
#   ENV DB_PASSWORD=
#   ENV DB_NAME=
#
# SQLite (trial mode) — single file, no separate database container needed.
# Mount a volume at /app/data to persist it across container restarts:
#   docker run -v pixxel-data:/app/data -e DB_TYPE=sqlite -e DB_FILE=data/pixxel.db ...
#   ENV DB_TYPE=sqlite
#   ENV DB_FILE=data/pixxel.db

CMD ["node", "server.js"]
