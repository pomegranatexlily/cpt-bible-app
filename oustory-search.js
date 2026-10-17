"use strict";
/* Oustory Release 1: lazy, deterministic full-text search over a verified
 * publication index. One request instead of 80 sequential book downloads.
 * The index contains the displayed source text, not AI summaries. */
(() => {
  let books=[], go=null, data=null, pending=null, token=0, debounce=null;
  const $ = id=>document.getElementById(id);
  const el=(tag,text,cls)=>{
    const n=document.createElement(tag);
    if(text!==undefined)n.textContent=text;
    if(cls)n.className=cls;
    return n;
  };
  function load(){
    if(data)return Promise.resolve(data);
    if(!pending)pending=fetch("data/search-index.json").then(response=>{
      if(!response.ok)throw Error("Search index could not be downloaded");
      return response.json();
    }).then(index=>{
      if(index.version!==1||!Array.isArray(index.book_ids)||
        index.book_ids.length!==books.length||
        !index.book_ids.every((id,i)=>books[i].id===id)||
        !Array.isArray(index.rows)||
        index.rows.length!==index.verse_count||
        index.verse_count!==books.reduce((n,b)=>n+b.verseCount,0)){
        throw Error("Search index doesn't match this reading edition");
      }
      data=index;return data;
    }).catch(e=>{pending=null;throw e});
    return pending;
  }
  function reference(q){
    const match=/^(.+?)\s+(\d{1,3}):(\d{1,3})$/.exec(q);
    if(!match)return null;
    const b=books.find(x=>x.title.toLowerCase()===match[1].trim().toLowerCase()||
      x.id.toLowerCase()===match[1].trim().toLowerCase().replaceAll(" ","-"));
    if(!b)return null;
    const ch=Number(match[2]),verse=Number(match[3]);
    const meta=b.chapters.find(x=>x.number===ch);
    if(!meta||verse<(meta.firstVerse??1)||verse>(meta.lastVerse??meta.verseCount))return null;
    return {id:b.id,chapter:ch,verse,label:b.title+" "+ch+":"+verse};
  }
  function showReference(ref){
    const results=$("search-results");results.replaceChildren();
    const b=el("button","Open "+ref.label,"list-button");
    b.type="button";b.onclick=()=>go(ref.id,ref.chapter,ref.verse);
    results.append(b);
    $("search-status").textContent="Go directly to this Scripture reference.";
  }
  async function query(value,version){
    const q=value.trim().toLocaleLowerCase();
    const results=$("search-results"),status=$("search-status");
    if(!q){results.replaceChildren();status.textContent="Search Scripture by word, phrase, or reference (Genesis 1:1).";return}
    const exact=reference(q);
    if(exact){if(version===token)showReference(exact);return}
    status.textContent="Preparing fast 80-book search…";
    let index;
    try{index=await load()}catch(e){
      if(version!==token)return;
      results.replaceChildren();
      status.textContent=e.message+". Check your connection and try again.";
      return;
    }
    if(version!==token)return;
    status.textContent="Searching "+index.verse_count.toLocaleString()+" verses…";
    const hits=[];
    let total=0;
    // Process bounded batches to keep scrolling and taps responsive on iPhone.
    for(let offset=0;offset<index.rows.length;offset+=1500){
      if(version!==token)return;
      for(const [book,chapter,verse,text] of index.rows.slice(offset,offset+1500)){
        if(!text.toLocaleLowerCase().includes(q))continue;
        total++;
        if(hits.length<100)hits.push([book,chapter,verse,text]);
      }
      if(offset+1500<index.rows.length){
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    if(version!==token)return;
    const fragment=document.createDocumentFragment();
    for(const [book,chapter,verse,text] of hits){
      const meta=books[book];
      if(!meta)continue;
      const button=el("button",meta.title+" "+chapter+":"+verse,"list-button");
      button.type="button";
      const start=text.toLocaleLowerCase().indexOf(q);
      const context=Math.max(0,start-55);
      const preview=(context?"…":"")+text.slice(context,context+200)+
        (context+200<text.length?"…":"");
      button.append(el("small",preview));
      button.onclick=()=>go(meta.id,chapter,verse);
      fragment.append(button);
    }
    results.replaceChildren(fragment);
    status.textContent=total.toLocaleString()+" matching verses"+
      (total>100?" · Showing first 100":"")+(total===0?" · Try another word or phrase":"");
  }
  function request(){
    const input=$("search-input");
    if(!input)return;
    clearTimeout(debounce);
    const version=++token;
    const value=input.value;
    debounce=setTimeout(()=>{void query(value,version)},180);
  }
  function opened(){
    clearTimeout(debounce);
    const version=++token;
    const value=$("search-input")?.value||"";
    void query(value,version);
  }
  function init(options){
    books=options.books;go=options.go;
    const input=$("search-input");
    if(input)input.addEventListener("input",request);
  }
  window.OustorySearch={init,opened,request};
})();
