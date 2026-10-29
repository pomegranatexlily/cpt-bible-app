/* OUSTORY Spatial Archive — plain JS, no frameworks, no network calls.
   Collections follow the real 80-book canonical sequence (data/manifest.json:
   "80-title working canonical sequence"). Group labels are navigation
   grouping, not a doctrinal claim. Sample verse text is verbatim from the
   Covenant text files data/psalms.json and data/genesis.json. Nothing else
   is quoted here, and no translation or reading is invented: books without
   a sample show a notice instead of text. */
(function () {
  "use strict";

  var BOOK_IDS = ["genesis","exodus","leviticus","numbers","deuteronomy","joshua","judges","ruth","1-samuel","2-samuel","1-kings","2-kings","1-chronicles","2-chronicles","ezra","nehemiah","esther","job","psalms","proverbs","ecclesiastes","song-of-solomon","isaiah","jeremiah","lamentations","ezekiel","daniel","hosea","joel","amos","obadiah","jonah","micah","nahum","habakkuk","zephaniah","haggai","zechariah","malachi","1-esdras","2-esdras","tobit","judith","the-rest-of-esther","the-wisdom-of-solomon","ecclesiasticus","baruch","the-song-of-the-three-holy-children","the-history-of-susanna","bel-and-the-dragon","the-prayer-of-manasses","1-maccabees","2-maccabees","matthew","mark","luke","john","acts","romans","1-corinthians","2-corinthians","galatians","ephesians","philippians","colossians","1-thessalonians","2-thessalonians","1-timothy","2-timothy","titus","philemon","hebrews","james","1-peter","2-peter","1-john","2-john","3-john","jude","revelation"];

  var COLLECTIONS = [
    { id: "torah", title: "Torah", books: ["genesis","exodus","leviticus","numbers","deuteronomy"] },
    { id: "history", title: "History", books: ["joshua","judges","ruth","1-samuel","2-samuel","1-kings","2-kings","1-chronicles","2-chronicles","ezra","nehemiah","esther"] },
    { id: "wisdom", title: "Wisdom & Poetry", books: ["job","psalms","proverbs","ecclesiastes","song-of-solomon"] },
    { id: "prophets", title: "Prophets", books: ["isaiah","jeremiah","lamentations","ezekiel","daniel","hosea","joel","amos","obadiah","jonah","micah","nahum","habakkuk","zephaniah","haggai","zechariah","malachi"] },
    { id: "additional", title: "Additional Books", books: ["1-esdras","2-esdras","tobit","judith","the-rest-of-esther","the-wisdom-of-solomon","ecclesiasticus","baruch","the-song-of-the-three-holy-children","the-history-of-susanna","bel-and-the-dragon","the-prayer-of-manasses","1-maccabees","2-maccabees"] },
    { id: "gospels", title: "Gospels & Acts", books: ["matthew","mark","luke","john","acts"] },
    { id: "letters", title: "Letters & Revelation", books: ["romans","1-corinthians","2-corinthians","galatians","ephesians","philippians","colossians","1-thessalonians","2-thessalonians","1-timothy","2-timothy","titus","philemon","hebrews","james","1-peter","2-peter","1-john","2-john","3-john","jude","revelation"] }
  ];

  function titleFromId(id) {
    var small = { of: true, and: true, the: true };
    return id.split("-").map(function (word, i) {
      if (/^\d+$/.test(word)) return word;
      if (i > 0 && small[word]) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
  }

  var SAMPLES = [
    {
      book: "psalms", title: "Psalms", chapter: 1, ref: "Psalm 1:1–3",
      verses: [
        [1, "Blessed is the man who doesn’t walk in the counsel of the wicked, nor stand on the path of sinners, nor sit in the seat of scoffers;"],
        [2, "but his delight is in Yahawah’s law. On his law he meditates day and night."],
        [3, "He will be like a tree planted by the streams of water, that produces its fruit in its season, whose leaf also does not wither. Whatever he does shall prosper."]
      ]
    },
    {
      book: "psalms", title: "Psalms", chapter: 23, ref: "Psalm 23:1–6", audio: true,
      verses: [
        [1, "Yahawah is my shepherd: I shall lack nothing."],
        [2, "He makes me lie down in green pastures. He leads me beside still waters."],
        [3, "He restores my soul. He guides me in the paths of righteousness for his name’s sake."],
        [4, "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me."],
        [5, "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over."],
        [6, "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahawah’s house forever."]
      ]
    },
    {
      book: "genesis", title: "Genesis", chapter: 1, ref: "Genesis 1:1–5",
      verses: [
        [1, "In the beginning, Yahawah created the heavens and the earth."],
        [2, "The earth was unformed and empty, darkness covered the deep waters, and the Spirit of Yahawah moved over the surface of the waters."],
        [3, "Then Yahawah said, “Let there be light.” And there was light."],
        [4, "Yahawah saw that the light was good, and he separated the light from the darkness."],
        [5, "Yahawah called the light Day, and he called the darkness Night. Evening came, then morning—the first day."]
      ]
    }
  ];

  var sampleBookIds = {};
  SAMPLES.forEach(function (s) { sampleBookIds[s.book] = true; });

  var $ = function (id) { return document.getElementById(id); };
  var current = 0;
  var fontSize = 18;
  var focusIndex = 0;
  var stackCards = [];

  function showCollections() {
    $("reading-view").classList.add("hidden");
    $("collections-view").classList.remove("hidden");
    $("collections-view").querySelector("h1").focus();
  }

  function openSample(index) {
    current = index;
    var s = SAMPLES[index];
    $("reading-title").textContent = s.title + " " + s.chapter;
    $("reading-ref").textContent = s.ref + " · Covenant text, sample passage";
    var versesEl = $("verses");
    versesEl.innerHTML = "";
    s.verses.forEach(function (v) {
      var p = document.createElement("p");
      p.className = "verse";
      p.tabIndex = 0;
      p.setAttribute("role", "button");
      p.setAttribute("aria-pressed", "false");
      p.setAttribute("aria-label", "Verse " + v[0] + ", select");
      var num = document.createElement("span");
      num.className = "verse-num";
      num.textContent = v[0];
      p.appendChild(num);
      p.appendChild(document.createTextNode(v[1]));
      var toggle = function () {
        var on = p.classList.toggle("selected");
        p.setAttribute("aria-pressed", on ? "true" : "false");
      };
      p.addEventListener("click", toggle);
      p.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
      versesEl.appendChild(p);
    });
    $("reading-note").textContent = "Sample. Tap any verse to select it. Full chapters live in the reader app.";
    var player = $("player");
    if (s.audio) { player.classList.remove("hidden"); }
    else { player.classList.add("hidden"); $("narration").pause(); }
    $("passage-indicator").textContent = "Passage " + (index + 1) + " of " + SAMPLES.length;
    $("prev-passage").disabled = index === 0;
    $("next-passage").disabled = index === SAMPLES.length - 1;
    $("collections-view").classList.add("hidden");
    $("reading-view").classList.remove("hidden");
    $("reading-title").focus();
    requestAnimationFrame(function () { window.__readingTextMs = performance.now(); });
  }

  function setFocus(index) {
    focusIndex = (index + COLLECTIONS.length) % COLLECTIONS.length;
    stackCards.forEach(function (card, i) {
      var delta = (i - focusIndex + COLLECTIONS.length) % COLLECTIONS.length;
      card.classList.remove("is-prev", "is-focus", "is-next");
      if (delta === 0) card.classList.add("is-focus");
      else if (delta === 1) card.classList.add("is-next");
      else if (delta === COLLECTIONS.length - 1) card.classList.add("is-prev");
    });
    $("col-indicator").textContent = (focusIndex + 1) + " of " + COLLECTIONS.length;
  }

  function scrollToHub(id) {
    var section = document.getElementById("hub-" + id);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCollections() {
    var grid = $("sample-grid");
    SAMPLES.forEach(function (s, i) {
      var b = document.createElement("button");
      b.className = "sample-card";
      b.type = "button";
      b.setAttribute("role", "listitem");
      var strong = document.createElement("strong");
      strong.textContent = s.title + " " + s.chapter;
      var span = document.createElement("span");
      span.textContent = s.ref + (s.audio ? " · narration sample" : "");
      b.appendChild(strong);
      b.appendChild(span);
      b.addEventListener("click", function () { openSample(i); });
      grid.appendChild(b);
    });

    var stack = $("stack");
    COLLECTIONS.forEach(function (col, i) {
      var b = document.createElement("button");
      b.className = "collection-card";
      b.type = "button";
      b.setAttribute("role", "listitem");
      var strong = document.createElement("strong");
      strong.textContent = col.title;
      var count = document.createElement("span");
      count.className = "count";
      count.textContent = col.books.length + " books";
      var action = document.createElement("span");
      action.className = "action";
      action.textContent = "Open collection";
      b.appendChild(strong);
      b.appendChild(count);
      b.appendChild(action);
      b.addEventListener("click", function () { setFocus(i); scrollToHub(col.id); });
      stack.appendChild(b);
      stackCards.push(b);
    });
    setFocus(0);

    var hub = $("hub");
    COLLECTIONS.forEach(function (col) {
      var section = document.createElement("section");
      section.className = "hub-collection";
      section.id = "hub-" + col.id;
      var h = document.createElement("h3");
      h.textContent = col.title;
      section.appendChild(h);
      var list = document.createElement("ul");
      list.className = "book-list";
      col.books.forEach(function (id) {
        var li = document.createElement("li");
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.book = id;
        b.textContent = titleFromId(id) + " ";
        if (sampleBookIds[id]) {
          var tag = document.createElement("span");
          tag.className = "has-sample";
          tag.textContent = "· sample inside";
          b.appendChild(tag);
          b.addEventListener("click", function () {
            for (var i = 0; i < SAMPLES.length; i++) {
              if (SAMPLES[i].book === id) { openSample(i); return; }
            }
          });
        } else {
          b.addEventListener("click", function () {
            $("collection-notice").textContent = "This page carries sample passages only. The full text of " + titleFromId(id) + " lives in the reader app — nothing is invented here.";
          });
        }
        li.appendChild(b);
        list.appendChild(li);
      });
      section.appendChild(list);
      hub.appendChild(section);
    });
  }

  function applySearch(query) {
    var q = query.trim().toLowerCase();
    var sampleCards = $("sample-grid").children;
    for (var i = 0; i < sampleCards.length; i++) {
      sampleCards[i].style.display = (!q || sampleCards[i].textContent.toLowerCase().indexOf(q) !== -1) ? "" : "none";
    }
    var sections = $("hub").children;
    for (var j = 0; j < sections.length; j++) {
      var buttons = sections[j].querySelectorAll("button");
      var any = false;
      for (var k = 0; k < buttons.length; k++) {
        var show = !q || buttons[k].textContent.toLowerCase().indexOf(q) !== -1;
        buttons[k].closest("li").style.display = show ? "" : "none";
        if (show) any = true;
      }
      sections[j].style.display = any ? "" : "none";
    }
    $("collection-notice").textContent = q ? "" : $("collection-notice").textContent;
  }

  function setFontSize(px) {
    fontSize = Math.max(16, Math.min(24, px));
    document.documentElement.style.setProperty("--text-size", fontSize + "px");
  }

  $("back-to-collections").addEventListener("click", showCollections);
  $("prev-passage").addEventListener("click", function () { if (current > 0) openSample(current - 1); });
  $("next-passage").addEventListener("click", function () { if (current < SAMPLES.length - 1) openSample(current + 1); });
  $("font-smaller").addEventListener("click", function () { setFontSize(fontSize - 2); });
  $("font-larger").addEventListener("click", function () { setFontSize(fontSize + 2); });
  $("font-reset").addEventListener("click", function () { setFontSize(18); });
  $("col-prev").addEventListener("click", function () { setFocus(focusIndex - 1); });
  $("col-next").addEventListener("click", function () { setFocus(focusIndex + 1); });
  $("book-search").addEventListener("input", function (e) { applySearch(e.target.value); });
  document.addEventListener("keydown", function (e) {
    var readingOpen = !$("reading-view").classList.contains("hidden");
    if (readingOpen) {
      if (e.key === "Escape") showCollections();
      if (e.key === "ArrowLeft" && current > 0) openSample(current - 1);
      if (e.key === "ArrowRight" && current < SAMPLES.length - 1) openSample(current + 1);
      return;
    }
    if (e.key === "ArrowLeft") setFocus(focusIndex - 1);
    if (e.key === "ArrowRight") setFocus(focusIndex + 1);
  });

  renderCollections();
  requestAnimationFrame(function () { window.__firstTextMs = performance.now(); });
})();
