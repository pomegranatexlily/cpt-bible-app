/* Browser regression: real upstream generator snapshot, no invented lunar dates. */
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"allow"});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
try{
  // Unlike ui_smoke.mjs, this test deliberately makes the real calendar
  // endpoint unavailable and consumes the generated on-site fallback.
  await page.route("**/shabbat-calendar/calendar.json",route=>route.abort("failed"));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  await page.locator("#nav-home").waitFor();
  await page.getByRole("button",{name:"Feasts & lunar calendar"}).click();
  await page.waitForFunction(()=>/Published calendar snapshot/.test(
    document.querySelector(".calendar-source-notice")?.textContent||""),null,{timeout:20000});
  const title=await page.locator(".calendar-month-heading").textContent();
  assert.match(title,/^[A-Za-z]+ 20[2-9][0-9]$/);
  assert.ok(await page.locator(".calendar-day").count()>=28);
  const chosen=await page.locator(".calendar-day[aria-pressed=true]").getAttribute("data-date");
  await page.locator(".calendar-source-tab[data-source=later]").click();
  assert.equal(await page.locator(".calendar-day[aria-pressed=true]").getAttribute("data-date"),chosen,
    "Switching year starts must not change the selected civil date");
  assert.match(await page.locator(".calendar-source-notice").textContent(),/April 7, 2027/);
  await page.locator(".calendar-source-tab[data-source=earlier]").click();
  assert.match(await page.locator(".calendar-source-notice").textContent(),/March 9, 2027/);
  // The offline shell must cache the same canonical snapshot before airplane mode.
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:20000});
  const cached=await page.evaluate(async()=>!!(await caches.match("./calendar/published.json")));
  assert.ok(cached,"PWA must precache the canonical calendar snapshot");
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#nav-home").waitFor();
  await page.getByRole("button",{name:"Feasts & lunar calendar"}).click();
  await page.waitForFunction(()=>/Published calendar snapshot/.test(
    document.querySelector(".calendar-source-notice")?.textContent||""),null,{timeout:20000});
  assert.ok(await page.locator(".calendar-day").count()>=28,"Calendar remains useful in airplane mode");
  assert.deepEqual(errors,[],"No unexpected browser JavaScript exceptions");
  console.log("PASS: upstream calendar fetch failure, live feed fallback, track switch, offline reload, and source disclosure.");
}finally{await browser.close()}
