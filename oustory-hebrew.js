"use strict";
/* Oustory — Hebrew names in the live app (not a mockup layer).
   Reads window.OustoryHebrewNames (oustory-hebrew-names.js, produced by the
   completed Hebrew system in pom-lily-labs) and puts the gold Hebrew line:
   - under each book title in the Books list (77 of 80; the 3 Greek additions
     to Daniel carry no line, by design), and
   - over the chapter heading in the reader.
   Purely presentational: it observes the reader's own DOM and never touches
   Scripture text, navigation, or stored data. */
(() => {
  const byTitle = (window.OustoryHebrewNames && window.OustoryHebrewNames.byTitle) || {};
  const titles = Object.keys(byTitle).sort((a, b) => b.length - a.length);

  function nameForTitle(title) {
    const e = byTitle[title];
    return e && e.hebrew ? e.hebrew : null;
  }
  function titleFromHeading(text) {
    if (!text) return null;
    for (const t of titles) {
      if (text === t || text.startsWith(t + " ")) return t;
    }
    return null;
  }

  /* Books list: wrap title + Hebrew line in a small column inside the row. */
  function augmentButton(btn) {
    if (btn.dataset.hebrewDone) return;
    const titleEl = btn.querySelector(".bk-title");
    if (!titleEl) return;
    btn.dataset.hebrewDone = "1";
    const heb = nameForTitle(titleEl.textContent.trim());
    if (!heb) return;
    const wrap = document.createElement("span");
    wrap.className = "bk-main";
    const line = document.createElement("span");
    line.className = "bk-hebrew";
    line.textContent = heb;
    titleEl.replaceWith(wrap);
    wrap.append(titleEl, line);
  }
  function augmentList(root) {
    root.querySelectorAll("button.list-button").forEach(augmentButton);
  }

  /* Reader heading: a gold line over the chapter title, following it. */
  let headingLine = null;
  function syncHeading() {
    const h = document.getElementById("chapter-title");
    if (!h || !headingLine) return;
    const title = titleFromHeading(h.textContent.trim());
    const heb = title ? nameForTitle(title) : null;
    headingLine.textContent = heb || "";
    headingLine.hidden = !heb;
  }

  function init() {
    const list = document.getElementById("book-list");
    if (list) {
      augmentList(list);
      new MutationObserver(() => augmentList(list)).observe(list, { childList: true, subtree: true });
    }
    const title = document.getElementById("chapter-title");
    if (title && title.parentElement) {
      headingLine = document.createElement("div");
      headingLine.className = "hebrew-book-line";
      headingLine.id = "hebrew-book-line";
      headingLine.hidden = true;
      title.parentElement.insertBefore(headingLine, title);
      new MutationObserver(syncHeading).observe(title, { childList: true, characterData: true, subtree: true });
      syncHeading();
    }
  }

  window.OustoryHebrew = { nameForTitle, titleFromHeading };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
