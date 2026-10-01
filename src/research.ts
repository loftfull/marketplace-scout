import { z } from "zod";
import { toolFailure } from "./adapters/http-mcp.js";
import { avitoMcp } from "./adapters/native-cards.js";
import { callOzon } from "./adapters/ozon-runtime.js";
import { resolveDestination, wbMcp } from "./adapters/wildberries.js";
import { yandexMcp } from "./adapters/yandex.js";
import { browserRuntime } from "./browser.js";
import { type City, cities } from "./cities.js";

type Field = {
  key: string;
  label: string;
  kind: "id" | "ids" | "query" | "seller" | "shard" | "selector" | "root";
};
type Operation = {
  id: string;
  source: string;
  tool: string;
  label: string;
  fields: Field[];
  note: string;
};
const field = (key: string, label: string, kind: Field["kind"] = "id"): Field => ({
  key,
  label,
  kind,
});
const product = field("product", "Артикул товара");
const query = field("query", "Поисковый запрос", "query");
const products = field("products", "Артикулы через запятую (до 3)", "ids");
const op = (
  source: string,
  tool: string,
  label: string,
  fields: Field[],
  note = "Наблюдение площадки. Не подтверждает цену, регион и комплектацию.",
): Operation => ({ id: `${source}.${tool}`, source, tool, label, fields, note });
export const researchOperations: Operation[] = [
  op("yandex-market", "search_products", "Поиск товаров", [query]),
  op("yandex-market", "get_product", "Карточка и характеристики", [product]),
  op("yandex-market", "get_offers", "Предложения продавцов", [
    field("model_id", "ID модели"),
    field("sku_id", "ID варианта SKU"),
  ]),
  op(
    "yandex-market",
    "get_reviews",
    "Отзывы о карточке",
    [product],
    "Отзывы карточки могут относиться к другим товарам продавца. Область отзывов сохраняется в ответе.",
  ),
  op("yandex-market", "get_questions", "Вопросы и ответы", [product]),
  op(
    "yandex-market",
    "get_seller",
    "Данные продавца",
    [field("business_id", "ID магазина")],
    "Общая репутация магазина. Юридические сведения через дополнительный POST могут быть недоступны.",
  ),
  op("yandex-market", "compare_products", "Сравнение карточек", [products]),
  op("ozon", "search_products", "Поиск товаров", [query]),
  op("ozon", "get_product", "Карточка, варианты и продавцы", [product]),
  op(
    "ozon",
    "get_reviews",
    "Отзывы точного SKU",
    [product],
    "Отзывы выбранного SKU. Общий рейтинг линейки может отличаться.",
  ),
  op("ozon", "compare_products", "Сравнение карточек", [products]),
  op(
    "wildberries",
    "wb_search",
    "Поиск по региону",
    [query],
    "Регион обязателен. Поисковые цены не считаются подтверждёнными; используйте региональную карточку.",
  ),
  op("wildberries", "wb_card", "Региональные карточки", [
    field("nm_ids", "Артикулы nmID через запятую (до 3)", "ids"),
  ]),
  op("wildberries", "wb_root_info", "Варианты и ID группы отзывов", [
    field("nm_id", "Артикул nmID"),
  ]),
  op(
    "wildberries",
    "wb_reviews",
    "Отзывы о модели",
    [field("imt_id", "ID группы imtID")],
    "Общий пул отзывов всех вариантов модели, а не только выбранной комплектации.",
  ),
  op(
    "wildberries",
    "wb_questions",
    "Вопросы о модели",
    [field("imt_id", "ID группы imtID")],
    "Вопросы относятся ко всей группе вариантов imtID.",
  ),
  op("wildberries", "wb_seller", "Данные продавца", [field("supplier_id", "ID продавца")]),
  op("wildberries", "wb_categories", "Категории каталога", [
    field("root", "Категория или top", "root"),
  ]),
  op("wildberries", "wb_category_products", "Товары категории", [
    field("shard", "Раздел shard из категорий", "shard"),
    field("query", "Селектор cat=123 или subject=123", "selector"),
  ]),
  op("avito", "avito_card", "Карточка объявления", [field("item_id_or_url", "ID объявления")]),
  op(
    "avito",
    "avito_seller",
    "Репутация продавца",
    [field("seller_id_or_url", "ID продавца", "seller")],
    "Рейтинг продавца относится ко всем его объявлениям; отзывов отдельного товара на Avito нет.",
  ),
];
const numeric = /^[1-9]\d{0,14}$/;
export function researchRequest(raw: unknown) {
  const input = z
    .object({
      operation: z.string().max(70),
      city: z.enum(["voronezh", "moskva", "sankt-peterburg"]).default("voronezh"),
      values: z.record(z.string(), z.string().max(200)),
    })
    .strict()
    .parse(raw);
  const operation = researchOperations.find((row) => row.id === input.operation);
  if (
    !operation ||
    Object.keys(input.values).some((key) => !operation.fields.some((f) => f.key === key))
  )
    throw Error("invalid_operation_fields");
  const args: Record<string, unknown> = {};
  for (const f of operation.fields) {
    const value = input.values[f.key]?.trim() ?? "";
    if (!value || [...value].some((character) => character.charCodeAt(0) < 32))
      throw Error("invalid_field");
    if (f.kind === "id" && !numeric.test(value)) throw Error("invalid_id");
    if (f.kind === "ids") {
      const ids = value.split(",").map((v) => v.trim());
      if (ids.length > 3 || !ids.every((id) => numeric.test(id))) throw Error("invalid_ids");
      args[f.key] = [...new Set(ids)];
      continue;
    }
    if (f.kind === "query" && (value.length < 2 || /https?:\/\//i.test(value)))
      throw Error("invalid_query");
    if (f.kind === "seller" && !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw Error("invalid_seller");
    if (f.kind === "shard" && !/^[a-z0-9_-]{1,80}$/.test(value)) throw Error("invalid_shard");
    if (f.kind === "selector" && !/^(cat|subject)=[1-9]\d{0,12}$/.test(value))
      throw Error("invalid_selector");
    if (f.kind === "root" && !/^[\p{L}\p{N} _-]{1,80}$/u.test(value)) throw Error("invalid_root");
    args[f.key] = value;
  }
  return { operation, city: cities.find((city) => city.id === input.city) as City, args };
}
// Public research is bounded and contains no buyer identity fields or executable markup.
export function researchData(value: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (typeof value === "string")
    return value
      .slice(0, 2000)
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[контакт скрыт]")
      .replace(/(?:\+7|8)[ (]+\d{3}[) -]+\d{3}[ -]+\d{2}[ -]+\d{2}/g, "[контакт скрыт]");
  if (Array.isArray(value)) return value.slice(0, 40).map((row) => researchData(row, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 80)
        .filter(
          ([key]) =>
            !/(?:^__|prototype|constructor|author|buyer|^user$|^fio$|^(?:full|first|last)_?name$|reviewer|asker|user_?name|nickname|phone|email|avatar|profile|user_?id)/i.test(
              key,
            ),
        )
        .map(([key, item]) => [key, researchData(item, depth + 1)]),
    );
  return value === null || typeof value === "boolean" || typeof value === "number" ? value : null;
}
export async function invokeResearch(
  operation: Operation,
  args: Record<string, unknown>,
  city: City,
): Promise<unknown> {
  if (operation.source === "yandex-market") {
    if (operation.tool === "search_products")
      Object.assign(args, { page: 1, include_sponsored: false });
    if (operation.tool === "get_reviews") Object.assign(args, { page: 1, scope: "card" });
    return yandexMcp.call(operation.tool, args, 35000, AbortSignal.timeout(40000));
  }
  if (operation.source === "ozon") {
    if (operation.tool === "get_reviews")
      Object.assign(args, { page: 1, limit: 30, scope: "sku", include_seller_replies: false });
    if (operation.tool === "search_products") Object.assign(args, { page: 1, limit: 10 });
    return callOzon(operation.tool, args);
  }
  if (operation.source === "avito") {
    await browserRuntime.ensure();
    return avitoMcp.call(operation.tool, args, 35000, AbortSignal.timeout(40000));
  }
  if (["wb_card", "wb_search", "wb_category_products"].includes(operation.tool))
    args.dest = await resolveDestination(city);
  for (const key of ["nm_id", "imt_id", "supplier_id"])
    if (args[key]) args[key] = Number(args[key]);
  if (Array.isArray(args.nm_ids)) args.nm_ids = args.nm_ids.map(Number);
  if (operation.tool === "wb_categories") args.max_depth = 1;
  if (["wb_reviews", "wb_questions"].includes(operation.tool)) args.limit = 20;
  return wbMcp.call(operation.tool, args, 35000, AbortSignal.timeout(40000));
}
export class ResearchGateway {
  private blockedUntil = new Map<string, number>();
  constructor(private invoke = invokeResearch) {}
  async run(input: ReturnType<typeof researchRequest>) {
    const { operation, args, city } = input;
    const base = {
      operation: operation.id,
      source: operation.source,
      tool: operation.tool,
      requestedCity: city.name,
      observedAt: new Date().toISOString(),
      verification: "UNVERIFIED",
      note: operation.note,
    };
    if ((this.blockedUntil.get(operation.source) ?? 0) > Date.now())
      return { ...base, status: "blocked", data: null };
    try {
      const data = await this.invoke(operation, { ...args }, city);
      if (JSON.stringify(data).length > 512 * 1024) throw Error("source_response_too_large");
      const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const failure = toolFailure(`${row.status ?? ""} ${row.error ?? ""}`);
      if (failure === "blocked") throw Error("source_blocked");
      const safe = researchData(data);
      if (JSON.stringify(safe).length > 256 * 1024) throw Error("source_response_too_large");
      return { ...base, status: "observed", data: safe };
    } catch (error) {
      const status = toolFailure(error);
      if (status === "blocked")
        this.blockedUntil.set(operation.source, Date.now() + 10 * 60 * 1000);
      return { ...base, status, data: null };
    }
  }
}
