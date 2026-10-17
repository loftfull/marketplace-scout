import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp } from "../src/app.js";
import {
  ResearchGateway,
  researchData,
  researchOperations,
  researchRequest,
} from "../src/research.js";
import { HistoryStore } from "../src/store.js";

const request = {
  operation: "yandex-market.get_product",
  city: "voronezh",
  values: { product: "12345" },
};
test("research rejects arbitrary tool, URLs, extra controls, malformed IDs and injected region", () => {
  assert.equal(researchOperations.length, 21);
  for (const invalid of [
    { ...request, operation: "shell.exec" },
    { ...request, values: { product: "https://127.0.0.1" } },
    { ...request, values: { product: "123", dest: "-1" } },
    { ...request, city: "unknown" },
    { ...request, url: "https://example.com" },
    { ...request, values: { product: "0" } },
    {
      operation: "wildberries.wb_category_products",
      city: "voronezh",
      values: { shard: "../../private", query: "cat=1&dest=2" },
    },
    { operation: "ozon.compare_products", values: { products: "1,2,3,4" } },
  ])
    assert.throws(() => researchRequest(invalid));
  assert.equal(researchRequest(request).city.name, "Воронеж");
});
test("research output is bounded, strips buyer identity and remains plain text", () => {
  const result = researchData({
    author: "Private",
    email: "a@b.com",
    items: Array(70).fill({
      text: "<script>alert(1)</script> test@example.com",
      long: "x".repeat(4000),
    }),
    nested: { buyer: "Person" },
  }) as { items: { text: string; long: string }[]; author?: string; nested: unknown };
  assert.equal(result.author, undefined);
  assert.equal(result.items.length, 40);
  assert.equal(result.items[0].long.length, 2000);
  assert.ok(!result.items[0].text.includes("test@example.com"));
  assert.ok(result.items[0].text.includes("<script>"));
  assert.deepEqual(result.nested, {});
  assert.deepEqual(
    researchData({
      reviews: [{ user: "Иван", fio: "Иванов Иван", text: "Отзыв", nm_id: 12345678901 }],
    }),
    {
      reviews: [{ text: "Отзыв", nm_id: 12345678901 }],
    },
  );
});
test("blocked research never retries and never grants VERIFIED", async () => {
  let calls = 0;
  const gateway = new ResearchGateway(async () => {
    calls++;
    throw Error("403 blocked");
  });
  const input = researchRequest(request);
  assert.equal((await gateway.run(input)).status, "blocked");
  const again = await gateway.run(input);
  assert.equal(calls, 1);
  assert.equal(again.verification, "UNVERIFIED");
});
test("search and research share lock until cleanup, research does not write price history", async () => {
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const research = new ResearchGateway(async () => {
    entered();
    await gate;
    throw Error("timeout after cleanup");
  });
  const app = await buildApp({
    logger: false,
    sources: [],
    cooldownMs: 0,
    research,
    store: new HistoryStore(join(await mkdtemp(join(tmpdir(), "scout-research-")), "history.json")),
  });
  try {
    const pending = app.inject({ method: "POST", url: "/api/research", payload: request });
    const task = Promise.resolve(pending);
    await started;
    assert.equal((await app.inject("/api/search?q=laptop")).statusCode, 429);
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/research", payload: request })).statusCode,
      429,
    );
    release();
    assert.equal((await task).json().status, "timeout");
    assert.equal((await app.inject("/health")).json().searching, false);
    assert.equal((await app.inject("/api/search?q=laptop")).statusCode, 200);
    assert.deepEqual((await app.inject("/api/history")).json().rows, []);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/research",
          headers: { origin: "https://hostile.example" },
          payload: request,
        })
      ).statusCode,
      403,
    );
  } finally {
    release();
    await app.close();
  }
});
