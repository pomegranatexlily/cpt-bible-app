#!/usr/bin/env python3
"""Pin and stage the complete 1 Enoch English source for Oustory (no invented verses).

The primary 80-book reader and existing Supplemental Writings are not changed.
The generated 1-enoch.json is a source-based reading edition, NOT final CPT–APE.
"""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
URL="https://www.gutenberg.org/cache/epub/77935/pg77935.txt"
# Source bytes after UTF-8-SIG decoding/re-encoding as archived in the
# 19-title English source reader's recorded source_manifest.json.
EXPECTED_SHA="10d325355a810badf67bbbd1fe6bda77dc6e294eae78c2f6c69290188af45b14"

def segments(text, maximum=8000):
    paragraphs=[
      " ".join(line.strip() for line in p.splitlines() if line.strip())
      for p in re.split(r"\n\s*\n+", text.replace("\r\n","\n").replace("\r","\n"))]
    paragraphs=[p for p in paragraphs if p]
    groups=[]; current=[];length=0
    for paragraph in paragraphs:
        if length and length+len(paragraph)>maximum:
            groups.append(current);current=[];length=0
        if len(paragraph)>maximum:
            words=paragraph.split(" ");piece=""
            for word in words:
                if piece and len(piece)+len(word)>maximum:
                    if current:groups.append(current);current=[];length=0
                    groups.append([piece]);piece=""
                piece=(piece+" "+word).strip()
            if piece:current.append(piece);length+=len(piece)
        else:
            current.append(paragraph);length+=len(paragraph)
    if current:groups.append(current)
    return [{"number":i+1,"original_chapter_number":None,"reader_division_only":True,
              "paragraphs":group} for i,group in enumerate(groups)]

def main():
    request=urllib.request.Request(URL,headers={"User-Agent":"CPT-APE historical source verification/1.0"})
    with urllib.request.urlopen(request,timeout=60) as response:
        raw=response.read()
    text=raw.decode("utf-8-sig",errors="replace")
    sha=hashlib.sha256(text.encode("utf-8")).hexdigest()
    if sha!=EXPECTED_SHA:raise ValueError("Pinned Project Gutenberg 1 Enoch source hash changed; refusing silent substitution: "+sha)
    if len(text)<200000 or "ENOCH" not in text.upper():
        raise ValueError("English witness appears incomplete")
    head=re.search(r"\*\*\*\s*START OF THE PROJECT GUTENBERG EBOOK[^\n]*",text,re.I)
    tail=re.search(r"\*\*\*\s*END OF THE PROJECT GUTENBERG EBOOK[^\n]*",text,re.I)
    if not head or not tail or tail.start()<=head.end():
        raise ValueError("Project Gutenberg source bounds not detected")
    edition=text[head.end():tail.start()].strip()
    chapter_list=segments(edition)
    if len(chapter_list)<15 or len(chapter_list)>120:raise ValueError("Unexpected number of source-reader divisions")
    doc={
      "schema_version":1,"id":"1-enoch","title":"1 Enoch",
      "collection":"SUPPLEMENTAL_WRITINGS",
      "status":"FULL_HISTORICAL_ENGLISH_SOURCE_UNAPPROVED",
      "author_approved":False,"modernization_approved":False,
      "navigation_label":"Reader sections (not original chapter numbers)",
      "source":{
        "edition":"R. H. Charles, The Book of Enoch (first published 1917); Project Gutenberg ebook #77935",
        "translator":"R. H. Charles",
        "source_language":"Historical English translated from Ethiopic witnesses",
        "source_url":URL,"source_sha256_normalized_utf8":sha,
        "transcription_notice":"Complete 1917 historical English source with editorial introduction and apparatus. Reader divisions are navigation aids, not reconstructed manuscript chapters or verses; original Roman numeral headings remain in the wording."
      },"chapters":chapter_list
    }
    out=ROOT/"data/supplemental/1-enoch.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(doc,ensure_ascii=False,indent=0)+"\n",encoding="utf-8")
    print(json.dumps({"file":str(out),"source_sha256":sha,"reading_sections":len(chapter_list),"source_chars":len(edition)}))
if __name__=="__main__":main()
