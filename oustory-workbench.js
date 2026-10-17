"use strict";
/* Release 6: one-page-at-a-time research workbench. Zero changes to Scripture. */
(()=>{
  const NOTES_KEY="oustory.personal-notes.v1";
  const MAX_NOTES=2000, MAX_LENGTH=6000;
  const byId=id=>document.getElementById(id);
  const el=(tag,value,cls)=>{
    const x=document.createElement(tag);
    if(value!==undefined)x.textContent=value;
    if(cls)x.className=cls;
    return x;
  };
  const action=(parent,label,click,cls)=>{
    const b=el("button",label,cls||"workbench-action");
    b.type="button";b.onclick=click;parent.append(b);return b;
  };
  const escapeKey=r=>r.id+"|"+r.chapter+"|"+r.verse;
  const validNoteKey=key=>{
    if(typeof key!=="string")return false;
    const m=/^([a-z0-9-]+)\|([1-9][0-9]*)\|([1-9][0-9]*)$/.exec(key);
    if(!m||!window.CPT_BOOKS)return false;
    const b=window.CPT_BOOKS.find(book=>book.id===m[1]);
    return !!b?.chapters?.some(c=>c.number===Number(m[2])&&
      Number(m[3])>=(c.firstVerse??1)&&
      Number(m[3])<=(c.lastVerse??c.verseCount));
  };
  function validNotes(obj){
    if(!obj||typeof obj!=="object"||Array.isArray(obj))return false;
    const entries=Object.entries(obj);
    return entries.length<=MAX_NOTES&&JSON.stringify(obj).length<=600000&&entries.every(([key,text])=>
      validNoteKey(key)&&typeof text==="string"&&text.length<=MAX_LENGTH&&
      text.trim().length>0&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text));
  }
  function allNotes(){
    try{
      const value=JSON.parse(localStorage.getItem(NOTES_KEY)||"{}");
      return validNotes(value)?value:{};
    }catch{return {}}
  }
  let api,root,current=null,readerScroll=0,origin="bible",request=0;
  let interlinearManifest=null;
  function usable(r){
    return r&&typeof r.id==="string"&&typeof r.book==="string"&&
      Number.isInteger(r.chapter)&&Number.isInteger(r.verse)&&
      typeof r.text==="string";
  }
  function back(){
    if(!current)return;
    request++;
    current=null;
    document.body.classList.remove("study-workbench-mode");
    root.hidden=true;
    window.OustoryFeatures?.showBible();
    const reader=byId("reader");
    reader.scrollTop=readerScroll;
    byId("verse-"+lastVerse)?.closest(".verse-entry")?.focus({preventScroll:true});
    reader.scrollTop=readerScroll;
  }
  let lastVerse=1;
  function heading(label,record){
    root.replaceChildren();
    const top=el("header",undefined,"workbench-heading");
    const backButton=action(top,"‹  Back to Scripture",back,"workbench-back");
    backButton.setAttribute("aria-label","Back to Scripture at "+record.book+" "+record.chapter+":"+record.verse);
    top.append(el("p","OUSTORY · SCRIPTURE STUDY","workbench-eyebrow"));
    top.append(el("h1",label,"workbench-title"));
    top.append(el("p",record.book+" "+record.chapter+":"+record.verse,"workbench-reference"));
    root.append(top);
    const quote=el("blockquote",record.text,"workbench-verse");
    root.append(quote);
    return root;
  }
  function navigate(section){
    if(!current)return;
    current.section=section;request++;
    const holder=heading(section==="compare"?"Compare versions":
      section==="interlinear"?"Interlinear study":
      section==="notes"?"My verse notes":"Editorial research",current.record);
    const switcher=el("nav",undefined,"workbench-switcher");
    switcher.setAttribute("aria-label","Verse study views");
    for(const [s,label] of [["compare","Compare"],["interlinear","Interlinear"],["notes","Notes"]]){
      const b=action(switcher,label,()=>navigate(s),"workbench-tab");
      if(s===section)b.setAttribute("aria-current","page");
    }
    holder.append(switcher);
    const body=el("section",undefined,"workbench-body");body.id="workbench-body";
    holder.append(body);
    if(section==="compare")void compare(body,current.record);
    else if(section==="interlinear")void interlinear(body,current.record);
    else if(section==="notes")notes(body,current.record);
    else editorial(body,current.record);
    byId("reader").scrollTop=0;
  }
  function open(record,section="compare"){
    if(!usable(record))return;
    if(current){current.record=record;}
    else{
      readerScroll=byId("reader").scrollTop;
      origin="bible";
      current={record,section};
    }
    lastVerse=record.verse;
    if(byId("verse-panel")?.open)byId("verse-panel").close();
    window.OustoryAudio?.stop();
    root.hidden=false;
    document.body.classList.add("study-workbench-mode");
    navigate(section);
  }
  function openChapter(id,ch){
    if(!api)return;
    const meta=api.books.find(b=>b.id===id);
    if(!meta)return;
    const ref={id,book:meta.title,chapter:ch,verse:1,text:""};
    if(!current){readerScroll=byId("reader").scrollTop;current={record:ref,section:"compare"}}
    else current.record=ref;
    lastVerse=1;
    root.hidden=false;
    window.OustoryAudio?.stop();
    document.body.classList.add("study-workbench-mode");
    const holder=heading("Compare chapter",ref);
    holder.querySelector(".workbench-verse")?.remove();
    const body=el("section",undefined,"workbench-body");body.id="workbench-body";holder.append(body);
    void window.OustoryResearch?.renderChapter?.(id,ch,body);
    byId("reader").scrollTop=0;
  }
  async function compare(body,record){
    const info=el("p","1611 printed English KJV · pinned historical reference edition.","workbench-note");
    const select=el("select",undefined,"workbench-edition");
    select.id="workbench-edition";select.setAttribute("aria-label","Comparison edition");
    const option=el("option","1611 King James Bible");option.value="1611";select.append(option);
    const label=el("label","Comparison edition","workbench-control-label");label.append(select);
    body.append(info,label);
    const target=el("div",undefined,"workbench-compare-content");body.append(target);
    await window.OustoryResearch?.compareVerse?.(record,target);
    const end=el("p","Other editions will only appear after complete, verified source texts are available. English differences do not establish manuscript differences.","workbench-note");
    body.append(end);
  }
  async function interlinear(body,record){
    const disclaimer=el("p","Interlinear requires verified original-language wording, word alignment, and lexical identifiers. Oustory will not infer Strong’s numbers from its English text.","workbench-note");
    body.append(disclaimer);
    const msg=el("p","Checking available original-language sources…","workbench-status");body.append(msg);
    const seq=request;
    try{
      if(!interlinearManifest){
        const r=await fetch("data/interlinear/manifest.json");
        if(!r.ok)throw Error("Interlinear source index unavailable");
        const j=await r.json();
        if(j.schema_version!==1||!Array.isArray(j.books))throw Error("Interlinear source index invalid");
        interlinearManifest=j;
      }
      if(seq!==request||!body.isConnected)return;
      const item=interlinearManifest.books.find(x=>x.id===record.id);
      if(!item){
        msg.textContent="Verified Hebrew/Greek word alignment has not been published for this book yet.";
        return;
      }
      const r=await fetch("data/interlinear/"+encodeURIComponent(record.id)+".json");
      if(!r.ok)throw Error("Original-language source file unavailable");
      const data=await r.json();
      if(data.schema_version!==1||data.book_id!==record.id||data.source!==item.source)
        throw Error("Original-language source identity did not match the index");
      const words=data.positions?.[String(record.chapter)]?.[String(record.verse)];
      if(!Array.isArray(words)||!words.length){msg.textContent="No verified original-language word alignment for this verse yet.";return}
      const cells=el("ol",undefined,"workbench-original-words");
      for(const token of words){
        if(!token||typeof token.original!=="string"||typeof token.english!=="string"||
            !/^([HG][0-9]{1,5})$/.test(token.strong||"")||!token.original.trim())
          throw Error("Unverified interlinear word record");
        const li=el("li",undefined,"workbench-original-word");
        li.append(el("strong",token.original),el("span",token.english),el("span",token.strong));
        if(token.transliteration)li.append(el("small",token.transliteration));
        cells.append(li);
      }
      if(seq!==request||!body.isConnected)return;
      msg.textContent="Aligned original-language words from "+item.source+". Definitions and occurrence lists require their own pinned lexicon datasets.";
      body.append(cells);
    }catch(e){if(seq===request&&body.isConnected)msg.textContent="Interlinear unavailable: "+e.message}
  }
  function notes(body,record){
    const key=escapeKey(record);
    const title=el("h2","Personal observation","workbench-section-title");body.append(title);
    body.append(el("p","Private to this browser. Your own notes are never presented as CPT–APE editorial commentary.","workbench-note"));
    const area=el("textarea");area.id="workbench-personal-note";area.rows=7;area.maxLength=MAX_LENGTH;
    area.placeholder="Write your observation about this verse…";
    area.value=allNotes()[key]||"";
    area.setAttribute("aria-label","Personal note for "+record.book+" "+record.chapter+":"+record.verse);
    body.append(area);
    const feedback=el("p","","workbench-status");feedback.id="workbench-note-status";
    feedback.setAttribute("role","status");
    const buttons=el("div",undefined,"workbench-actions");
    action(buttons,"Save note",()=>{
      const value=area.value.trim(),data=allNotes();
      if(!value){feedback.textContent="Enter a note before saving, or choose Delete note.";return}
      if(value.length>MAX_LENGTH){feedback.textContent="Note is too long.";return}
      data[key]=value;
      if(!validNotes(data)){feedback.textContent="Note storage limit reached or reference invalid.";return}
      try{localStorage.setItem(NOTES_KEY,JSON.stringify(data));feedback.textContent="Saved on this device."}
      catch{feedback.textContent="Device storage unavailable; note was not saved."}
    },"workbench-action workbench-primary");
    action(buttons,"Delete note",()=>{
      const data=allNotes();
      if(!Object.hasOwn(data,key)){area.value="";feedback.textContent="No saved note for this verse.";return}
      if(!window.confirm("Delete your note for this verse?"))return;
      delete data[key];
      try{localStorage.setItem(NOTES_KEY,JSON.stringify(data));area.value="";feedback.textContent="Personal note deleted."}
      catch{feedback.textContent="Could not delete your saved note."}
    });
    body.append(buttons,feedback);
    const official=action(body,"Open editorial research for this verse",()=>navigate("editorial"));
    official.classList.add("workbench-research-link");
  }
  async function editorial(body,record){
    body.append(el("h2","Source and editorial evidence","workbench-section-title"));
    const notices=el("div",undefined,"workbench-evidence");
    body.append(notices);
    await window.OustoryFeatures?.appendVerseEvidence?.(notices,record);
    window.OustoryResearch?.appendEvidence?.(notices,record);
    window.OustoryResearch?.appendProvenance?.(notices,record);
  }
  function init(readerApi){
    api=readerApi;
    root=el("section",undefined,"workbench-root");root.id="workbench-root";
    root.hidden=true;root.setAttribute("aria-label","Verse study workspace");
    byId("reader").append(root);
  }
  window.OustoryWorkbench={init,open,openChapter,back,validNotes,noteKey:NOTES_KEY};
})();