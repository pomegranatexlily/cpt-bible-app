/* OUSTORY Archive — 3D scripture archive prototype (repo-compatible drop-in).
   No dependencies, no network, no drag gestures. Tap/click + keyboard only.
   Sample passages below are verbatim from the Covenant text data files. */
(function () {
  'use strict';

  /* Collections follow the real 80-book canonical sequence (data/manifest.json:
     "80-title working canonical sequence"). Group labels are the prototype's
     navigation grouping, not a doctrinal claim. */
  var COLLECTIONS = [
    { id: 'torah', title: 'Torah', books: ['genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy'] },
    { id: 'history', title: 'History', books: ['joshua', 'judges', 'ruth', '1-samuel', '2-samuel', '1-kings', '2-kings', '1-chronicles', '2-chronicles', 'ezra', 'nehemiah', 'esther'] },
    { id: 'wisdom', title: 'Wisdom & Poetry', books: ['job', 'psalms', 'proverbs', 'ecclesiastes', 'song-of-solomon'] },
    { id: 'prophets', title: 'Prophets', books: ['isaiah', 'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi'] },
    { id: 'additional', title: 'Additional Books', books: ['1-esdras', '2-esdras', 'tobit', 'judith', 'the-rest-of-esther', 'the-wisdom-of-solomon', 'ecclesiasticus', 'baruch', 'the-song-of-the-three-holy-children', 'the-history-of-susanna', 'bel-and-the-dragon', 'the-prayer-of-manasses', '1-maccabees', '2-maccabees'] },
    { id: 'gospels', title: 'Gospels & Acts', books: ['matthew', 'mark', 'luke', 'john', 'acts'] },
    { id: 'letters', title: 'Letters & Revelation', books: ['romans', '1-corinthians', '2-corinthians', 'galatians', 'ephesians', 'philippians', 'colossians', '1-thessalonians', '2-thessalonians', '1-timothy', '2-timothy', 'titus', 'philemon', 'hebrews', 'james', '1-peter', '2-peter', '1-john', '2-john', '3-john', 'jude', 'revelation'] }
  ];

  /* Verbatim sample passages from cpt-bible-app/data/*.json. Nothing here is
     paraphrased or invented. Books without an entry below show an honest stub. */
  var SAMPLES = {
    genesis: {
      title: 'Genesis', ref: 'Genesis 1:1–8', note: 'Sample passage, verbatim from data/genesis.json, chapter 1.',
      verses: [
        'In the beginning, Yahawah created the heavens and the earth.',
        'The earth was unformed and empty, darkness covered the deep waters, and the Spirit of Yahawah moved over the surface of the waters.',
        'Then Yahawah said, “Let there be light.” And there was light.',
        'Yahawah saw that the light was good, and he separated the light from the darkness.',
        'Yahawah called the light Day, and he called the darkness Night. Evening came, then morning—the first day.',
        'Then Yahawah said, “Let there be an expanse between the waters to separate water from water.”',
        'Yahawah made the expanse and separated the waters beneath it from the waters above it. And it was so.',
        'Yahawah called the expanse Sky. Evening came, then morning—the second day.'
      ]
    },
    psalms: {
      title: 'Psalms', ref: 'Psalm 23:1–6', note: 'Sample passage, verbatim from data/psalms.json, chapter 23 (full chapter).',
      verses: [
        'Yahawah is my shepherd: I shall lack nothing.',
        'He makes me lie down in green pastures. He leads me beside still waters.',
        'He restores my soul. He guides me in the paths of righteousness for his name’s sake.',
        'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.',
        'You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.',
        'Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahawah’s house forever.'
      ]
    },
    john: {
      title: 'John', ref: 'John 1:1–5', note: 'Sample passage, verbatim from data/john.json, chapter 1.',
      verses: [
        'In the beginning was the Word, and the Word was with Alahayam, and the Word was divine.',
        'The same was in the beginning with Alahayam.',
        'All things were made through him. Without him, nothing was made that has been made.',
        'In him was life, and the life was the light of men.',
        'The light shines in the darkness, and the darkness hasn’t overcome it.'
      ]
    }
  };

  function titleCase(id) {
    return id.split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ').replace(/^1 /, '1 ').replace(/^2 /, '2 ').replace(/^3 /, '3 ');
  }

  var stage = document.getElementById('stage');
  var indicator = document.getElementById('collection-indicator');
  var archiveView = document.getElementById('archive-view');
  var shelfView = document.getElementById('shelf-view');
  var readingView = document.getElementById('reading-view');
  var shelfTitle = document.getElementById('shelf-title');
  var shelfCount = document.getElementById('shelf-count');
  var bookList = document.getElementById('book-list');
  var readingTitle = document.getElementById('reading-title');
  var readingRef = document.getElementById('reading-ref');
  var versesEl = document.getElementById('verses');
  var readingNote = document.getElementById('reading-note');

  var focusIndex = 0;
  var currentCollection = null;
  var currentBookIndex = -1;

  function show(view) {
    archiveView.classList.add('hidden');
    shelfView.classList.add('hidden');
    readingView.classList.add('hidden');
    view.classList.remove('hidden');
  }

  function renderCollections() {
    stage.innerHTML = '';
    COLLECTIONS.forEach(function (col, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'collection-card' + (i === focusIndex ? ' focused' : '');
      btn.style.setProperty('--depth', String(i));
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', i === focusIndex ? 'true' : 'false');
      btn.innerHTML = '<span class="card-title">' + col.title + '</span>' +
        '<span class="card-meta">' + col.books.length + ' books</span>' +
        '<span class="card-books">' + col.books.map(titleCase).join(' · ') + '</span>';
      btn.addEventListener('click', function () { focusIndex = i; openCollection(col); });
      stage.appendChild(btn);
    });
    indicator.textContent = (focusIndex + 1) + ' of ' + COLLECTIONS.length;
  }

  function moveFocus(delta) {
    focusIndex = (focusIndex + COLLECTIONS.length + delta) % COLLECTIONS.length;
    renderCollections();
    var cards = stage.querySelectorAll('.collection-card');
    if (cards[focusIndex]) cards[focusIndex].focus();
  }

  function openCollection(col) {
    currentCollection = col;
    shelfTitle.textContent = col.title;
    shelfCount.textContent = col.books.length + ' books in this collection.';
    bookList.innerHTML = '';
    col.books.forEach(function (bookId, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span>' + titleCase(bookId) + '</span>' +
        (SAMPLES[bookId] ? '<span class="sample-tag">Sample included</span>' : '<span class="sample-tag">Stub</span>');
      btn.addEventListener('click', function () { currentBookIndex = i; openReading(bookId); });
      li.appendChild(btn);
      bookList.appendChild(li);
    });
    show(shelfView);
  }

  function openReading(bookId) {
    var sample = SAMPLES[bookId];
    readingTitle.textContent = titleCase(bookId);
    versesEl.innerHTML = '';
    if (sample) {
      readingRef.textContent = sample.ref;
      sample.verses.forEach(function (text, i) {
        var p = document.createElement('p');
        var num = document.createElement('span');
        num.className = 'vnum';
        num.textContent = String(i + 1);
        p.appendChild(num);
        p.appendChild(document.createTextNode(text));
        versesEl.appendChild(p);
      });
      readingNote.textContent = sample.note;
    } else {
      readingRef.textContent = 'Prototype stub';
      var p = document.createElement('p');
      p.textContent = 'The full text of this book is not included in the prototype. In the real app, this view loads data/' + bookId + '.json — the same file the reader already uses — so no text is invented here.';
      versesEl.appendChild(p);
      readingNote.textContent = 'Prototype only. No translation, witness, or reading has been fabricated.';
    }
    show(readingView);
  }

  function stepBook(delta) {
    if (!currentCollection) return;
    var books = currentCollection.books;
    currentBookIndex = (currentBookIndex + books.length + delta) % books.length;
    openReading(books[currentBookIndex]);
  }

  document.getElementById('prev-collection').addEventListener('click', function () { moveFocus(-1); });
  document.getElementById('next-collection').addEventListener('click', function () { moveFocus(1); });
  document.getElementById('back-to-archive').addEventListener('click', function () { show(archiveView); renderCollections(); });
  document.getElementById('back-to-shelf').addEventListener('click', function () { if (currentCollection) openCollection(currentCollection); });
  document.getElementById('prev-book').addEventListener('click', function () { stepBook(-1); });
  document.getElementById('next-book').addEventListener('click', function () { stepBook(1); });

  document.addEventListener('keydown', function (e) {
    if (archiveView.classList.contains('hidden') === false) {
      if (e.key === 'ArrowLeft') moveFocus(-1);
      if (e.key === 'ArrowRight') moveFocus(1);
      if (e.key === 'Enter') openCollection(COLLECTIONS[focusIndex]);
    } else if (readingView.classList.contains('hidden') === false) {
      if (e.key === 'ArrowLeft') stepBook(-1);
      if (e.key === 'ArrowRight') stepBook(1);
      if (e.key === 'Escape' && currentCollection) openCollection(currentCollection);
    } else if (e.key === 'Escape') {
      show(archiveView);
      renderCollections();
    }
  });

  /* Graceful degradation: no CSS 3D support -> flat layout, same content. */
  var supports3d = false;
  try { supports3d = window.CSS && CSS.supports('transform-style', 'preserve-3d'); } catch (err) { supports3d = false; }
  if (!supports3d) {
    document.body.classList.add('flat');
    document.getElementById('fallback-note').classList.remove('hidden');
  }

  renderCollections();
})();
