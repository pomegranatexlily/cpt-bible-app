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
  // The production Shabbat engine is another Pages project. Intercept the
  // request with representative published-schema data so UI regressions
  // cannot depend on network timing or availability of another repository.
  const currentMonths=[
    {year:null,month:null,start:"2026-10-12",end:"2026-11-09",days:29,status:"supplied"},
    {year:null,month:null,start:"2026-11-10",end:"2026-12-09",days:30,status:"supplied"},
    {year:null,month:null,start:"2026-12-10",end:"2027-01-07",days:29,status:"supplied"},
    {year:null,month:null,start:"2027-01-08",end:"2027-02-06",days:30,status:"supplied"},
    {year:null,month:null,start:"2027-02-07",end:"2027-03-08",days:30,status:"supplied"}
  ];
  const currentEvents=[
    {date:"2026-10-12",title:"New Moon",kind:"new_moon",lunar_day:1,status:"supplied",source:"user_supplied_month_start"},
    {date:"2026-10-18",title:"Preparation for Shabbat",kind:"preparation",lunar_day:7,status:"supplied",source:"user_supplied_month_start"},
    {date:"2026-10-19",title:"Shabbat",kind:"sabbath",lunar_day:8,status:"supplied",source:"user_supplied_month_start"},
    {date:"2026-10-26",title:"Shabbat",kind:"sabbath",lunar_day:15,status:"supplied",source:"user_supplied_month_start"},
    {date:"2026-11-02",title:"Shabbat",kind:"sabbath",lunar_day:22,status:"supplied",source:"user_supplied_month_start"},
    {date:"2026-11-09",title:"Shabbat",kind:"sabbath",lunar_day:29,status:"supplied",source:"user_supplied_month_start"}
  ];
  const sampleLive={
    schema_version:2,
    tracks:{
      earlier:{
        current_months:currentMonths,
        current_events:currentEvents,
        years:[{year:2027,start_date:"2027-03-09",next_start_date:"2028-02-25",month_count:12,has_13th_month:false}],
        months:[
          {year:2027,month:1,start:"2027-03-09",end:"2027-04-06",days:29,is_thirteenth:false},
          {year:2027,month:2,start:"2027-04-07",end:"2027-05-05",days:29,is_thirteenth:false}
        ],
        events:[
          {date:"2027-03-09",title:"New Moon",kind:"new_moon",track:"earlier",year:2027,month:1,lunar_day:1,status:"projected"},
          {date:"2027-03-16",title:"Shabbat",kind:"sabbath",track:"earlier",year:2027,month:1,lunar_day:8,status:"projected"},
          {date:"2027-03-22",title:"Passover",kind:"feast",track:"earlier",year:2027,month:1,lunar_day:14,status:"projected",rule_status:"unapproved_draft"},
          {date:"2027-04-07",title:"New Moon",kind:"new_moon",track:"earlier",year:2027,month:2,lunar_day:1,status:"projected"}
        ]
      },
      later:{
        current_months:currentMonths,
        current_events:currentEvents,
        years:[{year:2027,start_date:"2027-04-07",next_start_date:"2028-03-26",month_count:12,has_13th_month:false}],
        months:[{year:2027,month:1,start:"2027-04-07",end:"2027-05-06",days:30,is_thirteenth:false}],
        events:[
          {date:"2027-04-07",title:"New Moon",kind:"new_moon",track:"later",year:2027,month:1,lunar_day:1,status:"projected"},
          {date:"2027-04-14",title:"Shabbat",kind:"sabbath",track:"later",year:2027,month:1,lunar_day:8,status:"projected"},
          {date:"2027-04-20",title:"Passover",kind:"feast",track:"later",year:2027,month:1,lunar_day:14,status:"projected",rule_status:"unapproved_draft"}
        ]
      }
    }
  };
  await page.route("https://pomegranatexlily.github.io/shabbat-calendar/calendar.json",route=>
    route.fulfill({status:200,contentType:"application/json",
      headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify(sampleLive)}));
  await page.clock.install({time:new Date("2026-10-17T16:00:00Z")});
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
  await page.locator('.calendar-source-tab[data-source="earlier"]').waitFor();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"October 2026");
  assert.equal(await page.locator(".calendar-source-tab[aria-pressed=true]").textContent(),"Early Start");
  assert.equal(await page.locator(".calendar-source-tab").count(),2,"Only the two current cycle choices should be visible");
  assert.equal(await grid.locator(".calendar-weekday").count(),7);
  assert.ok((await grid.locator(".calendar-day").count())%7===0);
  assert.match(await page.locator(".calendar-next").innerText(),/October 19, 2026/);
  assert.equal(await page.getByText(/Xalendaria|2025 Lunar|\.csv/i).count(),0,
    "Historic filenames and source choices must not appear in the calendar UI");
  await page.screenshot({path:"out/ui-smoke/current-october-mobile.png",fullPage:false});
  await page.locator(".calendar-next").click();
  await page.locator(".calendar-detail-heading").getByText("October 19, 2026").waitFor();
  await page.locator(".calendar-detail-item").getByRole("heading",{name:"Shabbat"}).waitFor();
  assert.match(await page.locator(".calendar-lunar-context").innerText(),/Lunar Day 8/);
  await page.getByRole("button",{name:"Today",exact:true}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"October 2026");
  await page.locator(".calendar-detail-heading").getByText("October 17, 2026").waitFor();
  await page.locator('.calendar-source-tab[data-source="later"]').click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"October 2026");
  await page.locator(".calendar-detail-heading").getByText("October 17, 2026").waitFor();
  assert.match(await page.locator(".calendar-next").innerText(),/October 19, 2026/);
  await page.getByRole("button",{name:"Next New Year"}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"April 2027");
  await grid.locator('.calendar-day[data-date="2027-04-07"]').click();
  assert.match(await page.locator(".calendar-lunar-context").innerText(),/Month 1 · Day 1/);
  await page.locator('.calendar-source-tab[data-source="earlier"]').click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"April 2027","Track switch must preserve month");
  await grid.locator('.calendar-day[data-date="2027-04-07"]').click();
  assert.match(await page.locator(".calendar-lunar-context").innerText(),/Month 2 · Day 1/);
  await page.screenshot({path:"out/ui-smoke/calendar-mobile.png",fullPage:false});
  await page.getByRole("button",{name:"Today",exact:true}).click();
  assert.equal(await page.locator(".calendar-month-heading").textContent(),"October 2026");
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
