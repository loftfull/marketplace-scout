export const imageHosts = {
  "yandex-market": ["avatars.mds.yandex.net", "avatars.mds.yandex.ru"],
  ozon: ["ir.ozone.ru", "cdn1.ozone.ru"],
  avito: ["img.avito.st", "00.img.avito.st", "01.img.avito.st", "02.img.avito.st"],
};
export function safeImage(value, marketplace) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      imageHosts[marketplace]?.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function statusNow(offer, now = Date.now()) {
  if (offer.evidence?.live === false) return "UNVERIFIED";
  if (offer.status !== "VERIFIED") return offer.status;
  const age = now - Date.parse(offer.verifiedAt || "");
  return !Number.isFinite(age) || age < 0 ? "UNVERIFIED" : age >= 900000 ? "STALE" : "VERIFIED";
}
export function priceFor(offer, basis) {
  const value =
    basis === "discovery"
      ? offer.discoveryPriceRub
      : statusNow(offer) === "VERIFIED" && offer.evidence?.priceKind === "ordinary"
        ? offer.priceRub
        : null;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
export function parseBounds(minText, maxText) {
  const min = minText.trim() === "" ? null : Number(minText);
  const max = maxText.trim() === "" ? null : Number(maxText);
  if ([min, max].some((value) => value !== null && (!Number.isFinite(value) || value < 0)))
    return { error: "Введите неотрицательную цену в рублях." };
  if (min !== null && max !== null && min > max)
    return { error: "Цена «от» не должна превышать цену «до»." };
  return { min, max };
}
export function filterOffers(offers, { min, max, basis, includeUnknown }) {
  if (min === null && max === null) return offers;
  return offers.filter((offer) => {
    const value = priceFor(offer, basis);
    return value === null
      ? includeUnknown
      : (min === null || value >= min) && (max === null || value <= max);
  });
}
export function reasonSummary(offer) {
  const status = statusNow(offer);
  if (status === "STALE") return "Проверка устарела. Повторите поиск для актуальной цены.";
  if (
    offer.reasons?.includes("card_unavailable_or_challenged") ||
    offer.evidence?.httpStatus === 403 ||
    offer.evidence?.httpStatus === 429
  )
    return "Площадка ограничила доступ к карточке. Цену и характеристики пока не удалось проверить.";
  if (offer.reasons?.includes("card_reopen_failed"))
    return "Карточка не открылась. Повторите поиск позже или откройте ссылку на площадке.";
  if (status === "MISMATCH") return "Товар или его характеристики не совпадают с запросом.";
  if (status === "VERIFIED") return "Цена и характеристики подтверждены при открытии карточки.";
  return "Данных карточки недостаточно для подтверждения цены и комплектации.";
}
