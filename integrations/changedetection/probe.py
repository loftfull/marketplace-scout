"""Read-only local contract/resource evidence. No marketplace requests."""

import hashlib
import json
import urllib.error
import urllib.request

import psutil
from boundary import DATA, ROOT, read_json
from manage import api, summary


def run():
    codes = {}
    for name, path, headers in [
        ("missingApiKey", "/api/v1/watch", {}),
        ("wrongApiKey", "/api/v1/watch", {"x-api-key": "invalid"}),
        ("foreignHost", "/", {"Host": "evil.example"}),
        ("foreignOrigin", "/", {"Origin": "https://evil.example"}),
        ("crossSite", "/", {"Sec-Fetch-Site": "cross-site"}),
        ("socketIo", "/socket.io/?EIO=4&transport=polling", {}),
        (
            "socketForeignOrigin",
            "/socket.io/?EIO=4&transport=polling",
            {"Origin": "https://evil.example"},
        ),
        ("browserSteps", "/browser-steps/", {}),
        ("proxyCheck", "/check_proxy/", {}),
        ("browserSnapshot", "/add-watch-ui/snapshot", {}),
    ]:
        try:
            with urllib.request.urlopen(
                urllib.request.Request("http://127.0.0.1:8791" + path, headers=headers),
                timeout=10,
            ) as response:
                codes[name] = response.status
        except urllib.error.HTTPError as error:
            codes[name] = error.code
    assert all(code in (400, 403) for code in codes.values()), codes
    watches = [summary(uuid) for uuid in api("/watch")]
    snapshots = []
    for watch in watches:
        for timestamp in watch["history"]:
            snapshot = api("/watch/" + watch["uuid"] + "/history/" + timestamp)
            encoded = (
                snapshot if isinstance(snapshot, str) else json.dumps(snapshot)
            ).encode()
            snapshots.append(
                {
                    "uuid": watch["uuid"],
                    "timestamp": timestamp,
                    "bytes": len(encoded),
                    "sha256": hashlib.sha256(encoded).hexdigest(),
                }
            )
    process = psutil.Process(read_json(DATA / "running.json", {})["pid"])
    owned = [process] + process.children(recursive=True)
    return {
        "authAndOrigin": codes,
        "watches": watches,
        "snapshots": snapshots,
        "requests": [
            json.loads(line)
            for line in (DATA / "requests.jsonl").read_text().splitlines()
        ]
        if (DATA / "requests.jsonl").exists()
        else [],
        "resources": {
            "processes": len(owned),
            "rssBytes": sum(p.memory_info().rss for p in owned),
            "peakRssBytes": sum(
                getattr(p.memory_info(), "peak_wset", p.memory_info().rss)
                for p in owned
            ),
            "datastoreBytes": sum(
                p.stat().st_size for p in DATA.rglob("*") if p.is_file()
            ),
        },
        "scoutHistorySha256": hashlib.sha256(
            (ROOT / ".data/history.json").read_bytes()
        ).hexdigest(),
    }


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2))
