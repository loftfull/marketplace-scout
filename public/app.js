function reasonText(reason) {
  const fields = {
    brand: "бренд",
    model: "модель",
    year: "год",
    cpu: "процессор",
    ramGb: "память",
    ssdGb: "накопитель",
    gpu: "видеокарта",
  };
  if (reason.startsWith("missing_"))
    return `Не подтверждено: ${fields[reason.slice(8)] || reason.slice(8)}`;
  if (reason.startsWith("mismatch_"))
    return `Не совпадает: ${fields[reason.slice(9)] || reason.slice(9)}`;
  if (reason.startsWith("spec_evidence_"))
    return "Характеристики неоднозначны или противоречат друг другу";
  const labels = {
    selected_product_schema_missing_or_ambiguous: "Нет однозначных данных выбранного товара",
    selected_offer_ambiguous: "Предложение продавца не определено",
    card_unavailable_or_challenged: "Площадка ограничила доступ к карточке",
    live_card_not_confirmed: "Живая карточка не подтверждена",
    sku_missing: "Артикул не подтверждён",
    variant_missing: "Вариант не подтверждён",
    seller_missing: "Продавец не подтверждён",
    current_price_missing: "Текущая цена не подтверждена",
    unconditional_price_not_confirmed: "Цена без специальных условий не подтверждена",
    availability_not_confirmed: "Наличие не подтверждено",
    card_reopen_failed: "Не удалось повторно открыть карточку",
    sku_or_marketplace_changed: "При открытии изменился товар или вариант",
    price_not_visible_on_card: "Цена отсутствует в выбранной карточке",
    seller_not_visible_on_card: "Продавец отсутствует в выбранной карточке",
    verification_expired: "Срок проверки истёк",
  };
  return labels[reason] || reason;
}
const $ = (selector) => document.querySelector(selector);
const names = { "yandex-market": "Яндекс Маркет", ozon: "Ozon", avito: "Avito" };
let currentOffers = [];
const money = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
      }).format(value)
    : "неизвестно";
const date = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("ru-RU")
    : "не подтверждено";
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function statusNow(offer) {
  if (offer.evidence?.live === false) return "UNVERIFIED";
  if (offer.status !== "VERIFIED") return offer.status;
  const age = Date.now() - Date.parse(offer.verifiedAt || "");
  return !Number.isFinite(age) || age < 0 ? "UNVERIFIED" : age >= 900000 ? "STALE" : "VERIFIED";
}
function safeLink(offer) {
  try {
    const url = new URL(offer.url);
    const hosts = {
      "yandex-market": ["market.yandex.ru"],
      ozon: ["ozon.ru", "www.ozon.ru"],
      avito: ["avito.ru", "www.avito.ru"],
    };
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts[offer.marketplace]?.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function card(offer, seenAt) {
  const article = element("article", "card");
  const info = element("div");
  info.append(element("strong", "", offer.title || "Карточка без названия"));
  info.append(
    element(
      "div",
      "meta",
      (names[offer.marketplace] || offer.marketplace) +
        " · " +
        (offer.seller || "продавец не подтверждён"),
    ),
  );
  info.append(
    element(
      "div",
      "meta",
      "SKU: " +
        (offer.sku || "не установлен") +
        " · Проверка: " +
        date(offer.evidence?.observedAt || offer.verifiedAt),
    ),
  );
  if (seenAt) info.append(element("div", "meta", `Наблюдение: ${date(seenAt)}`));
  const cost = offer.landed || {};
  const price = element("div");
  price.append(element("div", "price", money(offer.priceRub)));
  price.append(
    element("div", "meta", `Доставка: ${money(cost.shipping)} · Пошлина: ${money(cost.duty)}`),
  );
  price.append(element("div", "meta", `Итого: ${money(cost.total)}`));
  price.append(element("div", "meta", `Регион: ${cost.region || "не задан"}`));
  if (offer.evidence?.priceKind !== "ordinary")
    price.append(element("div", "meta", "Условия цены не подтверждены"));
  const actions = element("div");
  const status = statusNow(offer);
  actions.append(element("span", `badge ${status === "VERIFIED" ? "" : "warn"}`, status));
  const url = safeLink(offer);
  if (url) {
    const link = element("a", "offer-link", "Открыть карточку ↗");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
  }
  article.append(info, price, actions);
  const reasons = [...(offer.reasons || [])];
  if (status === "STALE") reasons.push("Срок подтверждения истёк — повторите поиск.");
  if (reasons.length)
    article.append(element("div", "reasons", [...new Set(reasons.map(reasonText))].join(" · ")));
  return article;
}
function renderOffers() {
  const results = $("#results");
  results.replaceChildren();
  const verified = currentOffers.filter((offer) => statusNow(offer) === "VERIFIED").length;
  $("#count").textContent = `${currentOffers.length} найдено · ${verified} подтверждено`;
  if (!currentOffers.length)
    results.append(
      element(
        "div",
        "empty",
        "Подтверждённых предложений нет. Состояние каждой площадки указано выше; отсутствие результата не означает отсутствие товара.",
      ),
    );
  for (const offer of currentOffers) results.append(card(offer));
}
async function history() {
  const box = $("#history");
  try {
    const response = await fetch("/api/history");
    if (!response.ok) throw new Error("История недоступна");
    const { rows } = await response.json();
    box.replaceChildren();
    if (!rows.length)
      box.append(
        element("div", "empty", "История пока пуста. Здесь появятся реальные найденные карточки."),
      );
    for (const row of rows) box.append(card({ ...row.offer, landed: row.landed }, row.seenAt));
  } catch {
    box.replaceChildren(
      element("div", "empty", "Не удалось прочитать историю. Попробуйте обновить."),
    );
  }
}
$("#f").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#search").disabled = true;
  $("#results").setAttribute("aria-busy", "true");
  $("#results").replaceChildren(
    element("div", "empty", "Ищу предложения и повторно открываю карточки…"),
  );
  $("#sources").replaceChildren();
  $("#count").textContent = "";
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent($("#q").value)}`, {
      signal: AbortSignal.timeout(600000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Проверка уже идёт. Дождитесь завершения и повторите запрос."
          : "Проверка не завершена. Проверьте локальный журнал.",
      );
    currentOffers = data.offers || [];
    for (const source of data.sourceOutcomes || []) {
      const el = element("div", "source");
      el.append(
        element(
          "strong",
          "",
          `${names[source.marketplace] || source.marketplace}: ${source.status}`,
        ),
      );
      el.append(
        element(
          "div",
          "meta",
          source.status === "blocked"
            ? "Площадка ограничила доступ. Подтвердить цену не удалось."
            : source.status === "ok"
              ? "Поиск завершён. Подтверждение каждой карточки указано ниже."
              : "Источник не дал подтверждённых данных. Подробности сохранены в журнале.",
        ),
      );
      $("#sources").append(el);
    }
    renderOffers();
    await history();
  } catch (error) {
    $("#results").replaceChildren(
      element(
        "div",
        "empty",
        error.name === "TimeoutError"
          ? "Время ожидания истекло. Проверка может ещё выполняться; повторите позже."
          : error.message,
      ),
    );
  } finally {
    $("#search").disabled = false;
    $("#results").removeAttribute("aria-busy");
  }
});
$("#refresh-history").addEventListener("click", history);
fetch("/health")
  .then((response) => {
    if (!response.ok) throw new Error();
    $("#health").textContent = "● API доступен";
  })
  .catch(() => {
    $("#health").textContent = "● API недоступен";
  });
void history();
setInterval(() => {
  if (!$("#search").disabled && currentOffers.length) renderOffers();
}, 30000);
