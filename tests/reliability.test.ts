import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { observation, publicAddress } from "../src/browser.js";
import { type Connector, normalizeDiscovery } from "../src/connectors.js";
import { landed } from "../src/cost.js";
import type { Offer } from "../src/domain.js";
import { freshness } from "../src/freshness.js";
import { parseQuery } from "../src/parse.js";
import { searchVerified } from "../src/service.js";
import { HistoryStore } from "../src/store.js";
import { canonicalUrl } from "../src/urls.js";
import { assess } from "../src/verification.js";

const profile = parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB");
// Synthetic fixtures only: these prices never enter the application/runtime history.
const offer: Offer = {
  marketplace: "ozon",
  title: "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB",
  url: "https://www.ozon.ru/product/test-123456/",
  sku: "123456",
  seller: "Fixture seller",
  priceRub: 140000,
  specs: profile,
  status: "UNVERIFIED",
  reasons: [],
};
const observed = (): Offer => ({
  ...offer,
  evidence: {
    method: "browser-card",
    observedAt: new Date().toISOString(),
    requestedUrl: offer.url,
    finalUrl: offer.url,
    live: true,
    httpStatus: 200,
    priceKind: "ordinary",
    available: true,
  },
});
test("only complete reopened evidence verifies", () =>
  assert.equal(assess(offer, observed(), profile).status, "VERIFIED"));
test("missing specs cannot verify even if upstream claims VERIFIED", () =>
  assert.equal(
    assess(offer, { ...observed(), specs: {}, status: "VERIFIED" }, profile).status,
    "UNVERIFIED",
  ));
test("reopened wrong generation is mismatch", () =>
  assert.equal(
    assess(offer, { ...observed(), specs: { ...profile, year: 2025 } }, profile).status,
    "MISMATCH",
  ));
