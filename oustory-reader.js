"use strict";
// Oustory CPT–APE reader. Source: verified 527-page Isaiah-complete master.
// Each of the 23 books loads only when opened (or when a search needs it).
(() => {
  const $ = selector => document.querySelector(selector);
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const books = Array.isArray(window.CPT_BOOKS) ? window.CPT_BOOKS : [];
  const cache = new Map();
  const inflight = new Map();
  let bi = 0, ci = 0, renderToken = 0, searchToken = 0, touch = null;
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  const prefs = {size:21, spacing:'1.85', appearance:'dark', ...read('cpt.reader.settings', {})};
  let saved = read('cpt.reader.saved', []);
  if (!Array.isArray(saved)) saved = [];
  const book = () => books[bi];
  const chapter = () => book()?.chapters?.[ci];
  function verseText(verse) {
    return typeof verse.text === 'string' ? verse.text :
      (Array.isArray(verse.parts) ? verse.parts.map(part => part.text).join('') : '');
  }
  async function loadBook(id) {
    if (cache.has(id)) return cache.get(id);
    if (inflight.has(id)) return inflight.get(id);
    const meta = books.find(item => item.id === id);
    if (!meta) throw new Error('Book is not in this verified test edition.');
    const promise = (async () => {
      const response = await fetch('data/' + encodeURIComponent(id) + '.json');
      if (!response.ok) throw new Error('Unable to download ' + meta.title + ' (' + response.status + ').');
      const data = await response.json();
      if (data.id !== meta.id || !Array.isArray(data.chapters) || data.chapters.length !== meta.chapters.length) {
        throw new Error(meta.title + ' has an unexpected chapter inventory.');
      }
      for (let i = 0; i < data.chapters.length; i++) {
        const c = data.chapters[i], expected = meta.chapters[i];
        if (c.number !== expected.number || !Array.isArray(c.verses) || c.verses.length !== expected.verseCount ||
          !c.verses.every((v,j) => v.number === j+1 && !!verseText(v).trim())) {
          throw new Error(meta.title + ' ' + expected.number + ' failed verse integrity verification.');
        }
      }
      cache.set(id, data);
      return data;
    })();
    inflight.set(id, promise);
    try { return await promise; } finally { inflight.delete(id); }
  }
  function apply() {
    document.documentElement.dataset.theme = prefs.appearance;
    document.documentElement.style.setProperty('--size', prefs.size + 'px');
    document.documentElement.style.setProperty('--leading', prefs.spacing);
    $('#text-size').value = prefs.size;
    $('#line-spacing').value = prefs.spacing;
    $('#appearance').value = prefs.appearance;
    document.querySelector('meta[name="theme-color"]').content = prefs.appearance === 'paper' ? '#f3f0e8' : '#111111';
  }
  function closePanels() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }
  function updateControls() {
    if (!chapter()) return;
    const title = book().title + ' ' + chapter().number;
    $('#reference').textContent = title;
    $('#chapter-title').textContent = title;
    $('#previous').disabled = bi === 0 && ci === 0;
    $('#next').disabled = bi === books.length - 1 && ci === book().chapters.length - 1;
  }
  function showMessage(message, retry = false) {
    $('#empty-state').hidden = true;
    $('#scripture').hidden = false;
    const p = make('p', message, 'reader-notice');
    $('#scripture').replaceChildren(p);
    if (retry) {
      const btn = make('button', 'Retry loading chapter', 'primary-action');
      btn.onclick = render;
      $('#scripture').append(btn);
    }
  }
  async function render() {
    if (!chapter()) return;
    const token = ++renderToken, selectedId = book().id, selectedChapter = chapter().number;
    updateControls();
    showMessage('Loading ' + book().title + ' ' + selectedChapter + '…');
    $('#save-place').disabled = true;
    try {
      const data = await loadBook(selectedId);
      if (token !== renderToken) return;
      const chapterData = data.chapters.find(c => c.number === selectedChapter);
      const verses = chapterData?.verses;
      if (!verses) throw new Error('This chapter is unavailable in the verified source.');
      const container = $('#scripture');
      const fragment = document.createDocumentFragment();
      if (chapterData.intro) fragment.append(make('p', chapterData.intro, 'psalm-intro'));
      const paragraph = make('p');
      for (const v of verses) {
        const number = make('span', String(v.number), 'verse-number');
        number.id = 'verse-' + v.number;
        paragraph.append(number);
        if (typeof v.text === 'string') paragraph.append(document.createTextNode(v.text));
        else for (const part of v.parts) {
          const color = ['blue', 'green', 'purple'].includes(part.color) ? part.color : 'black';
          if (color === 'black') paragraph.append(document.createTextNode(part.text));
          else paragraph.append(make('span', part.text, 'speaker-' + color));
        }
        paragraph.append(document.createTextNode(' '));
      }
      fragment.append(paragraph);
      container.replaceChildren(fragment);
      $('#save-place').disabled = false;
      $('#reader').scrollTop = 0;
      write('cpt.reader.position', {book:selectedId, chapter:selectedChapter});
    } catch (error) {
      if (token !== renderToken) return;
      showMessage(error.message || 'Unable to read this chapter.', true);
    }
  }
  function move(direction) {
    if (!chapter()) return;
    let b = bi, c = ci + direction;
    if (c < 0) { if (--b < 0) return; c = books[b].chapters.length - 1; }
    else if (c >= book().chapters.length) { if (++b >= books.length) return; c = 0; }
    bi = b; ci = c; render();
  }
  async function go(id, chapterNumber, verseNumber) {
    const b = books.findIndex(x => x.id === id);
    if (b < 0) return false;
    const c = books[b].chapters.findIndex(x => x.number === Number(chapterNumber));
    if (c < 0) return false;
    bi = b; ci = c;
    const waitFor = render();
    closePanels();
    await waitFor;
    if (verseNumber != null) document.getElementById('verse-' + verseNumber)?.scrollIntoView({block:'center'});
    return true;
  }
  function library(selected = null) {
    const list = $('#book-list'), chapters = $('#chapter-list');
    list.replaceChildren(); chapters.replaceChildren();
    $('#books-empty').hidden = books.length > 0;
    if (selected === null) {
      chapters.hidden = true;
      books.forEach((b, index) => {
        const node = make('button', b.title, 'list-button');
        node.onclick = () => library(index);
        list.append(node);
      });
    } else {
      chapters.hidden = false;
      const back = make('button', '‹  All books', 'list-button');
      back.onclick = () => library();
      list.append(back, make('h3', books[selected].title + ' — Chapters', 'chapter-picker-title'));
      for (const c of books[selected].chapters) {
        const node = make('button', String(c.number));
        node.setAttribute('aria-label', books[selected].title + ', chapter ' + c.number);
        node.setAttribute('aria-current', String(selected === bi && c.number === chapter()?.number));
        node.onclick = () => { go(books[selected].id, c.number); };
        chapters.append(node);
      }
    }
  }
  async function search() {
    const token = ++searchToken;
    const q = $('#search-input').value.trim().toLocaleLowerCase();
    const result = $('#search-results');
    result.replaceChildren();
    if (!q) { $('#search-status').textContent = 'Enter a word or phrase.'; return; }
    let total = 0, failure = 0;
    $('#search-status').textContent = 'Searching verified Genesis–Isaiah books…';
    for (const meta of books) {
      if (token !== searchToken) return;
      let data;
      try { data = await loadBook(meta.id); }
      catch { failure++; continue; }
      if (token !== searchToken) return;
      for (const c of data.chapters) for (const v of c.verses) {
        const text = verseText(v);
        if (!text.toLocaleLowerCase().includes(q)) continue;
        total++;
        if (total > 100) continue;
        const node = make('button', meta.title + ' ' + c.number + ':' + v.number, 'list-button');
        node.append(make('small', text.length > 180 ? text.slice(0,180) + '…' : text));
        node.onclick = () => go(meta.id, c.number, v.number);
        result.append(node);
      }
      $('#search-status').textContent = 'Searching… ' + total + ' matches';
    }
    $('#search-status').textContent = total + ' matching verses' + (total > 100 ? ' · Showing first 100' : '') + (failure ? ' · ' + failure + ' books could not load' : '');
  }
  function savedList() {
    const list = $('#saved-list'); list.replaceChildren();
    if (!saved.length) { list.append(make('p', 'No saved places yet.', 'sheet-copy')); return; }
    saved.forEach((s,i) => {
      const row = make('div', undefined, 'saved-row'), btn = make('button', s.label, 'list-button'), remove = make('button', '×', 'icon-button');
      btn.onclick = async () => { if (!await go(s.book, s.chapter)) $('#save-status').textContent = 'This chapter is not in the current collection.'; };
      remove.setAttribute('aria-label', 'Remove ' + s.label);
      remove.onclick = () => { saved.splice(i,1); write('cpt.reader.saved', saved); savedList(); };
      row.append(btn,remove); list.append(row);
    });
  }
  document.querySelectorAll('[data-panel]').forEach(node => node.onclick = () => {
    const id = node.dataset.panel;
    if (id === 'books-panel') library();
    if (id === 'search-panel') { ++searchToken; $('#search-results').replaceChildren(); $('#search-status').textContent = 'Search Genesis through Isaiah.'; }
    if (id === 'saved-panel') savedList();
    document.getElementById(id).showModal();
  });
  document.querySelectorAll('[data-close]').forEach(node => node.onclick = () => node.closest('dialog').close());
  $('#read-button').onclick = () => { closePanels(); $('#reader').focus(); };
  $('#previous').onclick = () => move(-1);
  $('#next').onclick = () => move(1);
  $('#save-place').onclick = () => {
    if (!chapter()) return;
    const exists = saved.some(s => s.book === book().id && s.chapter === chapter().number);
    if (!exists) saved.push({book:book().id, chapter:chapter().number, label:book().title+' '+chapter().number});
    $('#save-status').textContent = write('cpt.reader.saved', saved) ? (exists ? 'This chapter is already saved.' : 'Chapter saved.') : 'Saved for this session; browser storage unavailable.';
    savedList();
  };
  for (const [id,key] of [['text-size','size'],['line-spacing','spacing'],['appearance','appearance']])
    $('#'+id).addEventListener('input', event => {
      prefs[key] = key === 'size' ? Number(event.target.value) : event.target.value;
      apply(); write('cpt.reader.settings', prefs);
    });
  let searchTimer;
  $('#search-input').oninput = () => { ++searchToken; clearTimeout(searchTimer); searchTimer = setTimeout(search, 230); };
  $('#reader').addEventListener('touchstart', e => {
    touch = e.touches.length === 1 ? {x:e.touches[0].clientX, y:e.touches[0].clientY, time:Date.now()} : null;
  }, {passive:true});
  $('#reader').addEventListener('touchend', e => {
    if (!touch || !e.changedTouches.length) return;
    const t=e.changedTouches[0], dx=t.clientX-touch.x, dy=t.clientY-touch.y, elapsed=Date.now()-touch.time;
    touch=null;
    if (window.getSelection()?.toString()) return;
    if (elapsed < 700 && Math.abs(dx)>80 && Math.abs(dx)>Math.abs(dy)*2) move(dx<0?1:-1);
  }, {passive:true});
  $('#reader').addEventListener('touchcancel', () => touch=null);
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey || ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)) return;
    if (e.key==='ArrowLeft'||e.key==='ArrowRight') {e.preventDefault();move(e.key==='ArrowRight'?1:-1);}
  });
  apply();
  if (books.length) {
    const last=read('cpt.reader.position',null);
    if (!last || !books.some(b => b.id === last.book && b.chapters.some(c => c.number === last.chapter))) render();
    else go(last.book,last.chapter);
  } else showMessage('No verified manuscript index was loaded.', true);
  (async () => {
    try { const fonts = await document.fonts.load('400 16px "Schibsted Grotesk"');
      $('#font-status').textContent = fonts.length ? 'Schibsted Grotesk loaded.' : 'Using system font fallback.';
    } catch { $('#font-status').textContent = 'Using system font fallback.'; }
  })();
})();