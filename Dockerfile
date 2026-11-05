# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# AURALIS production image (Next.js standalone + Prisma)
# ─────────────────────────────────────────────────────────────
ARG NODE_VERSION=24-bookworm-slim

# ---- deps: install all dependencies (needed for the build) ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# The postinstall step runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci

# ---- build: compile the Next.js app ----
FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- migrate: standalone Prisma CLI for `migrate deploy` at startup ----
FROM node:${NODE_VERSION} AS migrate
WORKDIR /opt/prisma
COPY prisma/schema.prisma ./schema.prisma
# Running the CLI once at build time fetches the platform's schema engine into the
# image, so containers never need network access to run migrations at startup.
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund prisma@6.19.3 \
 && node node_modules/prisma/build/index.js version \
 && node node_modules/prisma/build/index.js validate --schema=./schema.prisma

# ---- runtime: minimal image ----
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STORAGE_LOCAL_DIR=/app/.data/storage

COPY --from=migrate /opt/prisma /opt/prisma
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/set-role.mjs ./scripts/set-role.mjs
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/auralis-entrypoint
RUN chmod +x /usr/local/bin/auralis-entrypoint && mkdir -p /app/.data && chown -R node:node /app/.data

USER node
VOLUME ["/app/.data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "auralis-entrypoint"]
CMD ["node", "server.js"]
