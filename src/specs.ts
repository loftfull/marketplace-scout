import type { ProductProfile } from "./domain.js";
import { parseQuery } from "./parse.js";
export function cardSpecs(title: string, properties: Array<{ name?: unknown; value?: unknown }>) {
  const specs: Partial<ProductProfile> = parseQuery(title);
  const reasons: string[] = [];
  const normalize = (value: unknown) =>
    String(value)
      .toLowerCase()
      .replace(/[^a-zа-я0-9]/gi, "");
  const fields: Record<string, Set<string>> = {};
  const add = (field: keyof ProductProfile, value: string | number | undefined) => {
    if (value === undefined || value === "") return;
    fields[field] ??= new Set();
    fields[field].add(normalize(value));
    if (specs[field] === undefined || specs[field] === "") Object.assign(specs, { [field]: value });
  };
  const capacity = (field: "ramGb" | "ssdGb", value: string) => {
    const match = /^\s*(\d+(?:[.,]\d+)?)\s*(gb|гб|tb|тб)?\s*$/i.exec(value);
    if (!match || Number(match[1].replace(",", ".")) <= 0) {
      reasons.push(`spec_evidence_unparseable_${field}`);
      return;
    }
    add(field, Number(match[1].replace(",", ".")) * (/tb|тб/i.test(match[2] ?? "") ? 1024 : 1));
  };
  for (const [key, value] of Object.entries(specs)) add(key as keyof ProductProfile, value);
  for (const year of title.matchAll(/\b(20\d{2})\b/g)) add("year", Number(year[1]));
  for (const cpu of title.matchAll(/(?:core\s*)?(ultra\s*(?:[579]|x[79])?\s*\d{3}[a-z]*)/gi))
    add("cpu", cpu[1]);
  for (const capacity of title.matchAll(/(\d+(?:[.,]\d+)?)\s*(gb|гб|tb|тб)/gi)) {
    const amount = Number(capacity[1].replace(",", "."));
    const tb = /tb|тб/i.test(capacity[2]);
    add(tb || amount >= 256 ? "ssdGb" : "ramGb", amount * (tb ? 1024 : 1));
  }
  for (const row of properties) {
    const name = String(row.name ?? "");
    const value = String(row.value ?? "");
    const parsed = parseQuery(value);
    if (/оператив|ram/i.test(name)) capacity("ramGb", value);
    else if (/ssd|накопител|storage/i.test(name)) capacity("ssdGb", value);
    else if (/процессор|cpu/i.test(name)) {
      const cpu = /^\s*(?:intel\s+)?(?:core\s+)?(ultra\s*(?:[579]|x[79])?\s*\d{3}[a-z]*)\s*$/i.exec(
        value,
      );
      if (!cpu) reasons.push("spec_evidence_unparseable_cpu");
      else add("cpu", cpu[1]);
    } else if (/год|year/i.test(name)) {
      if (!/^\s*20\d{2}\s*$/.test(value)) reasons.push("spec_evidence_unparseable_year");
      else add("year", Number(value));
    } else if (/бренд|производител|brand/i.test(name)) {
      if (!/^\s*(?:xiaomi|redmi|honor|lenovo|maibenben)\s*$/i.test(value))
        reasons.push("spec_evidence_unparseable_brand");
      else add("brand", parsed.brand);
    } else if (/модель|model/i.test(name)) add("model", value.trim());
  }
  for (const [field, values] of Object.entries(fields))
    if (values.size > 1) reasons.push(`spec_evidence_conflict_${field}`);
  if (!specs.brand) delete specs.brand;
  return { specs, reasons };
}
