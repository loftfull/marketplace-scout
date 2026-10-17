import ssl
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from boundary import TARGETS, Boundary, PinnedHTTPS, marketplace_for_product_url, write_json
from manage import ensure_watch
from runner import resolve_http


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = Path(self.temp.name)
        self.boundary = Boundary(self.data, self.data / "cooldown.json")
        self.request = SimpleNamespace(url=TARGETS["control"], method="GET", body=None)

    def tearDown(self):
        self.temp.cleanup()

    def test_unarmed_paused_manual_recheck_cannot_connect(self):
        with patch("boundary.PinnedHTTPS") as connection:
            with self.assertRaisesRegex(ValueError, "permit"):
                self.boundary.send(None, self.request)
            connection.assert_not_called()

    def test_one_permit_one_request_and_no_sensitive_headers(self):
        self.boundary.arm(self.request.url)
        with patch("boundary.PinnedHTTPS") as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 200
            response.getheaders.return_value = [("Content-Type", "text/plain")]
            response.read1.side_effect = [b"actual response", b""]
            result = self.boundary.send(
                None, self.request, verify=False, proxies={"https": "unsafe"}
            )
            self.assertEqual(result.content, b"actual response")
            with self.assertRaisesRegex(ValueError, "permit"):
                self.boundary.send(None, self.request)
            self.assertEqual(connection.call_count, 1)
            headers = connection.return_value.request.call_args.kwargs["headers"]
            self.assertNotIn("Authorization", headers)
            self.assertNotIn("Cookie", headers)

    def test_redirect_including_private_destination_is_never_followed(self):
        self.boundary.arm(self.request.url)
        with patch("boundary.PinnedHTTPS") as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 302
            response.getheader.return_value = "http://127.0.0.1:80/private"
            with self.assertRaisesRegex(ValueError, "302"):
                self.boundary.send(None, self.request)
            self.assertEqual(connection.return_value.request.call_count, 1)
        with self.assertRaisesRegex(ValueError, "Previous access failure"):
            Boundary(self.data, self.data / "cooldown.json").arm(self.request.url)

    def test_403_persists_terminal_and_shared_cooldown(self):
        self.request.url = TARGETS["product"]
        self.boundary.arm(self.request.url)
        with patch("boundary.PinnedHTTPS") as connection:
            connection.return_value.getresponse.return_value.status = 403
            with self.assertRaisesRegex(ValueError, "403"):
                self.boundary.send(None, self.request)
        self.assertTrue((self.data / "cooldown.json").exists())
        with self.assertRaises(ValueError):
            Boundary(self.data, self.data / "cooldown.json").arm(self.request.url)

    def test_tls_failure_consumes_permit_and_closes_socket(self):
        self.boundary.arm(self.request.url)
        with patch("boundary.PinnedHTTPS") as connection:
            connection.return_value.request.side_effect = ssl.SSLCertVerificationError(
                "invalid"
            )
            with self.assertRaises(ssl.SSLCertVerificationError):
                self.boundary.send(None, self.request)
            connection.return_value.close.assert_called_once()
        self.assertFalse((self.data / "permit.json").exists())

    def test_200_challenge_is_terminal_without_snapshot_response(self):
        self.request.url = TARGETS["product"]
        self.boundary.arm(self.request.url)
        with patch("boundary.PinnedHTTPS") as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 200
            response.read1.side_effect = [b"<html>showcaptcha</html>", b""]
            with self.assertRaisesRegex(ValueError, "200 challenge"):
                self.boundary.send(None, self.request)
        self.assertTrue((self.data / "cooldown.json").exists())
        with self.assertRaises(ValueError):
            self.boundary.arm(self.request.url)

    def test_pinned_ip_original_sni_and_tls_verification(self):
        context = ssl.create_default_context()
        conn = PinnedHTTPS("market.yandex.ru", context=context)
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        with (
            patch(
                "boundary.socket.getaddrinfo",
                return_value=[(None, None, None, None, ("8.8.8.8", 443))],
            ),
            patch("boundary.socket.create_connection") as connect,
            patch.object(
                context,
                "wrap_socket",
                side_effect=ssl.SSLCertVerificationError("invalid"),
            ) as wrap,
        ):
            with self.assertRaises(ssl.SSLCertVerificationError):
                conn.connect()
            self.assertEqual(connect.call_args.args[0], ("8.8.8.8", 443))
            self.assertEqual(
                wrap.call_args.kwargs["server_hostname"], "market.yandex.ru"
            )
            connect.return_value.close.assert_called_once()

    def test_private_dns_denied_before_socket(self):
        with (
            patch(
                "boundary.socket.getaddrinfo",
                return_value=[(None, None, None, None, ("127.0.0.1", 443))],
            ),
            patch("boundary.socket.create_connection") as connect,
        ):
            with self.assertRaisesRegex(ValueError, "Private"):
                PinnedHTTPS("market.yandex.ru").connect()
            connect.assert_not_called()

    def test_cooldown_expired_permit_and_unknown_url(self):
        write_json(self.data / "cooldown.json", {"until": 9999999999})
        with self.assertRaisesRegex(ValueError, "cooldown"):
            self.boundary.arm(TARGETS["product"])
        with self.assertRaisesRegex(ValueError, "allowlist"):
            self.boundary.arm("https://example.com")
        write_json(self.data / "permit.json", {"url": self.request.url, "expires": 0})
        with patch("boundary.PinnedHTTPS") as connection:
            with self.assertRaises(ValueError):
                self.boundary.send(None, self.request)
            connection.assert_not_called()

    def test_only_canonical_marketplace_product_cards_are_monitorable(self):
        allowed = {
            "https://market.yandex.ru/card/redmi/123?sku=456": "yandex-market",
            "https://www.ozon.ru/product/redmi-book-123/": "ozon",
            "https://www.avito.ru/voronezh/noutbuki/redmi_1234567890": "avito",
            "https://www.wildberries.ru/catalog/123456/detail.aspx": "wildberries",
        }
        for url, marketplace in allowed.items():
            with self.subTest(url=url):
                self.assertEqual(marketplace_for_product_url(url), marketplace)
                self.boundary.check_target(url)
        denied = [
            "https://example.com/product/123",
            "http://market.yandex.ru/card/redmi/123",
            "https://market.yandex.ru/search?text=redmi",
            "https://market.yandex.ru/card/redmi/123?sku=456&url=https://127.0.0.1",
            "https://user@market.yandex.ru/card/redmi/123",
            "https://market.yandex.ru:444/card/redmi/123",
            "https://www.ozon.ru/product/redmi-123/?from=tracker",
        ]
        for url in denied:
            with self.subTest(url=url):
                self.assertIsNone(marketplace_for_product_url(url))
                with self.assertRaisesRegex(ValueError, "allowlist"):
                    self.boundary.check_target(url)

    def test_add_creates_only_paused_watch_and_deduplicates_url(self):
        url = "https://www.ozon.ru/product/redmi-book-123/"
        with patch(
            "manage.api",
            side_effect=[{}, {"uuid": "watch-123"}],
        ) as api:
            self.assertEqual(ensure_watch(url, "Redmi Book 2026 · UNVERIFIED"), "watch-123")
        payload = api.call_args_list[1].args[1]
        self.assertTrue(payload["paused"])
        self.assertEqual(payload["fetch_backend"], "html_requests")
        self.assertEqual(payload["notification_urls"], [])
        self.assertEqual(payload["processor"], "text_json_diff")
        with patch("manage.api", return_value={"watch-123": {"url": url}}) as api:
            self.assertEqual(ensure_watch(url, "Redmi Book 2026 · UNVERIFIED"), "watch-123")
            api.assert_called_once_with("/watch")

    def test_mutable_global_backend_cannot_select_browser(self):
        class Watch(dict):
            has_browser_steps = False

        http_fetcher = object()
        package = SimpleNamespace(
            content_fetchers=SimpleNamespace(html_requests=http_fetcher)
        )
        with patch.dict(sys.modules, {"changedetectionio": package}):
            for selected in ("system", None, "html_requests"):
                self.assertEqual(
                    resolve_http(
                        watch=Watch(fetch_backend=selected),
                        datastore={"fetch_backend": "extra_browser_attacker"},
                    ),
                    (http_fetcher, "html_requests", None),
                )
            with self.assertRaises(ValueError):
                resolve_http(Watch(fetch_backend="html_webdriver"), {})


if __name__ == "__main__":
    unittest.main()
