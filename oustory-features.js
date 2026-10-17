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
  let api,root,verseDialog,currentView="bible",selected=null,savedTrigger;
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
    document.body.classList.remove("feature-mode");
    root.hidden=true;
    const ref=byId("reference"),chapter=byId("chapter-title");
    if(ref&&chapter&&chapter.textContent)ref.textContent=chapter.textContent;
    setCurrent("bible");
  }
  function show(view){
    if(view==="bible"){showBible();byId("reader").focus();return}
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
    else if(view==="calendar")window.OustoryCalendar?.render(root,()=>show("home"));
  }
  async function jump(id,ch,v){
    showBible();
    await api.go(id,ch,v);
  }
  async function getVerse(id,ch,v){
    const data=await api.loadBook(id);
    const chapter=data.chapters.find(c=>c.number===ch);
    const verse=chapter?.verses.find(x=>x.number===v);
    if(!verse)throw new Error("Verse unavailable in this source witness.");
    return textOf(verse);
  }
  async function renderHome(){
    const seq=Math.floor(Date.now()/86400000);
    const group=THEMES[Math.floor(seq/7)%THEMES.length];
    const brand = el("div",undefined,"oustory-home-identity");
    const cover = el("img");cover.src = "assets/covenant-bible-gold-512.png";
    cover.alt = "Covenant Bible cover";cover.width = 58;cover.height = 58;
    cover.loading = "eager";cover.decoding = "async";
    const brandText = el("div");brandText.append(el("strong","Covenant Bible"),el("span","Oustory · POM × LILY"));
    brand.append(cover,brandText);root.append(brand);
    title("Oustory · covenant reading","The nation's record","Read → Study → Research → Practice → Teach → Archive");
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
      if(currentView!=="home")return;
      display.textContent=verse;
      const meta=api.books.find(b=>b.id===group[1]);
      source.textContent=meta.title+" "+group[2]+":"+group[3]+
        " · "+(api.books.indexOf(meta)<23?"verified earlier edition":"provisional source reading");
      const n=notesByRef.get(refKey(meta.title,group[2],group[3]));
      if(n){noteBtn.hidden=false;noteBtn.onclick=()=>openVerse({book:meta.title,id:group[1],chapter:group[2],verse:group[3],text:verse})}
    }catch(e){display.textContent="This daily reading could not be loaded.";source.textContent=e.message;}
    const last=read("cpt.reader.position",null);
    const cont=card(root,"Continue reading");
    const savedBook=api.books.find(b=>b.id===last?.book);
    cont.append(el("p",savedBook?savedBook.title+" "+last.chapter:"Start with Genesis 1"));
    addAction(actions(cont),"Open chapter",()=>jump(savedBook?.id||"genesis",savedBook?.chapters.some(c=>c.number===last?.chapter)?last.chapter:1),true);
    const note=card(root,"Covenant Calendar");
    note.append(el("p","See your next Shabbat and the current lunar month. Switch between Early Start and Late Start without losing your date.","feature-status"));
    addAction(actions(note),"Feasts & lunar calendar",()=>show("calendar"),true);
    addAction(actions(note),"Explore covenant study",()=>show("study"));
  }
  function renderStudy(){
    title("Study · covenant literacy","Read with the record","Study topics and approved editorial decisions, connected directly to verses.");
    const editorial=card(root,"Why this rendering — editorial index");
    editorial.append(el("p","The first indexed notes follow the October 16 founder rulings and doctrinal-drift draft. Drafts and unresolved variants remain labeled; source text is not silently rewritten."));
    const list=el("div",undefined,"feature-list");editorial.append(list);
    if(!notesByRef.size){list.append(el("p","Loading editorial index…","feature-status"));}
    const added=new Set();
    for(const [ref,n] of notesByRef){
      if(added.has(n))continue;added.add(n);
      const [book,chapVerse]=splitReference(ref);
      const [ch,v]=chapVerse.split(":").map(Number);
      const meta=api.books.find(b=>b.title===book);
      if(!meta)continue;
      const button=el("button",n.label);
      button.append(el("small",ref+" · "+statusText(n.status)));
      button.onclick=()=>jump(meta.id,ch,v);
      list.append(button);
    }
    const quick=card(root,"Your saved study");
    const savedButtons=actions(quick);
    addAction(savedButtons,"Saved chapters",()=>{savedTrigger?.click()});
    addAction(savedButtons,"Highlighted verses",()=>showHighlights());
    const topics=card(root,"Covenant topics");
    topics.append(el("p","Starting passages for each category; a full tagged knowledge graph is a later phase."));
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
      status==="open-question"?"Manuscript question open":
      status==="provisional"?"Provisional founder interpretation":"Draft editorial note";
  }
  async function copyVerse(){
    if(!selected)return;
    const s=selected.text+"\n— "+selected.book+" "+selected.chapter+":"+selected.verse+" (Oustory reading edition)";
    try{await navigator.clipboard.writeText(s);byId("verse-feedback").textContent="Verse copied."}
    catch{byId("verse-feedback").textContent="Clipboard unavailable on this browser."}
  }
  function makeDialog(){
    verseDialog=el("dialog");verseDialog.id="verse-panel";
    verseDialog.setAttribute("aria-labelledby","verse-title");
    document.body.append(verseDialog);
  }
  function openVerse(record){
    selected=record;
    verseDialog.replaceChildren();
    const header=el("div",undefined,"sheet-header");
    const h=el("h2",record.book+" "+record.chapter+":"+record.verse);h.id="verse-title";
    const close=el("button","×","icon-button");close.setAttribute("aria-label","Close verse details");
    close.onclick=()=>verseDialog.close();header.append(h,close);verseDialog.append(header);
    verseDialog.append(el("p",record.text,"verse-text"));
    const a=actions(verseDialog);
    const k=refKey(record.book,record.chapter,record.verse);
    addAction(a,"Copy verse",copyVerse);
    addAction(a,highlights.has(k)?"Remove highlight":"Highlight verse",()=>{
      if(highlights.has(k))highlights.delete(k);else highlights.add(k);
      save("oustory.highlights",[...highlights]);
      const span=byId("verse-"+record.verse)?.closest(".verse-entry");
      span?.classList.toggle("is-highlighted",highlights.has(k));
      openVerse(record);
    });
    addAction(a,"Share verse",async()=>{
      if(!navigator.share){await copyVerse();return}
      try{await navigator.share({title:k,text:record.text+"\n— "+k})}
      catch(e){if(e.name!=="AbortError")byId("verse-feedback").textContent="Sharing unavailable."}
    });
    const feedback=el("p","","feature-status");feedback.id="verse-feedback";verseDialog.append(feedback);
    const entry=notesByRef.get(k);
    const note=card(verseDialog,entry?"Why this rendering":"Translation provenance");
    if(entry){
      note.append(el("p",statusText(entry.status),"feature-note-type"));
      note.append(el("p",entry.body,"note-text"));
    }else{
      note.append(el("p","No verse-specific editorial note is indexed here yet. The first 23 books retain the earlier master wording; the other 57 books use public-domain sources with disclosed provisional adaptations."));
    }
    note.append(el("p","An editorial note explains a position; it does not certify a manuscript variant or assert the currently displayed verse has already been revised.","feature-status"));
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
    const open=()=>openVerse(info);
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
    savedTrigger=oldDock?.querySelector('[data-panel="saved-panel"]');
    if(!oldDock)throw new Error("Oustory navigation missing");
    oldDock.replaceChildren();
    const items=[
      ["home","Home","⌂"],["bible","Bible","▣"],
      ["study","Study","⌕"],["discover","Discover","◇"],["more","More","☰"]
    ];
    for(const [name,caption,symbol] of items){
      const b=el("button",undefined,"dock-button");
      b.type="button";b.dataset.view=name;b.id=name==="bible"?"read-button":"nav-"+name;
      b.append(el("span",symbol,"nav-symbol"),el("span",caption));
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
    fetch("data/editorial-notes.json").then(r=>{
      if(!r.ok)throw new Error("Editorial index unavailable");
      return r.json()
    }).then(j=>{
      if(!Array.isArray(j.notes))throw new Error("Invalid editorial index");
      for(const n of j.notes)for(const ref of n.refs||[])notesByRef.set(ref,n);
      refreshNotes();
      if(currentView==="study")renderStudy();
    }).catch(()=>{if(currentView==="study")renderStudy();});
    show("home");
  }
  window.OustoryFeatures={init,showBible,show,annotateVerse,refreshNotes,openVerse};
})();
