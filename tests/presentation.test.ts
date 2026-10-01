import assert from "node:assert/strict";
import test from "node:test";
import {
  filterOffers,
  parseBounds,
  priceFor,
  reasonSummary,
  safeImage,
  statusNow,
} from "../public/offer-view.js";
import type { Offer } from "../src/domain.js";
import { joinImages } from "../src/images.js";
import { assess } from "../src/verification.js";

const candidate: Offer = {
  requestedCityId: "voronezh",
  requestedCity: "Воронеж",
  discoveryPriceKind: "ordinary",
  marketplace: "yandex-market",
  title: "Fixture laptop",
  url: "https://market.yandex.ru/card/laptop/123?sku=456",
  sku: "123",
  variantId: "456",
  priceRub: 100,
  discoveryPriceRub: 100,
  specs: {},
  status: "UNVERIFIED",
  reasons: [],
};
const photo = "https://avatars.mds.yandex.net/get-mpic/123/fixture/orig";
const row = { product_id: "123", sku_id: "456", url: candidate.url, image: photo };
test("image URLs reject active content, local hosts, credentials and deceptive suffixes", () => {
  assert.equal(safeImage(photo, "yandex-market"), photo);
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,evil",
    "http://avatars.mds.yandex.net/a",
    "https://avatars.mds.yandex.net.evil.org/a",
    "https://127.0.0.1/a",
    "https://user:pass@avatars.mds.yandex.net/a",
    "https://avatars.mds.yandex.net:999/a",
    null,
    {},
  ])
    assert.equal(safeImage(url, "yandex-market"), null);
  assert.equal(safeImage(photo, "ozon"), null);
});
test("native search images join by one exact product and nonempty variant", () => {
  const joined = joinImages([candidate], { items: [row] })[0];
  assert.equal(joined.imageUrl, photo);
  assert.equal(joined.imageSource, "discovery");
  assert.equal(joined.status, "UNVERIFIED");
  for (const rows of [
    [{ ...row, sku_id: "789" }],
    [{ ...row, sku_id: "" }],
    [row, row],
    [{ ...row, url: "https://market.yandex.ru/card/laptop/999" }],
    [{ ...row, url: "https://market.yandex.ru/card/laptop/123?sku=999" }],
  ])
    assert.equal(joinImages([candidate], { items: rows })[0].imageUrl, undefined);
  assert.equal(
    joinImages([{ ...candidate, variantId: undefined }], { items: [row] })[0].imageUrl,
    undefined,
  );
  assert.equal(joinImages([candidate], { wrong: [] })[0], candidate);
});
test("blocked verification retains search photo without promoting discovery price or identity", () => {
  const observed: Offer = {
    ...candidate,
    priceRub: null,
    imageUrl: undefined,
    reasons: ["card_unavailable_or_challenged"],
    evidence: {
      region: "Воронеж",
      method: "browser-card",
      observedAt: new Date().toISOString(),
      requestedUrl: candidate.url,
      finalUrl: candidate.url,
      live: false,
      httpStatus: 403,
      priceKind: "unknown",
      available: null,
    },
  };
  const result = assess({ ...candidate, imageUrl: photo, imageSource: "discovery" }, observed, {
    brand: "Xiaomi",
    model: "RedmiBook",
  });
  assert.equal(result.imageUrl, photo);
  assert.equal(result.imageSource, "discovery");
  assert.equal(result.status, "UNVERIFIED");
  assert.equal(result.priceRub, null);
  assert.equal(result.discoveryPriceRub, 100);
  assert.equal(
    reasonSummary(result),
    "Площадка ограничила доступ к карточке. Цену и характеристики пока не удалось проверить.",
  );
  assert.ok(result.reasons.includes("missing_brand"));
});
test("filter is inclusive, stable, and handles unknowns without modifying offers", () => {
  const offers = [
    candidate,
    { ...candidate, sku: "2", discoveryPriceRub: 200 },
    { ...candidate, sku: "3", discoveryPriceRub: null },
  ];
  assert.deepEqual(
    filterOffers(offers, { min: 100, max: 200, basis: "discovery", includeUnknown: false }),
    offers.slice(0, 2),
  );
  assert.deepEqual(
    filterOffers(offers, { min: 200, max: 200, basis: "discovery", includeUnknown: false }),
    [offers[1]],
  );
  assert.deepEqual(
    filterOffers(offers, { min: 999, max: null, basis: "discovery", includeUnknown: true }),
    [offers[2]],
  );
  assert.deepEqual(
    filterOffers(offers, { min: null, max: null, basis: "current", includeUnknown: false }),
    offers,
  );
  assert.equal(
    filterOffers(offers, { min: 0, max: 1000, basis: "current", includeUnknown: false }).length,
    0,
  );
  assert.equal(candidate.status, "UNVERIFIED");
});
test("current-price basis excludes stale, conditional, invalid and unverified values", () => {
  const verified: Offer = {
    ...candidate,
    status: "VERIFIED",
    verifiedAt: new Date().toISOString(),
    evidence: {
      region: "Воронеж",
      method: "browser-card",
      observedAt: new Date().toISOString(),
      requestedUrl: candidate.url,
      finalUrl: candidate.url,
      live: true,
      httpStatus: 200,
      priceKind: "ordinary",
      available: true,
    },
  };
  assert.equal(priceFor(verified, "current"), 100);
  assert.ok(verified.verifiedAt);
  assert.ok(verified.evidence);
  assert.equal(statusNow(verified, Date.parse(verified.verifiedAt) + 900000), "STALE");
  assert.equal(
    priceFor({ ...verified, verifiedAt: new Date(Date.now() - 900001).toISOString() }, "current"),
    null,
  );
  assert.equal(
    priceFor(
      { ...verified, evidence: { ...verified.evidence, priceKind: "conditional" } },
      "current",
    ),
    null,
  );
  for (const value of [0, -1, NaN, Infinity, null])
    assert.equal(priceFor({ ...verified, priceRub: value }, "current"), null);
  assert.equal(priceFor({ ...verified, status: "MISMATCH" }, "current"), null);
});
test("price input accepts blanks and decimals, rejects nonfinite negative and reversed ranges", () => {
  assert.deepEqual(parseBounds("", ""), { min: null, max: null });
  assert.deepEqual(parseBounds("10.5", "20"), { min: 10.5, max: 20 });
  for (const bounds of [
    ["-1", ""],
    ["100", "99"],
    ["NaN", ""],
    ["", "Infinity"],
  ])
    assert.ok(parseBounds(...(bounds as [string, string])).error);
});
