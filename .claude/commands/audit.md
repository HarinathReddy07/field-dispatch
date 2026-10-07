---
description: Skeptical client-evaluator audit against the spec
---

1. Read docs/spec/SPEC.md. Build a table: TR-01..TR-14, A1..A7, security-matrix rows | implemented? | evidence (file, test name, command) | gap.
2. Attack the running stack: (a) double-confirm from two clients, (b) replay a consumed OTP, (c) stop with 1 image, (d) review as the technician, (e) technician socket joins another job's room, (f) tamper with the settlement amount, (g) restart the API during UNDER_REVIEW and confirm the timeout still fires, (h) grep logs for OTP/tokens/passwords.
3. Fix every gap, run /verify, update docs.
4. Finish with a delivery note: what is real, what is mocked, known limitations, how to run.
