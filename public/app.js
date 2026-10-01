import {
  filterOffers,
  parseBounds,
  priceFor,
  reasonSummary,
  safeImage,
  statusNow,
} from "./offer-view.js";

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
    native_identity_unmatched: "Нативный коннектор вернул другой товар или вариант",
    native_card_conflict: "Данные коннектора и повторно открытой карточки расходятся",
  };
  return labels[reason] || reason;
}
const $ = (selector) => document.querySelector(selector);
const names = { "yandex-market": "Яндекс Маркет", ozon: "Ozon", avito: "Avito" };
let currentOffers = [];
let historyRows = [];
let renderedOfferStatuses = "";
let renderedHistoryStatuses = "";
const statusSignature = (offers) => offers.map((offer) => statusNow(offer)).join(",");
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
  const photo = element("figure", "product-photo");
  const imageUrl = safeImage(offer.imageUrl, offer.marketplace);
  if (imageUrl) {
    const img = element("img");
    img.alt = `Фото: ${offer.title || "товар"}`;
    img.width = 144;
    img.height = 112;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener(
      "error",
      () => photo.replaceChildren(element("span", "photo-empty", "Фото недоступно")),
      { once: true },
    );
    img.src = imageUrl;
    photo.append(
      img,
      element(
        "figcaption",
        "meta",
        offer.imageSource === "card"
          ? "Фото из карточки"
          : "Фото из поиска · комплектация не подтверждена",
      ),
    );
  } else photo.append(element("span", "photo-empty", "Нет фото от площадки"));
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
  const currentPrice = priceFor(offer, "current");
  price.append(element("div", "meta", "Подтверждённая цена"));
  price.append(
    element("div", "price", currentPrice === null ? "Не подтверждена" : money(currentPrice)),
  );
  const discoveryPrice = priceFor(offer, "discovery");
  if (discoveryPrice !== null) {
    price.append(element("div", "search-price", `${money(discoveryPrice)} в поиске`));
    price.append(element("div", "meta", `Не подтверждено · ${date(offer.discoveredAt)}`));
  }
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
  article.append(photo, info, price, actions);
  const reasons = [...(offer.reasons || [])];
  if (status === "STALE") reasons.push("Срок подтверждения истёк — повторите поиск.");
  const verification = element("div", "verification");
  verification.append(element("p", "verification-summary", reasonSummary(offer)));
  if (reasons.length) {
    const details = element("details", "reasons");
    details.append(element("summary", "", "Подробности проверки"));
    const list = element("ul");
    for (const reason of new Set(reasons.map(reasonText))) list.append(element("li", "", reason));
    details.append(list);
    verification.append(details);
  }
  if (offer.native) {
    const native = offer.native;
    const details = element("details", "reasons");
    details.append(element("summary", "", "Данные коннектора"));
    const labels = {
      ok: "данные получены",
      blocked: "доступ ограничен",
      invalid: "не удалось связать с выбранным товаром",
      mismatch: "другой товар или вариант",
      timeout: "время ожидания истекло",
      error: "ошибка получения",
    };
    details.append(
      element(
        "p",
        "meta",
        `${native.provider} · ${native.tool} · ${labels[native.status] || native.status} · ${date(native.observedAt)}`,
      ),
    );
    if (native.status === "ok") {
      details.append(
        element("p", "meta", "Наблюдение коннектора; само по себе не подтверждает текущую цену."),
      );
      details.append(
        element(
          "p",
          "meta",
          `Без специальных условий: ${money(native.ordinaryRub)} · ${native.conditionalLabel || "С условием"}: ${money(native.conditionalRub)} · До скидки: ${money(native.referenceRub)}`,
        ),
      );
      details.append(
        element(
          "p",
          "meta",
          `Продавец: ${native.seller || "неизвестно"} · Рейтинг продавца: ${native.sellerRating ?? "неизвестно"} · Отзывы продавца: ${native.sellerReviews ?? "неизвестно"}`,
        ),
      );
      if (native.region)
        details.append(
          element("p", "meta", `Регион площадки: ${native.region}; адрес доставки не выбран`),
        );
      if (native.productRating !== undefined)
        details.append(
          element(
            "p",
            "meta",
            `Рейтинг товара: ${native.productRating} · ${native.productRatingScope}`,
          ),
        );
    }
    verification.append(details);
  }
  article.append(verification);
  return article;
}
function renderOffers() {
  renderedOfferStatuses = statusSignature(currentOffers);
  const results = $("#results");
  results.replaceChildren();
  const verified = currentOffers.filter((offer) => statusNow(offer) === "VERIFIED").length;
  const bounds = parseBounds($("#price-min").value, $("#price-max").value);
  const invalid = !$("#price-min").validity.valid || !$("#price-max").validity.valid;
  const error = bounds.error || (invalid ? "Введите неотрицательную цену в рублях." : "");
  $("#filter-error").textContent = error;
  $("#price-min").setAttribute("aria-invalid", String(Boolean(error)));
  $("#price-max").setAttribute("aria-invalid", String(Boolean(error)));
  if (error) {
    $("#count").textContent = "Проверьте диапазон цены";
    return;
  }
  const basis = $("#price-basis").value;
  const filtered = filterOffers(currentOffers, {
    ...bounds,
    basis,
    includeUnknown: $("#include-unknown").checked,
  });
  $("#filter-note").textContent =
    basis === "discovery"
      ? "Отбор по цене из поисковой выдачи. Цена и точная комплектация могут отличаться; статус проверки не меняется."
      : "Отбор по актуальной подтверждённой цене товара, без доставки и пошлины. Фильтр применяется к загруженным предложениям.";
  $("#count").textContent =
    `${filtered.length} из ${currentOffers.length} показано · ${verified} подтверждено всего`;
  if (!currentOffers.length)
    results.append(
      element(
        "div",
        "empty",
        "Подтверждённых предложений нет. Состояние каждой площадки указано выше; отсутствие результата не означает отсутствие товара.",
      ),
    );
  else if (!filtered.length)
    results.append(
      element(
        "div",
        "empty",
        "Нет предложений в этом диапазоне. Измените границы, выберите цены из поиска или включите товары без цены.",
      ),
    );
  for (const offer of filtered) results.append(card(offer));
}
async function history() {
  const box = $("#history");
  try {
    const response = await fetch("/api/history");
    if (!response.ok) throw new Error("История недоступна");
    const { rows } = await response.json();
    historyRows = rows;
    renderHistory();
  } catch {
    box.replaceChildren(
      element("div", "empty", "Не удалось прочитать историю. Попробуйте обновить."),
    );
  }
}
function renderHistory() {
  renderedHistoryStatuses = statusSignature(historyRows.map((row) => row.offer));
  const box = $("#history");
  const scrollTop = box.scrollTop;
  box.replaceChildren();
  if (!historyRows.length)
    box.append(
      element("div", "empty", "История пока пуста. Здесь появятся реальные найденные карточки."),
    );
  for (const row of historyRows) box.append(card({ ...row.offer, landed: row.landed }, row.seenAt));
  box.scrollTop = scrollTop;
}
$("#f").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#search").disabled = true;
  $("#price-filters").disabled = true;
  currentOffers = [];
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
      if (source.tools?.length) {
        const diagnostics = element("details", "reasons");
        diagnostics.append(element("summary", "", "Вызовы коннекторов"));
        const list = element("ul");
        for (const call of source.tools)
          list.append(
            element(
              "li",
              "meta",
              `${call.provider} · ${call.tool}: ${call.status === "ok" ? "ответ получен" : call.status} (${Math.round(call.durationMs / 1000)} с)`,
            ),
          );
        diagnostics.append(list);
        diagnostics.append(
          element(
            "p",
            "meta",
            "Получение ответа не означает подтверждение карточки. Инструменты карточки и продавца вызываются только для найденного товара.",
          ),
        );
        el.append(diagnostics);
      }
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
    $("#price-filters").disabled = false;
    $("#results").removeAttribute("aria-busy");
  }
});
$("#refresh-history").addEventListener("click", history);
$("#price-filters").addEventListener("input", renderOffers);
$("#reset-filter").addEventListener("click", () => {
  $("#price-min").value = "";
  $("#price-max").value = "";
  $("#price-basis").value = "current";
  $("#include-unknown").checked = false;
  renderOffers();
});
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
  if (!$("#search").disabled && statusSignature(currentOffers) !== renderedOfferStatuses)
    renderOffers();
  if (statusSignature(historyRows.map((row) => row.offer)) !== renderedHistoryStatuses)
    renderHistory();
}, 30000);
