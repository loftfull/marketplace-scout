import assert from "node:assert/strict";
import test from "node:test";
import type { Offer } from "../src/domain.js";
import { match } from "../src/domain.js";
import { parseQuery, queryFor } from "../src/parse.js";
import { cardSpecs } from "../src/specs.js";

function offer(title: string, specs: Offer["specs"]): Offer {
  return {
    marketplace: "yandex-market",
    title,
    url: "https://market.yandex.ru/card/x/123?sku=456",
    priceRub: null,
    specs,
    status: "UNVERIFIED",
    reasons: [],
  };
}

test("parses target laptop query", () => {
  const p = parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB");
  assert.equal(p.brand, "Xiaomi");
  assert.equal(p.model, "RedmiBook Pro 16");
  assert.equal(p.year, 2026);
  assert.equal(p.cpu?.toLowerCase(), "ultra 5 338h");
  assert.equal(p.ramGb, 32);
  assert.equal(p.ssdGb, 1024);
});

test("parses the requested generic Redmi laptop query and builds a clean search string", () => {
  const profile = parseQuery("Ноутбук Redmi 2026 32Гб/1Тб");
  assert.deepEqual(profile, {
    brand: "Xiaomi",
    model: "RedmiBook",
    year: 2026,
    ramGb: 32,
    ssdGb: 1024,
  });
  assert.equal(queryFor(profile), "Xiaomi RedmiBook 2026 32GB 1TB");
});

test("parses compact marketplace title capacities as exact requested specs", () => {
  const profile = parseQuery("Ноутбук Redmi 2026 32Гб/1Тб");
  const result = cardSpecs("Redmi Book 16 2026 Ultra5-125H/32G/1T", []);
  assert.equal(result.specs.model, "RedmiBook 16");
  assert.equal(result.specs.year, 2026);
  assert.equal(result.specs.ramGb, 32);
  assert.equal(result.specs.ssdGb, 1024);
  assert.deepEqual(match(profile, offer("Redmi Book 16 2026 Ultra5-125H/32G/1T", result.specs)), {
    ok: true,
    reasons: [],
    missing: [],
  });
  const properties = cardSpecs("RedmiBook Pro 16", [
    { name: "RAM", value: "32G" },
    { name: "SSD", value: "1T" },
  ]);
  assert.equal(properties.specs.ramGb, 32);
  assert.equal(properties.specs.ssdGb, 1024);
  assert.deepEqual(properties.reasons, []);
});

test("only a generic RedmiBook family profile accepts model suffixes", () => {
  const generic = parseQuery("Ноутбук Redmi 2026 32Гб/1Тб");
  const specific = parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB");
  const familyCard = offer("RedmiBook Pro 16", {
    brand: "Xiaomi",
    model: "RedmiBook Pro 16",
    year: 2026,
    ramGb: 32,
    ssdGb: 1024,
  });
  assert.equal(match(generic, familyCard).ok, true);
  assert.equal(
    match(
      specific,
      offer("RedmiBook Pro 14", { ...familyCard.specs, model: "RedmiBook Pro 14" }),
    ).reasons.includes("model"),
    true,
  );
  assert.equal(
    match(
      generic,
      offer("Xiaomi Book 16", { ...familyCard.specs, model: "Xiaomi Book 16" }),
    ).reasons.includes("model"),
    true,
  );
  assert.equal(
    match(
      generic,
      offer("RedmiBookish Pro 16", { ...familyCard.specs, model: "RedmiBookish Pro 16" }),
    ).reasons.includes("model"),
    true,
  );
  assert.equal(parseQuery("RedmiBook Pro 14 2026 32GB 1TB").model, "RedmiBook Pro 14");
  assert.equal(parseQuery("RedmiBook 2026 32GB 1TB").model, "RedmiBook");
});

test("explicit year, RAM and SSD conflicts still reject a family candidate", () => {
  const profile = parseQuery("Ноутбук Redmi 2026 32Гб/1Тб");
  const specs = cardSpecs("Redmi Book 16 2025/16G/512G", []).specs;
  const result = match(profile, offer("Redmi Book 16 2025/16G/512G", specs));
  assert.deepEqual(result.reasons.sort(), ["ramGb", "ssdGb", "year"]);
});
