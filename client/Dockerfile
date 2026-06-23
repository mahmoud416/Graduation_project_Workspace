# ──────────────────────────────────────────────────────────────
# Orbit Workspace — Frontend (React + Vite) served by Nginx
# ──────────────────────────────────────────────────────────────

# ── Stage 1: build the static bundle ─────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Vite bakes these at build time. Override with:
#   --build-arg VITE_API_URL=https://api.example.com
#   --build-arg VITE_API_BASE=https://api.example.com/api/v1
ARG VITE_API_URL=http://localhost:8000
ARG VITE_API_BASE=http://localhost:8000/api/v1
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_API_BASE=${VITE_API_BASE}

# Install dependencies (cache-friendly)
COPY package*.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# ── Stage 2: serve with Nginx ────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# SPA-aware Nginx config (history fallback + API/WS proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
