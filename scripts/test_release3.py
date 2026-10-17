#!/usr/bin/env python3
"""Release 3 covenant study QC: every linked passage exists in shipped Scripture.

The study map is not a new canon, lectionary ruling, or lunar calculation.
Checks exact source verse coordinates and forbids allocating unapproved Shavuot.
"""
import json,re
from pathlib import Path
R=Path(__file__).resolve().parents[1]
source=(R/"cpt-index.js").read_text(encoding="utf-8")
books=json.loads(re.search(r"window\.CPT_BOOKS=(\[.*?\]);",source,re.S).group(1))
study=json.loads((R/"data/covenant-study.json").read_text())
assert study["schema_version"]==1
assert study["rules"]["lunar_shabbat_days"]==[8,15,22,29]
assert study["rules"]["new_moon_day"]==1
assert "does not calculate" in study["rules"]["date_engine"]
assert len(study["shabbat"])==4 and {b["day"] for b in study["shabbat"]}=={8,15,22,29}
assert len(study["feasts"])==10
assert all(x["rule_status"]=="unapproved_draft" for x in study["feasts"])
assert study["open_questions"]["shavuot"]["status"]=="date_not_approved"
assert not any("Shavuot" in f["event"] for f in study["feasts"])
assert study["open_questions"]["intercalation"]["status"]=="agricultural_sighting_not_verified"
assert set(study["open_questions"])=={"shavuot","intercalation"}
assert not study["rules"].get("observance_approved",False)
canonical={b["title"]:b for b in books}
references=[]
for p in study["shabbat"]:references+=p["readings"]
for p in study["feasts"]:references+=p["readings"]
for p in (study["new_moon"],study["preparation"]):references+=p["readings"]
for p in study["open_questions"].values():references+=p["readings"]
for p in references:
    assert p["book"] in canonical, f"Study book absent: {p}"
    b=canonical[p["book"]]
    assert isinstance(p["chapter"],int) and isinstance(p["verse"],int) and p["chapter"]>0 and p["verse"]>0
    cm=next((c for c in b["chapters"] if c["number"]==p["chapter"]),None)
    assert cm is not None, f"Missing chapter {p}"
    # Do not infer contiguous verse ranges: source witness omissions exist.
    source_book=json.loads((R/"data"/(b["id"]+".json")).read_text())
    c=next((c for c in source_book["chapters"] if c["number"]==p["chapter"]),None)
    assert c and any(v["number"]==p["verse"] for v in c["verses"]),f"Missing source verse {p}"
    assert p["label"] and isinstance(p["label"],str)
assert len({f["event"] for f in study["feasts"]})==len(study["feasts"])
print(f"PASS: {len(references)} read targets in 80-book source, four Sabbath days, ten DRAFT feast studies, Shavuot remains undated.")
