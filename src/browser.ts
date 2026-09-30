import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { safeImage } from "../public/offer-view.js";
import type { Offer, ProductProfile } from "./domain.js";
import { BrowserEgress } from "./egress.js";
import { queryFor } from "./parse.js";
import { cardSpecs } from "./specs.js";

export { publicAddress } from "./egress.js";

import { canonicalUrl, marketplaceUrl, skuFromUrl } from "./urls.js";

export class BrowserRuntime {
  private browser?: Browser;
  private egress = new BrowserEgress();
  private process?: ChildProcess;
  private starting?: Promise<Browser>;
  async ensure(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    if (this.starting) return this.starting;
    this.starting = this.start()
      .catch(async (error) => {
        this.process?.kill();
        this.process = undefined;
        await this.egress.close();
        throw error;
      })
      .finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  private async start() {
    // Never attach to a pre-existing process on this port: it might own personal sessions.
    try {
      await fetch("http://127.0.0.1:9337/json/version", { signal: AbortSignal.timeout(500) });
      throw new Error("cdp_port_already_in_use");
    } catch (error) {
      if ((error as Error).message === "cdp_port_already_in_use") throw error;
    }
    await mkdir(".runtime/chrome-profile", { recursive: true });
    const executable =
      process.env.SCOUT_CHROME_PATH ||
      (process.platform === "win32"
        ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
        : "/usr/bin/google-chrome");
    const proxyPort = await this.egress.start();
    const args = [
      `--proxy-server=http://127.0.0.1:${proxyPort}`,
      "--proxy-bypass-list=<-loopback>",
      "--disable-quic",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--headless=new",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=9337",
      `--user-data-dir=${resolve(".runtime/chrome-profile")}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "about:blank",
    ];
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: "ignore" });
    this.process = child;
    let spawnError: Error | undefined;
    child.on("error", (error) => {
      spawnError = error;
    });
    for (let i = 0; i < 40; i++) {
      if (spawnError) throw spawnError;
      try {
        const response = await fetch("http://127.0.0.1:9337/json/version", {
          signal: AbortSignal.timeout(500),
        });
        if (response.ok) {
          this.browser = await chromium.connectOverCDP("http://127.0.0.1:9337", { timeout: 15000 });
          return this.browser;
        }
      } catch {
        /* Startup polling has a fixed deadline. */
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    child.kill();
    throw new Error("dedicated_browser_start_failed");
  }
  async page(marketplace: string): Promise<Page> {
    const browser = await this.ensure();
    const page = await browser.contexts()[0].newPage();
    page.setDefaultTimeout(10000);
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && !marketplaceUrl(request.url(), marketplace, false))
        return route.abort();
      return route.continue();
    });
    return page;
  }
  async close() {
    await this.browser?.close();
    this.browser = undefined;
    this.process?.kill();
    this.process = undefined;
    await this.egress.close();
  }
}
export const browserRuntime = new BrowserRuntime();
export type BrowserDiscovery = { offers: Offer[]; detail: string; url: string; status: string };
export async function browserDiscovery(
  marketplace: string,
  profile: ProductProfile,
): Promise<BrowserDiscovery> {
  const roots: Record<string, string> = {
    "yandex-market": "https://market.yandex.ru/search?text=",
    ozon: "https://www.ozon.ru/search/?text=",
    avito: "https://www.avito.ru/all/noutbuki?q=",
  };
  const url = roots[marketplace] + encodeURIComponent(queryFor(profile));
  const page = await browserRuntime.page(marketplace);
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = await page.title();
    const body = await page.locator("body").innerText({ timeout: 8000 });
    if (isChallenge(title, body) || (response?.status() ?? 500) >= 400)
      return { offers: [], detail: title.slice(0, 180), url: page.url(), status: "blocked" };
    const links = await page.locator("a[href]").evaluateAll((elements) =>
      elements.map((el) => ({
        url: (el as HTMLAnchorElement).href,
        title: (el.textContent || "").trim().slice(0, 500),
        image: el.querySelector("img")?.currentSrc || "",
      })),
    );
    const unique = new Map<string, Offer>();
    for (const link of links) {
      const canonical = canonicalUrl(link.url, marketplace);
      if (!canonical || !/redmi|xiaomi|book|ноутбук/i.test(link.title) || unique.has(canonical))
        continue;
      unique.set(canonical, {
        marketplace,
        title: link.title,
        url: canonical,
        sku: skuFromUrl(new URL(canonical), marketplace),
        variantId: new URL(canonical).searchParams.get("sku") || undefined,
        priceRub: null,
        specs: {},
        status: "UNVERIFIED",
        reasons: [],
        imageUrl: safeImage(link.image, marketplace) ?? undefined,
        imageSource: "discovery",
        discoveredAt: new Date().toISOString(),
      });
    }
    return {
      offers: [...unique.values()].slice(0, 3),
      detail: title.slice(0, 180),
      url: page.url(),
      status: unique.size ? "ok" : "empty",
    };
  } finally {
    await page.close();
  }
}
export function isChallenge(title: string, body: string) {
  return /captcha|робот|доступ ограничен|доступ запрещен|access denied|проверка безопасности|подтвердите.*человек|temporarily blocked/i.test(
    `${title} ${body.slice(0, 2000)}`,
  );
}
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
export type CardSnapshot = {
  title: string;
  heading: string;
  products: unknown[];
  priceText: string;
  sellerText: string;
  availableText: string;
  bodyStart: string;
};
export function observation(
  snapshot: CardSnapshot,
  discovered: Offer,
  finalUrl: string,
  httpStatus: number,
): Offer {
  const reasons: string[] = [];
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const products = snapshot.products
    .map(record)
    .filter(
      (product) =>
        typeof product.name === "string" && normalize(product.name) === normalize(snapshot.heading),
    );
  const product = products.length === 1 ? products[0] : {};
  if (products.length !== 1) reasons.push("selected_product_schema_missing_or_ambiguous");
  const title = typeof product.name === "string" ? product.name : snapshot.heading;
  const parsed = cardSpecs(
    title,
    Array.isArray(product.additionalProperty) ? product.additionalProperty.map(record) : [],
  );
  const specs = products.length === 1 ? parsed.specs : {};
  reasons.push(...parsed.reasons);
  const offers = Array.isArray(product.offers)
    ? product.offers.map(record)
    : Object.keys(record(product.offers)).length
      ? [record(product.offers)]
      : [];
  const offer = offers.length === 1 && offers[0]["@type"] !== "AggregateOffer" ? offers[0] : {};
  if (offers.length !== 1) reasons.push("selected_offer_ambiguous");
  const seller =
    typeof record(offer.seller).name === "string" ? String(record(offer.seller).name) : undefined;
  if (seller && !normalize(snapshot.sellerText).includes(normalize(seller)))
    reasons.push("seller_not_visible_on_card");
  const price =
    typeof offer.price === "number" || typeof offer.price === "string" ? Number(offer.price) : NaN;
  const priceRub =
    String(offer.priceCurrency).toUpperCase() === "RUB" && Number.isFinite(price) && price > 0
      ? price
      : null;
  const visibleNumbers =
    snapshot.priceText
      .match(/\d[\d\s\u00a0]*(?:[.,]\d{1,2})?/g)
      ?.map((n) => Number(n.replace(/[\s\u00a0]/g, "").replace(",", "."))) ?? [];
  if (priceRub !== null && !visibleNumbers.includes(priceRub))
    reasons.push("price_not_visible_on_card");
  const conditional = /с\s+(?:ozon|озон)[- ]?карт|с плюсом|по карте|рассроч|в месяц/i.test(
    snapshot.priceText,
  );
  const ordinaryLabel = /без\s+(?:ozon|озон)[- ]?карт|без плюса|обычная цена/i.test(
    snapshot.priceText,
  );
  const priceKind =
    discovered.marketplace === "avito" && !conditional
      ? "ordinary"
      : ordinaryLabel && !conditional
        ? "ordinary"
        : conditional
          ? "conditional"
          : "unknown";
  const final = marketplaceUrl(finalUrl, discovered.marketplace);
  const schemaUrl =
    typeof product.url === "string" ? marketplaceUrl(product.url, discovered.marketplace) : null;
  const sku =
    typeof product.sku === "string" || typeof product.sku === "number"
      ? String(product.sku)
      : undefined;
  const urlSku = final && skuFromUrl(final, discovered.marketplace);
  if (schemaUrl && skuFromUrl(schemaUrl, discovered.marketplace) !== urlSku)
    reasons.push("sku_or_marketplace_changed");
  if (discovered.marketplace === "yandex-market") {
    const variants = [
      new URL(discovered.url).searchParams.get("sku"),
      final?.searchParams.get("sku"),
      schemaUrl?.searchParams.get("sku"),
      sku,
      discovered.variantId,
    ].filter(Boolean);
    if (new Set(variants).size > 1) reasons.push("sku_or_marketplace_changed");
  }
  const observedSku =
    discovered.marketplace === "yandex-market"
      ? schemaUrl
        ? skuFromUrl(schemaUrl, discovered.marketplace)
        : undefined
      : sku;
  if (observedSku && observedSku !== urlSku) reasons.push("sku_or_marketplace_changed");
  const live =
    httpStatus >= 200 &&
    httpStatus < 300 &&
    Boolean(final) &&
    !isChallenge(snapshot.title, snapshot.bodyStart);
  if (!live) reasons.push("card_unavailable_or_challenged");
  const available =
    /\/InStock$/.test(String(offer.availability)) &&
    /в корзину|купить|написать|показать телефон/i.test(snapshot.availableText)
      ? true
      : null;
  return {
    marketplace: discovered.marketplace,
    title: products.length === 1 ? title : discovered.title,
    url: discovered.url,
    priceRub,
    imageUrl:
      live && !reasons.includes("sku_or_marketplace_changed")
        ? (safeImage(
            Array.isArray(product.image) ? product.image[0] : product.image,
            discovered.marketplace,
          ) ?? undefined)
        : undefined,
    imageSource: "card",
    seller,
    sku: observedSku,
    variantId: discovered.marketplace === "yandex-market" ? sku : undefined,
    specs,
    status: "UNVERIFIED",
    reasons,
    evidence: {
      method: "browser-card",
      observedAt: new Date().toISOString(),
      requestedUrl: discovered.url,
      finalUrl,
      sku: observedSku,
      live,
      httpStatus,
      priceKind,
      available,
    },
  };
}
export async function readCard(discovered: Offer): Promise<Offer> {
  if (!marketplaceUrl(discovered.url, discovered.marketplace))
    throw new Error("unsafe_product_url");
  const page = await browserRuntime.page(discovered.marketplace);
  try {
    const response = await page.goto(discovered.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const snapshot = await page.evaluate<CardSnapshot>(
      await readFile(new URL("../scripts/card-snapshot.js", import.meta.url), "utf8"),
    );
    return observation(snapshot, discovered, page.url(), response?.status() ?? 0);
  } finally {
    await page.close();
  }
}
