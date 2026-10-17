import type { Offer } from "./domain.js";
export type Landed = {
  item: number | null;
  shipping: number | null;
  duty: number | null;
  total: number | null;
  currency: "RUB";
  region: string | null;
};
export function landed(
  offer: Offer,
  shipping: number | null = offer.shippingRub ?? null,
  duty: number | null = offer.dutyRub ?? null,
): Landed {
  const valid = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0;
  const item = valid(offer.priceRub) && (offer.priceRub ?? 0) > 0 ? offer.priceRub : null;
  shipping = valid(shipping) ? shipping : null;
  duty = valid(duty) ? duty : null;
  return {
    item,
    shipping,
    duty,
    total: item === null || shipping === null || duty === null ? null : item + shipping + duty,
    currency: "RUB",
    region: offer.region ?? null,
  };
}
