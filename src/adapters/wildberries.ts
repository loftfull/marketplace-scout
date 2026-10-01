import { resolve } from "node:path";
import type { City } from "../cities.js";
import { sameCity } from "../cities.js";
import type { Discovery } from "../connectors.js";
import type { NativeEvidence, Offer, ProductProfile } from "../domain.js";
import { match } from "../domain.js";
import { parseQuery, queryFor } from "../parse.js";
import { McpClient, toolCalls, toolFailure } from "./http-mcp.js";
import { publicJson } from "./public-http.js";

const runtime = resolve(".runtime/ru-marketplace-mcp");
export const wbMcp = new McpClient({
  command: resolve(
    runtime,
    process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
  ),
  args: [resolve("scripts/wb-guard.py")],
  cwd: runtime,
  env: { WB_NET_RETRIES: "0" },
});
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const money = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
export function destinationFrom(raw: unknown, city: City): string {
  const row = record(raw);
  // Never accept an address string copied from our query as proof of mapping.
  const cityName = row.city ?? row.cityName;
  const latitude = row.latitude,
    longitude = row.longitude;
  if (
    !sameCity(cityName, city) ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Math.abs(latitude - city.latitude) > 0.3 ||
    Math.abs(longitude - city.longitude) > 0.3 ||
    typeof row.xinfo !== "string"
  )
    throw Error("city_mapping_unconfirmed");
  const values = new URLSearchParams(row.xinfo).getAll("dest");
  if (values.length !== 1 || !/^-?\d{1,12}$/.test(values[0])) throw Error("invalid_destination");
  return values[0];
}
export async function resolveDestination(city: City): Promise<string> {
  const started = Date.now();
  let status = "ok";
  try {
    const url = new URL("https://user-geo-data.wildberries.ru/get-geo-info");
    url.search = new URLSearchParams({
      currency: "RUB",
      latitude: String(city.latitude),
      longitude: String(city.longitude),
      address: city.name,
    }).toString();
    return destinationFrom(await publicJson(url, "user-geo-data.wildberries.ru"), city);
  } catch (error) {
    status = toolFailure(error);
    throw error;
  } finally {
    toolCalls.push({
      provider: "Wildberries public geo",
      tool: "get-geo-info",
      status,
      at: new Date().toISOString(),
      durationMs: Date.now() - started,
    });
  }
}
export function normalizeWbSearch(
  raw: unknown,
  profile: ProductProfile,
  destinationId: string,
): Offer[] {
  const response = record(raw);
  if (response.dest !== destinationId) throw Error("destination_mismatch");
  if (response.status === "no_results") return [];
  if (!Array.isArray(response.items)) throw Error("invalid_wb_response");
  const offers: Offer[] = [];
  for (const value of response.items.slice(0, 40)) {
    const row = record(value);
    if (
      !Number.isSafeInteger(row.nm_id) ||
      Number(row.nm_id) <= 0 ||
      typeof row.name !== "string" ||
      !row.name.trim()
    )
      continue;
    const sku = String(row.nm_id);
    offers.push({
      marketplace: "wildberries",
      sku,
      title: row.name.slice(0, 500),
      url: `https://www.wildberries.ru/catalog/${sku}/detail.aspx`,
      priceRub: money(row.price_rub),
      discoveryPriceKind: "unknown",
      discoveryProvider: "ru-marketplace-mcp/wb_search → wb_card",
      destinationId,
      discoveryReferenceRub: money(row.price_original_rub) ?? undefined,
      seller: typeof row.supplier === "string" ? row.supplier : undefined,
      specs: parseQuery(row.name),
      status: "UNVERIFIED",
      reasons: [],
      discoveredAt: new Date().toISOString(),
    });
  }
  offers.sort((a, b) => {
    const x = match(profile, a),
      y = match(profile, b);
    return x.reasons.length * 10 + x.missing.length - y.reasons.length * 10 - y.missing.length;
  });
  return offers.slice(0, 3);
}
export async function searchWb(profile: ProductProfile, city: City): Promise<Discovery> {
  let stage = "region-resolution";
  try {
    const destinationId = await resolveDestination(city);
    stage = "native-discovery";
    const search = record(
      await wbMcp.call(
        "wb_search",
        { query: queryFor(profile), dest: destinationId },
        45000,
        AbortSignal.timeout(50000),
      ),
    );
    if (search.dest !== undefined && search.dest !== destinationId)
      throw Error("destination_mismatch");
    if (search.status !== "no_results" && !Array.isArray(search.items))
      throw Error("invalid_wb_response");
    // Upstream search output omits dest. Re-read its candidate IDs through wb_card,
    // which carries dest, before accepting any discovery prices from that response.
    const ids = (Array.isArray(search.items) ? search.items : [])
      .slice(0, 30)
      .map(record)
      .filter((row) => Number.isSafeInteger(row.nm_id) && Number(row.nm_id) > 0)
      .map((row) => Number(row.nm_id))
      .slice(0, 3);
    const offers = ids.length
      ? normalizeWbSearch(
          await wbMcp.call(
            "wb_card",
            { nm_ids: ids, dest: destinationId },
            25000,
            AbortSignal.timeout(30000),
          ),
          profile,
          destinationId,
        )
      : [];
    return {
      offers,
      outcome: {
        marketplace: "wildberries",
        status: offers.length ? "ok" : "empty",
        stage,
        detail: `dest=${destinationId}; API price conditions/size not confirmed`,
        offersReturned: offers.length,
      },
    };
  } catch (error) {
    return {
      offers: [],
      outcome: {
        marketplace: "wildberries",
        status: toolFailure(error),
        stage,
        detail:
          stage === "region-resolution"
            ? "city_mapping_unconfirmed; no default Moscow fallback"
            : "wb_search_failed",
        offersReturned: 0,
      },
    };
  }
}
export function normalizeWbCard(offer: Offer, raw: unknown): NativeEvidence {
  const base: NativeEvidence = {
    provider: "ru-marketplace-mcp",
    tool: "wb_card",
    status: "invalid",
    observedAt: new Date().toISOString(),
  };
  const row = record(raw);
  if (
    !offer.destinationId ||
    row.dest !== offer.destinationId ||
    !Array.isArray(row.items) ||
    row.items.length !== 1
  )
    return base;
  const item = record(row.items[0]);
  if (String(item.nm_id) !== offer.sku) return { ...base, status: "mismatch" };
  // This upstream schema collapses sizes; its price cannot corroborate an exact-size ordinary price.
  return {
    ...base,
    status: "ok",
    sku: offer.sku,
    destinationId: offer.destinationId,
    seller: typeof item.supplier === "string" ? item.supplier : undefined,
    specs: typeof item.name === "string" ? parseQuery(item.name) : {},
    available: typeof item.total_quantity === "number" ? item.total_quantity > 0 : undefined,
  };
}
export async function wbCard(offer: Offer): Promise<NativeEvidence> {
  try {
    return normalizeWbCard(
      offer,
      await wbMcp.call(
        "wb_card",
        { nm_ids: [Number(offer.sku)], dest: offer.destinationId },
        25000,
        AbortSignal.timeout(30000),
      ),
    );
  } catch (error) {
    return {
      provider: "ru-marketplace-mcp",
      tool: "wb_card",
      status: toolFailure(error) as NativeEvidence["status"],
      observedAt: new Date().toISOString(),
    };
  }
}
