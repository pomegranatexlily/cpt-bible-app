"use strict";
/* Oustory Moon — the home-page moon for the Covenant Bible app.
   One computed "tonight" state (Central time, America/Chicago) drives every
   number on the card, the light on the sphere, and the moon in the Earth
   view, so no panel can disagree with another. Ephemeris: mean-synodic age
   from the 2000-01-06 new-moon epoch; apparent solar longitude; elongation
   is the true Moon-Sun separation (<=180 deg), E waxing / W waning.
   Distances are low-precision approximations and are labeled as such.
   Views: Home (tonight, still, framed with room to breathe), Spin,
   Cinematic (letterboxed dolly), Earth (a full Three.js night yard —
   grass in the wind, house, fence, trees, fireflies — the app disappears).
   v2 (2026-10-30): camera pulled back, exposure fixed, deep-space depth,
   Earth view rebuilt as a real 3D yard. */
(() => {
  const SYNODIC = 29.530588853;
  const EPOCH = Date.UTC(2000, 0, 6, 18, 14);
  const J2000 = Date.UTC(2000, 0, 1, 12);
  const D2R = Math.PI / 180;
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra",
    "Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const PHASES = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous",
    "Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"];

  function chicagoToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago", year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(new Date());
    const got = {};
    for (const p of parts) got[p.type] = Number(p.value);
    return got;
  }

  function tonightState() {
    const t = chicagoToday();
    const ref = Date.UTC(t.year, t.month - 1, t.day, 12); // fixed noon-UTC reference: stable all day
    let age = ((ref - EPOCH) / 86400000) % SYNODIC;
    if (age < 0) age += SYNODIC;
    const frac = age / SYNODIC;
    const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    const n = (ref - J2000) / 86400000;
    const meanLon = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * D2R;
    let sunLon = (meanLon + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360;
    if (sunLon < 0) sunLon += 360;
    const sunAngle = frac * 360;
    const moonLon = (sunLon + sunAngle) % 360;
    const delta = ((moonLon - sunLon) % 360 + 360) % 360;
    const elong = delta <= 180 ? delta : 360 - delta;
    const elongDir = frac <= 0.5 ? "E" : "W";
    const phaseAngle = 180 - elong;
    const M = ((134.963 + 13.064993 * n) % 360) * D2R;
    const D = ((297.850 + 12.190749 * n) % 360) * D2R;
    const dist = Math.round(385001 - 20905 * Math.cos(M) - 3700 * Math.cos(2 * D - M) - 2956 * Math.cos(2 * D));
    const angMin = 2 * Math.atan(1737.4 / dist) / D2R * 60;
    const phaseIdx = Math.floor(frac * 8 + 0.5) % 8;
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", year: "numeric"
    }).format(new Date());
    return { age, frac, illum, sunLon, moonLon, sunAngle, elong, elongDir,
      phaseAngle, dist, angMin, phase: PHASES[phaseIdx],
      sign: SIGNS[Math.floor(moonLon / 30)], signDeg: moonLon % 30, dateLabel,
      isoDay: t.year + "-" + String(t.month).padStart(2, "0") + "-" + String(t.day).padStart(2, "0") };
  }
  const sunVector = f => [Math.sin(2 * Math.PI * f), 0, -Math.cos(2 * Math.PI * f)];

  /* The same ephemeris for any Gregorian date (noon-UTC reference): age,
     phase fraction, illumination, phase name. Drives the Moon page's
     night-by-night month grid, so every night's disc agrees with tonight's
     math. */
  function stateForDate(isoDay) {
    const ref = Date.parse(isoDay + "T12:00:00Z");
    if (!Number.isFinite(ref)) return null;
    let age = ((ref - EPOCH) / 86400000) % SYNODIC;
    if (age < 0) age += SYNODIC;
    const frac = age / SYNODIC;
    const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    const phaseIdx = Math.floor(frac * 8 + 0.5) % 8;
    return { age, frac, illum, phase: PHASES[phaseIdx] };
  }

  async function loadCalendarData() {
    try {
      const res = await fetch("calendar/published.json");
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  /* Covenant reckoning from the app's own published calendar months table:
     lunar day counts from the month start; Shabbat falls on lunar days
     8, 15, 22, 29. Feast dates are never derived here. */
  async function covenantLine(state) {
    try {
      const res = await fetch("calendar/published.json");
      if (!res.ok) return null;
      const data = await res.json();
      const starts = (data.months || []).map(m => m.date).sort();
      if (!starts.length) return null;
      const today = state.isoDay;
      let idx = -1;
      for (let i = 0; i < starts.length; i++) if (starts[i] <= today) idx = i;
      if (idx < 0) return null;
      const start = starts[idx];
      const dayMs = 86400000;
      const lunarDay = Math.round((Date.parse(today) - Date.parse(start)) / dayMs) + 1;
      let next = null;
      for (const sd of [8, 15, 22, 29]) {
        if (sd >= lunarDay) { next = new Date(Date.parse(start) + (sd - 1) * dayMs); break; }
      }
      if (!next && starts[idx + 1]) next = new Date(Date.parse(starts[idx + 1]) + 7 * dayMs);
      const fmt = d => new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC", weekday: "short", month: "short", day: "numeric"
      }).format(d);
      return "Lunar day " + lunarDay + (next ? " · Next Shabbat " + fmt(next) : "") +
        " · Shabbat on lunar days 8 · 15 · 22 · 29";
    } catch { return null; }
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function moonTexture(w, h) {
    w = w || 1024; h = h || 512;
    const S = w / 1024; // detail scale, so a 2048 texture is finer, not just bigger
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d");
    const grad = x.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#a8a296"); grad.addColorStop(0.5, "#9d978a"); grad.addColorStop(1, "#a39d90");
    x.fillStyle = grad; x.fillRect(0, 0, w, h);
    const rnd = mulberry32(20261029);
    for (let i = 0; i < 38; i++) { // maria: deep basalt, real contrast
      const cx = rnd() * w, cy = h * 0.16 + rnd() * h * 0.68;
      const r = (26 + rnd() * 96) * S;
      const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, "rgba(56,54,50,0.66)");
      g.addColorStop(0.7, "rgba(64,62,58,0.34)");
      g.addColorStop(1, "rgba(64,62,58,0)");
      x.fillStyle = g;
      x.beginPath(); x.ellipse(cx, cy, r * (0.7 + rnd() * 0.7), r * (0.5 + rnd() * 0.5), rnd() * 3.2, 0, 6.3); x.fill();
    }
    for (let i = 0; i < 2600; i++) { // grain
      const cx = rnd() * w, cy = rnd() * h, r = (0.5 + rnd() * 2.2) * S;
      x.fillStyle = rnd() > 0.5 ? "rgba(52,50,47,0.22)" : "rgba(226,221,208,0.13)";
      x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
    }
    for (let i = 0; i < 8; i++) { // bright ray craters
      const cx = rnd() * w, cy = rnd() * h;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, (9 + rnd() * 15) * S);
      g.addColorStop(0, "rgba(238,234,222,0.55)"); g.addColorStop(1, "rgba(238,234,222,0)");
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 26 * S, 0, 6.3); x.fill();
    }
    return c;
  }

  /* Soft round sprite for points (stars, fireflies): without it, WebGL
     points render as hard squares — the blocky look in the yard sky. */
  function dotTexture() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  }

  function glowTexture(inner, outer) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, inner); g.addColorStop(0.4, outer); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return c;
  }

  function grassTexture() {
    const s = 512;
    const c = document.createElement("canvas"); c.width = s; c.height = s;
    const x = c.getContext("2d");
    x.fillStyle = "#0b1208"; x.fillRect(0, 0, s, s);
    const rnd = mulberry32(97);
    // Closer greens + finer strokes: the ground reads as lawn at night,
    // not camouflage speckle.
    for (let i = 0; i < 15000; i++) {
      const gx = rnd() * s, gy = rnd() * s, len = 2 + rnd() * 4;
      const greens = ["#141f0d", "#182612", "#1c2c14", "#111a0a", "#16220f"];
      x.strokeStyle = greens[Math.floor(rnd() * greens.length)];
      x.globalAlpha = 0.6;
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (rnd() - 0.5) * 1.4, gy - len); x.stroke();
    }
    x.globalAlpha = 1;
    return c;
  }

  /* 2D fallback disc (no WebGL): per-pixel sphere shading with the same sun
     vector as the 3D scene, so the phase can never disagree. */
  function drawDisc(canvas, state, textureCanvas) {
    const s = canvas.width, r = s / 2;
    const x = canvas.getContext("2d");
    const img = x.createImageData(s, s);
    const tex = textureCanvas.getContext("2d").getImageData(0, 0, textureCanvas.width, textureCanvas.height).data;
    const tw = textureCanvas.width, th = textureCanvas.height;
    const sun = sunVector(state.frac);
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        const dx = (px - r + 0.5) / r, dy = (r - py - 0.5) / r;
        const d2 = dx * dx + dy * dy, o = (py * s + px) * 4;
        if (d2 > 1) { img.data[o + 3] = 0; continue; }
        const dz = Math.sqrt(1 - d2);
        const u = Math.atan2(dx, dz) / (2 * Math.PI) + 0.5;
        const v = 0.5 - Math.asin(dy) / Math.PI;
        const tx = Math.min(tw - 1, Math.floor(u * tw)), ty = Math.min(th - 1, Math.floor(v * th));
        const to = (ty * tw + tx) * 4;
        const lit = Math.max(0, dx * sun[0] + dz * sun[2]);
        const shade = 0.10 + 0.95 * lit;
        img.data[o] = tex[to] * shade;
        img.data[o + 1] = tex[to + 1] * shade;
        img.data[o + 2] = tex[to + 2] * shade;
        img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  }

  let active = null;
  function unmount() {
    if (active) { try { active.destroy(); } catch {} active = null; }
  }

  function mount(card) {
    unmount();
    const state = tonightState();
    const texCanvas = moonTexture(2048, 1024);
    const el = (tag, text, cls) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      if (cls) n.className = cls;
      return n;
    };
    const THREE = window.THREE;

    const stage = el("div", undefined, "moon-stage");
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", "The Moon tonight: " + state.phase + ", " +
      Math.round(state.illum * 100) + "% lit");
    card.append(stage);

    const rows = [
      ["Phase", state.phase],
      ["Illumination", Math.round(state.illum * 100) + "% lit"],
      ["Moon age", state.age.toFixed(1) + " days"],
      ["Moon in", state.sign + " " + Math.floor(state.signDeg) + "°"],
      ["Elongation", Math.round(state.elong) + "° " + state.elongDir + " of the Sun"],
      ["Sun angle", Math.round(state.sunAngle) + "° from new moon"],
      ["Distance", "≈ " + state.dist.toLocaleString("en-US") + " km"],
      ["Angular size", "≈ " + state.angMin.toFixed(1) + "′"]
    ];
    const table = el("div", undefined, "moon-rows");
    for (const [k, v] of rows) {
      const row = el("div", undefined, "moon-row");
      row.append(el("span", k, "moon-key"), el("span", v, "moon-val"));
      table.append(row);
    }
    card.append(table);
    const cov = el("p", "Counting the covenant month…", "moon-covenant");
    card.append(cov);
    void covenantLine(state).then(line => { if (line) cov.textContent = line; else cov.remove(); });
    card.append(el("p", "Tonight · Central Time · " + state.dateLabel, "moon-stamp"));

    const switcher = el("div", undefined, "moon-switch");
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Moon views");
    const buttons = {};
    let mode = "home";
    for (const [name, label] of [["home", "Home"], ["spin", "Spin"], ["cinema", "Cinematic"], ["earth", "Earth"]]) {
      const b = el("button", label, "moon-view-btn");
      b.type = "button";
      if (name === "home") b.classList.add("is-active");
      b.onclick = () => {
        if (name === "earth") { openEarth(); return; }
        mode = name;
        stage.classList.toggle("moon-letterbox", name === "cinema");
        for (const k in buttons) buttons[k].classList.toggle("is-active", k === name);
      };
      buttons[name] = b;
      switcher.append(b);
    }
    card.append(switcher);

    /* ---------- The Moon page: the full surface behind the card ---------- */
    let page = null;
    function closeMoonPage() {
      if (!page) return;
      page.remove();
      page = null;
      document.body.classList.remove("moonpage-open");
    }
    const openBtn = el("button", "Open the Moon page", "moon-open-btn");
    openBtn.type = "button";
    openBtn.onclick = () => { void openMoonPage(); };
    card.append(openBtn);

    async function openMoonPage() {
      if (page) return;
      const overlay = el("div", undefined, "moonpage");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-label", "The Moon page");
      const head = el("div", undefined, "moonpage-head");
      head.append(el("p", "THE MOON · " + state.dateLabel.toUpperCase(), "moonpage-eyebrow"));
      head.append(el("h2", state.phase, "moonpage-title"));
      const close = el("button", "×", "moonpage-close");
      close.type = "button";
      close.setAttribute("aria-label", "Close the Moon page");
      close.onclick = closeMoonPage;
      head.append(close);
      overlay.append(head);
      document.body.append(overlay);
      document.body.classList.add("moonpage-open");
      page = overlay;
      overlay.scrollTop = 0;

      const bigWrap = el("div", undefined, "moonpage-disc-wrap");
      const big = el("canvas", undefined, "moonpage-disc");
      big.width = 560; big.height = 560;
      drawDisc(big, state, texCanvas);
      bigWrap.append(big);
      overlay.append(bigWrap);
      overlay.append(el("p",
        "Tonight — " + Math.round(state.illum * 100) + "% lit · " +
        state.age.toFixed(1) + " days from the new moon · " + state.sign + " " +
        Math.floor(state.signDeg) + "°", "moonpage-caption"));

      const cal = await loadCalendarData();
      if (!page) return; // closed while the calendar loaded

      const DAY = 86400000;
      const fmtD = ms => new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC", weekday: "short", month: "short", day: "numeric"
      }).format(new Date(ms));
      const todayMs = Date.parse(state.isoDay + "T12:00:00Z");

      // The month, night by night — every disc from the same ephemeris.
      const starts = cal ? (cal.months || []).map(m => m.date).sort() : [];
      let idx = -1;
      for (let i = 0; i < starts.length; i++) if (starts[i] <= state.isoDay) idx = i;
      if (idx >= 0) {
        const startMs = Date.parse(starts[idx] + "T12:00:00Z");
        const len = starts[idx + 1]
          ? Math.round((Date.parse(starts[idx + 1]) - Date.parse(starts[idx])) / DAY) : 30;
        const lunarToday = Math.round((todayMs - startMs) / DAY) + 1;
        const block = el("div", undefined, "moonpage-block");
        block.append(el("h3", "This month, night by night", "moonpage-block-title"));
        const detail = el("p", "", "mp-detail");
        const grid = el("div", undefined, "mp-grid");
        const kindOf = d => d === 1 ? "New Moon"
          : [8, 15, 22, 29].includes(d) ? "Shabbat"
          : [7, 14, 21, 28].includes(d) ? "Preparation" : "Ordinary day";
        const describe = d => {
          const ms = startMs + (d - 1) * DAY;
          const iso = new Date(ms).toISOString().slice(0, 10);
          const st = stateForDate(iso);
          detail.textContent = "Day " + d + " · " + fmtD(ms) + " — " + kindOf(d) +
            (st ? " · " + st.phase + " · " + Math.round(st.illum * 100) + "% lit" : "");
        };
        for (let d = 1; d <= len; d++) {
          const ms = startMs + (d - 1) * DAY;
          const iso = new Date(ms).toISOString().slice(0, 10);
          const st = stateForDate(iso);
          const cell = el("button", undefined, "mp-cell");
          cell.type = "button";
          if ([8, 15, 22, 29].includes(d)) cell.classList.add("is-shabbat");
          if ([7, 14, 21, 28].includes(d)) cell.classList.add("is-prep");
          if (d === lunarToday) cell.classList.add("is-today");
          if (d < lunarToday) cell.classList.add("is-past");
          const cv = el("canvas", undefined, "mp-disc");
          cv.width = 96; cv.height = 96;
          if (st) drawDisc(cv, st, texCanvas);
          cell.append(cv);
          cell.append(el("span", String(d), "mp-day"));
          cell.append(el("span",
            d === 1 ? "NEW MOON" : [8, 15, 22, 29].includes(d) ? "SHABBAT"
            : [7, 14, 21, 28].includes(d) ? "PREP" : "", "mp-kind"));
          cell.setAttribute("aria-label", "Lunar day " + d + ", " + kindOf(d));
          cell.onclick = () => describe(d);
          grid.append(cell);
        }
        block.append(grid);
        block.append(el("p",
          "Gold rings are Shabbaths — 8 · 15 · 22 · 29. The day before each one is preparation. Tap a night for its phase.",
          "moonpage-caption"));
        block.append(detail);
        overlay.append(block);
        describe(lunarToday);
      }

      // The road ahead — new moon, full moon, Shabbat, from the same math.
      const road = el("div", undefined, "moonpage-block");
      road.append(el("h3", "The road ahead", "moonpage-block-title"));
      const roadRows = el("div", undefined, "moon-rows");
      const toNew = Math.max(0, Math.round(SYNODIC - state.age));
      const toFull = state.frac < 0.5
        ? Math.round((0.5 - state.frac) * SYNODIC)
        : Math.round((1.5 - state.frac) * SYNODIC);
      const inDays = n => n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days";
      const roadData = [
        ["Next new moon", fmtD(todayMs + toNew * DAY) + " · " + inDays(toNew)],
        ["Next full moon", fmtD(todayMs + toFull * DAY) + " · " + inDays(toFull)]
      ];
      if (idx >= 0) {
        const startMs = Date.parse(starts[idx] + "T12:00:00Z");
        const lunarToday = Math.round((todayMs - startMs) / DAY) + 1;
        let nextShab = null;
        for (const sd of [8, 15, 22, 29]) if (sd >= lunarToday) { nextShab = startMs + (sd - 1) * DAY; break; }
        if (!nextShab && starts[idx + 1]) nextShab = Date.parse(starts[idx + 1] + "T12:00:00Z") + 7 * DAY;
        if (nextShab) {
          const n = Math.round((nextShab - todayMs) / DAY);
          roadData.push(["Next Shabbat", fmtD(nextShab) + " · " + inDays(n)]);
        }
      }
      for (const [k, v] of roadData) {
        const r = el("div", undefined, "moon-row");
        r.append(el("span", k, "moon-key"), el("span", v, "moon-val"));
        roadRows.append(r);
      }
      road.append(roadRows);
      overlay.append(road);

      // Tonight's full readout, same rows as the card.
      const tonightBlock = el("div", undefined, "moonpage-block");
      tonightBlock.append(el("h3", "Tonight, in full", "moonpage-block-title"));
      tonightBlock.append(table.cloneNode(true));
      tonightBlock.append(el("p", "Tonight · Central Time · " + state.dateLabel, "moon-stamp"));
      overlay.append(tonightBlock);
    }

    /* ---------- Earth view: a real yard in Three.js ---------- */
    let earth = null; // {overlay, destroy}
    function openEarth() {
      if (earth) return;
      const overlay = el("div", undefined, "moon-earth");
      const back = el("button", "← Home", "moon-earth-back");
      back.type = "button";
      back.onclick = closeEarth;
      overlay.append(back);
      document.body.append(overlay);
      document.body.classList.add("moon-earth-open");
      earth = { overlay, destroy: () => {} };
      if (THREE) {
        try { earth.destroy = buildEarthScene(overlay, state, texCanvas); }
        catch { fallbackEarthScene(overlay, state, texCanvas); }
      } else {
        fallbackEarthScene(overlay, state, texCanvas);
      }
    }
    function closeEarth() {
      if (!earth) return;
      try { earth.destroy(); } catch {}
      earth.overlay.remove();
      earth = null;
      document.body.classList.remove("moon-earth-open");
    }

    function buildEarthScene(overlay, st, texC) {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(innerWidth, innerHeight);
      overlay.prepend(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050914);
      scene.fog = new THREE.FogExp2(0x071224, 0.02);
      const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
      camera.position.set(0, 1.7, 8);

      // The hybrid night: the real yard, washed in blue moonlight, with
      // glowing blue edge-lines on the built things (his ruling 2026-10-30:
      // combine the existing view with the blue-glow look — "blueprint"
      // was his description of the glow, not a literal wireframe scene).
      scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x0a1020, 0.5));
      const moonLight = new THREE.DirectionalLight(0xaec8ff, 0.55);
      moonLight.position.set(14, 15, -10);
      scene.add(moonLight);
      const rimLight = new THREE.DirectionalLight(0x5fb2ff, 0.7);
      rimLight.position.set(-12, 8, -18);
      scene.add(rimLight);
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x6fc4ff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const edgeMatSoft = new THREE.LineBasicMaterial({
        color: 0x6fc4ff, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      function addEdges(mesh, mat) {
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 18), mat || edgeMat));
        return mesh;
      }

      // Stars, high shell — soft round sprites, two depths.
      const dotTex = new THREE.CanvasTexture(dotTexture());
      function starLayer(count, size, opacity, seed) {
        const g = new THREE.BufferGeometry();
        const rnd = mulberry32(seed), pos = [];
        for (let i = 0; i < count; i++) {
          const a = rnd() * Math.PI * 2, e = Math.acos(rnd() * 0.95);
          const R = 90;
          pos.push(R * Math.sin(e) * Math.cos(a), R * Math.cos(e) * 0.6 + 6, -Math.abs(R * Math.sin(e) * Math.sin(a)) - 8);
        }
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        return new THREE.Points(g, new THREE.PointsMaterial({
          color: 0xe9e5d8, size, sizeAttenuation: true, transparent: true, opacity,
          map: dotTex, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
        }));
      }
      scene.add(starLayer(900, 1.5, 0.85, 41));
      scene.add(starLayer(160, 2.6, 0.5, 87));

      // The Moon — hi-res texture, smooth sphere, hanging in this sky.
      const mTex = new THREE.CanvasTexture(moonTexture(2048, 1024));
      mTex.encoding = THREE.sRGBEncoding;
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 64, 48),
        new THREE.MeshStandardMaterial({ map: mTex, roughness: 1, fog: false })
      );
      moonMesh.position.set(10.5, 13.5, -30);
      scene.add(moonMesh);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowTexture("rgba(200,220,255,0.85)", "rgba(120,170,255,0.25)")),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, fog: false
      }));
      glow.scale.set(8, 8, 1);
      glow.position.copy(moonMesh.position);
      scene.add(glow);
      // Blue fresnel rim around the moon's real face — the phase, maria and
      // terminator stay exactly as computed; only a glowing blue edge is
      // added around the disc.
      const rimShell = new THREE.Mesh(
        new THREE.SphereGeometry(2.1 * 1.07, 48, 32),
        new THREE.ShaderMaterial({
          uniforms: { c: { value: new THREE.Color(0x7fd0ff) } },
          vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }",
          fragmentShader: "uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(c, 1.0) * f * 1.7; }",
          transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
        })
      );
      rimShell.position.copy(moonMesh.position);
      scene.add(rimShell);
      const sunL = new THREE.DirectionalLight(0xfff4e0, 1.5);
      const Lv = sunVector(st.frac);
      // Dedicated light target: NEVER scene.add() the moon mesh itself as a
      // target — Object3D.add() reparents, which once tore the moon out of
      // its sky position and dropped it at the scene origin (the yard dome).
      sunL.position.set(moonMesh.position.x + Lv[0] * 10, moonMesh.position.y + Lv[1] * 10 + 2, moonMesh.position.z + Lv[2] * 10);
      sunL.target.position.copy(moonMesh.position);
      scene.add(sunL, sunL.target);

      // Ground with grass texture.
      const gTex = new THREE.CanvasTexture(grassTexture());
      gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping; gTex.repeat.set(7, 7);
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(46, 40),
        new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      // Dirt path from the house toward the viewer.
      const path = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 13),
        new THREE.MeshStandardMaterial({ color: 0x171410, roughness: 1 })
      );
      path.rotation.x = -Math.PI / 2; path.rotation.z = 0.5;
      path.position.set(-3.4, 0.01, -3.4);
      scene.add(path);

      // Grass blades in the wind (instanced, shader sway). The blade
      // geometry tapers to a point — flat rectangular blades are what read
      // as blocky cardboard in the foreground.
      const bladeGeo = new THREE.PlaneGeometry(0.05, 0.5, 1, 4);
      bladeGeo.translate(0, 0.25, 0);
      {
        const pa = bladeGeo.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const t = pa.getY(i) / 0.5;
          pa.setX(i, pa.getX(i) * (1 - t * 0.88));
        }
        pa.needsUpdate = true;
        bladeGeo.computeVertexNormals();
      }
      const bladeTexC = document.createElement("canvas"); bladeTexC.width = 16; bladeTexC.height = 64;
      {
        const bx = bladeTexC.getContext("2d");
        const bg = bx.createLinearGradient(0, 64, 0, 0);
        bg.addColorStop(0, "#0e1a07"); bg.addColorStop(1, "#2e6b4f");
        bx.fillStyle = bg; bx.fillRect(0, 0, 16, 64);
      }
      const bladeMat = new THREE.MeshLambertMaterial({
        map: new THREE.CanvasTexture(bladeTexC), side: THREE.DoubleSide
      });
      const windUniform = { value: 0 };
      bladeMat.onBeforeCompile = sh => {
        sh.uniforms.uTime = windUniform;
        sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec4 ipos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float bendW = pow(max(position.y, 0.0) / 0.5, 2.0);
           float sway = sin(uTime * 1.7 + ipos.x * 0.8 + ipos.z * 0.65) * 0.16
                      + sin(uTime * 3.1 + ipos.x * 2.2) * 0.05;
           transformed.x += sway * bendW;
           transformed.z += sway * 0.6 * bendW;`
        );
      };
      const BLADES = 1500;
      const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADES);
      {
        const rnd = mulberry32(7), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
          e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
        for (let i = 0; i < BLADES; i++) {
          const a = rnd() * Math.PI * 2, rr = 1.2 + Math.pow(rnd(), 0.6) * 13;
          v.set(Math.cos(a) * rr, 0, Math.sin(a) * rr - 2);
          e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
          q.setFromEuler(e);
          const s = 0.7 + rnd() * 0.9;
          sc.set(s, s * (0.8 + rnd() * 0.7), s);
          m4.compose(v, q, sc);
          grass.setMatrixAt(i, m4);
        }
      }
      scene.add(grass);

      // House — sits ON the ground, gabled roof, lit windows.
      const house = new THREE.Group();
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x11141d, roughness: 0.95 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 1 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.7, 3.6), wallMat);
      body.position.y = 1.35; house.add(addEdges(body));
      {
        const tri = new THREE.Shape();
        tri.moveTo(-2.55, 0); tri.lineTo(2.55, 0); tri.lineTo(0, 1.7); tri.closePath();
        const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: 4.0, bevelEnabled: false });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 2.7, -2.0); house.add(addEdges(roof));
      }
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.55), wallMat);
      chimney.position.set(1.3, 3.9, -0.6); house.add(addEdges(chimney));
      const winMat = new THREE.MeshBasicMaterial({ color: 0xd9ab2e });
      const winDim = new THREE.MeshBasicMaterial({ color: 0x8a6d1f });
      for (const [wx, mat] of [[-1.4, winMat], [-0.35, winMat], [1.55, winDim]]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), mat);
        win.position.set(wx, 1.45, 1.81); house.add(win);
        const wg = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(glowTexture("rgba(217,171,46,0.55)", "rgba(217,171,46,0.12)")),
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75
        }));
        wg.scale.set(1.7, 1.7, 1); wg.position.set(wx, 1.45, 1.95); house.add(wg);
      }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.7),
        new THREE.MeshStandardMaterial({ color: 0x05060a }));
      door.position.set(0.75, 0.86, 1.81); house.add(addEdges(door));
      house.position.set(-7.2, 0, -10.5);
      house.rotation.y = 0.42;
      scene.add(house);

      // Fence line.
      const fence = new THREE.Group();
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 1 });
      for (let i = 0; i <= 11; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.95, 0.13), fenceMat);
        post.position.set(-2 + i * 1.05, 0.475, 0); fence.add(addEdges(post));
      }
      for (const ry of [0.58, 0.85]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.09, 0.05), fenceMat);
        rail.position.set(3.25, ry, 0); fence.add(addEdges(rail));
      }
      fence.position.set(0.5, 0, -5.6);
      fence.rotation.y = -0.06;
      scene.add(fence);

      // Trees with slow sway. Canopy = clustered SMOOTH spheres in varied
      // deep greens — the old flat-shaded icosahedrons were the faceted
      // "low-poly blob" look.
      const trees = [];
      function tree(x, z, s) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 2.1, 10),
          new THREE.MeshStandardMaterial({ color: 0x0d0a07, roughness: 1 }));
        trunk.position.y = 1.05; g.add(addEdges(trunk, edgeMatSoft));
        const fol = new THREE.Group();
        const greens = [0x16280f, 0x1a2d12, 0x12220c, 0x1d3315];
        const rnd = mulberry32(x * 10 + z);
        for (let i = 0; i < 6; i++) {
          const r = 0.62 + rnd() * 0.5;
          const blob = new THREE.Mesh(
            new THREE.SphereGeometry(r, 22, 16),
            new THREE.MeshStandardMaterial({ color: greens[Math.floor(rnd() * greens.length)], roughness: 1 }));
          blob.position.set((rnd() - 0.5) * 1.25, 2.35 + rnd() * 0.95, (rnd() - 0.5) * 1.25);
          blob.scale.y = 0.82;
          fol.add(blob);
        }
        g.add(fol);
        g.position.set(x, 0, z); g.scale.setScalar(s);
        g.userData.fol = fol; g.userData.phase = rnd() * 6.28;
        scene.add(g); trees.push(g);
      }
      tree(6.8, -8.5, 1.5); tree(9.6, -5.4, 1.15); tree(-10.2, -6.5, 1.3);

      // Fireflies.
      const FLIES = 34;
      const flyGeo = new THREE.BufferGeometry();
      const flyBase = [];
      {
        const rnd = mulberry32(23), pos = new Float32Array(FLIES * 3);
        for (let i = 0; i < FLIES; i++) {
          const bx = (rnd() - 0.5) * 17, by = 0.4 + rnd() * 1.8, bz = -1 - rnd() * 9;
          flyBase.push([bx, by, bz, rnd() * 6.28]);
          pos.set([bx, by, bz], i * 3);
        }
        flyGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      }
      const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({
        color: 0xbfe0ff, size: 0.34, transparent: true, opacity: 0.9,
        map: dotTex, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      scene.add(flies);

      // Drifting clouds.
      const clouds = [];
      for (let i = 0; i < 3; i++) {
        const cl = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(glowTexture("rgba(140,180,255,0.30)", "rgba(120,160,255,0.10)")),
          depthWrite: false, transparent: true, opacity: 0.13
        }));
        cl.scale.set(26 + i * 7, 8 + i * 2, 1);
        cl.position.set(-24 + i * 20, 20 + i * 2.5, -36);
        scene.add(cl); clouds.push(cl);
      }

      // Look-around drag.
      let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, dragging = false, lx = 0, ly = 0;
      const dom = renderer.domElement;
      dom.style.touchAction = "none";
      dom.addEventListener("pointerdown", e => { dragging = true; lx = e.clientX; ly = e.clientY; });
      addEventListener("pointerup", () => { dragging = false; });
      dom.addEventListener("pointermove", e => {
        if (!dragging) return;
        tYaw = Math.max(-0.6, Math.min(0.6, tYaw - (e.clientX - lx) * 0.0022));
        tPitch = Math.max(-0.14, Math.min(0.3, tPitch + (e.clientY - ly) * 0.0016));
        lx = e.clientX; ly = e.clientY;
      });
      const onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };
      addEventListener("resize", onResize);

      window.OustoryMoon._earth = { scene, camera, moon: moonMesh };
      let raf = 0, dead = false;
      const clock = new THREE.Clock();
      (function tick() {
        if (dead) return;
        raf = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();
        windUniform.value = t;
        yaw += (tYaw - yaw) * 0.05; pitch += (tPitch - pitch) * 0.05;
        camera.lookAt(Math.sin(yaw) * -10, 2.6 + pitch * 10, -10 * Math.cos(yaw));
        for (const tr of trees) {
          tr.userData.fol.rotation.z = Math.sin(t * 0.8 + tr.userData.phase) * 0.025;
          tr.userData.fol.position.x = Math.sin(t * 0.55 + tr.userData.phase) * 0.05;
        }
        const pos = flyGeo.attributes.position;
        for (let i = 0; i < FLIES; i++) {
          const [bx, by, bz, ph] = flyBase[i];
          pos.setXYZ(i,
            bx + Math.sin(t * 0.4 + ph) * 0.8,
            by + Math.sin(t * 0.9 + ph * 2) * 0.3,
            bz + Math.cos(t * 0.3 + ph) * 0.6);
        }
        pos.needsUpdate = true;
        flies.material.opacity = 0.65 + 0.3 * Math.sin(t * 2.2);
        for (const cl of clouds) {
          cl.position.x += 0.006;
          if (cl.position.x > 34) cl.position.x = -34;
        }
        renderer.render(scene, camera);
      })();
      return () => {
        dead = true;
        cancelAnimationFrame(raf);
        removeEventListener("resize", onResize);
        renderer.dispose();
        dom.remove();
      };
    }

    function fallbackEarthScene(overlay, st, texC) {
      overlay.classList.add("moon-earth-fallback");
      const sky = el("canvas", undefined, "moon-earth-stars");
      const ex = sky.getContext("2d");
      sky.width = innerWidth; sky.height = innerHeight;
      const rnd = mulberry32(417);
      for (let i = 0; i < 260; i++) {
        ex.fillStyle = "rgba(240,238,230," + (0.25 + rnd() * 0.75).toFixed(2) + ")";
        ex.beginPath(); ex.arc(rnd() * sky.width, rnd() * sky.height * 0.7, 0.4 + rnd() * 1.2, 0, 6.3); ex.fill();
      }
      const disc = el("canvas", undefined, "moon-earth-disc");
      disc.width = 132; disc.height = 132;
      drawDisc(disc, st, texC);
      const scene = el("div", undefined, "moon-earth-scene");
      scene.innerHTML =
        '<svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
        '<rect x="0" y="470" width="1000" height="90" fill="#0a1208"/>' +
        '<g fill="#05070d"><path d="M90 470 V330 L205 258 L320 330 V470 Z"/>' +
        '<path d="M70 338 L205 246 L340 338 L318 338 L205 264 L92 338 Z"/>' +
        '<rect x="186" y="378" width="38" height="92"/></g>' +
        '<rect x="116" y="352" width="27" height="32" fill="#c9a227" opacity="0.92"/>' +
        '<rect x="252" y="352" width="27" height="32" fill="#c9a227" opacity="0.7"/>' +
        '<g stroke="#05070d" stroke-width="7"><path d="M470 470 V408 M525 470 V408 M580 470 V408 M635 470 V408 M690 470 V408"/>' +
        '<path d="M452 424 H708 M452 446 H708" stroke-width="5"/></g>' +
        '<g fill="#05070d"><path d="M800 470 q6-84-16-132 q34 10 46-24 q4 38 30 50 q-18 50-10 106 Z"/>' +
        '<path d="M905 470 q-4-64 12-106 q24 12 38-14 q6 32 26 40 q-16 38-8 80 Z"/></g></svg>';
      overlay.append(sky, disc, scene);
    }

    /* ---------- Hero stage ---------- */
    let renderer = null, raf = 0, disposed = false;
    if (THREE) {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        stage.append(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
        const CAM_Z = 6.1; // moon (r=1.28) fills ~61% of the frame height
        camera.position.set(0, 0, CAM_Z);
        const group = new THREE.Group(); scene.add(group);
        const tex = new THREE.CanvasTexture(texCanvas);
        tex.encoding = THREE.sRGBEncoding;
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(1.28, 64, 64),
          new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.25, roughness: 1, metalness: 0 })
        );
        group.add(moon);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(glowTexture("rgba(240,236,220,0.75)", "rgba(180,190,220,0.18)")),
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6
        }));
        halo.scale.set(5.4, 5.4, 1); halo.position.z = -0.6;
        group.add(halo);
        // Depth: two star shells at different distances + faint nebula smudges.
        function starShell(count, rMin, rMax, size, opacity, seed) {
          const g = new THREE.BufferGeometry();
          const rnd = mulberry32(seed), pos = [];
          for (let i = 0; i < count; i++) {
            const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1);
            const R = rMin + rnd() * (rMax - rMin);
            pos.push(R * Math.sin(b) * Math.cos(a), R * Math.sin(b) * Math.sin(a), -Math.abs(R * Math.cos(b)) - 4);
          }
          g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          const p = new THREE.Points(g, new THREE.PointsMaterial({
            color: 0xe9e5d8, size: size * 1.9, transparent: true, opacity, depthWrite: false, fog: false,
            map: new THREE.CanvasTexture(dotTexture()), blending: THREE.AdditiveBlending
          }));
          scene.add(p);
          return p;
        }
        const starsFar = starShell(650, 26, 44, 0.14, 0.75, 815);
        const starsNear = starShell(220, 14, 22, 0.2, 0.95, 417);
        for (const [sx, sy, sz, s, o, col] of [
          [-13, 6, -30, 26, 0.10, "rgba(112,116,190,0.5)"],
          [14, -7, -34, 30, 0.08, "rgba(84,140,150,0.5)"],
          [2, 11, -38, 34, 0.06, "rgba(201,162,39,0.5)"]
        ]) {
          const neb = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(glowTexture(col, "rgba(0,0,0,0)")),
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o
          }));
          neb.position.set(sx, sy, sz); neb.scale.set(s, s * 0.62, 1);
          scene.add(neb);
        }
        scene.add(new THREE.AmbientLight(0x93a7cc, 0.2));
        const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
        const Lv = sunVector(state.frac);
        sun.position.set(Lv[0] * 8, Lv[1] * 8, Lv[2] * 8);
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0x91a7d8, 0.12);
        rim.position.set(-6, 3, -5);
        scene.add(rim);

        let tx = 0, ty = 0, gx = 0, gy = 0, dragging = false, lx = 0, ly = 0;
        const dom = renderer.domElement;
        dom.style.touchAction = "pan-y";
        dom.addEventListener("pointerdown", e => { dragging = true; lx = e.clientX; ly = e.clientY; });
        addEventListener("pointerup", () => { dragging = false; });
        dom.addEventListener("pointermove", e => {
          if (!dragging || mode === "cinema" || earth) return;
          tx += (e.clientX - lx) * 0.005; ty += (e.clientY - ly) * 0.003;
          ty = Math.max(-0.6, Math.min(0.6, ty));
          lx = e.clientX; ly = e.clientY;
        });
        function size() {
          const w = stage.clientWidth, h = stage.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h; camera.updateProjectionMatrix();
        }
        new ResizeObserver(size).observe(stage);
        size();
        const clock = new THREE.Clock();
        (function tick() {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          if (!document.contains(stage)) { unmount(); return; }
          if (earth) return; // the yard has the GPU while Earth view is open
          const t = clock.getElapsedTime();
          if (mode === "spin") moon.rotation.y += 0.004;
          starsFar.rotation.z = t * 0.0022;
          starsNear.rotation.z = t * 0.0038;
          if (mode === "cinema") {
            camera.position.set(Math.sin(t * 0.12) * 1.7, Math.sin(t * 0.085) * 0.75, 5.1 + Math.sin(t * 0.055) * 0.5);
            camera.lookAt(0, 0, 0);
          } else {
            gx += (tx - gx) * 0.06; gy += (ty - gy) * 0.06;
            group.rotation.y = gx; group.rotation.x = gy;
            group.position.y = Math.sin(t * 0.4) * 0.035;
            if (camera.position.z !== CAM_Z) { camera.position.set(0, 0, CAM_Z); camera.lookAt(0, 0, 0); }
          }
          renderer.render(scene, camera);
        })();
      } catch { renderer = null; }
    }
    if (!renderer) {
      const disc = el("canvas", undefined, "moon-disc-fallback");
      disc.width = 520; disc.height = 520;
      drawDisc(disc, state, texCanvas);
      stage.append(disc);
    }

    active = {
      destroy() {
        disposed = true;
        cancelAnimationFrame(raf);
        closeMoonPage();
        closeEarth();
        if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
      }
    };
  }

  window.OustoryMoon = { mount, unmount, tonightState, stateForDate };
})();
