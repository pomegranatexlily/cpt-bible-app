# Oustory — Privacy and First-Party Security Review

**Review date:** October 19, 2026  
**App:** Oustory / CPT–APE working Bible edition (GitHub Pages + PWA)  
**Scope:** source inspection of the first-party HTML, JavaScript, service worker, saved-data features, outbound requests, build workflows, and locally exercisable regression checks. This is a source-and-CI review, **not** a third-party penetration test, privacy-law certification, server-log audit, or final editorial manuscript approval.

## Data flow and threat model

- The app does not currently implement a user account, cloud notes service, advertising SDK, or app-managed telemetry endpoint.
- Browser `localStorage` holds saved places, reading position, bookmarks, highlights, reading/audio settings, study progress, calendar track, and personal Scripture notes. This is personal study information, potentially sensitive when notes identify beliefs or personal experiences.
- A browser service worker and Cache Storage hold static app assets, downloaded Bible books, public calendar feed copies, and other static resources. Cache Storage is browser-managed and may be evicted.
- Ordinary HTTPS requests retrieve app files, canon JSON, optional study assets, and the current calendar feed from `https://pomegranatexlily.github.io/shabbat-calendar/calendar.json`. Hosting platforms and network infrastructure may receive standard request metadata. The app does not append saved personal notes to this feed URL.
- Explicit sharing uses Web Share (or user-directed copy/save). Export assembles a local JSON backup, including personal notes if present. Imported JSON is limited to a declared key set, format-checked, and gated behind confirmation.
- The app has no payments, authentication, live AI inference, or server-side account actions in the reviewed build.

## Findings and changes

| Priority | Finding | Mitigation in this review | Residual risk |
|---|---|---|---|
| Medium | No published privacy notice despite storing reading notes and preferences | New `privacy.html`, menu entry, transparent data-flow and deletion disclosures | Privacy/legal review remains necessary if products or laws change. |
| Medium | Third-party font loaded from `raw.githubusercontent.com` on page open | Removed remote font; uses OS-native typeface | Minor typography differences possible. |
| Medium | No unified user control to erase saved personal study data | Added opt-in, confirmed `Delete saved study data` action; deletes only known Oustory keys, refreshes app state | Exports and browser/cloud backups the user previously saved remain under their control. |
| Medium | Browser security policy not explicitly scoped | HTML meta CSP limits scripts, connections, images, fonts, objects, forms; `no-referrer` policy | Meta CSP does not provide all HTTP-header protections; verify browser compatibility. |
| Medium | Privacy document unavailable to offline installations | Added policy to versioned service-worker shell and deployment manifest | First installation still needs network to fetch files. |
| **High (remaining)** | Apps published under paths on the same `pomegranatexlily.github.io` hostname share an origin; `localStorage` is NOT path-isolated | Disclosed in privacy page and the personal notes screen. Namespaced keys and selective deletion reduce accidental cross-app impacts. | **Other same-origin pages can technically read or alter notes and keys.** A dedicated origin/hostname for Oustory is the recommended structural fix. |
| Medium (remaining) | Local personal notes and exported backup JSON are not separately encrypted | Clear disclosure and user deletion/export choices | Anyone with access to the browser profile, local files, or another same-origin script could access data. |
| Low (remaining) | GitHub Pages hosting and separate calendar feed expose usual request metadata | No application analytics; declare external feed and hosting | Hosting logs, retention, security headers and linked destinations are outside this repository's direct control. |

## Implemented code safeguards

1. No analytics, advertising pixels, cookies-for-tracking, or cloud account feature is included in the inspected first-party code. Therefore there is no misleading forced acceptance gate.
2. External source links in the research pane use `rel="noopener noreferrer"` when opened in a new tab; generated markup uses DOM nodes and `textContent` rather than `innerHTML` injection for source text.
3. JSON backup import has a 1 MB file limit, recognized storage keys, strict value-shape validation, explicit confirmation, and rollback attempt on a storage write error.
4. Saved-data deletion uses only the Oustory `KEYS` list; does not invoke `localStorage.clear()`, does not wipe offline books, and requires a confirmation prompt.
5. A `Content-Security-Policy` meta tag and `referrer` tag constrain browser requests. On GitHub Pages, browser protections requiring server-controlled HTTP headers, such as a `frame-ancestors` policy, are not supplied by this HTML meta mechanism. No claim of complete clickjacking prevention is made.
6. The public privacy notice is linked from the Oustory menu, cached for offline availability, and included in the published Pages artifact.
7. Security contract checks run in code-integrity, mobile, and deploy workflows; mobile regression exercises the privacy route and deletion boundaries.

## Deployment and change management

- `scripts/privacy_security_unit.mjs`: static policy and integration checks.
- `scripts/release4_ui.mjs`: browser checks for privacy page navigation, confirmed note removal, unrelated-key preservation, and offline-book retention.
- `scripts/check_content.py`: canonical 80-book Scripture counts and checksum integrity; unchanged by privacy changes.
- `.github/workflows/deploy-pages.yml`: explicitly publishes the privacy page and runs privacy security gate.
- `sw.js`: versioned cache shell including privacy notice.
- Oustory's manuscript, canon, source witness attribution, and verse selection are not changed as part of this security review.

## What is **not** verified

- No full browser-matrix manual audit of physical iPhone Safari/PWA was performed by this static review.
- No external security certification, host log retention verification, DNS/custom-domain isolation, network packet capture, accessibility certification, or legal opinion was performed.
- No assurance is made that data is encrypted at rest beyond whatever protections the browser, device and OS independently provide.
- The separate GitHub Pages project at the same hostname is a material browser origin-isolation issue until deployment is moved to a distinct origin.

## Next architectural decision

**Before asking readers to store sensitive personal notes, consider hosting Oustory on a dedicated domain/subdomain origin** separate from every other Pomegranate × Lily app. This requires a conscious domain/DNS/hosting choice and should not be silently changed. Re-run the offline PWA, links, calendars and backup tests following a domain migration.
