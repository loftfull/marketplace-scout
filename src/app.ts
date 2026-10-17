import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { imageHosts } from "../public/offer-view.js";
import { cities, cityById } from "./cities.js";
import { type Connector, scrapyHtmlConnectors } from "./connectors.js";
import { ChangedetectionAdapter, type ChangeMonitor } from "./adapters/change-monitor.js";
import { landed } from "./cost.js";
import { freshness } from "./freshness.js";
import { parseQuery } from "./parse.js";
import { providerCatalog } from "./providers.js";
import { rank } from "./rank.js";
import { ResearchGateway, researchOperations, researchRequest } from "./research.js";
import { searchVerified } from "./service.js";
import { marketplaceNames, SourceCircuit } from "./source-circuit.js";
import { HistoryStore } from "./store.js";
import { canonicalUrl } from "./urls.js";

const schema = z.object({
  brand: z.string().trim().max(60),
  model: z.string().trim().min(2).max(120),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  cpu: z.string().max(60).optional(),
  ramGb: z.coerce.number().int().positive().max(2048).optional(),
  ssdGb: z.coerce.number().int().positive().max(100000).optional(),
  gpu: z.string().max(60).optional(),
});
const watchSchema = z.object({
  url: z.string().trim().min(8).max(1000),
  title: z.string().trim().min(3).max(300),
});
export async function buildApp(
  options: {
    sources?: Connector[];
    htmlSources?: Connector[];
    store?: HistoryStore;
    logger?: boolean;
    cooldownMs?: number;
    research?: ResearchGateway;
    sourceCircuit?: SourceCircuit;
    htmlSourceCircuit?: SourceCircuit;
    changeMonitor?: ChangeMonitor;
  } = {},
) {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 16384 });
  const store = options.store ?? new HistoryStore();
  const research = options.research ?? new ResearchGateway();
  const sourceCircuit = options.sourceCircuit ?? new SourceCircuit();
  const htmlSourceCircuit = options.htmlSourceCircuit ?? new SourceCircuit();
  const changeMonitor = options.changeMonitor ?? new ChangedetectionAdapter();
  app.addHook("onClose", async () => changeMonitor.close());
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
      `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: ${Object.values(
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
    searchModes: [
      { id: "native", label: "Подключённые коннекторы" },
      { id: "html", label: "HTML страниц (без site API)" },
    ],
    cities,
    defaultCity: "voronezh",
  }));
  app.post<{
    Params: { source: string };
    Querystring: { mode?: string };
  }>("/api/sources/:source/retry", async (request, reply) => {
    if (!marketplaceNames.includes(request.params.source as (typeof marketplaceNames)[number]))
      return reply.code(404).send({ error: "unknown_source" });
    if (request.query.mode && request.query.mode !== "native" && request.query.mode !== "html")
      return reply.code(400).send({ error: "invalid_search_mode" });
    try {
      const circuit = request.query.mode === "html" ? htmlSourceCircuit : sourceCircuit;
      await circuit.resume(request.params.source);
      lastSearch = 0;
      return reply.code(200).send({ ok: true, source: request.params.source });
    } catch {
      return reply
        .code(503)
        .send({ error: "source_circuit_state_unavailable", detail: "Пауза источника не снята." });
    }
  });
  app.get("/api/monitor/watches", async (_request, reply) => {
    try {
      const watches = await changeMonitor.list();
      for (const watch of watches) {
        if (!marketplaceNames.includes(watch.marketplace as (typeof marketplaceNames)[number])) {
          watch.canCheck = false;
          watch.blockedReason = "not_a_marketplace_product_watch";
          continue;
        }
        const [native, html] = await Promise.all([
          sourceCircuit.get(watch.marketplace),
          htmlSourceCircuit.get(watch.marketplace),
        ]);
        const pause = native ?? html;
        watch.canCheck = !pause;
        if (pause) watch.blockedReason = pause.detail;
      }
      return { service: "changedetection.io", watches };
    } catch {
      return reply.code(503).send({ error: "changedetection_unavailable" });
    }
  });
  app.post("/api/monitor/watches", async (request, reply) => {
    const parsed = watchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_watch" });
    let marketplace: (typeof marketplaceNames)[number] | undefined;
    let url: string | null = null;
    for (const name of marketplaceNames) {
      const candidate = canonicalUrl(parsed.data.url, name);
      if (candidate) {
        marketplace = name;
        url = candidate;
        break;
      }
    }
    if (!marketplace || !url) return reply.code(400).send({ error: "invalid_product_card_url" });
    try {
      const title = `${parsed.data.title.replace(/\s+/g, " ")} · UNVERIFIED`;
      const watch = await changeMonitor.add(url, title);
      watch.canCheck = false;
      watch.blockedReason = "new_watch_paused_until_explicit_check";
      return reply.code(201).send({ watch });
    } catch {
      return reply.code(503).send({ error: "changedetection_unavailable" });
    }
  });
  app.post<{ Params: { uuid: string } }>("/api/monitor/watches/:uuid/check", async (request, reply) => {
    if (!/^[a-zA-Z0-9-]{6,64}$/.test(request.params.uuid))
      return reply.code(400).send({ error: "invalid_watch_id" });
    try {
      const watches = await changeMonitor.list();
      const watch = watches.find((candidate) => candidate.uuid === request.params.uuid);
      if (!watch) return reply.code(404).send({ error: "watch_not_found" });
      if (!marketplaceNames.includes(watch.marketplace as (typeof marketplaceNames)[number]))
        return reply.code(400).send({ error: "not_a_marketplace_product_watch" });
      const marketplace = watch.marketplace as (typeof marketplaceNames)[number];
      let pauses;
      try {
        pauses = await Promise.all([sourceCircuit.get(marketplace), htmlSourceCircuit.get(marketplace)]);
      } catch {
        return reply.code(503).send({ error: "source_circuit_state_unavailable" });
      }
      const pause = pauses.find(Boolean);
      if (pause)
        return reply.code(409).send({ error: "source_paused", detail: pause.detail });
      const checked = await changeMonitor.check(watch.url);
      const status = Number(checked.last_check_status);
      if (checked.last_error || !Number.isFinite(status) || status < 200 || status >= 400) {
        const blocked = [401, 403, 407, 429, 451].includes(status);
        const state = blocked ? "blocked" : "error";
        const detail = blocked ? `http_${status}` : "changedetection_check_failed";
        await Promise.all([
          sourceCircuit.pause(marketplace, state, "changedetection-watch", detail),
          htmlSourceCircuit.pause(marketplace, state, "changedetection-watch", detail),
        ]);
        return reply.code(blocked ? 200 : 502).send({
          watch: { ...checked, canCheck: false, blockedReason: detail },
          verification: "UNVERIFIED",
        });
      }
      return { watch: { ...checked, verification: "UNVERIFIED" } };
    } catch {
      return reply.code(502).send({ error: "changedetection_check_failed" });
    }
  });
  app.get("/api/research", async () => ({ operations: researchOperations }));
  app.post("/api/research", async (request, reply) => {
    let input: ReturnType<typeof researchRequest>;
    try {
      input = researchRequest(request.body);
    } catch {
      return reply.code(400).send({ error: "invalid_research_request" });
    }
    if (searching || Date.now() - lastSearch < (options.cooldownMs ?? 5000))
      return reply.code(429).send({ error: "search_busy_try_later" });
    searching = true;
    lastSearch = Date.now();
    try {
      return await research.run(input);
    } finally {
      searching = false;
    }
  });
  app.get("/api/search", async (request, reply) => {
    const input = request.query as Record<string, unknown>;
    const city = cityById(input.city);
    if (!city) return reply.code(400).send({ error: "invalid_city" });
    const mode = input.mode ?? "native";
    if (mode !== "native" && mode !== "html")
      return reply.code(400).send({ error: "invalid_search_mode" });
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
      const sources =
        mode === "html" ? (options.htmlSources ?? scrapyHtmlConnectors) : options.sources;
      const circuit = mode === "html" ? htmlSourceCircuit : sourceCircuit;
      const result = await searchVerified(parsed.data, sources, city, circuit);
      if (mode === "native" || result.sourceOutcomes.every((outcome) => outcome.status === "ok")) {
        await store.append(parsed.data, result.offers);
      }
      return {
        profile: parsed.data,
        mode,
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
