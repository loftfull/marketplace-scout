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

Xiaomi Book in a search title is not silently treated as RedmiBook. A wrong-generation candidate also remains UNVERIFIED when the reopened card is blocked; MISMATCH requires actual observed card data. The historical field cardsReopened counts evidence-bearing browser responses, not readable cards or every attempted navigation.

Current acceptance summaries (2026-10-01 identity correction) replace that ambiguous field with browserResponses and liveCardResponses. The first counts browser-card evidence, including errors/challenges; the second requires live=true and HTTP 2xx. Neither establishes correct SKU, selected city, ordinary price or seller; VERIFIED remains the independent full gate. Timeout/skipped attempts without evidence are not inferable from these counters. Historical JSON evidence is retained unchanged.

The later UI-triggered run completed at 20:34:11 UTC with the same three candidates and zero confirmed offers. Search button loading/re-enable, source failures, canonical links, unknown landed cost, history append and history refresh were inspected. Desktop width1280 and mobile390 had no horizontal overflow. Browser console contained no warning/error entries. Screenshots retained in the task outputs.

## Generic Redmi configuration query — 2026-10-14

User query: `Ноутбук Redmi 2026 32Гб/1Тб`, selected city Voronezh. Profile normalized to Xiaomi / RedmiBook family / 2026 / 32 GB RAM / 1024 GB SSD; no CPU or model suffix was assumed. Live response: [machine-readable evidence](evidence/2026-10-14-redmi-query-live.json).

Yandex Market discovery returned three matching-family candidates. Their current prices were not independently confirmed; all remain UNVERIFIED. A reopened card returned HTTP 403; Yandex discovery region was Moscow while the requested city was Voronezh. Ozon returned HTTP 403, Avito reported an IP restriction, and Wildberries city mapping remained unconfirmed. Result: zero VERIFIED offers, `complete=false`, landed totals unknown. The observed discovery prices are not current-price evidence.

Parser and application checks for this query slice passed: 70/70 automated tests, scoped Biome, TypeScript typecheck, build, and npm high-severity audit (0 advisories). The full-tree `npm run lint` still encounters access-denied errors when Biome walks protected `.runtime` cache directories; scoped source checks pass.

## Wildberries city-resolution correction — 2026-10-14

Root cause: `get-geo-info` returned HTTP 200 with the exact requested Voronezh coordinates and a valid `xinfo.dest`, but its current response did not include a city-name field. The adapter incorrectly required that absent field and blocked before `wb_search`. It now validates the selected city's exact coordinates, parses the unique destination, and confirms it appears in `destinations` when that list is provided. This resolved Voronezh to `dest=12358283`; see [sanitized evidence](evidence/2026-10-14-wb-geo-resolution-fix.json).

The subsequent Wildberries search itself returned `blocked` and no candidates. The fix removes the false geo-resolution error; it does not claim a live WB product/price result. The source stage is now explicit in the app instead of reporting `city_mapping_unconfirmed` for this response shape.

## Remaining marketplace access blocks — 2026-10-14

- **Yandex Market:** search/discovery works; independent card reopen returns HTTP 403. Keep the discovered rows UNVERIFIED; this is not a query-parser issue.
- **Ozon:** the current discovery path returns HTTP 403.
- **Avito:** city search is refused by an IP restriction.
- **Wildberries:** city resolution now works, but the regional catalog-search tool is blocked before returning candidates.

Research found no official anonymous retail API that would replace these failed buyer-side reads. The official Yandex integration is for a seller's Market cabinet/catalog/prices ([Market API overview](https://partner.market.yandex.ru/integrations/)); the WB API requires registration in a seller account and an API token ([WB API getting started](https://dev.wildberries.ru/en/docs/openapi/api-information)); the Ozon API route inspected is the Seller API and requires seller `Client-Id`/`Api-Key` headers ([Ozon Seller API example](https://www.postman.com/googlesheets/ozon-seller-api/request/dr9j4ap/)). Avito's official [Business API catalog](https://developers.avito.ru/api-catalog/) likewise documents business/account integrations, not a public anonymous marketplace-wide buyer search contract. These seller/account interfaces cannot be substituted for comparing other sellers' listings.

A generic scraper or a second browser extractor would still reach the same public site endpoints from the same network and would not resolve an HTTP 403/IP refusal. The project therefore stops on those source blocks and does not retry with a proxy, IP change, imported session or challenge solver. A future remedy requires a marketplace-approved buyer/search feed or an explicitly authorized licensed data provider whose output can be independently validated against a live product, region and ordinary price.

## Repeated source failures — 2026-10-14

Root cause: discovery blocks already stopped that source, but a card-level HTTP 403 did not change the source outcome. The API could therefore report a successful source/complete search after verification had failed. There was also no persisted shared pause for Avito/Wildberries, so another search could repeat a known denied request.

Fix: `.runtime/source-circuit.json` now persists each blocked/error/timeout source. Searches skip paused sources before connector calls; invalid state fails closed. Card blocks, card read errors and timeouts update the outcome and pause the source. The UI shows the recorded reason and exposes one explicit per-source retry action; using it clears only that source and starts one user-requested search. Current observed blocks were seeded from the recorded live evidence so the next ordinary search does not reissue them.

Regression checks prove persistence across restart, fail-closed handling for corrupt state, accurate `complete=false` behavior, pause after blocked/error card reads, no subsequent calls while paused, and explicit retry behavior. Local API and browser journey checks showed all four observed sources paused and zero marketplace requests. The remaining access blocks are site/network refusals; software cannot guarantee those sites will allow a future explicitly requested retry.

ORCA UI: Chromium and Firefox passed at mobile/tablet/desktop, with no overflow or accessibility violations. Root cause of the three WebKit report errors is confirmed: ORCA captures screenshots with Playwright, which injects an inline stylesheet; WebKit blocks it under the app's strict `style-src 'self'` policy. A standalone WebKit screenshot reproduces a `style-src-elem` violation after navigation and accessibility analysis pass without CSP events. This is a test-runner/CSP interaction, not an app stylesheet failure. Keep the application CSP strict; do not add `unsafe-inline` just to suppress this runner-generated error.

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
