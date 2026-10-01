import assert from "node:assert/strict";
import test from "node:test";
import { acceptanceSummary } from "../scripts/acceptance-summary.mjs";
import { marketCard, normalizeMarketSearch, yandexMcp } from "../src/adapters/yandex.js";
import type { Offer } from "../src/domain.js";
import { parseQuery } from "../src/parse.js";

const title = "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB";
const profile = parseQuery(title);
const offer: Offer = {
  marketplace: "yandex-market",
  title,
  sku: "6013745409",
  variantId: "12345",
  url: "https://market.yandex.ru/card/laptop/6013745409?sku=12345",
  specs: profile,
  priceRub: null,
  status: "UNVERIFIED",
  reasons: [],
};

test("Market native calls pass exact numeric strings, never the truncating URL branch", async (t) => {
  const calls: unknown[] = [];
  t.mock.method(yandexMcp, "call", async (_name: string, args: unknown) => {
    calls.push(args);
    return {};
  });
  for (const sku of ["6013745409", "227753481523236864"])
    await marketCard({
      ...offer,
      sku,
      url: `https://market.yandex.ru/card/laptop/${sku}?sku=12345`,
    });
  assert.deepEqual(calls, [
    { product: "6013745409", include_seller_legal: false },
    { product: "227753481523236864", include_seller_legal: false },
  ]);
});

test("Market rejects foreign/model paths and identity/variant disagreement before MCP", async (t) => {
  const call = t.mock.method(yandexMcp, "call", async () => {
    throw Error("must not call");
  });
  for (const change of [
    { url: "https://market.yandex.ru/product/laptop/6013745409?sku=12345" },
    { url: "https://market.yandex.ru/product--laptop/6013745409?sku=12345" },
    { url: "https://evil.example/card/laptop/6013745409?sku=12345" },
    { sku: "99999" },
    { sku: undefined },
    { variantId: "99999" },
    { variantId: undefined },
    { url: `${offer.url}&sku=99999` },
  ])
    assert.equal((await marketCard({ ...offer, ...change })).status, "invalid");
  assert.equal(call.mock.callCount(), 0);
});

test("Market discovery preserves long string IDs but rejects lossy numeric identities", () => {
  const make = (card_id: string | number, sku_id: string | number = "12345") => ({
    items: [{ card_id, sku_id, title, url: `https://market.yandex.ru/card/laptop/${card_id}` }],
  });
  assert.equal(
    normalizeMarketSearch(make("227753481523236864"), profile)[0].sku,
    "227753481523236864",
  );
  assert.deepEqual(normalizeMarketSearch(make(Number("227753481523236864")), profile), []);
  assert.deepEqual(normalizeMarketSearch(make("6013745409", 9007199254740992), profile), []);
  assert.equal(normalizeMarketSearch(make(6013745409, 12345), profile)[0].sku, "6013745409");
});

test("acceptance separates browser responses from live pages and verified offers", () => {
  const evidence = {
    method: "browser-card" as const,
    observedAt: "2026-10-01T00:00:00Z",
    requestedUrl: offer.url,
    finalUrl: offer.url,
    priceKind: "unknown" as const,
    available: null,
  };
  const result = acceptanceSummary({
    sourceOutcomes: [{}, {}, {}, {}],
    offers: [
      offer,
      { ...offer, evidence: { ...evidence, live: false, httpStatus: 403 } },
      { ...offer, evidence: { ...evidence, live: false, httpStatus: 200 } },
      { ...offer, evidence: { ...evidence, live: true } },
      { ...offer, evidence: { ...evidence, live: true, httpStatus: 200 } },
    ],
  });
  assert.equal(result.browserResponses, 4);
  assert.equal(result.liveCardResponses, 1);
  assert.equal(result.verified, 0);
  assert.equal(result.outcome, "UNVERIFIED");
  assert.ok(!("cardsReopened" in result));
});
