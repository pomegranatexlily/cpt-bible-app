# cpt-bible-app
Covenant People's Translation (CPT) Bible App — After Passover Edition, by Dr. Nachamasha Yahsharala.

## 80-book Oustory reading edition — 2026-10-16

The app data now covers all **80** books in the founder's working sequence, **1,362** chapters and **36,801** existing source verses. The verified Genesis–Isaiah data files are preserved. **57** additional source books are loaded from traceable public-domain witnesses, including all **14** additional historical titles. Those fourteen titles have provisional modern-English/orthographic revisions; traditional 1611 wording remains the underlying traceable witness and needs a subsequent stylistic editorial pass. Verse-number omissions at Luke 17:36, Acts 8:37, Acts 15:34, Acts 24:7 and Ecclesiasticus 1:7, 17:5 remain expressly documented rather than filled or renumbered.

The main production manifest is [data/manifest.json](data/manifest.json). [The source build workflow](.github/workflows/build-full-reading-edition.yml) verifies the original 23 book checksums, imports the remaining 57 from pinned source revisions, writes 80 per-book reader files and a searchable 80-book index, and runs structural integrity checks. Additional-book speaker colors are deferred as directed. This is a **complete editable source-based reading edition, not the final author-approved CPT–APE translation**. No change is made to the independent canonical 527-page PDF.
