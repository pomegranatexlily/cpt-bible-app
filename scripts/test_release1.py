#!/usr/bin/env python3
"""Release 1 full-text index invariants — read-only against Scripture source files."""
from pathlib import Path
import json
import sys
from tempfile import TemporaryDirectory

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_search_index import build_index, main as _main  # noqa: E402

index=build_index(ROOT)
manifest=json.loads((ROOT/"data/manifest.json").read_text(encoding="utf-8"))
assert index["version"]==1
assert len(index["book_ids"])==manifest["books"]==80
assert index["verse_count"]==len(index["rows"])==manifest["verses"]==36801
assert index["book_ids"][0]=="genesis"
assert index["book_ids"][-1]=="revelation"
assert index["rows"][0][:3]==[0,1,1]
assert "beginning" in index["rows"][0][3].lower()
assert index["rows"][-1][0]==79
assert len({tuple(r[:3]) for r in index["rows"]})==len(index["rows"])
assert all(isinstance(r[3],str) and r[3].strip() and 0<=r[0]<80
           for r in index["rows"])
assert [(r[1],r[2]) for r in index["rows"][:2]]==[(1,1),(1,2)]
assert not any(r[0]==index["book_ids"].index("luke") and r[1]==17 and r[2]==36 for r in index["rows"])
assert not any(r[0]==index["book_ids"].index("acts") and r[1]==8 and r[2]==37 for r in index["rows"])

with TemporaryDirectory() as temp:
    out=Path(temp)/"search-index.json"
    out.write_text(json.dumps(index,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    saved=json.loads(out.read_text(encoding="utf-8"))
    assert saved==index
    assert out.stat().st_size>1000000

print(f"PASS: {index['verse_count']} canonical-order source verses indexed, source SHA-256 verified, no altered verse positions.")
