"""Lifecycle/transport adapter for pinned MIT SZhukovWork/yandex-market-mcp.

Reuse its parsing and MCP tools, with ordinary HTTPS and terminal access blocks.
No curl impersonation, imported cookies, proxies or account sessions.
"""
import http.client
import ipaddress
import socket
import ssl
import time
from types import SimpleNamespace
from urllib.parse import urlsplit

from yandex_market_mcp import server
from yandex_market_mcp.client import MarketClient, MarketError

HOST = "market.yandex.ru"
MAX_BODY = 8 * 1024 * 1024


def checked_addresses(host):
    addresses = list(dict.fromkeys(row[4][0] for row in socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)))
    if not addresses or any(not ipaddress.ip_address(value).is_global for value in addresses):
        raise MarketError("destination_denied")
    return addresses


class PinnedHTTPS(http.client.HTTPSConnection):
    def connect(self):
        address = checked_addresses(self.host)[0]
        sock = socket.create_connection((address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except BaseException:
            sock.close()
            raise


class ScoutMarketClient(MarketClient):
    def __init__(self):
        # Providing a transport prevents upstream loading curl and saved sessions.
        super().__init__(http=object())

    def _send(self, method, url, headers, body):
        parsed = urlsplit(url)
        if method != "GET" or body is not None or parsed.scheme != "https" or parsed.hostname != HOST or parsed.port or parsed.username or parsed.password:
            raise MarketError("destination_denied")
        conn = PinnedHTTPS(HOST, timeout=12, context=ssl.create_default_context())
        try:
            path = parsed.path + ("?" + parsed.query if parsed.query else "")
            conn.request("GET", path, headers={"User-Agent": "MarketplaceScout/0.3", "Accept-Language": "ru-RU", "Accept-Encoding": "identity"})
            response = conn.getresponse()
            if response.status in (401, 403, 429):
                self._set_block(f"HTTP {response.status}", self._rate_cooldown, parsed.path)
                raise MarketError(f"scout_source_blocked HTTP {response.status}")
            if 300 <= response.status < 400:
                self._set_block("redirect", self._rate_cooldown, parsed.path)
                raise MarketError("scout_source_blocked redirect")
            content = response.read(MAX_BODY + 1)
            if len(content) > MAX_BODY:
                raise MarketError("body_too_large")
            return SimpleNamespace(status_code=response.status, text=content.decode("utf-8", errors="replace"), headers=dict(response.getheaders()), url=url)
        except (OSError, http.client.HTTPException) as error:
            # A source failure must not trigger upstream recovery retries.
            raise MarketError(f"transport_failed {type(error).__name__}") from error
        finally:
            conn.close()
            self._last_call = time.monotonic()
            self.requests_made += 1


if __name__ == "__main__":
    server._client = ScoutMarketClient()
    server.main()
