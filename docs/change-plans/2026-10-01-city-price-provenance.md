# City, price provenance and four-source connector continuation

## Context receipt
Project marketplace-scout, canonical D:\Projects\marketplace-scout, continuation of PR1 / feat/marketplace-scout-mvp. User explicitly requests city selection (Voronezh default), incorrect-price repair, renewed GitHub research and actual adapted connector use including Wildberries. Existing Fastify/TypeScript/MCP/CDP architecture, account-free operation and original UI remain authority. Prior scope's three-source restriction is superseded only for the requested WB addition. No purchases, accounts, paid services, challenge solving, IP rotation, merge or deployment. Current head before slice:8c159a7; previous CI passed; positive target price acceptance remains HOLD. Registry's billing blocker is stale (superseded by recorded CI).

## Six audits
- Product: incorrect price comparison is material. Stored Market discoveries include245000/306365/142283 RUB with no confirmed card price; some titles are other CPUs/models. City was null in API and Avito defaulted to Moscow. No evidence establishes a Voronezh price.
- Architecture: snapshot validated city per request, additive requested/observed region and discovery price-kind fields, retain immutable history. Independent card evidence remains the verification authority. Native data cannot grant VERIFIED.
- Structure: small city module and source-specific adapters; reuse existing SDK, normalization, UI cards, tests and runtime setup. Provider catalog makes repository/license/pin/routing visible.
- Technical: ru compare has no city parameter; WB accepts dest; Avito accepts numeric location_id but unverified city IDs must not be guessed. Specialized Market returns page region and proper Pay/ordinary split. Market city is IP-derived, not a supported anonymous city setter.
- Design: native labelled city select, Voronezh default, requested/observed city on existing cards, existing details for repository provenance. Keyboard/mobile support; clear previous-city results and discard late responses. No redesign/assets.
- Quality: regression tests city validation/default/snapshot/late responses, missing/conflicting/legacy region, price kind, exact identity, WB rubles/dest, URL boundaries and guarded transport; lint/types/build/tests/audits, live four-source attempt, UI verification and independent review.

## Reuse / alternatives
Research used eight GitHub repository searches (MCP/parser for four sources, up to8 results each), current repository metadata/licenses/releases/CI and primary source inspection. This is a broad search, not a claim to inspect all GitHub. See docs/CONNECTORS.md for candidate decisions.
Keep-only misses city and WB and retains ambiguous Market pricing. Selected: adapt installed MIT ru WB tools; retain ru Ozon and separate pinned MIT Ozon validator; use ru Avito cards with city-path browser discovery; add MIT SZhukovWork/yandex-market-mcp as upfront Market provider. Replacing all sources with seller APIs requires account credentials and cannot solve public buyer search. From-scratch scraping rejected: ready parsers fit; only boundary glue is new. Material layout patterns reviewed; existing UI/native select fits without imported assets. StackOverflow operational evidence is research only, never code or technical authority.

## Independent critic gate / conditions resolved in design
Critic /root/critic returned GO_WITH_CONDITIONS, then GO for implementation once the following contracts are recorded here. All are required acceptance checks:
1. Requested city is immutable per request. Observed region must come from the same card/price. URL/env/query echoes never confirm city. Missing/conflicting native/browser city forbids VERIFIED. Legacy city is unknown.
2. Clear results on city changes and reject late previous-city responses; retain each history observation's original requested city.
3. Routing is upfront, never a retry cascade after blocks. Market adapter uses ordinary fixed-host HTTPS with public DNS pinning, TLS validation, bounded body/time, no impersonation, no saved accounts;403/429/redirect/challenge terminal with persistent upstream cooldown retained.
4. WB geo uses fixed HTTPS host, no redirects, public pinned DNS, bounded body/deadline; destination accepted only with returned city/coordinate association. Actual tools/list showed wb_search has no dest argument: use only its IDs and reread each with wb_card using the same resolved destination used at verification. Reject absent/conflicting response destinations. Failure stops WB, never substitutes Moscow.
5. Separate ordinary/conditional/reference prices. Legacy ru Market discovery provenance unknown. WB normalized price_rub is already RUB, no second /100; size-ambiguous price remains unknown-kind and cannot corroborate ordinary card price.

Need proven; timing now; reuse selected; design fit pass; approval recorded in latest request; critic GO under recorded contracts; rollback ready.

## Execution / rollback
1. Implement additive city and price contracts/tests; native city select/provenance.
2. Adapt/install pinned Market runtime, route Market upfront; integrate existing WB tools and geo; preserve Ozon/Avito validation.
3. Validate deterministic checks, audits, actual source calls and UI; record candid blocked stages; independent review; commit/push PR1.
Rollback: stop owned Scout processes, preserve .data and runtime, revert slice commits and rebuild. Old history remains readable; do not delete profiles or rewrite observations. New ignored runtime may remain unused.

## Completion evidence and final critic

Implemented requested-city snapshot/UI, separate observed regions, ordinary/Pay/reference provenance, provider catalog, pinned specialized Market adapter and guarded WB route. Actual tools/list schemas required dropping unsupported dest from wb_search and rereading its IDs with regional wb_card. Exact contracts/evidence: ../CONNECTORS.md and ../evidence/2026-10-01-city-connectors.md.

Independent critic closed URL/variant contradiction and WB destination findings, then reviewed live-log corrections. Final P2 found: the verify-exception branch skipped region/spec checks. Fixed by passing a cleared unavailable observation through assess; regression covers wrong city+CPU+exception and null comparison prices. Critic independently ran9 city tests, all passed, and returned **GO** for the reviewed slice. No open concrete blocking review findings. Positive live target verification and WB geo/card acceptance remain **HOLD**.

Final source run06:34Z:3 Market candidates including requested configuration,0 browser reopens,0 VERIFIED. Market observed Moscow; first native card blocked and subsequent requests stopped. Ozon/Avito blocked; WB geo timed out before price tools. Live evidence was collected before the final exception-branch hardening; that branch and removal of unsupported WB search argument were verified deterministically, without repeating blocked-site requests.
