"""Validate generated/committed read-only published research assets.
The assets reproduce pinned witness text and search coordinates; the CPT--APE
manuscript and its provenance record remain authoritative and unchanged.
"""
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
books=json.loads((ROOT/"data/manifest.json").read_text())
registry=(ROOT/"cpt-index.js").read_text(encoding="utf-8")
match=re.search(r"window\\.CPT_BOOKS=(\\[.*?\\]);",registry,re.S)
assert match,"CPT book inventory unavailable"
ids=[b["id"] for b in json.loads(match.group(1))]
assert len(ids)==len(set(ids))==80

index=json.loads((ROOT/"data/search-index.json").read_text(encoding="utf-8"))
assert index["version"]==1
assert index["verse_count"]==36801==books["verses"]
assert index["book_ids"]==ids
assert len(index["rows"])==36801
assert all(len(x)==4 and isinstance(x[3],str) and x[3].strip() for x in index["rows"])
assert any(row[1:3]==[2,1] and "why" in row[3].lower()
           for row in index["rows"] if ids[row[0]]=="psalms")

directory=ROOT/"data/compare"
manifest=json.loads((directory/"manifest.json").read_text(encoding="utf-8"))
assert manifest["version"]==1 and len(manifest["books"])==80
assert manifest["revision"]=="8ef066868ad1b7204d7be48658ea3bd1783d409b"
assert set(x["book_id"] for x in manifest["books"])==set(ids)
assert sum(x["status"]=="available" for x in manifest["books"])==79
assert all((directory/(id+".json")).is_file() for id in ids)
for book in manifest["books"]:
    witness=json.loads((directory/(book["book_id"]+".json")).read_text(encoding="utf-8"))
    assert witness["book_id"]==book["book_id"]
    assert witness["source_revision"]==manifest["revision"]
    assert witness["status"]==book["status"]
psalms=json.loads((directory/"psalms.json").read_text(encoding="utf-8"))
assert psalms["status"]=="available"
assert len(psalms["positions"]["2"])>=10
assert psalms["positions"]["2"]["1"].strip()
assert "why" in psalms["positions"]["2"]["1"].lower()
assert json.loads((directory/"the-rest-of-esther.json").read_text())["status"]=="unavailable"
print("PASS published artifacts: 80 pinned historical witness books, Psalms 2, 36,801 search verses")
