// Synthetic contract example; consumed only by tests and isolated port8898.
export const comparisonResponse = {
  status: "observed",
  source: "yandex-market",
  tool: "compare_products",
  requestedCity: "Воронеж",
  observedAt: "2026-10-01T08:00:00Z",
  note: "ТЕСТОВЫЙ СТЕНД. Неподтверждённое сравнение источника.",
  verification: "UNVERIFIED",
  data: {
    city: { id: 213, name: "Москва", source: "page" },
    notes: ["Тест: города карточек различаются; общий город не доказывает регион каждой."],
    items: [
      {
        card_id: "12345",
        title: "ТЕСТ A",
        price_rub: 100,
        price_with_pay_card_rub: 80,
        price_before_discount_rub: 200,
        seller: "Тестовый продавец",
        rating_of_this_card: { pools_other_products: true },
        price_notes: ["Тест: цена по карте имеет условие"],
      },
      { card_id: "23456", title: "ТЕСТ B — только карта", price_with_pay_card_rub: 70 },
      { product: "34567", error: "Тест: карточка недоступна", price_rub: 1 },
    ],
  },
};
