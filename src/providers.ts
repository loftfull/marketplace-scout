export const providerCatalog = [
  {
    name: "ru-marketplace-mcp",
    repository: "https://github.com/Vladimir-Human/ru-marketplace-mcp",
    license: "MIT",
    pin: "c17bd360de60780a9e8d3690288b70181bd07355",
    marketplaces: ["Ozon", "Avito", "Wildberries"],
    role: "Ozon: compare_prices. Avito: avito_card/avito_seller после поиска по городу. Wildberries: wb_search находит артикулы; wb_card повторно читает их с региональным dest.",
    limitations:
      "Проверка карточки независимым браузером обязательна. WB не запускается без определения региона; блокировка площадки не означает отсутствие товара.",
  },
  {
    name: "SZhukovWork/yandex-market-mcp",
    repository: "https://github.com/SZhukovWork/yandex-market-mcp",
    license: "MIT",
    pin: "92bb4dfbc3b87d0c0f77aa7ede09faed7e661aa7",
    marketplaces: ["Яндекс Маркет"],
    role: "search_products/get_product: цена без карты, с картой Пэй и зачёркнутая цена отдельно. Адаптирован обычный HTTPS-транспорт.",
    limitations:
      "Маркет определяет город по IP. Выбор города в Scout задаёт требование к проверке, но не подтверждает смену города на сайте.",
  },
  {
    name: "SZhukovWork/ozon-mcp",
    repository: "https://github.com/SZhukovWork/ozon-mcp",
    license: "MIT",
    pin: "414b3470ee6dd6f3197598b2c3c640d5d1601ef3",
    marketplaces: ["Ozon"],
    role: "get_product: отдельная проверка карточки. search_products — только при пустом/недоступном основном поиске, без блокировки.",
    limitations:
      "Отдельный Python и контекст Chrome без аккаунтов. Данные стороннего инструмента сами по себе не дают VERIFIED.",
  },
];
