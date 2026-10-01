# Third-party connectors: provenance, research and actual routing

Audit date:2026-10-01. Canonical checkout:D:\Projects\marketplace-scout. Eight GitHub repository searches (MCP and parser for Yandex Market, Avito, Ozon and Wildberries), up to8 results each, followed by relevant primary repository/source/license/release/CI inspection. This is not an exhaustive claim about every GitHub repository. Repository popularity and a README success claim do not prove live extraction in our environment.

## Used code (not merely linked recommendations)

| Repository / license | Pin / local installation | Actual application route |
|---|---|---|
| [Vladimir-Human/ru-marketplace-mcp](https://github.com/Vladimir-Human/ru-marketplace-mcp), MIT | c17bd360de60780a9e8d3690288b70181bd07355; .runtime/ru-marketplace-mcp; scripts/runtime-setup.ps1, frozen uv plus security overlay | Ozon compare_prices; Avito avito_card and identified avito_seller; WB wb_search/wb_card with city-specific dest; Market yandex_search only for image enrichment after successful specialized search, strict card+variant join |
| [SZhukovWork/yandex-market-mcp](https://github.com/SZhukovWork/yandex-market-mcp), MIT | 92bb4dfbc3b87d0c0f77aa7ede09faed7e661aa7; .runtime/yandex-market-mcp; scripts/yandex-runtime-setup.ps1;31 hash-locked packages | Upfront Market search_products/get_product; price without Pay card, Pay-card price, reference price and observed city. scripts/yandex-http.py replaces network lifecycle only, importing pinned upstream parser/tools. No upstream source edits |
| [SZhukovWork/ozon-mcp](https://github.com/SZhukovWork/ozon-mcp), MIT | 414b3470ee6dd6f3197598b2c3c640d5d1601ef3; .runtime/ozon-mcp;32 hash-locked packages | get_product on Ozon candidates, search_products only after nonblocked empty/unavailable primary discovery. Owned CDP lifecycle in scripts/ozon-cdp.py; no personal account or saved state |

Source is installed under ignored runtime folders, not vendored into the application or uploaded with browser profiles. Licenses remain in each pinned checkout. The UI/API catalog exposes repository, license, exact pin and role. Per-search tool telemetry reports actual invocation and outcome; catalog presence is not evidence that a tool was reached.

## Candidate comparison

| Candidate | Current health / license checked | Decision and cost |
|---|---|---|
| ru-marketplace-mcp | MIT;128 stars; repository pushed2026-09-28; v2.4.2 release2026-09-19; latest inspected workflow action_required | Reuse installed pin; shared Python runtime and existing guards. WB already present but not previously wired to Scout. Low integration cost; do not auto-upgrade broad monorepo |
| SZhukovWork/yandex-market-mcp | MIT;1 commit,0 stars,0 issues;2026-09-25; CI success on selected pin; no published release returned | Adapt. Narrow fit for price ambiguity and observed region. New/low adoption: source review, strict schema and transport tests required. Separate31-package environment, moderate maintenance cost |
| SZhukovWork/ozon-mcp | MIT;0 stars,0 issues;2026-09-25 | Retain installed independent validator rather than replace lifecycle. Previous live search initialized but site did not respond; no positive acceptance claim |
| [neosheps/ozon-shopping-mcp](https://github.com/neosheps/ozon-shopping-mcp) | MIT;14 stars,6 issues; pushed2026-09-25; CI success | Relevant Node24 alternative, but setup/session lifecycle differs and duplicates existing validator. Defer replacement; no evidence it removes regional/access limits. Its documented alpha buyer endpoints remain unstable |
| [eduard256/ozon-mcp-server](https://github.com/eduard256/ozon-mcp-server) |70 stars,5 issues; pushed2026-06-06; API license null | Do not copy without explicit reusable license. Separate Chrome lifecycle and wrappers add cost without verified benefit |
| [Duff89/parser_avito](https://github.com/Duff89/parser_avito) |753 stars,42 issues; pushed2026-09-30; API license null and root listing no LICENSE | Operational reference only, no code copied. Full monitoring app/Telegram/cookie flow is larger than read-only Scout adapter |
| [AlexButiev/avito-personal-mcp](https://github.com/AlexButiev/avito-personal-mcp) | MIT;2 stars,1 issue; pushed2026-09-05 | Requires authenticated personal browser; outside account-free scope. Retain ru native card collector with city-path discovery |
| [kirillignatyev/wildberries-parser-in-python](https://github.com/kirillignatyev/wildberries-parser-in-python) | MIT;29 stars; archived, last code push2023-10-13 | Old spreadsheet script, reject replacement; existing maintained ru WB fits SDK and runtime |
| [Hacker32Bit/WBParser](https://github.com/Hacker32Bit/WBParser) |8 commits; documented geo-info/dest mapping; reuse license not established | Learn endpoint semantics only; no copied code. Scout obtains mapping live and validates it, never guesses a city code |
| [ilyautov/yandex-market-mcp-ru](https://github.com/ilyautov/yandex-market-mcp-ru), [elchin92/avito-mcp](https://github.com/elchin92/avito-mcp), [MASTER116/ozon-mcp-server](https://github.com/MASTER116/ozon-mcp-server), [Sellematics/wildberries-mcp](https://github.com/Sellematics/wildberries-mcp) | Seller/account API tools surfaced in current search | Wrong product boundary: seller credentials/management rather than anonymous retail price verification. Not installed |
| neuratechcompany-ops/kettu-marketplace-mcp | Search-index listing exists; current GitHub API returned404 | Not an installable verified source; do not rely on cached listing |

All reused code runs locally/server-side, with bounded calls and escaped UI output. No UI themes/assets are imported; native select preserves accessibility and existing visual design. No extra paid provider, auth, migration or database. Supply-chain checks cover pinned sources, locks and advisories; they cannot guarantee unknown-vulnerability absence. Rollback reverts this slice and leaves old history readable and new runtime unused.

## City and price contract

Voronezh is the default requested city; Moscow and Saint Petersburg are explicit alternatives. Avito searches the selected city path, never `/all`/Moscow silently. Ozon/Market anonymous city can be determined by IP/session; selecting Scout city is a verification requirement, not a claim that the marketplace accepted an address. Reopened card region must corroborate the selected city before VERIFIED. Native conflicting city prevents verification. Unknown legacy city stays unknown.

WB public `get-geo-info` must return city and coordinates associated with its destination. No default dest fallback. The installed `wb_search` schema has no destination parameter, so its prices are discarded: search supplies candidate IDs only. Each ID is reread with `wb_card` using the resolved destination; card verification repeats that destination and rejects missing/conflicting response destinations. Its native schema currently collapses sizes; normalized RUB price is kept as unknown-condition discovery evidence, never promoted or divided by100 again. Missing/blocked geo means those tools are not reached; this is visible in source stages. HTTP denial or an HTML wall stops the adapter before the upstream legacy endpoint fallback.

Market upstream's price semantics and city limitations are described in its [primary README](https://github.com/SZhukovWork/yandex-market-mcp#why-another-yandex-market-server). Ordinary/Pay/reference fields stay separate. Older ru values cannot be reclassified from a field name or guessed discount. Incompatible discovery titles are outside price comparison. Discovery and native observations never grant VERIFIED.

Actual live outcomes and validation are recorded in the evidence report for this slice after execution. No result is inferred from installation or tests.
