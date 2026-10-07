SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml --env-file .env

.PHONY: up down reset logs migrate seed test e2e cov demo

# Whole stack in the background (postgres, redis, minio, migrations, api, admin). Migrations run automatically.
up:
	$(COMPOSE) up -d --build --wait

down:
	$(COMPOSE) down

# Also deletes volumes (database, redis, object storage).
reset:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f --tail=100 api

migrate:
	$(COMPOSE) run --rm migrate

seed:
	$(COMPOSE) run --rm seed

# Unit + integration suites. Uses Testcontainers (needs Docker), or set TEST_ADMIN_DATABASE_URL and TEST_REDIS_URL
# to point at an existing PostGIS + Redis instead.
test:
	pnpm test

cov:
	pnpm --filter @dispatch/api test:cov

# Scripted acceptance scenarios A1-A7 (see apps/api/jest.e2e.config.js).
e2e:
	pnpm --filter @dispatch/api test:e2e

# Seeds data and restarts the api with a 60s review timeout so auto-approval is demonstrable.
demo: up seed
	REVIEW_TIMEOUT_SECONDS=60 $(COMPOSE) up -d --force-recreate --wait api
	@echo "Demo ready. Logins and steps: docs/demo-script.md"
