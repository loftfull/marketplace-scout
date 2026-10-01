# Candidate comparison — continuation receipt and gate

Project marketplace-scout, canonical D:\Projects\marketplace-scout, continuation of09ceba3 on feat/marketplace-scout-mvp/PR1. Owner explicitly asks continued adoption of found GitHub solutions and a Candidate comparison transfer report. Existing Tabler authority and native modules remain; no provider/dependency/backend replacement, history migration, demo prices, account use, block bypass, merge or deployment. Registry/AI_CONTEXT original-design and CI-billing notes are superseded by current PRODUCT_SCOPE and passing09ceba3 CI. Unrelated knowledge scaffolding stays untouched.

## Six audits and reuse evidence

- Product: native compare_products already executes but generic nested output obscures the three price conditions and seller/region differences. Make the existing adopted capability usable, and document exact transfer versus installation versus live proof.
- Architecture: presentation projection only; existing read-only API, fixed operations, source cooldown, lock and no history/VERIFIED promotion retained. Numeric IDs remain safely bounded; Market input stays within the pinned upstream 15-digit limit. Longer IDs are unsupported.
- Structure: add public/comparison-view.js for schema projection and Tabler table rendering, call from existing research response path, retain complete plain-text raw details. No new scraper or duplicated source parsing.
- Technical: reuse specialized Market server.py:630 compare_products and Ozon server.py:446 compare_products, exact existing pins. Adapt Tabler table component from existing pinned shared/components/demo/Table.astro. Dependency cost zero. Native money fields remain finite positive numbers; missing/error/unsafe IDs fail closed, no string-to-money coercion or cheapest-winner ranking.
- Design: current Tabler card/table-responsive/table classes, labels and light/dark tokens. Caption explicitly unverified source observation; requested city, source-reported city/region and notes remain visible. Table cells plain text; horizontal table scrolling on mobile.
- Quality: mapping/error/missing/conditional-only/unsafe-number/region tests, strict Market-vs-WB ID tests, isolated UI fixture and one bounded live compare invocation without clearing cooldown. Reuse fixtures never enter production/history. Full Node lint/types/tests/build/audit and independent final review.

Research order: current code and six-server schemas; pinned upstream tool implementation; current primary GitHub pages and eight-repository API maintenance/license snapshot in work/candidate-health.json. Previous same-day community and upstream visual reference research from ready-terminal plan still applies; no new visual system chosen. Stars/open-issue counts are a health snapshot, not proof; tiny specialized repositories carry maintainer concentration risk.

Options: keep raw output (lowest effort but user cannot easily compare); adapt current upstream comparison + Tabler (selected, low cost, no migration); replace with Refine/CoreUI/PriceBuddy/changedetection backend (no stronger fit, extra stack/overlap/license cost); from scratch rejected because native comparison exists. Exact candidates and license conditions go into docs/CANDIDATE_COMPARISON.md.

## Review and sequence

Proposed slice pending independent critic: close conditions, then adapt projection/table while retaining the existing ID boundary; add report/source evidence; verify UI/tests/live honest outcome; update PR and Obsidian. Owner continuation authorization is recorded; no new approval request needed for this integration. Rollback: revert slice, retain .data/.runtime and existing npm lock, rebuild/restart. External access limitations remain separate from implementation acceptance.

## Narrowed scope / implementation GO

Independent critic found pinned Market card_id_from accepts only5..15digits and can truncate a longer URL. The proposed18digit expansion is **excluded**, not implemented; current API/button15digit boundary remains. Report this upstream limitation explicitly. No new parser/shim. Critic returned GO for this narrowed slice. Ordinary/card/reference prices stay separate, errors retained without winners, general response region is never presented as per-card evidence, upstream notes/rating scope stay visible, and source path is corrected to scripts/yandex-http.py. Final review follows implementation. Need proven; timing now; reuse native compare_products + pinned Tabler table; design fit pass; authorization latest owner continuation; rollback ready.

## Completion evidence

Final independent review identified Market city as an object; mapping now reads city.name and the fixture matches the pinned schema. Reviewer reran 3/3 focused tests and returned GO. Full local lint/typecheck/56 tests/build PASS; npm audit 0. Light/dark and narrow-screen table checked in an isolated fixture only. Actual Market compare_products returned blocked/UNVERIFIED, committed separately as live evidence. Positive live acceptance remains HOLD. Candidate report and README/REUSE/TEST_PLAN updated; no dependencies, data contracts or history migrated.
