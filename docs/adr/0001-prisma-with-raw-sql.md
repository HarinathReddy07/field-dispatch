# ADR 0001: Prisma for CRUD, hand-written SQL for geo and locking

**Status:** accepted

**Context.** The stack mandates PostgreSQL + PostGIS and an ORM-friendly NestJS API, but the hardest requirements (proximity search, row locks, exclusion constraints,
append-only triggers, partial unique indexes) are not expressible in an ORM.

**Decision.** SQL migrations in `infra/migrations` are the source of truth and are applied by a small runner (advisory-locked, one transaction per file).
Prisma maps the tables (`apps/api/prisma/schema.prisma`, PostGIS/range columns as `Unsupported`) and is used for simple CRUD (users, refresh tokens).
Everything transactional or spatial uses `$queryRaw`/`$executeRaw` with tagged-template parameters inside `prisma.$transaction` (interactive transactions, READ COMMITTED + explicit locks).

**Consequences.** Constraints live in the database where they cannot be bypassed by a code path. Raw rows need explicit casts (`::uuid`, `::int`, `::float8`) and
geography is exposed only as `lat/lon`. There is no `prisma migrate`; schema changes are new numbered `.sql` files.
