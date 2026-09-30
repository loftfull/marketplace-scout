import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { browserRuntime } from "../src/browser.ts";

let privateRequests = 0;
const trap = createServer((_request, response) => {
  privateRequests++;
  response.end("must not reach");
});
await new Promise((resolve) => trap.listen(0, "127.0.0.1", resolve));
const trapPort = trap.address().port;
try {
  const browser = await browserRuntime.ensure();
  const page = await browser.contexts()[0].newPage();
  await page.route("https://scout-security.invalid/redirect", async (route) =>
    route.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${trapPort}/private` } }),
  );
  await page
    .goto("https://scout-security.invalid/redirect", { timeout: 10000 })
    .catch(() => undefined);
  assert.equal(privateRequests, 0, "redirect reached private service");
  // Popup-like new pages share Chrome's mandatory proxy, even without Scout page routes.
  const other = await browser.contexts()[0].newPage();
  await other.goto(`http://127.0.0.1:${trapPort}/popup`, { timeout: 10000 }).catch(() => undefined);
  assert.equal(privateRequests, 0, "unguarded page reached private service");
  await page.setContent(
    '<h1>Fixture product</h1><div data-widget="webPrice">100 ₽</div><div data-widget="webPrice">200 ₽</div>',
  );
  const snapshot = await page.evaluate(await readFile("scripts/card-snapshot.js", "utf8"));
  assert.equal(snapshot.heading, "Fixture product");
  assert.equal(snapshot.priceText, "", "ambiguous widgets must not corroborate price");
  await page.close();
  await other.close();
  console.log(
    "PASS: real Chrome redirect and unguarded-page private targets received zero requests; tsx DOM snapshot works; ambiguous widgets excluded.",
  );
} finally {
  await browserRuntime.close();
  await new Promise((resolve) => trap.close(resolve));
}
