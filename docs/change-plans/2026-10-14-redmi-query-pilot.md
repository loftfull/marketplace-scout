# Change plan: Redmi search query pilot

## Context Receipt

- **Project / root:** `marketplace-scout`, `D:\Projects\marketplace-scout`; registry has exactly one canonical entry.
- **Mode:** continuation of existing local product on `feat/marketplace-scout-mvp`, continuing PR #1. Keep current branch/root.
- **Approved goal / milestone:** local read-only marketplace price research; implementation GO, positive live verification and release HOLD. Current registered next action: rerun RedmiBook acceptance.
- **Latest user task:** implement the search flow for “ноутбук Redmi 2026 32Гб/1Тб” (2026-10-14). The user authorized a scoped implementation; no publication, merge, auth, purchase, or provider migration.
- **Keep invariant:** retain the product, stack, UI source, current providers and exact independent card verification; preserve history bytes; no false verified price; no bypassing CAPTCHA/IP restrictions; unknown shipping/duty stays null.
- **Product/design authority:** `docs/PRODUCT_SCOPE.md`; current source design `public/`; `docs/ARCHITECTURE.md`; connector and accepted scope records in `docs/CONNECTORS.md`, `docs/REUSE.md`, `docs/ACCEPTANCE.md` and 2026-09-30 change plan.
- **Verified facts (2026-10-14):** before changes, the app ran the exact user request using existing code. Query parsed as model `Ноутбук Redmi /`; Yandex returned a candidate with unconfirmed discovery evidence. Reopened card returned HTTP 403. Ozon returned 403, Avito reported IP restriction, WB city mapping was unconfirmed. After changes, the saved fresh run in `docs/evidence/2026-10-14-redmi-query-live.json` normalized the profile to Xiaomi/RedmiBook/2026/32/1024, returned three Yandex candidates, and kept all UNVERIFIED. Ozon 403, Avito IP restriction, WB mapping unconfirmed; 0 VERIFIED, incomplete. Live result came from `GET /api/search`, no synthetic offers used. Current working tree also contains pre-existing edits/untracked files; preserved.
- **Approved plan vs proposal:** approved project scope permits exact RedmiBook live acceptance and read-only local implementation. New proposed change is only parsing the user's less-specific query and using it as the form default; no new provider. API-ANYTHING evaluated in `docs/reuse/2026-10-14-redmi-query-pilot.md` and not adopted here because it has no bundled target-site operations. User’s current request does not authorize integrating account/session or bypass behavior.
- **Conflicts / unknowns:** the user has not specified CPU or RedmiBook size; do not require CPU or model suffix. Assumption for this slice: laptop + Redmi refers to the RedmiBook family. The observed candidate uses Ultra 5 125H, not the historic target’s 338H; not an exact-model acceptance. Live card evidence remains blocked.
- **Allowed/completed action:** normalized the query and default form text, ran existing verification gates, and recorded live evidence without promoting search price. No source/provider migration.
- **Six audits:** Product—fixes observable broken query normalization and target-card capacity abbreviations; Architecture—existing connector/search→verify path retained, no schema or provider change; Structure—parser/domain/spec parser/tests/one form default own the change; Technical—Node/TS existing stack and no new dependency, family alias restricted to generic RedmiBook profile; Design—reuse existing Tabler form, keep labels/loading/error/mobile behavior; Quality—regressions for family, capacity, contradictions and exact model; existing quality suite and real local search evidence; reversible no-history migration.
- **Reuse decision:** ADOPT current Scout and pinned marketplace connectors; WATCH API-ANYTHING at main SHA `8aca25b24347ef456cda183385be5bfb646b08e4`; SKIP MAXUN and changedetection for this search route. Full matrix at `docs/reuse/2026-10-14-redmi-query-pilot.md`.
- **Gate:** closed. Initial `GO_WITH_CONDITIONS` was satisfied before implementation; final independent post-implementation review returned `GO`. Latest user instruction authorized this bounded feature; broader provider changes remain out of scope.

## Summary

Normalize “Ноутбук Redmi 2026 32Гб/1Тб” into a Xiaomi RedmiBook family query with 2026, 32 GB RAM and 1024 GB SSD, without inventing CPU or model suffix. Preserve the existing discovery and independent verification pipeline.

## Six-audit findings

1. Product: exact user query currently produces a malformed model and weak marketplace search text; the live request produced one candidate but no confirmed price.
2. Architecture: keep the current connector boundary and all existing card checks; no new provider, history schema or storage.
3. Structure: parsing belongs in `src/parse.ts`; regression in `tests/parse.test.ts`; UI input in `public/index.html`.
4. Technical: no dependency changes. Main risk is broader family matching; CPU/model suffix not requested and must remain optional.
5. Design: keep the existing search form and Tabler source; no layout/theme/component change.
6. Quality: parser regression + full project checks + one read-only live search. Release remains HOLD on positive independent card evidence.

## Plan and rollback

1. Add failing regression for exact Cyrillic/user query and retain original specific RedmiBook parse.
2. Fix category removal, `GB/TB` punctuation and family normalization while preserving all explicit attributes.
3. Change only the search field default to the user's exact request.
4. Run acceptance gates and perform the bounded live search; record actual per-source stages and keep offers UNVERIFIED if card evidence fails.
5. Roll back by reverting only this slice; keep prior history and runtime evidence.

## Critic

**Initial verdict:** `GO_WITH_CONDITIONS` — independent review by `/root/critic_redmi_slice`, 2026-10-14.

**Condition:** Do not treat `RedmiBook` as an exact model. Generic profile may match only normalized RedmiBook-family product suffixes; all explicitly requested specs (year/RAM/SSD) still compare exactly. Existing exact profiles and foreign families retain strict matching.

**Closure plan:** add direct regressions for exact user query, source query, abbreviated live card title, required specs, a wrong year/RAM/SSD, foreign family, and the existing exact RedmiBook Pro 16 profile. Implement the family exception only when the requested profile model is exactly the generic family. The release/live evidence rule remains unchanged.

**Status:** condition incorporated before implementation and verified by regression tests. Final independent post-implementation review returned `GO`: token boundary rejects `RedmiBookish`, allows RedmiBook model suffixes only for the generic profile, preserves strict exact-profile matching and exact year/RAM/SSD requirements. No remaining concrete defect identified.

## Completion evidence

- `npm test`: 65/65 passed.
- `npx biome check src public tests`: 56 files checked, no fixes needed.
- `npm run typecheck`, `npm run build`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- ORCA responsive UI check: desktop/tablet/mobile passed; 0 JavaScript errors, horizontal overflow or axe findings.
- Exact read-only request: `docs/evidence/2026-10-14-redmi-query-live.json`; 3 Yandex discovery candidates, all UNVERIFIED; Ozon 403, Avito IP restriction, WB city mapping unresolved. Positive live card evidence and release remain HOLD.
