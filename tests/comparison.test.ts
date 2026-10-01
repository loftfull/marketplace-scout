import assert from "node:assert/strict";
import test from "node:test";
import { comparisonModel } from "../public/comparison-view.js";
import { researchRequest } from "../src/research.js";
import { comparisonResponse } from "./fixtures/comparison-response.mjs";

test("native Market comparison separates prices and retains failure/scope/region notes", () => {
  const snapshot = JSON.stringify(comparisonResponse);
  const model = comparisonModel(comparisonResponse);
  assert.ok(model);
  assert.equal(model.requestedCity, "Воронеж");
  assert.equal(model.region, "Москва");
  assert.equal(model.columns.length, 3);
  assert.deepEqual(model.columns[0].values.slice(0, 3), ["100 ₽", "80 ₽", "200 ₽"]);
  assert.match(model.columns[0].values[4], /другие товары/);
  assert.match(model.notes[0], /различаются/);
  assert.equal(model.columns[1].values[0], "Нет данных");
  assert.equal(model.columns[2].values[0], "Нет данных");
  assert.match(model.columns[2].values[5], /недоступна/);
  assert.equal(JSON.stringify(comparisonResponse), snapshot);
});
test("Ozon named fields reject money coercion and unsafe identifiers; missing region stays missing", () => {
  const model = comparisonModel({
    ...comparisonResponse,
    source: "ozon",
    data: {
      items: [
        {
          sku: 9007199254740992,
          name: "Ozon fixture",
          price_rub: 1,
          price_without_ozon_card_rub: "99",
          price_with_ozon_card_rub: 80,
          price_before_discount_rub: -1,
          card_rating_scope: "whole variant line",
        },
      ],
    },
  });
  assert.ok(model);
  assert.equal(model.region, "Не указан");
  assert.equal(model.columns[0].id, "Не определён");
  assert.deepEqual(model.columns[0].values.slice(0, 3), ["Нет данных", "80 ₽", "Нет данных"]);
  assert.equal(model.columns[0].values[4], "whole variant line");
  assert.equal(comparisonModel({ ...comparisonResponse, status: "blocked" }), null);
  assert.equal(comparisonModel({ ...comparisonResponse, tool: "get_product" }), null);
  assert.equal(comparisonModel({ ...comparisonResponse, data: { items: null } }), null);
});
test("native comparison preserves current safe ID boundaries rather than truncating long IDs", () => {
  for (const operation of ["yandex-market.compare_products", "wildberries.wb_card"]) {
    const key = operation.startsWith("wildberries") ? "nm_ids" : "products";
    assert.throws(() => researchRequest({ operation, values: { [key]: "227753481523236864" } }));
    assert.throws(() =>
      researchRequest({ operation, values: { [key]: "12345,23456,34567,45678" } }),
    );
    assert.deepEqual(researchRequest({ operation, values: { [key]: "12345,23456" } }).args[key], [
      "12345",
      "23456",
    ]);
  }
});
