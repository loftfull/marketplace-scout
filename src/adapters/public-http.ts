import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { publicAddress } from "../egress.js";

// Fixed-host, no redirects or proxy/environment inheritance; pin the inspected DNS address.
export async function publicJson(url: URL, host: string): Promise<unknown> {
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error("destination_denied");
  const signal = AbortSignal.timeout(12000);
  const addresses = await Promise.race([
    lookup(host, { all: true, family: 4 }),
    new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
    ),
  ]);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some((row) => !publicAddress(row.address)))
    throw new Error("destination_denied");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal,
        family: 4,
        lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
        headers: { Accept: "application/json", "User-Agent": "MarketplaceScout/0.3" },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error(`source_http_${response.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 65536) {
            response.destroy(new Error("body_too_large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("invalid_geo_response"));
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}
