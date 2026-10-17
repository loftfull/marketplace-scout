import { resolve } from "node:path";
import { safeImage } from "../../public/offer-view.js";
import type { NativeEvidence, Offer, ProductProfile } from "../domain.js";
import { match } from "../domain.js";
import { imageMcp } from "../images.js";
import { parseQuery } from "../parse.js";
import { cardSpecs } from "../specs.js";
import { canonicalUrl, skuFromUrl } from "../urls.js";
import { McpClient, toolFailure } from "./http-mcp.js";
import { callOzon } from "./ozon-runtime.js";

const runtime = resolve(".runtime/ru-marketplace-mcp");
export const avitoMcp = new McpClient({
  command: resolve(
    runtime,
    process.platform === "win32" ? ".venv/Scripts/avito-mcp.exe" : ".venv/bin/avito-mcp",
  ),
  args: [],
  cwd: runtime,
});
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
const id = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : text(value);
const money = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
const rating = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5
    ? value
    : undefined;
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
export function nativeBase(offer: Offer): NativeEvidence {
  return {
    provider: offer.marketplace === "ozon" ? "SZhukovWork/ozon-mcp" : "ru-marketplace-mcp",
    tool:
      offer.marketplace === "ozon"
        ? "get_product"
        : offer.marketplace === "avito"
          ? "avito_card"
          : "yandex_card",
    status: "error",
    observedAt: new Date().toISOString(),
  };
}
export function normalizeNative(offer: Offer, raw: unknown): NativeEvidence {
  const result = nativeBase(offer),
    row = record(raw);
  const sku = id(row.product_id ?? row.item_id ?? row.sku);
  const variantId = id(row.sku_id);
  const url = canonicalUrl(text(row.url) ?? "", offer.marketplace);
  if (
    !sku ||
    !offer.sku ||
    !url ||
    (offer.marketplace === "yandex-market" && (!offer.variantId || !variantId))
  )
    return { ...result, status: "invalid" };
  if (
    sku !== offer.sku ||
    skuFromUrl(new URL(url), offer.marketplace) !== sku ||
    (offer.variantId && variantId !== offer.variantId) ||
    (offer.marketplace === "yandex-market" &&
      new URL(url).searchParams.get("sku") &&
      new URL(url).searchParams.get("sku") !== variantId)
  )
    return { ...result, status: "mismatch" };
  const title = text(row.title ?? row.name);
  if (!title || (row.currency && !["RUB", "RUR"].includes(String(row.currency))))
    return { ...result, status: "invalid" };
  const properties = Array.isArray(row.characteristics)
    ? row.characteristics
        .slice(0, 100)
        .map(record)
        .filter((r) => text(r.name) && text(r.value))
        .map((r) => ({ name: text(r.name) as string, value: text(r.value) as string }))
    : [];
  const specs = cardSpecs(title, properties);
  const seller = record(row.seller),
    prices = record(row.prices);
  const isOzon = offer.marketplace === "ozon";
  return {
    ...result,
    status: "ok",
    sku,
    variantId,
    specs: specs.specs,
    specReasons: specs.reasons,
    ordinaryRub: money(isOzon ? prices.price_without_ozon_card_rub : row.price_rub),
    conditionalRub: money(isOzon ? prices.price_with_ozon_card_rub : row.price_with_plus),
    conditionalLabel: isOzon ? "С Ozon Картой" : "С Яндекс Плюс/Pay",
    referenceRub: money(isOzon ? prices.price_before_discount_rub : row.price_before_discount_rub),
    seller: text(typeof row.seller === "string" ? row.seller : seller.name),
    sellerId: id(seller.seller_id),
    sellerRating: rating(seller.rating_score ?? seller.rating),
    sellerReviews: count(seller.rating_count),
    productRating: rating(isOzon ? record(record(row.rating).shown_on_card).rating : row.rating),
    productRatingScope: isOzon ? "карточка; может объединять варианты" : "карточка товара",
    available: typeof row.available === "boolean" ? row.available : undefined,
    imageUrl:
      safeImage(typeof row.image === "string" ? row.image : undefined, offer.marketplace) ??
      undefined,
    region: text(record(row.region).city),
  };
}
export async function nativeCard(offer: Offer): Promise<NativeEvidence> {
  try {
    const raw =
      offer.marketplace === "ozon"
        ? await callOzon("get_product", {
            product: offer.url,
            include_variants: false,
            include_other_sellers: false,
            include_description: true,
          })
        : offer.marketplace === "yandex-market"
          ? await imageMcp.call(
              "yandex_card",
              { product_id: offer.sku, include_reviews: false },
              25000,
              AbortSignal.timeout(30000),
            )
          : await avitoMcp.call(
              "avito_card",
              { item_id_or_url: offer.url },
              25000,
              AbortSignal.timeout(30000),
            );
    const result = normalizeNative(offer, raw);
    if (
      offer.marketplace === "avito" &&
      result.status === "ok" &&
      result.sellerId &&
      /^[A-Za-z0-9_-]{1,100}$/.test(result.sellerId)
    ) {
      try {
        const profile = record(
          await avitoMcp.call(
            "avito_seller",
            { seller_id_or_url: result.sellerId },
            15000,
            AbortSignal.timeout(20000),
          ),
        );
        const seller = record(profile.seller);
        if (id(seller.seller_id) === result.sellerId) {
          result.sellerRating = rating(seller.rating_score);
          result.sellerReviews = count(seller.rating_count);
          result.sellerCheck = "ok";
        } else result.sellerCheck = "identity_mismatch";
      } catch (error) {
        result.sellerCheck = toolFailure(error);
      }
    }
    return result;
  } catch (error) {
    return { ...nativeBase(offer), status: toolFailure(error) as NativeEvidence["status"] };
  }
}
export function attachNative(observed: Offer, native: NativeEvidence): Offer {
  const reasons = [...observed.reasons];
  if (native.status === "mismatch") reasons.push("native_identity_unmatched");
  if (native.status === "ok") {
    const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    if (
      (native.ordinaryRub !== undefined &&
        observed.priceRub !== null &&
        native.ordinaryRub !== observed.priceRub) ||
      (native.seller && observed.seller && norm(native.seller) !== norm(observed.seller)) ||
      (native.available === false && observed.evidence?.available === true) ||
      native.specReasons?.length ||
      match(observed.specs as ProductProfile, { ...observed, specs: native.specs ?? {} }).reasons
        .length
    )
      reasons.push("native_card_conflict");
  }
  return { ...observed, native, reasons };
}
export function normalizeOzonSearch(raw: unknown, profile: ProductProfile): Offer[] {
  const row = record(raw);
  if (!Array.isArray(row.items)) throw new Error("invalid_ozon_search");
  const offers: Offer[] = [];
  for (const item of row.items.slice(0, 40)) {
    const value = record(item),
      sku = id(value.sku),
      title = text(value.name);
    const url = canonicalUrl(text(value.url) ?? "", "ozon");
    if (!sku || !title || !url || skuFromUrl(new URL(url), "ozon") !== sku) continue;
    offers.push({
      marketplace: "ozon",
      sku,
      title,
      url,
      priceRub: money(value.price_rub) ?? null,
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
