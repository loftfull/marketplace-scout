# Native connector evidence — 2026-10-01

Actual app acceptance, completed08:12:56 Moscow: `2026-10-01-native-live.json`. Six candidates, six independent reopens, zero VERIFIED. No fixtures or invented prices.

| Tool/path | Implementation and actual observation |
|---|---|
| ru compare_prices | Called for all3 sources; returned Market candidates, blocked Ozon, empty Avito |
| yandex_search | Called for source image enrichment |
| yandex_card | Called3 times; upstream errors; independent Market cards403 |
| avito_card | Called3 times after actual browser discovery; one response failed strict normalization, two blocked; one independent card200 but insufficient selected-product evidence |
| avito_seller | Implemented, actual tools/list confirms availability; no trustworthy seller ID reached, so not called in this acceptance |
| specialized get_product | Installed and wired into Ozon validator; tools/list confirms contract; no Ozon candidate reached this stage |
| specialized search_products | Implemented as nonblocked-empty/unavailable fallback. Not used after app's blocked Ozon discovery. Separately executed live in `2026-10-01-ozon-probe.json`; site navigation ERR_EMPTY_RESPONSE, no products returned |

The separate specialized probe successfully initialized the real Python MCP2 server and listed search_products/get_product/get_reviews/compare_products. It verified unchanged CDP context inventory and the owned browser still connected after the failed call. It is not a positive product-card acceptance result. No stealth, account import, CAPTCHA solving, alternate IP or state reuse was enabled.

Local verification:40 Node tests,3 Python bridge lifecycle tests, lint/typecheck/build, npm audit0 and specialized hash-locked pip-audit0;32-package uv compatibility PASS. Actual native tools/list checked Market/Avito contracts. Existing browser isolation harness passed; extended isolated-context check also PASS. UI history displays persisted native diagnostics; disclosure opens to actual provider/tool/time/status and preserves UNVERIFIED.

Known limits: successful native card/seller/price extraction remains unaccepted on live target; native normalization can reject changed upstream response shapes. Alternate variants/reviews/other sellers are intentionally not fetched as a separate aggregation flow. Delivery/duty remain unknown without checkout-region evidence. Original UI/photo/filter behavior remains. GitHub-hosted CI previously blocked by account payment eligibility. Independent critic gave preflight GO_WITH_CONDITIONS; design conditions incorporated and regression-tested. Final independent code review could not run because the critic hit its usage limit; release remains HOLD.

UI rerun completed08:21:01 Moscow:3 Market candidates,0 VERIFIED; Ozon/Avito blocked. Expanded source diagnostics visibly list compare_prices, yandex_search and three failed yandex_card calls. History native disclosure, source photos and truthful unknown prices verified in the in-app browser. Screenshot saved in the chat outputs. Earlier6-candidate acceptance is retained as a separate dated observation, not overwritten by this variable live result.
