"use strict";
/* Oustory chapter reader: local browser SpeechSynthesis, no audio hosting or uploads.
   Intentionally independent of editorial speaker colors or verse annotations. */
(() => {
  const STORAGE_KEY = "oustory.audio.rate";
  const RATE_OPTIONS = [0.8, 1, 1.2, 1.4];
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === "function";
  let player, playButton, stopButton, ratePicker, status, verseCount;
  let current = null, verses = [], chunks = [];
  let verseIndex = 0, chunkIndex = 0, generation = 0;
  let mode = "idle";
  const textOf = v => typeof v.text === "string" ? v.text :
    (Array.isArray(v.parts) ? v.parts.map(p => p.text).join("") : "");
  function readRate() {
    try {
      const rate = Number(JSON.parse(localStorage.getItem(STORAGE_KEY)));
      return RATE_OPTIONS.includes(rate) ? rate : 1;
    } catch { return 1; }
  }
  let rate = readRate();
  function persistRate() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rate)); } catch {}
  }
  function splitIntoChunks(text) {
    const chunks = [];
    let rest = text.replace(/\s+/g, " ").trim();
    while (rest.length > 220) {
      let cut = rest.lastIndexOf(" ", 220);
      if (cut < 100) cut = 220;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) chunks.push(rest);
    return chunks;
  }
  function update(message) {
    if (!player) return;
    const playing = mode === "playing";
    playButton.textContent = playing ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-label",
      playing ? "Pause chapter" : mode === "paused" ? "Resume chapter" : "Play chapter");
    playButton.title = playButton.getAttribute("aria-label");
    playButton.disabled = !supported || !verses.length;
    stopButton.disabled = !supported || (mode === "idle" || mode === "finished");
    ratePicker.disabled = !supported;
    status.textContent = message || (
      !supported ? "Audio reading is unavailable in this browser." :
      !verses.length ? "Loading chapter text…" :
      mode === "finished" ? "Chapter finished" :
      mode === "paused" ? "Paused · verse " + verses[verseIndex].number :
      mode === "playing" ? "Reading verse " + verses[verseIndex].number :
      "Ready to listen");
    verseCount.textContent = verses.length && (mode === "playing" || mode === "paused")
      ? (verseIndex + 1) + " / " + verses.length : "";
    player.setAttribute("data-audio-state", mode);
  }
  function cancelVoice() {
    ++generation; // Synchronously invalidate stale onend/onerror from cancelled speech.
    try { synth?.cancel(); } catch {}
  }
  function stop() {
    cancelVoice();
    mode = "idle";
    verseIndex = 0;
    chunkIndex = 0;
    chunks = [];
    update();
  }
  function setChapter({bookId, book, chapter, verses: sourceVerses}) {
    cancelVoice();
    current = {bookId, book, chapter};
    verses = sourceVerses.map(v => ({number:v.number, text:textOf(v)}))
      .filter(v => v.text.trim());
    verseIndex = 0; chunkIndex = 0; chunks = [];
    mode = "idle";
    player.hidden = false;
    player.setAttribute("aria-label", "Scripture audio player for " + book + " " + chapter);
    update();
  }
  function loading() {
    cancelVoice();
    verses = []; current = null; chunks = [];
    verseIndex = 0; chunkIndex = 0; mode = "idle";
    update();
  }
  function nextChunk(token) {
    if (token !== generation || mode !== "playing") return;
    if (verseIndex >= verses.length) {
      mode = "finished"; chunks = []; chunkIndex = 0;
      update("Chapter finished · press Play to listen again");
      return;
    }
    if (!chunks.length) chunks = splitIntoChunks(verses[verseIndex].text);
    if (chunkIndex >= chunks.length) {
      verseIndex++; chunkIndex = 0; chunks = [];
      nextChunk(token);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => { if (generation === token && mode === "playing") update(); };
    utterance.onend = () => {
      if (generation !== token || mode !== "playing") return;
      chunkIndex++;
      nextChunk(token);
    };
    utterance.onerror = event => {
      if (generation !== token || mode !== "playing") return;
      mode = "paused";
      update(event.error === "not-allowed"
        ? "Allow speech playback in your browser, then tap Resume."
        : "Speech was interrupted. Tap Resume to retry this verse.");
    };
    update();
    try { synth.speak(utterance); }
    catch {
      if (generation !== token) return;
      mode = "paused";
      update("Speech playback could not start. Tap Resume to retry.");
    }
  }
  function playPause() {
    if (!supported || !verses.length) return;
    if (mode === "playing") {
      mode = "paused";
      cancelVoice(); // iOS Safari's native pause/resume can stall; replay the current chunk.
      update("Paused · resume from verse " + verses[verseIndex].number);
      return;
    }
    if (mode === "finished") {
      verseIndex = 0; chunkIndex = 0; chunks = [];
    }
    cancelVoice();
    mode = "playing";
    nextChunk(generation); // Called synchronously from a real tap for iOS gesture activation.
  }
  function setRate(value) {
    rate = Number(value);
    if (!RATE_OPTIONS.includes(rate)) rate = 1;
    persistRate();
    if (mode === "playing") {
      cancelVoice();
      chunks = [];
      chunkIndex = 0; // Restart the current verse at the newly selected speed.
      mode = "playing";
      nextChunk(generation);
    } else update();
  }
  function createButton(label, symbol, cls) {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls; b.textContent = symbol;
    b.setAttribute("aria-label", label); b.title = label;
    return b;
  }
  function init() {
    if (player) return;
    player = document.createElement("section");
    player.id = "chapter-audio";
    player.className = "chapter-audio";
    player.setAttribute("role", "group");
    player.setAttribute("aria-label", "Scripture audio player");
    const controls = document.createElement("div");
    controls.className = "chapter-audio-controls";
    playButton = createButton("Play chapter", "▶", "audio-play");
    stopButton = createButton("Stop chapter", "■", "audio-stop");
    const speedLabel = document.createElement("label");
    speedLabel.className = "audio-speed";
    speedLabel.textContent = "Speed";
    ratePicker = document.createElement("select");
    ratePicker.id = "audio-rate";
    ratePicker.setAttribute("aria-label", "Playback speed");
    for (const value of RATE_OPTIONS) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = value + "×";
      ratePicker.append(option);
    }
    ratePicker.value = String(rate);
    speedLabel.append(ratePicker);
    status = document.createElement("span");
    status.id = "audio-status";
    status.className = "audio-status";
    status.setAttribute("role", "status");
    verseCount = document.createElement("span");
    verseCount.className = "audio-progress";
    verseCount.setAttribute("aria-label", "Verse playback progress");
    controls.append(playButton, stopButton, speedLabel, verseCount);
    player.append(controls, status);
    document.getElementById("chapter-title").after(player);
    playButton.addEventListener("click", playPause);
    stopButton.addEventListener("click", stop);
    ratePicker.addEventListener("change", e => setRate(e.target.value));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && mode === "playing") {
        mode = "paused"; cancelVoice();
        update("Paused · reopen Oustory to resume from this verse");
      }
    });
    update();
  }
  window.OustoryAudio = {init, setChapter, loading, stop};
})();
