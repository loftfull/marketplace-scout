# Search clarity and usable history — 2 October 2026

Scope: existing Tabler1.6.1 interface on127.0.0.1:8787, not a replacement system. Main server process and separate changedetection pilot remain unchanged. Browser-backed card availability is a separate acceptance criterion.

## Delivered

- Clear query/city/price-check action; calm spacing and type hierarchy using existing Tabler components/tokens. Text navigation instead of inconsistent glyphs. Four sections retained.
- Explicit idle/loading/failed/completed states, translated table statuses and visible reason summaries. Raw codes and all price/region evidence retained in details. Optional filters/diagnostics collapse without hiding the verification outcome.
- History filters by saved title/SKU and saved city, with pagination reset and count. Search shortcut starts with first three query words (model) because marketplace capacity spellings differ. Whitespace-insensitive matching finds RedmiBook and Redmi Book. Filtering never edits observations.
- Query edits now invalidate old results, as city edits already did. Backend availability labelled as application connection, not marketplace verification.
- Sources section explains changedetection as a separate local pilot, not a price provider, and does not claim it is currently reachable.

## Evidence

Real runtime loaded45 saved observations. CUA history shortcut returned9/45 RedmiBook Pro16 records for Voronezh. ExactSKU6013745409 returned1/45; Moscow discovery conflict remained visible, current price absent, archived/conditional/reference prices explicitly excluded. Dialog→research kept fullSKU and closed the dialog. No fabricated data loaded into application storage.

Desktop screenshot inspected; mobile390×844 inspected with no page horizontal overflow. Light/dark toggle and keyboard query→city→search verified. Tabler controls/layout retained. Browser viewport capability timed out on an unrelated stale tab; scoped CUA CDP device metrics succeeded and were cleared afterwards. No app screenshots made with shell browser automation.

Isolated existing TEST ONLY server8898: broken image fallback, price removed on15-minute TTL while dialog stayed open, rawSTALE and stale explanation, Escape, collapsed blocked-source outcome and query invalidation all observed. Fixture includes no live marketplace response and was stopped after use.

61 Node tests PASS; initial missing new helper declaration fixed, final typecheck PASS; build PASS, lint PASS without warnings, npm audit0. Independent critic GO/no blocking regression; history filter test independently repeated. Impeccable detector run once: conservative contrast/inset/advisory findings include upstream hidden/theme variants; visible mobile/desktop/theme reviewed, no claim of a complete WCAG audit. No new dependency, provider or data contract.

Fresh real search through the actual8787 UI completed:2Yandex candidates (227753481523236864 and6108950814),0VERIFIED/current prices. Requested Voronezh; discovery Moscow. First variant conflicts with target, second lacks confirmation. Ozon and Avito outcomes blocked; WB region resolution did not confirm the city. Source diagnostics and invalid prices remained visible; one real discovery image displayed and unavailable image fell back. This uses the existing loaded backend (identity-fix runtime gate remains unchanged); it does not validate a restarted backend or positive target acceptance. Main history now includes this real run. Positive regional price acceptance remains HOLD.

Screenshot: outputs/scout-search-2026-10-02.png in the Codex task workspace. Main app left open; pilot remains a separate application. Final commit/CI receipt follows in PR1.

## Run and rollback

Open http://127.0.0.1:8787/#search-view for search;8791 is the separate advanced monitoring pilot. Static assets are served by the existing process; reload after update. Revert this scoped UI commit to restore prior presentation. No datastore migration or service restart required. Keep source access restrictions and ordinary-price/region/variant checks intact.
