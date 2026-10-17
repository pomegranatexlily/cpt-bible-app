#!/usr/bin/env python3
"""CPT–APE source acquisition and chapter-by-chapter verification.

These are SOURCE ledgers, never author-approved CPT–APE text or speaker-color
annotations. This engine does not modify the canonical PDF or its checkpoint.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CANON = ROOT / "canon" / "books.json"
ALLOWED_TEXT_TYPES = {"paragraph text", "line text"}
# The selected public-domain witness omits these disputed verse positions.
# Record the absence; NEVER manufacture wording or silently renumber.
WITNESS_OMISSIONS = {"Luke": {(17, 36)}, "Acts": {(8, 37), (15, 34), (24, 7)}}


class SourceError(ValueError):
    pass


def log(message: str) -> None:
    print(message, flush=True)


def load_catalog(path: Path) -> dict:
    catalog = json.loads(path.read_text(encoding="utf-8"))
    titles = [b["title"] for b in catalog["books"]]
    if len(titles) != 80 or len(set(titles)) != 80:
        raise SourceError("The full 80-book working catalog is missing or duplicated")
    if catalog["current_verified_checkpoint"] != "Isaiah 66:24":
        raise SourceError("Unexpected canonical baseline")
    if catalog["next_target"] != "Jeremiah 1:1":
        raise SourceError("Unexpected next source target")
    if sum(not b.get("source_key") for b in catalog["books"]) != 14:
        raise SourceError("The fourteen additional source holds must remain visible")
    return catalog


def validate_sections(entries: list, book: str) -> dict:
    """Assemble multiple paragraph/poetry sections into exact verse positions."""
    if not isinstance(entries, list):
        raise SourceError(f"{book}: source is not a list")
    fragments: dict[int, dict[int, list[str]]] = {}
    for record in entries:
        if not isinstance(record, dict):
            raise SourceError(f"{book}: invalid item")
        if record.get("type") not in ALLOWED_TEXT_TYPES:
            continue
        ch, vn, value = (record.get("chapterNumber"),
                         record.get("verseNumber"), record.get("value"))
        # Empty formatting placeholders sometimes carry verse coordinates.
        if not isinstance(value, str) or not value.strip():
            continue
        if not isinstance(ch, int) or not isinstance(vn, int) or ch < 1 or vn < 1:
            raise SourceError(f"{book}: bad chapter/verse reference")
        if "\x00" in value or "\ufffd" in value:
            raise SourceError(f"{book} {ch}:{vn}: damaged source character")
        fragments.setdefault(ch, {}).setdefault(vn, []).append(value.strip())
    if not fragments:
        raise SourceError(f"{book}: no numbered Scripture found")
    chapters: dict[str, dict[str, str]] = {}
    ch_nums = sorted(fragments)
    if ch_nums != list(range(1, ch_nums[-1] + 1)):
        raise SourceError(f"{book}: chapter sequence has a gap")
    for ch in ch_nums:
        verses = fragments[ch]
        numbers = sorted(verses)
        if numbers != list(range(1, numbers[-1] + 1)):
            missing = sorted(set(range(1, numbers[-1] + 1)) - set(numbers))
            holds = WITNESS_OMISSIONS.get(book, set())
            if not all((ch, verse) in holds for verse in missing):
                raise SourceError(f"{book} {ch}: unexpected verse gaps {missing[:12]}")
            log(f"DOCUMENTED SOURCE OMISSION {book} {ch}: {missing} — authorial review required")
        normalized = {}
        for verse in numbers:
            # Preserve words and quoted speech; normalize formatting whitespace.
            text = " ".join(" ".join(verses[verse]).split())
            if not text:
                raise SourceError(f"{book} {ch}:{verse}: empty verse")
            normalized[str(verse)] = text
        chapters[str(ch)] = normalized
        log(f"PARSED {book} {ch}:1–{numbers[-1]} ({len(numbers)} verses)")
    return chapters


def download(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "CPT-APE-source-audit/1.0",
                              "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=75) as response:
                data = response.read(16_000_001)
            if len(data) > 16_000_000:
                raise SourceError("Source exceeds per-file safety limit")
            return data
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt + 1 == attempts:
                raise SourceError(f"Cannot fetch pinned source: {e}") from e
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def process_one(book: dict, revision: str, output: Path) -> dict:
    title, key = book["title"], book["source_key"]
    url = ("https://raw.githubusercontent.com/TehShrike/"
           f"world-english-bible/{revision}/json/{key}.json")
    log(f"FETCHING {title} from pinned revision {revision[:12]}")
    raw = download(url)
    source_sha = hashlib.sha256(raw).hexdigest()
    try:
        entries = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as e:
        raise SourceError(f"{title}: malformed UTF-8 JSON: {e}") from e
    chapters = validate_sections(entries, title)
    counts = {ch: len(verses) for ch, verses in chapters.items()}
    total = sum(counts.values())
    known_omissions = [f"{ch}:{v}" for ch, v in sorted(WITNESS_OMISSIONS.get(title, set()))]
    ledger = {
        "schema_version": 1,
        "book": title,
        "source_title": "World English Bible public-domain JSON (unedited)",
        "source_url": url,
        "source_repository": "TehShrike/world-english-bible",
        "source_revision": revision,
        "source_sha256": source_sha,
        "status": ("SOURCE_WITNESS_GAP_DOCUMENTED_REVIEW_PENDING" if known_omissions
                   else "SOURCE_SEQUENCE_VERIFIED_EDITORIAL_REVIEW_PENDING"),
        "known_source_omissions": known_omissions,
        "is_original_APE_manuscript": False,
        "house_name_edits_applied": False,
        "speaker_spans_reviewed": False,
        "author_approved": False,
        "chapters": chapters,
        "expected_verse_counts": counts,
        "yahawah_direct_verses": [],
        "yahawashi_direct_verses": [],
        "editorial_notes": [
            "This is unedited source evidence, NOT approved CPT–APE wording.",
            "House-name, textual-witness, attribution and speaker-span review required.",
            "Do not feed to the canonical PDF builder until separately cleared."
        ]
    }
    output.mkdir(parents=True, exist_ok=True)
    dest = output / f"{key}.json"
    stage = dest.with_suffix(".json.tmp")
    stage.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n",
                     encoding="utf-8")
    stage.replace(dest)
    result = {
        "book": title, "source_key": key, "chapters": len(chapters),
        "verses": total, "source_sha256": source_sha,
        "source_url": url, "source_ledger": str(dest),
        "state": ledger["status"],
        "known_source_omissions": known_omissions
    }
    log(f"VERIFIED SOURCE {title}: {len(chapters)} chapters; {total} verses; {source_sha[:12]}")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canon", type=Path, default=DEFAULT_CANON)
    parser.add_argument("--mode", choices=["next", "all_remaining"],
                        default="all_remaining")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--out", type=Path, default=Path("out"))
    args = parser.parse_args(argv)
    if not 1 <= args.workers <= 12:
        parser.error("workers must be between 1 and 12")
    started = time.monotonic()
    catalog = load_catalog(args.canon)
    remaining = [b for b in catalog["books"]
                 if not b["checkpoint_complete"]]
    if args.mode == "next":
        selected = [next(b for b in remaining if b["title"] == "Jeremiah")]
    else:
        selected = [b for b in remaining if b.get("source_key")]
    held = [b["title"] for b in remaining if not b.get("source_key")]
    ledgers = args.out / "source-ledgers"
    result: list[dict] = []
    errors: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(process_one, b, catalog["source_revision"], ledgers):
                b["title"] for b in selected}
        for job in concurrent.futures.as_completed(jobs):
            title = jobs[job]
            try:
                result.append(job.result())
            except Exception as e:
                log(f"BLOCKED {title}: {e}")
                errors.append({"book": title, "reason": str(e)})
    by_title = {b["title"]: i for i, b in enumerate(catalog["books"])}
    result.sort(key=lambda x: by_title[x["book"]])
    summary = {
        "edition": catalog["edition"],
        "run_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "mode": args.mode,
        "baseline": catalog["current_verified_checkpoint"],
        "canonical_master_overwritten": False,
        "authorial_approval": "pending",
        "verified_source_books": len(result),
        "verified_source_chapters": sum(x["chapters"] for x in result),
        "verified_source_verses": sum(x["verses"] for x in result),
        "source_results": result,
        "blocked_sources": errors,
        "additional_books_without_approved_source": held,
        "speaker_annotation_required": [x["book"] for x in result],
        "candidate_pdf_built": False,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "production_status": "SOURCE_PREPARATION_ONLY"
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "source-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"RUN SUMMARY: {len(result)} source books, "
        f"{summary['verified_source_chapters']} chapters, "
        f"{summary['verified_source_verses']} verses; "
        f"{len(errors)} fetch/parse failures; {len(held)} approved-witness gaps")
    if errors:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
