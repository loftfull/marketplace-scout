// Isolated synthetic UI test; never reads or writes application history.

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

let observed;
createServer(async (req, res) => {
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
    return;
  }
  if (req.url === "/api/history") {
    observed ??= new Date(Date.now() - 899000).toISOString();
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        rows: [
          {
            seenAt: observed,
            offer: {
              marketplace: "yandex-market",
              title: "TEST ONLY — expiry and missing image",
              url: "https://market.yandex.ru/card/test/123?sku=456",
              sku: "123",
              priceRub: 100,
              status: "VERIFIED",
              verifiedAt: observed,
              reasons: [],
              specs: {},
              imageUrl: "https://avatars.mds.yandex.net/test-only-image",
              imageSource: "discovery",
              evidence: { live: true, priceKind: "ordinary" },
            },
          },
        ],
      }),
    );
    return;
  }
  const files = {
    "/": "index.html",
    "/app.js": "app.js",
    "/app.css": "app.css",
    "/offer-view.js": "offer-view.js",
  };
  const file = files[req.url];
  if (!file) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader("Content-Security-Policy", "img-src 'none'");
  res.setHeader(
    "Content-Type",
    file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html",
  );
  res.end(await readFile(resolve("public", file)));
}).listen(8898, "127.0.0.1", () => console.log("Isolated UI fixture: http://127.0.0.1:8898"));
