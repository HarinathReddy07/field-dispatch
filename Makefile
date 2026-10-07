SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml --env-file .env

.PHONY: up down migrate seed test e2e demo logs reset

up:
	$(COMPOSE) up -d --build --wait postgres redis minio minio-init
	@echo "Infra is up. Run: make migrate && make seed, then 'docker compose ... up -d api admin' (or 'make demo')."
	$(COMPOSE) up -d --build --wait api admin || true

down:
	$(COMPOSE) down

reset:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f --tail=100 api

migrate:
	pnpm --filter @dispatch/infra migrate

seed:
	pnpm --filter @dispatch/infra seed

test:
	pnpm test

# Scripted A1-A7 end-to-end run against the running stack (Phase 3).
e2e:
	pnpm --filter @dispatch/api test:e2e

# Seeds data and restarts the api with a 60s review timeout so auto-approval is demonstrable.
demo: migrate seed
	REVIEW_TIMEOUT_SECONDS=60 $(COMPOSE) up -d --force-recreate api admin
