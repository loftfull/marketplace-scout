import { z } from "zod";
import { McpClient } from "./adapters/http-mcp.js";
import { validateOzon } from "./adapters/ozon-validator.js";
import { browserDiscovery, browserRuntime, readCard } from "./browser.js";
import { match, type Offer, type ProductProfile } from "./domain.js";
import { enrichImages } from "./images.js";
import { parseQuery, queryFor } from "./parse.js";
import { canonicalUrl, skuFromUrl } from "./urls.js";
export type SourceOutcome = {
  marketplace: string;
  status: string;
  stage: string;
  detail: string;
  offersReturned: number;
  discoveryUrl?: string;
};
export type Discovery = { offers: Offer[]; outcome: SourceOutcome };
export interface Connector {
  name: string;
  search(profile: ProductProfile): Promise<Discovery>;
  verify(offer: Offer, profile: ProductProfile): Promise<Offer>;
}
const responseSchema = z.object({
  offers: z.array(
    z.object({
      source: z.string(),
      product_id: z.string(),
      variant_id: z.string().optional(),
      title: z.string(),
      url: z.string(),
      price_rub: z.number().finite().positive().nullable().optional(),
      seller: z.string().optional(),
    }),
  ),
  source_outcomes: z.array(
    z.object({ source: z.string(), status: z.string(), detail: z.string().optional() }),
  ),
});
export function normalizeDiscovery(
  raw: unknown,
  marketplace: string,
  source: string,
  profile?: ProductProfile,
): Discovery {
  const result = responseSchema.parse(raw);
  const outcome = result.source_outcomes.find((row) => row.source === source);
  const offers: Offer[] = [];
  for (const row of result.offers.filter((row) => row.source === source).slice(0, 20)) {
    const url = canonicalUrl(row.url, marketplace);
    if (!url || skuFromUrl(new URL(url), marketplace) !== row.product_id) continue;
    const parsedUrl = new URL(url);
    if (marketplace === "yandex-market" && row.variant_id)
      parsedUrl.searchParams.set("sku", row.variant_id);
    offers.push({
      marketplace,
      title: row.title,
      url: parsedUrl.href,
      sku: row.product_id,
      variantId: row.variant_id || undefined,
      seller: row.seller || undefined,
      priceRub: row.price_rub ?? null,
      specs: parseQuery(row.title),
      status: "UNVERIFIED",
      reasons: [],
      discoveredAt: new Date().toISOString(),
    });
  }
  if (profile)
    offers.sort((a, b) => {
      const left = match(profile, a),
        right = match(profile, b);
      return (
        left.reasons.length * 10 +
        left.missing.length -
        (right.reasons.length * 10 + right.missing.length)
      );
    });
  const candidates = offers.slice(0, 3);
  return {
    offers: candidates,
    outcome: {
      marketplace,
      status: outcome?.status ?? "error",
      stage: "mcp-discovery",
      detail: outcome?.detail?.slice(0, 300) ?? "source_outcome_missing",
      offersReturned: candidates.length,
    },
  };
}
export const mcp = new McpClient();
export class MarketplaceConnector implements Connector {
  constructor(
    public name: string,
    private source: string,
  ) {}
  async search(profile: ProductProfile): Promise<Discovery> {
    let result: Discovery;
    try {
      await browserRuntime.ensure();
      result = normalizeDiscovery(
        await mcp.call("compare_prices", {
          query: queryFor(profile),
          sources: [this.source],
          per_source_limit: 20,
        }),
        this.name,
        this.source,
        profile,
      );
    } catch {
      result = {
        offers: [],
        outcome: {
          marketplace: this.name,
          status: "error",
          stage: "mcp-discovery",
          detail: "mcp_unavailable_or_invalid_response; see local runtime log",
          offersReturned: 0,
        },
      };
    }
    if (result.offers.length && this.name === "yandex-market")
      result.offers = await enrichImages(result.offers, queryFor(profile));
    if (result.offers.length || result.outcome.status === "blocked") return result;
    try {
      const browser = await browserDiscovery(this.name, profile);
      return {
        offers: browser.offers,
        outcome: {
          marketplace: this.name,
          status: browser.status,
          stage: "browser-discovery",
          detail: `${result.outcome.status}: ${result.outcome.detail}; browser: ${browser.detail}`,
          offersReturned: browser.offers.length,
          discoveryUrl: browser.url,
        },
      };
    } catch (error) {
      result.outcome.detail += `; browser: ${(error as Error).message.includes("Timeout") ? "timeout" : "unavailable"}`;
      return result;
    }
  }
  async verify(offer: Offer, _profile: ProductProfile) {
    return this.name === "ozon" ? validateOzon(offer) : readCard(offer);
  }
}
export const connectors: Connector[] = [
  new MarketplaceConnector("yandex-market", "yandex_market"),
  new MarketplaceConnector("ozon", "ozon"),
  new MarketplaceConnector("avito", "avito"),
];
