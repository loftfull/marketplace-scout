# Test plan

| Layer | Checks |
|---|---|
| Unit | Exact/missing/conflicting year/CPU/RAM/SSD; Yandex variant redirect; invalid/future/expired timestamps; null landed components; unsafe URLs; source normalization |
| Integration | Actual MCP SDK initialize/tool call/child exit/reconnect; concurrent history writes and corrupt-file preservation; Fastify Windows static path, Host/Origin validation and API input |
| Browser security | Real Chrome redirected and unguarded-page requests to private trap receive zero requests; DOM extraction through tsx; ambiguous widgets cannot corroborate price |
| Live acceptance | Three actual sources, discovery IDs/URLs, independent card reopening and exact stage/status, no fixtures; blocks preserved |
| UI | Search loading/success/failure, accessible form, history refresh, links/status/cost, responsive desktop/mobile |
| Supply chain | npm audit, Python pip-audit, uv pip check; source pinned + frozen lock + hash-locked security patch overlay |

Run npm run lint, npm run typecheck, npm test, npm run build. Browser security: stop running Scout then npm run test:browser. Live acceptance: npm start then npm run acceptance. Fixture server/HTML and synthetic prices are confined to tests/security harness; they never write application history.

CI runs deterministic checks on Windows and Linux, Node 24. Live marketplace checks are manual because website access restrictions and prices vary. Passing CI does not imply a live VERIFIED offer.
