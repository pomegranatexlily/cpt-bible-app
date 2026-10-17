#!/usr/bin/env python3
"""Import fourteen additional CPT–APE Scripture titles as unedited source evidence.

This is a SOURCE witness import only, not a textual-critical judgment, a CPT–APE
translation, a reviewed speaker ledger, or permission to change the master PDF.
"""
from __future__ import annotations

import concurrent.futures
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest import SourceError, download, load_catalog, log

ROOT = Path(__file__).resolve().parents[1]
KJV_REV = "8ef066868ad1b7204d7be48658ea3bd1783d409b"
ESTHER_REV = "271173ef8be658239edcb4fc753cd39d2b2731d3"
KJV_BASE = ("https://raw.githubusercontent.com/aruljohn/"
            f"Bible-kjv-1611/{KJV_REV}/")
ESTHER_URL = (
    "https://raw.githubusercontent.com/scrollmapper/"
    f"bible_databases_deuterocanonical/{ESTHER_REV}/"
    "sources/en/greek-esther/greek-esther.json"
)

KNOWN_HISTORICAL_EMPTY = {"Ecclesiasticus": {(1, 7), (17, 5)}}

SOURCE_FILES = {
    "1 Esdras": ["1 Esdras.json"],
    "2 Esdras": ["2 Esdras.json"],
    "Tobit": ["Tobit.json"],
    "Judith": ["Judith.json"],
    "The Rest of Esther": [],
    "The Wisdom of Solomon": ["Wisdom of Solomon.json"],
    "Ecclesiasticus": ["Ecclesiasticus.json"],
    # Preserve the explicit author's single-book Baruch/Epistle relationship.
    "Baruch": ["Baruch.json", "Letter of Jeremiah.json"],
    "The Song of the Three Holy Children": ["Prayer of Azariah.json"],
    "The History of Susanna": ["Susanna.json"],
    "Bel and the Dragon": ["Bel and the Dragon.json"],
    "The Prayer of Manasses": ["Prayer of Manasseh.json"],
    "1 Maccabees": ["1 Maccabees.json"],
    "2 Maccabees": ["2 Maccabees.json"],
}


def parse_historical_book(payload: dict, label: str) -> dict[int, dict[int, str]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("chapters"), list):
        raise SourceError(f"{label}: bad historical source structure")
    output: dict[int, dict[int, str]] = {}
    for part in payload["chapters"]:
        ch = part.get("chapter")
        if not isinstance(ch, int) or ch < 1 or ch in output:
            raise SourceError(f"{label}: repeated/bad chapter id {ch}")
        rows = part.get("verses")
        if not isinstance(rows, list):
            raise SourceError(f"{label} {ch}: verses not an array")
        out = {}
        for row in rows:
            vn, text = row.get("verse"), row.get("text")
            if not isinstance(vn, int) or vn < 1 or vn in out:
                raise SourceError(f"{label} {ch}: bad/duplicate verse {vn}")
            if not isinstance(text, str) or not text.strip():
                if (ch, vn) in KNOWN_HISTORICAL_EMPTY.get(label, set()):
                    log(f"DOCUMENTED HISTORICAL EMPTY {label} {ch}:{vn}; NO invented text")
                    continue
                raise SourceError(f"{label} {ch}:{vn}: empty text")
            if "\x00" in text or "\ufffd" in text:
                raise SourceError(f"{label} {ch}:{vn}: corrupted glyph")
            out[vn] = " ".join(text.split())
        if not out:
            raise SourceError(f"{label} {ch}: no verses")
        output[ch] = out
    if not output:
        raise SourceError(f"{label}: empty book")
    chapters_sorted = sorted(output)
    if chapters_sorted != list(range(chapters_sorted[0], chapters_sorted[-1] + 1)):
        raise SourceError(f"{label}: chapter gap")
    for ch in chapters_sorted:
        nums = sorted(output[ch])
        # Source additions to Esther begin at 10:4, not invented 10:1.
        first = 4 if label == "The Rest of Esther" and ch == 10 else 1
        if nums != list(range(first, nums[-1] + 1)):
            missing = set(range(first, nums[-1] + 1)) - set(nums)
            if not all((ch, v) in KNOWN_HISTORICAL_EMPTY.get(label, set()) for v in missing):
                raise SourceError(f"{label} {ch}: unverified source gaps {sorted(missing)}")
            log(f"DOCUMENTED HISTORICAL GAP {label} {ch}: {sorted(missing)}")
        log(f"PARSED HISTORICAL SOURCE {label} {ch}:{first}–{nums[-1]}")
    return output


def get_one(url: str) -> tuple[dict, dict]:
    raw = download(url)
    try:
        obj = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise SourceError(f"Malformed JSON from {url}: {e}") from e
    return obj, {"url": url, "sha256": hashlib.sha256(raw).hexdigest()}


