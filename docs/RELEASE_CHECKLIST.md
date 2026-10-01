# Release checklist

- [x] Lint, types, 28 deterministic tests, Windows target build and dependency audits pass on implementation commit 4ab9a93.
- [x] CI Windows/Linux result inspected; jobs blocked before execution by account billing/spending eligibility.
- [x] Independent critic closes reviewed false-verification/security findings with GO.
- [x] UI inspected on desktop/mobile; real search and history refresh; no demo offers.
- [x] Live source outcomes and card stages saved with time, URLs, product/variant IDs and no personal sessions.
- [ ] Positive live price/seller/spec evidence obtained before claiming live VERIFIED support is accepted.
- [x] Windows/Linux hosted CI jobs pass on47fab80 (run36819778190); account eligibility no longer blocks jobs.
- [x] History backup and rollback runbook available.
- [x] No secrets/profile/runtime/cache/test-only synthetic offers in production data or commits.

Engineering implementation GO; positive live verification and public release HOLD. PR stays unmerged. Follow docs/RUNBOOK.md for restart/rollback. Product identity or provider changes require a new approved plan.

Native connector slice2026-10-01: local40 Node/3 Python tests and dependency audits pass; actual tool calls and negative live acceptance saved. Final independent review remains pending (critic usage limit), as does positive target verification. Prior checked critic item applies to the earlier slice only. Do not promote this PR to production based on installed collectors or tools/list success.
