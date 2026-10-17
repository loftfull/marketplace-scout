---
doc_type: ai-project-context
project_id: marketplace-scout
authority: registry-derived
authority_status: approved-limited-slice
lifecycle: active
mode: governed-limited-slice
status: current
owner: Vladimir
last_reviewed: 2026-09-30
---

<!-- OBSIDIAN-KB:BEGIN -->
# Marketplace Scout: AI Context

This file is a navigation and safety contract. It does not replace product or design authority.

## Identity

- Canonical root: `D:\Projects\marketplace-scout`
- Obsidian project note: `D:\MOZG\Projects\Marketplace_Scout.md`
- Global entry point: `D:\MOZG\00_AI_PROJECT_START_HERE.md`
- Knowledge protocol: `D:\MOZG\Runbooks\AI_Project_Knowledge_Protocol.md`
- Mandatory model checklist: `D:\MOZG\AI-Agents\AI_Model_Mandatory_Checklist.md`
- Operating mode: **governed-limited-slice**

## Approved next action

Implementation GO; positive live verification and public release HOLD. A separate Scrapy 2.19.0 HTML-only mode is pinned and selected by default; see `docs/specs/2026-10-14-scrapy-html-mode.md` and `docs/research/2026-10-14-scraper-repository-audit.md`. The Windows CP1251 worker-output failure was fixed with an explicit UTF-8 byte protocol and regression coverage. A bounded live run extracted three Yandex listing candidates, but card verification returned HTTP 403; Ozon and Wildberries stopped at fail-closed robots checks; Avito remains paused due to a prior IP restriction. No VERIFIED offers were produced. Details and request counts are in `docs/evidence/2026-10-14-scrapy-html-live.json`. Do not clear source circuits or repeat blocked live requests until access conditions change. Continue approved PR #1 in canonical root only.

## Authority documents found

- `AGENTS.md`
- `docs\PRODUCT_SCOPE.md`
- `docs\ARCHITECTURE.md`
- `docs\TEST_PLAN.md`
- `docs\RELEASE_CHECKLIST.md`
- `README.md`

## Registered design sources

- `D:\Projects\marketplace-scout\public`
- `D:\Projects\marketplace-scout\docs\change-plans\2026-09-30-live-marketplaces.md`

## Mandatory start gate

1. Read the global entry point, protocol and checklist.
2. Read the authority documents above in order.
3. Produce a Context Receipt before planning or editing.
4. Run product, architecture, structure, technical, design and quality audits.
5. Run critic-control. Proceed only with GO or GO_WITH_CONDITIONS.

When mode is `read-only-triage`, do not change product code or design. First reconcile the canonical root, approved scope, design source, current evidence and contradictory claims.

## Claim discipline

Label material statements as APPROVED_DECISION, VERIFIED_FACT, APPROVED_PLAN, PROPOSED_PLAN, RISK, ASSUMPTION, UNKNOWN or SUPERSEDED. A newer date alone does not supersede an earlier approved decision.
<!-- OBSIDIAN-KB:END -->

# Project context

Project ID: marketplace-scout. Canonical root: D:\\Projects\\marketplace-scout, explicitly confirmed by Vladimir in this chat on 2026-09-30. Mode: continuation/import of existing GitHub product. Remote: loftfull/marketplace-scout. Branch: feat/marketplace-scout-mvp. PR: 1, base English. Do not substitute another folder or merge PR without authorization.

Authority: latest explicit user task in this chat; docs/PRODUCT_SCOPE.md; original PR UI for visual design. Prior assistant conversation is background evidence, not approval. Plan/critic evidence: docs/change-plans/2026-09-30-live-marketplaces.md. Architecture/test/security/release/runbook documents govern this local slice. No production-ready claim until live positive extraction and release checklist are satisfied.
