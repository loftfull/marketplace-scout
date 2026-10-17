import type { ProductProfile } from "./domain.js";
export function parseQuery(query: string): ProductProfile {
  const year = query.match(/\b(20\d{2})\b/)?.[1];
  const cpu = query.match(/(?:core\s*)?(ultra\s*(?:[579]|x[79])?\s*\d{3}[a-z]*)/i)?.[1];
  const capacities = [
    ...query.matchAll(/(\d+(?:[.,]\d+)?)\s*(gb|гб|tb|тб|g|г|t|т)(?![\p{L}\p{N}])/giu),
  ];
  const ram = capacities.find((m) => /gb|гб|g|г/i.test(m[2]) && Number(m[1]) <= 128);
  const ssd = capacities.find((m) => /tb|тб|t|т/i.test(m[2]) || Number(m[1]) >= 256);
  const brand = /redmi|xiaomi/i.test(query)
    ? "Xiaomi"
    : /honor/i.test(query)
      ? "HONOR"
      : /lenovo|xiaoxin|thinkbook|legion/i.test(query)
        ? "Lenovo"
        : /maibenben/i.test(query)
          ? "MAIBENBEN"
          : "";
  const explicitRedmiModel = query.match(/\bredmi\s*book\s*(?:pro\s*)?(\d{1,2})(?!\d)/i);
  const genericRedmiLaptop =
    /\bredmi\s*book(?=$|\s|\d)/i.test(query) ||
    (/(?:^|\s)(?:ноутбук|laptop|notebook)(?:\s|$)/i.test(query) && /\bredmi\b/i.test(query));
  const model = explicitRedmiModel
    ? `RedmiBook${/pro/i.test(explicitRedmiModel[0]) ? " Pro" : ""} ${explicitRedmiModel[1]}`
    : genericRedmiLaptop
      ? "RedmiBook"
      : query
          .replace(/\b20\d{2}\b/g, "")
          .replace(/(?:core\s*)?ultra\s*(?:[579]|x[79])?\s*\d{3}[a-z]*/gi, "")
          .replace(/\d+(?:[.,]\d+)?\s*(gb|гб|tb|тб|g|г|t|т)(?![\p{L}\p{N}])/giu, "")
          .replace(/[|/]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
  return {
    brand,
    model,
    ...(year && { year: Number(year) }),
    ...(cpu && { cpu: cpu.replace(/\s+/g, " ").trim() }),
    ...(ram && { ramGb: Number(ram[1]) }),
    ...(ssd && {
      ssdGb: Math.round(Number(ssd[1].replace(",", ".")) * (/tb|тб|t|т/i.test(ssd[2]) ? 1024 : 1)),
    }),
  };
}
export function queryFor(profile: ProductProfile) {
  const storage =
    profile.ssdGb && profile.ssdGb % 1024 === 0
      ? `${profile.ssdGb / 1024}TB`
      : profile.ssdGb && `${profile.ssdGb}GB`;
  return [
    profile.brand,
    profile.model,
    profile.year,
    profile.cpu,
    profile.ramGb && `${profile.ramGb}GB`,
    storage,
  ]
    .filter(Boolean)
    .join(" ");
}
