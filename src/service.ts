import { toolCalls } from "./adapters/http-mcp.js";
import { type City, cities } from "./cities.js";
import { type Connector, connectors, type Discovery, type SourceOutcome } from "./connectors.js";
import type { Offer, ProductProfile } from "./domain.js";
import type { SourceCircuit, SourcePause } from "./source-circuit.js";
import { assess } from "./verification.js";
export async function searchVerified(
  profile: ProductProfile,
  sources: Connector[] = connectors,
  city: City = cities[0],
  circuit?: SourceCircuit,
) {
  const offers: Offer[] = [],
    sourceOutcomes: SourceOutcome[] = [];
  // One source/card at a time bounds browser load and avoids shared-profile races.
  for (const connector of sources) {
    toolCalls.length = 0;
    if (circuit) {
      let pause: SourcePause | undefined;
      try {
        pause = await circuit.get(connector.name);
      } catch {
        sourceOutcomes.push({
          marketplace: connector.name,
          status: "blocked",
          stage: "circuit-state",
          detail: "source_circuit_state_unavailable; network access stopped",
          offersReturned: 0,
        });
        continue;
      }
      if (pause) {
        sourceOutcomes.push({
          marketplace: connector.name,
          status: "blocked",
          stage: "circuit-breaker",
          detail: `${pause.status}; ${pause.detail}; paused at ${pause.blockedAt}`,
          offersReturned: 0,
        });
        continue;
      }
    }
    let discovery: Discovery;
    try {
      discovery = await connector.search(profile, city);
    } catch {
      const outcome = {
        marketplace: connector.name,
        status: "error",
        stage: "discovery",
        detail: "connector_failed",
        offersReturned: 0,
      } as const;
      sourceOutcomes.push(outcome);
      await circuit?.pause(connector.name, "error", outcome.stage, outcome.detail);
      continue;
    }
    const outcome = discovery.outcome;
    sourceOutcomes.push(outcome);
    if (["blocked", "error", "timeout"].includes(outcome.status)) {
      await circuit?.pause(
        connector.name,
        outcome.status as SourcePause["status"],
        outcome.stage,
        outcome.detail,
      );
      outcome.tools = [...toolCalls];
      continue;
    }
    let cardBlocked = false;
    let cardFailed = false;
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
        ) {
          cardBlocked = true;
          outcome.status = "blocked";
          outcome.stage = "card-verification";
          outcome.detail = "product_card_access_blocked; source paused";
        }
        if (
          observed.native?.status === "error" ||
          observed.native?.status === "timeout" ||
          observed.reasons.includes("card_reopen_failed")
        ) {
          cardFailed = true;
          outcome.status = observed.native?.status === "timeout" ? "timeout" : "error";
          outcome.stage = "card-verification";
          outcome.detail = "card_verification_failed; source paused";
        }
        offers.push(assess(candidate, observed, profile));
      } catch (error) {
        console.error("card_reopen_failed", connector.name, (error as Error).message);
        cardFailed = true;
        outcome.status = "error";
        outcome.stage = "card-verification";
        outcome.detail = "card_verification_failed; source paused";
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
    if (cardBlocked || cardFailed)
      await circuit?.pause(
        connector.name,
        cardBlocked ? "blocked" : outcome.status === "timeout" ? "timeout" : "error",
        outcome.stage,
        outcome.detail,
      );
    outcome.tools = [...toolCalls];
  }
  return { offers, sourceOutcomes };
}
