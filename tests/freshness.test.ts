import assert from "node:assert/strict";
import test from "node:test";
import type { Offer } from "../src/domain.js";
import { freshness } from "../src/freshness.js";

test("expires old verified price", () => {
  const o: Offer = {
    marketplace: "x",
    title: "x",
    url: "x",
    priceRub: 1,
    specs: {},
    status: "VERIFIED",
    reasons: [],
    verifiedAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(freshness(o, Date.parse("2026-01-01T00:16:00Z")).status, "STALE");
});
