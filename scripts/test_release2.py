#!/usr/bin/env python3
"""Release 2 source integrity and unapproved-editorial-lane safeguards."""
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_kjv_comparison import normalize,REV
books=json.loads((ROOT/"data/manifest.json").read_text())
notes=json.loads((ROOT/"data/editorial-notes.json").read_text())
terms=json.loads((ROOT/"data/terminology-review.json").read_text())
questions=json.loads((ROOT/"data/witness-questions.json").read_text())
assert books["verses"]==36801 and books["books"]==80
assert notes["verses_rewritten"] is False
assert terms["actual_term_groups"]==27 and len(terms["terms"])==27
assert terms["source_claimed_count"]==25
assert terms["auto_replace"] is False
assert all(t["global_replace_allowed"] is False for t in terms["terms"])
assert len(set(t["id"] for t in terms["terms"]))==27
gentiles=[x for x in terms["terms"] if x["term"]=="Gentiles"]
assert len(gentiles)==1 and gentiles[0]["status"]=="founder_contextual_correction"
assert "Luke 7:5" in gentiles[0]["review"] and "Acts 4:27" in gentiles[0]["review"]
assert "never blanket" in gentiles[0]["review"].lower()
f=[n for n in notes["notes"] if n["label"]=="Nations and Gentiles: determine the referent by context"]
assert len(f)==1 and f[0]["status"]=="author-ruling"
assert {"Luke 7:5","Acts 4:27","Romans 11:13"}<=set(f[0]["refs"]) and "Matthew 28:19" in f[0]["body"]
assert len(questions["questions"])==15 and questions["witnesses_independently_verified"] is False
assert all(q["status"]=="source_review_pending" and not q["independent_witness_citations"] for q in questions["questions"])
assert {x["kind"] for x in questions["questions"]}>={"witness-variant","translation-interpretation","punctuation-interpretation"}
sample=normalize({"chapters":[{"chapter":1,"verses":[{"verse":1,"text":"A historical English source verse"},{"verse":3,"text":"A nonconsecutive source coordinate"}]}]})
assert sample[1][1]=="A historical English source verse" and 2 not in sample[1] and 3 in sample[1]
try:
    normalize({"chapters":[{"chapter":1,"verses":[{"verse":1,"text":"one"},{"verse":1,"text":"duplicate"}]}]})
except ValueError:pass
else:raise AssertionError("Duplicate source coordinate accepted")
out=ROOT/"data/compare"
if (out/"manifest.json").exists():
    m=json.loads((out/"manifest.json").read_text())
    assert m["revision"]==REV and len(m["books"])==80
    assert sum(r["status"]=="available" for r in m["books"])==79
    assert [r["book_id"] for r in m["books"] if r["status"]!="available"]==["the-rest-of-esther"]
    assert m["source"].startswith("English 1611 printed KJV")
    for b in m["books"]:
        x=json.loads((out/(b["book_id"]+".json")).read_text())
        assert x["source_revision"]==REV
        assert (x["status"]=="available")==(b["status"]=="available")
        assert x["matched"]==b["matched"]
        assert x["kjv_only"]==b["kjv_only"]
        assert x["oustory_only"]==b["oustory_only"]
    genesis=json.loads((out/"genesis.json").read_text())
    assert "beginning" in genesis["positions"]["1"]["1"].lower()
    baruch=json.loads((out/"baruch.json").read_text())
    assert "6" in baruch["positions"] and "Letter of Jeremiah.json" in baruch["source_files"]
    rest=json.loads((out/"the-rest-of-esther.json").read_text())
    assert rest["status"]=="unavailable" and not rest["positions"]
print("PASS Release 2: 27 review terms; 15 unresolved research questions; contextual nations correction; verified 1611 coordinate integrity when generated.")
