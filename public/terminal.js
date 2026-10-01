import { comparisonModel, comparisonTable } from "./comparison-view.js";
import { requestSelection } from "./offer-view.js";

const $ = (selector) => document.querySelector(selector);
const node = (tag, className, text) => {
  const el = document.createElement(tag);
  el.className = className || "";
  if (text !== undefined) el.textContent = String(text);
  return el;
};
const names = {
  "yandex-market": "Яндекс Маркет",
  ozon: "Ozon",
  wildberries: "Wildberries",
  avito: "Avito",
};
function navigation() {
  const selected =
    [...document.querySelectorAll("[data-view]")].find((a) => a.hash === location.hash) ??
    $("[data-view]");
  for (const section of document.querySelectorAll(".view"))
    section.hidden = section.id !== selected.dataset.view;
  for (const link of document.querySelectorAll("[data-view]")) {
    const active = link === selected;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("#page-description").textContent = {
    "search-view": "Найдите нужную комплектацию и сравните цены для своего города.",
    "history-view":
      "Сохранённые карточки и результаты проверок. Прошлая цена может быть неактуальна.",
    "research-view": "Отзывы, продавцы и сравнение товаров из подключённых источников.",
    "collectors-view": "Какие готовые решения используются и что они действительно умеют.",
  }[selected.dataset.view];
  $("#page-title").textContent = selected.querySelector(".nav-link-title").textContent;
}
window.addEventListener("hashchange", navigation);
navigation();
function theme(value) {
  document.documentElement.dataset.bsTheme = value;
  $("#theme-toggle").textContent = value === "dark" ? "Светлая тема" : "Тёмная тема";
  $("#theme-toggle").setAttribute("aria-pressed", String(value === "dark"));
}
try {
  theme(localStorage.getItem("scout-theme") === "dark" ? "dark" : "light");
} catch {
  theme("light");
}
$("#theme-toggle").addEventListener("click", () => {
  const value = document.documentElement.dataset.bsTheme === "dark" ? "light" : "dark";
  theme(value);
  try {
    localStorage.setItem("scout-theme", value);
  } catch {}
});
const state = requestSelection();
let operations = [];
function invalidate() {
  state.change();
  $("#research-submit").disabled = false;
  $("#research-result").removeAttribute("aria-busy");
  $("#research-result").replaceChildren(
    node("p", "text-secondary", "Параметры изменены. Получите данные для нового выбора."),
  );
}
function fields() {
  invalidate();
  const operation = operations.find((o) => o.id === $("#research-operation").value);
  const box = $("#research-fields");
  box.replaceChildren();
  $("#research-submit").disabled = !operation;
  if (!operation) return;
  $("#research-note").textContent = operation.note;
  for (const field of operation.fields) {
    const label = node("label", "form-label", field.label),
      input = node("input", "form-control mb-3");
    input.id = `research-${field.key}`;
    input.name = field.key;
    input.required = true;
    input.maxLength = 200;
    label.htmlFor = input.id;
    if (field.kind === "id") input.inputMode = "numeric";
    if (field.kind === "root") input.value = "top";
    box.append(label, input);
  }
}
function source() {
  const select = $("#research-operation");
  select.replaceChildren();
  for (const operation of operations.filter((o) => o.source === $("#research-source").value)) {
    const option = node("option", "", operation.label);
    option.value = operation.id;
    select.append(option);
  }
  fields();
}
$("#research-source").addEventListener("change", source);
$("#research-operation").addEventListener("change", fields);
$("#research-city").addEventListener("change", invalidate);
$("#research-fields").addEventListener("input", invalidate);
window.addEventListener("scout-research", (event) => {
  const { source: marketplace, sku, city } = event.detail;
  const operation = operations.find(
    (op) =>
      op.source === marketplace && ["get_product", "wb_root_info", "avito_card"].includes(op.tool),
  );
  if (!operation) return;
  $("#research-source").value = marketplace;
  source();
  $("#research-operation").value = operation.id;
  fields();
  $("#research-fields input").value = sku;
  if (["voronezh", "moskva", "sankt-peterburg"].includes(city)) $("#research-city").value = city;
  location.hash = "research-view";
});
const labels = {
  root: "Корневая категория",
  max_depth: "Глубина каталога",
  total_returned: "Получено записей",
  truncated: "Выдача сокращена",
  host_used: "Узел источника",
  meta: "Состояние источника",
  source: "Инструмент",
  healthy: "Ответ получен",
  warnings: "Замечания источника",
  title: "Название",
  name: "Название",
  price_rub: "Цена источника, ₽",
  price_without_card_rub: "Без карты, ₽",
  price_with_card_rub: "С картой, ₽",
  city: "Регион источника",
  items: "Результаты",
  products: "Товары",
  reviews: "Отзывы",
  questions: "Вопросы",
  seller: "Продавец",
  rating: "Рейтинг",
  text: "Текст",
  pros: "Достоинства",
  cons: "Недостатки",
  scope: "Область данных",
  notes: "Примечания",
  url: "Адрес источника",
  fetched_at: "Время получения",
  status: "Статус",
  error: "Ошибка источника",
  total: "Всего",
  nm_id: "Артикул nmID",
  imt_id: "Группа imtID",
  model_id: "Модель",
  sku_id: "Вариант",
  card_id: "Артикул",
  shard: "Раздел shard",
  query: "Селектор",
  children: "Подкатегории",
  ordinary_rub: "Обычная цена",
  conditional_rub: "Условная цена",
};
function tree(value, depth = 0) {
  if (depth > 6) return node("span", "text-secondary", "…");
  if (value === null || typeof value !== "object")
    return node("span", "", value === null ? "Нет данных" : String(value));
  const list = node("dl", "research-tree");
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    const name = labels[key] ?? key;
    list.append(node("dt", "", Array.isArray(value) ? `Запись ${Number(key) + 1}` : name));
    const detail = node("dd");
    if (item && typeof item === "object") {
      const expand = node("details");
      expand.open = depth < 1;
      expand.append(
        node("summary", "", Array.isArray(item) ? `${item.length} записей` : "Подробности"),
        tree(item, depth + 1),
      );
      detail.append(expand);
    } else detail.append(tree(item, depth + 1));
    list.append(detail);
  }
  return list;
}
$("#research-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = state.change(),
    button = $("#research-submit"),
    box = $("#research-result");
  const snapshot = {
    operation: $("#research-operation").value,
    city: $("#research-city").value,
    values: Object.fromEntries(
      [...$("#research-fields").querySelectorAll("input")].map((el) => [el.name, el.value]),
    ),
  };
  button.disabled = true;
  box.setAttribute("aria-busy", "true");
  box.replaceChildren(
    node("div", "alert alert-info", "Коннектор получает данные. Это может занять около минуты…"),
  );
  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(75000),
    });
    const result = await response.json();
    if (!state.accepts(token)) return;
    if (!response.ok)
      throw Error(
        response.status === 429
          ? "Другая проверка ещё выполняется. Дождитесь завершения."
          : "Проверьте артикулы и параметры запроса.",
      );
    box.replaceChildren(
      node(
        "div",
        "text-secondary small mb-3",
        `${names[result.source]} · ${result.tool} · ${new Date(result.observedAt).toLocaleString("ru-RU")} · выбран ${result.requestedCity}`,
      ),
    );
    if (result.status !== "observed")
      box.append(
        node(
          "div",
          "alert alert-warning",
          result.status === "blocked"
            ? "Площадка ограничила доступ. Повторные обращения приостановлены; данные не получены."
            : result.status === "timeout"
              ? "Источник не ответил вовремя. Данные не получены."
              : "Источник не дал пригодного ответа. Проверьте доступность и выбранные параметры.",
        ),
      );
    else {
      box.append(node("div", "alert alert-info", result.note));
      const comparison = comparisonModel(result);
      if (comparison) {
        box.append(comparisonTable(comparison));
        const raw = node("details");
        raw.append(
          node("summary", "mb-2", "Все поля и предупреждения источника"),
          tree(result.data),
        );
        box.append(raw);
      } else box.append(tree(result.data));
    }
  } catch (error) {
    if (state.accepts(token))
      box.replaceChildren(
        node(
          "div",
          "alert alert-warning",
          error.name === "TimeoutError"
            ? "Время ожидания истекло. Сервер завершает очистку ресурсов."
            : error.message,
        ),
      );
  } finally {
    if (state.accepts(token)) {
      button.disabled = false;
      box.removeAttribute("aria-busy");
    }
  }
});
fetch("/api/research")
  .then(async (response) => {
    if (!response.ok) throw Error();
    operations = (await response.json()).operations;
    source();
    const table = node("table", "table card-table table-vcenter");
    const body = node("tbody");
    for (const op of operations) {
      const row = node("tr");
      row.append(
        node("td", "text-secondary", names[op.source]),
        node("td", "", op.label),
        node("td", "small text-secondary", op.tool),
      );
      body.append(row);
    }
    table.append(body);
    $("#capability-table").append(table);
  })
  .catch(() => {
    $("#research-submit").disabled = true;
    $("#research-result").textContent =
      "Не удалось загрузить инструменты. Проверьте локальный сервер.";
  });
