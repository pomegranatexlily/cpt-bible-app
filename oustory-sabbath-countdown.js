"use strict";
/* Oustory — holy-day countdown bar.
   A slim bar at the very top of the app counting down to the next holy day
   in the covenant reckoning, all from the app's published calendar
   (calendar/published.json):
   - Shabbat: lunar days 8, 15, 22, 29 of each month (months table rule).
   - New Moon: each month start (lunar day 1), plus published new_moon events.
   - Feasts: ONLY the feast events in the published events list, with their
     published titles. Draft track projections are never used, and no feast
     date is ever computed here.
   When a Sabbath and another holy day fall on the same date, the bar names
   both ("Sabbath + Purim (continued)"). When the next holy day falls the
   day after, the bar notes it briefly ("then New Moon Tue").
   Date-based: the app does not calculate sunset, so the count runs to the
   start of the holy day's date. The X dismisses the bar for this app
   session only (user ruling 2026-10-30): close the app and reopen it and
   the bar is back — it is "just always there". If the calendar can't be
   read, no bar is shown. */
(() => {
  const DISMISS_KEY = "oustory.sabbathCountdown.dismissedTarget";
  const SHABBAT_LUNAR_DAYS = [8, 15, 22, 29];
  const DAY_MS = 86400000;

  const parseISODate = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d); // local start of that calendar date
  };
  const isoOf = date =>
    date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
    "-" + String(date.getDate()).padStart(2, "0");
  // Calendar arithmetic via date setters, never +86400000ms: across a
  // fall-back boundary a day is 25 hours and ms math lands a day early.
  const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

  function shabbatDates(months) {
    const starts = months.map(m => m.date).filter(Boolean).sort();
    const out = [];
    for (let i = 0; i < starts.length; i++) {
      const start = parseISODate(starts[i]);
      const nextStart = starts[i + 1] ? parseISODate(starts[i + 1]) : addDays(start, 31);
      for (const lunarDay of SHABBAT_LUNAR_DAYS) {
        const d = addDays(start, lunarDay - 1);
        if (d < nextStart) out.push(d);
      }
    }
    return out;
  }

  /* Merge every holy day into one list keyed by date, so overlaps share a
     single entry with all their names. Name order: Sabbath, feasts, New Moon. */
  function holyDays(data) {
    const byDate = new Map();
    const add = (date, name, rank) => {
      const key = isoOf(date);
      if (!byDate.has(key)) byDate.set(key, { date, names: [] });
      const entry = byDate.get(key);
      if (!entry.names.some(n => n.name === name)) entry.names.push({ name, rank });
    };
    for (const d of shabbatDates(data.months || [])) add(d, "Sabbath", 0);
    for (const m of data.months || []) if (m.date) add(parseISODate(m.date), "New Moon", 2);
    for (const e of data.events || []) {
      if (!e.date) continue;
      if (e.kind === "new_moon") add(parseISODate(e.date), "New Moon", 2);
      else if (e.kind === "feast" && e.title) add(parseISODate(e.date), e.title, 1);
    }
    return [...byDate.values()]
      .map(e => ({ date: e.date, names: e.names.sort((a, b) => a.rank - b.rank).map(n => n.name) }))
      .sort((a, b) => a.date - b.date);
  }

  function fmtDiff(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hh = String(Math.floor(total % 86400 / 3600)).padStart(2, "0");
    const mm = String(Math.floor(total % 3600 / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return (days > 0 ? days + "d " : "") + hh + ":" + mm + ":" + ss;
  }
  const fmtDate = d => new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric"
  }).format(d);
  const fmtDay = d => new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);

  async function init() {
    const app = document.querySelector(".app");
    if (!app || document.querySelector(".sabbath-bar")) return;
    let data;
    try {
      const res = await fetch("calendar/published.json");
      if (!res.ok) return;
      data = await res.json();
    } catch { return; }
    const days = holyDays(data);
    if (!days.length) return;
    const byIso = new Map(days.map(e => [isoOf(e.date), e]));

    const bar = document.createElement("div");
    bar.className = "sabbath-bar";
    bar.setAttribute("role", "timer");
    bar.setAttribute("aria-label", "Countdown to the next holy day");
    const label = document.createElement("span");
    label.className = "sabbath-label";
    const clock = document.createElement("span");
    clock.className = "sabbath-clock";
    const when = document.createElement("span");
    when.className = "sabbath-when";
    const close = document.createElement("button");
    close.className = "sabbath-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss this countdown");
    close.textContent = "×";
    bar.append(label, clock, when, close);
    app.insertBefore(bar, app.firstChild);

    let target = null;
    let timer = null;
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function dismiss() {
      try { sessionStorage.setItem(DISMISS_KEY, isoOf(target.date)); } catch {}
      stop();
      bar.remove();
    }
    close.addEventListener("click", dismiss);

    function tick() {
      const now = new Date();
      const current = days.find(e => addDays(e.date, 1).getTime() > now.getTime());
      if (!current) { stop(); bar.remove(); return; }
      if (!target || current.date.getTime() !== target.date.getTime()) {
        target = current;
        let dismissed = null;
        try { dismissed = sessionStorage.getItem(DISMISS_KEY); } catch {}
        if (dismissed === isoOf(target.date)) { stop(); bar.remove(); return; }
        label.textContent = target.names.join(" + ");
        let whenText = fmtDate(target.date);
        const nextDay = byIso.get(isoOf(addDays(target.date, 1)));
        if (nextDay) whenText += " · then " + nextDay.names.join(" + ") + " " + fmtDay(nextDay.date);
        when.textContent = whenText;
        bar.setAttribute("aria-label", "Countdown to " + target.names.join(" and "));
      }
      const start = target.date.getTime();
      const end = addDays(target.date, 1).getTime();
      if (now.getTime() < start) {
        clock.textContent = fmtDiff(start - now.getTime());
        bar.classList.remove("is-today");
        label.textContent = target.names.join(" + ");
      } else {
        clock.textContent = fmtDiff(end - now.getTime());
        bar.classList.add("is-today");
        label.textContent = target.names.join(" + ") + " · today";
      }
    }
    tick();
    timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else void init();
})();
