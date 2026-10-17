#!/usr/bin/env python3
"""Oustory 80-book reading edition integrity, source and app regression check."""
from pathlib import Path
import hashlib, json, re, subprocess, tempfile

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
manifest=json.loads((DATA/"manifest.json").read_text(encoding="utf8"))
assert manifest["source_pdf_sha256"]=="61e62dd0060e1a7a2d904fcc69b58c5f9e268c7a5fc0431bd05f2826841c7aa5"
assert manifest["no_authorial_approval_claimed"] is True
assert manifest["status"]=="COMPLETE_80_BOOK_EDITABLE_READING_EDITION_NOT_FINAL_TRANSLATION"
assert manifest["historical_modernization_status"]=="PROVISIONAL_NOT_FINAL_TRANSLATION"
assert (manifest["books"],manifest["chapters"],manifest["verses"])==(80,1362,36801)
assert (manifest["verified_seed_books"],manifest["candidate_source_books"],manifest["historic_additional_books"])==(23,57,14)

index=(ROOT/"cpt-index.js").read_text(encoding="utf8")
m=re.search(r"window\.CPT_BOOKS=(\[.*?\]);",index,re.S)
assert m is not None,"No book registry"
books=json.loads(m.group(1))
assert len(books)==80
assert books[0]["title"]=="Genesis" and books[22]["title"]=="Isaiah" and books[-1]["title"]=="Revelation"
canon=json.loads((ROOT/"canon/books.json").read_text(encoding="utf8"))
assert [b["title"] for b in books]==[b["title"] for b in canon["books"]]
assert len(set(b["id"] for b in books))==80
assert set(b["id"] for b in books)==set(manifest["files_sha256"])
assert len(manifest["new_book_provenance"])==57
assert all(not x["author_approved"] and x["source_url"] for x in manifest["new_book_provenance"])

expected_missing={(d["book"],d["reference"]) for d in manifest["missing_source_positions"]}
assert expected_missing=={
 ("Luke","17:36"),("Acts","8:37"),("Acts","15:34"),("Acts","24:7"),
 ("Ecclesiasticus","1:7"),("Ecclesiasticus","17:5")
}, "Source omission list changed"

total_ch=total_v=seed_colored=0
actual_missing=set()
for i,meta in enumerate(books):
    path=DATA/f"{meta['id']}.json"
    assert path.is_file(),f"{meta['title']} absent"
    assert hashlib.sha256(path.read_bytes()).hexdigest()==manifest["files_sha256"][meta["id"]],f"{meta['title']} checksum"
    data=json.loads(path.read_text(encoding="utf8"))
    assert (data["id"],data["title"])==(meta["id"],meta["title"])
    assert len(data["chapters"])==len(meta["chapters"])
    assert i < 23 or data["sourceStatus"]=="PROVISIONAL_READING_EDIT"
    subcount=0
    for chap,expected in zip(data["chapters"],meta["chapters"]):
        assert chap["number"]==expected["number"]
        assert len(chap["verses"])==expected["verseCount"]
        first=expected.get("firstVerse",1)
        last=expected.get("lastVerse",len(chap["verses"]))
        nums=[v["number"] for v in chap["verses"]]
        assert nums==sorted(set(nums)),f"Duplicate/nonascending: {meta['title']} {chap['number']}"
        assert nums[0]==first and nums[-1]==last
        for missing in set(range(first,last+1))-set(nums):
            key=(meta["title"],f"{chap['number']}:{missing}")
            assert key in expected_missing,f"Undocumented verse gap: {key}"
            actual_missing.add(key)
        if "intro" in chap:assert isinstance(chap["intro"],str) and chap["intro"].strip()
        total_ch+=1
        for verse in chap["verses"]:
            assert set(verse).issuperset({"number"})
            if "parts" in verse:
                assert "text" not in verse
                text="".join(p["text"] for p in verse["parts"])
                for part in verse["parts"]:
                    assert part["color"] in {"black","blue","green","purple"}
                    if i>=23:raise ValueError(f"New source verse prematurely colored: {meta['title']}")
                    if part["color"]!="black":seed_colored+=1
            else:text=verse.get("text","")
            assert isinstance(text,str) and text.strip() and "\ufffd" not in text
            subcount+=1
        total_v+=len(chap["verses"])
    assert subcount==meta["verseCount"],f"Wrong book count: {meta['title']}"
assert actual_missing==expected_missing,"Missing positions not represented"
assert (total_ch,total_v)==(1362,36801)
assert seed_colored>500,"Previously approved master colors lost"
assert manifest["historical_verses_orthographically_modernized"]==5703
html=(ROOT/"index.html").read_text(encoding="utf8")
assert "S<span>Books" not in html and "><span>Books</span>" in html
assert '<script src="cpt-index.js"></script>' in html
assert '<script src="oustory-reader.js"></script>' in html
reader=(ROOT/"oustory-reader.js").read_text(encoding="utf8")
assert "Number.isInteger(v.number)" in reader
assert "'speaker-' + color" in reader
for source in ("cpt-index.js","oustory-reader.js"):
    subprocess.run(["node","--check",str(ROOT/source)],check=True,capture_output=True)
inline=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",html,flags=re.S)
with tempfile.TemporaryDirectory() as temp:
    for i,script in enumerate(inline):
        if script.strip():
            script_path=Path(temp)/f"inline-{i}.js"
            script_path.write_text(script,encoding="utf8")
            subprocess.run(["node","--check",str(script_path)],check=True,capture_output=True)
print(f"PASS: {len(books)} books, {total_ch} chapters, {total_v} witness verses, {len(actual_missing)} documented omissions, {seed_colored} preserved existing color spans; 80-book Oustory integrity verified.")
