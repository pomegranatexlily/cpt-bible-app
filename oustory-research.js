"use strict";
/* Release 2 research: printed-English 1611 witness comparison, separate from
   ancient-language manuscript analysis and founder-approved translation. */
(() => {
  let api=null, manifest=null, pendingManifest=null, terms=null, questions=null, editorialPending=null, sourceManifest=null, sourcePending=null;
  const cache=new Map(), inFlight=new Map();
  const el=(tag,text,cls)=>{
    const x=document.createElement(tag);
    if(text!==undefined)x.textContent=text;
    if(cls)x.className=cls;
    return x;
  };
  const textOf=v=>typeof v.text==="string"?v.text:(v.parts||[]).map(p=>p.text).join("");
  const fetchJson=async url=>{
    const r=await fetch(url);
    if(!r.ok)throw Error("Resource unavailable ("+r.status+")");
    return r.json();
  };
  function loadMetadata(){
    if(!pendingManifest)pendingManifest=fetchJson("data/compare/manifest.json").then(j=>{
      if(j.version!==1||!Array.isArray(j.books))throw Error("Invalid comparison edition");
      manifest=j;return j;
    }).catch(e=>{pendingManifest=null;throw e});
    return pendingManifest;
  }
  async function loadWitness(id){
    if(cache.has(id))return cache.get(id);
    if(inFlight.has(id))return inFlight.get(id);
    const promise=loadMetadata().then(()=>fetchJson("data/compare/"+encodeURIComponent(id)+".json")).then(j=>{
      if(j.version!==1||j.book_id!==id||j.source_revision!==manifest.revision||!j.positions)throw Error("Source alignment mismatch");
      cache.set(id,j);return j;
    }).finally(()=>inFlight.delete(id));
    inFlight.set(id,promise);return promise;
  }
  function loadEditorial(){
    if(!editorialPending)editorialPending=Promise.all([
      fetchJson("data/terminology-review.json"),
      fetchJson("data/witness-questions.json")
    ]).then(([a,b])=>{
      if(a.schema_version!==1||!Array.isArray(a.terms)||b.schema_version!==1||!Array.isArray(b.questions))
        throw Error("Research review schema mismatch");
      terms=a;questions=b;return {terms,questions};
    }).catch(e=>{editorialPending=null;throw e});
    return editorialPending;
  }
  function words(value){return (value.match(/\S+\s*/g)||[]).map(x=>({original:x,key:x.trim().toLocaleLowerCase()}))}
  function differing(a,b){
    const left=words(a),right=words(b);
    if(left.length>350||right.length>350)return [left.map(()=>true),right.map(()=>true)];
    const n=left.length,m=right.length;
    const matrix=Array.from({length:n+1},()=>new Uint16Array(m+1));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
      matrix[i][j]=left[i].key===right[j].key?matrix[i+1][j+1]+1:Math.max(matrix[i+1][j],matrix[i][j+1]);
    const unchangedLeft=new Set(),unchangedRight=new Set();
    for(let i=0,j=0;i<n&&j<m;){
      if(left[i].key===right[j].key){unchangedLeft.add(i++);unchangedRight.add(j++)}
      else if(matrix[i+1][j]>=matrix[i][j+1])i++;else j++;
    }
    return [left.map((_,i)=>!unchangedLeft.has(i)),right.map((_,j)=>!unchangedRight.has(j))];
  }
  function highlight(text,flags){
    const p=el("p",undefined,"research-verse-text");
    const tokens=words(text);
    if(!tokens.length){p.textContent="This source has no verse at this coordinate.";return p}
    tokens.forEach((token,i)=>{
      if(flags?.[i])p.append(el("mark",token.original,"research-word-diff"));
      else p.append(document.createTextNode(token.original));
    });
    return p;
  }
  function row(ch,verse,reading,witness){
    const wrap=el("article",undefined,"research-pair");
    wrap.append(el("h4","Verse "+ch+":"+verse,"research-ref"));
    const columns=el("div",undefined,"research-columns");
    const a=el("div",undefined,"research-column"),b=el("div",undefined,"research-column");
    a.append(el("strong","Oustory working text","research-column-title"));
    b.append(el("strong","1611 printed English KJV","research-column-title"));
    const [difA,difB]=reading!==null&&witness!==null?differing(reading,witness):[null,null];
    a.append(highlight(reading??"",difA));
    b.append(highlight(witness??"",difB));
    columns.append(a,b);wrap.append(columns);
    if(reading===null||witness===null){
      wrap.append(el("p",reading===null?
        "Absent from Oustory source at this verse number; no text inserted.":
        "No corresponding 1611 verse at this position. Do not infer why without witness research.",
      "feature-status"));
    }
    return wrap;
  }
  async function compareVerse(record,target){
    target.replaceChildren(el("p","Loading the pinned 1611 edition…","feature-status"));
    try{
      const witness=await loadWitness(record.id);
      if(!target.isConnected)return;
      target.replaceChildren();
      target.append(el("p","Wording highlights reflect English differences, including spelling. They do NOT prove a manuscript variant or doctrinal change.","research-source-warning"));
      if(witness.status!=="available"){
        target.append(el("p","No verified 1611 verse-coordinate source is available for this book. Comparison is intentionally unavailable.","feature-status"));
        return;
      }
      const old=witness.positions[String(record.chapter)]?.[String(record.verse)]??null;
      target.append(row(record.chapter,record.verse,record.text,old));
      target.append(el("p","Witness: "+manifest.source+" · pinned revision "+manifest.revision.slice(0,12),"feature-status"));
    }catch(e){if(target.isConnected)target.replaceChildren(el("p","1611 comparison unavailable: "+e.message,"feature-status"))}
  }
  async function compareChapter(id,chapter){
    if(!api)return;
    let dialog=document.getElementById("research-chapter-dialog");
    if(!dialog){
      dialog=el("dialog");dialog.id="research-chapter-dialog";
      dialog.setAttribute("aria-label","Chapter comparison");document.body.append(dialog);
    }
    dialog.replaceChildren();
    const header=el("div",undefined,"sheet-header");
    const name=api.books.find(b=>b.id===id)?.title||id;
    header.append(el("h2",name+" "+chapter+" · Compare"),el("button","Close","research-close"));
    header.querySelector("button").onclick=()=>dialog.close();
    dialog.append(header,el("p","Loading both Scripture witnesses…","feature-status"));
    dialog.showModal();
    try{
      const [book,witness]=await Promise.all([api.loadBook(id),loadWitness(id)]);
      if(!dialog.open)return;
      dialog.querySelector(".feature-status")?.remove();
      dialog.append(el("p","1611 KJV = a historical printed English witness, NOT an original-language manuscript. Differences can be spelling, wording or verse availability.","research-source-warning"));
      if(witness.status!=="available"){
        dialog.append(el("p","This title has no verified parallel coordinate source in the pinned 1611 repository.","feature-status"));return;
      }
      const c=book.chapters.find(c=>c.number===Number(chapter));
      if(!c)throw Error("Chapter unavailable");
      const main=new Map(c.verses.map(v=>[v.number,textOf(v)]));
      const older=witness.positions[String(chapter)]||{};
      const numbers=[...new Set([...main.keys(),...Object.keys(older).map(Number)])].sort((a,b)=>a-b);
      const list=el("div",undefined,"research-chapter-list");
      for(const n of numbers)list.append(row(chapter,n,main.get(n)??null,older[String(n)]??null));
      dialog.append(list);
      dialog.append(el("p","Source revision: "+witness.source_revision+" · original coordinate alignment, no shifted verse numbering.","feature-status"));
    }catch(e){if(dialog.open)dialog.append(el("p","Comparison unavailable: "+e.message,"feature-status"))}
  }
  async function appendProvenance(target,record){
    if(!sourcePending)sourcePending=fetchJson("data/manifest.json").then(m=>{
      if(!Array.isArray(m.new_book_provenance)||!m.source_pdf_sha256)throw Error("Invalid manuscript record");
      sourceManifest=m;return m;
    }).catch(e=>{sourcePending=null;throw e});
    try{
      const m=await sourcePending;
      if(!target.isConnected)return;
      const card=el("section",undefined,"research-question-card");
      card.append(el("h3","Working-text source record"));
      const source=m.new_book_provenance.find(x=>x.id===record.id);
      if(source){
        card.append(el("p","Provisional Oustory reading edition · "+(source.source_type||"source-based witness")+
          ". This verse has not received final authorial approval.","feature-status"));
        if(source.source_url && /^https:\/\/raw\.githubusercontent\.com\//.test(source.source_url)){
          const link=el("a","Open pinned source file");
          link.href=source.source_url;link.target="_blank";link.rel="noopener noreferrer";
          card.append(link);
        }
        if(source.source_sha256)card.append(el("p","Source SHA-256: "+source.source_sha256,"feature-status"));
      }else{
        card.append(el("p","Earlier Genesis–Isaiah master-based text; published master source SHA-256: "+m.source_pdf_sha256+
          ". This checksum identifies an input edition, not a collated manuscript variant.","feature-status"));
      }
      target.append(card);
    }catch{if(target.isConnected)target.append(el("p","Working-text source details temporarily unavailable.","feature-status"))}
  }
  async function appendEvidence(target,record){
    try{
      await loadEditorial();
      if(!target.isConnected)return;
      const ref=record.book+" "+record.chapter+":"+record.verse;
      const selected=questions.questions.filter(q=>q.refs.includes(ref));
      if(selected.length){
        const card=el("section",undefined,"research-question-card");
        card.append(el("h3","Manuscript / interpretation questions"));
        for(const q of selected){
          card.append(el("strong",q.label));
          card.append(el("p",q.focus));
          card.append(el("p","Status: research pending · "+q.kind+
            " · source: editorial draft p. "+q.page+". No manuscript collation verified.","feature-status"));
        }
        target.append(card);
      }
    }catch{if(target.isConnected)target.append(el("p","Additional source-review notes unavailable.","feature-status"))}
  }
  async function fillStudy(container,go){
    container.replaceChildren(el("p","Loading editorial research topics…","feature-status"));
    try{
      const {terms,questions}=await loadEditorial();
      if(!container.isConnected)return;
      container.replaceChildren();
      const p=el("p",terms.terms.length+" terminology groups from the editorial draft, plus "+questions.questions.length+" open witness questions. Only the Gentiles/nations contextual correction is newly founder-directed; no global text replacements.","feature-status");
      container.append(p);
      const correction=terms.terms.find(x=>x.term==="Gentiles");
      const prominent=el("section",undefined,"research-correction");
      prominent.append(el("h3","Nations / Gentiles — contextual rule"));
      prominent.append(el("p",correction.review));
      container.append(prominent);
      const details=el("details",undefined,"research-terms");
      details.append(el("summary","View all "+terms.terms.length+" terminology review entries"));
      const list=el("div",undefined,"feature-list");
      for(const t of terms.terms){
        const item=el("div",undefined,"research-term");
        item.append(el("strong",t.term+" · "+t.source_term));
        item.append(el("p","Review: "+t.proposal+". "+t.review));
        item.append(el("small",t.status==="founder_contextual_correction"?
          "Founder correction · source draft p. "+t.pdf_page:
          "DRAFT — NOT APPROVED · source p. "+t.pdf_page,"feature-status"));
        list.append(item);
      }
      details.append(list);container.append(details);
      const unresolved=el("details",undefined,"research-terms");
      unresolved.append(el("summary","View "+questions.questions.length+" textual research questions"));
      for(const q of questions.questions){
        const item=el("div",undefined,"research-term");
        item.append(el("strong",q.label),el("p",q.focus));
        item.append(el("p","Unverified source draft · p. "+q.page,"feature-status"));
        const r=q.refs[0];
        const match=/^(.*) (\d+):(\d+)$/.exec(r);
        const book=match&&api.books.find(b=>b.title===match[1]);
        if(book){
          const btn=el("button","Read "+r,"feature-action");
          btn.onclick=()=>go(book.id,Number(match[2]),Number(match[3]));
          item.append(btn);
        }
        unresolved.append(item);
      }
      container.append(unresolved);
    }catch(e){if(container.isConnected)container.replaceChildren(el("p","Research index unavailable: "+e.message,"feature-status"))}
  }
  function init(options){
    api=options;
    const title=document.getElementById("chapter-title");
    if(title&&!document.getElementById("research-compare-chapter")){
      const b=el("button","Compare 1611 KJV","research-compare-button");
      b.id="research-compare-chapter";b.type="button";
      b.onclick=()=>{
        const m=/^(.*)\s+(\d+)$/.exec(title.textContent||"");
        const book=m&&api.books.find(x=>x.title===m[1]);
        if(book)void compareChapter(book.id,Number(m[2]));
      };
      title.after(b);
    }
  }
  window.OustoryResearch={init,compareVerse,compareChapter,fillStudy,appendEvidence,appendProvenance};
})();
