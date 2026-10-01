"""Stop/backup and then verify restart without any outbound requests."""

import argparse
import json
import shutil
import socket
import time
from datetime import datetime, timezone

import psutil
from boundary import DATA, ROOT, read_json, write_json
from probe import run

EVIDENCE = ROOT / "work/changedetection-lifecycle.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["stop-backup", "verify-restart"])
    args = parser.parse_args()
    if args.action == "stop-backup":
        before = run()
        pid = read_json(DATA / "running.json", {})["pid"]
        process = psutil.Process(pid)
        started = time.monotonic()
        (DATA / "stop.request").touch()
        process.wait(timeout=45)
        elapsed = time.monotonic() - started
        with socket.socket() as probe_socket:
            assert probe_socket.connect_ex(("127.0.0.1", 8791)) != 0, (
                "Port still listening"
            )
        assert not (DATA / "running.json").exists()
        backup = (
            ROOT
            / ".runtime/backups/changedetection"
            / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        )
        shutil.copytree(DATA, backup)
        evidence = {
            "before": before,
            "stopSeconds": round(elapsed, 3),
            "ownedProcessExited": True,
            "portReleased": True,
            "backup": str(backup.relative_to(ROOT)),
        }
        write_json(EVIDENCE, evidence)
        print(json.dumps({k: v for k, v in evidence.items() if k != "before"}))
    else:
        evidence = read_json(EVIDENCE, {})
        after = run()
        before = evidence["before"]
        for field in ("watches", "snapshots", "requests", "scoutHistorySha256"):
            assert before[field] == after[field], field + " changed during restart"
        assert all(w["paused"] for w in after["watches"])
        evidence.update(
            after=after,
            pauseAndHistoryRestored=True,
            noAutomaticRequests=True,
            scoutHistoryUnchanged=True,
        )
        write_json(EVIDENCE, evidence)
        print(
            "PASS: pause, history, snapshot hash and request count unchanged after restart"
        )


if __name__ == "__main__":
    main()
