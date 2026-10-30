"use strict";
/* Oustory — the Shabbat surface.
   The mockup crossed into the live app (user order 2026-10-30). Home gets
   a card under the Moon: the count at a glance — which lunar day this is,
   the month's moon strip with Sabbaths in gold, and how far the next
   Shabbat is. Opening it gives the full surface: the day's state
   (ordinary / preparation / Shabbat), the month grid, the reckoning
   beside the Saturday sticker, and the holy-day guides — the verses that
   explain each day and how it is kept, shown for the days the published
   calendar itself names.
   Rulings carried from the mockup: on Shabbat the Study and Discover
   tabs are QUIETED, never locked; the preparation list is a FIXED list.
   Data: calendar/published.json only — Shabbat by the lunar 8/15/22/29
   rule, New Moons at month starts, feasts only from the published events
   list under published titles. No feast date is ever computed. Sunset is
   shown only when the device itself gives a location to compute it from;
   otherwise the day is named by its sunset boundary without a time. */
(() => {
  const SHABBAT_DAYS = [8, 15, 22, 29];
  const PREP_DAYS = [7, 14, 21, 28];
  const PREP_LIST = [
    "Prepare food for the Shabbat — no cooking tomorrow",
    "Finish the week's work and lay it down",
    "Gather the household; set the table",
    "Open the readings for the morning",
    "Let the house be still before the light goes"
  ];
  const SHABBAT_READINGS = [
    { ref: "Exodus 20", book: "Exodus", chapter: 20, note: "The command itself — remember the Shabath day." },
    { ref: "Psalm 92", book: "Psalms", chapter: 92, note: "A song for the Shabath day." },
    { ref: "Isaiah 58", book: "Isaiah", chapter: 58, note: "Call the Shabath a delight." }
  ];

  const parseISODate = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const isoOf = date =>
    date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
    "-" + String(date.getDate()).padStart(2, "0");
  const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  // Day differences via UTC components — exact across DST boundaries.
  const dayDiff = (a, b) =>
    Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  const fmtDate = d => new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric"
  }).format(d);
  const fmtLong = d => new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric"
  }).format(d);

  let dataPromise = null;
  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch("calendar/published.json")
        .then(res => (res.ok ? res.json() : null))
        .catch(() => null);
    }
    return dataPromise;
  }

  function monthInfo(data, date) {
    const starts = (data.months || []).map(m => m.date).filter(Boolean).sort();
    let idx = -1;
    for (let i = 0; i < starts.length; i++) {
      if (parseISODate(starts[i]).getTime() <= new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) idx = i;
      else break;
    }
    if (idx < 0) return null;
    const start = parseISODate(starts[idx]);
    const next = starts[idx + 1] ? parseISODate(starts[idx + 1]) : null;
    return {
      start,
      next,
      lunarDay: dayDiff(start, date) + 1,
      length: next ? dayDiff(start, next) : null,
      isFirst: idx === 0
    };
  }

  function stateFor(lunarDay) {
    if (SHABBAT_DAYS.includes(lunarDay)) return "shabbat";
    if (PREP_DAYS.includes(lunarDay)) return "prep";
    return "ordinary";
  }

  /* Every holy day by date, named as the calendar publishes it — the
     same merge the countdown bar uses. */
  function holyDays(data) {
    const byDate = new Map();
    const add = (date, name, rank) => {
      const key = isoOf(date);
      if (!byDate.has(key)) byDate.set(key, { date, names: [] });
      const entry = byDate.get(key);
      if (!entry.names.some(n => n.name === name)) entry.names.push({ name, rank });
    };
    for (const m of data.months || []) {
      if (!m.date) continue;
      const start = parseISODate(m.date);
      add(start, "New Moon", 2);
      for (const ld of SHABBAT_DAYS) add(addDays(start, ld - 1), "Sabbath", 0);
    }
    for (const e of data.events || []) {
      if (!e.date || e.kind === "sabbath") continue;
      if (e.kind === "new_moon") add(parseISODate(e.date), "New Moon", 2);
      else if (e.kind === "feast" && e.title) add(parseISODate(e.date), e.title, 1);
    }
    return [...byDate.values()]
      .map(e => ({ date: e.date, names: e.names.sort((a, b) => a.rank - b.rank).map(n => n.name) }))
      .sort((a, b) => a.date - b.date);
  }

  function nextShabbat(data, from) {
    const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (const m of data.months || []) {
      if (!m.date) continue;
      const start = parseISODate(m.date);
      for (const ld of SHABBAT_DAYS) {
        const d = addDays(start, ld - 1);
        if (d.getTime() >= today.getTime()) return d;
      }
    }
    return null;
  }

  /* Sunset from the device's own location (NOAA algorithm). Returns a
     local Date or null — never an invented time. */
  function sunsetFor(date, lat, lng) {
    try {
      const rad = Math.PI / 180;
      const N = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
        Date.UTC(date.getFullYear(), 0, 0)) / 86400000);
      const lngHour = lng / 15;
      const t = N + (18 - lngHour) / 24;
      const M = 0.9856 * t - 3.289;
      let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
      L = ((L % 360) + 360) % 360;
      let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
      RA = ((RA % 360) + 360) % 360;
      RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
      RA /= 15;
      const sinDec = 0.39782 * Math.sin(L * rad);
      const cosDec = Math.cos(Math.asin(sinDec));
      const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) /
        (cosDec * Math.cos(lat * rad));
      if (cosH > 1 || cosH < -1) return null;
      const H = Math.acos(cosH) / rad / 15;
      const T = H + RA - 0.06571 * t - 6.622;
      let UT = T - lngHour;
      UT = ((UT % 24) + 24) % 24;
      const out = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      out.setUTCHours(Math.floor(UT), Math.round((UT % 1) * 60), 0, 0);
      return out;
    } catch { return null; }
  }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let host = null;
  let jumpFn = null;
  let overlay = null;

  function buildStrip(info, today) {
    const strip = el("div", "shab-strip");
    strip.setAttribute("role", "img");
    const len = info.length || 30;
    strip.setAttribute("aria-label",
      "This month: day " + info.lunarDay + " of " + len + ". Sabbaths on 8, 15, 22, 29.");
    for (let d = 1; d <= len; d++) {
      const cell = el("i", "shab-cell");
      if (d === 1) cell.classList.add("is-newmoon");
      if (PREP_DAYS.includes(d)) cell.classList.add("is-prep");
      if (SHABBAT_DAYS.includes(d)) cell.classList.add("is-shab");
      const cellDate = addDays(info.start, d - 1);
      if (isoOf(cellDate) === isoOf(today)) cell.classList.add("is-today");
      if (SHABBAT_DAYS.includes(d)) cell.append(el("span", null, String(d)));
      strip.append(cell);
    }
    return strip;
  }

  async function mount(hostEl, jump) {
    host = hostEl;
    jumpFn = typeof jump === "function" ? jump : null;
    host.append(el("p", "shab-status", "Reading the count from your calendar…"));
    const data = await loadData();
    if (!host.isConnected) return;
    host.replaceChildren();
    if (!data) {
      host.append(el("p", "shab-status", "The calendar could not be read on this device."));
      return;
    }
    const now = new Date();
    const info = monthInfo(data, now);
    if (!info) {
      host.append(el("p", "shab-status", "Today is outside the published calendar."));
      return;
    }
    const state = stateFor(info.lunarDay);
    const shab = nextShabbat(data, now);
    const daysTo = shab ? dayDiff(new Date(now.getFullYear(), now.getMonth(), now.getDate()), shab) : null;

    const eyebrow = el("p", "shab-eyebrow");
    const title = el("h3", "shab-title");
    const sub = el("p", "shab-sub");
    if (state === "shabbat") {
      eyebrow.textContent = "Shabbat · Day of Rest";
      title.textContent = "Rest";
      sub.textContent = "Lunar day " + info.lunarDay + " — the seventh day from the new moon. Study and Discover are quieted today; the readings carry the day.";
    } else if (state === "prep") {
      eyebrow.textContent = "Preparation Day";
      title.textContent = "Make Ready";
      sub.textContent = "Lunar day " + info.lunarDay + ". The Shabbat begins at sunset — finish the week's work and let the house be still before the light goes.";
    } else {
      eyebrow.textContent = "Ordinary Day · Lunar Day " + info.lunarDay;
      title.textContent = daysTo === 1 ? "Shabbat tomorrow" :
        daysTo != null ? "Shabbat in " + daysTo + " days" : "The count is running";
      sub.textContent = "The count is already running" +
        (shab ? " — the next Shabbat is " + fmtDate(shab) : "") +
        ", and preparation comes the day before it.";
    }
    host.append(eyebrow, title, sub);
    host.append(buildStrip(info, now));
    host.append(el("p", "shab-strip-cap",
      "Gold days are Sabbaths — 8 · 15 · 22 · 29. The day before each one is preparation."));

    const days = holyDays(data);
    const byIso = new Map(days.map(e => [isoOf(e.date), e]));
    const todayEntry = byIso.get(isoOf(now));
    const guides = window.OustoryGuides;
    if (todayEntry && guides) {
      const g = guides.guideForNames(todayEntry.names);
      if (g) {
        const note = el("div", "shab-today-guide");
        note.append(el("p", "shab-eyebrow", "Today · " + todayEntry.names.join(" + ")));
        note.append(el("p", "shab-sub", g.intro));
        const btn = el("button", "shab-open-btn", "How this day is kept");
        btn.type = "button";
        btn.addEventListener("click", () => openOverlay(g.id));
        note.append(btn);
        host.append(note);
      }
    }

    const open = el("button", "shab-open-btn", "Open the Shabbat surface");
    open.type = "button";
    open.addEventListener("click", () => openOverlay(null));
    host.append(open);
    host._shabbatData = data;
  }

  function unmount() {
    closeOverlay();
    host = null;
  }

  function verseRow(v) {
    const row = el("div", "shab-read-row");
    const left = el("div");
    left.append(el("b", null, v.ref));
    left.append(el("small", null, v.note));
    row.append(left);
    if (jumpFn) {
      const b = el("button", "shab-read-btn", "Read");
      b.type = "button";
      b.setAttribute("aria-label", "Read " + v.ref + " in the Bible");
      b.addEventListener("click", () => { closeOverlay(); jumpFn(v.book, v.chapter, 1); });
      row.append(b);
    }
    return row;
  }

  function renderGuide(g, container) {
    const box = el("section", "shab-guide");
    box.append(el("h4", "shab-guide-title", g.title));
    box.append(el("p", "shab-sub", g.intro));
    const vh = el("p", "shab-eyebrow", "The verses that explain it");
    box.append(vh);
    for (const v of g.verses) box.append(verseRow(v));
    box.append(el("p", "shab-eyebrow", "How the day is kept"));
    const ul = el("ul", "shab-kept");
    for (const k of g.kept) ul.append(el("li", null, k));
    box.append(ul);
    for (const r of g.recipes || []) {
      box.append(el("p", "shab-eyebrow", r.title));
      const rul = el("ul", "shab-kept");
      for (const line of r.lines) rul.append(el("li", null, line));
      box.append(rul);
    }
    container.append(box);
    return box;
  }

  function openOverlay(guideId) {
    closeOverlay();
    const data = host && host._shabbatData;
    if (!data) return;
    const now = new Date();
    const info = monthInfo(data, now);
    if (!info) return;
    const state = stateFor(info.lunarDay);
    const days = holyDays(data);
    const byIso = new Map(days.map(e => [isoOf(e.date), e]));

    overlay = el("div", "shab-overlay");
    if (state === "prep") overlay.classList.add("is-prep");
    if (state === "shabbat") overlay.classList.add("is-shabbat");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "The Shabbat surface");

    const head = el("div", "shab-ov-head");
    const headText = el("div");
    headText.append(el("p", "shab-eyebrow",
      (state === "shabbat" ? "Shabbat · Day of Rest" :
       state === "prep" ? "Preparation Day" : "The Count") + " · " + fmtLong(now)));
    const h = el("h2", "shab-ov-title",
      state === "shabbat" ? "Rest" : state === "prep" ? "Make Ready" : "Kept by the Moon");
    headText.append(h);
    headText.append(el("p", "shab-heb", "SHABATH"));
    head.append(headText);
    const close = el("button", "shab-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close the Shabbat surface");
    close.addEventListener("click", closeOverlay);
    head.append(close);
    overlay.append(head);

    const body = el("div", "shab-ov-body");

    // State card
    const cardBox = el("section", "shab-card");
    if (state === "prep") {
      cardBox.append(el("h3", "shab-card-h", "Make ready before sunset"));
      const sunsetLine = el("p", "shab-sub", "The Shabbat begins at sunset.");
      cardBox.append(sunsetLine);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const s = sunsetFor(now, pos.coords.latitude, pos.coords.longitude);
          if (s && sunsetLine.isConnected) {
            sunsetLine.textContent = "The Shabbat begins at sunset · " +
              new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(s) +
              " where you are.";
          }
        }, () => {}, { timeout: 4000, maximumAge: 600000 });
      }
      const ul = el("ul", "shab-prep-list");
      for (const item of PREP_LIST) ul.append(el("li", null, item));
      cardBox.append(ul);
    } else if (state === "shabbat") {
      cardBox.append(el("h3", "shab-card-h", "Readings for the Shabbat"));
      for (const r of SHABBAT_READINGS) cardBox.append(verseRow(r));
      cardBox.append(el("p", "shab-quiet",
        "Study and Discover are quieted today — not locked. They return when the day ends at sunset."));
    } else {
      const shab = nextShabbat(data, now);
      cardBox.append(el("h3", "shab-card-h", "Looking ahead"));
      cardBox.append(el("p", "shab-sub",
        shab ? "The next Shabbat is " + fmtLong(shab) + ", with preparation the day before. Work the day in front of you — the count is already running."
             : "The count is running."));
      cardBox.append(verseRow(SHABBAT_READINGS[0]));
    }
    body.append(cardBox);

    // Today's guide, when today is a named holy day with a guide
    const guides = window.OustoryGuides;
    const todayEntry = byIso.get(isoOf(now));
    let todayGuide = null;
    if (todayEntry && guides) todayGuide = guides.guideForNames(todayEntry.names);
    if (todayGuide && todayGuide.id !== "sabbath") {
      body.append(el("h3", "shab-sec-h", "Today · " + todayEntry.names.join(" + ")));
      renderGuide(todayGuide, body);
    }

    // Coming up: the next named day that carries a guide
    if (guides) {
      const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const upcoming = days.find(e => e.date.getTime() > today0.getTime() && guides.guideForNames(e.names));
      if (upcoming) {
        const up = el("section", "shab-card");
        up.append(el("h3", "shab-card-h", "Coming up · " + upcoming.names.join(" + ")));
        up.append(el("p", "shab-sub", fmtLong(upcoming.date) + " — " + guides.guideForNames(upcoming.names).intro));
        const b = el("button", "shab-open-btn", "See how it is kept");
        b.type = "button";
        b.addEventListener("click", () => {
          const target = overlay.querySelector('[data-guide="' + guides.guideForNames(upcoming.names).id + '"]');
          if (target) { target.hidden = false; target.scrollIntoView?.({ block: "start" }); }
        });
        up.append(b);
        body.append(up);
      }
    }

    // Moon strip + month grid
    body.append(el("h3", "shab-sec-h", "This month, reckoned by the moon"));
    body.append(buildStrip(info, now));
    const grid = el("div", "shab-grid");
    const detail = el("p", "shab-day-detail");
    const len = info.length || 30;
    const nameDay = d => {
      const date = addDays(info.start, d - 1);
      const entry = byIso.get(isoOf(date));
      if (entry) return entry.names.join(" + ");
      if (PREP_DAYS.includes(d)) return "Preparation";
      return "Ordinary day";
    };
    const setDetail = d => {
      const date = addDays(info.start, d - 1);
      detail.textContent = "Day " + d + " · " + fmtDate(date) + " — " + nameDay(d) + ".";
      grid.querySelectorAll(".shab-day").forEach(c =>
        c.classList.toggle("is-sel", Number(c.dataset.day) === d));
    };
    for (let d = 1; d <= len; d++) {
      const cell = el("button", "shab-day");
      cell.type = "button";
      cell.dataset.day = String(d);
      if (d === 1) cell.classList.add("is-newmoon");
      if (PREP_DAYS.includes(d)) cell.classList.add("is-prep");
      if (SHABBAT_DAYS.includes(d)) cell.classList.add("is-shab");
      const date = addDays(info.start, d - 1);
      if (isoOf(date) === isoOf(now)) cell.classList.add("is-today");
      cell.append(el("b", null, String(d)));
      cell.append(el("small", null, nameDay(d)));
      cell.addEventListener("click", () => setDetail(d));
      grid.append(cell);
    }
    body.append(grid);
    body.append(detail);
    setDetail(info.lunarDay);

    // The reckoning beside the sticker
    const vs = el("section", "shab-vs");
    const theirs = el("div", "shab-vs-side");
    theirs.append(el("h4", null, "Theirs"));
    theirs.append(el("p", "shab-vs-big", "Every Saturday"));
    theirs.append(el("p", "shab-sub", "A weekday sticker. The same label on the same Gregorian day, forever — no moon, no count, no preparation."));
    const yours = el("div", "shab-vs-side is-yours");
    yours.append(el("h4", null, "Yours"));
    yours.append(el("p", "shab-vs-big", "8 · 15 · 22 · 29"));
    yours.append(el("p", "shab-sub", "The seventh day from the new moon, every month. Preparation the day before. Feasts and new moons in the same reckoning."));
    vs.append(theirs, yours);
    body.append(vs);

    // Guides library — every holy day, its verses, how it is kept
    if (guides) {
      body.append(el("h3", "shab-sec-h", "The holy days — how they are kept"));
      body.append(el("p", "shab-sub",
        "Each guide opens on the day itself when the calendar presents it. Until then, the whole library stands here — the verses that explain each day, and the keeping of it."));
      for (const g of guides.list) {
        const wrap = el("div", "shab-guide-wrap");
        wrap.dataset.guide = g.id;
        const toggle = el("button", "shab-guide-toggle", g.title);
        toggle.type = "button";
        const holder = el("div");
        holder.hidden = true;
        renderGuide(g, holder);
        toggle.addEventListener("click", () => { holder.hidden = !holder.hidden; });
        wrap.append(toggle, holder);
        wrap.hidden = false;
        body.append(wrap);
        if (guideId && g.id === guideId) holder.hidden = false;
      }
    }

    overlay.append(body);
    document.body.append(overlay);
    document.body.classList.add("shab-overlay-open");
    if (guideId) {
      const target = overlay.querySelector('[data-guide="' + guideId + '"]');
      if (target) target.scrollIntoView?.({ block: "start" });
    }
  }

  function closeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.body.classList.remove("shab-overlay-open");
  }

  window.OustoryShabbat = { mount, unmount };

  // The rest state belongs to the whole app on Shabbat, not just Home:
  // quiet Study and Discover from the moment the app opens.
  void loadData().then(data => {
    if (!data) return;
    const info = monthInfo(data, new Date());
    if (info && stateFor(info.lunarDay) === "shabbat") {
      document.body.classList.add("shabbat-rest");
    }
  });
})();
