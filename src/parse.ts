import type { ProductProfile } from "./domain.js";
export function parseQuery(query: string): ProductProfile {
  const year = query.match(/\b(20\d{2})\b/)?.[1];
  const cpu = query.match(/(?:core\s*)?(ultra\s*(?:[579]|x[79])?\s*\d{3}[a-z]*)/i)?.[1];
  const capacities = [...query.matchAll(/(\d+(?:[.,]\d+)?)\s*(gb|гб|tb|тб)/gi)];
  const ram = capacities.find((m) => /gb|гб/i.test(m[2]) && Number(m[1]) <= 128);
  const ssd = capacities.find((m) => /tb|тб/i.test(m[2]) || Number(m[1]) >= 256);
  const brand = /redmi|xiaomi/i.test(query)
    ? "Xiaomi"
    : /honor/i.test(query)
      ? "HONOR"
      : /lenovo|xiaoxin|thinkbook|legion/i.test(query)
        ? "Lenovo"
        : /maibenben/i.test(query)
          ? "MAIBENBEN"
          : "";
  const model = /redmi\s*book\s*pro\s*16/i.test(query)
    ? "RedmiBook Pro 16"
    : query
        .replace(/\b20\d{2}\b/g, "")
        .replace(/(?:core\s*)?ultra\s*(?:[579]|x[79])?\s*\d{3}[a-z]*/gi, "")
        .replace(/\d+(?:[.,]\d+)?\s*(gb|гб|tb|тб)/gi, "")
        .replace(/\s+/g, " ")
        .trim();
  return {
    brand,
    model,
    ...(year && { year: Number(year) }),
    ...(cpu && { cpu: cpu.replace(/\s+/g, " ").trim() }),
    ...(ram && { ramGb: Number(ram[1]) }),
    ...(ssd && {
      ssdGb: Math.round(Number(ssd[1].replace(",", ".")) * (/tb|тб/i.test(ssd[2]) ? 1024 : 1)),
    }),
  };
}
export function queryFor(profile: ProductProfile) {
  return [
    profile.brand,
    profile.model,
    profile.year,
    profile.cpu,
    profile.ramGb && `${profile.ramGb}GB`,
    profile.ssdGb && `${profile.ssdGb}GB`,
  ]
    .filter(Boolean)
    .join(" ");
}
