"use strict";
/* Release 4: offline download, portable saved study data, accessible controls.
 * This module deliberately never changes Scripture text, canon, or editorial decisions. */
(()=>{
 const KEYS=[
  "cpt.reader.settings","cpt.reader.saved","cpt.reader.position",
  "oustory.highlights","oustory.plan.progress","oustory.calendar.study.v1",
  "oustory.calendar.track","oustory.audio.rate",
  "oustory.personal-notes.v1"
 ];
 const books=Array.isArray(window.CPT_BOOKS)?window.CPT_BOOKS:[];
 const findBook=id=>books.find(b=>b.id===id);
 const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
 const finiteInt=x=>Number.isInteger(x)&&x>=1;
 const validPlace=x=>{
  if(!isRecord(x)||typeof x.book!=="string"||!finiteInt(x.chapter))return false;
  const c=findBook(x.book)?.chapters.find(c=>c.number===x.chapter);
  return !!c&&(x.verse===undefined||(finiteInt(x.verse)&&
   x.verse>=(c.firstVerse??1)&&x.verse<=(c.lastVerse??c.verseCount)));
 };
 function validate(key,value){
  if(key==="oustory.calendar.track")return value==="earlier"||value==="later";
  let data;
  try{data=JSON.parse(value)}catch{return false}
  if(key==="cpt.reader.settings")return isRecord(data)&&
   Number.isInteger(data.size)&&data.size>=17&&data.size<=32&&
   ["1.65","1.85","2.05"].includes(data.spacing)&&["dark","paper"].includes(data.appearance);
  if(key==="cpt.reader.position")return validPlace(data);
  if(key==="cpt.reader.saved")return Array.isArray(data)&&data.length<=2000&&
   data.every(x=>validPlace(x)&&typeof x.label==="string"&&x.label.length<180);
  if(key==="oustory.highlights")return Array.isArray(data)&&data.length<=10000&&
   data.every(x=>typeof x==="string"&&x.length<160&&/^[^<>]+ [0-9]+:[0-9]+$/.test(x));
  if(key==="oustory.plan.progress")return isRecord(data)&&Object.keys(data).length<=20&&
   Object.entries(data).every(([name,items])=>
    ["torah","nation","prophets","king"].includes(name)&&Array.isArray(items)&&
    items.length<=5&&items.every(i=>Number.isInteger(i)&&i>=0&&i<=4));
  if(key==="oustory.calendar.study.v1")return isRecord(data)&&Object.keys(data).length<=10000&&
   Object.entries(data).every(([k,v])=>k.length<180&&
    /^(earlier|later)\|[0-9]{4}-[0-9]{2}-[0-9]{2}\|[^|]+\|[0-9]+:[0-9]+$/.test(k)&&v===true);
  if(key==="oustory.personal-notes.v1")return isRecord(data)&&value.length<=600000&&
    Object.keys(data).length<=2000&&Object.entries(data).every(([ref,entry])=>{
     const m=/^([a-z0-9-]+)\|([1-9][0-9]*)\|([1-9][0-9]*)$/.exec(ref);
     if(!m||typeof entry!=="string"||!entry.trim()||entry.length>6000||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(entry))return false;
     return validPlace({book:m[1],chapter:Number(m[2]),verse:Number(m[3])});
    });
  if(key==="oustory.audio.rate")return Number.isFinite(data)&&data>=0.5&&data<=2;
  return false;
 }
 const el=(tag,text,cls)=>{
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=text;
  if(cls)n.className=cls;
  return n;
 };
 const status=(id,message)=>{const node=document.getElementById(id);if(node)node.textContent=message};
 const qs=id=>document.getElementById(id);
 let isDownloading=false;
 let dialog;
 function row(parent,text,onClick,id){
  const b=el("button",text,"release4-action");
  b.type="button";if(id)b.id=id;b.addEventListener("click",onClick);parent.append(b);return b;
 }
 function makePanel(){
  dialog=el("dialog");dialog.id="release4-panel";
  dialog.setAttribute("aria-labelledby","release4-title");
  const head=el("div",undefined,"sheet-header");
  const title=el("h2","Offline & saved data");title.id="release4-title";
  const close=row(head,"×",()=>dialog.close(),"release4-close");
  close.className="icon-button";close.setAttribute("aria-label","Close offline and backup settings");
  head.prepend(title);dialog.append(head);
  dialog.append(el("p","Offline Scripture is stored on this device. Download the complete working 80-book edition while connected. No login or cloud sync.","sheet-copy"));
  const state=el("p","Checking offline storage…","release4-status");
  state.id="release4-offline-status";state.setAttribute("role","status");state.setAttribute("aria-live","polite");
  dialog.append(state);
  const buttons=el("div",undefined,"release4-actions");
  row(buttons,"Download all 80 books",downloadAll,"release4-download");
  const cancel=row(buttons,"Cancel download",cancelDownload,"release4-cancel");cancel.hidden=true;
  row(buttons,"Remove downloaded books",clearBooks,"release4-clear");
  dialog.append(buttons);
  const storage=el("p","", "sheet-copy");storage.id="release4-storage";dialog.append(storage);
  dialog.append(el("h3","Saved study backup"));
  dialog.append(el("p","Export your bookmarks, personal verse notes, exact reading position, highlights, study progress, calendar track and reading/audio preferences as a JSON file. The export contains no Bible text. Store the file somewhere you control.","sheet-copy"));
  const backupActions=el("div",undefined,"release4-actions");
  row(backupActions,"Export saved data",exportSaved,"release4-export");
  row(backupActions,"Import backup file",()=>qs("release4-file").click(),"release4-import");
  row(backupActions,"Delete saved study data",deleteSaved,"release4-delete-saved");
  dialog.append(backupActions);
  const file=el("input");file.type="file";file.accept=".json,application/json";
  file.id="release4-file";file.hidden=true;file.setAttribute("aria-label","Choose Oustory backup JSON file");
  file.addEventListener("change",importSaved);dialog.append(file);
  const feedback=el("p","Import replaces the backed-up saved-data fields after validation and confirmation; Scripture files and other browser data are untouched.","sheet-copy");
  feedback.id="release4-backup-status";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");dialog.append(feedback);
  dialog.append(el("p","Offline mode covers locally cached books and core screens. Live calendar verification and unvisited 1611 comparison/search resources may require a connection. ","sheet-copy"));
  document.body.append(dialog);
 }
 async function worker(){
  if(!("serviceWorker" in navigator)||!("caches" in window))throw Error("Offline downloads are not supported in this browser.");
  const registration=await navigator.serviceWorker.register("./sw.js",{scope:"./"});
  await navigator.serviceWorker.ready;
  const active=navigator.serviceWorker.controller||registration.active;
  if(!active)throw Error("Offline service is not ready. Reopen Oustory and try again.");
  return active;
 }
 async function send(type,data={},callback){
  const w=await worker();
  return new Promise((resolve,reject)=>{
   const channel=new MessageChannel();
   channel.port1.onmessage=event=>{
    const message=event.data||{};
    if(message.kind==="error"){channel.port1.close();reject(Error(message.message));return}
    if(callback)callback(message);
    if(["status","cleared","cancelled","complete"].includes(message.kind)){
     channel.port1.close();resolve(message);
    }
   };
   w.postMessage({type,...data},[channel.port2]);
  });
 }
 async function refresh(){
  try{
   const result=await send("OFFLINE_STATUS");
   status("release4-offline-status",result.count+" of 80 books downloaded for offline reading"+(navigator.onLine?".":" · device is offline."));
  }catch(e){status("release4-offline-status",e.message)}
  try{
   const estimate=await navigator.storage?.estimate?.();
   if(estimate&&Number.isFinite(estimate.usage))
    status("release4-storage","Browser storage in use: "+(estimate.usage/1048576).toFixed(1)+" MB (includes other website data).");
  }catch{}
 }
 async function downloadAll(){
  if(isDownloading)return;
  isDownloading=true;qs("release4-download").disabled=true;
  qs("release4-cancel").hidden=false;
  status("release4-offline-status","Preparing offline library…");
  try{
   await send("DOWNLOAD_OFFLINE_BOOKS",{ids:books.map(b=>b.id)},msg=>{
    if(msg.kind==="progress")status("release4-offline-status",msg.downloaded+" of "+msg.total+" books ready. You may keep reading.");
    if(msg.kind==="cancelled")status("release4-offline-status","Download paused. "+msg.downloaded+" books checked; saved copies remain available.");
    if(msg.kind==="complete")status("release4-offline-status","All 80 books are stored for offline reading.");
   });
  }catch(e){status("release4-offline-status","Download stopped: "+e.message+" Previously downloaded books remain available.")}
  finally{isDownloading=false;qs("release4-cancel").hidden=true;qs("release4-download").disabled=false}
 }
 async function cancelDownload(){
  try{const w=await worker();w.postMessage({type:"CANCEL_OFFLINE_DOWNLOAD"});
   status("release4-offline-status","Cancelling after the current book…");
  }catch(e){status("release4-offline-status",e.message)}
 }
 async function clearBooks(){
  if(isDownloading)return;
  if(!confirm("Remove downloaded offline book files? Saved reading places and highlights will stay."))return;
  try{await send("CLEAR_OFFLINE_BOOKS");await refresh()}catch(e){status("release4-offline-status",e.message)}
 }
 // Erase only Oustory-owned keys. Never clear all origin storage: other apps
 // sharing a host could have independent values, and offline books are separate.
 function deleteSaved(){
  try{
   const present=KEYS.filter(key=>localStorage.getItem(key)!==null);
   if(!present.length){status("release4-backup-status","No saved study data remains on this device.");return}
   if(!confirm("Permanently delete your saved Oustory reading places, highlights, personal verse notes, study progress and reading preferences from this device? Export a backup first if needed. Downloaded offline books are not affected.")){
    status("release4-backup-status","Deletion cancelled; your saved study data is unchanged.");return;
   }
   for(const key of present)localStorage.removeItem(key);
   if(present.some(key=>localStorage.getItem(key)!==null))throw Error("Some saved fields could not be removed.");
   status("release4-backup-status","Saved study data deleted from this device. Reloading…");
   location.reload();
  }catch(e){status("release4-backup-status","Deletion incomplete: "+e.message)}
 }
 function exportSaved(){
  try{
   const data={};
   for(const key of KEYS){
    const value=localStorage.getItem(key);
    if(value!==null){
     if(!validate(key,value))throw Error("Saved "+key+" has an unsupported format. Export stopped to avoid a corrupt backup.");
     data[key]=value;
    }
   }
   const payload={format:"oustory-saved-study",version:1,createdAt:new Date().toISOString(),data};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob),link=el("a");
   link.href=url;link.download="oustory-saved-data-"+new Date().toISOString().slice(0,10)+".json";
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
   status("release4-backup-status","Backup file prepared. Save it to a location you control.");
  }catch(e){status("release4-backup-status","Export failed: "+e.message)}
 }
 async function importSaved(event){
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  try{
   if(file.size>1048576)throw Error("Backup exceeds the 1 MB safety limit.");
   const parsed=JSON.parse(await file.text());
   if(!isRecord(parsed)||parsed.format!=="oustory-saved-study"||
    parsed.version!==1||!isRecord(parsed.data))throw Error("Not a supported version 1 Oustory backup.");
   const entries=Object.entries(parsed.data);
   if(!entries.length||entries.length>KEYS.length)throw Error("No supported saved-data fields.");
   for(const [key,value] of entries){
    if(!KEYS.includes(key)||typeof value!=="string"||value.length>1000000||
     !validate(key,value))throw Error("Invalid saved-data field: "+key);
   }
   if(!confirm("Restore "+entries.length+" saved-data fields from this backup? Existing values for those fields will be replaced. Oustory will reload afterward.")){
    status("release4-backup-status","Import cancelled; nothing changed.");return;
   }
   const before=new Map(entries.map(([key])=>[key,localStorage.getItem(key)]));
   try{for(const [key,value] of entries)localStorage.setItem(key,value)}
   catch(error){
    for(const [key,old] of before){try{old===null?localStorage.removeItem(key):localStorage.setItem(key,old)}catch{}}
    throw Error("Device storage blocked the restore; original values were retained where possible.");
   }
   status("release4-backup-status","Backup restored. Reloading to refresh all saved views…");
   location.reload();
  }catch(e){status("release4-backup-status","Import rejected: "+e.message)}
 }
 function open(){
  if(!dialog)return;
  dialog.showModal();
  void refresh();
 }
 function init(){
  makePanel();
  const menu=qs("oustory-menu");
  if(menu){
   const b=el("button","Offline reading & backup","oustory-menu-row");
   b.type="button";b.onclick=()=>{menu.close();open()};
   const about=[...menu.querySelectorAll("button")].find(x=>x.textContent==="About this edition");
   if(about)about.before(b);else menu.append(b);
  }
  const settings=qs("settings-panel");
  if(settings)row(settings,"Offline reading & saved-data backup",open,"release4-settings-link");
  window.addEventListener("online",()=>{if(dialog?.open)void refresh()});
  window.addEventListener("offline",()=>{if(dialog?.open)void refresh()});
  if("serviceWorker" in navigator)void navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{});
 }
 init();
 window.OustoryRelease4={validate,keys:KEYS};
})();