import assert from "node:assert/strict";
import { request } from "node:http";
import { resolve } from "node:path";
import test from "node:test";
import { McpClient } from "../src/adapters/http-mcp.js";
import { observation } from "../src/browser.js";
import { normalizeDiscovery } from "../src/connectors.js";
import type { Offer } from "../src/domain.js";
import { BrowserEgress } from "../src/egress.js";
import { parseQuery } from "../src/parse.js";
import { cardSpecs } from "../src/specs.js";
import { assess } from "../src/verification.js";

const title = "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB";
test("structured specs contradicting title cannot pass", () => {
  const result = cardSpecs(title, [
    { name: "RAM", value: "16 GB" },
    { name: "Год", value: "2025" },
  ]);
  assert.ok(result.reasons.includes("spec_evidence_conflict_ramGb"));
  assert.ok(result.reasons.includes("spec_evidence_conflict_year"));
  assert.ok(cardSpecs(`${title} Ultra 5 225H`, []).reasons.includes("spec_evidence_conflict_cpu"));
  assert.ok(cardSpecs(`${title} 16 GB`, []).reasons.includes("spec_evidence_conflict_ramGb"));
});
test("Yandex URL variant contradiction cannot verify", () => {
  const offer: Offer = {
    marketplace: "yandex-market",
    title,
    url: "https://market.yandex.ru/card/laptop/123?sku=11",
    sku: "123",
    variantId: "11",
    priceRub: 140000,
    seller: "Fixture",
    specs: parseQuery(title),
    status: "UNVERIFIED",
    reasons: [],
  };
  const result = assess(
    offer,
    {
      ...offer,
      evidence: {
        method: "browser-card",
        requestedUrl: offer.url,
        finalUrl: "https://market.yandex.ru/card/laptop/123?sku=22",
        live: true,
        httpStatus: 200,
        observedAt: new Date().toISOString(),
        priceKind: "ordinary",
        available: true,
      },
    },
    parseQuery(title),
  );
  assert.equal(result.status, "MISMATCH");
});
test("403 heading is never product mismatch", () => {
  const offer: Offer = {
    marketplace: "ozon",
    title,
    url: "https://www.ozon.ru/product/123/",
    sku: "123",
    priceRub: null,
    specs: {},
    status: "UNVERIFIED",
    reasons: [],
  };
  const result = observation(
    {
      title: "Forbidden",
      heading: "Доступ запрещён",
      products: [],
      priceText: "",
      sellerText: "",
      availableText: "",
      bodyStart: "",
    },
    offer,
    offer.url,
    403,
  );
  assert.equal(assess(offer, result, parseQuery(title)).status, "UNVERIFIED");
  assert.equal(result.title, title);
});
test("real MCP initialization and reconnect after subprocess exit", async () => {
  const client = new McpClient({
    command: process.execPath,
    args: [resolve("tests/fixtures/mcp-server.mjs")],
    cwd: process.cwd(),
  });
  try {
    const before = (await client.call("probe", {})) as { pid: number };
    assert.ok(before.pid > 0);
    await assert.rejects(client.call("exit", {}));
    const after = (await client.call("probe", {})) as { pid: number };
    assert.ok(after.pid > 0);
    assert.notEqual(before.pid, after.pid);
  } finally {
    await client.close();
  }
});
test("browser proxy refuses private, rebinding-shaped and plaintext destinations before connection", async () => {
  const proxy = new BrowserEgress();
  const port = await proxy.start();
  const attempt = (target: string) =>
    new Promise<number>((resolveAttempt, reject) => {
      const req = request({ host: "127.0.0.1", port, method: "CONNECT", path: target });
      req.once("connect", (res, socket) => {
        socket.destroy();
        resolveAttempt(res.statusCode ?? 0);
      });
      req.once("error", reject);
      req.end();
    });
  try {
    for (const target of [
      "127.0.0.1:443",
      "localhost:443",
      "169.254.169.254:443",
      "192.168.0.1:443",
      "2130706433:443",
      "example.com:80",
      "[::1]:443",
    ])
      assert.equal(await attempt(target), 403);
  } finally {
    await proxy.close();
  }
});

test("named capacity properties never use query size heuristics", () => {
  assert.ok(
    cardSpecs(title, [{ name: "SSD", value: "128 GB" }]).reasons.includes(
      "spec_evidence_conflict_ssdGb",
    ),
  );
  assert.ok(
    cardSpecs(title, [{ name: "RAM", value: "256 GB" }]).reasons.includes(
      "spec_evidence_conflict_ramGb",
    ),
  );
  assert.ok(
    cardSpecs(title, [{ name: "RAM", value: "16 or 32 GB" }]).reasons.includes(
      "spec_evidence_unparseable_ramGb",
    ),
  );
  assert.ok(
    cardSpecs(title, [{ name: "SSD", value: "unknown" }]).reasons.includes(
      "spec_evidence_unparseable_ssdGb",
    ),
  );
});

test("structured CPU, brand and model ambiguity cannot disappear through query parsing", () => {
  assert.ok(
    cardSpecs(title, [{ name: "CPU", value: "Ultra 5 338H / Ultra 5 225H" }]).reasons.includes(
      "spec_evidence_unparseable_cpu",
    ),
  );
  assert.ok(
    cardSpecs(title, [{ name: "Brand", value: "Xiaomi or HONOR" }]).reasons.includes(
      "spec_evidence_unparseable_brand",
    ),
  );
  assert.ok(
    cardSpecs(title, [{ name: "Model", value: "RedmiBook Pro 16 / HONOR" }]).reasons.includes(
      "spec_evidence_conflict_model",
    ),
  );
});

test("shortlist prefers exact identity over cheap incompatible discovery rows", () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({
    source: "ozon",
    product_id: String(100 + i),
    title: i === 3 ? title : "RedmiBook Pro 16 2025 Ultra 5 225H 16GB 512GB",
    url: `https://www.ozon.ru/product/${100 + i}/`,
    price_rub: i === 3 ? 140000 : 10000,
  }));
  const selected = normalizeDiscovery(
    { offers: rows, source_outcomes: [{ source: "ozon", status: "ok" }] },
    "ozon",
    "ozon",
    parseQuery(title),
  );
  assert.equal(selected.offers[0].sku, "103");
  assert.equal(selected.offers.length, 3);
});

test("MCP deadline cancels initialization and tool work before returning", async () => {
  for (const delayedInit of [true, false]) {
    const client = new McpClient({
      command: process.execPath,
      args: [resolve("tests/fixtures/mcp-server.mjs"), ...(delayedInit ? ["--slow-init"] : [])],
      cwd: process.cwd(),
    });
    let childPid: number | undefined;
    try {
      if (!delayedInit) childPid = ((await client.call("probe", {})) as { pid: number }).pid;
      const started = Date.now();
      await assert.rejects(
        client.call(delayedInit ? "probe" : "slow", {}, 10000, AbortSignal.timeout(300)),
      );
      assert.ok(Date.now() - started < 3000, "deadline includes awaited transport shutdown");
      const stoppedPid = childPid;
      if (stoppedPid)
        assert.throws(
          () => process.kill(stoppedPid, 0),
          "timed-out subprocess must be gone before verification resumes",
        );
    } finally {
      await client.close();
    }
  }
});
