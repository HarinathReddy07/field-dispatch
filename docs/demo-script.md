# Demo script

Prerequisite: `make demo` (stack up, seeded, review timeout 60 s). Logins: [runbook](runbook.md#3-seeded-logins-dev-only), password `Passw0rd!dev`.
Use two phones/emulators (or two Expo sessions): **Requester** = `requester1@dispatch.test`, **Technician** = `tech1@dispatch.test`; the **Admin** console at `http://localhost:3001` (`admin@dispatch.test`).
In the technician app, _Go online_ first. In dev builds _Simulate drive to site_ streams GPS samples.

| #   | Step                                                                                                                              | What to see                                                                                                                        | Scenario      |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Admin: open **Live jobs**; badge says _Live_                                                                                      | board + map load                                                                                                                   | –             |
| 2   | Requester: **New request** → asset `DEMO-001`, electrical, MG Road → _Find technicians_                                           | the request appears on the admin board **instantly** (state _Requested → Matched_)                                                 | A1            |
| 3   | Requester: pick the nearest (Anil, ★4.8) → **Book**                                                                               | booking screen shows the **server quote** and **assignment ID**; technician app shows the job at once; admin row turns _Confirmed_ | A1, TR-05     |
| 4   | Technician: _Simulate drive_; requester job screen shows live position + ETA                                                      | `technician.location.updated` only reaches this requester and admin                                                                | realtime      |
| 5   | Requester: **Show arrival code** → technician enters a **wrong** code, then the right one                                         | wrong → "not valid" (uniform message); five wrong attempts lock further tries; the right code → _On site_; **reusing it fails**    | A3            |
| 6   | Technician: **Start inspection**                                                                                                  | timer starts from the **server** start time (kill the app and reopen: it continues correctly)                                      | TR-07         |
| 7   | Technician: take **one** photo, tap **Finish**                                                                                    | rejected: _at least two finalized images required_                                                                                 | TR-08         |
| 8   | Technician: second photo → **Finish**                                                                                             | requester sees _Awaiting review_ with the evidence thumbnails **without refreshing**                                               | A1            |
| 9   | Requester: **Request rework** (reason) → technician gets it instantly, uploads two new photos, finishes                           | history keeps the first round: admin job detail shows both evidence cycles and both reviews                                        | A2            |
| 10  | Requester: **Approve** (or wait 60 s for auto-approval on another job)                                                            | _Settled_; receipt shows exactly **one** mock settlement; admin detail shows settlement + the full audit trail                     | A1, A6, TR-10 |
| 11  | Admin: open a live job → **Cancel job…** (button disabled until a reason ≥ 5 chars) → confirm; **Audit** view, filter by that job | the entry shows actor, action, **reason**                                                                                          | TR-12         |
| 12  | `docker compose -f infra/docker-compose.yml --env-file .env restart api` while a job is _Confirmed_ or _Awaiting review_          | apps reconnect and resync; OTP still works; the review still auto-approves                                                         | A7            |
| 13  | Run the tests: `make e2e` (A1-A7), `pnpm --filter @dispatch/api test` (concurrency + security matrix)                             | all green; see [test-plan](test-plan.md)                                                                                           | A4, A5        |

## Edge cases to try by hand

- **A4:** two requesters book the same technician at the same moment (or run the loop test): exactly one `200`, the other `409 TECHNICIAN_UNAVAILABLE`.
- **A5:** log in as requester2 and open requester1's request id → _not found_; call any `/admin/*` route with a technician token → `403`.
- **Idempotency:** `curl` the confirm call twice with the same `Idempotency-Key` → identical response, one assignment.
- **Stale technician:** `tech5` never appears in nearby results (stale), nor `tech6` (offline) or `tech7` (busy).

## API-only walkthrough (no phone needed)

```bash
API=http://localhost:3000/api/v1; PW='Passw0rd!dev'
login() { curl -s $API/auth/login -H 'content-type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken'; }
R=$(login requester1@dispatch.test); T=$(login tech1@dispatch.test)
REQ=$(curl -s $API/requests -H "authorization: Bearer $R" -H 'content-type: application/json' -d '{"assetId":"CURL-1","category":"ELECTRICAL_INSPECTION","location":{"lat":12.9748,"lon":77.6033},"windowStart":"'$(date -u -d '+1 hour' +%FT%TZ)'","windowEnd":"'$(date -u -d '+3 hours' +%FT%TZ)'"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s $API/requests/$REQ/nearby-technicians -H "authorization: Bearer $R"          # ranked list; request becomes MATCHED
TECH=00000000-0000-4000-8000-000000000021                                                  # Anil
curl -s $API/requests/$REQ/confirm -X POST -H "authorization: Bearer $R" -H 'content-type: application/json' -H 'Idempotency-Key: demo-confirm-1' -d "{\"technicianId\":\"$TECH\"}"
OTP=$(curl -s -X POST $API/requests/$REQ/otp -H "authorization: Bearer $R" | node -pe 'JSON.parse(require("fs").readFileSync(0)).otp')
curl -s -X POST $API/requests/$REQ/arrive -H "authorization: Bearer $T" -H 'content-type: application/json' -H 'Idempotency-Key: demo-arrive-1' -d "{\"otp\":\"$OTP\"}"
```

Evidence upload needs a presigned PUT to MinIO (use the mobile app, or the integration tests).
