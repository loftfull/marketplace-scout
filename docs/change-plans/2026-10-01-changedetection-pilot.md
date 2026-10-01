# changedetection.io: standalone pilot

## Context receipt / approved scope

Canonical root D:\Projects\marketplace-scout; continuation, branch feat/marketplace-scout-mvp, PR1, baseline878a493. Owner's latest `продолжай` authorizes phase1 of external-solutions.md. Preserve Tabler/Scout contracts, current8787 process and its history. Historical AI_CONTEXT CI/design statements are superseded by PRODUCT_SCOPE and newer CI evidence. Unrelated knowledge-file changes remain untouched.

## Six audits and reuse

Product: deliver the existing external UI/history rather than another catalogue. Architecture: standalone Windows Python process/API, no Scout parser migration. Structure: integrations contains launch boundary; ignored runtime/data are isolated. Technical: Python3.12.14 already installed; Docker engine unavailable. Design: keep original upstream interface; check actual desktop/narrow UI. Quality: auth, outbound requests, pause/restart/history and dependency audit are acceptance gates. Previous multi-candidate research and keep/reuse/replace/from-scratch comparison: external-solutions.md. Reuse selected; no new monitoring engine.

Release0.60.8 =09881f8b26aa01a2be66c5f63daf54a79a42b6bd, verified GitHub tag and PyPI publishing attestation. This differs from the previously researched default branch. Apache2.0, original source/license retained. Entire upstream parsing, processors, UI, REST and datastore run as supplied. Changes are explicit lifecycle/egress wrappers, plus cryptography50.0.0 dependency override replacing vulnerable44.0.0. Source is loaded directly with separately hash-locked dependencies; no falsified package metadata.

## Critic and execution order

Independent critic: GO_WITH_CONDITIONS. Installation for audit allowed; live starts only after TLS/public-IP pinning, exact targets, single-use permits, persistent stop-after-block, host/origin protection, API key enforcement, no other fetchers/notifications, and security dependency scan. No -D CLI switch exists; use upstream datastore constructor include_default_watches=False.

1. Pin original source and isolated dependency lock; audit before running.
2. Small runner: loopback8791, upstream UI/API/workers, all paused, one worker, no defaults. Borrow reviewed pinned HTTPS approach from scripts/yandex-http.py; deny all redirects for this bounded pilot. Cooperative stop of this instance only.
3. Paused exact Market watch and clearly labelled technical-control watch. One explicit permit per URL; no scheduled network. Record real errors as UNVERIFIED. Control snapshot is not a product price.
4. Verify API auth, history/snapshot, UI, no requests without permit, resource use, stop/backup/restart persistence; update evidence/PR/runbook.

## Threat model / rollback

Local trusted OS user, untrusted pages/redirects and browser origins. No accounts or credentials on outgoing requests. API key/datastore remain ignored and local. Only two exact public URLs allowed, pinned public IPv4 with original SNI and certificate validation; redirect is terminal. No arbitrary browser/notification/LLM endpoint. Source cooldown checked before arming; block remains terminal in this pilot until explicit review (no automatic rearm). This boundary is not a general multiuser hosting service.

Rollback: request cooperative stop through pilot control file; preserve isolated datastore/backup; omit pilot launch. Existing Scout/runtime/history untouched. No OS autostart, merge, notifications or paid services.

## Results

Completed bounded installation/API/live-control/persistence on2October. Independent critic closed four findings (mutable system fetcher, real browser routes, Socket.IO boundary and HTTP200 challenge) and returned GO for the one-use live pilot; independently repeated10 boundary tests. Local integration exposed keyword `datastore` mismatch; fixed and regression uses keyword call. Actual unarmed upstream recheck subsequently failed before any network.

Real control200:6287-byte snapshot via upstream history API. Product302:terminal error, no price/snapshot. Both paused; restart preserved watches/history/snapshot hash/request count; Scout history SHA256 unchanged. Local60 Node tests, lint/types/build/npm audit0; Python10 boundary tests, Ruff,169 dependency audit0 and consistency PASS. CI extended with Python boundary tests. HTTP HTML endpoint200; rendered browser QA unavailable after attachment timeouts. Ten-save growth and backup restore drill not completed, retained in checklist. Evidence/report linked in docs/evidence/2026-10-02-changedetection-pilot.md. No live price or production readiness claim.
