"use strict";
/* Oustory Release 5: client-only Scripture image cards. Never edits Scripture. */
(()=>{
  const WIDTH=1080, PAD=86, LINE=72, MAX_HEIGHT=4096;
  const EDITION="CPT–APE · OUSTORY WORKING EDITION";
  const DISCLOSURE="SOURCE-BASED READING TEXT · EDITORIAL REVIEW ONGOING";
  let dialog=null, previewURL=null, currentBlob=null, currentRecord=null, token=0;

  function fail(message){throw Error(message)}
  function referenceOf(record){
    if(!record||typeof record.book!=="string"||!record.book.trim()||
       !Number.isSafeInteger(record.chapter)||record.chapter<1||
       !Number.isSafeInteger(record.verse)||record.verse<1||
       typeof record.text!=="string"||!record.text.trim())fail("Verse data is unavailable.");
    return record.book+" "+record.chapter+":"+record.verse;
  }
  function splitLines(ctx,text,maxWidth){
    const result=[];
    for(const paragraph of text.replace(/\r\n?/g,"\n").split("\n")){
      const words=paragraph.trim().split(/\s+/).filter(Boolean);
      if(!words.length){result.push("");continue}
      let line="";
      for(const word of words){
        const candidate=line?line+" "+word:word;
        if(ctx.measureText(candidate).width<=maxWidth){line=candidate;continue}
        if(line){result.push(line);line=""}
        if(ctx.measureText(word).width<=maxWidth){line=word;continue}
        let segment="";
        for(const char of word){
          if(segment&&ctx.measureText(segment+char).width>maxWidth){
            result.push(segment);segment="";
          }
          segment+=char;
        }
        line=segment;
      }
      if(line)result.push(line);
    }
    return result;
  }
  async function generate(record){
    const reference=referenceOf(record);
    if(record.text.length>15000)fail("This verse is too long for a single image. Use Share verse to send the original text.");
    const canvas=document.createElement("canvas");
    const ctx=canvas.getContext("2d");
    if(!ctx)fail("Image creation is not available in this browser.");
    ctx.font='49px Georgia, "Times New Roman", serif';
    const lines=splitLines(ctx,record.text,WIDTH-2*PAD);
    const height=Math.max(660,238+LINE*lines.length+205);
    if(height>MAX_HEIGHT)fail("This verse is too long for an image without cutting off words. Use Share verse for the complete text.");
    canvas.width=WIDTH;canvas.height=height;
    ctx.fillStyle="#f4efe3";ctx.fillRect(0,0,WIDTH,height);
    ctx.fillStyle="#902e2e";ctx.fillRect(PAD,68,58,11);
    ctx.fillStyle="#c7a14b";ctx.fillRect(PAD+72,68,WIDTH-2*PAD-72,3);
    ctx.textBaseline="alphabetic";
    ctx.fillStyle="#544938";ctx.font='600 24px system-ui, -apple-system, sans-serif';
    ctx.fillText("OUSTORY",PAD,124);
    ctx.fillStyle="#1c2925";ctx.font='bold 58px Georgia, "Times New Roman", serif';
    ctx.fillText(reference,PAD,194,WIDTH-2*PAD);
    ctx.font='49px Georgia, "Times New Roman", serif';
    ctx.fillStyle="#202720";
    lines.forEach((line,i)=>ctx.fillText(line,PAD,268+LINE*i));
    const footer=height-132;
    ctx.fillStyle="#b9a87c";ctx.fillRect(PAD,footer,WIDTH-2*PAD,2);
    ctx.font='600 20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle="#403e33";ctx.fillText(EDITION,PAD,footer+46);
    ctx.font='18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle="#5c584e";ctx.fillText(DISCLOSURE,PAD,footer+81);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
    if(!blob||blob.type!=="image/png"||!blob.size)fail("The PNG image could not be created on this device.");
    return {blob,reference,width:WIDTH,height,lines:lines.length};
  }
  function node(tag,text,cls){
    const el=document.createElement(tag);
    if(text!==undefined)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  }
  function button(label,handler){
    const el=node("button",label,"feature-action");
    el.type="button";el.addEventListener("click",handler);
    return el;
  }
  function clearImage(){
    if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null}
    currentBlob=null;currentRecord=null;
  }
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=node("dialog",undefined,"oustory-share-card-dialog");
    dialog.id="oustory-share-card-dialog";
    dialog.setAttribute("aria-labelledby","oustory-share-card-title");
    dialog.addEventListener("close",()=>{++token;clearImage()});
    document.body.append(dialog);
    return dialog;
  }
  async function open(record){
    const safe={book:record?.book,chapter:record?.chapter,verse:record?.verse,text:record?.text};
    const reference=referenceOf(safe), modal=ensureDialog();
    if(modal.open)modal.close();
    clearImage();
    const request=++token;
    const header=node("div",undefined,"sheet-header");
    const title=node("h2","Verse image · "+reference);title.id="oustory-share-card-title";
    const close=button("Close",()=>modal.close());
    close.classList.add("share-card-close");
    header.append(title,close);
    const loading=node("p","Preparing PNG verse image…","feature-status");
    loading.id="share-card-status";loading.setAttribute("role","status");
    const preview=node("div",undefined,"share-card-preview");
    const actions=node("div",undefined,"feature-actions");
    modal.replaceChildren(header,loading,preview,actions);
    modal.showModal();
    try{
      const card=await generate(safe);
      if(request!==token||!modal.open)return;
      currentBlob=card.blob;currentRecord=safe;
      previewURL=URL.createObjectURL(card.blob);
      const img=node("img");img.src=previewURL;
      img.alt=card.reference+". "+safe.text+". "+EDITION+". "+DISCLOSURE+".";
      img.width=card.width;img.height=card.height;
      preview.replaceChildren(img);
      loading.textContent="Image ready. This shows the current Oustory working text, not a finalized translation.";
      actions.append(
        button("Share PNG",async()=>{
          if(!currentBlob||!currentRecord)return;
          const file=new File([currentBlob],"oustory-"+safe.book.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+safe.chapter+"-"+safe.verse+".png",{type:"image/png"});
          if(typeof navigator.share!=="function"||typeof navigator.canShare!=="function"||
             !navigator.canShare({files:[file]})){
            loading.textContent="Image sharing is unsupported on this browser. Use Save PNG instead.";return;
          }
          try{
            await navigator.share({files:[file],title:card.reference,text:"Oustory · CPT–APE working edition"});
            loading.textContent="Image sent to the device's share options.";
          }catch(e){if(e?.name!=="AbortError")loading.textContent="Image sharing failed. Use Save PNG instead."}
        }),
        button("Save PNG",()=>{
          if(!previewURL)return;
          const link=node("a");
          link.href=previewURL;
          link.download="oustory-"+safe.book.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+safe.chapter+"-"+safe.verse+".png";
          document.body.append(link);link.click();link.remove();
          loading.textContent="PNG save requested. Check your browser's Downloads or Save Image options.";
        })
      );
    }catch(e){
      if(request!==token||!modal.open)return;
      loading.textContent=e?.message||"This image could not be created.";
    }
  }
  window.OustoryShareCard={open};
})();