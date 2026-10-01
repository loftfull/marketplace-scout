# City-aware prices and connector reuse — 2026-10-01

Canonical root: D:\Projects\marketplace-scout. Branch: feat/marketplace-scout-mvp, PR1. No demo prices, account sessions, purchases, IP rotation or challenge solving.

## Actual execution

Installed/pinned SZhukovWork/yandex-market-mcp, adapted its HTTP lifecycle and reused its parser/tool code. Retained separate SZhukovWork/ozon-mcp validator and installed ru-marketplace-mcp; wired ru Wildberries tools. Provenance, candidate research and licensing: ../CONNECTORS.md. Actual tools/list on both new routes passed at06:23:26Z; schemas are in 2026-10-01-city-provider-contracts.json. This proves startup/contracts, not live prices.

Initial real search completed06:18:10Z. Market's price-ascending search returned phones/monitor, ordinary/Pay/reference prices and observed Moscow despite requested Voronezh. First card was blocked, following cooldown errors incorrectly allowed two browser attempts. Raw evidence preserved in 2026-10-01-city-initial-live.json. Fixes switch upfront sorting to popular, reject unrelated model titles, exclude conflicting specifications/regions from comparison, classify cooldown as blocked and stop subsequent card requests after denial.

Final real search completed **2026-10-01T06:34:01.485Z (09:34 Moscow)**. Exact query: RedmiBook Pro16 2026 / Ultra5 338H /32GB/1TB, requested Voronezh. Evidence: 2026-10-01-city-final-live.json.

| Source | Reached stage and evidence | Limit |
|---|---|---|
| Yandex Market | Specialized search_products succeeded; ru yandex_search image enrichment succeeded. Three laptop candidates including exact338H/2026/32/1TB. Its ordinary161218RUB and Pay156381RUB were separately observed for Moscow | Prices excluded from Voronezh comparison. One get_product blocked; no further card/browser requests. All current priceRub=null, all UNVERIFIED |
| Ozon | Actual ru compare_prices call completed with embedded blocked-source outcome | No accepted candidate; separate get_product was not reached |
| Avito | Browser opened /voronezh/noutbuki with target query | IP restriction; native card/seller tools not reached |
| Wildberries | Selected-city geo resolution attempted for12s | Timeout; wb_search/wb_card not reached. No assumed/default destination |

Final count:3 discovered candidates,0 independent browser card reopens,0 VERIFIED. Two alternative CPUs retained as explicitly conflicting observations, excluded from comparison. These are search observations only; no current offer, seller, stock or Voronezh price is confirmed. Repeated search happened after the previous cooldown naturally expired; persisted blocking state was not deleted.

WB region mapping success/response shape and downstream live regional card extraction remain unproven. Existing wb_search tool has no dest input; implementation discards its prices and rereads IDs through wb_card using validated dest. Tests cover this contract but do not replace live proof.

## Validation

-49 Node tests pass; lint, typecheck and build pass; npm audit reports0 vulnerabilities.
-3 Yandex Python transport tests and2 WB terminal-denial/HTML-wall tests pass.
-31-package pinned Yandex environment installs, uv pip check passes, pip-audit reports0 known vulnerabilities. Earlier installed Ozon/ru audit evidence remains in their respective reports.
-Real Chrome isolation/security harness passes: private destinations and unsafe shared/isolated-context navigation are denied; ambiguous page widgets cannot verify.
-Actual Market/WB MCP startup/tool schemas pass independently from marketplace requests.
-UI: Voronezh default, Moscow→Voronezh selection, result clearing and visible repository/license/pin/role catalog verified in the real local app. Existing price filters remain present. A→B→A late-response regression passes. Screenshot retained in task outputs/city-marketplace-result.jpg.
-One full test run initially missed the second history row; isolated reproduction and repeated full48-test suite passed. Added explicit second-search HTTP assertion for clearer future failure diagnosis; no storage rewrite was made on speculation.

Independent critic closed variant identity/WB destination findings, then found and closed a verify-exception path that skipped region/spec conflicts. The safe unavailable observation now passes through assess; independent9/9 city tests passed and final scoped verdict is GO. The final live run preceded this error-path hardening and removal of unsupported WB search dest; both final deltas were tested deterministically. Hosted CI results are recorded separately after push. Positive live target verification remains HOLD regardless of those checks. Rollback: stop owned app processes, preserve .data/.runtime, revert this slice and rebuild; do not rewrite historical observations or clear site cooldowns.


## Superseding correction — full tool inventory, 2026-10-01

The earlier statements above that wb_search has no dest input were incorrect. Source inspection and actual tools/list confirm dest is accepted as input; only the response omits it. The ready-terminal change restores validated city destination input and retains wb_card regional reread. Historical live evidence above remains unchanged: that run stopped at geo resolution and never reached wb_search. See REUSE.md and terminal-tool-contracts.json.
