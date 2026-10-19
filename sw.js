/* Oustory Release 4: first-party offline reading. No Scripture transformations. */
"use strict";
const SHELL="oustory-shell-r13-share-verse-links-20261019";
const BOOKS="oustory-books-r4";
const RUNTIME="oustory-runtime-r4";
const APP=new URL(self.registration.scope);
const CORE=[
 "./","./index.html","./manifest.webmanifest","./cpt-index.js","./supplemental-books.js",
 "./oustory-reader.js","./oustory-features.js","./oustory-features.css",
 "./oustory-branding.js","./oustory-branding.css","./oustory-calendar.js",
 "./oustory-calendar-study.js","./oustory-calendar.css","./oustory-audio.js",
 "./oustory-search.js","./oustory-research.js","./oustory-research.css",
 "./oustory-release4.js","./oustory-release4.css",
 "./oustory-share-card.js","./oustory-share-card.css",
 "./oustory-workbench.js","./oustory-workbench.css",
 "./data/interlinear/manifest.json",
 "./assets/oustory-poster-icon-192.png","./assets/oustory-poster-icon-512.png",
 "./assets/oustory-poster-icon-180.png","./data/genesis.json",
 "./data/editorial-notes.json","./data/covenant-study.json",
 "./data/terminology-review.json","./data/witness-questions.json",
 "./calendar/archive.json","./calendar/published.json"
].map(path=>new URL(path,APP).href);
let activeDownload=null;
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys()){
   if(key.startsWith("oustory-shell-")&&key!==SHELL)await caches.delete(key);
  }
  await self.clients.claim();
 })());
});
function bookUrl(id){return new URL("./data/"+id+".json",APP).href}
async function cacheStatus(){
 const cache=await caches.open(BOOKS);
 const keys=await cache.keys();
 return keys.filter(req=>req.url.startsWith(new URL("./data/",APP).href)&&
  /\/[a-z0-9-]+\.json$/.test(new URL(req.url).pathname)).length;
}
async function downloadBooks(ids,port){
 if(activeDownload){port.postMessage({kind:"error",message:"A download is already in progress."});return}
 if(!Array.isArray(ids)||ids.length!==80||new Set(ids).size!==80||
  ids.some(id=>typeof id!=="string"||!/^[a-z0-9-]+$/.test(id))){
  port.postMessage({kind:"error",message:"Invalid book inventory."});return;
 }
 const job={cancelled:false};activeDownload=job;
 let downloaded=0;
 try{
  const cache=await caches.open(BOOKS);
  for(const id of ids){
   if(job.cancelled){port.postMessage({kind:"cancelled",downloaded,total:ids.length});return}
   const url=bookUrl(id);
   const existing=await cache.match(url);
   if(!existing){
    const response=await fetch(url,{cache:"no-cache"});
    if(!response.ok||response.type!=="basic")throw Error("Could not download "+id+" ("+response.status+").");
    const body=await response.clone().json();
    if(body.id!==id||!Array.isArray(body.chapters))throw Error("Invalid book data: "+id);
    await cache.put(url,response);
   }
   downloaded++;
   port.postMessage({kind:"progress",downloaded,total:ids.length});
  }
  port.postMessage({kind:"complete",downloaded,total:ids.length});
 }catch(error){port.postMessage({kind:"error",message:error.message||"Download failed",downloaded})}
 finally{if(activeDownload===job)activeDownload=null;port.close()}
}
self.addEventListener("message",event=>{
 const {type,ids}=event.data||{};
 if(type==="CANCEL_OFFLINE_DOWNLOAD"){if(activeDownload)activeDownload.cancelled=true;return}
 const port=event.ports&&event.ports[0];
 if(!port)return;
 if(type==="OFFLINE_STATUS"){
  event.waitUntil(cacheStatus().then(count=>port.postMessage({kind:"status",count})).catch(()=>port.postMessage({kind:"error",message:"Storage unavailable."})).finally(()=>port.close()));
 }else if(type==="DOWNLOAD_OFFLINE_BOOKS"){
  event.waitUntil(downloadBooks(ids,port));
 }else if(type==="CLEAR_OFFLINE_BOOKS"){
  event.waitUntil((async()=>{
   if(activeDownload){port.postMessage({kind:"error",message:"Cancel the download first."});return}
   await caches.delete(BOOKS);
   port.postMessage({kind:"cleared"});
  })().catch(()=>port.postMessage({kind:"error",message:"Could not clear offline books."})).finally(()=>port.close()));
 }else{port.close()}
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==APP.origin||!url.pathname.startsWith(APP.pathname))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(SHELL).then(cache=>cache.put(new URL("./",APP),copy)));}
   return response;
  }).catch(async()=>(await caches.match(new URL("./",APP)))||Response.error()));
  return;
 }
 // Verse buttons are first-party UI code: prefer fresh assets online, but
 // preserve the installed offline copy when the phone has no connection.
 // Versioned ?v= URLs bypass an older cache-first service worker on first load.
 if(["oustory-features.js","oustory-features.css","oustory-branding.js","oustory-branding.css","oustory-reader.js"]
   .some(name=>url.pathname===new URL("./"+name,APP).pathname)){
  event.respondWith((async()=>{
   const canonical=new URL(url.pathname,APP.origin).href;
   try{
    const response=await fetch(request,{cache:"no-store"});
    if(!response.ok)throw Error("Verse UI asset unavailable");
    const copy=response.clone();
    event.waitUntil(caches.open(SHELL).then(cache=>cache.put(canonical,copy)));
    return response;
   }catch{
    return (await caches.match(canonical))||Response.error();
   }
  })());
  return;
 }
 if(CORE.includes(url.href)){
  event.respondWith(caches.match(request).then(response=>response||fetch(request).then(async r=>{
   if(r.ok)await (await caches.open(SHELL)).put(request,r.clone());
   return r;
  })));
  return;
 }
 if(url.pathname.startsWith(new URL("./data/",APP).pathname)&&url.pathname.endsWith(".json")){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok){
     const cache=/\/data\/[a-z0-9-]+\.json$/.test(url.pathname)?
       await caches.open(BOOKS):await caches.open(RUNTIME);
     event.waitUntil(cache.put(request,response.clone()));
    }
    return response;
   }catch{
    return (await caches.match(request))||Response.error();
   }
  })());
 }
});