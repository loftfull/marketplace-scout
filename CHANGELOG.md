# Changelog

## 0.3.0 — 2026-09-30

- Real initialized MCP integration for Market/Ozon/Avito; pinned runtime installer and separate Ozon browser validator.
- Dedicated Chrome/CDP with public-only HTTPS egress and no sensitive accounts.
- Fail-closed canonical/variant/spec/seller/price/stock verification; conflicting fields and missing/future/expired evidence handled honestly.
- Windows static path fix; local API boundary, bounded searches, serialized atomic price history and explicit unknown landed costs.
- Existing UI extended with links, history, source failures, timestamps, errors and accessible states.
- Locked dependencies, Windows/Linux CI checks, deterministic/protocol/browser security tests and audited Python security overlay.
- Live source blocks remain an acceptance limitation; no invented prices or positive-live-verification claim.

## 2026-10-01 — product presentation

- Real source thumbnails with strict product/variant joins and safe missing-image fallback.
- Inclusive price range with explicit current-verified or discovery-price basis; unknown-price control and reset.
- One actionable blocked-card summary with expandable diagnostics; full backend evidence retained.
- Image enrichment cancellation and automatic history TTL refresh. 35 tests pass; live card/site restrictions remain.
