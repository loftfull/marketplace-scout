# Reused terminal and marketplace code

Reviewed 2026-10-01. This is an adaptation of ready components and complete installed upstream modules, not a new marketplace scraper or a new design system. Source installation does not establish live availability.

## Interface and architecture

Tabler [core](https://github.com/tabler/tabler) 1.6.1, MIT, commit `ec33733290bd0f314ca19f6be58bc69a6ab3e4fa`. Adapted vertical dashboard from `shared/layouts/DefaultLayout.astro`, `shared/components/navbar/Sidebar.astro`, `shared/components/layout/PageHeader.astro`, `preview/pages/layout-vertical.astro` and `preview/pages/tables.astro`. Scout uses its navigation/page-wrapper structure, responsive grid, tables, cards, forms, badges, alerts, theme tokens and collapse behavior. Data and accessible native offer dialog are Scout integration code. Astro is a template reference, not an additional application runtime.

Exact `@tabler/core` dependency and integrity are in package-lock.json; prebuild/prestart/predev copy local core assets using scripts/vendor-ui.mjs. MIT notice is in docs/licenses/Tabler-MIT.txt and served with vendor assets. No CDN fonts, telemetry, demonstration datasets or separately licensed chart packages. public/app.css contains integration rules, not a second design system.

Existing Fastify API, MCP SDK lifecycle and ru-marketplace shared connector runtime are retained. UI sections are Search, History, Research and Connectors. Fixed research registry separates native capabilities from the independent price-verification pipeline. This avoids adding another storage/queue/backend system solely to import a dashboard.

## Whole native modules and selected capabilities

| Upstream / license / exact revision | Installation and reused code | Active use |
|---|---|---|
| [Vladimir-Human/ru-marketplace-mcp](https://github.com/Vladimir-Human/ru-marketplace-mcp), MIT, `c17bd360de60780a9e8d3690288b70181bd07355` | .runtime/ru-marketplace-mcp; frozen workspace packages, shared runtime, models, parsers, cache/error handling. Guarded transport/lifecycle adapters stay outside upstream code. | Ozon primary discovery, Avito card/seller, all eight WB tools, Market exact-variant source images. |
| [SZhukovWork/yandex-market-mcp](https://github.com/SZhukovWork/yandex-market-mcp), MIT, `92bb4dfbc3b87d0c0f77aa7ede09faed7e661aa7` | .runtime/yandex-market-mcp; whole native search/product/offer/review/question/seller/comparison parser and tools. scripts/yandex-http.py replaces only transport lifecycle. | Main Market discovery/native card; seven research tools. |
| [SZhukovWork/ozon-mcp](https://github.com/SZhukovWork/ozon-mcp), MIT, `414b3470ee6dd6f3197598b2c3c640d5d1601ef3` | .runtime/ozon-mcp; whole native parser/client/server. scripts/ozon-cdp.py uses owned CDP only, no state import/challenge renewal. | Separate native Ozon validator, nonblocked fallback discovery, four research tools. |

Installation: npm run runtime:setup / runtime:yandex / runtime:ozon. Existing installers enforce pins and security overlays. Clones remain ignored and reproducible; copying them again into src would duplicate code and obscure provenance. No upstream parsing modules were rewritten.

Inventory contains 27 consumer tools; actual tools/list was obtained from six installed servers. [Source inventory](evidence/2026-10-01-terminal-tool-inventory.json) and [actual protocol schemas](evidence/2026-10-01-terminal-tool-contracts.json) support this mapping:

| Selected provider | Tools exposed through Research |
|---|---|
| Specialized Market (7) | search_products, get_product, get_offers, get_reviews, get_questions, get_seller, compare_products |
| Specialized Ozon (4) | search_products, get_product, get_reviews, compare_products |
| ru Wildberries (8) | wb_search, wb_card, wb_root_info, wb_reviews, wb_questions, wb_seller, wb_categories, wb_category_products |
| ru Avito (2) | avito_card, avito_seller |

Remaining six: ru yandex_search is used for source images; ru yandex_card is superseded by specialized Market; ru ozon_search/card/reviews duplicate selected specialized research tools (ru search still participates in primary discovery); native avito_search is not exposed until a trustworthy numeric city mapping exists. Existing city-specific Avito browser discovery remains active. Operator selfchecks/CLI and unrelated marketplaces are not buyer research tools.

WB reviews/questions are model-group observations (imtID), not proof about one nmID variant. Ozon reviews use SKU scope; Market tools retain their own card/variant scope. Seller legal POST is deliberately disabled by the guarded Market transport; unavailable legal details must remain unavailable.

## Verified bounds

Research uses fixed allowlisted operations/fields, numeric IDs, at most three comparison IDs, bounded page/count/deadline/response size, plain-text output and buyer identity/contact redaction. It shares the search lock through cleanup. A blocked Ozon operation latches across browser restart and optional upstream exception handling, rejects partial MCP outcomes and enables source cooldown. Native research cannot write price history or grant VERIFIED. Requested city is displayed separately from observed region.

Correction of the previous city audit: wb_search **accepts dest as input**; its output omits dest. Scout passes the validated selected-city destination and rereads candidate IDs through wb_card. Earlier contrary prose is superseded. A successful geo mapping and live regional price still require evidence.

## Alternatives reviewed

- [CoreUI free](https://github.com/coreui/coreui-free-bootstrap-admin-template): MIT Bootstrap template; compatible alternative, but no advantage over selected Tabler components.
- [Refine](https://github.com/refinedev/refine): MIT React application framework; substantial React/data-provider migration without stronger marketplace extraction. Not imported.
- [PriceBuddy](https://github.com/jez500/pricebuddy): ready price tracking product, PHP/Laravel stack. Current LICENSE.md is GPL-3.0 WITH MODIFICATIONS and forbids commercial incorporation; no code copied or license assumptions made.
- [changedetection.io](https://github.com/dgtlmoon/changedetection.io): Apache-2.0 URL monitoring; useful operational reference, but no equivalent regional discovery/SKU verification. No second worker/database deployed.

Research and maintenance snapshot, six audits, critic conditions, migration and rollback: [approved plan](change-plans/2026-10-01-ready-terminal.md). Selection is based on fit/license/tests, not a claim that stars prove reliability or that every GitHub repository has been inspected.

Continuation: [Candidate comparison report](CANDIDATE_COMPARISON.md) records the 19-candidate decision matrix and native Market/Ozon comparison table. Its presentation adapts pinned Tabler shared/components/demo/Table.astro; no marketplace parser or dependency is added. Market response city uses the upstream object field city.name. Selected city and response city remain distinct, and neither establishes each card's region.

Market identity correction: the automatic get_product caller now selects upstream card_id_from's exact numeric-string branch instead of its truncating URL branch. Scout validates seller-card path/ID/variant first; unsupported long IDs reach upstream unchanged and fail before HTTP. This adapts the existing tool without modifying its parser or claiming expanded ID support. Python integration regression calls the pinned upstream get_product directly with a blocked fetch sentinel.
