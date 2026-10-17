"""Package a genuine Shabbat Calendar generator output for Oustory offline fallback.
This must never calculate a second calendar or silently authorize draft feasts.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

def stage(source: Path, target: Path, revision: str):
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Expected full upstream commit SHA")
    data = json.loads(source.read_text(encoding="utf-8"))
    if data.get("schema_version") != 2:
        raise ValueError("Unexpected Shabbat calendar schema")
    if data.get("verification", {}).get("version") != 1:
        raise ValueError("Missing canonical calendar audit")
    if not data["verification"].get("status", "").startswith("planning_arithmetic_checked"):
        raise ValueError("Upstream calendar audit is not passing")
    for track in ("earlier", "later"):
        t = data.get("tracks", {}).get(track, {})
        if not (t.get("years") and t.get("events") and t.get("months")):
            raise ValueError(f"Missing {track} track")
        if any(x.get("rule_status") == "approved" for x in t["events"]):
            raise ValueError("Unreviewed draft feast elevated to approved")
    data["oustory_snapshot"] = {
        "source": "pomegranatexlily/shabbat-calendar",
        "revision": revision,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "meaning": "Bundled published planning data; arithmetic audit is not an observation or founder approval."
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Staged Shabbat Calendar snapshot {revision[:12]} ({target.stat().st_size} bytes)")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: stage_calendar_feed.py input.json output.json upstreamSHA")
    stage(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
