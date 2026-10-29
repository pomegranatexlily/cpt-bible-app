"use strict";
/* Oustory chapter reader: recorded MP3 narration driven by audio-manifest.json.
   No device narration anywhere in this file: no built-in voice, no voice select,
   no narration timeouts or recovery handlers. A chapter plays only when the
   manifest has an entry for it; otherwise the player says so plainly and
   reading continues without audio. Sync is honest, in three modes (see
   audio-manifest-format.md):
     - "timed": one chapter file + a segments timing map (passage -> start/end).
       The reading highlight follows the audio exactly.
     - "files": one audio file per passage. The highlight follows the file playing.
     - "chapter": one chapter file, no timing map. No per-passage claim is made:
       the highlight stays on the reader's position and the seek bar is time.
   Passage here means verse order within the chapter (0-based): segment
   passage 0 is the chapter's first verse as rendered, whatever its verse
   number. The reader's own interface is unchanged: init, setChapter, loading,
   stop, called by oustory-reader.js exactly as before. */
(() => {
  const STORAGE_KEY = "oustory.audio.rate";
  const RATE_OPTIONS = [0.8, 1, 1.2, 1.4];
  // Versioned so a manifest update (new segments/wiring) is never masked by a
  // cached copy: bump this query whenever audio-manifest.json changes.
  const MANIFEST_URL = "audio-manifest.json?v=20261029-esther-v1";
  const UNAVAILABLE = "Audio not yet available for this chapter.";
  let player, playButton, stopButton, ratePicker, status, verseCount, seekBar, timeLabel;
  let audio = null, manifest = null, manifestLoaded = false;
  let current = null, verses = [], entry = null, mode = "none", failed = false;
  let verseIndex = 0, audioMode = "idle", highlighted = null;
  let rate = readRate();
  function readRate() {
    try {
      const value = Number(JSON.parse(localStorage.getItem(STORAGE_KEY)));
      return RATE_OPTIONS.includes(value) ? value : 1;
    } catch { return 1; }
  }
  function persistRate() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rate)); } catch {}
  }
  function fmtTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function resolveUrl(manifestDoc, value) {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    const base = (manifestDoc && manifestDoc.baseUrl) || "";
    return base ? base.replace(/\/?$/, "/") + value : value;
  }
  function entryMode(candidate) {
    if (!candidate) return "none";
    if (Array.isArray(candidate.segments) && candidate.segments.length) {
      return candidate.segments.some(s => !!s.url) ? "files" : "timed";
    }
    return candidate.file || candidate.url ? "chapter" : "none";
  }
  function findEntry(bookId, chapterIndex, chapterTitle) {
    if (!manifest || !Array.isArray(manifest.entries)) return null;
    for (const candidate of manifest.entries) {
      if (!candidate || candidate.document !== bookId) continue;
      if (typeof candidate.chapterIndex === "number" && candidate.chapterIndex === chapterIndex) return candidate;
      if (typeof candidate.chapterTitle === "string" && chapterTitle && candidate.chapterTitle === chapterTitle) return candidate;
    }
    return null;
  }
  function chapterIndexOf(bookId, chapterNumber) {
    const books = Array.isArray(window.CPT_BOOKS) ? window.CPT_BOOKS : [];
    const book = books.find(b => b.id === bookId);
    if (!book) return null;
    const position = book.chapters.findIndex(c => c.number === chapterNumber);
    return position >= 0 ? position : null;
  }
  function segmentForVerse(order) {
    if (!entry || !Array.isArray(entry.segments)) return null;
    return entry.segments.find(s => s.passage === order) || null;
  }
  function verseElement(order) {
    const verse = verses[order];
    if (!verse) return null;
    return document.querySelector('.verse-entry[data-verse="' + verse.number + '"]');
  }
  function setHighlight(order) {
    if (highlighted) highlighted.classList.remove("is-audio-current");
    highlighted = null;
    if (order == null || (mode !== "timed" && mode !== "files")) return;
    const el = verseElement(order);
    if (!el) return;
    el.classList.add("is-audio-current");
    highlighted = el;
    const reader = document.getElementById("reader");
    if (reader) {
      const box = el.getBoundingClientRect(), area = reader.getBoundingClientRect();
      if (box.top < area.top || box.bottom > area.bottom) {
        el.scrollIntoView({block: "center"});
      }
    }
  }
  function update(message) {
    if (!player) return;
    const playing = audioMode === "playing";
    playButton.textContent = playing ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-label",
      playing ? "Pause chapter" : audioMode === "paused" ? "Resume chapter" : "Play chapter");
    playButton.title = playButton.getAttribute("aria-label");
    playButton.disabled = !verses.length || !manifestLoaded || mode === "none" || failed;
    stopButton.disabled = audioMode === "idle" || audioMode === "finished";
    ratePicker.disabled = false;
    if (message) {
      status.textContent = message;
    } else if (!verses.length) {
      status.textContent = "Loading chapter text…";
    } else if (!manifestLoaded) {
      status.textContent = "Checking for recorded audio…";
    } else if (mode === "none" || failed) {
      status.textContent = UNAVAILABLE;
    } else if (audioMode === "finished") {
      status.textContent = "Chapter finished";
    } else if (audioMode === "paused") {
      status.textContent = mode === "chapter"
        ? "Paused · " + fmtTime(audio ? audio.currentTime : 0)
        : "Paused · verse " + verses[verseIndex].number;
    } else if (playing) {
      status.textContent = mode === "chapter"
        ? "Playing · " + fmtTime(audio ? audio.currentTime : 0)
        : "Reading verse " + verses[verseIndex].number;
    } else {
      status.textContent = "Ready to listen";
    }
    if (verses.length && (playing || audioMode === "paused")) {
      verseCount.textContent = mode === "chapter"
        ? fmtTime(audio ? audio.currentTime : 0) + (audio && isFinite(audio.duration) && audio.duration > 0 ? " / " + fmtTime(audio.duration) : "")
        : (verseIndex + 1) + " / " + verses.length;
    } else {
      verseCount.textContent = "";
    }
    if (seekBar) {
      if (mode === "chapter" && audio && isFinite(audio.duration) && audio.duration > 0) {
        seekBar.max = String(Math.floor(audio.duration));
        seekBar.value = String(Math.floor(audio.currentTime || 0));
        seekBar.disabled = false;
      } else if (mode === "timed" && audio && isFinite(audio.duration) && audio.duration > 0) {
        seekBar.max = String(Math.floor(audio.duration));
        seekBar.value = String(Math.floor(audio.currentTime || 0));
        seekBar.disabled = false;
      } else if (mode === "files" && verses.length) {
        seekBar.max = String(verses.length - 1);
        seekBar.value = String(verseIndex);
        seekBar.disabled = false;
      } else {
        seekBar.max = "0";
        seekBar.value = "0";
        seekBar.disabled = true;
      }
      if (timeLabel) {
        timeLabel.textContent = mode === "chapter" && audio && isFinite(audio.duration) && audio.duration > 0
          ? fmtTime(audio.currentTime || 0) + " / " + fmtTime(audio.duration)
          : "";
      }
    }
    player.setAttribute("data-audio-state", audioMode);
  }
  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = "metadata";
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onAudioEnded);
    audio.addEventListener("error", onAudioError);
    audio.addEventListener("playing", () => update());
    audio.addEventListener("loadedmetadata", () => update());
  }
  function loadChapterFile() {
    ensureAudio();
    const url = resolveUrl(manifest, entry.url || entry.file);
    if (url && audio.getAttribute("src") !== url) audio.setAttribute("src", url);
    if (url) audio.load();
  }
  function loadPassageFile(order) {
    ensureAudio();
    const segment = segmentForVerse(order);
    if (!segment || !segment.url) {
      failed = true;
      update();
      return false;
    }
    const url = resolveUrl(manifest, segment.url);
    if (url && audio.getAttribute("src") !== url) audio.setAttribute("src", url);
    if (url) audio.load();
    return true;
  }
  function setAudioForChapter() {
    stopAudioOnly();
    failed = false;
    verseIndex = 0;
    setHighlight(null);
    if (!current) { entry = null; mode = "none"; update(); return; }
    const index = chapterIndexOf(current.bookId, current.chapter);
    entry = findEntry(current.bookId, index, current.book + " " + current.chapter);
    mode = entryMode(entry);
    if (mode === "timed" || mode === "chapter") {
      loadChapterFile();
    } else if (mode === "files") {
      loadPassageFile(0);
    } else {
      ensureAudio();
      audio.removeAttribute("src");
      audio.load();
    }
    if (audio) audio.playbackRate = rate;
    update();
  }
  function stopAudioOnly() {
    if (audio) { try { audio.pause(); } catch {} }
    audioMode = "idle";
  }
  function stop() {
    stopAudioOnly();
    verseIndex = 0;
    if (audio) { try { audio.currentTime = 0; } catch {} }
    setHighlight(null);
    update();
  }
  function onTimeUpdate() {
    if (!audio) return;
    if (mode === "timed" && entry && Array.isArray(entry.segments)) {
      const t = audio.currentTime;
      let found = -1;
      for (const segment of entry.segments) {
        if (t >= segment.start && (typeof segment.end !== "number" || t < segment.end)) { found = segment.passage; break; }
      }
      if (found >= 0 && found !== verseIndex && found < verses.length) {
        verseIndex = found;
        setHighlight(verseIndex);
      }
    }
    update();
  }
  function onAudioEnded() {
    if (mode === "files") {
      if (verseIndex + 1 < verses.length) {
        const wasPlaying = audioMode === "playing";
        verseIndex++;
        setHighlight(verseIndex);
        update();
        if (wasPlaying) {
          if (loadPassageFile(verseIndex)) playElement();
          else { audioMode = "idle"; update(UNAVAILABLE); }
        }
        return;
      }
    }
    audioMode = "finished";
    setHighlight(null);
    update("Chapter finished · press Play to listen again");
  }
  function onAudioError() {
    if (entry) failed = true;
    if (audioMode === "playing" || audioMode === "paused") {
      audioMode = "idle";
      update(UNAVAILABLE);
    } else {
      update();
    }
  }
  function playElement() {
    if (!audio) return;
    audio.playbackRate = rate;
    let result = null;
    try { result = audio.play(); } catch { result = null; }
    if (result && result.catch) {
      result.catch(() => {
        if (audioMode === "playing") { audioMode = "paused"; update("Recorded audio could not play. Press Play to retry."); }
      });
    }
  }
  function playPause() {
    if (!manifestLoaded) { update(); return; }
    if (!verses.length || mode === "none" || failed) { update(UNAVAILABLE); return; }
    if (audioMode === "playing") {
      audioMode = "paused";
      try { audio.pause(); } catch {}
      update();
      return;
    }
    if (audioMode === "finished") {
      verseIndex = 0;
      setHighlight(null);
      if (mode === "timed" || mode === "chapter") { try { audio.currentTime = 0; } catch {} }
      else loadPassageFile(0);
    }
    if (mode === "files" && audioMode !== "paused") loadPassageFile(verseIndex);
    audioMode = "playing";
    setHighlight(mode === "chapter" ? null : verseIndex);
    update();
    playElement();
  }
  function setRate(value) {
    rate = Number(value);
    if (!RATE_OPTIONS.includes(rate)) rate = 1;
    persistRate();
    if (audio) audio.playbackRate = rate;
    update();
  }
  function onSeek(value) {
    if (!verses.length || mode === "none" || failed) return;
    const wasPlaying = audioMode === "playing";
    if (mode === "chapter" || mode === "timed") {
      if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
      try { audio.currentTime = Math.max(0, Math.min(audio.duration, Number(value) || 0)); } catch {}
      if (mode === "timed") onTimeUpdate();
      update();
      if (wasPlaying) playElement();
      return;
    }
    if (mode === "files") {
      const order = Math.max(0, Math.min(verses.length - 1, Number(value) || 0));
      verseIndex = order;
      setHighlight(verseIndex);
      if (!loadPassageFile(order)) { audioMode = "idle"; update(UNAVAILABLE); return; }
      update();
      if (wasPlaying) playElement();
    }
  }
  function createButton(label, symbol, cls) {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls; b.textContent = symbol;
    b.setAttribute("aria-label", label); b.title = label;
    return b;
  }
  function loadManifest() {
    fetch(MANIFEST_URL).then(response => {
      if (!response.ok) throw Error("no manifest");
      return response.json();
    }).then(data => {
      manifest = data && data.version === 1 && Array.isArray(data.entries) ? data : null;
      manifestLoaded = true;
      if (current) setAudioForChapter();
      else update();
    }).catch(() => {
      manifest = null;
      manifestLoaded = true;
      if (current) setAudioForChapter();
      else update();
    });
  }
  function setChapter({bookId, book, chapter, verses: sourceVerses}) {
    stopAudioOnly();
    current = {bookId, book, chapter};
    const textOf = v => typeof v.text === "string" ? v.text :
      (Array.isArray(v.parts) ? v.parts.map(p => p.text).join("") : "");
    verses = sourceVerses.map(v => ({number: v.number, text: textOf(v)}))
      .filter(v => v.text.trim());
    verseIndex = 0;
    audioMode = "idle";
    player.hidden = false;
    player.setAttribute("aria-label", "Scripture audio player for " + book + " " + chapter);
    setAudioForChapter();
  }
  function loading() {
    stopAudioOnly();
    verses = []; current = null; entry = null; mode = "none"; failed = false;
    verseIndex = 0;
    audioMode = "idle";
    setHighlight(null);
    update();
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
    const seekRow = document.createElement("div");
    seekRow.className = "chapter-audio-seek";
    seekBar = document.createElement("input");
    seekBar.id = "audio-seek";
    seekBar.type = "range";
    seekBar.min = "0";
    seekBar.max = "0";
    seekBar.value = "0";
    seekBar.setAttribute("aria-label", "Audio position");
    timeLabel = document.createElement("span");
    timeLabel.className = "audio-time";
    seekRow.append(seekBar, timeLabel);
    player.append(controls, seekRow, status);
    document.getElementById("chapter-title").after(player);
    playButton.addEventListener("click", playPause);
    stopButton.addEventListener("click", stop);
    ratePicker.addEventListener("change", e => setRate(e.target.value));
    seekBar.addEventListener("change", e => onSeek(e.target.value));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && audioMode === "playing") {
        audioMode = "paused";
        try { audio.pause(); } catch {}
        update("Paused · reopen Oustory to resume");
      }
    });
    window.addEventListener("pagehide", () => { try { audio.pause(); } catch {} });
    loadManifest();
    update();
  }
  window.OustoryAudio = {init, setChapter, loading, stop};
})();
