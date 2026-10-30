/* Oustory Release 4: first-party offline reading. Audio is recorded MP3 files (audio-manifest.json); no device narration. No Scripture transformations. */
"use strict";
const SHELL="oustory-shell-r35-moon3-20261030";
const BOOKS="oustory-books-r5-volume-iii-full-sync-20261020";
const RUNTIME="oustory-runtime-r5-volume-iii-full-sync-20261020";
const APP=new URL(self.registration.scope);
const CORE=[
 "./","./index.html","./privacy.html","./manifest.webmanifest","./cpt-index.js",
 "./oustory-reader.js","./oustory-features.js","./oustory-features.css","./oustory-moon.js","./oustory-moon.css","./vendor/three.min.js",
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
// Refresh the corrected Jeremiah text for readers who installed older
// offline books. Leave their existing copy intact if the network is unavailable.
async function refreshCorrectedJeremiah(){
 try{
  const url=bookUrl("jeremiah");
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok||response.type!=="basic")return;
  const data=await response.clone().json();
  const verse=data?.chapters?.find(c=>c.number===31)?.verses?.find(v=>v.number===31);
  if(data.id!=="jeremiah"||!verse?.text?.includes("house of Yahawadah."))return;
  await (await caches.open(BOOKS)).put(url,response);
 }catch{/* Retain the previously downloaded book when offline. */}
}
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(CORE))
  .then(refreshCorrectedJeremiah).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys()){
   if(key.startsWith("oustory-shell-")&&key!==SHELL)await caches.delete(key);
   if(key.startsWith("oustory-books-")&&key!==BOOKS)await caches.delete(key);
   if(key.startsWith("oustory-runtime-")&&key!==RUNTIME)await caches.delete(key);
  }
  // Delete leftover supplemental documents from pre-existing offline caches.
  const withdrawn=new URL("./data/supplemental/",APP).pathname;
  for(const key of await caches.keys()){
   const cache=await caches.open(key);
   for(const req of await cache.keys()){
    if(new URL(req.url).pathname.startsWith(withdrawn))await cache.delete(req);
   }
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
   // Refresh each requested book instead of silently retaining stale downloaded editions.
   // Keep an existing offline copy only when the network is unavailable.
   const existing=await cache.match(url);
   try{
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok||response.type!=="basic")throw Error("Could not refresh "+id+" ("+response.status+").");
    const body=await response.clone().json();
    if(body.id!==id||!Array.isArray(body.chapters))throw Error("Invalid book data: "+id);
    await cache.put(url,response);
   }catch(error){
    if(!existing)throw error;
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
 if(url.pathname.startsWith(new URL("./data/supplemental/",APP).pathname)){
  event.respondWith(new Response("Withdrawn source draft.",{status:404}));
  return;
 }
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