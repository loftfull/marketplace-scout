export type Status = "VERIFIED" | "UNVERIFIED" | "MISMATCH" | "STALE";
export type ProductProfile = {
  brand: string;
  model: string;
  year?: number;
  cpu?: string;
  ramGb?: number;
  ssdGb?: number;
  gpu?: string;
};
export type Evidence = {
  observedAt: string;
  requestedUrl: string;
  finalUrl: string;
  sku?: string;
  variantId?: string;
  httpStatus?: number;
  live: boolean;
  method: "browser-card";
  priceKind: "ordinary" | "conditional" | "unknown";
  available: boolean | null;
};
export type Offer = {
  native?: NativeEvidence;
  marketplace: string;
  title: string;
  url: string;
  priceRub: number | null;
  seller?: string;
  sku?: string;
  variantId?: string;
  specs: Partial<ProductProfile>;
  status: Status;
  verifiedAt?: string;
  reasons: string[];
  evidence?: Evidence;
  discoveredAt?: string;
  shippingRub?: number | null;
  dutyRub?: number | null;
  region?: string;
  discoveryPriceRub?: number | null;
  imageUrl?: string;
  imageSource?: "discovery" | "card";
};
export type NativeEvidence = {
  provider: string;
  tool: string;
  status: "ok" | "mismatch" | "invalid" | "blocked" | "timeout" | "error";
  observedAt: string;
  sku?: string;
  variantId?: string;
  ordinaryRub?: number;
  conditionalRub?: number;
  referenceRub?: number;
  conditionalLabel?: string;
  seller?: string;
  sellerId?: string;
  sellerRating?: number;
  sellerReviews?: number;
  sellerCheck?: string;
  productRating?: number;
  productRatingScope?: string;
  available?: boolean;
  imageUrl?: string;
  region?: string;
  specs?: Partial<ProductProfile>;
  specReasons?: string[];
};
const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "");
export function match(profile: ProductProfile, offer: Offer) {
  const reasons: string[] = [],
    missing: string[] = [];
  for (const key of ["brand", "model", "year", "cpu", "ramGb", "ssdGb", "gpu"] as const) {
    if (profile[key] === undefined || profile[key] === "") continue;
    if (offer.specs[key] === undefined || offer.specs[key] === "") missing.push(key);
    else if (norm(profile[key]) !== norm(offer.specs[key])) reasons.push(key);
  }
  return { ok: reasons.length === 0 && missing.length === 0, reasons, missing };
}
export function totalPrice(
  offer: Offer,
  shipping: number | null = null,
  duty: number | null = null,
) {
  return offer.priceRub === null || shipping === null || duty === null
    ? null
    : offer.priceRub + shipping + duty;
}
