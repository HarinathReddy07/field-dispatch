# API image. Build context is the repository root (see infra/docker-compose.yml).
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.10.1
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @dispatch/config --filter @dispatch/contracts build \
  && pnpm --filter @dispatch/api build
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
