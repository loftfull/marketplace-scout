// Presentation only: stored observations and verification evidence remain unchanged.
export function filterHistory(rows, query = "", city = "") {
  const terms = query.trim().toLocaleLowerCase("ru-RU").split(/\s+/).filter(Boolean);
  return rows.filter(({ offer }) => {
    const text = `${offer.title || ""} ${offer.sku || ""}`.toLocaleLowerCase("ru-RU");
    const compact = text.replace(/\s+/g, "");
    return terms.every((term) => compact.includes(term)) && (!city || offer.requestedCity === city);
  });
}

export function statusLabel(status) {
  return (
    {
      VERIFIED: "Подтверждено",
      UNVERIFIED: "Нужна проверка",
      MISMATCH: "Другой вариант",
      STALE: "Проверка устарела",
    }[status] || "Не подтверждено"
  );
}
