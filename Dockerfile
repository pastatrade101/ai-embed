# syntax=docker/dockerfile:1

# Makutano Digital — SvelteKit (adapter-node) production image.
# All secrets are read at RUNTIME via $env/dynamic/private, so nothing sensitive
# is baked in at build time — configuration is injected by docker-compose.

# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Build the standalone Node server (build/) and drop dev dependencies.
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Ops scripts (e.g. the plot_geo distance pre-compute) + the pure geo helpers they
# import — run with `docker compose exec ai-embed-server node scripts/<name>.mjs`.
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib/server/geo-utils.js ./src/lib/server/geo-utils.js

EXPOSE 3000

# Liveness probe — the hosted page/API responds on /.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

USER node
CMD ["node", "build"]
