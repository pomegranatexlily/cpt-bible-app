"use strict";
/* Oustory — Sabbath countdown bar.
   A slim bar at the very top of the app counting down to the next Shabbat
   by the covenant reckoning: Shabbat falls on lunar days
   8, 15, 22, 29 of each month in the app's published calendar
   (calendar/published.json months table). Date-based: the app does not
   calculate sunset, so the count runs to the start of the Shabbat date.
   The X dismisses the bar for that Shabbat cycle only; it returns for the
   next Shabbat. If the calendar can't be read, no bar is shown. */
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
    return out.sort((a, b) => a - b);
  }

  function nextShabbat(dates, now) {
    for (const d of dates) {
      if (addDays(d, 1).getTime() > now.getTime()) return d; // today counts until its date ends
    }
    return null;
  }

  function fmtDiff(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hh = String(Math.floor(total % 86400 / 3600)).padStart(2, "0");
    const mm = String(Math.floor(total % 3600 / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return (days > 0 ? days + "d " : "") + hh + ":" + mm + ":" + ss;
  }

  async function init() {
    const app = document.querySelector(".app");
    if (!app || document.querySelector(".sabbath-bar")) return;
    let data;
    try {
      const res = await fetch("calendar/published.json");
      if (!res.ok) return;
      data = await res.json();
    } catch { return; }
    const dates = shabbatDates(data.months || []);
    if (!dates.length) return;

    const bar = document.createElement("div");
    bar.className = "sabbath-bar";
    bar.setAttribute("role", "timer");
    bar.setAttribute("aria-label", "Countdown to Sabbath");
    const label = document.createElement("span");
    label.className = "sabbath-label";
    label.textContent = "Sabbath";
    const clock = document.createElement("span");
    clock.className = "sabbath-clock";
    const when = document.createElement("span");
    when.className = "sabbath-when";
    const close = document.createElement("button");
    close.className = "sabbath-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss the Sabbath countdown");
    close.textContent = "×";
    bar.append(label, clock, when, close);
    app.insertBefore(bar, app.firstChild);

    let target = null;
    let timer = null;
    function dismiss() {
      try { localStorage.setItem(DISMISS_KEY, isoOf(target)); } catch {}
      stop();
      bar.remove();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    close.addEventListener("click", dismiss);

    function tick() {
      const now = new Date();
      const current = nextShabbat(dates, now);
      if (!current) { stop(); bar.remove(); return; }
      if (!target || current.getTime() !== target.getTime()) {
        target = current;
        let dismissed = null;
        try { dismissed = localStorage.getItem(DISMISS_KEY); } catch {}
        if (dismissed === isoOf(target)) { stop(); bar.remove(); return; }
        when.textContent = new Intl.DateTimeFormat("en-US", {
          weekday: "short", month: "short", day: "numeric"
        }).format(target);
      }
      const start = target.getTime();
      const end = addDays(target, 1).getTime();
      if (now.getTime() < start) {
        label.textContent = "Sabbath";
        clock.textContent = fmtDiff(start - now.getTime());
        bar.classList.remove("is-today");
      } else {
        label.textContent = "Sabbath · today";
        clock.textContent = fmtDiff(end - now.getTime());
        bar.classList.add("is-today");
      }
    }
    tick();
    timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else void init();
})();
