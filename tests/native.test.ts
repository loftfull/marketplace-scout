import assert from "node:assert/strict";
import test from "node:test";
import {
  attachNative,
  normalizeNative,
  normalizeOzonSearch,
} from "../src/adapters/native-cards.js";
import { browserRuntime } from "../src/browser.js";
import { MarketplaceConnector, mcp } from "../src/connectors.js";
import type { Offer } from "../src/domain.js";
import { parseQuery } from "../src/parse.js";
import { assess } from "../src/verification.js";

const title = "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB";
const profile = parseQuery(title);
const offer: Offer = {
  marketplace: "ozon",
  sku: "123456",
  url: "https://www.ozon.ru/product/123456/",
  title,
  specs: profile,
  priceRub: 100,
  seller: "Fixture seller",
  status: "UNVERIFIED",
  reasons: [],
};
const raw = {
  sku: 123456,
  url: offer.url,
  name: title,
  prices: {
    price_with_ozon_card_rub: 80,
    price_without_ozon_card_rub: 100,
    price_before_discount_rub: 150,
  },
  seller: { name: "Fixture seller", legal_address: "must not retain" },
};
test("blocked primary discovery stops before specialized or browser fallbacks", async (context) => {
  context.mock.method(browserRuntime, "ensure", async () => ({}));
  context.mock.method(mcp, "call", async () => ({
    offers: [],
    source_outcomes: [{ source: "ozon", status: "blocked", detail: "fixture blocked" }],
  }));
  const page = context.mock.method(browserRuntime, "page", async () => {
    throw new Error("unexpected fallback");
  });
  const result = await new MarketplaceConnector("ozon", "ozon").search(profile);
  assert.equal(result.outcome.status, "blocked");
  assert.equal(result.outcome.stage, "mcp-discovery");
  assert.equal(result.offers.length, 0);
  assert.equal(page.mock.callCount(), 0);
});
test("native labelled prices never overwrite independent evidence or promote blocked cards", () => {
  const native = normalizeNative(offer, raw);
  assert.equal(native.status, "ok");
  assert.equal(native.ordinaryRub, 100);
  assert.equal(native.conditionalRub, 80);
  assert.ok(!JSON.stringify(native).includes("must not retain"));
  const result = assess(
    offer,
    attachNative(
      { ...offer, priceRub: null, specs: {}, reasons: ["card_unavailable_or_challenged"] },
      native,
    ),
    profile,
  );
  assert.equal(result.status, "UNVERIFIED");
  assert.equal(result.priceRub, null);
});
test("native SKU, URL identity, currency and Yandex default variant must match", () => {
  assert.equal(normalizeNative(offer, { ...raw, sku: 654321 }).status, "mismatch");
  assert.equal(
    normalizeNative(offer, { ...raw, url: "https://www.ozon.ru/product/654321/" }).status,
    "mismatch",
  );
  assert.equal(normalizeNative(offer, { ...raw, currency: "USD" }).status, "invalid");
  const market = {
    ...offer,
    marketplace: "yandex-market",
    variantId: "11",
    url: "https://market.yandex.ru/card/laptop/123456?sku=11",
  };
  const card = { product_id: "123456", sku_id: "22", title, url: market.url };
  assert.equal(normalizeNative(market, card).status, "mismatch");
  assert.equal(normalizeNative(market, { ...card, sku_id: "" }).status, "invalid");
  assert.equal(normalizeNative(market, { ...card, sku_id: "11" }).status, "ok");
});
test("native conflicts veto otherwise complete browser verification", () => {
  const observed: Offer = {
    ...offer,
    evidence: {
      method: "browser-card",
      requestedUrl: offer.url,
      finalUrl: offer.url,
      live: true,
      httpStatus: 200,
      observedAt: new Date().toISOString(),
      priceKind: "ordinary",
      available: true,
    },
  };
  assert.equal(assess(offer, observed, profile).status, "VERIFIED");
  for (const changes of [
    { prices: { price_without_ozon_card_rub: 101 } },
    { seller: { name: "Other seller" } },
    { name: title.replace("2026", "2025") },
    { available: false },
  ]) {
    const native = normalizeNative(offer, { ...raw, ...changes });
    const result = assess(offer, attachNative(observed, native), profile);
    assert.equal(result.status, "UNVERIFIED");
    assert.ok(result.reasons.includes("native_card_conflict"));
  }
});
test("malformed money and conditional-only Ozon discovery never become ordinary prices", () => {
  assert.equal(
    normalizeNative(offer, { ...raw, prices: { price_without_ozon_card_rub: "100" } }).ordinaryRub,
    undefined,
  );
  const rows = normalizeOzonSearch(
    { items: [{ sku: 123456, name: title, url: offer.url, price_with_ozon_card_rub: 80 }] },
    profile,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].priceRub, null);
  assert.equal(
    normalizeOzonSearch(
      { items: [{ sku: 123456, name: title, url: "http://127.0.0.1/x" }] },
      profile,
    ).length,
    0,
  );
});
