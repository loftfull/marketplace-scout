"""Bounded HTML-only search spider built on the pinned Scrapy runtime."""

from __future__ import annotations

import json
import re
from urllib.parse import urlencode, urljoin, urlsplit

import scrapy
from scrapy.exceptions import IgnoreRequest
from scrapy.http import HtmlResponse, Request, Response
from scrapy.downloadermiddlewares.robotstxt import RobotsTxtMiddleware
from twisted.internet.defer import Deferred

MARKETS = {
    "yandex-market": {
        "host": "market.yandex.ru",
        "search": "https://market.yandex.ru/search?text={query}",
        "card": re.compile(r"^/(?:product--[^/]+|product)/\d+/?$|^/card/[^/]+/\d+/?$"),
    },
    "ozon": {
        "host": "www.ozon.ru",
        "search": "https://www.ozon.ru/search/?text={query}",
        "card": re.compile(r"^/product/(?:[^/]*-)?\d+/?$"),
    },
    "avito": {
        "host": "www.avito.ru",
        "search": "https://www.avito.ru/{city}/noutbuki?q={query}",
        "card": re.compile(r"^/.+_\d+/?$"),
    },
    "wildberries": {
        "host": "www.wildberries.ru",
        "search": "https://www.wildberries.ru/catalog/0/search.aspx?search={query}",
        "card": re.compile(r"^/catalog/\d+/detail\.aspx$"),
    },
}
CITY_IDS = {"voronezh", "moskva", "sankt-peterburg"}
MAX_QUERY = 200
MAX_OFFERS = 20
MAX_BODY_BYTES = 2_000_000
MAX_PRICE_RUB = 100_000_000
PRICE_RE = re.compile(r"(?<!\d)(\d[\d\s\u00a0\u202f]{1,14})(?:[,.]\d{1,2})?\s*(?:₽|руб(?:\.)?)", re.I)
CHALLENGE_RE = re.compile(
    r"captcha|access denied|доступ ограничен|доступ запрещен|подтвердите.*человек|проверка безопасности|слишком много запросов",
    re.I,
)


def _text(value: object, limit: int = 300) -> str:
    return " ".join(str(value or "").split())[:limit]


def build_search_url(marketplace: str, query: str, city_id: str) -> str:
    if marketplace not in MARKETS:
        raise ValueError("unsupported_marketplace")
    clean_query = _text(query, MAX_QUERY)
    if not clean_query or len(query) > MAX_QUERY:
        raise ValueError("invalid_query")
    if city_id not in CITY_IDS:
        raise ValueError("invalid_city")
    template = MARKETS[marketplace]["search"]
    values = {"query": urlencode({"q": clean_query})[2:]}
    if marketplace == "avito":
        values["city"] = city_id
    url = template.format(**values)
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != MARKETS[marketplace]["host"] or parsed.port:
        raise ValueError("search_url_not_allowlisted")
    return url


def classify_response(status: int, content_type: str, body_text: str) -> tuple[str, str]:
    if status in {401, 403, 407, 429, 451}:
        return "blocked", f"http_{status}"
    if 300 <= status < 400:
        return "blocked", "redirect_disabled"
    if status >= 400:
        return "error", f"http_{status}"
    if CHALLENGE_RE.search(body_text[:5000]):
        return "blocked", "challenge_detected"
    if "html" not in content_type.lower() and "xhtml" not in content_type.lower():
        return "error", "non_html_response"
    return "ok", "html_received"


def _product_url(value: str, response_url: str, marketplace: str) -> str | None:
    candidate = urlsplit(urljoin(response_url, value))
    config = MARKETS[marketplace]
    if (
        candidate.scheme != "https"
        or candidate.hostname != config["host"]
        or candidate.port
        or candidate.username
        or candidate.password
        or not config["card"].fullmatch(candidate.path)
    ):
        return None
    return f"https://{config['host']}{candidate.path}"


def _price(value: str) -> int | None:
    match = PRICE_RE.search(value)
    if not match:
        return None
    try:
        amount = int(re.sub(r"\D", "", match.group(1)))
    except ValueError:
        return None
    return amount if 0 < amount <= MAX_PRICE_RUB else None


