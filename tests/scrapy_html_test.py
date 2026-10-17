from __future__ import annotations

import json
import os
import socketserver
import subprocess
import sys
import threading
import unittest
from pathlib import Path

from scrapy.http import HtmlResponse, Request
from scrapy.exceptions import IgnoreRequest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "integrations" / "scrapy-html"))

from scout_spider import (  # noqa: E402
    DenyAllRobots,
    FailClosedRobotsTxtMiddleware,
    MarketplaceEgressMiddleware,
    build_search_url,
    classify_response,
    extract_offers,
)
from runner import serialize_result  # noqa: E402


class ScrapyHtmlTest(unittest.TestCase):
    def test_runner_protocol_encodes_marketplace_unicode_as_utf8(self) -> None:
        value = {"title": 'Redmi Book 16″ (2026), 32 ГБ/1 ТБ'}
        encoded = serialize_result(value)
        self.assertEqual(json.loads(encoded.decode("utf-8")), value)
        self.assertTrue(encoded.endswith(b"\n"))

    def test_search_urls_are_fixed_https_pages_for_each_marketplace(self) -> None:
        expected = {
            "yandex-market": "https://market.yandex.ru/search?text=RedmiBook+32GB+1TB",
            "ozon": "https://www.ozon.ru/search/?text=RedmiBook+32GB+1TB",
            "avito": "https://www.avito.ru/voronezh/noutbuki?q=RedmiBook+32GB+1TB",
            "wildberries": "https://www.wildberries.ru/catalog/0/search.aspx?search=RedmiBook+32GB+1TB",
        }
        for marketplace, url in expected.items():
            with self.subTest(marketplace=marketplace):
                self.assertEqual(build_search_url(marketplace, "RedmiBook 32GB 1TB", "voronezh"), url)

    def test_unknown_marketplace_and_city_are_rejected(self) -> None:
        for args in [
            ("attacker", "RedmiBook", "voronezh"),
            ("avito", "RedmiBook", "unknown-city"),
            ("avito", "x" * 201, "voronezh"),
        ]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                build_search_url(*args)

    def test_html_cards_are_extracted_without_site_api_payloads(self) -> None:
        fixtures = {
            "avito": '''<html><article data-marker="item"><a data-marker="item-title" href="/voronezh/noutbuki/item_9182736450"><h3>Redmi Book 16 2026 32G/1T</h3></a><p data-marker="item-price">120 000 ₽</p></article></html>''',
            "yandex-market": '''<html><article data-auto="searchOrganic"><a data-auto="snippet-title" href="/product--redmi-book-16/918273645"><h3>Redmi Book 16 2026 32G/1T</h3></a><span data-auto="snippet-price-current">120 000 ₽</span></article></html>''',
            "ozon": '''<html><article><a href="/product/redmi-book-16-918273645/"><h3>Redmi Book 16 2026 32G/1T</h3></a><span class="price">120 000 ₽</span></article></html>''',
            "wildberries": '''<html><article class="product-card"><a class="product-card__link" href="/catalog/918273645/detail.aspx"><span class="product-card__name">Redmi Book 16 2026 32G/1T</span></a><ins class="price__lower-price">120 000 ₽</ins></article></html>''',
        }
        for marketplace, html in fixtures.items():
            with self.subTest(marketplace=marketplace):
                url = build_search_url(marketplace, "RedmiBook", "voronezh")
                response = HtmlResponse(url, request=Request(url), body=html.encode(), encoding="utf-8")
                offers = extract_offers(response, marketplace)
                self.assertEqual(len(offers), 1)
                self.assertEqual(offers[0]["title"], "Redmi Book 16 2026 32G/1T")
                self.assertEqual(offers[0]["price_rub"], 120000)
                self.assertTrue(offers[0]["url"].startswith("https://"))

    def test_json_ld_product_uses_only_rub_and_product_url(self) -> None:
        url = build_search_url("ozon", "RedmiBook", "voronezh")
        html = b'''<html><script type="application/ld+json">{"@type":"Product","name":"Redmi Book 16 2026","url":"/product/redmi-book-16-918273645/","offers":{"price":"120000","priceCurrency":"RUB"}}</script></html>'''
        offers = extract_offers(HtmlResponse(url, request=Request(url), body=html), "ozon")
        self.assertEqual(offers[0]["price_rub"], 120000)
        self.assertEqual(offers[0]["title"], "Redmi Book 16 2026")

    def test_json_ld_item_list_and_non_rub_prices_are_handled_conservatively(self) -> None:
        url = build_search_url("ozon", "RedmiBook", "voronezh")
        html = b'''<html><script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Product","name":"Redmi Book 16","url":"/product/redmi-book-16-918273645/","offers":{"price":"120000","priceCurrency":"USD"}}}]}</script></html>'''
        offers = extract_offers(HtmlResponse(url, request=Request(url), body=html), "ozon")
        self.assertEqual(len(offers), 1)
        self.assertIsNone(offers[0]["price_rub"])

    def test_unavailable_robots_parser_fails_closed(self) -> None:
        parser = DenyAllRobots()
        self.assertFalse(parser.allowed("https://www.avito.ru/voronezh/", "MarketplaceScout/0.3"))

    def test_blocked_robots_response_completes_pending_policy_as_deny_all(self) -> None:
        class Stats:
            def __init__(self):
                self.values = {}

            def inc_value(self, key):
                self.values[key] = self.values.get(key, 0) + 1

        middleware = object.__new__(FailClosedRobotsTxtMiddleware)
        middleware._stats = Stats()
        pending = __import__("twisted.internet.defer", fromlist=["Deferred"]).Deferred()
        middleware._parsers = {"www.avito.ru": pending}
        url = "https://www.avito.ru/robots.txt"
        response = HtmlResponse(url, request=Request(url), status=403, body=b"denied")

        import asyncio

        asyncio.run(middleware._parse_robots(response, "www.avito.ru", Request(url)))
        parser = middleware._parsers["www.avito.ru"]
        self.assertFalse(parser.allowed("https://www.avito.ru/voronezh/", "MarketplaceScout/0.3"))
        self.assertEqual(middleware._stats.values["scout/robots_unavailable"], 1)

    def test_response_blocks_challenges_redirects_and_errors(self) -> None:
        self.assertEqual(classify_response(403, "text/html", "Access denied"), ("blocked", "http_403"))
        self.assertEqual(classify_response(429, "text/html", "slow down"), ("blocked", "http_429"))
        self.assertEqual(classify_response(302, "text/html", ""), ("blocked", "redirect_disabled"))
        self.assertEqual(classify_response(200, "text/html", "Подтвердите, что вы человек"), ("blocked", "challenge_detected"))
        self.assertEqual(classify_response(503, "text/html", "maintenance"), ("error", "http_503"))

    def test_egress_middleware_rejects_wrong_host_and_non_get(self) -> None:
        middleware = MarketplaceEgressMiddleware("http://127.0.0.1:32123", "avito")
        bad_host = Request("https://127.0.0.1/private", meta={"marketplace": "avito"})
        with self.assertRaises(IgnoreRequest):
            middleware.process_request(bad_host, None)
        good = Request("https://www.avito.ru/voronezh/noutbuki?q=x", meta={"marketplace": "avito"})
        middleware.process_request(good, None)
        self.assertEqual(good.meta["proxy"], "http://127.0.0.1:32123")
        self.assertTrue(good.meta["dont_redirect"])
        self.assertTrue(good.meta["handle_httpstatus_all"])
        post = Request("https://www.avito.ru/voronezh/noutbuki", method="POST", meta={"marketplace": "avito"})
        with self.assertRaises(IgnoreRequest):
            middleware.process_request(post, None)

    def test_complete_runner_stops_when_local_egress_proxy_denies_robots_request(self) -> None:
        received = []

        class DenyConnect(socketserver.StreamRequestHandler):
            def handle(self):
                received.append(self.rfile.readline())
                while self.rfile.readline() not in {b"\r\n", b"\n", b""}:
                    pass
                self.wfile.write(b"HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")

        class LocalProxy(socketserver.ThreadingTCPServer):
            allow_reuse_address = True

        with LocalProxy(("127.0.0.1", 0), DenyConnect) as proxy:
            thread = threading.Thread(target=proxy.serve_forever, daemon=True)
            thread.start()
            env = os.environ.copy()
            env["SCOUT_EGRESS_PROXY"] = f"http://127.0.0.1:{proxy.server_address[1]}"
            result = subprocess.run(
                [sys.executable, "-I", str(ROOT / "integrations/scrapy-html/runner.py")],
                input=json.dumps(
                    {"marketplace": "avito", "query": "RedmiBook 32GB 1TB", "city_id": "voronezh"}
                ),
                text=True,
                capture_output=True,
                env=env,
                timeout=30,
                check=False,
            )
            proxy.shutdown()
            thread.join(timeout=2)

        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertTrue(received, f"Scrapy did not use the configured proxy: {result.stderr[-2000:]}")
        output = json.loads(result.stdout)
        self.assertEqual(output["status"], "blocked", output)
        self.assertEqual(output["detail"], "robots_policy_unavailable", output)
        self.assertEqual(output["offers"], [])


if __name__ == "__main__":
    unittest.main()
