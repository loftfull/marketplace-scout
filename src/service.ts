import { toolCalls } from "./adapters/http-mcp.js";
import { type City, cities } from "./cities.js";
import { type Connector, connectors, type Discovery, type SourceOutcome } from "./connectors.js";
import type { Offer, ProductProfile } from "./domain.js";
import { assess } from "./verification.js";
export async function searchVerified(
  profile: ProductProfile,
  sources: Connector[] = connectors,
  city: City = cities[0],
) {
  const offers: Offer[] = [],
    sourceOutcomes: SourceOutcome[] = [];
  // One source/card at a time bounds browser load and avoids shared-profile races.
  for (const connector of sources) {
    toolCalls.length = 0;
    let discovery: Discovery;
    try {
      discovery = await connector.search(profile, city);
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
    let cardBlocked = false;
    for (const candidate of discovery.offers.slice(0, 3)) {
      candidate.requestedCity = city.name;
      candidate.requestedCityId = city.id;
      try {
        const observed = cardBlocked
          ? {
              ...candidate,
              priceRub: null,
              specs: {},
              evidence: undefined,
              reasons: ["card_unavailable_or_challenged"],
            }
          : await connector.verify(candidate, profile);
        if (
          observed.native?.status === "blocked" ||
          observed.reasons.includes("card_unavailable_or_challenged")
        )
          cardBlocked = true;
        offers.push(assess(candidate, observed, profile));
      } catch (error) {
        console.error("card_reopen_failed", connector.name, (error as Error).message);
        offers.push(
          assess(
            candidate,
            {
              ...candidate,
              priceRub: null,
              specs: {},
              seller: undefined,
              evidence: undefined,
              native: undefined,
              status: "UNVERIFIED",
              verifiedAt: undefined,
              reasons: ["card_reopen_failed"],
            },
            profile,
          ),
        );
      }
    }
    discovery.outcome.tools = [...toolCalls];
  }
  return { offers, sourceOutcomes };
}
