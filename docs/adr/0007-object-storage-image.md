# ADR 0007: RustFS replaces MinIO as the S3-compatible evidence store

**Status:** accepted (2026-10-09)

**Context.** The compose stack used `minio/minio:latest` and `minio/mc:latest`. Upstream MinIO is archived and its
official images are gone: on 2026-10-09 `minio/minio` no longer exists on Docker Hub (`object not found`) and
`quay.io/minio/minio` answers `401` for anonymous pulls. A floating `latest` tag cannot be pinned and a pinned MinIO tag
cannot be pulled, so the clean-start requirement (spec 1.2: "clone, start the complete stack, seed") could not be met.

**Decision.** Use **RustFS 1.0.1** (`rustfs/rustfs:1.0.1@sha256:1803faef…`, Apache-2.0) as the S3-compatible server.

- It speaks the S3 API with SigV4 presigned URLs, path-style addressing and the same `:9000` / `:9001` ports, so the
  application adapter (`MinioStorageProvider`, built on `@aws-sdk/client-s3`) is unchanged; the class name is historical.
- The image runs as a non-root user (uid 10001), ships `curl` for a real container healthcheck (`/health`), and has a
  Windows build of the same server, which let the adapter be tested against the real thing on a machine without Docker.
- The bucket stays private: a one-shot `storage-init` service (`apps/api/scripts/init-storage.js`, run from the API image)
  creates it and never sets an anonymous policy. This also removes the need for a second image (`mc`).

**Alternatives considered.** SeaweedFS (S3 gateway needs a separate identity JSON and several processes), VersityGW (POSIX
backend, no console), LocalStack (licensed/auth-token gated since 2026). Any S3-compatible server works: set `S3_ENDPOINT`,
`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.

**Consequences.** Every image in `infra/docker-compose*.yml` and every `FROM` is pinned to an exact version (+ digest for
third-party images). The adapter is covered by `storage.s3.int.spec.ts` against a real S3-compatible server (RustFS via
Testcontainers by default, or `TEST_S3_*` to point at a running one), including an expired URL and a wrong-user URL.
`postgis/postgis:16-3.4` is amd64-only; on Apple Silicon Docker emulates it.
