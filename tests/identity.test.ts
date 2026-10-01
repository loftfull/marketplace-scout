import assert from "node:assert/strict";
import test from "node:test";
import { match, type Offer } from "../src/domain.js";

const p = {
  brand: "Xiaomi",
  model: "RedmiBook Pro 16",
  year: 2026,
  cpu: "Ultra 5 338H",
  ramGb: 32,
  ssdGb: 1024,
};
test("rejects wrong generation/SKU", () => {
  const o: Offer = {
    marketplace: "market",
    title: "",
    url: "x",
    priceRub: 120000,
    status: "UNVERIFIED",
    reasons: [],
    specs: {
      brand: "Xiaomi",
      model: "RedmiBook Pro 16",
      year: 2025,
      cpu: "Ultra 5 225H",
      ramGb: 32,
      ssdGb: 1024,
    },
  };
  assert.equal(match(p, o).ok, false);
});
test("accepts exact target", () => {
  const o: Offer = {
    marketplace: "market",
    title: "",
    url: "x",
    priceRub: 140000,
    status: "UNVERIFIED",
    reasons: [],
    specs: { ...p },
  };
  assert.equal(match(p, o).ok, true);
});
