# Live connectors

Marketplace Scout never verifies prices via search-engine results.

Recommended runtime:
- primary multi-market MCP: ru-marketplace-mcp (Market/Ozon/Avito/AliExpress/Taobao etc.)
- Ozon: independent browser-backed validator
- shop-scout: anomaly/QA signal
- Apify: optional fallback

Expose each MCP through a local HTTP bridge and configure endpoint/tool names. Browser-backed sources MUST use a dedicated Chrome profile. Do not log into email, banking or work accounts in that profile.

Adapter contract: discovery returns canonical URL + marketplace SKU + seller + observed price + parsed specs; verification reopens the same URL and returns current values. Only the second pass may set VERIFIED.
