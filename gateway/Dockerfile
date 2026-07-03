# =============================================================
# RepoTalk Gateway — Dockerfile
# Node.js 20 Alpine image for Render deployment
# =============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine during build
RUN apk add --no-cache openssl

# Install dependencies first (layer caching)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source
COPY . .

# Force production schema and generate
RUN cp prisma/schema.production.prisma prisma/schema.prisma
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ─── Runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Install OpenSSL (required by Prisma engine)
RUN apk add --no-cache openssl

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

RUN chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
