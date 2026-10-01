import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { priceFor, requestSelection } from "../public/offer-view.js";
import { toolFailure } from "../src/adapters/http-mcp.js";
import {
  destinationFrom,
  normalizeWbCard,
  normalizeWbSearch,
} from "../src/adapters/wildberries.js";
import { normalizeMarketCard, normalizeMarketSearch } from "../src/adapters/yandex.js";
import { buildApp } from "../src/app.js";
import { cities, cityById } from "../src/cities.js";
import type { Connector } from "../src/connectors.js";
import type { Offer } from "../src/domain.js";
import { freshness } from "../src/freshness.js";
import { parseQuery } from "../src/parse.js";
import { searchVerified } from "../src/service.js";
import { HistoryStore } from "../src/store.js";
import { canonicalUrl } from "../src/urls.js";
import { assess } from "../src/verification.js";

const profile = parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB");
test("verification exceptions retain region and product conflicts outside comparison", async () => {
  const source: Connector = {
    name: "fixture",
    async search() {
      return {
        offers: [
          {
            ...offer,
            discoveryRegion: "Москва",
            discoveryPriceKind: "ordinary",
            specs: { ...profile, cpu: "255H" },
          },
        ],
        outcome: {
          marketplace: "fixture",
          status: "ok",
          stage: "fixture",
          detail: "test only",
          offersReturned: 1,
        },
      };
    },
    async verify() {
      throw new Error("fixture card failure");
    },
  };
  const { offers } = await searchVerified(profile, [source], cities[0]);
  assert.equal(offers[0].status, "UNVERIFIED");
  for (const reason of ["card_reopen_failed", "region_conflict", "discovery_specs_conflict"])
    assert.ok(offers[0].reasons.includes(reason));
  assert.equal(priceFor(offers[0], "discovery"), null);
  assert.equal(priceFor(offers[0], "current"), null);
});
test("unrelated advertised Market products do not become laptop candidates", () => {
  const items = [
    {
      card_id: "123",
      sku_id: "456",
      title: "Смартфон X7 Pro 16/1024GB",
      url: "https://market.yandex.ru/card/phone/123",
      price_rub: 13155,
    },
  ];
  assert.deepEqual(normalizeMarketSearch({ items }, profile), []);
});
test("a blocked card stops subsequent card requests and cooldown is classified blocked", async () => {
  let calls = 0;
  const source: Connector = {
    name: "fixture",
    async search() {
      return {
        offers: [{ ...offer }, { ...offer, sku: "456" }],
        outcome: {
          marketplace: "fixture",
          status: "ok",
          stage: "fixture",
          detail: "fixture",
          offersReturned: 2,
        },
      };
    },
    async verify(candidate) {
      calls++;
      return {
        ...candidate,
        priceRub: null,
        native: {
          provider: "fixture",
          tool: "card",
          status: "blocked",
          observedAt: new Date().toISOString(),
        },
        reasons: ["card_unavailable_or_challenged"],
      };
    },
  };
  const result = await searchVerified(profile, [source], cities[0]);
  assert.equal(calls, 1);
  assert.equal(result.offers.length, 2);
  assert.ok(result.offers.every((row) => row.status === "UNVERIFIED" && row.priceRub === null));
  assert.equal(
    toolFailure("Market was rate limiting this IP; server pauses until 10:00"),
    "blocked",
  );
});
const offer: Offer = {
  marketplace: "ozon",
  sku: "123",
  title: "Fixture",
  url: "https://www.ozon.ru/product/123/",
  specs: profile,
  seller: "Fixture",
  priceRub: 100,
  status: "UNVERIFIED",
  reasons: [],
  requestedCityId: "voronezh",
  requestedCity: "Воронеж",
};
const observed = {
  ...offer,
  evidence: {
    observedAt: new Date().toISOString(),
    requestedUrl: offer.url,
    finalUrl: offer.url,
    live: true,
    httpStatus: 200,
    method: "browser-card",
    priceKind: "ordinary",
    available: true,
    region: "Воронеж",
  },
} satisfies Offer;
test("card region is required; request city and native city alone cannot verify", () => {
  assert.equal(assess(offer, observed, profile).status, "VERIFIED");
  for (const region of [undefined, "Москва"]) {
    const result = assess(
      offer,
      {
        ...observed,
        evidence: { ...observed.evidence, region },
        native: {
          provider: "fixture",
          tool: "card",
          status: "ok",
          observedAt: new Date().toISOString(),
          region: "Воронеж",
        },
      },
      profile,
    );
    assert.equal(result.status, "UNVERIFIED");
    assert.ok(result.reasons.includes("region_not_confirmed"));
  }
  assert.equal(
    assess(
      offer,
      {
        ...observed,
        native: {
          provider: "fixture",
          tool: "card",
          status: "ok",
          observedAt: new Date().toISOString(),
          region: "Москва",
        },
      },
      profile,
    ).status,
    "UNVERIFIED",
  );
  assert.equal(
    freshness({
      ...observed,
      status: "VERIFIED",
      verifiedAt: new Date().toISOString(),
      requestedCityId: undefined,
    }).status,
    "UNVERIFIED",
  );
});
test("city API defaults Voronezh, rejects unknown IDs, snapshots propagation and history", async () => {
  const seen: string[] = [];
  const source: Connector = {
    name: "fixture",
    async search(_profile, city) {
      assert.ok(city);
      seen.push(city.id);
      return {
        offers: [{ ...offer }],
        outcome: {
          marketplace: "fixture",
          status: "ok",
          stage: "fixture",
          detail: "test only",
          offersReturned: 1,
        },
      };
    },
    async verify(candidate) {
      return {
        ...observed,
        requestedCity: candidate.requestedCity,
        evidence: { ...observed.evidence, region: candidate.requestedCity },
      };
    },
  };
  const app = await buildApp({
    sources: [source],
    logger: false,
    cooldownMs: 0,
    store: new HistoryStore(join(await mkdtemp(join(tmpdir(), "scout-city-")), "history.json")),
  });
  try {
    assert.equal((await app.inject("/api/search?q=laptop&city=unknown")).statusCode, 400);
    assert.equal(
      (await app.inject("/api/search?q=laptop&city=voronezh&city=moskva")).statusCode,
      400,
    );
    const result = (await app.inject("/api/search?q=laptop")).json();
    assert.equal(result.requestedCity.id, "voronezh");
    const second = await app.inject("/api/search?q=laptop&city=moskva");
    assert.equal(second.statusCode, 200, second.body);
    assert.deepEqual(seen, ["voronezh", "moskva"]);
    const history = (await app.inject("/api/history")).json().rows;
    assert.deepEqual(
      history.map((row: { offer: Offer }) => row.offer.requestedCity),
      ["Москва", "Воронеж"],
    );
    assert.equal((await app.inject("/api/connectors")).json().providers.length, 3);
  } finally {
    await app.close();
  }
});
test("late city A response cannot repopulate results after A-B-A changes", async () => {
  const state = requestSelection(),
    token = state.capture();
  const response = Promise.resolve({ offers: [offer] });
  state.change();
  state.change();
  await response;
  assert.equal(state.accepts(token), false);
  assert.equal(state.accepts(state.capture()), true);
});
test("WB mapping rejects default, echo-only, wrong city, coordinates and duplicate destinations", () => {
  const city = cities[0];
  const geo = {
    city: city.name,
    latitude: city.latitude,
    longitude: city.longitude,
    xinfo: "curr=rub&dest=-123",
  };
  assert.equal(destinationFrom(geo, city), "-123");
  for (const bad of [
    { ...geo, city: "Москва" },
    { ...geo, city: undefined, address: "Воронеж" },
    { ...geo, latitude: 55 },
    { ...geo, xinfo: "dest=-123&dest=-456" },
    { xinfo: "dest=-1257786" },
  ])
    assert.throws(() => destinationFrom(bad, city));
  assert.equal(cityById(undefined)?.id, "voronezh");
  assert.equal(cityById("evil"), undefined);
});
test("WB upstream RUB is not divided again and lacks ordinary-price proof", () => {
  const rows = normalizeWbSearch(
    { dest: "-123", items: [{ nm_id: 123, name: "Fixture laptop", price_rub: 123456.78 }] },
    profile,
    "-123",
  );
  assert.equal(rows[0].priceRub, 123456.78);
  assert.throws(
    () => normalizeWbSearch({ dest: "-456", items: [{ nm_id: 123 }] }, profile, "-123"),
    /destination_mismatch/,
  );
  assert.throws(
    () => normalizeWbSearch({ items: [{ nm_id: 123 }] }, profile, "-123"),
    /destination_mismatch/,
  );
  assert.equal(rows[0].discoveryPriceKind, "unknown");
  assert.equal(
    normalizeWbCard(rows[0], { dest: "-1257786", items: [{ nm_id: 123 }] }).status,
    "invalid",
  );
  const card = normalizeWbCard(rows[0], {
    dest: "-123",
    items: [{ nm_id: 123, name: "Fixture", price_rub: 123456.78 }],
  });
  assert.equal(card.ordinaryRub, undefined);
  assert.equal(card.region, undefined);
  assert.equal(canonicalUrl(rows[0].url, "wildberries"), rows[0].url);
  assert.equal(
    canonicalUrl("https://www.wildberries.ru.evil.test/catalog/123/detail.aspx", "wildberries"),
    null,
  );
});
test("Market ordinary, Pay and crossed-out price remain independent, exact variant required", () => {
  const raw = {
    city: { name: "Москва" },
    items: [
      {
        card_id: "123",
        sku_id: "456",
        url: "https://market.yandex.ru/card/fixture/123",
        title: "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB",
        price_rub: 105,
        price_with_pay_card_rub: 99,
        price_before_discount_rub: 200,
      },
    ],
  };
  const candidate = normalizeMarketSearch(raw, profile)[0];
  assert.equal(candidate.priceRub, 105);
  assert.equal(candidate.discoveryConditionalRub, 99);
  assert.equal(candidate.discoveryReferenceRub, 200);
  assert.equal(candidate.discoveryRegion, "Москва");
  const card = {
    card_id: "123",
    sku_id: "456",
    url: candidate.url,
    title: candidate.title,
    price: { price_rub: 105, price_with_pay_card_rub: 99, price_before_discount_rub: 200 },
    city: { name: "Москва" },
  };
  assert.equal(normalizeMarketCard(candidate, card).ordinaryRub, 105);
  assert.equal(normalizeMarketCard(candidate, { ...card, sku_id: "789" }).status, "mismatch");
  for (const suffix of ["?sku=789", "?sku=456&sku=789", "?sku=456&sku=456"]) {
    const url = raw.items[0].url + suffix;
    assert.equal(
      normalizeMarketSearch({ ...raw, items: [{ ...raw.items[0], url }] }, profile).length,
      0,
    );
    assert.equal(normalizeMarketCard(candidate, { ...card, url }).status, "mismatch");
  }
  assert.equal(
    normalizeMarketSearch(
      { ...raw, items: [{ ...raw.items[0], price_rub: undefined }] },
      profile,
    )[0].priceRub,
    null,
  );
  assert.equal(
    priceFor({ ...candidate, discoveryPriceRub: 105, discoveryPriceKind: undefined }, "discovery"),
    null,
  );
  assert.equal(
    priceFor(
      { ...candidate, discoveryPriceRub: 105, reasons: ["discovery_specs_conflict"] },
      "discovery",
    ),
    null,
  );
});
