import assert from "node:assert/strict";
import test from "node:test";
import { parseQuery } from "../src/parse.js";

test("parses target laptop query", () => {
  const p = parseQuery("RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB");
  assert.equal(p.brand, "Xiaomi");
  assert.equal(p.year, 2026);
  assert.equal(p.cpu?.toLowerCase(), "ultra 5 338h");
  assert.equal(p.ramGb, 32);
  assert.equal(p.ssdGb, 1024);
});
