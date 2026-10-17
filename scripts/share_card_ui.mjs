/* Browser regression for Oustory Release 5 client-only verse image cards. */
import assert from "node:assert/strict";
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
  await page.getByRole("button",{name:"Create verse image"}).click();
  const dialog=page.locator("#oustory-share-card-dialog[open]");
  await dialog.waitFor();
  await dialog.locator("img").waitFor({timeout:20000});
  assert.match(await dialog.locator("h2").innerText(),/Genesis 1:1/);
  assert.match(await dialog.locator("#share-card-status").innerText(),/working text/i);
  const check=await page.evaluate(async()=>{
    const img=document.querySelector("#oustory-share-card-dialog img");
    const blob=await (await fetch(img.src)).blob();
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const bitmap=await createImageBitmap(blob);
    return {type:blob.type,size:blob.size,head:[...bytes.slice(0,8)],
      width:bitmap.width,height:bitmap.height,alt:img.alt};
  });
  assert.equal(check.type,"image/png");
  assert.ok(check.size>20000,"PNG must actually render a visible image");
  assert.deepEqual(check.head,[137,80,78,71,13,10,26,10]);
  assert.equal(check.width,1080);
  assert.ok(check.height>=660&&check.height<=4096);
  assert.ok(check.alt.includes(quote),"Accessible image description must include complete source wording");
  assert.match(check.alt,/EDITORIAL REVIEW ONGOING/);
  const dl=page.waitForEvent("download");
  await dialog.getByRole("button",{name:"Save PNG"}).click();
  const download=await dl;
  assert.equal(download.suggestedFilename(),"oustory-genesis-1-1.png");
  const failure=await download.failure();
  assert.equal(failure,null,"Save PNG must be downloadable as a real browser file");
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
