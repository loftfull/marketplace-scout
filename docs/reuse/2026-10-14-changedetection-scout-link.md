# Reuse Record: connect changedetection.io to Scout

## Need

Allow a user to watch a product card already found by Scout. Keep page snapshots separate from verified product prices.

## Candidates

| Candidate | Status / license | Fit and decision |
|---|---|---|
| Pinned `dgtlmoon/changedetection.io` 0.60.8, `09881f8b26aa01a2be66c5f63daf54a79a42b6bd` | Already installed, Apache-2.0, isolated Python 3.12 runtime, REST/UI and snapshots tested | **ADAPT via its local REST API**. It is the ready watch engine; keep its code and datastore separate. |
| Scrapy 2.19.0 | Already integrated, BSD-3-Clause | **KEEP for search/discovery**. It runs one search page per marketplace, not persistent snapshots. |
| Crawlee 3.x | Identified in 50-repo audit; Apache-2.0; not installed | **REJECT for this slice**. Duplicates Scrapy/Playwright; HTTP client won't solve current 403/IP/robots blocks. |
| MAXUN | Identified in 50-repo audit; AGPL-3.0 | **REFERENCE ONLY**. Full competing app/stack, license and platform footprint unnecessary for watch lifecycle. |

## Boundary / rollback

Scout passes only already canonical marketplace card URLs over loopback REST. New watches remain paused. changedetection owns history/diffs; Scout never reads snapshot content into its price model. A one-shot check requires a user action, both source circuits clear, and an upstream one-use permit. Existing `terminal.json` and shared Market cooldown remain active. Revert adapter/API/UI and the pilot boundary extension; preserve upstream data/runtime.

No upstream code is copied or modified. No marketplace call occurs when adding a watch or listing watches.
