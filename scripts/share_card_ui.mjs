/* Browser regression for Oustory Release 5 client-only verse image cards. */
import assert from "node:assert/strict";
import fs from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},acceptDownloads:true
});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
try{
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  await page.locator("#nav-home").waitFor();
  await page.locator("#read-button").click();
  await page.locator(".verse-entry").first().waitFor({timeout:15000});
  await page.locator(".verse-entry").first().click();
  await page.locator("#verse-panel[open]").waitFor();
  const quote=await page.locator("#verse-panel .verse-text").innerText();
  assert.ok(quote.length>15);
  await page.locator("#verse-panel .verse-more summary").click();
  await page.getByRole("button",{name:"Create verse image"}).click();
  const dialog=page.locator("#oustory-share-card-dialog[open]");
  await dialog.waitFor();
  await dialog.locator("img").waitFor({timeout:20000});
  assert.match(await dialog.locator("h2").innerText(),/Genesis 1:1/);
  assert.match(await dialog.locator("#share-card-status").innerText(),/Image ready to share or save/i);
  // Inspect the actual downloadable file; blob: fetch is flaky on CI's
  // headless service-worker/browser combination.
  const alt=await dialog.locator("img").getAttribute("alt");
  const dl=page.waitForEvent("download");
  await dialog.getByRole("button",{name:"Save PNG"}).click();
  const download=await dl;
  assert.equal(download.suggestedFilename(),"oustory-genesis-1-1.png");
  assert.equal(await download.failure(),null,"Save PNG must be downloadable as a real browser file");
  const bytes=fs.readFileSync(await download.path());
  assert.ok(bytes.length>20000,"PNG must actually render a visible image");
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(bytes.readUInt32BE(16),1080);
  assert.ok(bytes.readUInt32BE(20)>=660&&bytes.readUInt32BE(20)<=4096);
  assert.ok(alt.includes(quote),"Accessible image description must include complete source wording");
  assert.match(alt,/POMEGRANATE × LILY/);
  await dialog.getByRole("button",{name:"Share PNG"}).click();
  assert.match(await dialog.locator("#share-card-status").innerText(),/unsupported|share options/i);
  await dialog.getByRole("button",{name:"Close"}).click();
  assert.equal(await dialog.count(),0);
  // A long passage should get a clear failure, never a silently cropped PNG.
  await page.evaluate(()=>window.OustoryShareCard.open({
    book:"Genesis",chapter:1,verse:1,
    text:"An intentionally overlong source verse for a no-truncation test. ".repeat(600)
  }));
  const long=page.locator("#oustory-share-card-dialog[open]");
  await long.waitFor();
  await page.waitForFunction(()=>/too long/i.test(
    document.querySelector("#share-card-status")?.textContent||""),null,{timeout:10000});
  assert.equal(await long.locator("img").count(),0);
  await long.getByRole("button",{name:"Close"}).click();
  assert.deepEqual(errors,[],"Sharing should not introduce uncaught JavaScript errors");
  console.log("PASS Release 5: offline-friendly PNG image, source/reference disclosure, accessible text, save, safe fallback and no cropping.");
}finally{await browser.close()}
