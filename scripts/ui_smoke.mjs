/* Headless mobile smoke: verify the released app UI, not just source syntax. */
import assert from "node:assert/strict";
import fs from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
fs.mkdirSync("out/ui-smoke",{recursive:true});
try{
  // Browser audio is device-dependent. Mock the native API to test real
  // button wiring/state, not the presence of an audio engine in CI.
  await page.addInitScript(() => {
    window.__oustorySpeech = {spoken:[], cancelled:0};
    class MockUtterance { constructor(text){ this.text=text; this.rate=1; } }
    Object.defineProperty(window,"SpeechSynthesisUtterance",
      {configurable:true,value:MockUtterance});
    Object.defineProperty(window,"speechSynthesis",{
      configurable:true,
      value:{
        speak(utterance){
          window.__oustorySpeech.spoken.push({text:utterance.text,rate:utterance.rate});
          queueMicrotask(()=>utterance.onstart?.());
        },
        cancel(){window.__oustorySpeech.cancelled++},
        getVoices(){return []}
      }
    });
  });
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  await page.locator("#nav-home").waitFor({timeout:20000});
  assert.equal(await page.locator("#nav-home").getAttribute("aria-current"),"page");
  await page.locator(".feature-title").getByText("The nation's record").waitFor();
  await page.locator(".feature-verse").waitFor();
  const mark=page.locator(".oustory-home-identity img");
  assert.match(await mark.getAttribute("src"),/covenant-bible-gold-512\.png/);
  await mark.evaluate(img=>img.decode());
  assert.equal(await mark.evaluate(img=>img.naturalWidth),512);
  await page.screenshot({path:"out/ui-smoke/home-mobile.png",fullPage:false});
  await page.getByRole("button",{name:"Feasts & lunar calendar"}).click();
  await page.getByRole("heading",{name:"Covenant Calendar"}).waitFor();
  const grid=page.locator(".calendar-grid");
  const days=grid.locator("button.calendar-day");
  await page.waitForFunction(()=>document.querySelectorAll(".calendar-day").length>=28);
  assert.equal(await grid.locator(".calendar-weekday").count(),7);
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"February 2026");
  assert.equal(await page.locator(".calendar-source-tab[aria-pressed=true]").textContent(),"Xalendaria");
  assert.ok((await days.count())%7===0);
  for(let i=0;i<6;i++)await page.getByRole("button",{name:"Previous month"}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"August 2025");
  const trumpets=grid.locator('.calendar-day[data-date="2025-08-22"]');
  await trumpets.click();
  await page.locator(".calendar-detail-heading").getByText("August 22, 2025").waitFor();
  await page.locator(".calendar-detail-item").getByRole("heading",{name:"Feast of Trumpets"}).waitFor();
  assert.ok(await trumpets.locator(".dot-feast").count()>0);
  await page.getByRole("button",{name:"2025 Lunar Calendar"}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"January 2026");
  for(let i=0;i<4;i++)await page.getByRole("button",{name:"Previous month"}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"September 2025");
  await grid.locator('.calendar-day[data-date="2025-09-22"]').click();
  await page.locator(".calendar-detail-heading").getByText("September 22, 2025").waitFor();
  await page.locator(".calendar-detail-item").getByRole("heading",{name:"Trumpets"}).waitFor();
  await page.getByRole("button",{name:"Today"}).click();
  await page.getByText(/Outside this source's recorded dates/).waitFor();
  await page.getByRole("button",{name:"Latest recorded"}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"January 2026");
  await page.screenshot({path:"out/ui-smoke/calendar-mobile.png",fullPage:false});
  await page.getByRole("button",{name:"← Home"}).click();
  await page.getByText("The nation's record").waitFor();
  await page.locator("#read-button").click();
  await page.waitForFunction(()=>document.querySelectorAll(".verse-entry").length>=20,{timeout:20000});
  assert.ok((await page.locator("#scripture").innerText()).length>250);
  const audio=page.locator("#chapter-audio");
  await audio.waitFor();
  assert.equal(await audio.locator(".audio-play").getAttribute("aria-label"),"Play chapter");
  assert.equal(await audio.locator(".audio-play").isDisabled(),false);
  await audio.locator(".audio-play").click();
  await page.waitForFunction(()=>window.__oustorySpeech?.spoken.length>=1);
  assert.match((await page.evaluate(()=>window.__oustorySpeech.spoken[0].text)),/beginning/i);
  assert.equal(await audio.locator(".audio-play").getAttribute("aria-label"),"Pause chapter");
  await audio.locator("#audio-rate").selectOption("1.2");
  await page.waitForFunction(()=>window.__oustorySpeech.spoken.some(u=>u.rate===1.2));
  await audio.locator(".audio-play").click();
  assert.equal(await audio.locator(".audio-play").getAttribute("aria-label"),"Resume chapter");
  await audio.locator(".audio-play").click();
  assert.equal(await audio.locator(".audio-play").getAttribute("aria-label"),"Pause chapter");
  await audio.locator(".audio-stop").click();
  assert.equal(await audio.locator(".audio-play").getAttribute("aria-label"),"Play chapter");
  await audio.locator(".audio-play").click();
  await page.locator("#next").click();
  await page.locator("#chapter-title").getByText("Genesis 2").waitFor();
  assert.equal(await audio.locator(".audio-play").getAttribute("aria-label"),"Play chapter");
  await page.waitForFunction(()=>window.__oustorySpeech.cancelled>0);
  await page.locator(".verse-entry").first().click();
  await page.locator("#verse-panel[open]").waitFor();
  assert.ok((await page.locator("#verse-panel .verse-text").innerText()).length>10);
  await page.locator("#verse-panel .icon-button").click();
  await page.screenshot({path:"out/ui-smoke/bible-mobile.png",fullPage:false});
  await page.locator("#nav-study").click();
  await page.getByText("Why this rendering — editorial index").waitFor();
  await page.getByText("Covenant topics").waitFor();
  await page.screenshot({path:"out/ui-smoke/study-mobile.png",fullPage:false});
  await page.getByText("The name in the commission").click();
  await page.locator("#verse-19").waitFor();
  await page.locator("#verse-19").click();
  await page.locator("#verse-panel[open]").waitFor();
  assert.match(await page.locator("#verse-panel .note-text").innerText(),/Yahawah alone/);
  assert.match(await page.locator("#verse-panel .feature-note-type").innerText(),/Founder editorial ruling/i);
  await page.locator("#verse-panel .icon-button").click();
  await page.locator("#nav-study").click();
  await page.locator("#nav-discover").click();
  await page.getByText("Torah Foundations").waitFor();
  await page.screenshot({path:"out/ui-smoke/discover-mobile.png",fullPage:false});
  await page.locator("#nav-more").click();
  await page.locator("#oustory-menu[open]").waitFor();
  assert.match(await page.locator(".oustory-menu-brand img").getAttribute("src"),/covenant-bible-gold-512\.png/);
  await page.locator(".oustory-menu-brand img").evaluate(img=>img.decode());
  await page.locator("#oustory-menu button[aria-label='Close menu']").click();
  await page.locator("#reference").click();
  await page.locator("#books-panel[open]").waitFor();
  const count=await page.locator("#book-list button").count();
  assert.equal(count,80,"All 80 book choices should be present");
  await page.locator("#books-panel [data-close]").click();
  assert.deepEqual(errors,[],"No uncaught client errors");
  console.log("PASS mobile UI: native audio play/pause/stop/rate/navigation, Home, Bible, verse actions, Study grounded Matthew 28 note, Discover plans, More, 80-book picker.");
}finally{await browser.close()}
