(() => {
  const text = (selector) => {
    const visible = [...document.querySelectorAll(selector)].filter(
      (element) => element.offsetParent !== null,
    );
    // Ambiguous widgets (e.g. recommended products) cannot corroborate a selected offer.
    return visible.length === 1 ? visible[0].innerText || "" : "";
  };
  const products = [];
  const collect = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value["@type"] === "Product") products.push(value);
    if (value["@graph"]) collect(value["@graph"]);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collect(JSON.parse(script.textContent || ""));
    } catch {
      /* Malformed markup supplies no evidence. */
    }
  }
  return {
    regionText: text(
      '[data-auto="region-form-opener"], [data-widget="addressBookBarWeb"], [data-marker="delivery-location/title"], .simple-menu__link--address',
    ),
    title: document.title,
    heading:
      document.querySelectorAll("h1").length === 1
        ? document.querySelector("h1").textContent.trim()
        : "",
    products,
    priceText: text(
      '[data-widget="webPrice"], [data-auto="price-block"], [data-marker="item-view/item-price"], .product-page__price-block',
    ),
    sellerText: text(
      '[data-widget="webCurrentSeller"], [data-auto="shop-name"], [data-marker="seller-info/name"]',
    ),
    availableText: text(
      '[data-widget="webAddToCart"], [data-auto="cart-button"], [data-marker="item-view/contacts"]',
    ),
    bodyStart: document.body.innerText.slice(0, 2000),
  };
})();
