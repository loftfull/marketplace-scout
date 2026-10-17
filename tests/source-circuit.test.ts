import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { Connector } from "../src/connectors.js";
import type { Offer } from "../src/domain.js";
import { parseQuery } from "../src/parse.js";
import { searchVerified } from "../src/service.js";
import { SourceCircuit } from "../src/source-circuit.js";
import { HistoryStore } from "../src/store.js";

const profile = parseQuery("RedmiBook Pro 16 2026 32GB 1TB");
const offer: Offer = {
  marketplace: "yandex-market",
  title: "RedmiBook Pro 16 2026 32GB 1TB",
  url: "https://market.yandex.ru/product--redmibook/123456",
  sku: "123456",
  priceRub: 120000,
  specs: profile,
  status: "UNVERIFIED",
  reasons: [],
};

test("source circuit survives restart and only explicit resume clears the pause", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-circuit-"));
  const path = join(dir, "source-circuit.json");
  const circuit = new SourceCircuit(path);
  await circuit.pause("yandex-market", "blocked", "card-verification", "HTTP 403");
  assert.equal((await new SourceCircuit(path).get("yandex-market"))?.detail, "HTTP 403");
  await new SourceCircuit(path).resume("yandex-market");
  assert.equal(await new SourceCircuit(path).get("yandex-market"), undefined);
  assert.equal(await circuit.resume("unknown"), false);
});

test("corrupt circuit state fails closed instead of contacting a source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-circuit-corrupt-"));
  const path = join(dir, "source-circuit.json");
  await writeFile(
    path,
    JSON.stringify({ version: 1, sources: { "yandex-market": { status: "ok" } } }),
  );
  const circuit = new SourceCircuit(path);
  let networkCalls = 0;
  const source: Connector = {
    name: "yandex-market",
    async search() {
      networkCalls += 1;
      return {
        offers: [],
        outcome: {
          marketplace: this.name,
          status: "ok",
          stage: "search",
          detail: "",
          offersReturned: 0,
        },
      };
    },
    async verify(candidate) {
      return candidate;
    },
  };
  const result = await searchVerified(profile, [source], undefined, circuit);
  assert.equal(networkCalls, 0);
  assert.equal(result.sourceOutcomes[0]?.stage, "circuit-state");
  assert.equal(result.sourceOutcomes[0]?.status, "blocked");
});

test("a card challenge pauses that source and prevents further network requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-circuit-block-"));
  const circuit = new SourceCircuit(join(dir, "source-circuit.json"));
  let searches = 0;
  let verifications = 0;
  const source: Connector = {
    name: "yandex-market",
    async search() {
      searches += 1;
      return {
        offers: [{ ...offer }, { ...offer, sku: "654321" }],
        outcome: {
          marketplace: this.name,
          status: "ok",
          stage: "search",
          detail: "candidates found",
          offersReturned: 2,
        },
      };
    },
    async verify(candidate) {
      verifications += 1;
      return {
        ...candidate,
        priceRub: null,
        reasons: ["card_unavailable_or_challenged"],
        native: {
          provider: "fixture",
          tool: "card",
          status: "blocked",
          observedAt: new Date().toISOString(),
        },
      };
    },
  };
  const first = await searchVerified(profile, [source], undefined, circuit);
  assert.equal(first.sourceOutcomes[0]?.status, "blocked");
  assert.equal(first.sourceOutcomes[0]?.stage, "card-verification");
  assert.equal(first.sourceOutcomes[0]?.offersReturned, 2);
  const second = await searchVerified(profile, [source], undefined, circuit);
  assert.equal(second.sourceOutcomes[0]?.stage, "circuit-breaker");
  assert.equal(searches, 1);
  assert.equal(verifications, 1);
  await circuit.resume("yandex-market");
  await searchVerified(profile, [source], undefined, circuit);
  assert.equal(searches, 2);
  assert.equal(verifications, 2);
});

test("a card read error pauses the source instead of rechecking later cards on repeat searches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-circuit-error-"));
  const circuit = new SourceCircuit(join(dir, "source-circuit.json"));
  let searches = 0;
  let verifications = 0;
  const source: Connector = {
    name: "ozon",
    async search() {
      searches += 1;
      return {
        offers: [
          { ...offer, marketplace: "ozon", url: "https://www.ozon.ru/product/test-123456/" },
        ],
        outcome: {
          marketplace: this.name,
          status: "ok",
          stage: "search",
          detail: "candidate found",
          offersReturned: 1,
        },
      };
    },
    async verify(candidate) {
      verifications += 1;
      return {
        ...candidate,
        priceRub: null,
        reasons: ["card_reopen_failed"],
        native: {
          provider: "fixture",
          tool: "card",
          status: "error",
          observedAt: new Date().toISOString(),
        },
      };
    },
  };
  const first = await searchVerified(profile, [source], undefined, circuit);
  assert.equal(first.sourceOutcomes[0]?.status, "error");
  assert.equal(first.sourceOutcomes[0]?.stage, "card-verification");
  const second = await searchVerified(profile, [source], undefined, circuit);
  assert.equal(second.sourceOutcomes[0]?.stage, "circuit-breaker");
  assert.equal(searches, 1);
  assert.equal(verifications, 1);
});

test("source retry endpoint clears only a known pause before the user-requested search", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scout-circuit-route-"));
  const circuit = new SourceCircuit(join(dir, "source-circuit.json"));
  await circuit.pause("yandex-market", "blocked", "discovery", "HTTP 403");
  let searches = 0;
  const source: Connector = {
    name: "yandex-market",
    async search() {
      searches += 1;
      return {
        offers: [{ ...offer }],
        outcome: {
          marketplace: this.name,
          status: "ok",
          stage: "search",
          detail: "candidate found",
          offersReturned: 1,
        },
      };
    },
    async verify(candidate) {
      return {
        ...candidate,
        priceRub: null,
        reasons: ["card_unavailable_or_challenged"],
        native: {
          provider: "fixture",
          tool: "card",
          status: "blocked",
          observedAt: new Date().toISOString(),
        },
      };
    },
  };
  const app = await buildApp({
    sources: [source],
    sourceCircuit: circuit,
    store: new HistoryStore(join(dir, "history.json")),
    logger: false,
    cooldownMs: 0,
  });
  try {
    const skipped = await app.inject("/api/search?q=laptop");
    assert.equal(skipped.json().sourceOutcomes[0].stage, "circuit-breaker");
    assert.equal(skipped.json().complete, false);
    assert.equal(searches, 0);
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/sources/not-a-marketplace/retry" }))
        .statusCode,
      404,
    );
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/sources/yandex-market/retry" })).statusCode,
      200,
    );
    const resumed = await app.inject("/api/search?q=laptop");
    assert.equal(resumed.statusCode, 200);
    assert.equal(resumed.json().complete, false);
    assert.equal(resumed.json().sourceOutcomes[0].stage, "card-verification");
    assert.equal(searches, 1);
    const skippedAgain = await app.inject("/api/search?q=laptop");
    assert.equal(skippedAgain.json().sourceOutcomes[0].stage, "circuit-breaker");
    assert.equal(searches, 1);
  } finally {
    await app.close();
  }
});
