# Acceptance evidence — 2026-09-30

Target: RedmiBook Pro 16 2026 / Intel Core Ultra 5 338H / 32 GB / 1 TB.

Implementation review: GO. Positive live verification / public release: HOLD.

## Live run

[Machine-readable evidence](evidence/2026-09-30-live-acceptance.json), run 20:32:40 UTC, implementation commit 4ab9a93. Real ru-marketplace-mcp source and dedicated account-free Chrome profile; no fixture prices or accounts.

| Stage | Observed result |
| --- | --- |
| Discovery | Yandex Market reported 8 results; 3 selected by specification fit for independent reopen |
| Canonical URL / product / variant | Actual discovered Market paths retained, including product 5829889027 / variant 5932997102 and product 5981551118 / variant 5981551118 |
| Card reopen | All 3 requests reached canonical card URLs and returned HTTP 403; no readable live product card |
| Current price / seller | Unknown; discovery prices are separate observations, never promoted to current prices |
| Ozon | MCP browser discovery HTTP 403; no candidate available for independent Ozon card acceptance |
| Avito | MCP browser discovery IP-firewall block (439 in runtime log); no card candidate |
| Verdict | 3 UNVERIFIED, 0 VERIFIED; incomplete source coverage |

Xiaomi Book in a search title is not silently treated as RedmiBook. A wrong-generation candidate also remains UNVERIFIED when the reopened card is blocked; MISMATCH requires actual observed card data. The response field cardsReopened counts attempts, not readable cards.

The later UI-triggered run completed at 20:34:11 UTC with the same three candidates and zero confirmed offers. Search button loading/re-enable, source failures, canonical links, unknown landed cost, history append and history refresh were inspected. Desktop width1280 and mobile390 had no horizontal overflow. Browser console contained no warning/error entries. Screenshots retained in the task outputs.

## Local verification

- Original installation and 6 baseline tests passed.
- Final implementation: 28 tests, Biome lint, strict TypeScript and build passed.
- Real Chrome security harness passed: redirect and unguarded-page attempts reached zero private trap endpoints; dev-mode card snapshot executed.
- Real MCP lifecycle regression passed initialize, tool invocation, exit and reconnect.
- npm audit: zero advisories. pip-audit after hash-locked security overlay: zero known advisories; uv pip check: 89 packages compatible. Unpublished workspace packages are not covered by PyPI advisory lookup.
- Independent critic closed reviewed identity, variant, network isolation and lifecycle findings with GO.
- History serialization, TTL/future timestamps, ambiguous specs and unknown landed costs have negative regression coverage.

## Remote CI limitation

GitHub Actions runs [36773291457](https://github.com/loftfull/marketplace-scout/actions/runs/36773291457) and [36773283380](https://github.com/loftfull/marketplace-scout/actions/runs/36773283380) did not execute any test/build step. Check annotations report failed recent account payments or a spending limit requiring increase. This is an account-side blocker, not a passing CI run. No billing settings were changed.

## Remaining release gate

Obtain a legitimate readable product card in the dedicated no-account profile, then rerun acceptance and inspect exact identity, variant, unconditional price, seller, availability and time. Exercise the separate Ozon validator on an actual discovered Ozon candidate. No CAPTCHA solving, login, IP rotation or weakened TLS was attempted. Restore Actions account eligibility and inspect green Windows/Linux jobs. Unknown shipping/duty remain null until supported evidence and delivery region exist. Docker deployment and public/multi-user hosting were not accepted. See RUNBOOK.md for backup, restart and rollback.
