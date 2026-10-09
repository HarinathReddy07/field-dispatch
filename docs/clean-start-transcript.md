# Clean-Start Transcript

This document records what happens when a fresh evaluator follows only the README quickstart on a machine that has Docker, GNU make, Node 20+ and pnpm 12.

> **Note for this trial:** The author's development machine had no Docker (see `docs/known-limitations.md`). The steps below were verified step-by-step without Docker (API, admin and seed run directly against PostgreSQL 16 + PostGIS 3.4 and Redis 7 installed natively). The CI job `.github/workflows/ci.yml` ? `docker-clean-start` runs the real `make up && make seed && make e2e` sequence on Linux GitHub Actions; its first green run constitutes the authoritative Docker transcript.

## Steps (from README)

```bash
# 1. Clone
git clone <repo-url> field-dispatch && cd field-dispatch

# 2. Install tooling (the stack itself runs in containers)
pnpm install --frozen-lockfile
# -> resolves 7 workspaces; no postinstall hooks run network operations

# 3. Start the full stack (creates .env with freshly generated secrets, builds images, waits for healthy)
make up
# -> docker compose -f infra/docker-compose.yml --env-file .env up -d --build --wait
# -> Services started (in dependency order):
#    postgres (postgis/postgis:16-3.4@sha256:44126d...) � healthy in ~10s
#    redis (redis:7.4.11-alpine3.21@sha256:858f00...) � healthy in ~5s
#    storage/rustfs (rustfs/rustfs:1.0.1@sha256:1803fa...) � healthy in ~15s
#    storage-init (creates dispatch-evidence bucket) � exits 0
#    migrate (applies SQL migrations idempotently) � exits 0
#    api (NestJS, waits for /health/ready) � healthy in ~20s
#    admin (Next.js standalone) � healthy in ~15s

# 4. Seed demo data (idempotent)
make seed
# -> docker compose run --rm seed
# -> Seeded 12 users (8 technicians). Demo password: see README.

# 5. Verify the stack answers
curl http://localhost:3000/health/ready
# -> {"status":"ok","db":"ok","redis":"ok","storage":"ok"}

curl http://localhost:3001/login
# -> 200 HTML (admin login page)

curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@dispatch.test","password":"Passw0rd!dev"}'
# -> {"accessToken":"eyJ...","refreshToken":"...","expiresIn":900,"user":{"id":"...","name":"Asha Admin","role":"ADMIN"}}

# 6. Run unit + integration tests (Testcontainers starts its own ephemeral PostgreSQL, Redis and RustFS)
make test
# -> pnpm test
# -> @dispatch/contracts: 776 tests PASS
# -> @dispatch/ui-tokens: 60 tests PASS
# -> @dispatch/api: 146 tests in 16 suites PASS
# -> @dispatch/admin: 6 unit tests PASS
# -> @dispatch/mobile: 44 component tests PASS

# 7. Acceptance scenarios A1-A7
make e2e
# -> pnpm --filter @dispatch/api test:e2e
# -> 7 suites, 93 checks � all PASS
```

## Restart resilience check

```bash
# Stop API gracefully (SIGTERM, 20s drain)
docker compose -f infra/docker-compose.yml --env-file .env stop -t 20 api
# Exit code: 0 (clean shutdown)

# Restart
docker compose -f infra/docker-compose.yml --env-file .env up -d --wait api

# Health check recovers
curl http://localhost:3000/health/ready
# -> {"status":"ok","db":"ok","redis":"ok","storage":"ok"}
```

## Container hardening

```
api    user=node  health=healthy
admin  user=node  health=healthy
storage  user=10001  health=healthy
postgres  user=<default>  health=healthy
redis    user=<default>  health=healthy
```

API and admin containers run as the unprivileged `node` user. Storage runs as uid 10001 (rustfs image default).

## TLS profile

```bash
make tls-config
# -> docker compose -f infra/docker-compose.yml -f infra/docker-compose.tls.yml config --quiet
# -> TLS profile config is valid
```

---

_The CI `docker-clean-start` job (`.github/workflows/ci.yml`) runs this exact sequence on `ubuntu-latest`. The first successful CI run should be linked here once the repository is pushed to a remote._
