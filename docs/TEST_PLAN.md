# Test plan

| Layer | Checks |
|---|---|
| Unit | Exact/missing/conflicting year/CPU/RAM/SSD; Yandex variant redirect; invalid/future/expired timestamps; null landed components; unsafe URLs; source normalization |
| Integration | Actual MCP SDK initialize/tool call/child exit/reconnect; concurrent history writes and corrupt-file preservation; Fastify Windows static path, Host/Origin validation and API input |
| Browser security | Real Chrome redirected and unguarded-page requests to private trap receive zero requests; DOM extraction through tsx; ambiguous widgets cannot corroborate price |
| Live acceptance | Four source attempts, requested/observed city, discovery IDs/URLs, independent card reopening and exact stage/status, no fixtures; blocks preserved |
| UI | Search loading/success/failure, accessible form, history refresh, links/status/cost, responsive desktop/mobile |
| Supply chain | npm audit, Python pip-audit, uv pip check; source pinned + frozen lock + hash-locked security patch overlay |

Run npm run lint, npm run typecheck, npm test, npm run build. Browser security: stop running Scout then npm run test:browser. Live acceptance: npm start then npm run acceptance. Fixture server/HTML and synthetic prices are confined to tests/security harness; they never write application history.

CI runs deterministic checks on Windows and Linux, Node 24. Live marketplace checks are manual because website access restrictions and prices vary. Passing CI does not imply a live VERIFIED offer.

City/provider slice: tests/cities.test.ts covers defaults, invalid city, immutable history, A→B→A late response, missing/conflicting region, legacy evidence, conditional/reference prices, destination mismatch, unrelated titles and stop-after-block. Optional Python commands: `.runtime/yandex-market-mcp/.venv/Scripts/python.exe tests/yandex_bridge_test.py` (3 transport tests), `.runtime/ru-marketplace-mcp/.venv/Scripts/python.exe tests/wb_guard_test.py` (2 terminal-response tests). `node --import tsx scripts/provider-probe.mjs` checks installed tool schemas without marketplace price requests.

Image/filter continuation: tests/presentation.test.ts covers unsafe image URLs, ambiguous/missing variant joins, retained provenance, inclusive ranges, unknown/conditional/stale prices and invalid input. Protocol tests cover deadline cancellation during initialization and tool execution. Browser fixture: node tests/fixtures/ui-server.mjs serves isolated synthetic history on127.0.0.1:8898; observe VERIFIED becoming STALE without refresh and image fallback. Never use fixture server as normal Scout. Real UI evidence: docs/evidence/2026-10-01-images-ui.md.

Native continuation: tests/native.test.ts covers provider identity/currency joins, named prices, conditional-only discovery, malformed money, seller/spec/availability conflicts and no promotion of blocked cards. Run `.runtime/ozon-mcp/.venv/Scripts/python.exe tests/ozon_bridge_test.py` for three lifecycle tests. `npm run probe:ozon` (Scout stopped) validates actual MCP2 tools/list, separately probes the target query and checks no leaked context/shared-browser shutdown. These Python/live checks require the optional installed runtime and are not part of hosted Node-only CI. Browser isolation harness also tests a new isolated provider context.
