# Local runbook

Separate changedetection pilot: see [lifecycle/backup/rollback instructions](../integrations/changedetection/README.md). Use its cooperative `manage.py stop`; it does not stop Scout8787 or Chrome9337. Data and keys stay under `.data/external/changedetection`. No autostart or scheduled checking. Preserve terminal-state/cooldowns after target302; do not clear them to obtain another response. The runtime is optional; unavailable pilot must not affect existing search.

Terminal assets: npm ci then npm run build (or npm start) copies the pinned Tabler core into ignored public/vendor; if running dist/server.js directly, run build first. Never serve templates from the reference clone. Research operations are selected in the UI and share the search busy guard; wait for completion before another operation. Source block means stop, not reset state. For review/parser output on Windows, child processes explicitly set PYTHONUTF8=1. Native review/seller results remain observations and are not part of the price-history backup.

Ready-terminal rollback: stop only owned Scout processes, retain .data and .runtime, revert the terminal commit, npm ci and npm run build, restart. No data migration. Known limitation: selected-city WB geo resolution and readable target cards must be proven before declaring live price acceptance. Do not replace missing results with default city or zero price.

1. Enter D:\\Projects\\marketplace-scout. npm ci; npm run runtime:setup; npm run runtime:ozon; npm run runtime:yandex; npm run build; npm start.
2. Open http://127.0.0.1:8787. /health proves API readiness only. Search proves runtime startup and source readiness; every source has an outcome.
3. npm run acceptance writes work/live-acceptance.json. Save this before changing runtime versions. No web-search prices count as confirmation.
4. Runtime diagnostics: .runtime/logs/mcp.log plus server stdout. HTTP403, CAPTCHA/IP-firewall => UNVERIFIED. Do not auto-retry challenges, change IP, import personal sessions or invent a price.
5. If CDP port9337 is occupied, do not attach to it. Stop the exact Scout-owned process from the previous run; confirm its command uses this project's .runtime/chrome-profile. Never stop other Chrome instances. Ctrl+C requests graceful MCP/browser/proxy shutdown.
6. On storage error, stop the application and copy .data/history.json to a uniquely named backup. Fix disk/permissions. Never replace corrupt history with an empty file. One writer only; retention is 10,000 observations.

Configuration is environment-based (PORT, SCOUT_DB, optional SCOUT_CHROME_PATH/RU_MARKETPLACE_MCP_URL). No secrets in .env.example. Separate dev/stage/prod directories and databases; this release supports local development only. Existing Docker files are bootstrap references, not a validated Windows/CDP deployment; use native run instructions.

Monitoring: watch API /health, per-source errors, verification freshness, log errors, history write failures and disk space. Alerting/hosted deployment requires a separately approved service setup. No recurring task is installed.

City defaults to Voronezh. Check observed city before using discovery prices; an IP-based Moscow response is not a Voronezh offer. Market denial cooldown persists in .runtime/yandex-state/blocked.json; do not delete it to retry. WB geo failure stops before price tools; inspect the stage, not just process health. `node --import tsx scripts/provider-probe.mjs` checks actual Market/WB tool contracts without site price requests. The geo response contract remains unproven on this network until a successful mapping is observed.

Rollback: stop owned processes, preserve history/profile, git revert the continuation commit(s), npm ci for the reverted lock. Restore a history backup only by explicit operator choice. For forward recovery, rerun pinned runtime setup and its security overlay, checks and acceptance; successful installation alone does not prove marketplace access.

Specialized runtime: `.runtime/ozon-mcp` is separate from `.runtime/ru-marketplace-mcp` (whose own ozon-mcp executable is a different provider). Do not substitute one executable for the other. `npm run runtime:ozon` refuses a dirty source checkout. The adapter uses scripts/ozon-cdp.py and the dedicated loopback browser; no OZON_PROXY/OZON_LOCATION/account settings are imported. Source errors are shown as diagnostic status, never zero prices. For local dependency auditing: `uv tool run pip-audit -r scripts/ozon-runtime.txt --no-deps --disable-pip`; use the bundled `.runtime/uv-bootstrap/bin/uv.exe` if uv is not on PATH.