def _structured_products(response: HtmlResponse, marketplace: str) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    for raw in response.css('script[type="application/ld+json"]::text').getall()[:100]:
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            continue
        stack = parsed if isinstance(parsed, list) else [parsed]
        while stack:
            item = stack.pop()
            if not isinstance(item, dict):
                continue
            for key in ("@graph", "itemListElement", "item", "mainEntity", "products"):
                related = item.get(key)
                if isinstance(related, list):
                    stack.extend(related[:100])
                elif isinstance(related, dict):
                    stack.append(related)
            item_type = item.get("@type")
            if isinstance(item_type, list):
                is_product = "Product" in item_type
            else:
                is_product = item_type == "Product"
            if not is_product:
                continue
            title = _text(item.get("name"))
            url = _product_url(str(item.get("url") or ""), response.url, marketplace)
            offers = item.get("offers")
            offer_rows = offers if isinstance(offers, list) else [offers]
            prices = [
                _price(f"{row.get('price', '')} ₽")
                for row in offer_rows
                if isinstance(row, dict) and str(row.get("priceCurrency", "")).upper() == "RUB"
            ]
            price = prices[0] if len(set(prices)) == 1 and prices else None
            if title and url:
                found.append({"title": title, "url": url, "price_rub": price})
    return found


def extract_offers(response: HtmlResponse, marketplace: str) -> list[dict[str, object]]:
    if marketplace not in MARKETS:
        raise ValueError("unsupported_marketplace")
    results: dict[str, dict[str, object]] = {}
    for offer in _structured_products(response, marketplace):
        results[str(offer["url"])] = offer

    card_selector = response.css(
        'article, [data-marker="item"], [data-auto="searchOrganic"], '
        '.product-card, [class*="tile"]'
    )
    for card in card_selector[:500]:
        anchors = card.css("a[href]")
        link = next(
            (
                anchor
                for anchor in anchors
                if _product_url(anchor.attrib.get("href", ""), response.url, marketplace)
            ),
            None,
        )
        if link is None:
            continue
        url = _product_url(link.attrib.get("href", ""), response.url, marketplace)
        if not url:
            continue
        title_node = card.css(
            '[data-marker="item-title"], [data-auto="snippet-title"], '
            '.product-card__name, h3, h2'
        )
        title = _text(
            title_node.xpath("string(.)").get()
            or link.attrib.get("aria-label")
            or link.xpath("string(.)").get()
        )
        if len(title) < 3:
            continue
        price_nodes = card.css(
            '[data-marker*="price"], [data-auto*="price"], '
            '.product-card__price, .price__lower-price, .price, ins'
        ).xpath(".//text() | self::text()")
        prices = {
            found
            for value in price_nodes.getall()[:30]
            if (found := _price(value)) is not None
        }
        # Do not guess which of multiple visible amounts is the unconditional card price.
        price = next(iter(prices)) if len(prices) == 1 else None
        results.setdefault(url, {"title": title, "url": url, "price_rub": price})
        if len(results) >= MAX_OFFERS:
            break
    return list(results.values())[:MAX_OFFERS]


class MarketplaceEgressMiddleware:
    """Validate every Scrapy request and force it through Scout's pinned egress."""

    def __init__(self, proxy: str, marketplace: str):
        self.proxy = proxy
        self.marketplace = marketplace

    @classmethod
    def from_crawler(cls, crawler: scrapy.crawler.Crawler) -> MarketplaceEgressMiddleware:
        return cls(crawler.settings["SCOUT_EGRESS_PROXY"], crawler.settings["SCOUT_MARKETPLACE"])

    def process_request(self, request: Request, spider: scrapy.Spider) -> None:
        config = MARKETS.get(self.marketplace)
        parsed = urlsplit(request.url)
        if (
            not config
            or parsed.scheme != "https"
            or parsed.hostname != config["host"]
            or parsed.port
            or parsed.username
            or parsed.password
            or request.method != "GET"
            or request.meta.get("marketplace") not in {None, self.marketplace}
        ):
            raise IgnoreRequest("marketplace_target_denied")
        request.meta["marketplace"] = self.marketplace
        request.meta["proxy"] = self.proxy
        request.meta["dont_redirect"] = True
        request.meta["handle_httpstatus_all"] = True
        return None

    def process_response(self, request: Request, response: Response, spider: scrapy.Spider) -> Response:
        if response.url != request.url:
            raise IgnoreRequest("redirect_target_denied")
        if len(response.body) > MAX_BODY_BYTES:
            raise IgnoreRequest("response_too_large")
        return response


class DenyAllRobots:
    def allowed(self, url: str | bytes, user_agent: str | bytes) -> bool:
        return False

    def crawl_delay(self, user_agent: str | bytes) -> None:
        return None


