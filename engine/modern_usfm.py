#!/usr/bin/env python3
"""Parse modern public-domain WEB Classic Deuterocanon USFM as SECOND witness.

Never confuse USFM verse IDs with the independently recorded 1611 source.
Only exactly matching chapter:verse positions can populate the provisional
reader; unmatched historical positions must fall back visibly to the original
1611 text after orthographic adjustment. Editorial witness choice is pending.
"""
from __future__ import annotations
import hashlib
import io
import re
import zipfile
from collections import Counter
from pathlib import Path

USFM_URL="https://ebible.org/Scriptures/eng-web_usfm.zip"
# These align by ordinary chapter:verse coordinates with historical source.
CODES={
    "1 Esdras":"1ES",
    "2 Esdras":"2ES",
    "Tobit":"TOB",
    "Judith":"JDT",
    "The Wisdom of Solomon":"WIS",
    "Ecclesiasticus":"SIR",
    "Baruch":"BAR",
    "1 Maccabees":"1MA",
    "2 Maccabees":"2MA",
}
FOOTNOTES=re.compile(r"\\(?:f|x) .*?\\(?:f|x)\*",re.S)
FIELD=re.compile(r"^\\([a-z0-9+*]+)\s*",re.I)
INLINE=re.compile(r"\\\+?[a-z][a-z0-9]*\*?(?:\s+)?",re.I)
VERSE=re.compile(r"^\\v\s+([0-9]+)(?:-[0-9]+)?\s*(.*)",re.S)
CHAPTER=re.compile(r"^\\c\s+(\d+)\b")
SKIP_MARKERS={"id","ide","h","toc1","toc2","toc3","mt1","mt2",
              "is1","is2","ip","imte","cl","s1","s2","s3","ms1",
              "r","d","sr","rem","sts","mte","periph"}

def plain(t: str)->str:
    t=FOOTNOTES.sub("",t)
    # USFM inline style tags are markup; retain their interior wording.
    t=INLINE.sub(" ",t)
    t=t.replace("~"," ").replace("\u200b","")
    return " ".join(t.split())

def parse_usfm(body: str)->dict[str,dict[str,str]]:
    chapters={}
    chapter=None
    verse=None
    pieces=[]
    def flush():
        nonlocal pieces
        if chapter is not None and verse is not None:
            text=plain(" ".join(pieces))
            if not text:raise ValueError(f"Modern USFM empty text at {chapter}:{verse}")
            book=chapters.setdefault(str(chapter),{})
            if str(verse) in book:raise ValueError(f"Repeated modern USFM reference {chapter}:{verse}")
            book[str(verse)]=text
        pieces=[]
    for line in body.splitlines():
        line=line.strip()
        if not line:continue
        ch=CHAPTER.match(line)
        if ch:
            flush()
            chapter=int(ch.group(1));verse=None;continue
        v=VERSE.match(line)
        if v:
            flush()
            if chapter is None:raise ValueError("USFM verse encountered before chapter")
            verse=int(v.group(1))
            pieces=[v.group(2)]
            continue
        if chapter is None or verse is None:continue
        m=FIELD.match(line)
        if m:
            marker=m.group(1).lower()
            if marker in SKIP_MARKERS:continue
            if marker in ("p","m","q","q1","q2","q3","q4","b","pi","pi1","li","li1"):
                tail=line[m.end():]
                if tail:pieces.append(tail)
                continue
        pieces.append(line)
    flush()
    if not chapters:raise ValueError("No modern USFM verses parsed")
    for chapter,verses in chapters.items():
        if int(chapter)<1 or any(int(v)<1 for v in verses):
            raise ValueError("Modern source chapter/verse invalid")
    return chapters

def load_archive(path:Path):
    raw=path.read_bytes()
    if len(raw)<100_000 or len(raw)>25_000_000:
        raise ValueError("Unexpected WEB modern source archive size")
    z=zipfile.ZipFile(io.BytesIO(raw))
    modern={}
    provenance={}
    for title,code in CODES.items():
        matches=[n for n in z.namelist() if re.match(rf"^\d+-{code}eng-web\.usfm$",n)]
        if len(matches)!=1:raise ValueError(f"Modern witness {title} ({code}) not uniquely present: {matches}")
        content=z.read(matches[0])
        text=content.decode("utf-8-sig")
        verses=parse_usfm(text)
        modern[title]=verses
        provenance[title]={"modern_witness": "World English Bible Classic public-domain USFM",
            "source_url":USFM_URL,"source_code":code,
            "source_file":matches[0],"source_sha256":hashlib.sha256(content).hexdigest(),
            "source_verse_positions":sum(len(c) for c in verses.values())}
    return modern,provenance,hashlib.sha256(raw).hexdigest()
