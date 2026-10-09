# HTTPS / WSS deployable profile

The base stack (`infra/docker-compose.yml`) is the **local-development profile**: plain HTTP/WS, `INSECURE_LOCAL_DEV=true`,
and the API logs a warning on start. Anything deployed uses the TLS profile, where HTTP is refused by default.

## What enforces it

| Layer                                           | Behaviour                                                                                                                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSECURE_LOCAL_DEV` (API env, default `false`) | `false`: the API answers **426 `HTTPS_REQUIRED`** to any non-HTTPS request and refuses non-WSS Socket.io handshakes (`HTTPS_REQUIRED`). `/health/*` stays reachable for probes. `true`: plain HTTP/WS accepted (local only). |
| Env validation at startup                       | With the flag `false`, `CORS_ORIGINS` must be `https://` origins and `S3_PUBLIC_ENDPOINT` (presigned URLs given to devices) must be `https://`, otherwise the API refuses to start with a clear message.                     |
| `helmet`                                        | Sends `Strict-Transport-Security`.                                                                                                                                                                                           |
| Admin console                                   | `ADMIN_COOKIE_SECURE=true`: session cookies carry `Secure`.                                                                                                                                                                  |
| `infra/docker-compose.tls.yml` + Caddy          | A pinned Caddy proxy terminates TLS and sets `X-Forwarded-Proto: https` (what the API trusts). It is the only published entry point; api/admin/storage ports are unpublished.                                                |
| Mobile                                          | `EXPO_PUBLIC_API_URL` must be `https://…` in a release build (Socket.io then uses WSS automatically).                                                                                                                        |

The API trusts `X-Forwarded-Proto` from the single proxy in front of it (`trust proxy 1`), so it must not be reachable except through that proxy.

## Run it

```bash
# .env: DOMAIN=localhost (default) gives api.localhost / admin.localhost / storage.localhost with Caddy's built-in CA
make tls-config        # validates the merged compose files
make tls-up            # base stack + TLS proxy
curl -k https://api.localhost/health/ready          # -k only because the demo CA is not in your trust store
curl -i http://api.localhost/api/v1/auth/me          # redirected to https by the proxy
```

For a real domain set `DOMAIN=example.org` and `TLS_MODE=ops@example.org` (Let's Encrypt via ACME; ports 80/443 must be reachable). Point
`api.`, `admin.` and `storage.` DNS records at the host.

## Verified

- Config: `docker compose … config` merges cleanly; `caddy validate` accepts the Caddyfile for both `internal` and ACME modes.
- Behaviour: `transport.int.spec.ts` (plain HTTP → 426, `X-Forwarded-Proto: https` → 200, plain WS refused, WSS accepted, probes open) and `env.spec.ts` (http origins rejected).
- Not run here: the proxy container itself (no Docker on the author's machine); the CI `docker-clean-start` job exercises the base stack, and `make tls-up` is the manual check listed in `docs/STATUS.md`.
