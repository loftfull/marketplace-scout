export function acceptanceSummary(result) {
  const responses = result.offers.filter((offer) => offer.evidence?.method === "browser-card");
  const verified = result.offers.filter((offer) => offer.status === "VERIFIED").length;
  return {
    discoveryAttempted: result.sourceOutcomes.length === 4,
    candidatesDiscovered: result.offers.length,
    browserResponses: responses.length,
    liveCardResponses: responses.filter(
      ({ evidence }) =>
        evidence.live === true &&
        typeof evidence.httpStatus === "number" &&
        evidence.httpStatus >= 200 &&
        evidence.httpStatus < 300,
    ).length,
    verified,
    outcome: verified ? "VERIFIED" : "UNVERIFIED",
    counterDefinitions:
      "browserResponses includes blocked/challenge responses; liveCardResponses requires browser-card, live=true and HTTP 2xx. Neither proves matching identity, region, price or seller. Missing evidence cannot count browser attempts.",
    limitation: result.offers.length
      ? "Read each offer's evidence and reasons."
      : "No canonical candidates discovered; SKU/card/price/seller stages not reached.",
  };
}
