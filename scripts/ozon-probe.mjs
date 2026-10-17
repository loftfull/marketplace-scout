// Run only with Scout stopped. Real provider protocol + separate live search probe.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { toolCalls, toolFailure } from "../src/adapters/http-mcp.ts";
import { callOzon, ozonClient } from "../src/adapters/ozon-runtime.ts";
import { browserRuntime } from "../src/browser.ts";

const client = ozonClient();
const result = { mode: "LIVE_SPECIALIZED_PROBE_NOT_APP_FALLBACK", at: new Date().toISOString() };
try {
  const protocol = await client.connect();
  result.tools = (await protocol.listTools()).tools.map((tool) => tool.name);
  assert.ok(result.tools.includes("get_product") && result.tools.includes("search_products"));
  await client.close();
  const browser = await browserRuntime.ensure();
  const cdp = await browser.newBrowserCDPSession();
  const before = await cdp.send("Target.getBrowserContexts");
  try {
    result.search = await callOzon("search_products", {
      query: "RedmiBook Pro 16 2026 Ultra 5 338H 32GB 1TB",
      limit: 3,
    });
  } catch (error) {
    result.status = toolFailure(error);
  }
  const after = await cdp.send("Target.getBrowserContexts");
  assert.deepEqual(after, before, "specialized context leaked");
  assert.ok(browser.isConnected(), "specialized process closed shared Chrome");
  result.cleanup = "PASS: contexts unchanged; owned browser alive";
  result.calls = [...toolCalls];
  await cdp.detach();
  await writeFile("work/ozon-live-probe.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.close();
  await browserRuntime.close();
}
