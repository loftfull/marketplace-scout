# Scout: clear search and observation workflow

Canonical root D:\Projects\marketplace-scout; feat/marketplace-scout-mvp; baseline 4ba0124. Latest owner request authorizes improving the unclear, unfinished-looking application. Scope is a refinement of approved Tabler, not a replacement design system or provider migration. Unrelated knowledge-file changes remain untouched.

## Six audits

- Product: the user is opening the separate changedetection pilot on 8791. It is not the search terminal on 8787, and its control snapshot is not a product price. Main search must clearly expose its task and evidence limits.
- Architecture: existing static Tabler UI and server API suffice. No new service, data contract or parser. Keep the existing server process and pilot boundary.
- Structure: changes confined to public UI, a small pure presentation helper, regression tests and delivery documentation.
- Technical: current UI has live query/city controls, TTL-aware price filtering, safe image/link rules, history pagination and research tools; retain them. History lacks query/city filtering.
- Design: current equal-sized empty metric cards, technical API badge, Unicode navigation icons and generic subtitles obscure the user journey. Refine hierarchy, spacing and language with existing Tabler components and tokens. Keep themes and responsive sidebar.
- Quality: preserve raw verification statuses and reasons in details; no manufactured images/prices, history cannot be promoted to current evidence. Validate filter combinations, TTL tests, keyboard, mobile and desktop.

## Reuse comparison

Keep unchanged: lowest cost but leaves observed usability problems. Reuse/adapt selected: pinned @tabler/core 1.6.1, existing upstream layout/sidebar/table provenance in docs/REUSE.md; MIT and local vendor assets, no new dependency or network font. Official layout guidance rechecked at https://docs.tabler.io/ui/layout on 2026-10-02. GitHub tag web lookup returned 404; do not assert a newly verified release. Existing package lock/source provenance retained.

Replace with another dashboard: needless migration, accessibility and theme regressions; no demonstrated advantage for this bounded fix. From scratch: unnecessary because Tabler already provides layout, controls, tables and empty states. Prior broader candidates and community evidence remain in CANDIDATE_COMPARISON and external-solutions plan; no new code/assets copied from visual references.

## Sequence and acceptance

1. Independent critic reviews raw existing files and proposed scope before implementation.
2. Clarify search, result summary and navigation. Keep raw diagnostic codes in details. Collapse optional filters/diagnostics; do not hide blocked or zero-result outcomes.
3. Add local history text/city filters with truthful historical labels and unchanged stored rows. Explain standalone pilot limitations in Sources.
4. Run lint, tests, types, build and dependency audit; inspect desktop/mobile and keyboard using real history. Save screenshot. No fresh price claim without live acceptance.
5. Review diff, commit only task files, push existing branch and update PR1 and Obsidian.

## Risk and rollback

Only static rendering/filter changes. Render external content with textContent, retain URL/image allowlists; no credentials or new storage. Query/city changes must invalidate active results. Historical filtering changes presentation only, never evidence. Rollback by reverting this scoped commit; history and processes remain intact. This does not resolve marketplace access restrictions or establish production readiness.

Independent critic: GO_WITH_CONDITIONS. Conditions resolved in implementation contract before coding: preserve priceFor/statusNow/TTL and all evidence; keep summary warnings visible even when diagnostics collapse; filter history only by saved title/SKU/city without mutation, reset pagination and show X of Y; explicitly distinguish idle/loading/blocked/filter-empty states; retain four sections/research/themes/keyboard; remove decorative Unicode glyphs (final choice: text-only navigation, accepted by critic); label pilot as separate and availability unknown, never as a search result. No dependency/contract/provider changes.

Postimplementation independent critic: GO, no blocking regression; independently repeated history filter test PASS. Desktop and390px mobile checked using CUA, no page overflow; light/dark toggle, Tab query→city→submit, real history filter9/45 for RedmiBook Pro16/Voronezh, exactSKU1/45, dialog→research preserves fullSKU, and Escape verified. Isolated TEST ONLY fixture on8898 verified live dialog TTL transition VERIFIED→STALE with price removed, blocked-source summary visible while diagnostics collapsed, query invalidation. Test server/tab stopped; no fixture data in real history. Final evidence in docs/evidence/2026-10-02-search-clarity.md.
