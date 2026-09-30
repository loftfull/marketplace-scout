import { type Connector, connectors, type Discovery, type SourceOutcome } from "./connectors.js";
import type { Offer, ProductProfile } from "./domain.js";
import { assess } from "./verification.js";
export async function searchVerified(profile: ProductProfile, sources: Connector[] = connectors) {
  const offers: Offer[] = [],
    sourceOutcomes: SourceOutcome[] = [];
  // One source/card at a time bounds browser load and avoids shared-profile races.
  for (const connector of sources) {
    let discovery: Discovery;
    try {
      discovery = await connector.search(profile);
    } catch {
      sourceOutcomes.push({
        marketplace: connector.name,
        status: "error",
        stage: "discovery",
        detail: "connector_failed",
        offersReturned: 0,
      });
      continue;
    }
    sourceOutcomes.push(discovery.outcome);
    for (const candidate of discovery.offers.slice(0, 3)) {
      try {
        offers.push(assess(candidate, await connector.verify(candidate, profile), profile));
      } catch (error) {
        console.error("card_reopen_failed", connector.name, (error as Error).message);
        offers.push({
          ...candidate,
          priceRub: null,
          discoveryPriceRub: candidate.priceRub,
          status: "UNVERIFIED",
          verifiedAt: undefined,
          reasons: ["card_reopen_failed"],
        });
      }
    }
  }
  return { offers, sourceOutcomes };
}
