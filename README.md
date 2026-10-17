# cpt-bible-app
Covenant People's Translation (CPT) Bible App — After Passover Edition, by Dr. Nachamasha Yahsharala.

## 80-book Oustory reading edition — 2026-10-16

The app data now covers all **80** books in the founder's working sequence, **1,362** chapters and **36,801** existing source verses. The verified Genesis–Isaiah data files are preserved. **57** additional source books are loaded from traceable public-domain witnesses, including all **14** additional historical titles. For those fourteen titles, **5,390** verse positions now use a modern-English, public-domain World English Bible witness (with its ZIP and individual files SHA-256 recorded); **313** positions retain provisionally modernized historical 1611 wording where an equivalent modern position was not imported. Both witnesses are attributed separately. These are not claimed as a final unified translation. Verse-number omissions at Luke 17:36, Acts 8:37, Acts 15:34, Acts 24:7 and Ecclesiasticus 1:7, 17:5 remain expressly documented rather than filled or renumbered.

The main production manifest is [data/manifest.json](data/manifest.json). [The source build workflow](.github/workflows/build-full-reading-edition.yml) verifies the original 23 book checksums, imports the remaining 57 from pinned source revisions, collates the modern Deuterocanon/Apocrypha from a SHA-256-pinned WEB USFM archive, writes 80 per-book reader files and a searchable 80-book index, and runs structural integrity checks. Additional-book speaker colors are deferred as directed. This is a **complete editable source-based reading edition, not the final author-approved CPT–APE translation**. No change is made to the independent canonical 527-page PDF.

## Release 1 — mobile reading and search (October 2026)

Oustory preserves the verified 80-book working edition and adds reader-only improvements:

- **Continue Reading** tracks the user's current verse as they scroll, restoring the last book, chapter and verse after the app reopens. Existing chapter-only saved positions continue working.
- **Saved Places** opens reliably from Study and the More menu; existing saved chapters are preserved. A tap on a verse now offers **Save Verse** for precise bookmarks.
- **Search** downloads one on-demand full-text index, rather than requesting all 80 book JSON files sequentially. It supports case-insensitive words/phrases, exact references such as `Genesis 1:1`, 100 displayed matches, and responsive batched searching.
- **Text integrity:** `scripts/build_search_index.py` regenerates a disposable publication index from the exact SHA-256-verified per-book source files. It never changes verse text, numbering, colors, provenance, editorial notes, or the CPT–APE master PDF. Search data is created during deployment, not maintained as a second editable Scripture source.
- **Testing:** `scripts/test_release1.py` validates the complete 36,801-verse source index and preserves known witness omissions; the mobile Playwright test exercises saved verse actions, resume after reload, real menu routing, search behavior, and the two-track calendar.

Personal bookmarks and reading position remain **local to this browser** with no cloud sync or account system. Offline access, cross-device backup, editorial completion, and POM AI belong to separate future release phases.
