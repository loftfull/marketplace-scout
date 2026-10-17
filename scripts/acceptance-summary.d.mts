import type { Offer } from "../src/domain.js";
export function acceptanceSummary(result: { offers: Offer[]; sourceOutcomes: unknown[] }): {
  discoveryAttempted: boolean;
  candidatesDiscovered: number;
  browserResponses: number;
  liveCardResponses: number;
  verified: number;
  outcome: string;
  counterDefinitions: string;
  limitation: string;
};
