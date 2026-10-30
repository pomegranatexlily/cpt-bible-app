"use strict";
/* Oustory: source-grounded covenant home, study notes, and plans.
   Does not change scripture JSON or claim sealed approval for draft notes. */
(() => {
  const THEMES=[
    ["The Name","exodus",3,15,"Remember the Name in covenant context"],
    ["The Covenant","jeremiah",31,31,"Attend to the named covenant parties"],
    ["The Nation","isaiah",49,3,"Read the servant in the national address"],
    ["The King","psalms",2,6,"Kingship and anointing"],
    ["The Law","deuteronomy",6,4,"Hear the covenant confession"],
    ["The Land","genesis",12,7,"Promises made to the seed"],
    ["The Assembly","exodus",19,6,"A nation set apart for service"],
    ["The Return","isaiah",11,12,"The gathering of the scattered"]
  ];
  // Use the reader's local calendar date, not UTC or a seven-day bucket.
  const localDayIndex=(date=new Date())=>
    Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const selectDailyTheme=(date=new Date())=>THEMES[localDayIndex(date)%THEMES.length];
  const TOPICS=[
    ["Covenant","jeremiah",31,31],["Kingdom","psalms",2,6],
    ["Nation","isaiah",49,3],["Law","deuteronomy",6,4],
    ["Lineage","genesis",12,1],["Land","genesis",12,7],
    ["Exile","jeremiah",29,10],["Return","isaiah",11,12],
    ["Assembly","exodus",19,6],["Kingship","1-samuel",16,13],
    ["Priesthood","exodus",19,6],["Sabbath","genesis",2,3],
    ["Justice","isaiah",1,17],["Mercy","micah",6,8],
    ["Faithfulness","deuteronomy",7,9]
  ];
  const PLANS=[
    {id:"torah",title:"Torah Foundations",description:"Start with creation, calling, deliverance, law, and covenant responsibilities.",
      steps:[["Genesis 1","genesis",1],["Genesis 12","genesis",12],["Exodus 12","exodus",12],
             ["Exodus 20","exodus",20],["Deuteronomy 6","deuteronomy",6]]},
    {id:"nation",title:"The Nation's Story",description:"Read the national narrative through entrance, judges, monarchy, exile, and restoration.",
      steps:[["Joshua 1","joshua",1],["Judges 2","judges",2],["1 Samuel 8","1-samuel",8],
             ["2 Kings 17","2-kings",17],["Ezra 1","ezra",1]]},
    {id:"prophets",title:"The Prophets: Covenant Enforcement",description:"The prophetic summons to accountability, justice, and return.",
      steps:[["Isaiah 1","isaiah",1],["Jeremiah 7","jeremiah",7],["Ezekiel 18","ezekiel",18],
             ["Amos 5","amos",5],["Malachi 3","malachi",3]]},
    {id:"king",title:"The Anointed King",description:"A royal reading path through the Gospels and the assemblies.",
      steps:[["Matthew 1","matthew",1],["Matthew 5","matthew",5],["Luke 4","luke",4],
             ["Acts 2","acts",2],["Revelation 22","revelation",22]]}
  ];
  const byId=id=>document.getElementById(id);
  const el=(tag,text,cls)=>{
    const x=document.createElement(tag);
    if(text!==undefined)x.textContent=text;
    if(cls)x.className=cls;
    return x;
  };
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const refKey=(book,chapter,verse)=>book+" "+chapter+":"+verse;
  const labelOf=api=>api.books.find(x=>x.id===api.book)?.title||api.book;
  const notesByRef=new Map();
  const highlights=new Set(Array.isArray(read("oustory.highlights",[]))?read("oustory.highlights",[]):[]);
  let api,root,verseDialog,currentView="bible",selected=null;
  let homeDayIndex=null,homeRenderId=0,dailyRefreshTimer=null;
  const textOf=v=>typeof v.text==="string"?v.text:(v.parts||[]).map(p=>p.text).join("");
  function addAction(parent,label,handler,primary=false){
    const b=el("button",label,"feature-action"+(primary?" primary":""));
    b.type="button";b.onclick=handler;parent.append(b);return b;
  }
  function card(parent,heading){
    const c=el("section",undefined,"feature-card");
    if(heading)c.append(el("h2",heading));
    parent.append(c);return c;
  }
  function actions(parent){const x=el("div",undefined,"feature-actions");parent.append(x);return x;}
  function title(eyebrow,heading,desc){
    root.append(el("p",eyebrow,"feature-eyebrow"),el("h1",heading,"feature-title"),el("p",desc,"feature-description"));
  }
  function setCurrent(view){
    currentView=view;
    document.querySelectorAll(".bottom-dock .dock-button").forEach(b=>{
      if(b.dataset.view===view)b.setAttribute("aria-current","page");
      else b.removeAttribute("aria-current");
    });
  }
  function showBible(){
    window.OustoryWorkbench?.dismiss();
    window.OustoryMoon?.unmount();
    window.OustoryShabbat?.unmount();
    document.body.classList.remove("feature-mode");
    root.hidden=true;
    const ref=byId("reference"),chapter=byId("chapter-title");
    if(ref&&chapter&&chapter.textContent)ref.textContent=chapter.textContent;
    setCurrent("bible");
  }
  function show(view){
    if(view==="bible"){showBible();byId("reader").focus();return}
    window.OustoryWorkbench?.dismiss();
    window.OustoryMoon?.unmount();
    window.OustoryShabbat?.unmount();
    window.OustoryAudio?.stop(); // Never leave unseen audio playing behind another app screen.
    if(view==="more"){
      const menu=byId("oustory-menu");
      if(menu)menu.showModal();
      else byId("edition-panel")?.showModal();
      return;
    }
    document.body.classList.add("feature-mode");
    const ref=byId("reference");if(ref)ref.textContent="Oustory";
    root.hidden=false;root.replaceChildren();setCurrent(view);
    byId("reader").scrollTop=0;
    if(view==="home")void renderHome();
    else if(view==="study")renderStudy();
    else if(view==="discover")renderDiscover();
    else if(view==="calendar")window.OustoryCalendar?.render(root,()=>show("home"),jumpByTitle);
  }
  async function jump(id,ch,v){
    showBible();
    await api.go(id,ch,v);
  }
  function jumpByTitle(bookTitle,chapter,verse){
    const meta=api.books.find(b=>b.title===bookTitle);
    if(meta)void jump(meta.id,chapter,verse);
  }
  async function getVerse(id,ch,v){
    const data=await api.loadBook(id);
    const chapter=data.chapters.find(c=>c.number===ch);
    const verse=chapter?.verses.find(x=>x.number===v);
    if(!verse)throw new Error("Verse is not available at that reference.");
    return textOf(verse);
  }
  function refreshDailyHome(){
    if(!root||currentView!=="home"||root.hidden||homeDayIndex===localDayIndex())return;
    root.replaceChildren();
    void renderHome();
  }
  function scheduleDailyRefresh(){
    clearTimeout(dailyRefreshTimer);
    const now=new Date();
    const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    dailyRefreshTimer=setTimeout(()=>{
      refreshDailyHome();
      scheduleDailyRefresh();
    },Math.max(1000,tomorrow.getTime()-now.getTime()+250));
  }
  function checkDailyOnReturn(){
    refreshDailyHome();
    scheduleDailyRefresh();
  }
  async function renderHome(){
    const date=new Date();
    const seq=localDayIndex(date);
    const group=selectDailyTheme(date);
    homeDayIndex=seq;
    const renderId=++homeRenderId;
    const brand = el("div",undefined,"oustory-home-identity");
    const cover = el("img");cover.src = "assets/oustory-poster-icon-512.png";
    cover.alt = "Covenant Bible cover";cover.width = 58;cover.height = 58;
    cover.loading = "eager";cover.decoding = "async";
    const brandText = el("div");brandText.append(el("strong","Covenant Bible"),el("span","Oustory · POM × LILY"));
    brand.append(cover,brandText);root.append(brand);
    title("Oustory · covenant reading","The nation's record","Read → Study → Research → Practice → Teach → Archive");
    const moonCard=card(root,"Tonight · the Moon");
    window.OustoryMoon?.mount(moonCard);
    const shabbatCard=card(root,"Shabbat · the count");
    window.OustoryShabbat?.mount(shabbatCard,jumpByTitle);
    const verseCard=card(root,"Today's reading");
    verseCard.append(el("p","Theme: "+group[0],"feature-kicker"));
    const display=el("p","Loading this verse from the Oustory text…","feature-verse");
    verseCard.append(display);
    const source=el("p","", "feature-status");verseCard.append(source);
    const a=actions(verseCard);
    addAction(a,"Read in Bible",()=>jump(group[1],group[2],group[3]),true);
    const noteBtn=addAction(a,"Why this rendering",()=>jump(group[1],group[2],group[3]));
    noteBtn.hidden=true;
    try{
      const verse=await getVerse(group[1],group[2],group[3]);
      if(currentView!=="home"||renderId!==homeRenderId)return;
      display.textContent=verse;
      const meta=api.books.find(b=>b.id===group[1]);
      source.textContent=meta.title+" "+group[2]+":"+group[3]+
        " · Oustory Bible";
      const n=notesByRef.get(refKey(meta.title,group[2],group[3]));
      if(n){noteBtn.hidden=false;noteBtn.onclick=()=>openVerse({book:meta.title,id:group[1],chapter:group[2],verse:group[3],text:verse})}
    }catch(e){
      if(currentView!=="home"||renderId!==homeRenderId)return;
      display.textContent="This daily reading could not be loaded.";source.textContent=e.message;
    }
    const last=read("cpt.reader.position",null);
    const cont=card(root,"Continue reading");
    const savedBook=api.books.find(b=>b.id===last?.book);
    cont.append(el("p",savedBook?savedBook.title+" "+last.chapter+(Number.isInteger(last?.verse)&&last.verse>1?":"+last.verse:""):"Start with Genesis 1"));
    addAction(actions(cont),"Resume reading",()=>jump(savedBook?.id||"genesis",savedBook?.chapters.some(c=>c.number===last?.chapter)?last.chapter:1,Number.isInteger(last?.verse)?last.verse:undefined),true);
    const note=card(root,"Covenant Calendar");
    note.append(el("p","See your next Shabbat and the current lunar month. Switch between Early Start and Late Start without losing your date.","feature-status"));
    addAction(actions(note),"Feasts & lunar calendar",()=>show("calendar"),true);
    addAction(actions(note),"Explore covenant study",()=>show("study"));
    const sabbathReadings=card(root,"Next Shabbat · Scripture study");
    const sabbathContent=el("div",undefined,"calendar-study-home");
    sabbathReadings.append(sabbathContent);
    void window.OustoryCalendarStudy?.renderNext(sabbathContent,jumpByTitle,
      ()=>show("calendar"),window.OustoryCalendar?.rememberedTrack()||"earlier");
  }
  function renderStudy(){
    title("Study · covenant literacy","Read with the record","Scripture reading, language study, historical comparison, and editorial notes.");
    const editorial=card(root,"Why this rendering — editorial index");
    editorial.append(el("p","Explore Scripture passages and their accompanying editorial notes in one place."));
    addAction(actions(editorial),"Browse editorial notes",()=>window.OustoryWorkbench?.openEditorialIndex([...new Set(notesByRef.values())]),true);
    const research=card(root,"Research desk");
    const content=el("div",undefined,"research-study-content");research.append(content);
    window.OustoryResearch?.fillStudy(content,(id,ch,verse)=>jump(id,ch,verse));
    const lunarStudy=card(root,"Sabbath and New Moon study");
    const lunarContent=el("div",undefined,"calendar-study-discover");
    lunarStudy.append(lunarContent);
    void window.OustoryCalendarStudy?.renderNext(lunarContent,jumpByTitle,
      ()=>show("calendar"),window.OustoryCalendar?.rememberedTrack()||"earlier");
    const calendarNotes=card(root,"Calendar questions still open");
    const calendarNotesContent=el("div",undefined,"calendar-study-open-questions");
    calendarNotes.append(calendarNotesContent);
    void window.OustoryCalendarStudy?.renderOpenQuestions(calendarNotesContent,jumpByTitle);
    const quick=card(root,"Your saved study");
    const savedButtons=actions(quick);
    addAction(savedButtons,"Saved chapters",()=>window.OustoryReader?.openSaved());
    addAction(savedButtons,"Highlighted verses",()=>showHighlights());
    const topics=card(root,"Covenant topics");
    topics.append(el("p","Start with these passages for each covenant topic."));
    const grid=el("div",undefined,"feature-grid");topics.append(grid);
    for(const [name,id,ch,v] of TOPICS){
      const item=card(grid,name);
      addAction(actions(item),"Read anchor",()=>jump(id,ch,v));
    }
  }
  function splitReference(ref){
    const m=/^(.*)\s+(\d+:\d+)$/.exec(ref);
    return m?[m[1],m[2]]:["","0:0"];
  }
  function renderDiscover(){
    title("Discover · reading paths","Follow the covenant story","Four curated starting tracks, each linking to the actual chapter text.");
    const calendar=card(root,"Your Shabbat calendar");
    calendar.append(el("p","Open the current month to see the next Shabbat, New Moons, and both religious year-start options."));
    addAction(actions(calendar),"Open covenant calendar",()=>show("calendar"));
    const study=card(root,"Next lunar Shabbat reading");
    const preview=el("div",undefined,"calendar-study-next");
    study.append(preview);
    void window.OustoryCalendarStudy?.renderNext(preview,jumpByTitle,
      ()=>show("calendar"),window.OustoryCalendar?.rememberedTrack()||"earlier");
    const progress=read("oustory.plan.progress",{});
    for(const p of PLANS){
      const c=card(root,p.title);
      c.append(el("p",p.description));
      const count=p.steps.filter((_,i)=>progress[p.id]?.includes(i)).length;
      c.append(el("p",count+" of "+p.steps.length+" chapters marked read.","feature-status"));
      for(let i=0;i<p.steps.length;i++){
        const [label,id,ch]=p.steps[i];
        const box=actions(c);
        addAction(box,(progress[p.id]?.includes(i)?"✓ ":"")+label,()=>jump(id,ch));
        addAction(box,progress[p.id]?.includes(i)?"Read ✓":"Mark read",()=>{
          const state=read("oustory.plan.progress",{});
          const done=new Set(state[p.id]||[]);
          done.has(i)?done.delete(i):done.add(i);
          state[p.id]=[...done].sort((a,b)=>a-b);
          save("oustory.plan.progress",state);
          renderDiscover();
        });
      }
    }
  }
  function showHighlights(){
    document.body.classList.add("feature-mode");root.hidden=false;root.replaceChildren();
    setCurrent("study");
    title("Study","Highlighted verses","Saved locally on this device. No account or cloud backup is implied.");
    const list=card(root,"Your highlights");
    if(!highlights.size)list.append(el("p","No highlights yet. Tap a verse while reading to save one."));
    for(const key of highlights){
      const [book,cv]=splitReference(key);
      const [ch,v]=cv.split(":").map(Number);
      const meta=api.books.find(x=>x.title===book);
      if(!meta)continue;
      addAction(actions(list),key,()=>jump(meta.id,ch,v));
    }
  }
  function statusText(status){
    return status==="author-ruling"?"Founder editorial ruling":
      status==="open-question"?"Textual study note":
      status==="provisional"?"Interpretive study note":"Historical study note";
  }
  // The copy/share payload comes from the verified reader record, not text
  // selected from the DOM (which can include verse numbers and note markers).
  function refLabel(record){
    return Number.isSafeInteger(record.verseEnd)&&record.verseEnd>record.verse
      ? record.book+" "+record.chapter+":"+record.verse+"\u2013"+record.verseEnd
      : refKey(record.book,record.chapter,record.verse);
  }
  function versePayload(record){
    return record.text+"\n— "+refLabel(record)+" (Oustory reading edition)";
  }
  // Share a direct, bookmarkable coordinate using the app's real book ID.
  // The receiving browser resolves this before restoring the last position.
  function verseLink(record){
    const url=new URL("./",location.href);
    url.searchParams.set("book",record.id);
    url.searchParams.set("chapter",String(record.chapter));
    url.searchParams.set("verse",String(record.verse));
    return url.href;
  }
  function sharePayload(record){
    return versePayload(record)+"\n"+verseLink(record);
  }
  function verseStatus(message){
    const feedback=byId("verse-feedback");
    if(feedback)feedback.textContent=message;
  }
  async function writeClipboard(text){
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch{ /* Fall back to selection-based copying for older iOS browsers. */ }
    const input=el("textarea");
    input.value=text;
    input.setAttribute("aria-hidden","true");
    input.style.cssText="position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.append(input);
    const previous=document.activeElement;
    let copied=false;
    try{
      input.focus();
      input.select();
      input.setSelectionRange(0,input.value.length);
      copied=typeof document.execCommand==="function"&&document.execCommand("copy");
    }catch{copied=false}
    finally{
      input.remove();
      try{if(previous instanceof HTMLElement && previous.isConnected)previous.focus({preventScroll:true})}catch{}
    }
    return copied;
  }
  async function copyVerse(record=selected){
    if(!record)return;
    const ok=await writeClipboard(versePayload(record));
    verseStatus(ok?"Verse copied. Paste it anywhere.":"Copy unavailable. Select the verse text above to copy manually.");
  }
  async function shareVerse(record){
    if(!record)return;
    const reference=refLabel(record);
    if(typeof navigator.share==="function"){
      try{
        await navigator.share({title:reference+" · Oustory",text:versePayload(record),url:verseLink(record)});
        verseStatus("Verse shared.");
        return;
      }catch(error){
        if(error?.name==="AbortError")return; // User dismissed the native sheet.
      }
    }
    const copied=await writeClipboard(sharePayload(record));
    verseStatus(copied?"Share sheet unavailable. Verse and link copied—paste them into any app.":"Sharing is unavailable. Copy the verse text above, then reopen the app link.");
  }
  // Multi-verse passage selection (user order 2026-10-30): "Select verses"
  // in the verse dialog starts a range at that verse; tapping another verse
  // in the same chapter extends the range; the bar shares/copies/images the
  // whole passage. Tapping a verse in a different chapter restarts there.
  let passage=null,passageBar=null;
  const chapterVerses=new Map();
  let chapterVersesKey="";
  function registerVerse(info){
    const key=info.id+"/"+info.chapter;
    if(key!==chapterVersesKey){chapterVersesKey=key;chapterVerses.clear();}
    chapterVerses.set(info.verse,info);
  }
  function passageRecord(){
    if(!passage)return null;
    const texts=[];
    for(let v=passage.start;v<=passage.end;v++){
      const r=chapterVerses.get(v);
      if(r)texts.push(r.text);
    }
    if(!texts.length)return null;
    return {book:passage.book,id:passage.id,chapter:passage.chapter,verse:passage.start,verseEnd:passage.end,text:texts.join(" ")};
  }
  function paintPassage(){
    document.querySelectorAll(".verse-entry.is-range-selected").forEach(x=>x.classList.remove("is-range-selected"));
    if(!passage)return;
    for(let v=passage.start;v<=passage.end;v++){
      byId("verse-"+v)?.closest(".verse-entry")?.classList.add("is-range-selected");
    }
  }
  function updatePassageBar(){
    if(!passageBar||!passage)return;
    const rec=passageRecord();if(!rec)return;
    const n=passage.end-passage.start+1;
    passageBar.querySelector(".passage-label").textContent=refLabel(rec)+(n>1?" \u00b7 "+n+" verses":"");
  }
  function exitPassage(){
    passage=null;paintPassage();
    if(passageBar){passageBar.remove();passageBar=null;}
  }
  async function copyPassage(record){
    const ok=await writeClipboard(versePayload(record));
    const label=passageBar?.querySelector(".passage-label");
    if(label){label.textContent=ok?"Passage copied":"Copy unavailable";setTimeout(updatePassageBar,1600);}
  }
  function ensurePassageBar(){
    if(passageBar)return passageBar;
    const bar=el("div",undefined,"passage-bar");
    bar.setAttribute("role","group");
    bar.setAttribute("aria-label","Selected verses");
    bar.append(el("span",undefined,"passage-label"));
    const acts=el("div",undefined,"passage-actions");
    addAction(acts,"Share",()=>{const r=passageRecord();if(r)void shareVerse(r);},true);
    addAction(acts,"Copy",()=>{const r=passageRecord();if(r)void copyPassage(r);});
    addAction(acts,"Image",()=>{const r=passageRecord();if(r)window.OustoryShareCard?.open(r);});
    const done=el("button","\u00d7","passage-close");done.type="button";
    done.setAttribute("aria-label","Done selecting verses");
    done.onclick=exitPassage;
    bar.append(acts,done);
    document.body.append(bar);
    passageBar=bar;
    return bar;
  }
  function beginPassage(record){
    passage={book:record.book,id:record.id,chapter:record.chapter,anchor:record.verse,start:record.verse,end:record.verse};
    verseDialog.close();
    ensurePassageBar();paintPassage();updatePassageBar();
  }
  function extendPassage(info){
    if(!passage||info.id!==passage.id||info.chapter!==passage.chapter){
      passage={book:info.book,id:info.id,chapter:info.chapter,anchor:info.verse,start:info.verse,end:info.verse};
    }else{
      passage.start=Math.min(passage.anchor,info.verse);
      passage.end=Math.max(passage.anchor,info.verse);
    }
    ensurePassageBar();paintPassage();updatePassageBar();
  }
  function makeDialog(){
    verseDialog=el("dialog");verseDialog.id="verse-panel";
    verseDialog.setAttribute("aria-labelledby","verse-title");
    document.body.append(verseDialog);
  }
  function appendVerseEvidence(target,record){
    const k=refKey(record.book,record.chapter,record.verse);
    const entry=notesByRef.get(k);
    const note=card(target,entry?"Why this rendering":"Editorial note status");
    if(entry){
      note.append(el("p",statusText(entry.status),"feature-note-type"));
      note.append(el("p",entry.body,"note-text"));
    }else{
      note.append(el("p","No additional editorial note is indexed for this verse.","feature-status"));
    }
    
  }
  function openVerse(record){
    selected=record;
    verseDialog.replaceChildren();
    const header=el("div",undefined,"sheet-header");
    const k=refKey(record.book,record.chapter,record.verse);
    const h=el("h2",k);h.id="verse-title";
    const close=el("button","×","icon-button");close.type="button";
    close.setAttribute("aria-label","Close verse details");
    close.onclick=()=>verseDialog.close();
    header.append(h,close);verseDialog.append(header);
    verseDialog.append(el("p",record.text,"verse-text"));
    const quick=el("div",undefined,"verse-quick-actions");
    verseDialog.append(quick);
    addAction(quick,"Copy verse",()=>void copyVerse(record),true);
    addAction(quick,"Share verse",()=>void shareVerse(record));
    addAction(quick,"Select verses",()=>beginPassage(record));
    const feedback=el("p","","feature-status");
    feedback.id="verse-feedback";
    feedback.setAttribute("role","status");
    feedback.setAttribute("aria-live","polite");
    verseDialog.append(feedback);
    addAction(quick,"Compare",()=>window.OustoryWorkbench?.open(record,"compare"));
    addAction(quick,"Notes",()=>window.OustoryWorkbench?.open(record,"notes"));
    const more=el("details",undefined,"verse-more");
    more.append(el("summary","More verse actions & editorial research"));
    const a=actions(more);
    addAction(a,"Save verse",()=>{
      const stored=window.OustoryReader?.saveVerse(record.id,record.chapter,record.verse);
      byId("verse-feedback").textContent=stored?"Verse saved on this device.":"Verse could not be saved.";
    });
    addAction(a,highlights.has(k)?"Remove highlight":"Highlight verse",()=>{
      if(highlights.has(k))highlights.delete(k);else highlights.add(k);
      save("oustory.highlights",[...highlights]);
      const span=byId("verse-"+record.verse)?.closest(".verse-entry");
      span?.classList.toggle("is-highlighted",highlights.has(k));
      openVerse(record);
      verseDialog.querySelector(".verse-more").open=true;
    });
    addAction(a,"Create verse image",()=>window.OustoryShareCard?.open(record));
    addAction(a,"Editorial research",()=>window.OustoryWorkbench?.open(record,"editorial"));
    verseDialog.append(more);
    verseDialog.showModal();
  }
  function annotateVerse(info){
    const key=refKey(info.book,info.chapter,info.verse);
    const span=el("span",undefined,"verse-entry");
    span.dataset.verse=String(info.verse);
    span.tabIndex=0;span.setAttribute("role","button");
    span.setAttribute("aria-label","Open "+key+" verse actions and editorial note");
    if(highlights.has(key))span.classList.add("is-highlighted");
    if(notesByRef.has(key))span.classList.add("has-editorial-note");
    registerVerse(info);
    const open=()=>{ if(passage){ extendPassage(info); return; } openVerse(info); };
    span.addEventListener("click",open);
    span.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}
    });
    return span;
  }
  function refreshNotes(){
    document.querySelectorAll(".verse-entry").forEach(s=>{
      const chapterText=byId("chapter-title")?.textContent||"";
      const m=/^(.*)\s+(\d+)$/.exec(chapterText);
      if(!m)return;
      const key=refKey(m[1],Number(m[2]),Number(s.dataset.verse));
      const has=notesByRef.has(key);
      s.classList.toggle("has-editorial-note",has);
      const existing=s.querySelector(".note-mark");
      if(has&&!existing)s.append(el("sup","※","note-mark"));
      if(!has&&existing)existing.remove();
    });
  }
  function nav(){
    const oldDock=document.querySelector(".bottom-dock");
    if(!oldDock)throw new Error("Oustory navigation missing");
    oldDock.replaceChildren();
    // Original SVG icons: visual polish only. Keep stable IDs and view routing.
    const icons={
      home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      bible:'<path d="M12 6.5c-2.2-1.4-4.7-1.8-8-1.4v14c3.3-.4 5.8 0 8 1.4 2.2-1.4 4.7-1.8 8-1.4v-14c-3.3-.4-5.8 0-8 1.4Z"/><path d="M12 6.5v14M6.5 9c1.3 0 2.4.2 3.4.6M14.1 9.6c1-.4 2.1-.6 3.4-.6"/>',
      study:'<path d="M4.5 3.5h10l3 3V14M14.5 3.5v3h3M7.5 9h6M7.5 12h4"/><circle cx="15.5" cy="16" r="4"/><path d="m18.5 19 3 3"/>',
      discover:'<circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2.3 5.1-5.1 2.3 2.3-5.1 5.1-2.3Z"/><circle cx="12" cy="12" r=".55" fill="currentColor" stroke="none"/>',
      more:'<rect x="4" y="4" width="6" height="6" rx="1.3"/><rect x="14" y="4" width="6" height="6" rx="1.3"/><rect x="4" y="14" width="6" height="6" rx="1.3"/><rect x="14" y="14" width="6" height="6" rx="1.3"/>'
    };
    const items=[
      ["home","Home"],["bible","Bible"],["study","Study"],
      ["discover","Discover"],["more","More"]
    ];
    for(const [name,caption] of items){
      const b=el("button",undefined,"dock-button");
      b.type="button";
      b.dataset.view=name;
      b.id=name==="bible"?"read-button":"nav-"+name;
      b.setAttribute("aria-label",caption);
      const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
      icon.setAttribute("viewBox","0 0 24 24");
      icon.setAttribute("aria-hidden","true");
      icon.setAttribute("focusable","false");
      icon.classList.add("nav-icon");
      icon.innerHTML=icons[name];
      b.append(icon,el("span",caption,"dock-label"));
      b.onclick=()=>show(name);
      oldDock.append(b);
    }
  }
  function init(readerApi){
    api=readerApi;
    root=el("section",undefined,"feature-root");root.id="feature-root";root.hidden=true;
    byId("reader").append(root);
    makeDialog();
    nav();
    window.OustoryWorkbench?.init(readerApi);
    fetch("data/editorial-notes.json").then(r=>{
      if(!r.ok)throw new Error("Editorial index unavailable");
      return r.json()
    }).then(j=>{
      if(!Array.isArray(j.notes))throw new Error("Invalid editorial index");
      for(const n of j.notes)for(const ref of n.refs||[])notesByRef.set(ref,n);
      refreshNotes();
      if(currentView==="study")renderStudy();
    }).catch(()=>{if(currentView==="study")renderStudy();});
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden)checkDailyOnReturn();
    });
    window.addEventListener("focus",checkDailyOnReturn);
    window.addEventListener("pageshow",checkDailyOnReturn);
    scheduleDailyRefresh();
    show("home");
  }
  window.OustoryFeatures={init,showBible,show,annotateVerse,refreshNotes,openVerse,appendVerseEvidence};
})();
