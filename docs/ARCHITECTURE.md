# Architecture

```mermaid
flowchart LR
  UI[Existing vanilla UI] --> API[Fastify on loopback]
  API --> Query[Server query parser]
  Query --> MCP[Official MCP SDK]
  MCP --> RU[Pinned ru-marketplace-mcp]
  RU --> Discovery[Market / Ozon / Avito discovery]
  Discovery --> URLs[Canonical product / variant]
  URLs --> Browser[Independent Chrome card reader]
  Browser --> Verify[Identity / seller / price / stock gate]
  Verify --> History[Atomic serialized JSON history]
  Verify --> UI
  Browser --> Egress[Public IPv4 HTTPS-only tunnel]
```

One active search; at most three candidates per source, three sources sequentially. MCP requests have 65-second deadlines and upstream per-source 45-second ceilings. Browser navigation has 30-second deadlines. Source failure is retained separately from offers. MCP SDK implements initialization, stdio or optional loopback Streamable HTTP, reconnect after child exit and bounded calls.

Chrome is created with a dedicated profile, loopback CDP, no sync/accounts, no proxy bypass, and a mandatory local HTTPS CONNECT proxy. The proxy resolves and validates a public IPv4 then connects directly to that address; rejects private/local and plaintext targets. This protects redirect hops, service workers and pages opened by the MCP as well as Scout pages. The additional page route limits navigations to the named marketplace. This is a local single-user design, not a multi-tenant network service or an OS sandbox for the Python process.

Card reader accepts one Product matching the visible H1, one non-aggregate offer and unique marketplace price/seller/availability widgets. Requested specs are never copied into evidence. Title/property contradictions and ambiguous capacities block confirmation. Yandex path ID and sellable variant are separate. No alias between Xiaomi Book and RedmiBook is silently assumed.

History retains original observations, serialized writes and atomic replacement. Corrupt files cause an error and are preserved. Current display recalculates TTL without changing stored observations. Single-process writer only; multi-instance/database scaling needs a separate plan.
