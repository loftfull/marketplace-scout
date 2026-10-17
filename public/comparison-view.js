// Presentation of pinned upstream compare_products output; no marketplace parsing.
const text = (value) => (typeof value === "string" ? value.slice(0, 2000) : null);
const money = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${value.toLocaleString("ru-RU")} ₽`
    : "Нет данных";
const identifier = (value) =>
  typeof value === "string" && /^[1-9]\d{0,19}$/.test(value)
    ? value
    : Number.isSafeInteger(value) && value > 0
      ? String(value)
      : "Не определён";
const notes = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, 20) : [];

export function comparisonModel(result) {
  if (
    result?.status !== "observed" ||
    result.tool !== "compare_products" ||
    !["yandex-market", "ozon"].includes(result.source) ||
    !Array.isArray(result.data?.items)
  )
    return null;
  const market = result.source === "yandex-market";
  return {
    requestedCity: text(result.requestedCity) ?? "Не указан",
    // Upstream reports one response-wide region; it is not per-card evidence.
    region: text(market ? result.data.city?.name : result.data.region?.city) ?? "Не указан",
    notes: [...notes(result.data.notes), ...notes([result.data.region?.warning])],
    columns: result.data.items.slice(0, 3).map((item) => {
      const row = item && typeof item === "object" ? item : {};
      const error =
        text(row.error) || (!item || typeof item !== "object" ? "Некорректная строка" : null);
      return {
        title: text(market ? row.title : row.name) ?? "Название недоступно",
        id: identifier((market ? row.card_id : row.sku) ?? row.product),
        error,
        values: error
          ? ["Нет данных", "Нет данных", "Нет данных", "Нет данных", "Нет данных", error]
          : [
              money(market ? row.price_rub : row.price_without_ozon_card_rub),
              money(market ? row.price_with_pay_card_rub : row.price_with_ozon_card_rub),
              money(row.price_before_discount_rub),
              text(row.seller) ?? "Нет данных",
              market
                ? row.rating_of_this_card?.pools_other_products
                  ? "Рейтинг карточки включает другие товары"
                  : "Рейтинг карточки; не подтверждает комплектацию"
                : (text(row.card_rating_scope) ?? "Рейтинг карточки; область не подтверждена"),
              [...notes(row.price_notes), ...(row.delivery_error ? [text(row.delivery_error)] : [])]
                .filter(Boolean)
                .join(" · ") || "Дополнительных данных нет",
            ],
      };
    }),
  };
}

export function comparisonTable(model) {
  const make = (tag, className, value) => {
    const element = document.createElement(tag);
    element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };
  const section = make("section", "mb-3");
  section.append(
    make("h3", "h3", "Сравнение карточек источника"),
    make(
      "p",
      "text-secondary",
      `Выбран: ${model.requestedCity}. Регион общего ответа: ${model.region}. Регион каждой карточки не подтверждён.`,
    ),
  );
  for (const note of model.notes) section.append(make("p", "alert alert-warning", note));
  if (!model.columns.length) {
    section.append(make("p", "alert alert-warning", "Источник не вернул карточки для сравнения."));
    return section;
  }
  // Adapted MIT Tabler shared/components/demo/Table.astro structure/classes.
  const wrapper = make("div", "table-responsive"),
    table = make("table", "table table-vcenter table-striped");
  table.append(
    make(
      "caption",
      "text-secondary",
      "Неподтверждённые наблюдения источника. Цены не участвуют в выборе лучшего предложения; зачёркнутая цена не является ценой покупки.",
    ),
  );
  const head = make("thead", ""),
    headings = make("tr", "");
  headings.append(make("th", "", "Параметр"));
  for (const column of model.columns) {
    const cell = make("th", "text-wrap", `${column.title} · ${column.id}`);
    cell.scope = "col";
    headings.append(cell);
  }
  head.append(headings);
  const body = make("tbody", "");
  const labels = [
    "Обычная цена источника",
    "С картой / спецусловием",
    "Зачёркнутая цена",
    "Продавец",
    "Область рейтинга",
    "Замечания / ошибка",
  ];
  labels.forEach((label, index) => {
    const row = make("tr", ""),
      heading = make("th", "text-wrap", label);
    heading.scope = "row";
    row.append(heading);
    for (const column of model.columns)
      row.append(
        make("td", column.error ? "text-warning text-wrap" : "text-wrap", column.values[index]),
      );
    body.append(row);
  });
  table.append(head, body);
  wrapper.append(table);
  section.append(wrapper);
  return section;
}
