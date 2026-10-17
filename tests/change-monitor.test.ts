import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChangeMonitor, MonitoredPage } from "../src/adapters/change-monitor.js";
import { buildApp } from "../src/app.js";
import { SourceCircuit } from "../src/source-circuit.js";

const page = (overrides: Partial<MonitoredPage> = {}): MonitoredPage => ({
  uuid: "watch-1234",
  url: "https://market.yandex.ru/card/redmi/123?sku=456",
  title: "Redmi Book · UNVERIFIED",
  paused: true,
  last_checked: null,
  last_error: null,
  last_check_status: null,
  history_count: 0,
  verification: "UNVERIFIED",
  marketplace: "yandex-market",
  ...overrides,
});

class FakeMonitor implements ChangeMonitor {
  watches: MonitoredPage[] = [];
  added: Array<[string, string]> = [];
  checked: string[] = [];
  closeCalls = 0;
  checkResult = page({ last_check_status: 200, paused: false });

  async list() {
    return this.watches;
  }

  async add(url: string, title: string) {
    this.added.push([url, title]);
    const existing = this.watches.find((watch) => watch.url === url);
    const watch = existing ?? page({ url, title, marketplace: "yandex-market" });
    if (!existing) this.watches.push(watch);
    return watch;
  }

  async check(url: string) {
    this.checked.push(url);
    return this.checkResult;
  }

  async close() {
    this.closeCalls += 1;
  }
}

async function appWith(
  monitor: FakeMonitor,
  source = new SourceCircuit(),
  html = new SourceCircuit(),
) {
  return await buildApp({
    logger: false,
    changeMonitor: monitor,
    sourceCircuit: source,
    htmlSourceCircuit: html,
  });
}

test("monitor add validates marketplace card URL and creates paused UNVERIFIED watch", async () => {
  const monitor = new FakeMonitor();
  const app = await appWith(monitor);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/monitor/watches",
      payload: {
        url: "https://market.yandex.ru/card/redmi/123?sku=456&utm_source=unsafe",
        title: "Redmi Book 16 2026",
      },
    });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(monitor.added[0], [
      "https://market.yandex.ru/card/redmi/123?sku=456",
      "Redmi Book 16 2026 · UNVERIFIED",
    ]);
    assert.equal(response.json().watch.verification, "UNVERIFIED");
    assert.equal(response.json().watch.canCheck, false);
  } finally {
    await app.close();
  }
  assert.equal(monitor.closeCalls, 1);
});

test("monitor rejects arbitrary URLs before calling changedetection", async () => {
  const monitor = new FakeMonitor();
  const app = await appWith(monitor);
  try {
    for (const url of ["https://example.com/a", "http://market.yandex.ru/card/redmi/123"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/monitor/watches",
        payload: { url, title: "Product card" },
      });
      assert.equal(response.statusCode, 400);
    }
    assert.equal(monitor.added.length, 0);
  } finally {
    await app.close();
  }
});

test("watch status disables checks while either source circuit is paused", async () => {
  const monitor = new FakeMonitor();
  monitor.watches = [page()];
  const html = new SourceCircuit();
  await html.pause("yandex-market", "blocked", "html-discovery", "robots blocked");
  const app = await appWith(monitor, new SourceCircuit(), html);
  try {
    const response = await app.inject({ method: "GET", url: "/api/monitor/watches" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().watches[0].canCheck, false);
    assert.equal(response.json().watches[0].blockedReason, "robots blocked");
  } finally {
    await app.close();
  }
});

test("blocked source preflight prevents monitor checks; check 403 latches both circuits", async () => {
  const monitor = new FakeMonitor();
  monitor.watches = [page()];
  const native = new SourceCircuit();
  const html = new SourceCircuit();
  await html.pause("yandex-market", "blocked", "html-discovery", "previous block");
  const app = await appWith(monitor, native, html);
  try {
    const refused = await app.inject({
      method: "POST",
      url: "/api/monitor/watches/watch-1234/check",
    });
    assert.equal(refused.statusCode, 409);
    assert.equal(monitor.checked.length, 0);
    await html.resume("yandex-market");
    monitor.checkResult = page({ last_check_status: 403, last_error: "HTTP 403" });
    const blocked = await app.inject({
      method: "POST",
      url: "/api/monitor/watches/watch-1234/check",
    });
    assert.equal(blocked.statusCode, 200);
    assert.equal(blocked.json().verification, "UNVERIFIED");
    assert.equal((await native.get("yandex-market"))?.status, "blocked");
    assert.equal((await html.get("yandex-market"))?.status, "blocked");
  } finally {
    await app.close();
  }
});
