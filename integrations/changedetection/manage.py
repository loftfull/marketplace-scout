"""Local operator CLI using the upstream REST API; never prints credentials."""

import argparse
import json
import time
import urllib.request

from boundary import DATA, TARGETS, Boundary, read_json

BASE = "http://127.0.0.1:8791/api/v1"


def api(path, payload=None, method=None, root=False):
    settings = read_json(DATA / "changedetection.json", {})
    key = settings["settings"]["application"]["api_access_token"]
    request = urllib.request.Request(
        ("http://127.0.0.1:8791" if root else BASE) + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"x-api-key": key, "Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        raw = response.read()
        if "application/json" in response.headers.get("Content-Type", ""):
            return json.loads(raw)
        return raw.decode("utf-8")


def ensure_watch(target):
    url = TARGETS[target]
    for uuid, watch in api("/watch").items():
        if watch["url"] == url:
            return uuid
    title = (
        "RedmiBook Pro 16 2026 / 338H / 32 GB / 1 TB — UNVERIFIED; Voronezh unconfirmed"
        if target == "product"
        else "TECHNICAL CONTROL — upstream README; not a product or price"
    )
    result = api(
        "/watch",
        {
            "url": url,
            "title": title,
            "paused": True,
            "fetch_backend": "html_requests",
            "notification_urls": [],
            "processor": "restock_diff" if target == "product" else "text_json_diff",
        },
    )
    return result["uuid"]


def summary(uuid):
    watch = api("/watch/" + uuid)
    history = api("/watch/" + uuid + "/history")
    return {
        key: watch.get(key)
        for key in (
            "url",
            "title",
            "paused",
            "last_checked",
            "last_error",
            "last_check_status",
        )
    } | {"uuid": uuid, "history": history, "verification": "UNVERIFIED"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["add", "check", "status", "stop"])
    parser.add_argument("--target", choices=TARGETS, default="product")
    args = parser.parse_args()
    if args.action == "stop":
        (DATA / "stop.request").touch()
        print("Cooperative stop requested for changedetection pilot only.")
        return
    if args.action == "status":
        print(
            json.dumps(
                [summary(uuid) for uuid in api("/watch")], ensure_ascii=False, indent=2
            )
        )
        return
    uuid = ensure_watch(args.target)
    if args.action == "check":
        previous = api("/watch/" + uuid).get("last_checked")
        Boundary().arm(TARGETS[args.target])
        api("/watch/" + uuid + "?recheck=true")
        for _ in range(45):
            time.sleep(1)
            queue = api("/queue.json", root=True)
            active = [w["uuid"] for w in queue["running"] + queue["queued"]]
            if (
                uuid not in active
                and api("/watch/" + uuid).get("last_checked") != previous
            ):
                break
        else:
            raise TimeoutError(
                "Check did not finish in 45 seconds; do not rearm blindly"
            )
    print(json.dumps(summary(uuid), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
