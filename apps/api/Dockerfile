# API image (also used by the one-shot migrate / seed / storage-init services).
# Build context is the repository root (see infra/docker-compose.yml).
#
# Stage 1 installs and compiles with the full toolchain; stage 2 contains only production dependencies and
# the compiled output, and runs as the unprivileged `node` user.

ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

FROM ${NODE_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.10.1
WORKDIR /repo
COPY . .
# Only the API, the one-shot infra scripts (migrate/seed) and their workspace dependencies: no mobile/admin toolchain.
RUN pnpm install --frozen-lockfile --filter "@dispatch/api..." --filter "@dispatch/infra..." \
  && pnpm --filter @dispatch/config --filter @dispatch/contracts build \
  && pnpm --filter @dispatch/api build \
  && pnpm prune --prod

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/infra ./infra
COPY --from=build --chown=node:node /repo/packages ./packages
COPY --from=build --chown=node:node /repo/apps/api ./apps/api
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
