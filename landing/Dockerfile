# ──────────────────────────────────────────────────────────────
# Orbit Workspace — Landing (Next.js marketing site, standalone)
# ──────────────────────────────────────────────────────────────

# ── Stage 1: dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* are inlined at build time. Point this at the product app:
#   --build-arg NEXT_PUBLIC_APP_URL=https://app.orbit.example.com
ARG NEXT_PUBLIC_APP_URL=http://localhost:5173
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: runtime (standalone) ────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output already includes a minimal node_modules + server.js
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
