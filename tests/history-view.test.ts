import assert from "node:assert/strict";
import test from "node:test";
import { filterHistory, statusLabel } from "../public/history-view.js";

test("history filters use all title/SKU terms and saved city, preserving evidence", () => {
  const rows = [
    {
      offer: {
        title: "RedmiBook PRO 16",
        sku: "601",
        requestedCity: "Воронеж",
        status: "UNVERIFIED",
      },
    },
    { offer: { title: "RedmiBook Pro 16", sku: "602", requestedCity: "Москва", status: "STALE" } },
    { offer: { title: "RedmiBook Pro 16", sku: "603" } },
  ];
  const before = JSON.stringify(rows);
  assert.deepEqual(filterHistory(rows, "  pro  601 ", "Воронеж"), [rows[0]]);
  assert.deepEqual(filterHistory(rows, "REDMIBOOK", "Москва"), [rows[1]]);
  assert.equal(filterHistory(rows, "", "Воронеж").length, 1);
  assert.equal(filterHistory(rows).length, 3);
  assert.equal(filterHistory(rows, "missing").length, 0);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(
    filterHistory([{ offer: { title: "REDMI Book Pro 16" } }], "RedmiBook Pro").length,
    1,
  );
  assert.equal(statusLabel("STALE"), "Проверка устарела");
  assert.equal(statusLabel("unknown"), "Не подтверждено");
});
