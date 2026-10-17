import { landed } from "./cost.js";
import type { Offer } from "./domain.js";
import { risk } from "./risk.js";
export function rank(offers: Offer[]) {
  const prices = offers
    .map((offer) => offer.priceRub)
    .filter((price): price is number => price !== null && Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  return offers
    .map((offer) => ({ offer, risk: risk(offer, median) }))
    .sort(
      (a, b) =>
        Number(b.offer.status === "VERIFIED") - Number(a.offer.status === "VERIFIED") ||
        a.risk.score - b.risk.score ||
        (landed(a.offer).total ?? Infinity) - (landed(b.offer).total ?? Infinity),
    );
}
