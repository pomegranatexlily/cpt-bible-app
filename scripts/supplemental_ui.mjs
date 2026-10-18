/* Oustory Supplemental Writings: eight texts and comparison escape. */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const titles=[
 ["1 Enoch",false],["Jasher (Sefer haYashar)",true],["2 Baruch",false],
 ["3 Maccabees",true],["4 Maccabees",true],["Ethiopic Didascalia",false],
 ["Abtilis",false],["Second Book of Covenant",false]
];
async function choose(title) {
 await page.locator("#reference").click();
 await page.locator("#books-panel[open]").waitFor();
 await page.locator("#book-list button.list-button").filter({hasText:title}).last().click();
 await page.locator("#chapter-list button").first().waitFor({timeout:20000});
 await page.locator("#chapter-list button").first().click();
 await page.waitForFunction(()=>document.querySelector("#scripture")?.getAttribute("aria-busy")==="false",null,{timeout:20000});
}
try{
 await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
 await page.locator("#read-button").click();
 for(const [title,versified] of titles){
   await choose(title);
   const body=await page.locator("#scripture").innerText();
   assert.ok(body.length>450,title+" must open substantial source text");
   assert.ok(!/unavailable|source failed|not found|unable to load/i.test(body.slice(0,300)),title+" must not show error");
   assert.match(await page.locator("#reader-source-disclosure").innerText(),/Supplemental Writings/);
   assert.equal(await page.locator("#save-place").isDisabled(),true);
   if(versified)assert.ok(await page.locator("#scripture .verse-number").count()>1,title);
   else{
     assert.ok(await page.locator("#scripture .supplemental-paragraph").count()>1,title);
     assert.match(await page.locator("#chapter-title").innerText(),/Reading section/);
   }
 }
 await page.locator("#reference").click();
 await page.locator("#book-list button.list-button").filter({hasText:"Jasher (Sefer haYashar)"}).click();
 await page.locator("#chapter-list button").last().waitFor({timeout:20000});
 assert.equal(await page.locator("#chapter-list button").count(),91);
 await page.locator("#chapter-list button").last().click();
 await page.locator("#chapter-title").getByText("Jasher (Sefer haYashar) 91").waitFor();
 assert.equal(await page.locator("#next").isDisabled(),true);
 await page.locator("#reference").click();
 await page.locator("#book-list button").filter({hasText:/^Genesis$/}).click();
 await page.locator('#chapter-list button[aria-label="Genesis, chapter 1"]').click();
 await page.locator("#verse-1").waitFor();
 await page.locator("#verse-1").click();
 await page.getByRole("button",{name:"Compare",exact:true}).click();
 await page.locator("#workbench-root:not([hidden])").waitFor();
 await page.locator("#reference").click();
 await page.locator("#book-list button").filter({hasText:"4 Maccabees"}).last().click();
 await page.locator("#chapter-list button").last().waitFor({timeout:20000});
 assert.equal(await page.locator("#chapter-list button").count(),18);
 await page.locator("#chapter-list button").last().click();
 await page.locator("#chapter-title").getByText("4 Maccabees 18").waitFor();
 assert.equal(await page.locator("#workbench-root").isHidden(),true);
 assert.equal(await page.locator("body").evaluate(e=>e.classList.contains("study-workbench-mode")),false);
 await page.locator("#reference").click();
 await page.locator("#book-list button").filter({hasText:/^Exodus$/}).click();
 await page.locator('#chapter-list button[aria-label="Exodus, chapter 1"]').click();
 await page.locator("#verse-1").waitFor();
 assert.equal(await page.locator("#workbench-root").isHidden(),true);
 assert.deepEqual(errors,[]);
 console.log("PASS: eight supplemental English texts read, 91/18 chapters, honest reader sections, Compare book switch.");
}finally{await browser.close()}
