# Admin console image (Next.js standalone output). Build context is the repository root (see infra/docker-compose.yml).
# Stage 1 builds; stage 2 holds only the traced standalone server and static assets and runs as the unprivileged `node` user.

ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

FROM ${NODE_IMAGE} AS build
RUN npm install -g pnpm@12.10.1
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@dispatch/admin..." \
  && pnpm --filter @dispatch/contracts build \
  && pnpm --filter @dispatch/ui-tokens build \
  && pnpm --filter @dispatch/admin build \
  && mkdir -p apps/admin/public

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=node:node /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin/server.js"]
