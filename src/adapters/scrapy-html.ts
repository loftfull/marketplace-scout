import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";
import { browserRuntime, readCard } from "../browser.js";
import { type City, cities } from "../cities.js";
import type { Connector, Discovery, SourceOutcome } from "../connectors.js";
import type { Offer, ProductProfile } from "../domain.js";
import { match } from "../domain.js";
import { parseQuery, queryFor } from "../parse.js";
import { canonicalUrl, skuFromUrl } from "../urls.js";

const runner = resolve("integrations/scrapy-html/runner.py");
const python = resolve(
  process.platform === "win32"
    ? ".runtime/external/scrapy/upstream/.venv/Scripts/python.exe"
    : ".runtime/external/scrapy/upstream/.venv/bin/python",
);
const resultSchema = z.object({
  marketplace: z.string(),
  status: z.enum(["ok", "empty", "blocked", "timeout", "error"]),
  stage: z.string().max(80),
  detail: z.string().max(160),
  discovery_url: z.string().max(1000).nullable(),
  offers: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(300),
        url: z.string().max(1000),
        price_rub: z.number().finite().positive().max(100_000_000).nullable(),
      }),
    )
    .max(20),
});
const errorResult = (marketplace: string, status: "error" | "timeout", detail: string) =>
  ({
    marketplace,
    status,
    stage: "html-runtime",
    detail,
    discoveryUrl: undefined,
    offersReturned: 0,
  }) satisfies SourceOutcome;

async function runScrapy(marketplace: string, profile: ProductProfile, city: City) {
  let proxy: string;
  try {
    proxy = await browserRuntime.egressProxyUrl();
  } catch {
    return { error: errorResult(marketplace, "error", "egress_proxy_unavailable") } as const;
  }
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    PYTHONUTF8: "1",
    SCOUT_EGRESS_PROXY: proxy,
  };
  const timeout = AbortSignal.timeout(35_000);
  return await new Promise<{ result: z.infer<typeof resultSchema> } | { error: SourceOutcome }>(
    (resolveResult) => {
      let stdout = "";
      let stderrTail = "";
      let stderrBytes = 0;
      let settled = false;
      const finish = (
        value: { result: z.infer<typeof resultSchema> } | { error: SourceOutcome },
      ) => {
        if (settled) return;
        settled = true;
        resolveResult(value);
      };
      const child = spawn(python, ["-I", runner], {
        cwd: process.cwd(),
        env,
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        signal: timeout,
      });
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (Buffer.byteLength(stdout, "utf8") > 512_000) {
          child.kill();
          finish({ error: errorResult(marketplace, "error", "scrapy_output_too_large") });
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        stderrTail = `${stderrTail}${chunk.toString("utf8")}`.slice(-4096);
        if (stderrBytes > 128_000) {
          child.kill();
          finish({ error: errorResult(marketplace, "error", "scrapy_log_limit_exceeded") });
        }
      });
      child.once("error", () =>
        finish({
          error: errorResult(
            marketplace,
            timeout.aborted ? "timeout" : "error",
            timeout.aborted ? "html_crawl_timeout" : "scrapy_runtime_unavailable",
          ),
        }),
      );
      child.once("close", (code) => {
        if (settled) return;
        if (timeout.aborted) {
          finish({ error: errorResult(marketplace, "timeout", "html_crawl_timeout") });
          return;
        }
        if (code !== 0) {
          console.error("scrapy_process_failed", {
            marketplace,
            code,
            stderr: stderrTail.slice(-1600),
          });
          finish({ error: errorResult(marketplace, "error", "scrapy_process_failed") });
          return;
        }
        try {
          const parsed = resultSchema.parse(JSON.parse(stdout));
          if (parsed.marketplace !== marketplace) throw new Error("marketplace_mismatch");
          finish({ result: parsed });
        } catch {
          finish({ error: errorResult(marketplace, "error", "scrapy_result_invalid") });
        }
      });
      child.stdin.once("error", () => undefined);
      child.stdin.end(JSON.stringify({ marketplace, query: queryFor(profile), city_id: city.id }));
    },
  );
}

export class ScrapyHTMLConnector implements Connector {
  constructor(public name: string) {}

  async search(profile: ProductProfile, city: City = cities[0]): Promise<Discovery> {
    const executed = await runScrapy(this.name, profile, city);
    if ("error" in executed) return { offers: [], outcome: executed.error };
    const result = executed.result;
    const offers: Offer[] = [];
    for (const row of result.offers) {
      const url = canonicalUrl(row.url, this.name);
      if (!url) continue;
      const sku = skuFromUrl(new URL(url), this.name);
      if (!sku) continue;
      offers.push({
        marketplace: this.name,
        title: row.title,
        url,
        sku,
        variantId:
          this.name === "yandex-market"
            ? new URL(url).searchParams.get("sku") || undefined
            : undefined,
        priceRub: row.price_rub,
        discoveryPriceKind: "unknown",
        discoveryProvider: "scrapy/2.19.0 HTML",
        specs: parseQuery(row.title),
        status: "UNVERIFIED",
        reasons: [],
        discoveredAt: new Date().toISOString(),
      });
    }
    offers.sort((left, right) => {
      const a = match(profile, left);
      const b = match(profile, right);
      return a.reasons.length * 10 + a.missing.length - b.reasons.length * 10 - b.missing.length;
    });
    const selected = offers.slice(0, 3);
    return {
      offers: selected,
      outcome: {
        marketplace: this.name,
        status: result.status === "ok" && selected.length === 0 ? "empty" : result.status,
        stage: result.stage,
        detail:
          result.status === "ok" && selected.length === 0
            ? "no_valid_product_cards"
            : result.detail,
        discoveryUrl: result.discovery_url ?? undefined,
        offersReturned: selected.length,
      },
    };
  }

  async verify(offer: Offer): Promise<Offer> {
    try {
      return await readCard(offer);
    } catch {
      return {
        ...offer,
        priceRub: null,
        specs: {},
        seller: undefined,
        evidence: undefined,
        status: "UNVERIFIED",
        verifiedAt: undefined,
        reasons: ["card_reopen_failed"],
      };
    }
  }
}

export const scrapyHtmlConnectors: Connector[] = [
  new ScrapyHTMLConnector("yandex-market"),
  new ScrapyHTMLConnector("ozon"),
  new ScrapyHTMLConnector("avito"),
  new ScrapyHTMLConnector("wildberries"),
];
