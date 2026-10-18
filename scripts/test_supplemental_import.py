#!/usr/bin/env python3
"""Verify 19-label, 8-readable / 11-held Supplemental Writings without changing the 80-book canon."""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXPECTED={
 "1-enoch":None,"jasher":91,"2-baruch":None,"3-maccabees":7,
 "4-maccabees":18,"ethiopic-didascalia":None,"abtilis":None,
 "second-book-of-covenant":None}
parser=argparse.ArgumentParser()
parser.add_argument("--allow-enoch-pending",action="store_true")
a=parser.parse_args()
s=(ROOT/"supplemental-books.js").read_text(encoding="utf-8")
m=re.search(r"window\.CPT_SUPPLEMENTAL_BOOKS\s*=\s*(\[[\s\S]*\]);",s)
if not m:raise AssertionError("Supplemental inventory unavailable")
meta=json.loads(m[1])
assert len(meta)==19 and len({b["id"] for b in meta})==19
active={b["id"] for b in meta if b.get("readable_witness")}
assert active==set(EXPECTED),(active,EXPECTED)
assert len(meta)-len(active)==11
for id,expected_chapters in EXPECTED.items():
 path=ROOT/"data/supplemental"/(id+".json")
 if id=="1-enoch" and a.allow_enoch_pending and not path.exists():
  continue
 assert path.is_file(),str(path)
 doc=json.loads(path.read_text(encoding="utf-8"))
 assert doc["id"]==id and doc["collection"]=="SUPPLEMENTAL_WRITINGS"
 assert doc["author_approved"] is False
 assert doc["modernization_approved"] is False
 chapters=doc["chapters"]
 assert len(chapters)>0
 if expected_chapters:assert len(chapters)==expected_chapters,(id,len(chapters))
 assert all(c["number"]==i+1 for i,c in enumerate(chapters))
 for c in chapters:
  if "verses" in c:
   vs=c["verses"]
   assert len(vs)>0
   assert all(v["number"]>0 and isinstance(v["text"],str) and v["text"].strip() for v in vs)
   assert all(vs[j]["number"]<vs[j+1]["number"] for j in range(len(vs)-1))
  else:
   assert c.get("reader_division_only") is True
   assert c.get("original_chapter_number")==None
   assert c["paragraphs"] and all(isinstance(p,str) and p.strip() for p in c["paragraphs"])
   assert doc.get("navigation_label"),"Do not pass navigation divisions off as chapters."
 if id=="jasher":
  assert sum(len(c["verses"]) for c in chapters)>=3800
  assert "THE END" not in chapters[-1]["verses"][-1]["text"]
 if id=="4-maccabees":
  assert sum(len(c["verses"]) for c in chapters)>=470
 if id=="1-enoch":
  assert doc["source"]["source_sha256_normalized_utf8"]=="10d325355a810badf67bbbd1fe6bda77dc6e294eae78c2f6c69290188af45b14"
reader=(ROOT/"oustory-reader.js").read_text()
assert "for(let n=1;n<=7;n++)" not in reader
assert "loadSupplement(b.id)" in reader and "doc.chapters" in reader
assert "window.OustoryFeatures?.showBible()" in reader
assert "SUPPLEMENTAL_WRITINGS" not in (ROOT/"cpt-index.js").read_text() # primary stays at 80 books
print("PASS: 19 supplemental identities, 8 readable witnesses, 11 honest source holds, full chapter/section navigation; 80-book index preserved.")
