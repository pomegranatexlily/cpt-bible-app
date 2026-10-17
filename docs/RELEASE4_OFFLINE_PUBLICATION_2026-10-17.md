# Release 4 — Offline reading, saved-data backup, accessibility, publication checks
Date: 2026-10-17
Repository: pomegranatexlily/cpt-bible-app

## Delivered
- Service worker caches the app shell, essential local editorial/study records, and Genesis for first-open offline fallback. Same-origin book JSON is cached after retrieval.
- **Offline reading & backup** is reachable from the More menu and Reading settings. The optional **Download all 80 books** action progressively caches the exact published `data/<id>.json` files. Cancel retains downloaded files; explicit **Remove downloaded books** deletes only this app's downloaded-book cache, never local saved data.
- Offline functionality is browser/device-local. Clearing browser storage removes it. Cache availability varies by device, quota, and browser privacy settings.
- Export creates a versioned `oustory-saved-study` JSON v1 file containing only the saved-device fields: precise reading position, saved chapters/verses, highlights, reading plans, selected calendar track, daily study completion, reading preferences and audio rate. No actual Bible text or editorial source files are serialized.
- Import rejects unknown keys, unsupported versions, invalid Scripture coordinates, out-of-range settings, oversize backups, and malformed data before prompting to replace the backed-up fields. Import reloads the app to synchronize the in-memory bookmark/highlight views. No automatic sync or server upload.
- Additional focus visibility, high-contrast styles, live status messages, keyboard buttons, page-title announcements and Scripture loading states.
- Release workflows ship `sw.js`, `oustory-release4.js`, `oustory-release4.css`; CI runs syntax and real-browser offline/backup regression.
- Main editorial data and the canonical CPT–APE master are untouched.

## Important limits
1. The 80-book **working** reader is not the founder-approved final CPT–APE translation. Previously identified provisional witnesses and unresolved manuscript positions retain their disclosure.
2. Offline downloaded books are available locally. A real-time hosted Shabbat Calendar feed does not become authoritative or offline verified simply because the Bible is cached. Unvisited KJV comparison JSON and search-index files may be unavailable without internet.
3. There is no account-based cross-device sync, automatic restore, or remote backup. Move the exported file yourself to another device and explicitly import it there.
4. Installing Oustory as a home-screen PWA depends on HTTPS and browser support. Native app-store publication is not claimed.

## Release verification
- The source edition retains its 80-book checksum/integrity gate.
- Mobile Playwright test opens Release 4 UI, downloads all 80 individual books, sets the browser offline, reloads the shell, reads a non-Genesis chapter, backs up and restores saved data, rejects an invalid backup, and checks that restored highlights appear in Study.
- The GitHub Pages deployment bundles the offline service-worker dependencies and tests their presence.
- Perform manual iPhone Safari / Add to Home Screen testing for storage quota, home-screen offline launches, VoiceOver reading order, large text, and iOS file export/import before making a general-availability claim.

## Smoke checklist
1. On a connection, open More → Offline reading & backup → Download all 80 books; confirm 80/80.
2. Turn on airplane mode, relaunch the installed app and read Revelation 22.
3. Save a verse and highlight another; export the backup file to Files.
4. Change the local saved data; import the backup; verify restoration after app reload.
5. Confirm search/comparison/calendar inform the reader if unvisited network-dependent resources are unavailable.
6. Turn on VoiceOver and verify book/chapter picker, verse-action dialogue, downloadable actions, status changes, and keyboard navigation.