def acquire(title: str, folder: Path) -> dict:
    if title not in SOURCE_FILES:
        raise SourceError(f"Unrecognized title: {title}")
    log(f"FETCHING HISTORICAL SOURCE {title}")
    provenance = []
    if title == "The Rest of Esther":
        obj, p = get_one(ESTHER_URL)
        provenance.append(p)
        books = obj.get("books", [])
        if len(books) != 1 or books[0].get("name") != "Additions to Esther":
            raise SourceError("Greek Esther collection contains an unexpected title")
        parts = parse_historical_book(books[0], title)
    else:
        parts = {}
        for filename in SOURCE_FILES[title]:
            url = KJV_BASE + quote(filename)
            obj, p = get_one(url)
            provenance.append(p)
            sub = parse_historical_book(obj, title)
            if filename == "Letter of Jeremiah.json":
                if sorted(sub) != [1] or set(parts) != set(range(1, 6)):
                    raise SourceError("Baruch/Epistle collation unexpectedly changed")
                parts[6] = sub[1]
            else:
                if parts:
                    raise SourceError(f"{title}: ambiguous multiple-source collation")
                parts.update(sub)
    count = sum(len(v) for v in parts.values())
    if not count:
        raise SourceError(f"{title}: zero verses")
    ledger = {
        "schema_version": 1,
        "book": title,
        "source_title": "Historical public-domain Scripture text (unedited witness)",
        "source_url": provenance[0]["url"],
        "source_provenance": provenance,
        "status": "HISTORICAL_SOURCE_IMPORTED_EDITORIAL_REVIEW_REQUIRED",
        "source_language_style": "historical English, not final CPT–APE modern English",
        "original_APE_manuscript": False,
        "speaker_spans_reviewed": False,
        "ancient_witness_collation_complete": False,
        "author_approved": False,
        "source_chapter_numbering_preserved": True,
        "documented_source_empty_positions": [
            f"{ch}:{v}" for ch, v in sorted(KNOWN_HISTORICAL_EMPTY.get(title, set()))
        ],
        "chapters": {str(c): {str(v): t for v, t in sorted(rows.items())}
                     for c, rows in sorted(parts.items())},
        "expected_verse_counts": {str(c): len(rows) for c, rows in sorted(parts.items())},
        "known_source_review_notes": (
            ["Greek Esther starts at source position 10:4; DO NOT silently renumber chapters."]
            if title == "The Rest of Esther" else
            ["Baruch chapters 1–5 plus Epistle of Jeremiah as chapter 6; editorial review."]
            if title == "Baruch" else
            ["Historical source identity differs from approved CPT–APE book heading; review."]
            if title in {"The Song of the Three Holy Children",
                         "The History of Susanna"} else
            ["Prayer of Manasses source collapses the prayer to one long verse; editor must segment."]
            if title == "The Prayer of Manasses" else
            ["Ecclesiasticus historical source positions 1:7 and 17:5 are empty; 1:1 includes a prologue."]
            if title == "Ecclesiasticus" else []
        )
    }
    folder.mkdir(parents=True, exist_ok=True)
    slug = (title.lower().replace(" ", "_").replace("’", ""))
    target = folder / (slug + ".json")
    tmp = target.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    tmp.replace(target)
    log(f"IMPORTED HISTORICAL SOURCE {title}: {len(parts)} chapters, {count} verses")
    return {"book": title, "chapters": len(parts), "verses": count,
            "file": str(target), "source_provenance": provenance,
            "status": ledger["status"]}


def main() -> int:
    catalog = load_catalog(ROOT / "canon/books.json")
    titles = catalog["additional_titles"]
    if set(titles) != set(SOURCE_FILES) or len(titles) != 14:
        raise SourceError("All fourteen author-directed titles must be present")
    folder = Path("out/historical-source-ledgers")
    ok, failed = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        future = {pool.submit(acquire, t, folder): t for t in titles}
        for f in concurrent.futures.as_completed(future):
            title = future[f]
            try:
                ok.append(f.result())
            except Exception as e:
                log(f"BLOCKED HISTORICAL SOURCE {title}: {e}")
                failed.append({"book": title, "reason": str(e)})
    index = {name: i for i, name in enumerate(titles)}
    ok.sort(key=lambda x: index[x["book"]])
    report = {
        "run_utc": datetime.now(timezone.utc).isoformat(),
        "canonical_checkpoint": "Isaiah 66:24",
        "canonical_master_overwritten": False,
        "books_imported": len(ok),
        "chapters_imported": sum(x["chapters"] for x in ok),
        "source_verses_imported": sum(x["verses"] for x in ok),
        "books": ok, "blocked": failed,
        "status": "HISTORICAL_SOURCE_ONLY_PENDING_TRANSLATION_AND_QC"
    }
    Path("out").mkdir(exist_ok=True)
    Path("out/historical-source-summary.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    log(f"HISTORICAL IMPORT: {len(ok)}/14 books, "
        f"{report['chapters_imported']} chapters, "
        f"{report['source_verses_imported']} verses, {len(failed)} blocked")
    return 2 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
