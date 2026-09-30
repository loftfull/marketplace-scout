import { readCard } from "../browser.js";
import type { Offer } from "../domain.js";
// Independent DOM/JSON-LD read; no Ozon MCP card response can grant VERIFIED.
export async function validateOzon(offer: Offer) {
  if (offer.marketplace !== "ozon") throw new Error("ozon_validator_marketplace_mismatch");
  return readCard(offer);
}