class FailClosedRobotsTxtMiddleware(RobotsTxtMiddleware):
    """Treat unreadable, blocked, redirected, oversized or non-text robots as deny-all."""

    def _robots_error(self, exc: Exception, netloc: str) -> None:
        self._stats.inc_value("scout/robots_unavailable")
        pending = self._parsers.get(netloc)
        denied = DenyAllRobots()
        self._parsers[netloc] = denied
        if isinstance(pending, Deferred) and not pending.called:
            pending.callback(denied)

    async def _parse_robots(self, response: Response, netloc: str, request: Request) -> None:
        content_type = response.headers.get(b"Content-Type", b"").decode("latin1").lower()
        if response.status != 200 or "text/plain" not in content_type or len(response.body) > 65536:
            self._robots_error(IgnoreRequest("robots_policy_unavailable"), netloc)
            return
        await super()._parse_robots(response, netloc, request)


class ScoutHTMLSpider(scrapy.Spider):
    name = "marketplace_scout_html"
    custom_settings = {
        "ROBOTSTXT_OBEY": True,
        "ROBOTSTXT_USER_AGENT": "MarketplaceScout/0.3 (local read-only research)",
        "USER_AGENT": "MarketplaceScout/0.3 (local read-only research)",
        "COOKIES_ENABLED": False,
        "RETRY_ENABLED": False,
        "REDIRECT_ENABLED": False,
        "METAREFRESH_ENABLED": False,
        "TELNETCONSOLE_ENABLED": False,
        "REMOTE_CONTROL_ENABLED": False,
        "EXTENSIONS": {
            "scrapy.extensions.telnet.TelnetConsole": None,
            "scrapy.extensions.remote_control.RemoteControl": None,
        },
        "DOWNLOADER_MIDDLEWARES": {
            "scrapy.downloadermiddlewares.robotstxt.RobotsTxtMiddleware": None,
            "scout_spider.FailClosedRobotsTxtMiddleware": 1000,
            "scout_spider.MarketplaceEgressMiddleware": 1100,
        },
        "DOWNLOAD_TIMEOUT": 12,
        "DOWNLOAD_MAXSIZE": MAX_BODY_BYTES,
        "DOWNLOAD_WARNSIZE": 1_000_000,
        "DOWNLOAD_DELAY": 0.5,
        "CONCURRENT_REQUESTS": 1,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "CLOSESPIDER_PAGECOUNT": 2,
        "CLOSESPIDER_TIMEOUT": 20,
        "AUTOTHROTTLE_ENABLED": False,
        "LOG_ENABLED": False,
        "STATS_DUMP": False,
        "HTTPERROR_ALLOW_ALL": True,
    }

    def __init__(self, marketplace: str, query: str, city_id: str, **kwargs: object):
        super().__init__(**kwargs)
        self.marketplace = marketplace
        self.query = query
        self.city_id = city_id
        self.result: dict[str, object] | None = None
        self.crawler: scrapy.crawler.Crawler

    @classmethod
    def from_crawler(cls, crawler: scrapy.crawler.Crawler, *args: object, **kwargs: object):
        spider = super().from_crawler(crawler, *args, **kwargs)
        spider.crawler = crawler
        return spider

    async def start(self):
        url = build_search_url(self.marketplace, self.query, self.city_id)
        yield scrapy.Request(
            url,
            callback=self.parse,
            dont_filter=True,
            meta={"marketplace": self.marketplace, "handle_httpstatus_all": True, "dont_redirect": True},
        )

    def parse(self, response: HtmlResponse):
        status, detail = classify_response(
            response.status,
            response.headers.get(b"Content-Type", b"").decode("latin1"),
            response.text,
        )
        offers = extract_offers(response, self.marketplace) if status == "ok" else []
        self.result = {
            "marketplace": self.marketplace,
            "status": status if offers or status != "ok" else "empty",
            "stage": "html-discovery",
            "detail": detail if offers or status != "ok" else "no_product_cards_in_html",
            "discovery_url": response.url,
            "offers": offers,
        }
        yield self.result

    def closed(self, reason: str) -> None:
        if self.result is not None:
            return
        stats = self.crawler.stats
        if stats.get_value("scout/robots_unavailable", 0):
            status, detail = "blocked", "robots_policy_unavailable"
        elif stats.get_value("robotstxt/forbidden", 0):
            status, detail = "blocked", "robots_disallowed"
        elif stats.get_value("downloader/response_status_count/403", 0):
            status, detail = "blocked", "http_403"
        elif stats.get_value("downloader/response_status_count/429", 0):
            status, detail = "blocked", "http_429"
        elif reason == "closespider_timeout":
            status, detail = "timeout", "crawl_timeout"
        else:
            status, detail = "error", "no_html_result"
        self.result = {
            "marketplace": self.marketplace,
            "status": status,
            "stage": "html-discovery",
            "detail": detail,
            "discovery_url": None,
            "offers": [],
        }
