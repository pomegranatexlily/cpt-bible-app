"""Reject app releases whose calendar snapshot is missing from the committed Pages source."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "calendar" / "published.json"
assert (root / ".nojekyll").exists(), "Branch Pages must serve the static root unchanged"
assert path.is_file(), "Calendar snapshot must be committed, not only built in _site"
j = json.loads(path.read_text(encoding="utf-8"))
assert j["schema_version"] == 2
assert j["verification"]["version"] == 1
assert j["verification"]["status"] == "planning_arithmetic_checked_not_observation_verified"
meta = j["oustory_snapshot"]
assert meta["source"] == "pomegranatexlily/shabbat-calendar"
assert re.fullmatch(r"[0-9a-f]{40}", meta["revision"])
assert re.fullmatch(r"20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ", meta["generated_at_utc"])
tracks = j["tracks"]
assert set(tracks) == {"earlier", "later"}
assert tracks["earlier"]["years"][0]["start_date"] == "2027-03-09"
assert tracks["later"]["years"][0]["start_date"] == "2027-04-07"
for track in tracks.values():
    assert len(track["years"]) >= 5 and len(track["events"]) > 100
    assert any(e["date"] == "2026-10-19" and e["kind"] == "sabbath"
               and e["lunar_day"] == 8 for e in track["current_events"])
    assert not any(e.get("rule_status") == "approved" for e in track["events"])
print("PASS committed calendar snapshot, published origin, both years and manuscript-neutral statuses")
