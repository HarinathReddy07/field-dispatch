SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml --env-file .env
COMPOSE_TLS := docker compose -f infra/docker-compose.yml -f infra/docker-compose.tls.yml --env-file .env

.PHONY: env up down reset logs migrate seed test e2e cov demo tls-config tls-up tls-down

# Creates .env from .env.example with freshly generated secrets (never overwrites an existing .env).
env: .env
.env:
	@if command -v node >/dev/null 2>&1; then node infra/scripts/init-env.js; \
	else cp .env.example .env; echo "node not found: copied .env.example to .env. Replace every CHANGE_ME_* value, then re-run make."; exit 1; fi

# Whole stack in the background (postgres, redis, object storage + bucket, migrations, api, admin). Migrations run automatically.
up: .env
	$(COMPOSE) up -d --build --wait

down: .env
	$(COMPOSE) down

# Also deletes volumes (database, redis, object storage).
reset: .env
	$(COMPOSE) down -v

logs: .env
	$(COMPOSE) logs -f --tail=100 api

migrate: .env
	$(COMPOSE) run --rm migrate

seed: .env
	$(COMPOSE) run --rm seed

# Unit + integration suites. Uses Testcontainers (needs Docker), or set TEST_ADMIN_DATABASE_URL, TEST_REDIS_URL
# (and TEST_S3_* for the storage adapter suite) to point at instances you already run.
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

# HTTPS/WSS deployable profile (see docs/deploy-tls.md). Needs DOMAIN, ACME_EMAIL or the internal-CA default in .env.
tls-config: .env
	$(COMPOSE_TLS) config --quiet && echo "TLS profile config is valid"

tls-up: .env
	$(COMPOSE_TLS) up -d --build --wait

tls-down: .env
	$(COMPOSE_TLS) down
