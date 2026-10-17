import { mkdir, writeFile } from "node:fs/promises";
import { acceptanceSummary } from "./acceptance-summary.mjs";

const origin = process.env.SCOUT_URL || "http://127.0.0.1:8787";
const query = "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB";
const response = await fetch(`${origin}/api/search?q=${encodeURIComponent(query)}`, {
  signal: AbortSignal.timeout(600000),
});
const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
const evidence = {
  runAt: new Date().toISOString(),
  mode: "LIVE_NO_FIXTURES",
  query,
  ...result,
  acceptance: acceptanceSummary(result),
};
await mkdir("work", { recursive: true });
await writeFile("work/live-acceptance.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
