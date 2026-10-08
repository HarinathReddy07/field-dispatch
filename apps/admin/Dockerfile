# Admin console image. Build context is the repository root (see infra/docker-compose.yml).
FROM node:22-slim
RUN npm install -g pnpm@12.10.1
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @dispatch/contracts build \
  && pnpm --filter @dispatch/ui-tokens build \
  && pnpm --filter @dispatch/admin build
ENV NODE_ENV=production
WORKDIR /repo/apps/admin
EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3001"]
