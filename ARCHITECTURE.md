# Architecture

Pipeline: Discovery -> Product Identity -> Card Re-verification -> Cost normalization -> Price history -> API/MCP.

## Non-negotiable rules
1. Search snippets never become VERIFIED prices.
2. A candidate must be reopened at its canonical product URL.
3. Brand/model/generation/CPU/RAM/SSD/GPU constraints are matched before comparison.
4. Missing or contradictory attributes produce UNVERIFIED/MISMATCH, never a fabricated value.
5. Store marketplace SKU, seller identity, canonical URL and verified timestamp together.
6. Import offers compare landed cost (item + shipping + duty), not headline price.

## Connectors
Primary target: ru-marketplace-mcp. Ozon gets a second independent browser-backed validator. shop-scout heuristics become QA signals. Apify remains optional fallback/monitoring.
