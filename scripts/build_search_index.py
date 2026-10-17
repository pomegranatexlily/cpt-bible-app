#!/usr/bin/env python3
"""Build Oustory's deterministic search-only index from the exact shipped verses.

This writes a disposable publication artifact. It never edits any Scripture
source, changes verse numbering, or claims editorial approval. The full-text
index is loaded only after a reader explicitly opens and uses Search.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build_index(root=ROOT):
    manifest=json.loads((root/"data/manifest.json").read_text(encoding="utf-8"))
    js=(root/"cpt-index.js").read_text(encoding="utf-8")
    m=re.search(r"window\.CPT_BOOKS=(\[.*?\]);",js,re.S)
    if not m:
        raise ValueError("Missing canonical Oustory book registry")
    books=json.loads(m.group(1))
    if len(books)!=manifest["books"]:
        raise ValueError("Book manifest and registry disagree")
    rows=[]
    for book_number,meta in enumerate(books):
        path=root/"data"/(meta["id"]+".json")
        content=path.read_bytes()
        if hashlib.sha256(content).hexdigest()!=manifest["files_sha256"][meta["id"]]:
            raise ValueError("Source checksum mismatch: "+meta["id"])
        data=json.loads(content)
        if data["id"]!=meta["id"] or len(data["chapters"])!=len(meta["chapters"]):
            raise ValueError("Source chapter mismatch: "+meta["id"])
        for ch,expected in zip(data["chapters"],meta["chapters"]):
            if ch["number"]!=expected["number"] or len(ch["verses"])!=expected["verseCount"]:
                raise ValueError("Chapter registry mismatch: "+meta["id"])
            for verse in ch["verses"]:
                text=verse.get("text")
                if text is None:
                    text="".join(part["text"] for part in verse["parts"])
                if not isinstance(text,str) or not text.strip():
                    raise ValueError("Empty source verse in "+meta["id"])
                rows.append([book_number,ch["number"],verse["number"],text])
    if len(rows)!=manifest["verses"]:
        raise ValueError("Source verse count mismatch")
    return {"version":1,"book_ids":[b["id"] for b in books],
            "verse_count":len(rows),"rows":rows}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True,
                        help="Publication search-index.json path (not source JSON)")
    args=parser.parse_args()
    result=build_index()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,
                                     separators=(",",":"))+"\n",encoding="utf-8")
    print("Search index: "+str(result["verse_count"])+" source verses across "+
          str(len(result["book_ids"]))+" books; "+str(args.output.stat().st_size)+" bytes.")


if __name__=="__main__":
    main()
