import { mkdir, writeFile } from "node:fs/promises";

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
  acceptance: {
    discoveryAttempted: result.sourceOutcomes.length === 4,
    candidatesDiscovered: result.offers.length,
    cardsReopened: result.offers.filter((offer) => offer.evidence).length,
    verified: result.offers.filter((offer) => offer.status === "VERIFIED").length,
    outcome: result.offers.some((offer) => offer.status === "VERIFIED") ? "VERIFIED" : "UNVERIFIED",
    limitation: result.offers.length
      ? "Read each offer's evidence and reasons."
      : "No canonical candidates discovered; SKU/card/price/seller stages not reached.",
  },
};
await mkdir("work", { recursive: true });
await writeFile("work/live-acceptance.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
