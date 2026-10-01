import {
  filterOffers,
  parseBounds,
  priceFor,
  reasonSummary,
  requestSelection,
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
    region_not_confirmed: "Город на открытой карточке не подтверждён",
    region_conflict: "Площадка показала другой город",
    discovery_specs_conflict: "Название товара в поиске противоречит запросу",
  };
  return labels[reason] || reason;
}
const $ = (selector) => document.querySelector(selector);
const names = {
  "yandex-market": "Яндекс Маркет",
  ozon: "Ozon",
  avito: "Avito",
  wildberries: "Wildberries",
};
const selection = requestSelection();
let currentOffers = [];
let historyRows = [];
let historyPage = 0;
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
      wildberries: ["wildberries.ru", "www.wildberries.ru"],
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
  const article = element("article", "offer-detail");
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
    price.append(element("div", "search-price", `${money(discoveryPrice)} без карты в поиске`));
    price.append(element("div", "meta", `Не подтверждено · ${date(offer.discoveredAt)}`));
  }
  if (offer.discoveryPriceRub != null && discoveryPrice === null)
    price.append(
      element(
        "div",
        "meta",
        `Архив/поиск: ${money(offer.discoveryPriceRub)} · условия или соответствие не подтверждены; вне сравнения`,
      ),
    );
  if (offer.discoveryConditionalRub != null)
    price.append(
      element(
        "div",
        "meta",
        `С картой / спецусловием: ${money(offer.discoveryConditionalRub)} · не подтверждено`,
      ),
    );
  if (offer.discoveryReferenceRub != null)
    price.append(
      element(
        "div",
        "meta",
        `Зачёркнутая цена: ${money(offer.discoveryReferenceRub)} · не цена покупки`,
      ),
    );
  price.append(element("div", "meta", `Выбран: ${offer.requestedCity || "не был задан"}`));
  price.append(
    element("div", "meta", `Город в поиске: ${offer.discoveryRegion || "не подтверждён"}`),
  );
  price.append(
    element("div", "meta", `Доставка: ${money(cost.shipping)} · Пошлина: ${money(cost.duty)}`),
  );
  price.append(element("div", "meta", `Итого: ${money(cost.total)}`));
  price.append(
    element("div", "meta", `Город в карточке: ${offer.evidence?.region || "не подтверждён"}`),
  );
  if (offer.evidence?.priceKind !== "ordinary")
    price.append(element("div", "meta", "Условия цены не подтверждены"));
  const actions = element("div");
  if (offer.sku && /^[1-9]\d{0,14}$/.test(offer.sku)) {
    const researchButton = element("button", "btn btn-sm mt-2", "Исследовать товар");
    researchButton.type = "button";
    researchButton.addEventListener("click", () => {
      $("#offer-dialog")?.close();
      window.dispatchEvent(
        new CustomEvent("scout-research", {
          detail: { source: offer.marketplace, sku: offer.sku, city: offer.requestedCityId },
        }),
      );
    });
    actions.append(researchButton);
  }
  const status = statusNow(offer);
  actions.append(
    element("span", `badge ${status === "VERIFIED" ? "bg-green-lt" : "bg-yellow-lt"}`, status),
  );
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
function offerTable(rows, historical = false) {
  const wrapper = element("div", "table-responsive");
  const table = element("table", "table table-vcenter card-table table-hover");
  const head = element("thead"),
    header = element("tr");
  for (const label of [
    "Товар / площадка",
    "Цена и регион",
    "Проверка",
    historical ? "Наблюдение" : "Действие",
  ])
    header.append(element("th", "", label));
  head.append(header);
  table.append(head);
  const body = element("tbody");
  for (const row of rows) {
    const offer = row.offer ?? row,
      tr = element("tr"),
      product = element("td");
    const productRow = element("div", "d-flex align-items-center gap-3");
    const image = safeImage(offer.imageUrl, offer.marketplace);
    if (image) {
      const img = element("img", "offer-thumb");
      img.src = image;
      img.alt = "Фото товара";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.replaceWith(element("span", "avatar", "—")), {
        once: true,
      });
      productRow.append(img);
    } else productRow.append(element("span", "avatar text-secondary", "—"));
    const description = element("div");
    description.append(
      element("div", "offer-title", offer.title || "Без названия"),
      element(
        "div",
        "meta",
        `${names[offer.marketplace] || offer.marketplace} · ${offer.sku || "артикул неизвестен"}`,
      ),
    );
    productRow.append(description);
    product.append(productRow);
    const price = element("td"),
      current = priceFor(offer, "current"),
      discovery = priceFor(offer, "discovery");
    price.append(
      element("div", "fw-semibold", current === null ? "Не подтверждена" : money(current)),
    );
    if (discovery !== null)
      price.append(element("div", "meta", `${money(discovery)} · поиск, без карты`));
    price.append(element("div", "meta", `Город: ${offer.requestedCity || "не указан"}`));
    if (offer.discoveryRegion && offer.discoveryRegion !== offer.requestedCity)
      price.append(element("div", "text-warning small", `Площадка: ${offer.discoveryRegion}`));
    const state = element("td"),
      status = statusNow(offer);
    state.append(
      element("span", `badge ${status === "VERIFIED" ? "bg-green-lt" : "bg-yellow-lt"}`, status),
    );
    const actions = element("td");
    if (historical) actions.append(element("div", "meta mb-2", date(row.seenAt)));
    const button = element("button", "btn btn-sm", "Подробнее");
    button.type = "button";
    button.addEventListener("click", () => {
      const dialog = $("#offer-dialog");
      openOffer = { offer: { ...offer, landed: row.landed ?? offer.landed }, seenAt: row.seenAt };
      refreshOpenOffer();
      dialog.showModal();
    });
    actions.append(button);
    tr.append(product, price, state, actions);
    body.append(tr);
  }
  table.append(body);
  wrapper.append(table);
  return wrapper;
}
function metrics() {
  const verified = currentOffers.filter((offer) => priceFor(offer, "current") !== null);
  for (const [id, value] of [
    ["metric-offers", currentOffers.length],
    ["metric-verified", verified.length],
    [
      "metric-price",
      verified.length
        ? money(Math.min(...verified.map((offer) => priceFor(offer, "current"))))
        : "—",
    ],
    ["metric-history", historyRows.length],
  ])
    if ($(`#${id}`)) $(`#${id}`).textContent = String(value);
}
function renderOffers() {
  metrics();
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
  if (filtered.length) results.append(offerTable(filtered));
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
  metrics();
  renderedHistoryStatuses = statusSignature(historyRows.map((row) => row.offer));
  const box = $("#history");
  const scrollTop = box.scrollTop;
  box.replaceChildren();
  if (!historyRows.length)
    box.append(
      element("div", "empty", "История пока пуста. Здесь появятся реальные найденные карточки."),
    );
  historyPage = Math.min(historyPage, Math.max(0, Math.ceil(historyRows.length / 20) - 1));
  if (historyRows.length)
    box.append(offerTable(historyRows.slice(historyPage * 20, (historyPage + 1) * 20), true));
  if ($("#history-page"))
    $("#history-page").textContent =
      `${historyRows.length} наблюдений · страница ${historyPage + 1} из ${Math.max(1, Math.ceil(historyRows.length / 20))}`;
  if ($("#history-prev")) $("#history-prev").disabled = historyPage === 0;
  if ($("#history-next"))
    $("#history-next").disabled = (historyPage + 1) * 20 >= historyRows.length;
  box.scrollTop = scrollTop;
}
$("#f").addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = $("#city").value;
  const token = selection.capture();
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
    const response = await fetch(
      `/api/search?q=${encodeURIComponent($("#q").value)}&city=${encodeURIComponent(city)}`,
      {
        signal: AbortSignal.timeout(600000),
      },
    );
    const data = await response.json();
    if (!selection.accepts(token)) return;
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Проверка уже идёт. Дождитесь завершения и повторите запрос."
          : "Проверка не завершена. Проверьте локальный журнал.",
      );
    currentOffers = data.offers || [];
    for (const source of data.sourceOutcomes || []) {
      const col = element("div", "col-md-6 col-xl-3");
      const el = element("div", "card card-body h-100");
      el.append(
        element(
          "strong",
          "",
          `${names[source.marketplace] || source.marketplace}: ${source.status}`,
        ),
      );
      if (source.stage === "region-resolution")
        el.append(
          element(
            "p",
            "meta",
            "Не удалось подтвердить регион Wildberries. Московские цены не подставляются.",
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
      col.append(el);
      $("#sources").append(col);
    }
    renderOffers();
    await history();
  } catch (error) {
    if (!selection.accepts(token)) return;
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
$("#city").addEventListener("change", () => {
  selection.change();
  currentOffers = [];
  metrics();
  $("#sources").replaceChildren();
  $("#count").textContent = "";
  $("#results").replaceChildren(
    element(
      "div",
      "empty",
      "Город изменён. Запустите новую проверку; предыдущие результаты убраны.",
    ),
  );
});
fetch("/api/connectors")
  .then(async (response) => {
    if (!response.ok) throw Error();
    const data = await response.json();
    const box = $("#connector-catalog");
    box.replaceChildren();
    for (const provider of data.providers || []) {
      const section = element("div", "source");
      const link = element("a", "", provider.name);
      const url = new URL(provider.repository);
      if (url.protocol !== "https:" || url.hostname !== "github.com") continue;
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      section.append(
        link,
        element("p", "meta", `${provider.license} · версия кода ${provider.pin}`),
        element("p", "", provider.role),
        element("p", "meta", provider.limitations),
      );
      box.append(section);
    }
  })
  .catch(() => {
    $("#connector-catalog").textContent =
      "Сведения о коннекторах недоступны. Проверьте подключение к приложению.";
  });
$("#refresh-history").addEventListener("click", history);
$("#history-prev")?.addEventListener("click", () => {
  historyPage--;
  renderHistory();
});
$("#history-next")?.addEventListener("click", () => {
  historyPage++;
  renderHistory();
});
$("#close-offer")?.addEventListener("click", () => $("#offer-dialog").close());
let openOffer;
let openOfferStatus;
function refreshOpenOffer() {
  if (!openOffer) return;
  openOfferStatus = statusNow(openOffer.offer);
  $("#offer-detail").replaceChildren(card(openOffer.offer, openOffer.seenAt));
}
$("#offer-dialog")?.addEventListener("close", () => {
  openOffer = undefined;
});
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
  if (openOffer && statusNow(openOffer.offer) !== openOfferStatus) refreshOpenOffer();
  if (!$("#search").disabled && statusSignature(currentOffers) !== renderedOfferStatuses)
    renderOffers();
  if (statusSignature(historyRows.map((row) => row.offer)) !== renderedHistoryStatuses)
    renderHistory();
}, 1000);
