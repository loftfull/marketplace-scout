import { match, type Offer, type ProductProfile } from "./domain.js";
import { freshness } from "./freshness.js";
import { marketplaceUrl, skuFromUrl } from "./urls.js";
export function assess(discovered: Offer, observed: Offer, profile: ProductProfile): Offer {
  const reasons = [...observed.reasons];
  const identity = match(profile, observed);
  const requested = marketplaceUrl(discovered.url, discovered.marketplace);
  const final = marketplaceUrl(observed.evidence?.finalUrl ?? "", discovered.marketplace);
  const wrongSku = Boolean(discovered.sku && observed.sku && discovered.sku !== observed.sku);
  const urlVariants =
    discovered.marketplace === "yandex-market"
      ? [
          requested?.searchParams.get("sku"),
          final?.searchParams.get("sku"),
          discovered.variantId,
          observed.variantId,
        ].filter(Boolean)
      : [];
  if (new Set(urlVariants).size > 1) reasons.push("sku_or_marketplace_changed");
  const wrongVariant = Boolean(
    discovered.variantId && observed.variantId && discovered.variantId !== observed.variantId,
  );
  if (
    observed.marketplace !== discovered.marketplace ||
    wrongSku ||
    wrongVariant ||
    (requested &&
      final &&
      skuFromUrl(requested, discovered.marketplace) !== skuFromUrl(final, discovered.marketplace))
  )
    reasons.push("sku_or_marketplace_changed");
  if (observed.evidence?.live && identity.reasons.length)
    reasons.push(...identity.reasons.map((key) => `mismatch_${key}`));
  const mismatch = reasons.some(
    (reason) => reason === "sku_or_marketplace_changed" || reason.startsWith("mismatch_"),
  );
  reasons.push(...identity.missing.map((key) => `missing_${key}`));
  if (
    !requested ||
    !final ||
    !observed.evidence?.live ||
    !(
      observed.evidence.httpStatus !== undefined &&
      observed.evidence.httpStatus >= 200 &&
      observed.evidence.httpStatus < 300
    ) ||
    observed.evidence.requestedUrl !== discovered.url ||
    observed.evidence.method !== "browser-card"
  )
    reasons.push("live_card_not_confirmed");
  if (!observed.sku || !discovered.sku) reasons.push("sku_missing");
  if (discovered.variantId && !observed.variantId) reasons.push("variant_missing");
  if (!observed.seller?.trim()) reasons.push("seller_missing");
  if (!(observed.priceRub !== null && Number.isFinite(observed.priceRub) && observed.priceRub > 0))
    reasons.push("current_price_missing");
  if (observed.evidence?.priceKind !== "ordinary")
    reasons.push("unconditional_price_not_confirmed");
  if (observed.evidence?.available !== true) reasons.push("availability_not_confirmed");
  const status =
    mismatch && observed.evidence?.live ? "MISMATCH" : reasons.length ? "UNVERIFIED" : "VERIFIED";
  return freshness({
    ...observed,
    url: discovered.url,
    sku: observed.sku ?? discovered.sku,
    discoveredAt: discovered.discoveredAt,
    discoveryPriceRub: discovered.priceRub,
    status,
    verifiedAt: status === "VERIFIED" ? observed.evidence?.observedAt : undefined,
    reasons: [...new Set(reasons)],
  });
}
