"use strict";
// Oustory CPT–APE reader: 80-title editable working edition.
// Earlier Genesis–Isaiah wording is retained; newly imported books are provisional.
(() => {
  const $ = selector => document.querySelector(selector);
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const books = Array.isArray(window.CPT_BOOKS) ? window.CPT_BOOKS : [];
  // Never insert Supplemental Writings into the 80-book primary canon.
  const supplements = Array.isArray(window.CPT_SUPPLEMENTAL_BOOKS) ? window.CPT_SUPPLEMENTAL_BOOKS : [];
  const cache = new Map();
  const inflight = new Map();
  let bi = 0, ci = 0, renderToken = 0, touch = null, scrollSaveTimer = null;
  let supplementActive = null;
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
    if (!meta) throw new Error('Book is unavailable in this reading edition.');
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
          !c.verses.every((v,j) => Number.isInteger(v.number) &&
            v.number >= (expected.firstVerse ?? 1) && v.number <= (expected.lastVerse ?? expected.verseCount) &&
            (j === 0 ? v.number === (expected.firstVerse ?? 1) : v.number > c.verses[j-1].number) &&
            !!verseText(v).trim())) {
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
    let disclosure=$('#reader-source-disclosure');
    if(!disclosure){
      disclosure=make('p',undefined,'reader-source-disclosure');
      disclosure.id='reader-source-disclosure';
      $('#chapter-title').after(disclosure);
    }
    disclosure.hidden=!book().sourceStatus;
    disclosure.textContent=book().sourceStatus ? 'Editable source-based reading text. This book has not yet received final CPT–APE authorial approval; compare the editorial apparatus before treating contested wording as settled.' : '';
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
  async function render(targetVerse = 1) {
    if (!chapter()) return;
    const token = ++renderToken, selectedId = book().id, selectedChapter = chapter().number;
    window.OustoryAudio?.loading();
    updateControls();
    showMessage('Loading ' + book().title + ' ' + selectedChapter + '…');
    $('#scripture').setAttribute('aria-busy','true');
    $('#save-place').disabled = true;
    try {
      const data = await loadBook(selectedId);
      if (token !== renderToken) return;
      const chapterData = data.chapters.find(c => c.number === selectedChapter);
      const verses = chapterData?.verses;
      if (!verses) throw new Error('This chapter is unavailable in the verified source.');
      window.OustoryAudio?.setChapter({bookId:selectedId, book:book().title, chapter:selectedChapter, verses});
      const container = $('#scripture');
      const fragment = document.createDocumentFragment();
      if (chapterData.intro) fragment.append(make('p', chapterData.intro, 'psalm-intro'));
      const paragraph = make('p');
      for (const v of verses) {
        const wrapper = window.OustoryFeatures?.annotateVerse({book:book().title,id:selectedId,chapter:selectedChapter,verse:v.number,text:verseText(v)}) || make("span");
        const number = make('span', String(v.number), 'verse-number');
        number.id = 'verse-' + v.number;
        wrapper.append(number);
        if (typeof v.text === 'string') wrapper.append(document.createTextNode(v.text));
        else for (const part of v.parts) {
          const color = ['blue', 'green', 'purple'].includes(part.color) ? part.color : 'black';
          if (color === 'black') wrapper.append(document.createTextNode(part.text));
          else wrapper.append(make('span', part.text, 'speaker-' + color));
        }
        wrapper.append(document.createTextNode(' '));
        paragraph.append(wrapper);
      }
      fragment.append(paragraph);
      container.replaceChildren(fragment);
      window.OustoryFeatures?.refreshNotes();
      $('#save-place').disabled = false;
      $('#reader').scrollTop = 0;
      $('#scripture').setAttribute('aria-busy','false');
      // Carry a specific resume verse across restarts; never rewrite the
      // source verse numbering or invent an omitted source position.
      const actualVerse = Number.isInteger(Number(targetVerse)) &&
        verses.some(v => v.number === Number(targetVerse)) ? Number(targetVerse) : verses[0].number;
      write('cpt.reader.position', {book:selectedId, chapter:selectedChapter, verse:actualVerse});
    } catch (error) {
      if (token !== renderToken) return;
      showMessage(error.message || 'Unable to read this chapter.', true);
      $('#scripture').setAttribute('aria-busy','false');
    }
  }
  function move(direction) {
    if (!chapter()) return;
    supplementActive = null;
    let b = bi, c = ci + direction;
    if (c < 0) { if (--b < 0) return; c = books[b].chapters.length - 1; }
    else if (c >= book().chapters.length) { if (++b >= books.length) return; c = 0; }
    bi = b; ci = c;
    window.OustoryFeatures?.showBible();
    render();
  }
  async function go(id, chapterNumber, verseNumber) {
    const b = books.findIndex(x => x.id === id);
    if (b < 0) return false;
    const c = books[b].chapters.findIndex(x => x.number === Number(chapterNumber));
    if (c < 0) return false;
    supplementActive = null;
    bi = b; ci = c;
    window.OustoryFeatures?.showBible();
    const waitFor = render(verseNumber == null ? 1 : verseNumber);
    closePanels();
    await waitFor;
    if (verseNumber != null) {
      const el = document.getElementById('verse-' + verseNumber);
      el?.scrollIntoView({block:'start'});
    }
    return true;
  }
  const SUPPLEMENTAL_NOTICE = 'Supplemental Writings · historical English source draft. This reading has not been fully collated or modernized into CPT–APE house style; no claim of primary-canon authority or authorial approval.';

  async function readSupplement(id, chapterNumber) {
    const meta = supplements.find(b => b.id === id && b.readable_witness);
    if (!meta || !Number.isInteger(chapterNumber)) return false;
    const token = ++renderToken;
    closePanels();
    window.OustoryFeatures?.showBible();
    supplementActive = {meta, chapter:chapterNumber};
    $('#empty-state').hidden = true;
    $('#scripture').hidden = false;
    $('#scripture').replaceChildren(make('p','Loading '+meta.title+'…','reader-notice'));
    $('#scripture').setAttribute('aria-busy','true');
    $('#save-place').disabled = true;
    $('#reference').textContent = meta.title + ' ' + chapterNumber;
    $('#chapter-title').textContent = meta.title + ' ' + chapterNumber;
    let disclosure = $('#reader-source-disclosure');
    if (!disclosure) {
      disclosure = make('p',undefined,'reader-source-disclosure');
      disclosure.id = 'reader-source-disclosure';
      $('#chapter-title').after(disclosure);
    }
    disclosure.hidden = false;
    disclosure.textContent = SUPPLEMENTAL_NOTICE;
    $('#previous').disabled = true;
    $('#next').disabled = true;
    try {
      let doc = cache.get('supplement:'+id);
      if (!doc) {
        const response = await fetch('data/supplemental/'+encodeURIComponent(id)+'.json');
        if (!response.ok) throw new Error('Supplemental source is unavailable ('+response.status+').');
        doc = await response.json();
        if (doc.id !== id || doc.collection !== 'SUPPLEMENTAL_WRITINGS' ||
            doc.author_approved !== false || !Array.isArray(doc.chapters) || !doc.chapters.length ||
            !doc.chapters.every((c,i)=>Number.isInteger(c.number) && c.number===i+1 &&
              Array.isArray(c.verses) && c.verses.length>0 &&
              c.verses.every((v,j)=>Number.isInteger(v.number) &&
                v.number>0 && (j===0 || v.number>c.verses[j-1].number) &&
                typeof v.text==='string' && v.text.trim().length>0))) {
          throw new Error('Supplemental source failed manuscript structure checks.');
        }
        cache.set('supplement:'+id, doc);
      }
      if (token !== renderToken || supplementActive?.meta.id !== id) return false;
      const chapter = doc.chapters.find(x => x.number === chapterNumber);
      if (!chapter) throw new Error('This source chapter is unavailable.');
      const paragraph = make('p');
      for (const verse of chapter.verses) {
        const span = make('span');
        span.append(make('span',String(verse.number),'verse-number'),document.createTextNode(verse.text+' '));
        paragraph.append(span);
      }
      $('#scripture').replaceChildren(paragraph);
      $('#reader').scrollTop=0;
      $('#previous').disabled = chapterNumber <= 1;
      $('#next').disabled = chapterNumber >= doc.chapters.length;
      $('#scripture').setAttribute('aria-busy','false');
      return true;
    } catch(error) {
      if (token !== renderToken) return false;
      $('#scripture').replaceChildren(make('p',error.message||'Supplemental source unavailable.','reader-notice'));
      $('#scripture').setAttribute('aria-busy','false');
      return false;
    }
  }

  function moveSupplement(direction) {
    if (!supplementActive) return;
    const {meta,chapter} = supplementActive;
    const next = chapter+direction;
    // Only the currently staged complete witness is readable here.
    const doc = cache.get('supplement:'+meta.id);
    if (!doc || next<1 || next>doc.chapters.length) return;
    void readSupplement(meta.id,next);
  }

  function library(selected = null) {
    const list = $('#book-list'), chapters = $('#chapter-list');
    list.replaceChildren(); chapters.replaceChildren();
    $('#books-empty').hidden = books.length > 0;
    if (selected === null) {
      chapters.hidden = true;
      list.append(make('h3','Primary Canon — 80 Books','chapter-picker-title'));
      books.forEach((b, index) => {
        const node = make('button', b.title, 'list-button');
        node.onclick = () => library(index);
        list.append(node);
      });
      list.append(make('h3','Supplemental Writings — 19 Books','chapter-picker-title'));
      list.append(make('p','Separate historical collection. Source status is shown for each work; unverified drafts are not primary-canon Scripture.','sheet-copy'));
      supplements.forEach(b=>{
        const node=make('button',b.title,'list-button');
        node.onclick=()=>library('supplement:'+b.id);
        node.append(make('small',b.readable_witness?'Historical source draft available':'Text in preparation'));
        list.append(node);
      });
    } else {
      chapters.hidden = false;
      const back = make('button', '‹  All books', 'list-button');
      back.onclick = () => library();
      list.append(back);
      if (typeof selected==='string' && selected.startsWith('supplement:')) {
        const b=supplements.find(x=>x.id===selected.slice('supplement:'.length));
        if (!b) {library();return}
        list.append(make('h3',b.title+' — Supplemental Writings','chapter-picker-title'));
        list.append(make('p',b.edition_status,'sheet-copy'));
        if (b.readable_witness) {
          list.append(make('p','Source-attributed historical English; modernization, divine-name review, and editorial collation pending.','sheet-copy'));
          for(let n=1;n<=7;n++){
            const node=make('button',String(n));
            node.setAttribute('aria-label',b.title+', chapter '+n+', historical source draft');
            node.onclick=()=>void readSupplement(b.id,n);
            chapters.append(node);
          }
        } else {
          list.append(make('p','This work is in the 19-book collection, but its complete reliable reading text is not ready for publication. No invented chapters or verses will be shown.','sheet-copy'));
        }
      } else {
        list.append(make('h3', books[selected].title + ' — Chapters', 'chapter-picker-title'));
        for (const c of books[selected].chapters) {
          const node = make('button', String(c.number));
          node.setAttribute('aria-label', books[selected].title + ', chapter ' + c.number);
          node.setAttribute('aria-current', String(selected === bi && c.number === chapter()?.number));
          node.onclick = () => { go(books[selected].id, c.number); };
          chapters.append(node);
        }
      }
    }
  }
  function savedList() {
    const list = $('#saved-list'); list.replaceChildren();
    if (!saved.length) { list.append(make('p', 'No saved places yet.', 'sheet-copy')); return; }
    saved.forEach((s,i) => {
      const row = make('div', undefined, 'saved-row'), btn = make('button', s.label, 'list-button'), remove = make('button', '×', 'icon-button');
      btn.onclick = async () => { if (!await go(s.book, s.chapter, s.verse)) $('#save-status').textContent = 'This saved location is unavailable in the current edition.'; };
      remove.setAttribute('aria-label', 'Remove ' + s.label);
      remove.onclick = () => { saved.splice(i,1); write('cpt.reader.saved', saved); savedList(); };
      row.append(btn,remove); list.append(row);
    });
  }
  document.querySelectorAll('[data-panel]').forEach(node => node.onclick = () => {
    const id = node.dataset.panel;
    if (id === 'books-panel') library();
    if (id === 'search-panel') window.OustorySearch?.opened();
    if (id === 'saved-panel') savedList();
    document.getElementById(id).showModal();
  });
  document.querySelectorAll('[data-close]').forEach(node => node.onclick = () => node.closest('dialog').close());
  $('#read-button').onclick = () => { closePanels(); $('#reader').focus(); };
  $('#previous').onclick = () => supplementActive ? moveSupplement(-1) : move(-1);
  $('#next').onclick = () => supplementActive ? moveSupplement(1) : move(1);
  function openSaved() {
    closePanels();
    savedList();
    $('#saved-panel').showModal();
  }
  function saveBookmark(record) {
    if (!record || !books.some(b => b.id === record.book &&
         b.chapters.some(c => c.number === record.chapter))) return false;
    const verse = Number(record.verse);
    const safeVerse = Number.isInteger(verse) && verse > 0 ? verse : null;
    const exists = saved.some(item =>
      item.book === record.book && item.chapter === record.chapter &&
      (item.verse ?? null) === safeVerse);
    if (!exists) {
      saved.push({book:record.book,chapter:record.chapter,
        ...(safeVerse ? {verse:safeVerse} : {}),label:record.label});
    }
    const persisted = write('cpt.reader.saved', saved);
    $('#save-status').textContent = persisted ?
      (exists ? 'Already in your saved places.' : 'Saved to this device.') :
      'Saved for this session only; device storage is unavailable.';
    savedList();
    return persisted;
  }
  function saveVerse(bookId, chapterNumber, verseNumber) {
    const meta=books.find(b => b.id===bookId);
    const chapterMeta=meta?.chapters.find(c => c.number===Number(chapterNumber));
    if (!chapterMeta || !Number.isInteger(verseNumber) || verseNumber < 1 ||
        verseNumber < (chapterMeta.firstVerse ?? 1) ||
        verseNumber > (chapterMeta.lastVerse ?? chapterMeta.verseCount)) return false;
    return saveBookmark({book:bookId,chapter:Number(chapterNumber),
      verse:verseNumber,label:meta.title+' '+chapterNumber+':'+verseNumber});
  }
  $('#save-place').onclick = () => {
    if (supplementActive || !chapter()) return;
    saveBookmark({book:book().id,chapter:chapter().number,label:book().title+' '+chapter().number});
  };
  function storeVisibleVerse() {
    if (document.body.classList.contains('feature-mode') || supplementActive || !chapter()) return;
    const reader=$('#reader'), top=reader.getBoundingClientRect().top + 15;
    // Scroll across long inline verse spans, not chapter-sized text blocks.
    const entries=[...$('#scripture').querySelectorAll('.verse-entry')];
    const visible=entries.find(e => e.getBoundingClientRect().bottom > top);
    if (!visible) return;
    const verse=Number(visible.dataset.verse);
    if (!Number.isInteger(verse)) return;
    write('cpt.reader.position',{book:book().id,chapter:chapter().number,verse});
  }
  $('#reader').addEventListener('scroll', () => {
    if (document.body.classList.contains('feature-mode') || supplementActive) return;
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer=setTimeout(storeVisibleVerse,180);
  }, {passive:true});
  for (const [id,key] of [['text-size','size'],['line-spacing','spacing'],['appearance','appearance']])
    $('#'+id).addEventListener('input', event => {
      prefs[key] = key === 'size' ? Number(event.target.value) : event.target.value;
      apply(); write('cpt.reader.settings', prefs);
    });
  window.OustorySearch?.init({books,go});
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
    const lastIndex=books.findIndex(b => b.id === last?.book &&
      b.chapters.some(c => c.number === last.chapter));
    // Initialize the saved chapter behind Home. Do not call go() until
    // OustoryFeatures.init has mounted its navigation/root (returning
    // readers previously hit root.hidden on an undefined feature root).
    if (lastIndex >= 0) {
      bi=lastIndex;
      ci=books[bi].chapters.findIndex(c => c.number === last.chapter);
    }
    render(lastIndex >= 0 && Number.isInteger(last?.verse) ? last.verse : 1);
  } else showMessage('No verified manuscript index was loaded.', true);
  (async () => {
    try { const fonts = await document.fonts.load('400 16px "Schibsted Grotesk"');
      $('#font-status').textContent = fonts.length ? 'Schibsted Grotesk loaded.' : 'Using system font fallback.';
    } catch { $('#font-status').textContent = 'Using system font fallback.'; }
  })();
  window.OustoryResearch?.init({books,loadBook});
  window.OustoryAudio?.init();
  window.OustoryReader={openSaved,saveVerse,getPosition:()=>read('cpt.reader.position',null)};
  window.OustoryFeatures?.init({go,loadBook,books});
})();