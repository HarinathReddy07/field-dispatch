# Demo script (spec Appendix B, mapped to A1-A7)

Ready for a human to record. Setup once: `make demo` (stack up, seeded, review timeout 60 s). Password for every login: `Passw0rd!dev`.

| Who              | Login                               | Where                                                            |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------- |
| Requester        | `requester1@dispatch.test`          | mobile app, session 1 (`EXPO_PUBLIC_API_URL=http://<host>:3000`) |
| Technician       | `tech1@dispatch.test` (Anil, 4.8 ★) | mobile app, session 2 (emulator + phone, or two Expo sessions)   |
| Operations admin | `admin@dispatch.test`               | browser `http://localhost:3001`                                  |

Before step 1: in the technician app tap **Go online**; open the admin **Live jobs** view and check the badge says _Live_.

| #   | Appendix B step                                            | Exact actions                                                                                                                                                      | What to show                                                                                                                     | Scenario          |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Login as Requester, create a request with a map location   | Requester app: sign in → **New request** → asset `DEMO-001`, _Electrical inspection_, place _MG Road_, starts in 1 h, window 2 h → **Find technicians**            | the role comes from the server (no role picker); the request appears on the admin board **instantly**                            | A1                |
| 2   | Query nearby technicians and select the nearest            | Nearby list: Anil (0.4 km, 4.8 ★, server quote) first; `tech5` (stale), `tech6` (offline), `tech7` (busy) are absent → **Book Anil**                               | results come from the PostGIS query; booking screen shows the **final quote and assignment ID**                                  | A1 (TR-03, TR-04) |
| 3   | Admin dashboard receives the new assignment in real time   | Watch the admin **Live jobs** row turn _Technician booked_ and the technician app show the job, with no refresh                                                    | `assignment.created` reached technician + admin; nobody else                                                                     | A1 (TR-05)        |
| 4   | Login/act as Technician and verify the arrival OTP         | Requester: job screen → **Show arrival code**. Technician: enter a **wrong** code, then the right one → _On site_. Try the right code again                        | wrong and expired codes give the same message; the code works once; five wrong tries lock further attempts                       | A3                |
| 5   | Start work; timer from server timestamps                   | Technician: **Start inspection**. Kill the technician app, reopen it                                                                                               | the timer continues from the **server** start time (also correct if the phone clock is wrong)                                    | A1 (TR-07)        |
| 6   | Upload one image; completion blocked until the second      | Technician: **Take a photo** (or _Pick from gallery_ in a dev build) once → **Finish and submit for review**                                                       | rejected with _at least two finalized images required_                                                                           | A1 (TR-08)        |
| 7   | Submit evidence; requester sees the review state instantly | Technician: second photo → **Finish and submit for review**                                                                                                        | requester sees _Awaiting review_ and the thumbnails without refreshing; the admin row follows                                    | A1                |
| 8   | Request rework once, update evidence, approve              | Requester: **Request rework** with reason "Photo 2 is blurry" → technician gets it at once, uploads two new photos, finishes → requester **Approve**               | admin job drawer shows both work cycles of evidence and both reviews (history retained)                                          | A2                |
| 9   | Exactly one settlement and the full audit trail            | Requester: **View receipt** (mock settlement). Admin: job drawer → _Settlement_, then **Audit** view, filter by that job                                           | one settlement row and one reference; every transition has actor, action, time. Repeat taps / retries never add a second one     | A6                |
| 10  | Run the concurrency and security tests from the repository | `make e2e`; then `pnpm --filter @dispatch/api exec jest --config jest.config.js --selectProjects integration -- concurrency security admin media` (or `make test`) | A4 one winner / one 409; A5 foreign job 404, technician on admin route 403; the 9.3 matrix passes. See [test-plan](test-plan.md) | A4, A5, A6, A7    |

## Extra moments worth showing (each is an edge case required by the spec)

- **A4 by hand:** two requesters book `tech1` at the same moment (or run the concurrency loop test): exactly one `200`, the other `409 TECHNICIAN_UNAVAILABLE`.
- **A5 by hand:** sign in as `requester2` and open requester1's request id → _not found_; call any `/admin/*` route with a technician token → `403`.
- **A7 restart:** while a job is _Technician booked_ or _Awaiting review_ run `docker compose -f infra/docker-compose.yml --env-file .env restart api`. Apps reconnect and resync; the OTP still works; the 60 s review timeout still auto-approves (TR-10).
- **Exception handling:** admin → open a live job → **Cancel job…** (disabled until a reason of 5+ characters) → the **Audit** view shows actor, action and reason.

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

Evidence upload needs a presigned PUT to the object store (use the mobile app, or `storage.s3.int.spec.ts`, which drives the whole upload through a real S3-compatible server).
