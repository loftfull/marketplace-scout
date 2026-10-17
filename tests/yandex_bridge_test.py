"""Deterministic adapter checks; no marketplace requests or production observations."""
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".runtime/yandex-market-mcp/src"))
spec = importlib.util.spec_from_file_location("scout_yandex", ROOT / "scripts/yandex-http.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class AdapterTests(unittest.TestCase):
    def test_exact_id_branch_rejects_long_id_before_fetch(self):
        # Exercise the pinned tool, not a replacement Scout parser.
        with patch.object(bridge.server, "_card_page", side_effect=bridge.MarketError("fetch sentinel")) as fetch:
            with self.assertRaisesRegex(Exception, "not a Market card id"):
                bridge.server.get_product("227753481523236864")
            fetch.assert_not_called()
            with self.assertRaisesRegex(Exception, "fetch sentinel"):
                bridge.server.get_product("6013745409")
            fetch.assert_called_once_with("6013745409")

    def test_private_dns_rejected(self):
        with patch.object(bridge.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
            with self.assertRaisesRegex(bridge.MarketError, "destination_denied"):
                bridge.checked_addresses(bridge.HOST)

    def test_block_is_terminal_and_cooldown_persists(self):
        for status in (401, 403, 429, 302):
            with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"YM_CACHE_DIR": folder}):
                client = bridge.ScoutMarketClient()
                response = SimpleNamespace(status=status)
                with patch.object(bridge, "PinnedHTTPS") as connection:
                    connection.return_value.getresponse.return_value = response
                    with self.assertRaisesRegex(bridge.MarketError, "scout_source_blocked"):
                        client.page("/search", {"text": "fixture"})
                    self.assertEqual(connection.return_value.request.call_count, 1)
                    # Fresh process/client must also respect the stored cooldown.
                    other = bridge.ScoutMarketClient()
                    with self.assertRaises(bridge.MarketError):
                        other.page("/search", {"text": "fixture"})
                    self.assertEqual(connection.return_value.request.call_count, 1)

    def test_url_and_body_bounds(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"YM_CACHE_DIR": folder}):
            client = bridge.ScoutMarketClient()
            for url in ("http://market.yandex.ru/search", "https://127.0.0.1/", "https://u@market.yandex.ru/search", "https://market.yandex.ru:444/search"):
                with self.assertRaisesRegex(bridge.MarketError, "destination_denied"):
                    client._send("GET", url, None, None)
            with patch.object(bridge, "PinnedHTTPS") as connection:
                connection.return_value.getresponse.return_value = SimpleNamespace(status=200, read=lambda limit: b"x" * limit)
                with self.assertRaisesRegex(bridge.MarketError, "body_too_large"):
                    client._send("GET", "https://market.yandex.ru/search", None, None)
                connection.return_value.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
