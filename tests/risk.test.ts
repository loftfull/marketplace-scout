import assert from "node:assert/strict";
import test from "node:test";
import { risk } from "../src/risk.js";

test("flags implausibly cheap unverified offer", () => {
  const r = risk(
    {
      marketplace: "avito",
      title: "x",
      url: "",
      priceRub: 70000,
      specs: {},
      status: "UNVERIFIED",
      reasons: [],
    },
    140000,
  );
  assert.ok(r.flags.includes("price_anomaly"));
  assert.ok(r.flags.includes("canonical_url_missing"));
});
