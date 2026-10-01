# Market connector identity boundary

## Context receipt

Project marketplace-scout; canonical D:\Projects\marketplace-scout; continuation of 83ff189 / feat/marketplace-scout-mvp / PR #1. Owner requests continued ready-source integration. Product authority is current PRODUCT_SCOPE and owner-approved Tabler/native-provider adoption. Earlier original-design and CI-billing context is superseded by those decisions and successful 83ff189 CI. Unrelated knowledge-scaffolding changes remain untouched. No provider/design/dependency/history migration, account access, challenge bypass, merge or release is authorized by this slice.

## Six audits

- Product: real discovery includes 18-digit Market card 227753481523236864. The native get_product caller passes a URL to upstream; its unanchored 5..15-digit URL regex silently truncates this ID. Requesting a different card defeats canonical identity verification. Correct the integration boundary now.
- Architecture: retain full upstream parser and tool. Reuse its stricter full-match numeric-ID branch by passing the exact ID, after validating the existing canonical URL and path identity. Unsupported IDs remain unsupported and never become shortened network targets. No expanded 15-digit research input support.
- Structure: scoped changes to src/adapters/yandex.ts, deterministic tests and provenance/evidence documents. Existing URL helpers remain the authority; model-page paths must not be relabelled as seller cards.
- Technical: id normalization currently stringifies unsafe JS numbers. Only exact digit strings or positive safe integers can preserve identity. Full-length string IDs remain visible in discovery; upstream rejection is not a source block and cannot grant VERIFIED. Requested SKU variant must remain checked independently because upstream get_product reads the default card.
- Design: no visual change, existing Tabler diagnostics and fail-closed price display preserved. No fresh visual-source selection is necessary.
- Quality: tests cover exact ID sent, no network call on invalid/mismatched URL or model-page path, unsafe numeric discovery rejection, preserved long string IDs, default variant mismatch. Pinned upstream Python regression proves long numeric ID rejection before fetching. Run Node lint/types/tests/build/audit, Python adapter tests and one bounded live four-source acceptance. Preserve persistent source cooldown and record real outcomes.

## Reuse and options

Inspected existing caller/URL helpers and pinned MIT SZhukovWork/yandex-market-mcp 92bb4dfbc3b87d0c0f77aa7ede09faed7e661aa7 parse.py:273 and server.py:400. Current official repository README checked 2026-10-01: https://github.com/SZhukovWork/yandex-market-mcp. Provider has one commit and the same limitations; no new source is imported. Current ru-marketplace-mcp page also checked; previous Candidate comparison exclusions remain. Community/visual research from approved ready-terminal audit is unchanged for this nonvisual boundary fix.

Keep current URL call: rejected, truncation reproduced in source. Adapt existing exact-ID branch: selected, minimal cost, existing MIT rights and installed runtime, no dependency changes. Replace provider: not justified by this local integration defect. Write a new parser or expand upstream accepted IDs: rejected; separate unsupported feature, not needed for this repair.

Acceptance script currently counts all evidence objects as cardsReopened; assess separately during review and avoid interpreting this as live-card success. Do not change historical evidence files to make results look better.

## Gate and plan

Need proven; timing now; reuse existing upstream exact-ID parser; design fit pass; owner continuation approval recorded. Independent critic GO_WITH_CONDITIONS accepted: require seller-card path and exact ID/variant consistency, reuse full numeric ID branch, reject unsafe numeric identities, prove upstream validation before HTTP, distinguish browser responses from live 2xx pages. These define the implementation below, with no unresolved scope decision. Acceptance counters become browserResponses and liveCardResponses, with an explicit definition; no evidence object is called a successful reopening. Old artifacts remain unchanged. Implement boundary and regressions; verify; restart only owned Scout runtime and perform bounded live acceptance; document actual outcomes, update PR and Obsidian. Rollback: revert this slice, preserve .data/.runtime, rebuild and restart owned app. Positive live regional verification remains HOLD until independently evidenced.

## Verification and runtime limit

Implementation and final critic GO; reviewer independently ran 4 Node and 4 Python regressions. Full local lint/typecheck/60 Node tests/build PASS; 4 Python bridge tests PASS; npm audit 0. UI unchanged. Automatic approval rejected the owned server/process-tree restart with “blocked by policy”; no retry or alternate process-termination mechanism was used. Existing server PID15552 remains on its prior loaded backend; compiled build contains the fix but it is not loaded there. Shared fixed CDP/profile prevents safely running a second instance, so no second server was started.

One baseline live acceptance on the existing server returned 3 Market candidates, 0 browserResponses, 0 liveCardResponses, 0 VERIFIED. Market native card blocked, Ozon/Avito blocked, WB region-resolution timeout. Evidence includes explicit executionScope.identityFixLoaded=false: ../evidence/2026-10-01-market-identity-live-baseline.json. This proves current access limits only. New identity behavior is proven by deterministic TypeScript boundaries and actual pinned Python tool invocation before fetch. Historical evidence preserved. Remaining action: permitted graceful restart, then new-build live acceptance without clearing cooldown.
