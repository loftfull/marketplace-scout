import { resolve } from "node:path";
import type { Discovery } from "../connectors.js";
import type { NativeEvidence, Offer, ProductProfile } from "../domain.js";
import { match } from "../domain.js";
import { enrichImages } from "../images.js";
import { parseQuery, queryFor } from "../parse.js";
import { cardSpecs } from "../specs.js";
import { canonicalUrl, skuFromUrl } from "../urls.js";
import { McpClient, toolFailure } from "./http-mcp.js";

const runtime = resolve(".runtime/yandex-market-mcp");
export const yandexMcp = new McpClient({
  command: resolve(
    runtime,
    process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
  ),
  args: [resolve("scripts/yandex-http.py")],
  cwd: resolve("."),
  env: {
    PYTHONPATH: resolve(runtime, "src"),
    YM_CACHE_DIR: resolve(".runtime/yandex-state"),
    YM_EXPECTED_REGION: "",
  },
  provider: "SZhukovWork/yandex-market-mcp",
});
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
const id = (value: unknown): string | undefined => {
  if (typeof value === "string" && /^[1-9]\d{0,19}$/.test(value)) return value;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : undefined;
};
const money = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
function variantMatches(value: unknown, variant: string | undefined): boolean {
  if (typeof value !== "string" || !variant) return false;
  try {
    const values = new URL(value).searchParams.getAll("sku");
    return values.length === 0 || (values.length === 1 && values[0] === variant);
  } catch {
    return false;
  }
}
export function normalizeMarketSearch(raw: unknown, profile: ProductProfile): Offer[] {
  const response = record(raw);
  if (!Array.isArray(response.items)) throw Error("invalid_market_response");
  const offers: Offer[] = [];
  for (const item of response.items.slice(0, 40)) {
    const row = record(item),
      sku = id(row.card_id),
      variantId = id(row.sku_id),
      title = str(row.title);
    const modelKey = profile.model.toLowerCase().replace(/[^a-zа-я0-9]/g, "");
    const titleKey = (title ?? "").toLowerCase().replace(/[^a-zа-я0-9]/g, "");
    if (modelKey && !titleKey.includes(modelKey)) continue;
    const url = canonicalUrl(str(row.url) ?? "", "yandex-market");
    if (!variantMatches(row.url, variantId)) continue;
    if (!sku || !variantId || !title || !url || skuFromUrl(new URL(url), "yandex-market") !== sku)
      continue;
    const canonical = new URL(url);
    canonical.searchParams.set("sku", variantId);
    offers.push({
      marketplace: "yandex-market",
      sku,
      variantId,
      title,
      url: canonical.href,
      priceRub: money(row.price_rub) ?? null,
      discoveryPriceKind: "ordinary",
      discoveryConditionalRub: money(row.price_with_pay_card_rub),
      discoveryReferenceRub: money(row.price_before_discount_rub),
      discoveryProvider: "SZhukovWork/yandex-market-mcp",
      discoveryRegion: str(record(response.city).name),
      seller: str(row.seller),
      specs: parseQuery(title),
      status: "UNVERIFIED",
      reasons: [],
      discoveredAt: new Date().toISOString(),
    });
  }
  offers.sort((a, b) => {
    const x = match(profile, a),
      y = match(profile, b);
    return x.reasons.length * 10 + x.missing.length - y.reasons.length * 10 - y.missing.length;
  });
  return offers.slice(0, 3);
}
export async function searchMarket(profile: ProductProfile): Promise<Discovery> {
  try {
    let offers = normalizeMarketSearch(
      await yandexMcp.call(
        "search_products",
        { query: queryFor(profile), sort: "popular" },
        35000,
        AbortSignal.timeout(40000),
      ),
      profile,
    );
    if (offers.length) offers = await enrichImages(offers, queryFor(profile));
    return {
      offers,
      outcome: {
        marketplace: "yandex-market",
        status: offers.length ? "ok" : "empty",
        stage: "native-discovery",
        detail: "ordinary/Pay/reference separated; city from page",
        offersReturned: offers.length,
      },
    };
  } catch (error) {
    return {
      offers: [],
      outcome: {
        marketplace: "yandex-market",
        status: toolFailure(error),
        stage: "native-discovery",
        detail: "specialized_market_failed; no alternate provider retry",
        offersReturned: 0,
      },
    };
  }
}
export function normalizeMarketCard(offer: Offer, raw: unknown): NativeEvidence {
  const base: NativeEvidence = {
    provider: "SZhukovWork/yandex-market-mcp",
    tool: "get_product",
    status: "invalid",
    observedAt: new Date().toISOString(),
  };
  const row = record(raw),
    sku = id(row.card_id),
    variantId = id(row.sku_id);
  const url = canonicalUrl(str(row.url) ?? "", "yandex-market");
  if (!variantMatches(row.url, variantId)) return { ...base, status: "mismatch" };
  if (!sku || !variantId || !url || !str(row.title)) return base;
  if (
    sku !== offer.sku ||
    variantId !== offer.variantId ||
    skuFromUrl(new URL(url), "yandex-market") !== sku
  )
    return { ...base, status: "mismatch" };
  const prices = record(row.price),
    seller = record(row.seller);
  const specs = cardSpecs(
    str(row.title) ?? "",
    Array.isArray(row.specs) ? row.specs.slice(0, 100).map(record) : [],
  );
  return {
    ...base,
    status: "ok",
    sku,
    variantId,
    ordinaryRub: money(prices.price_rub),
    conditionalRub: money(prices.price_with_pay_card_rub),
    conditionalLabel: "С картой Яндекс Пэй",
    referenceRub: money(prices.price_before_discount_rub),
    seller: str(seller.name),
    sellerId: id(seller.business_id),
    region: str(record(row.city).name),
    specs: specs.specs,
    specReasons: specs.reasons,
    available: typeof row.stock_left === "number" && row.stock_left > 0 ? true : undefined,
  };
}
export async function marketCard(offer: Offer): Promise<NativeEvidence> {
  const url = canonicalUrl(offer.url, "yandex-market");
  const cardId = url ? new URL(url).pathname.match(/^\/card\/[^/]+\/(\d+)\/?$/)?.[1] : undefined;
  if (
    !cardId ||
    !id(offer.sku) ||
    cardId !== offer.sku ||
    !variantMatches(offer.url, offer.variantId)
  )
    return {
      provider: "SZhukovWork/yandex-market-mcp",
      tool: "get_product",
      status: "invalid",
      observedAt: new Date().toISOString(),
    };
  try {
    return normalizeMarketCard(
      offer,
      await yandexMcp.call(
        "get_product",
        // Upstream full-matches numeric IDs; its URL parser can truncate long IDs.
        { product: cardId, include_seller_legal: false },
        25000,
        AbortSignal.timeout(30000),
      ),
    );
  } catch (error) {
    return {
      provider: "SZhukovWork/yandex-market-mcp",
      tool: "get_product",
      status: toolFailure(error) as NativeEvidence["status"],
      observedAt: new Date().toISOString(),
    };
  }
}
