import { readCard } from "../browser.js";
import type { Offer } from "../domain.js";
import { attachNative, nativeCard } from "./native-cards.js";
// Independent DOM/JSON-LD read; no Ozon MCP card response can grant VERIFIED.
export async function validateOzon(offer: Offer) {
  if (offer.marketplace !== "ozon") throw new Error("ozon_validator_marketplace_mismatch");
  const native = await nativeCard(offer);
  if (native.status === "blocked")
    return attachNative(
      { ...offer, priceRub: null, specs: {}, reasons: ["card_unavailable_or_challenged"] },
      native,
    );
  try {
    return attachNative(await readCard(offer), native);
  } catch {
    return attachNative(
      { ...offer, priceRub: null, specs: {}, reasons: ["card_reopen_failed"], evidence: undefined },
      native,
    );
  }
}
