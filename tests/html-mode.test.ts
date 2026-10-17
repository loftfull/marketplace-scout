import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { Connector } from "../src/connectors.js";
import type { Offer } from "../src/domain.js";
import { parseQuery } from "../src/parse.js";
import { SourceCircuit } from "../src/source-circuit.js";
import { HistoryStore } from "../src/store.js";

const offer: Offer = {
  marketplace: "yandex-market",
  title: "RedmiBook Pro 16 2026 32GB 1TB",
  url: "https://market.yandex.ru/product--redmibook/123456",
  sku: "123456",
  priceRub: 120000,
  specs: parseQuery("RedmiBook Pro 16 2026 32GB 1TB"),
  status: "UNVERIFIED",
  reasons: [],
};

test("HTML-only search mode selects only the HTML connector and native stays the default", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-html-mode-"));
  const nativeCircuit = new SourceCircuit(join(dir, "native-circuits.json"));
  const htmlCircuit = new SourceCircuit(join(dir, "html-circuits.json"));
  await nativeCircuit.pause("yandex-market", "blocked", "native-discovery", "fixture block");
  let nativeCalls = 0;
  let htmlCalls = 0;
  const source = (name: string, increment: () => void): Connector => ({
    name,
    async search(_profile, city) {
      increment();
      assert.ok(city);
      return {
        offers: [],
        outcome: {
          marketplace: name,
          status: "empty",
          stage: "html-discovery",
          detail: "fixture",
          offersReturned: 0,
        },
      };
    },
    async verify(offer) {
      return offer;
    },
  });
  const app = await buildApp({
    sources: [source("yandex-market", () => nativeCalls++)],
    htmlSources: [source("yandex-market", () => htmlCalls++)],
    sourceCircuit: nativeCircuit,
    htmlSourceCircuit: htmlCircuit,
    store: new HistoryStore(join(dir, "history.json")),
    cooldownMs: 0,
    logger: false,
  });
  try {
    const page = await app.inject("/");
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /<option value="html" selected>/);
    assert.equal((await app.inject("/favicon.svg")).statusCode, 200);
    const defaults = await app.inject("/api/search?q=laptop");
    assert.equal(defaults.statusCode, 200);
    assert.equal(defaults.json().mode, "native");
    assert.equal(nativeCalls, 0);
    assert.equal(htmlCalls, 0);

    const html = await app.inject("/api/search?q=laptop&mode=html");
    assert.equal(html.statusCode, 200);
    assert.equal(html.json().mode, "html");
    assert.equal(nativeCalls, 0);
    assert.equal(htmlCalls, 1);

    const invalid = await app.inject("/api/search?q=laptop&mode=anything");
    assert.equal(invalid.statusCode, 400);
    assert.equal(nativeCalls, 0);
    assert.equal(htmlCalls, 1);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("native access failures do not pause the separate HTML-only route", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-html-circuits-"));
  const nativeCircuit = new SourceCircuit(join(dir, "native-circuits.json"));
  const htmlCircuit = new SourceCircuit(join(dir, "html-circuits.json"));
  await nativeCircuit.pause("yandex-market", "blocked", "native-discovery", "HTTP 403");
  let htmlCalls = 0;
  const htmlSource: Connector = {
    name: "yandex-market",
    async search() {
      htmlCalls += 1;
      return {
        offers: [],
        outcome: {
          marketplace: "yandex-market",
          status: "empty",
          stage: "html-discovery",
          detail: "fixture_only",
          offersReturned: 0,
        },
      };
    },
    async verify(candidate) {
      return candidate;
    },
  };
  const app = await buildApp({
    sourceCircuit: nativeCircuit,
    htmlSourceCircuit: htmlCircuit,
    htmlSources: [htmlSource],
    store: new HistoryStore(join(dir, "history.json")),
    cooldownMs: 0,
    logger: false,
  });
  try {
    const html = await app.inject("/api/search?q=laptop&mode=html");
    assert.equal(html.statusCode, 200);
    assert.equal(html.json().sourceOutcomes[0].stage, "html-discovery");
    assert.equal(htmlCalls, 1);
    assert.equal((await nativeCircuit.get("yandex-market"))?.detail, "HTTP 403");
    assert.equal(await htmlCircuit.get("yandex-market"), undefined);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("HTML mode does not persist partial candidate data when a source is blocked", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-html-blocked-"));
  const source: Connector = {
    name: "yandex-market",
    async search() {
      return {
        offers: [{ ...offer, status: "UNVERIFIED", priceRub: 120000 }],
        outcome: {
          marketplace: "yandex-market",
          status: "blocked",
          stage: "html-discovery",
          detail: "robots_policy_unavailable",
          offersReturned: 1,
        },
      };
    },
    async verify(candidate) {
      return candidate;
    },
  };
  const store = new HistoryStore(join(dir, "history.json"));
  const app = await buildApp({
    htmlSources: [source],
    sourceCircuit: new SourceCircuit(join(dir, "circuits.json")),
    store,
    cooldownMs: 0,
    logger: false,
  });
  try {
    const result = await app.inject("/api/search?q=laptop&mode=html");
    assert.equal(result.statusCode, 200);
    assert.equal((await store.history()).length, 0);
    assert.deepEqual((await app.inject("/api/history")).json().rows, []);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
