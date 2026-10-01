import type { Offer } from "./domain.js";
export function risk(o: Offer, median: number | null) {
  const flags: string[] = [];
  if (!o.seller) flags.push("seller_missing");
  if (!o.sku) flags.push("sku_missing");
  if (!o.url) flags.push("canonical_url_missing");
  if (o.priceRub && median && o.priceRub < median * 0.72) flags.push("price_anomaly");
  if (o.status !== "VERIFIED") flags.push("not_verified");
  return { flags, score: Math.min(100, flags.length * 25) };
}
