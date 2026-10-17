/* Release 4 full-browser regression: offline 80-book reader and data portability. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,serviceWorkers:"allow"});
const page=await context.newPage();
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
try{
 await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
 await page.locator("#nav-more").click();
 await page.getByRole("button",{name:"Offline reading & backup"}).click();
 await page.locator("#release4-panel[open]").waitFor();
 await page.waitForFunction(()=>/of 80 books downloaded/.test(document.querySelector("#release4-offline-status")?.textContent||""),{timeout:15000});
 assert.equal(await page.locator("#release4-title").textContent(),"Offline & saved data");
 await page.locator("#release4-download").click();
 await page.waitForFunction(()=>document.querySelector("#release4-offline-status")?.textContent==="All 80 books are stored for offline reading.",{timeout:120000});
 const actualCount=await page.evaluate(async()=>{
  const cache=await caches.open("oustory-books-r4");
  return (await cache.keys()).filter(r=>/\/data\/[a-z0-9-]+\.json$/.test(new URL(r.url).pathname)).length;
 });
 assert.equal(actualCount,80,"All 80 separate book JSON files must be cached");
 await page.locator("#release4-close").click();
 await context.setOffline(true);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#nav-home").waitFor();
 await page.locator("#reference").click();
 await page.locator("#book-list").getByRole("button",{name:"Revelation",exact:true}).click();
 await page.locator("#chapter-list").getByRole("button",{name:"Revelation, chapter 22"}).click();
 await page.locator("#chapter-title").getByText("Revelation 22").waitFor();
 await page.locator("#verse-1").waitFor();
 assert.ok((await page.locator("#scripture").textContent()).length>100,"Offline chapter must contain actual source text");
 assert.equal(await page.locator("#scripture").getAttribute("aria-busy"),"false");
 // Saved fields are exported without Scripture; imported values must reload into app state.
 await page.evaluate(()=>{
  localStorage.setItem("cpt.reader.saved",JSON.stringify([{book:"genesis",chapter:1,verse:1,label:"Genesis 1:1"}]));
  localStorage.setItem("oustory.highlights",JSON.stringify(["Genesis 1:1"]));
  localStorage.setItem("oustory.calendar.track","later");
 });
 await page.locator("#nav-more").click();
 await page.getByRole("button",{name:"Offline reading & backup"}).click();
 const event=page.waitForEvent("download");
 await page.locator("#release4-export").click();
 const download=await event;
 const backup=JSON.parse(await fs.readFile(await download.path(),"utf8"));
 assert.equal(backup.format,"oustory-saved-study");
 assert.equal(backup.version,1);
 assert.equal(backup.data["oustory.calendar.track"],"later");
 assert.ok(!JSON.stringify(backup).includes("In the beginning"),"Backup is not a duplicate Scripture source");
 await page.evaluate(()=>{
  localStorage.removeItem("cpt.reader.saved");
  localStorage.removeItem("oustory.highlights");
  localStorage.setItem("oustory.calendar.track","earlier");
 });
 page.on("dialog",dialog=>dialog.accept());
 await page.locator("#release4-file").setInputFiles({
  name:"oustory-backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))
 });
 await page.waitForLoadState("domcontentloaded");
 await page.waitForFunction(()=>localStorage.getItem("oustory.calendar.track")==="later");
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("cpt.reader.saved"))),
  [{book:"genesis",chapter:1,verse:1,label:"Genesis 1:1"}]);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("oustory.highlights"))),["Genesis 1:1"]);
 await page.locator("#nav-more").click();
 await page.getByRole("button",{name:"Offline reading & backup"}).click();
 await page.locator("#release4-file").setInputFiles({
  name:"broken.json",mimeType:"application/json",buffer:Buffer.from('{"format":"oustory-saved-study","version":1,"data":{"oustory.calendar.track":"unapproved"}}')
 });
 await page.waitForFunction(()=>/Import rejected/.test(document.querySelector("#release4-backup-status")?.textContent||""));
 assert.equal(await page.evaluate(()=>localStorage.getItem("oustory.calendar.track")),"later",
  "Invalid backup must not change existing saved data");
 await page.locator("#release4-close").click();
 await page.locator("#nav-study").click();
 await page.getByRole("button",{name:"Highlighted verses"}).click();
 await page.getByRole("button",{name:"Genesis 1:1"}).waitFor();
 assert.deepEqual(errors,[],"No browser JavaScript exceptions");
 console.log("PASS Release 4: 80 cached books, offline chapter navigation, backup round-trip, invalid import rejection, accessibility state.");
}finally{await browser.close()}
