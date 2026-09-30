# Runbook

1. Clone the repository and checkout the feature branch.
2. Copy .env.example to .env.
3. Run each browser-backed marketplace connector with a dedicated Chrome profile.
4. Put its local MCP HTTP endpoint into MARKET_MCP_URL / OZON_MCP_URL / AVITO_MCP_URL etc.
5. npm install && npm test && npm start.
6. Open http://localhost:8787.

Do not use a Chrome profile containing banking, email or work sessions.

## Definition of live
A marketplace is live only when discovery finds a canonical card and verification reopens that same card. Search snippets are never accepted as current prices.
