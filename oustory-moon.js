"use strict";
/* Oustory Moon — the home-page moon for the Covenant Bible app.
   One computed "tonight" state (Central time, America/Chicago) drives every
   number on the card and the light on the sphere, so no panel can disagree
   with another. Ephemeris: mean-synodic age from the 2000-01-06 new-moon
   epoch; apparent solar longitude; elongation is the true Moon–Sun
   separation (<=180 deg), E while waxing, W while waning. Distances are
   low-precision approximations and are labeled as such.
   Views: Home (tonight, still), Spin, Cinematic (letterboxed dolly),
   Earth (full-screen night yard; all app content disappears). */
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
    return got; // {year, month, day} in Central time
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
      const shabbatDays = [8, 15, 22, 29];
      let next = null;
      for (const sd of shabbatDays) {
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

  /* Seeded RNG so the Moon's face is the same on every device, every load. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function moonTexture() {
    const w = 1024, h = 512;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d");
    const grad = x.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#c7c2b8"); grad.addColorStop(0.5, "#bab5aa"); grad.addColorStop(1, "#c2bdb2");
    x.fillStyle = grad; x.fillRect(0, 0, w, h);
    const rnd = mulberry32(20261029);
    // Maria: soft dark basalt patches.
    for (let i = 0; i < 34; i++) {
      const cx = rnd() * w, cy = h * 0.18 + rnd() * h * 0.64;
      const r = 26 + rnd() * 92;
      const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, "rgba(88,86,82,0.55)");
      g.addColorStop(0.7, "rgba(96,94,90,0.28)");
      g.addColorStop(1, "rgba(96,94,90,0)");
      x.fillStyle = g;
      x.beginPath(); x.ellipse(cx, cy, r * (0.7 + rnd() * 0.7), r * (0.5 + rnd() * 0.5), rnd() * 3.2, 0, 6.3); x.fill();
    }
    // Crater speckle.
    for (let i = 0; i < 1500; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = 0.6 + rnd() * 2.6;
      x.fillStyle = rnd() > 0.5 ? "rgba(70,68,64,0.20)" : "rgba(232,228,218,0.16)";
      x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
    }
    // A few bright ray craters.
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * w, cy = rnd() * h;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, 9 + rnd() * 14);
      g.addColorStop(0, "rgba(240,236,226,0.5)"); g.addColorStop(1, "rgba(240,236,226,0)");
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 24, 0, 6.3); x.fill();
    }
    return c;
  }

  /* 2D fallback / Earth-view disc: per-pixel sphere shading with the same
     sun vector as the 3D scene, so the phase can never disagree. */
  function drawDisc(canvas, state, textureCanvas) {
    const s = canvas.width, r = s / 2;
    const x = canvas.getContext("2d");
    const img = x.createImageData(s, s);
    const tex = textureCanvas.getContext("2d").getImageData(0, 0, textureCanvas.width, textureCanvas.height).data;
    const tw = textureCanvas.width, th = textureCanvas.height;
    const sun = [Math.sin(2 * Math.PI * state.frac), 0, -Math.cos(2 * Math.PI * state.frac)];
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
        const shade = 0.10 + 0.95 * lit; // faint earthshine floor on the dark side
        img.data[o] = tex[to] * shade;
        img.data[o + 1] = tex[to + 1] * shade;
        img.data[o + 2] = tex[to + 2] * shade;
        img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  }

  let active = null; // {destroy}

  function unmount() {
    if (active) { try { active.destroy(); } catch {} active = null; }
  }

  function mount(card) {
    unmount();
    const state = tonightState();
    const texCanvas = moonTexture();
    const el = (tag, text, cls) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      if (cls) n.className = cls;
      return n;
    };

    const stage = el("div", undefined, "moon-stage");
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", "The Moon tonight: " + state.phase + ", " +
      Math.round(state.illum * 100) + "% lit");
    const stars = el("canvas", undefined, "moon-stars");
    stage.append(stars);
    card.append(stage);

    // Starfield (2D, twinkles gently).
    const sx = stars.getContext("2d");
    let starPts = [];
    function paintStars(w, h) {
      stars.width = w; stars.height = h;
      const rnd = mulberry32(815);
      starPts = Array.from({ length: 130 }, () => ({
        x: rnd() * w, y: rnd() * h, r: 0.4 + rnd() * 1.1, p: rnd() * 6.28
      }));
    }

    // Tonight readout — one state, every row.
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

    // View switcher.
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

    /* Earth view: the whole app disappears into the yard. */
    let earthEl = null;
    function openEarth() {
      closeEarth();
      earthEl = el("div", undefined, "moon-earth");
      const sky = el("canvas", undefined, "moon-earth-stars");
      const ex = sky.getContext("2d");
      sky.width = innerWidth; sky.height = innerHeight;
      const rnd = mulberry32(417);
      for (let i = 0; i < 260; i++) {
        ex.fillStyle = "rgba(240,238,230," + (0.25 + rnd() * 0.75).toFixed(2) + ")";
        ex.beginPath(); ex.arc(rnd() * sky.width, rnd() * sky.height * 0.72, 0.4 + rnd() * 1.2, 0, 6.3); ex.fill();
      }
      const disc = el("canvas", undefined, "moon-earth-disc");
      disc.width = 132; disc.height = 132;
      drawDisc(disc, state, texCanvas);
      const scene = el("div", undefined, "moon-earth-scene");
      scene.innerHTML =
        '<svg viewBox="0 0 1000 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
        '<rect x="0" y="330" width="1000" height="90" fill="#070b06"/>' +
        '<path d="M0 332 Q 250 318 520 330 T 1000 326 V420 H0 Z" fill="#0a0f08"/>' +
        '<g fill="#05070d"><path d="M96 332 V238 L196 178 L292 238 V332 Z"/>' +
        '<path d="M78 244 L196 168 L314 244 L296 244 L196 186 L96 244 Z"/>' +
        '<rect x="176" y="272" width="40" height="60"/></g>' +
        '<rect x="118" y="256" width="26" height="30" fill="#c9a227" opacity="0.92"/>' +
        '<rect x="238" y="256" width="26" height="30" fill="#c9a227" opacity="0.75"/>' +
        '<g stroke="#05070d" stroke-width="7"><path d="M420 336 V292 M470 336 V292 M520 336 V292 M570 336 V292 M620 336 V292"/>' +
        '<path d="M404 306 H636 M404 322 H636" stroke-width="5"/></g>' +
        '<g fill="#05070d"><path d="M742 332 q6-74-14-118 q30 8 40-22 q4 34 26 44 q-16 44-8 96 Z"/>' +
        '<path d="M856 332 q-4-58 10-96 q22 10 34-12 q6 28 22 36 q-14 34-6 72 Z"/></g></svg>';
      const back = el("button", "← Home", "moon-earth-back");
      back.type = "button";
      back.onclick = closeEarth;
      earthEl.append(sky, disc, scene, back);
      // Gentle look-around parallax.
      const onMove = e => {
        const cx = (e.clientX / innerWidth - 0.5), cy = (e.clientY / innerHeight - 0.5);
        scene.style.transform = "translate(" + (-cx * 14) + "px," + (-cy * 6) + "px) scale(1.04)";
        disc.style.transform = "translate(" + (-cx * 5) + "px," + (-cy * 3) + "px)";
      };
      earthEl.addEventListener("pointermove", onMove);
      document.body.append(earthEl);
      document.body.classList.add("moon-earth-open");
    }
    function closeEarth() {
      if (earthEl) { earthEl.remove(); earthEl = null; }
      document.body.classList.remove("moon-earth-open");
    }

    /* 3D stage (Three.js, vendored locally). Falls back to the shaded disc. */
    let renderer = null, raf = 0, disposed = false;
    const THREE = window.THREE;
    if (THREE) {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        stage.append(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0, 3.4);
        const group = new THREE.Group(); scene.add(group);
        const tex = new THREE.CanvasTexture(texCanvas);
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(1.28, 64, 64),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
        );
        group.add(moon);
        scene.add(new THREE.AmbientLight(0x8899bb, 0.32)); // earthshine floor
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
        const L = [Math.sin(2 * Math.PI * state.frac), 0, -Math.cos(2 * Math.PI * state.frac)];
        sun.position.set(L[0] * 8, L[1] * 8, L[2] * 8);
        scene.add(sun);
        // Drag to look around (Home + Spin).
        let tx = 0, ty = 0, gx = 0, gy = 0, dragging = false, lx = 0, ly = 0;
        const dom = renderer.domElement;
        dom.style.touchAction = "pan-y";
        dom.addEventListener("pointerdown", e => { dragging = true; lx = e.clientX; ly = e.clientY; });
        addEventListener("pointerup", () => { dragging = false; });
        dom.addEventListener("pointermove", e => {
          if (!dragging || mode === "cinema") return;
          tx += (e.clientX - lx) * 0.005; ty += (e.clientY - ly) * 0.003;
          ty = Math.max(-0.6, Math.min(0.6, ty));
          lx = e.clientX; ly = e.clientY;
        });
        function size() {
          const w = stage.clientWidth, h = stage.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h; camera.updateProjectionMatrix();
          paintStars(w, h);
        }
        new ResizeObserver(size).observe(stage);
        size();
        const clock = new THREE.Clock();
        (function tick() {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          if (!document.contains(stage)) { unmount(); return; }
          const t = clock.getElapsedTime();
          if (mode === "spin") moon.rotation.y += 0.0035;
          if (mode === "cinema") {
            camera.position.set(Math.sin(t * 0.13) * 1.5, Math.sin(t * 0.09) * 0.62, 2.9 + Math.sin(t * 0.06) * 0.45);
            camera.lookAt(0, 0, 0);
          } else {
            gx += (tx - gx) * 0.06; gy += (ty - gy) * 0.06;
            group.rotation.y = gx; group.rotation.x = gy;
            if (camera.position.z !== 3.4) { camera.position.set(0, 0, 3.4); camera.lookAt(0, 0, 0); }
          }
          // Twinkle.
          sx.clearRect(0, 0, stars.width, stars.height);
          for (const p of starPts) {
            sx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 1.3 + p.p);
            sx.fillStyle = "#efece2";
            sx.beginPath(); sx.arc(p.x, p.y, p.r, 0, 6.3); sx.fill();
          }
          sx.globalAlpha = 1;
          renderer.render(scene, camera);
        })();
      } catch { renderer = null; }
    }
    if (!renderer) {
      const disc = el("canvas", undefined, "moon-disc-fallback");
      disc.width = 520; disc.height = 520;
      drawDisc(disc, state, texCanvas);
      stage.append(disc);
      paintStars(stage.clientWidth || 340, stage.clientHeight || 340);
      sx.fillStyle = "#efece2";
      for (const p of starPts) { sx.globalAlpha = 0.5; sx.beginPath(); sx.arc(p.x, p.y, p.r, 0, 6.3); sx.fill(); }
      sx.globalAlpha = 1;
    }

    active = {
      destroy() {
        disposed = true;
        cancelAnimationFrame(raf);
        closeEarth();
        if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
      }
    };
  }

  window.OustoryMoon = { mount, unmount, tonightState };
})();
