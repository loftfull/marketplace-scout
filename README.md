# Marketplace Scout

Local marketplace price verification for Windows. Continues PR #1 and `feat/marketplace-scout-mvp`; canonical folder: `D:\\Projects\\marketplace-scout`.

## Run

Requires Node 24 (22+ supported), Git, Python for the installer, and installed Google Chrome. No marketplace, banking, email or work accounts are used.

```powershell
npm ci
npm run runtime:setup
npm run runtime:ozon
npm run runtime:yandex
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

## Native collectors

Market uses the pinned SZhukovWork/yandex-market-mcp search/card tools through guarded ordinary HTTPS. ru-marketplace-mcp supplies Ozon discovery, Avito cards/sellers, WB search/cards and optional exact-variant Market images. Ozon candidates call the separately pinned SZhukovWork/ozon-mcp validator; its search is a fallback only for empty/unavailable discovery, never for a blocked source. See [repository pins, licenses and research](docs/CONNECTORS.md).

City defaults to Voronezh; Moscow and Saint Petersburg are selectable. Selection is a verification requirement, not proof that a marketplace accepted the address. Requested, discovery and card regions remain distinct. Wrong-city prices, unrelated products, Pay-card prices and crossed-out prices cannot become ordinary current prices. WB resolves the selected city's destination before calls; missing mapping stops WB without a Moscow fallback. Its installed search schema omits destination, so search supplies IDs only; regional prices must be reread with wb_card and the validated destination.

Native observations carry provider/tool/time, exact-identity checks, separately named ordinary/conditional/reference prices and seller facts. They do not fill independent browser evidence or grant VERIFIED. Contradictory native facts veto verification. Expand “Данные коннектора” or “Вызовы коннекторов” for actual execution diagnostics. Some tools remain uncalled when discovery or seller identification fails; installation does not imply successful live extraction.

With Scout stopped, `npm run probe:ozon` checks the actual specialized MCP tool contract, makes a separate live search attempt and verifies context cleanup. Evidence and limitations: `docs/evidence/2026-10-01-native-connectors.md`.
