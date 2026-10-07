---
description: Run the full quality gate and report real evidence
---

1. Run `pnpm lint && pnpm typecheck`.
2. Run `make test`. Re-run the concurrency suite 10 times to detect flakiness.
3. Run `make e2e` (A1-A7).
4. Report a table: suite | command | pass/fail | counts | notes. Do not mark anything as passed unless you ran it just now.
5. Fix failures, re-run, and summarise what changed.