test("different SKU and redirected product are mismatch", () => {
  assert.equal(assess(offer, { ...observed(), sku: "999" }, profile).status, "MISMATCH");
  const next = observed();
  if (next.evidence) next.evidence.finalUrl = "https://www.ozon.ru/product/999/";
  assert.equal(assess(offer, next, profile).status, "MISMATCH");
});
test("seller, price conditions, availability, evidence and timestamps fail closed", () => {
  for (const change of [
    { seller: undefined },
    { priceRub: null },
    { priceRub: NaN },
    { priceRub: -2 },
    { evidence: undefined },
  ]) {
    assert.equal(assess(offer, { ...observed(), ...change }, profile).status, "UNVERIFIED");
  }
  for (const change of [
    { priceKind: "conditional" as const },
    { available: null },
    { live: false },
    { observedAt: "nonsense" },
    { observedAt: new Date(Date.now() + 60000).toISOString() },
  ]) {
    const next = observed();
    if (next.evidence) Object.assign(next.evidence, change);
    assert.equal(assess(offer, next, profile).status, "UNVERIFIED");
  }
});
test("old, invalid and future verification timestamps", () => {
  const now = Date.now();
  assert.equal(
    freshness(
      { ...offer, status: "VERIFIED", verifiedAt: new Date(now - 900000).toISOString() },
      now,
    ).status,
    "STALE",
  );
  for (const timestamp of ["bad", new Date(now + 1).toISOString()])
    assert.equal(
      freshness({ ...offer, status: "VERIFIED", verifiedAt: timestamp }, now).status,
      "UNVERIFIED",
    );
});
test("unknown landed components never become free", () => {
  assert.equal(landed(offer).total, null);
  assert.equal(landed(offer, 0, 0).total, 140000);
  assert.equal(landed(offer, -1, 0).total, null);
});
test("GB SSD and Russian input parse without stealing RAM", () => {
  assert.equal(parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32 GB 1024 GB").ssdGb, 1024);
  assert.equal(parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32 ГБ 1 ТБ").ssdGb, 1024);
});
test("URLs reject credentials, private hosts, wrong marketplaces and search URLs", () => {
  for (const url of [
    "http://www.ozon.ru/product/123/",
    "https://www.ozon.ru.evil.test/product/123/",
    "https://user@www.ozon.ru/product/123/",
    "https://127.0.0.1/product/123/",
    "https://www.ozon.ru/search/?text=x",
    "https://www.ozon.ru:8443/product/123/",
  ])
    assert.equal(canonicalUrl(url, "ozon"), null);
  assert.equal(canonicalUrl(`${offer.url}?utm_source=x`, "ozon"), offer.url);
  for (const ip of [
    "127.0.0.1",
    "10.0.0.2",
    "169.254.169.254",
    "192.168.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(publicAddress(ip), false);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("concurrent history writes preserve every observation and corruption", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-test-"));
  const path = join(dir, "history.json");
  const store = new HistoryStore(path);
  await Promise.all(Array.from({ length: 20 }, () => store.append(profile, [offer])));
  assert.equal((await store.history()).length, 20);
  await writeFile(path, "broken");
  await assert.rejects(store.append(profile, [offer]));
  assert.equal(await readFile(path, "utf8"), "broken");
});
test("MCP normalization validates schema and canonical native product id", () => {
  const row = {
    source: "ozon",
    product_id: "123456",
    title: offer.title,
    url: offer.url,
    price_rub: 140000,
  };
  assert.equal(
    normalizeDiscovery(
      { offers: [row], source_outcomes: [{ source: "ozon", status: "ok" }] },
      "ozon",
      "ozon",
    ).offers[0].status,
    "UNVERIFIED",
  );
  assert.equal(
    normalizeDiscovery(
      { offers: [{ ...row, product_id: "999" }], source_outcomes: [] },
      "ozon",
      "ozon",
    ).offers.length,
    0,
  );
  assert.throws(() =>
    normalizeDiscovery(
      { offers: [{ ...row, price_rub: -2 }], source_outcomes: [] },
      "ozon",
      "ozon",
    ),
  );
});
test("recommendation JSON-LD cannot supply selected product evidence", () => {
  const snapshot = {
    title: "Product",
    heading: "Unknown laptop",
    products: [{ "@type": "Product", name: offer.title, sku: "123456" }],
    priceText: "",
    sellerText: "",
    availableText: "",
    bodyStart: "",
  };
  const result = observation(snapshot, offer, offer.url, 200);
  assert.equal(result.priceRub, null);
  assert.ok(result.reasons.includes("selected_product_schema_missing_or_ambiguous"));
});
test("service isolates source failures and always rechecks verification", async () => {
  const source: Connector = {
    name: "ozon",
    search: async () => ({
      offers: [offer],
      outcome: {
        marketplace: "ozon",
        status: "ok",
        stage: "discovery",
        detail: "test",
        offersReturned: 1,
      },
    }),
    verify: async () => ({ ...observed(), specs: { ...profile, cpu: "Ultra 5 225H" } }),
  };
  const result = await searchVerified(profile, [
    source,
    {
      ...source,
      name: "avito",
      search: async () => {
        throw new Error("offline");
      },
    },
  ]);
  assert.equal(result.offers[0].status, "MISMATCH");
  assert.equal(result.sourceOutcomes[1].status, "error");
});
test("HTTP static serving, boundary validation and history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-http-"));
  const app = await buildApp({
    sources: [],
    store: new HistoryStore(join(dir, "history.json")),
    logger: false,
    cooldownMs: 0,
  });
  try {
    assert.equal(
      (await app.inject({ url: "/", headers: { host: "127.0.0.1:8787" } })).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/health", headers: { host: "evil.test" } })).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/search?q=test",
          headers: { host: "localhost", origin: "https://evil.test" },
        })
      ).statusCode,
      403,
    );
    assert.equal((await app.inject("/api/search?q=x")).statusCode, 400);
    const result = await app.inject(`/api/search?q=${encodeURIComponent(offer.title)}`);
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().profile.ssdGb, 1024);
  } finally {
    await app.close();
  }
});
