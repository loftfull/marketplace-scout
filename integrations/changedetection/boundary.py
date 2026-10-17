"""Bounded HTTP transport for the standalone pilot; no product parsing here.

Pinned TLS connection follows Scout's scripts/yandex-http.py. Upstream keeps
all extraction/storage/UI. Two explicit URLs, no redirects/proxies or cookies.
"""

import http.client
import ipaddress
import json
import socket
import ssl
import threading
import time
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / ".data/external/changedetection"
TARGETS = {
    "product": "https://market.yandex.ru/card/x/6013745409?sku=6013745409",
    "control": "https://raw.githubusercontent.com/dgtlmoon/changedetection.io/09881f8b26aa01a2be66c5f63daf54a79a42b6bd/README-pip.md",
}
MAX_BODY = 8 * 1024 * 1024
PRODUCT_HOSTS = {
    "market.yandex.ru": ("yandex-market", r"^/card/[^/]+/\d+/?$|^/(?:product--[^/]+|product)/\d+/?$"),
    "www.ozon.ru": ("ozon", r"^/product/(?:[^/]*-)?\d+/?$"),
    "ozon.ru": ("ozon", r"^/product/(?:[^/]*-)?\d+/?$"),
    "www.avito.ru": ("avito", r"^/.+_\d+/?$"),
    "avito.ru": ("avito", r"^/.+_\d+/?$"),
    "www.wildberries.ru": ("wildberries", r"^/catalog/\d+/detail\.aspx$"),
    "wildberries.ru": ("wildberries", r"^/catalog/\d+/detail\.aspx$"),
}


def marketplace_for_product_url(url):
    if not isinstance(url, str) or not url or len(url) > 1000:
        return None
    try:
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.port
            or parsed.fragment
        ):
            return None
        rule = PRODUCT_HOSTS.get(parsed.hostname.lower())
        if not rule:
            return None
        marketplace, pattern = rule
        if not re.fullmatch(pattern, parsed.path):
            return None
        query = parse_qsl(parsed.query, keep_blank_values=True)
        if marketplace == "yandex-market":
            if any(key != "sku" or not value.isdigit() for key, value in query):
                return None
            if len([key for key, _ in query if key == "sku"]) > 1:
                return None
        elif query:
            return None
        return marketplace
    except (ValueError, UnicodeError):
        return None


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporary.replace(path)


def read_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


class PinnedHTTPS(http.client.HTTPSConnection):
    def connect(self):
        addresses = list(
            dict.fromkeys(
                row[4][0]
                for row in socket.getaddrinfo(
                    self.host, 443, socket.AF_INET, socket.SOCK_STREAM
                )
            )
        )
        if not addresses or any(
            not ipaddress.ip_address(a).is_global for a in addresses
        ):
            raise ValueError("Private/reserved destination denied")
        sock = socket.create_connection((addresses[0], 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except BaseException:
            sock.close()
            raise


class Boundary:
    def __init__(self, data=DATA, cooldown=None):
        self.data = data
        self.cooldown = cooldown or ROOT / ".runtime/yandex-state/blocked.json"
        self.lock = threading.Lock()

    def check_target(self, url):
        if url not in TARGETS.values() and marketplace_for_product_url(url) is None:
            raise ValueError("URL outside pilot allowlist")
        if url in read_json(self.data / "terminal.json", {}):
            raise ValueError("Previous access failure: explicit review required")
        if (
            url == TARGETS["product"]
            and read_json(self.cooldown, {}).get("until", 0) > time.time()
        ):
            raise ValueError("Existing Market source cooldown is active")

    def arm(self, url):
        self.check_target(url)
        permit = self.data / "permit.json"
        if permit.exists():
            raise ValueError("An unused permit already exists")
        write_json(permit, {"url": url, "expires": time.time() + 90})

    def terminal(self, url, outcome, reason):
        terminal = read_json(self.data / "terminal.json", {})
        terminal[url] = outcome | {"reason": reason}
        write_json(self.data / "terminal.json", terminal)
        if url == TARGETS["product"]:
            current = read_json(self.cooldown, {})
            write_json(
                self.cooldown,
                {
                    "reason": "changedetection " + reason,
                    "at": outcome["at"],
                    "path": urlsplit(url).path,
                    "until": max(current.get("until", 0), time.time() + 900),
                },
            )
        raise ValueError("Source restricted/redirected: " + reason)

    def send(self, session, request, **kwargs):
        from requests import Response

        with self.lock:
            self.check_target(request.url)
            permit_path = self.data / "permit.json"
            permit = read_json(permit_path, {})
            if (
                request.method != "GET"
                or request.body
                or permit.get("url") != request.url
                or permit.get("expires", 0) < time.time()
            ):
                raise ValueError("No matching one-use pilot permit")
            # Consume before DNS/TLS/network: failure cannot cause another attempt.
            permit_path.unlink()
            parsed = urlsplit(request.url)
            connection = PinnedHTTPS(
                parsed.hostname, timeout=12, context=ssl.create_default_context()
            )
            started = time.monotonic()
            outcome = {"url": request.url, "at": time.time(), "status": None}
            try:
                path = parsed.path + ("?" + parsed.query if parsed.query else "")
                connection.request(
                    "GET",
                    path,
                    headers={
                        "User-Agent": "MarketplaceScout-changedetection-pilot/0.1",
                        "Accept-Language": "ru-RU",
                        "Accept-Encoding": "identity",
                    },
                )
                response = connection.getresponse()
                outcome["status"] = response.status
                if response.status in (401, 403, 429) or 300 <= response.status < 400:
                    self.terminal(request.url, outcome, "HTTP " + str(response.status))
                content = bytearray()
                while True:
                    remaining = 25 - (time.monotonic() - started)
                    if remaining <= 0:
                        raise TimeoutError("Pilot response deadline")
                    if connection.sock:
                        connection.sock.settimeout(min(12, remaining))
                    chunk = response.read1(min(65536, MAX_BODY + 1 - len(content)))
                    if not chunk:
                        break
                    content.extend(chunk)
                    if len(content) > MAX_BODY:
                        raise ValueError("Pilot response too large")
                lower = content.decode("utf-8", errors="replace").lower()
                if request.url == TARGETS["product"] and any(
                    marker in lower
                    for marker in (
                        "<title>ой!",
                        "showcaptcha",
                        "smartcaptcha.yandex",
                        "подтвердите, что вы не робот",
                        "<title>доступ ограничен",
                    )
                ):
                    self.terminal(request.url, outcome, "HTTP 200 challenge")
                result = Response()
                result.status_code = response.status
                result.url = request.url
                result.headers.update(dict(response.getheaders()))
                result._content = bytes(content)
                result._content_consumed = True
                result.request = request
                result.encoding = "utf-8"
                outcome["bytes"] = len(content)
                return result
            except Exception as error:
                outcome["error"] = type(error).__name__
                raise
            finally:
                connection.close()
                outcome["elapsedSeconds"] = round(time.monotonic() - started, 3)
                with (self.data / "requests.jsonl").open("a", encoding="utf-8") as log:
                    log.write(json.dumps(outcome) + "\n")
