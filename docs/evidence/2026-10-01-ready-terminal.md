# Ready terminal acceptance — 2026-10-01

Canonical D:\Projects\marketplace-scout, feat/marketplace-scout-mvp, PR1. Implementation/review GO; positive live price acceptance HOLD.

## Code reuse and deterministic checks

- Tabler1.6.1 exact npm install, original MIT notice, locally copied core assets and adapted upstream dashboard/component structure. Source revisions/alternatives/capability selection: ../REUSE.md.
- 27 consumer tools inspected from pinned source; real tools/list against six installed MCP servers saved in terminal-tool-contracts.json.21 operations exposed; duplicates/unsupported city mapping explicitly documented.
- npm lint, typecheck,53 Node tests, build PASS; npm audit0 vulnerabilities. Ozon bridge4 Python tests PASS.
- Selected upstream offline suites: specialized Market tests/test_parse.py72PASS, specialized Ozon tests/test_parse.py68PASS, ruWB tests/test_helpers.py114PASS, ruAvito tests/test_server.py33PASS. Windows default cp1251 initially caused parser-fixture decode failures; PYTHONUTF8=1 fixes these, and child process allowlist now sets it. Test-only pytest8.4.2/pytest-asyncio1.2.0 installed under ignored .runtime/test-support, not production locks. These are287 selected fixture tests, not all upstream suites or live extraction proof.
- Independent critic found and closed four issues: Ozon swallowed optional block/partial outcome, open-dialog TTL, WB user identity leakage, stale request finalizer. Critic independently ran8 relevant tests and traced actual SDK dispatch to patched call_tool: final GO, no scoped blockers.

## Actual UI checks

- Tabler light desktop: separate navigation, current/discovery filters, paginated42-row real history, source images/placeholders and requested/observed city. History Next/Previous and offer-to-research SKU/city prefill PASS.
- Isolated8898 fixture: opened VERIFIED100 RUB dialog; left open across15-minute TTL; observed STALE and “Не подтверждена” with no current price. Escape closes dialog. Fixture stopped; never writes app history.
- Narrow390 viewport: mobile navigation expands/collapses, search form and2-column metrics fit; dark-theme toggle works. Captured full-width screenshot using supported browser CDP because browser-scoped viewport control timed out; temporary metrics cleared afterwards. No product/browser protection changed.
- Real research UI invocation: Wildberries wb_categories(top, max_depth=1) returned35 catalog records, healthy=true, host static-basket-01.wbbasket.ru at10:30:14 Moscow time. It remained a labelled observation, not a verified price; no history record created. Visible result saved in terminal-wb-categories.txt.

## Final live target run

Full response: [terminal-live-acceptance.json](2026-10-01-terminal-live-acceptance.json), target RedmiBook Pro16 2026 / Ultra5 338H /32GB/1TB, requested Voronezh, completed10:41:08 Moscow time. Four sources attempted;3 candidates,0 independent browser reopens,0 VERIFIED.

- Market specialized search and ru image search succeeded; first native product call blocked, subsequent card/browser calls stopped. This run's three candidates conflict with requested CPU/configuration and report Moscow; ordinary discovery170208/140839/142283 RUB excluded from comparison. They are observations, not current Voronezh prices.
- Ozon primary ru discovery reported block plus CDP timeout; no fallback after block.
- Avito Voronezh discovery reported IP restriction.
- WB regional mapping timed out at12s; no wb_search/wb_card invocation and no default destination. Successful categories do not prove regional prices.

Corrected earlier documentation: wb_search input accepts dest; output omits it. Validated city destination is passed and wb_card reread retained. Historical city-run logs were not rewritten.

## Remaining limits / rollback

Most native research operations are protocol/schema and fixture validated but not positively exercised against a live accessible target. No claim that all21 are live proven. Market seller legal details can remain unavailable; WB group reviews are not variant-specific. Readable region/variant/seller/ordinary-price/card evidence is required to close live HOLD. No CAPTCHA/login/IP rotation, merge or deployment. Preserve .data/.runtime, revert terminal commit, npm ci/build and restart to roll back.
