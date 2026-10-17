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

## Calendar feed resilience — October 17 hotfix

The 2026-10-17 production screenshot showed Oustory's month stuck at Loading with a live feed error even while the separate Shabbat Calendar repository built successfully. The previous browser test intercepted the calendar URL with a passing fixture and therefore did not exercise a live-source outage.

The calendar now retrieves the published Shabbat Calendar feed first, then reuses the most recently successfully fetched and schema-validated feed, or finally falls back to `calendar/published.json`. This fallback is staged at deployment by running the **same** Shabbat Calendar repository's generator and arithmetic tests, recording its upstream Git revision and generation timestamp. No independent lunar calendar, new month rule, or approved feast is introduced. The interface labels a snapshot when the live fetch fails; it remains planning data, not observed crescent verification. The service worker precaches the fallback so the calendar remains usable after installing/reopening offline.

The regression explicitly interrupts the live calendar network request and checks that the real generated bundle renders in both year-start tracks, retains the selected day, and reopens in offline mode. The live feed remains the primary source whenever reachable; the bundled version is only as recent as its Oustory deployment, while a saved successful response can be newer.

## October 17 calendar 404 publication correction

GitHub Pages was publishing twice for the same commit: first the custom workflow deployed the generated `_site` (including `calendar/published.json`), then the automatic branch/Jekyll Pages workflow overwrote that deployment from the repository root, where the generated file did not exist. This was confirmed from the timestamps in the two successful deployment logs and the iPhone's two 404 responses.

The canonical calendar snapshot is now **committed** at `calendar/published.json` in the Oustory repository, generated from Shabbat Calendar revision `48b3d9854bcc5856f47a852fff6230667852528b`, and served under either deployment mechanism. A root `.nojekyll` signals that the static PWA is not a Jekyll site. `scripts/test_published_calendar.py` fails future builds unless the source-controlled snapshot, both track anchors, upstream provenance, and draft-audit status exist. Both workflows now deploy and test the same checked-in snapshot. No new lunar calculations or sacred date approvals were introduced.

The site still has two competing deployment mechanisms. A later operations action can set GitHub Settings → Pages → Build and deployment → Source to **GitHub Actions** to keep only the intentional custom deploy; that setting is not modified by this source-code repair. The checked-in file ensures calendar fallback is still present if branch publication runs again. The upstream Shabbat Calendar's own live-feed URL remains a separate deployment concern.
