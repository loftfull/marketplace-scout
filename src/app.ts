import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { imageHosts } from "../public/offer-view.js";
import { cities, cityById } from "./cities.js";
import type { Connector } from "./connectors.js";
import { landed } from "./cost.js";
import { freshness } from "./freshness.js";
import { parseQuery } from "./parse.js";
import { providerCatalog } from "./providers.js";
import { rank } from "./rank.js";
import { searchVerified } from "./service.js";
import { HistoryStore } from "./store.js";

const schema = z.object({
  brand: z.string().trim().max(60),
  model: z.string().trim().min(2).max(120),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  cpu: z.string().max(60).optional(),
  ramGb: z.coerce.number().int().positive().max(2048).optional(),
  ssdGb: z.coerce.number().int().positive().max(100000).optional(),
  gpu: z.string().max(60).optional(),
});
export async function buildApp(
  options: {
    sources?: Connector[];
    store?: HistoryStore;
    logger?: boolean;
    cooldownMs?: number;
  } = {},
) {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 16384 });
  const store = options.store ?? new HistoryStore();
  let searching = false,
    lastSearch = 0;
  app.addHook("onRequest", async (request, reply) => {
    const host = request.headers.host ?? "";
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host))
      return reply.code(403).send({ error: "host_not_allowed" });
    const origin = request.headers.origin;
    if (origin && origin !== `http://${host}`)
      return reply.code(403).send({ error: "origin_not_allowed" });
    if (request.headers["sec-fetch-site"] === "cross-site")
      return reply.code(403).send({ error: "cross_site_not_allowed" });
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' ${Object.values(
        imageHosts,
      )
        .flat()
        .map((host) => `https://${host}`)
        .join(" ")}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
    );
    reply.header("Cache-Control", "no-store");
  });
  await app.register(fastifyStatic, { root: fileURLToPath(new URL("../public", import.meta.url)) });
  app.get("/health", async () => ({
    ok: true,
    name: "Marketplace Scout",
    version: "0.3.0",
    searching,
    sources: ["yandex-market", "ozon", "avito", "wildberries"],
    priceVerification: "live-card-required",
  }));
  app.get("/api/connectors", async () => ({
    providers: providerCatalog,
    cities,
    defaultCity: "voronezh",
  }));
  app.get("/api/search", async (request, reply) => {
    const input = request.query as Record<string, unknown>;
    const city = cityById(input.city);
    if (!city) return reply.code(400).send({ error: "invalid_city" });
    if (
      input.q !== undefined &&
      (typeof input.q !== "string" || input.q.trim().length < 3 || input.q.length > 200)
    )
      return reply.code(400).send({ error: "invalid_query" });
    const parsed = schema.safeParse(typeof input.q === "string" ? parseQuery(input.q) : input);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_profile", details: parsed.error.flatten() });
    if (searching || Date.now() - lastSearch < (options.cooldownMs ?? 5000))
      return reply.code(429).header("Retry-After", "5").send({ error: "search_busy_try_later" });
    searching = true;
    lastSearch = Date.now();
    try {
      const result = await searchVerified(parsed.data, options.sources, city);
      await store.append(parsed.data, result.offers);
      return {
        profile: parsed.data,
        checkedAt: new Date().toISOString(),
        offers: rank(result.offers.map((offer) => freshness(offer))).map((entry) => ({
          ...entry.offer,
          risk: entry.risk,
          landed: landed(entry.offer),
        })),
        sourceOutcomes: result.sourceOutcomes,
        complete: result.sourceOutcomes.every((outcome) => outcome.status === "ok"),
        requestedCity: city,
        region: null,
      };
    } finally {
      searching = false;
    }
  });
  app.get("/api/history", async () => ({
    rows: (await store.history())
      .slice(-200)
      .reverse()
      .map((row) => ({ ...row, landed: landed(row.offer) })),
  }));
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.code(500).send({
      error: "operation_failed",
      detail: "Смотрите локальный журнал. История не перезаписывается при ошибке чтения.",
    });
  });
  return app;
}
