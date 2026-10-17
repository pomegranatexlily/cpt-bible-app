/* Release 6 phone-first study test: no invented lexical data, persistent notes, backup. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
try{
 await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
 await page.locator("#read-button").click();
 await page.locator("#verse-1").waitFor();
 await page.locator(".verse-entry").first().click();
 await page.locator("#verse-panel[open]").waitFor();
 const buttons=await page.locator("#verse-panel .verse-quick-actions button").allInnerTexts();
 assert.deepEqual(buttons,["Compare","Interlinear","Notes"],"Only three clear primary verse actions");
 const more=page.locator("#verse-panel .verse-more");
 assert.equal(await more.getAttribute("open"),null,"Advanced tools should be folded by default");
 await page.getByRole("button",{name:"Interlinear",exact:true}).click();
 await page.locator("#workbench-root:not([hidden])").waitFor();
 assert.equal(await page.locator(".bottom-dock").isVisible(),false,"Dedicated study page must not show desktop toolbars");
 await page.waitForFunction(()=>/Verified Hebrew\/Greek word alignment has not been published/.test(document.querySelector("#workbench-body")?.textContent||""),null,{timeout:10000});
 assert.equal(await page.locator(".workbench-original-word").count(),0,
   "No original-language words or Strong's numbers may be invented");
 await page.getByRole("button",{name:"Compare",exact:true}).click();
 await page.locator("#workbench-body .research-pair").waitFor();
 assert.match(await page.locator("#workbench-edition option").innerText(),/1611 King James Bible/);
 await page.getByRole("button",{name:"Notes",exact:true}).click();
 const memo="My personal covenant study note — distinct from author commentary.";
 await page.locator("#workbench-personal-note").fill(memo);
 await page.getByRole("button",{name:"Save note"}).click();
 assert.match(await page.locator("#workbench-note-status").innerText(),/Saved on this device/);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("oustory.personal-notes.v1"))),
   {"genesis|1|1":memo});
 await page.getByRole("button",{name:"Open editorial research for this verse"}).click();
 await page.getByText("Source and editorial evidence").waitFor();
 assert.match(await page.locator(".workbench-evidence").innerText(),/Editorial note status/);
 await page.getByRole("button",{name:/Back to Scripture/}).click();
 await page.locator("#verse-1").waitFor();
 assert.equal(await page.locator(".bottom-dock").isVisible(),true);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#read-button").click();
 await page.locator(".verse-entry").first().click();
 await page.getByRole("button",{name:"Notes",exact:true}).click();
 assert.equal(await page.locator("#workbench-personal-note").inputValue(),memo,
   "Note must survive refresh without account or cloud");
 await page.getByRole("button",{name:/Back to Scripture/}).click();
 await page.locator("#nav-more").click();
 await page.getByRole("button",{name:"Offline reading & backup"}).click();
 const event=page.waitForEvent("download");
 await page.locator("#release4-export").click();
 const downloaded=await event;
 const backup=JSON.parse(await fs.readFile(await downloaded.path(),"utf8"));
 assert.equal(JSON.parse(backup.data["oustory.personal-notes.v1"])["genesis|1|1"],memo,
   "Portable v1 backup must include local personal notes");
 await page.evaluate(()=>localStorage.removeItem("oustory.personal-notes.v1"));
 page.on("dialog",d=>d.accept());
 await page.locator("#release4-file").setInputFiles({
   name:"oustory-notes.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))
 });
 await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem("oustory.personal-notes.v1")||"{}")["genesis|1|1"]);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("oustory.personal-notes.v1"))["genesis|1|1"]),memo);
 // Invalid note key must fail before changing any data.
 await page.locator("#nav-more").click();
 await page.getByRole("button",{name:"Offline reading & backup"}).click();
 await page.locator("#release4-file").setInputFiles({
   name:"bad-note.json",mimeType:"application/json",
   buffer:Buffer.from(JSON.stringify({format:"oustory-saved-study",version:1,
     data:{"oustory.personal-notes.v1":JSON.stringify({"not-a-verse":"bad"})}}))
 });
 await page.waitForFunction(()=>/Import rejected/.test(document.querySelector("#release4-backup-status")?.textContent||""));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("oustory.personal-notes.v1"))["genesis|1|1"]),memo);
 assert.deepEqual(errors,[]);
 console.log("PASS Release 6: three taps, clean compare/interlinear pages, no fake Hebrew, device notes, old-version backup roundtrip and invalid-note rejection.");
}finally{await browser.close()}
