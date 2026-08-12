# syntax=docker/dockerfile:1

# --------------------------------------------------------------------------
# Stage 1 — build the static bundle
# --------------------------------------------------------------------------

FROM node:24-alpine AS builder

WORKDIR /app

# Dependencies before source, so editing a component does not invalidate the
# slow npm install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_ variables at build time, so these are compile-time
# constants, not runtime configuration. The relative default means the bundle
# works behind any hostname.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


# --------------------------------------------------------------------------
# Stage 2 — serve
# --------------------------------------------------------------------------
# No Node process in production: nginx serves the built files directly.

FROM nginx:1.29-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf

EXPOSE 80

# 127.0.0.1, not localhost. The container's /etc/hosts maps localhost to both
# 127.0.0.1 and ::1; wget tries IPv6 first and nginx listens on IPv4 only, so
# "localhost" here fails while the site serves perfectly from outside.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --spider -q http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
