# Marketplace Scout

Local marketplace price verification for Windows. Continues PR #1 and `feat/marketplace-scout-mvp`; canonical folder: `D:\\Projects\\marketplace-scout`.

## Run

Requires Node 24 (22+ supported), Git, Python for the installer, and installed Google Chrome. No marketplace, banking, email or work accounts are used.

```powershell
npm ci
npm run runtime:setup
npm run build
npm start
```

Open http://127.0.0.1:8787. The first search starts a dedicated headless Chrome profile and the pinned ru-marketplace-mcp stdio server. Do not attach a personal browser. CDP port 9337 must be free. Runtime dependencies and profile stay in ignored `.runtime/`; history stays in `.data/history.json`. Runtime setup uses upstream frozen dependencies followed by the checked-in, hash-locked security overlay.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
npm run acceptance
```

`npm run acceptance` requires the running app and writes real outcomes to `work/live-acceptance.json`. It performs no purchases or account login. No demo offers are loaded. Synthetic prices exist only in tests. Stop the app before `npm run test:browser`, which uses its reserved CDP port for security regression checks.

## Verification contract

Discovery prices are observations, never confirmed current prices. A separate browser pass reopens the canonical product and compares native product ID, variant, requested specifications, seller, ordinary RUB price and stock evidence. Missing or contradictory evidence fails closed. Ozon uses its own validator entry point independent of the MCP's card payload. A blocked source reports UNVERIFIED; a confirmed different product is MISMATCH; a verified price expires after 15 minutes to STALE.

Shipping/duty/region remain unknown until supported by evidence. An unknown component means unknown landed total. No assumed zero fees, inferred region or live customs-rate calculation. UI includes source outcomes, safe links, local history, reasons and freshness. Local data is single-writer, capped at 10,000 observations; last 200 exposed by history API.

## Current limits

Live checks reached Market discovery and canonical-card HTTP responses; marketplace access restrictions prevented positive price/seller verification. Ozon and Avito also blocked this environment. Passing local tests does not prove positive extraction on these live sites. See `docs/ACCEPTANCE.md` and the committed acceptance evidence. No production release or PR merge is claimed. Headless Chrome may be rejected; the app does not bypass challenges or change IPs.

See `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md`, `docs/RUNBOOK.md`, `docs/RELEASE_CHECKLIST.md` and `docs/SECURITY.md`.
