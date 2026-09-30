import { resolve } from "node:path";
import { z } from "zod";
import { safeImage } from "../public/offer-view.js";
import { McpClient } from "./adapters/http-mcp.js";
import type { Offer } from "./domain.js";
import { canonicalUrl, skuFromUrl } from "./urls.js";

const runtime = resolve(".runtime/ru-marketplace-mcp");
export const imageMcp = new McpClient({
  command: resolve(
    runtime,
    process.platform === "win32" ? ".venv/Scripts/yandex-mcp.exe" : ".venv/bin/yandex-mcp",
  ),
  args: [],
  cwd: runtime,
});
const imageRows = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string(),
        sku_id: z.string(),
        url: z.string(),
        image: z.string().optional(),
      }),
    )
    .max(48),
});
export function joinImages(offers: Offer[], raw: unknown): Offer[] {
  const parsed = imageRows.safeParse(raw);
  if (!parsed.success) return offers;
  return offers.map((offer) => {
    if (offer.marketplace !== "yandex-market" || !offer.sku || !offer.variantId) return offer;
    const matches = parsed.data.items.filter((row) => {
      const url = canonicalUrl(row.url, offer.marketplace);
      return (
        row.product_id === offer.sku &&
        row.sku_id === offer.variantId &&
        url &&
        skuFromUrl(new URL(url), offer.marketplace) === offer.sku &&
        (!new URL(url).searchParams.get("sku") ||
          new URL(url).searchParams.get("sku") === offer.variantId)
      );
    });
    if (matches.length !== 1) return offer;
    const image = safeImage(matches[0].image, offer.marketplace);
    return image ? { ...offer, imageUrl: image, imageSource: "discovery" } : offer;
  });
}
export async function enrichImages(offers: Offer[], query: string): Promise<Offer[]> {
  try {
    const raw = await imageMcp.call(
      "yandex_search",
      { query, limit: 20 },
      10000,
      AbortSignal.timeout(15000),
    );
    return joinImages(offers, raw);
  } catch {
    return offers;
  }
}
