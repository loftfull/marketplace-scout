const hosts: Record<string, string[]> = {
  "yandex-market": ["market.yandex.ru"],
  ozon: ["www.ozon.ru", "ozon.ru"],
  avito: ["www.avito.ru", "avito.ru"],
  wildberries: ["www.wildberries.ru", "wildberries.ru"],
};
export function marketplaceUrl(value: string, marketplace: string, card = true): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !hosts[marketplace]?.includes(url.hostname)
    )
      return null;
    if (card && !skuFromUrl(url, marketplace)) return null;
    return url;
  } catch {
    return null;
  }
}
export function skuFromUrl(url: URL, marketplace: string): string | undefined {
  if (marketplace === "wildberries")
    return url.pathname.match(/^\/catalog\/(\d+)\/detail\.aspx$/)?.[1];
  if (marketplace === "ozon") return url.pathname.match(/^\/product\/(?:[^/]*-)?(\d+)\/?$/)?.[1];
  if (marketplace === "avito") return url.pathname.match(/_[0-9]+\/?$/)?.[0].replace(/\D/g, "");
  if (marketplace === "yandex-market")
    return (
      url.pathname.match(/^\/(?:product--[^/]+|product)\/(\d+)\/?$/)?.[1] ??
      url.pathname.match(/^\/card\/[^/]+\/(\d+)\/?$/)?.[1]
    );
  return undefined;
}
export function canonicalUrl(value: string, marketplace: string): string | null {
  const url = marketplaceUrl(value, marketplace);
  if (!url) return null;
  if (marketplace === "yandex-market" && url.searchParams.getAll("sku").length > 1) return null;
  const sku = url.searchParams.get("sku");
  url.search = "";
  if (marketplace === "yandex-market" && sku && /^\d+$/.test(sku)) url.searchParams.set("sku", sku);
  url.hash = "";
  return url.href;
}
