import { cityById, sameCity } from "./cities.js";
import type { Offer } from "./domain.js";
export const MAX_VERIFIED_AGE_MS = 15 * 60 * 1000;
export function freshness(offer: Offer, now = Date.now()): Offer {
  if (offer.status === "MISMATCH" && offer.evidence?.live === false)
    return {
      ...offer,
      status: "UNVERIFIED",
      reasons: [
        ...offer.reasons.filter((reason) => !reason.startsWith("mismatch_")),
        "live_card_not_confirmed",
      ],
    };
  if (offer.status !== "VERIFIED") return offer;
  const timestamp = Date.parse(offer.verifiedAt ?? "");
  if (!Number.isFinite(timestamp) || timestamp > now)
    return {
      ...offer,
      status: "UNVERIFIED",
      reasons: [...offer.reasons, "verification_time_invalid"],
    };
  if (now - timestamp >= MAX_VERIFIED_AGE_MS)
    return { ...offer, status: "STALE", reasons: [...offer.reasons, "verification_expired"] };
  const city = offer.requestedCityId ? cityById(offer.requestedCityId) : undefined;
  if (
    !city ||
    !sameCity(offer.evidence?.region, city) ||
    (offer.native?.region && !sameCity(offer.native.region, city))
  )
    return { ...offer, status: "UNVERIFIED", reasons: [...offer.reasons, "region_not_confirmed"] };
  return offer;
}
