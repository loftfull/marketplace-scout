# Native connector continuation — 2026-10-01

## Context receipt and authority

APPROVED_DECISION: Vladimir explicitly confirmed `D:\Projects\marketplace-scout`, branch `feat/marketplace-scout-mvp`, PR #1. His latest continuation follows the connector audit and its recommendation to connect SZhukovWork/ozon-mcp and native card/seller tools. Existing public design, verification rules, three marketplaces and local-only deployment remain authority. Existing 2026-09-30 plans and required project documents remain applicable. The separate Obsidian-generated rule files are outside this commit.

VERIFIED_FACT: ru-marketplace-mcp compare_prices is used; yandex_search supplies images; the Ozon validator is only a generic browser wrapper. Native yandex_card/avito_card/avito_seller and SZhukovWork runtime are not called. Last live test: Market discovery worked, cards 403; Ozon 403; Avito IP block. No verified offers. GitHub Actions account eligibility blocks hosted jobs.

## Six audits

- Product: requested collectors must actually execute and expose evidence. More connector names alone do not solve blocked access. Preserve honest unknowns and independent card reopening.
- Architecture: additive native evidence, separate Python environment for incompatible MCP SDK versions; reuse owned Chrome CDP and mandatory public-network egress proxy. Native evidence never grants VERIFIED; contradictory exact-identity/price/seller evidence prevents it.
- Structure: reusable MCP client; source adapter module; isolated Python CDP bridge and pinned installer. Existing image client also calls Market cards. Browser validator and freshness remain shared.
- Technical: specialized upstream is young (one commit, Windows untested), MIT, Python >=3.10, mcp >=2.2,<3 and Playwright >=1.49. Pin source and hash-lock dependencies. Browser bridge replaces launch/state/challenge lifecycle only; no upstream file edits, automatic browser download, stealth, login or challenge solving.
- Design: existing card details disclose provider/tool status and separately labelled observed ordinary/conditional/list prices. No theme/layout replacement. Escape external strings; existing image allowlist.
- Quality: regression tests for wrong SKU/variant, malformed/conditional prices, blocked tools, native/browser conflict, transport cancellation, bridge disconnect not closing owned Chrome. Run lint/type/tests/build/audits and live exact-profile acceptance. No positive claim from fixtures.

## Reuse research and options

- Keep generic readCard: necessary independent verifier but insufficient native product/seller extraction.
- Adapt https://github.com/SZhukovWork/ozon-mcp at commit `414b3470ee6dd6f3197598b2c3c640d5d1601ef3` (2026-09-25, MIT, 0.1.0): selected for search_products/get_product, named prices and seller/region facts. No release/adoption evidence strong enough for production trust; pinned adapter tests and HOLD apply. Separate venv preserves ru runtime. No visual assets copied; CLI has no theme/accessibility impact.
- Reuse https://github.com/Vladimir-Human/ru-marketplace-mcp at existing pinned c17bd36: yandex_card(product_id, include_reviews=false), avito_card(item_id_or_url), avito_seller(seller_id_or_url). Market default variant must match requested variant before joining; Avito seller only by strict card-derived ID.
- Official CDP contract: https://playwright.dev/python/docs/api/class-browsertype#browser-type-connect-over-cdp . Only loopback owned endpoint. Separate context closed after each bounded specialized call; process disconnected without Browser.close. Node cleans newly created contexts after timeout while serial source work owns the browser.
- Replace with paid Apify or seller-account API: no fit for requested anonymous buyer flow and no payment/account authorization. Build another scraper from scratch: rejected because native tools already exist. Community/visual references cannot resolve these exact MCP contracts; no new design pattern is introduced.

## Proposed reversible milestones

1. Critic gate on this proposal, runtime contracts and current code.
2. Install isolated pinned specialized runtime with audited lock; implement CDP lifecycle adapter with bounded/no-bypass behavior.
3. Keep ru discovery priority. If Ozon discovery is blocked, report it and stop that discovery path; attempt specialized discovery only when ru is unavailable/empty without a block. Use specialized get_product on Ozon candidates. Call native cards for Market/Avito, then independent reopen; preserve native evidence and actual tool telemetry.
4. Add diagnostic details, regression tests, live acceptance and recorded evidence. Commit selected files and update PR; no merge.

Compatibility: optional additive native evidence fields; old history remains readable. No fake data, account access, alternative IPs, credentials, paid services or scheduler. Delivery text and prices are evidence only, never inferred shipping/duty totals.

Rollback: revert this slice commit; existing ru runtime and history remain intact. Stop only project-owned processes. The new ignored runtime may remain unused; no recursive deletion required.

## Gate

Need proven; timing now; reuse selected; design fit pass; approval recorded in continuation; rollback ready. Independent critic: GO_WITH_CONDITIONS. Preflight conditions resolved in the implementation contract below. The critic's follow-up became unavailable because its account usage limit was reached; no final post-code review is claimed.

Resolved design conditions: retain ru discovery priority and never retry a blocked source through another provider; override specialized start/new_context/rechallenge/close and terminal handling of401/403/429/redirect/challenge; no upstream launch, browser download, state reuse, stealth or challenge renewal. Each specialized call owns a separate context and process. Await process shutdown then dispose newly created CDP context IDs before another source runs. Native identity/price/seller conflicts prevent VERIFIED; absent native facts never fill browser evidence. These conditions are required regression/acceptance checks, not claims of already-tested behavior. Release remains HOLD pending those checks and independent post-code review.

VERIFIED_FACT after implementation:40 Node tests,3 Python bridge tests, lint/types/build, both dependency audits and browser isolation including an isolated provider context PASS. Actual specialized tools/list and failed live search+cleanup PASS for lifecycle; no positive price/card acceptance. Native Market/Avito calls observed. UI source/history diagnostics verified. Final independent review remains pending due critic usage limit; do not release. Evidence: docs/evidence/2026-10-01-native-connectors.md.

CI follow-up: hosted jobs now execute. Run36819622015 on587b156 passed Ubuntu completely; Windows failed Biome solely on checkout CRLF. Compact audits: product/design/runtime/data unchanged; architecture/structure use standard root .gitattributes; technical evidence is the exact formatter diff; quality requires fresh hosted Windows/Linux pass. Reuse standard Git eol=lf with text=auto (binary detection preserved), no global Git configuration changes or product refactor. Reversible bugfix within the approved CI repair scope; no new feature/architecture gate. Final independent review limitation remains.

VERIFIED_FACT: hosted CI run36819778190 on47fab80 passed Windows and Ubuntu completely. Account eligibility no longer blocks jobs. Evidence docs/evidence/2026-10-01-native-ci.json. Final review and positive live target acceptance remain pending.
