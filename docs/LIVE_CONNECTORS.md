# Live connectors

Default: ru-marketplace-mcp 2.4.2 pinned c17bd360de60780a9e8d3690288b70181bd07355, local stdio via official MCP SDK 1.31.0. Setup: npm run runtime:setup. Only yandex_market, ozon and avito are enabled. compare_prices(query, sources, per_source_limit=20; at most 3 selected by identity fit for reopening) is schema-validated. Upstream VERIFY/status fields never establish Scout VERIFIED.

All candidates undergo a separate browser-card read of the discovered canonical URL/variant. The Ozon validator module is independent of upstream Ozon card parsing. MCP search uses source-native network/browser paths; Yandex discovery is HTTP-backed and every candidate's verification is browser-backed. If MCP fails without an access-block signal, direct browser search is a bounded fallback. A block never triggers proxy rotation, challenge solving or login.

Chrome: dedicated .runtime/chrome-profile, port9337 loopback, headless/no-sync, mandatory local public-HTTPS tunnel. No sensitive account. Optional RU_MARKETPLACE_MCP_URL selects a separately managed loopback HTTP MCP; it must honor the same dedicated-profile policy. External or authenticated multi-tenant endpoints are unsupported.

The old MARKET_MCP_URL/OZON_MCP_URL/AVITO_MCP_URL raw JSON-RPC shape was not a real initialized MCP connection. The current runtime uses the real compare tool contract. Unsupported AliExpress/Taobao remain outside the approved live scope. To roll back, stop Scout and revert this PR's continuation commits; do not revert security patches while operating an exposed runtime.
