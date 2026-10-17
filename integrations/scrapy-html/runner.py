"""One-shot stdin/stdout runner; input never contains an arbitrary URL."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from scrapy.crawler import CrawlerProcess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scout_spider import MARKETS, ScoutHTMLSpider  # noqa: E402

MAX_INPUT = 4096


def serialize_result(value: dict[str, object]) -> bytes:
    """Return protocol output as UTF-8 bytes regardless of Windows console code page."""
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def fail(detail: str, marketplace: object = None) -> int:
    sys.stdout.buffer.write(
        serialize_result(
            {
                "marketplace": marketplace if marketplace in MARKETS else "unknown",
                "status": "error",
                "stage": "html-input",
                "detail": detail,
                "discovery_url": None,
                "offers": [],
            }
        )
    )
    return 2


def main() -> int:
    raw = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(raw) > MAX_INPUT:
        return fail("input_too_large")
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError, UnicodeDecodeError):
        return fail("invalid_json")
    if not isinstance(payload, dict):
        return fail("invalid_input")
    marketplace = payload.get("marketplace")
    query = payload.get("query")
    city_id = payload.get("city_id")
    if marketplace not in MARKETS:
        return fail("unsupported_marketplace", marketplace)
    if not isinstance(query, str) or not query.strip() or len(query) > 200:
        return fail("invalid_query", marketplace)
    if city_id not in {"voronezh", "moskva", "sankt-peterburg"}:
        return fail("invalid_city", marketplace)
    proxy = os.environ.get("SCOUT_EGRESS_PROXY", "")
    if not re.fullmatch(r"http://127\.0\.0\.1:[1-9][0-9]{1,4}", proxy):
        return fail("egress_proxy_required", marketplace)

    settings = dict(ScoutHTMLSpider.custom_settings)
    settings.update({"SCOUT_EGRESS_PROXY": proxy, "SCOUT_MARKETPLACE": marketplace})
    settings["LOG_INSTALL_ROOT_HANDLER"] = False
    process = CrawlerProcess(settings)
    crawler = process.create_crawler(ScoutHTMLSpider)
    process.crawl(
        crawler,
        marketplace=marketplace,
        query=query,
        city_id=city_id,
    )
    process.start(stop_after_crawl=True)
    result = getattr(crawler.spider, "result", None)
    if not isinstance(result, dict):
        return fail("crawl_result_missing", marketplace)
    sys.stdout.buffer.write(serialize_result(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
