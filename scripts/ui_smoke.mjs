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
    verification:{
      version:1,
      status:"planning_arithmetic_checked_not_observation_verified",
      checks:{lunar_months_checked:110,year_span_classifications_checked:16},
      unresolved:{
        local_crescent_visibility:"not_verified",
        Abib_or_agricultural_evidence:"not_supplied",
        annual_feast_rule_approval:"not_approved",
        intercalation_policy:"provisional_seasonal_model",
        Shavuot_counting:"not_selected",
        local_sunset_boundaries:"not_established",
        makeup_rules:"not_approved_no_automatic_second_shift"
      }
    },
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
  assert.match(await mark.getAttribute("src"),/oustory-poster-icon-512\.png/);
  await mark.evaluate(img=>img.decode());
  assert.equal(await mark.evaluate(img=>img.naturalWidth),512);
  await page.screenshot({path:"out/ui-smoke/home-mobile.png",fullPage:false});
  await page.getByRole("button",{name:"Feasts & lunar calendar"}).click();
  await page.getByRole("heading",{name:"Covenant Calendar"}).waitFor();
  const grid=page.locator(".calendar-grid");
  await page.locator('.calendar-source-tab[data-source="earlier"]').waitFor();
  await page.locator(".calendar-month-heading").getByText("October 2026").waitFor();
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
  await page.locator(".covenant-study-heading").waitFor();
  assert.equal(await page.locator(".calendar-study .covenant-study-reading").count(),3);
  assert.match(await page.locator(".calendar-study").innerText(),/Exodus 20:8/);
  await page.locator(".calendar-study .covenant-study-mark").first().click();
  const earlyRead=await page.evaluate(()=>JSON.parse(localStorage.getItem("oustory.calendar.study.v1")));
  assert.equal(earlyRead["earlier|2026-10-19|Exodus|20:8"],true,
    "Study progress must be tied to civil date and Early Start track");
  await page.locator('.calendar-source-tab[data-source="later"]').click();
  await page.locator(".calendar-study .covenant-study-reading").first().waitFor();
  assert.equal(await page.locator(".calendar-study .covenant-study-mark").first().getAttribute("aria-pressed"),"false",
    "Late Start must not inherit Early Start reading progress");
  await page.locator('.calendar-source-tab[data-source="earlier"]').click();
  await page.waitForFunction(()=>document.querySelector(".calendar-study .covenant-study-mark")?.getAttribute("aria-pressed")==="true");
  await page.locator(".calendar-verification summary").click();
  await page.getByText(/Mathematical validation does not establish actual crescent sightings/).waitFor();
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
  await page.locator("#verse-panel .verse-more summary").click();
  await page.getByRole("button",{name:"Save verse"}).click();
  const savedVerses=await page.evaluate(()=>JSON.parse(localStorage.getItem("cpt.reader.saved")));
  assert.ok(savedVerses.some(x=>x.book==="genesis"&&x.chapter===2&&x.verse===1),
    "Save Verse must preserve chapter and source verse");
  await page.getByRole("button",{name:"Compare",exact:true}).click();
  await page.locator("#workbench-body .research-pair").waitFor();
  assert.match(await page.locator("#workbench-body .research-column-title").first().innerText(),/Oustory working text/);
  assert.match(await page.locator("#workbench-body .research-column-title").last().innerText(),/1611 printed English KJV/);
  assert.ok(await page.locator("#workbench-body .research-word-diff").count()>0,"Historic English differences should be highlighted");
  await page.getByRole("button",{name:/Back to Scripture/}).click();
  await page.getByRole("button",{name:"Compare versions"}).click();
  await page.locator("#workbench-body .research-pair").first().waitFor();
  assert.ok(await page.locator("#workbench-body .research-word-diff").count()>0);
  await page.screenshot({path:"out/ui-smoke/research-compare-mobile.png",fullPage:false});
  await page.getByRole("button",{name:/Back to Scripture/}).click();
  await page.screenshot({path:"out/ui-smoke/bible-mobile.png",fullPage:false});
  await page.locator("#nav-study").click();
  await page.getByText("Why this rendering — editorial index").waitFor();
  await page.getByText("Covenant topics").waitFor();
  await page.getByRole("heading",{name:"Research desk"}).waitFor();
  await page.locator(".research-correction").waitFor();
  assert.match(await page.locator(".research-correction").innerText(),/Luke 7:5/);
  assert.match(await page.locator(".research-correction").innerText(),/Acts 4:27/);
  await page.locator('[data-research-section="terminology"] > summary').click();
  assert.equal(await page.locator('[data-research-section="terminology"] .feature-list > .research-term').count(),27);
  await page.locator('[data-research-section="witness-questions"] > summary').click();
  assert.equal(await page.locator('[data-research-section="witness-questions"] > .research-term').count(),15);
  await page.getByRole("button",{name:"Saved chapters"}).click();
  await page.locator("#saved-panel[open]").waitFor();
  await page.locator("#saved-list button.list-button").getByText("Genesis 2:1").waitFor();
  await page.locator("#saved-panel [data-close]").click();
  await page.screenshot({path:"out/ui-smoke/study-mobile.png",fullPage:false});
  await page.getByRole("button",{name:"Browse editorial notes"}).click();
  await page.locator("#workbench-note-search").waitFor();
  await page.locator("#workbench-note-search").fill("name in the commission");
  await page.getByRole("button",{name:/The name in the commission/}).click();
  assert.match(await page.locator(".workbench-editorial-body").innerText(),/Yahawah alone/);
  assert.match(await page.locator(".workbench-heading").innerText(),/Founder editorial ruling/);
  await page.getByRole("button",{name:"Read Matthew 28:19"}).click();
  await page.locator(".workbench-verse").waitFor();
  assert.ok((await page.locator(".workbench-verse").innerText()).length>20);
  await page.getByRole("button",{name:/Back to editorial note/}).click();
  await page.getByRole("button",{name:/All editorial notes/}).click();
  await page.getByRole("button",{name:/Back to Study/}).click();
  await page.getByRole("heading",{name:"Research desk"}).waitFor();
    await page.locator("#nav-discover").click();
  await page.getByText("Torah Foundations").waitFor();
  await page.screenshot({path:"out/ui-smoke/discover-mobile.png",fullPage:false});
  await page.locator("#nav-more").click();
  await page.locator("#oustory-menu[open]").waitFor();
  assert.match(await page.locator(".oustory-menu-brand img").getAttribute("src"),/oustory-poster-icon-512\.png/);
  await page.locator(".oustory-menu-brand img").evaluate(img=>img.decode());
  await page.getByRole("button",{name:"Saved places",exact:true}).click();
  await page.locator("#saved-panel[open]").waitFor();
  await page.locator("#saved-list button.list-button").getByText("Genesis 2:1").waitFor();
  await page.locator("#saved-panel [data-close]").click();
  await page.locator("#nav-more").click();
  await page.locator("#oustory-menu[open]").waitFor();
  await page.getByRole("button",{name:"Read the Bible"}).click();
  assert.equal(await page.locator("#read-button").getAttribute("aria-current"),"page");
  await page.locator("#nav-more").click();
  await page.locator("#oustory-menu[open]").waitFor();
  await page.getByRole("button",{name:"Reading settings"}).click();
  await page.locator("#settings-panel[open]").waitFor();
  await page.locator("#settings-panel [data-close]").click();
  // Lazy index: exactly one index request, not 80 sequential chapter-book requests.
  const indexRequests=[];
  const sourceRequests=[];
  page.on("request",request=>{
    if(request.url().endsWith("/data/search-index.json"))indexRequests.push(request.url());
    else if(/\/data\/[^/]+\.json(?:\?|$)/.test(request.url()))sourceRequests.push(request.url());
  });
  await page.getByRole("button",{name:"Search translation"}).click();
  await page.locator("#search-panel[open]").waitFor();
  const beforeSources=sourceRequests.length;
  await page.locator("#search-input").fill("beginning");
  await page.waitForFunction(()=>/matching verses/i.test(document.querySelector("#search-status")?.textContent||""),{timeout:20000});
  assert.ok(await page.locator("#search-results button").count()>0);
  assert.equal(indexRequests.length,1,"Search must fetch one shared index");
  assert.equal(sourceRequests.length,beforeSources,"Search must not fetch full 80-book JSON");
  await page.locator("#search-input").fill("Genesis 1:1");
  await page.locator("#search-results button").getByText("Open Genesis 1:1").waitFor();
  await page.locator("#search-results button").first().click();
  await page.locator("#verse-1").waitFor();
  assert.equal(await page.locator("#chapter-title").textContent(),"Genesis 1");
  await page.locator("#reference").click();
  await page.locator("#books-panel[open]").waitFor();
  const count=await page.locator("#book-list button").count();
  assert.equal(count,99,"80 primary choices and 19 separate supplemental choices must appear");
  assert.equal(await page.locator("#book-list .chapter-picker-title").first().textContent(),"Primary Canon — 80 Books");
  assert.equal(await page.locator("#book-list .chapter-picker-title").last().textContent(),"Supplemental Writings — 19 Books");
  await page.locator("#books-panel [data-close]").click();
  // Legacy chapter-only positions and new exact-verse positions must resume.
  await page.evaluate(()=>localStorage.setItem("cpt.reader.position",
    JSON.stringify({book:"genesis",chapter:2,verse:8})));
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#nav-home").waitFor();
  await page.getByText("Genesis 2:8").waitFor();
  await page.getByRole("button",{name:"Resume reading"}).click();
  await page.locator("#verse-8").waitFor();
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem("cpt.reader.position")))).verse,8);
  // Home connects the next Sabbath to actual Oustory manuscript coordinates.
  await page.locator("#nav-home").click();
  await page.getByRole("heading",{name:"Next Shabbat · Scripture study"}).waitFor();
  await page.locator(".calendar-study-home .covenant-study-reading").first().waitFor();
  assert.match(await page.locator(".calendar-study-home").innerText(),/Exodus 20:8/);
  await page.locator(".calendar-study-home .covenant-study-read").first().click();
  await page.locator("#chapter-title").getByText("Exodus 20").waitFor();
  await page.locator("#verse-8").waitFor();
  // Regression for iPhone screenshot: Psalms 2 comparison must display
  // two complete witness columns, not a 404 or a lingering loading message.
  await page.getByRole("button",{name:"Search translation"}).click();
  await page.locator("#search-panel[open]").waitFor();
  await page.locator("#search-input").fill("Psalms 2:1");
  await page.locator("#search-results button").getByText("Open Psalms 2:1").waitFor();
  await page.locator("#search-results button").first().click();
  await page.locator("#chapter-title").getByText("Psalms 2").waitFor();
  await page.locator("#research-compare-chapter").click();
  await page.locator("#workbench-body .research-pair").first().waitFor({timeout:15000});
  assert.ok(await page.locator("#workbench-body .research-pair").count()>=10,
    "Psalms 2 chapter comparison must contain historical verse pairs");
  assert.ok(!/unavailable|loading both/i.test(await page.locator("#workbench-body").innerText()),
    "Psalms 2 witness must not show a 404 or stale loading message");
  // Regression: a different book must dismiss a stale Compare / Interlinear overlay.
  await page.locator("#reference").click();
  await page.locator("#books-panel[open]").waitFor();
  await page.locator("#book-list button").filter({hasText:/^Exodus$/}).click();
  await page.locator('#chapter-list button[aria-label="Exodus, chapter 1"]').click();
  await page.locator("#chapter-title").getByText("Exodus 1").waitFor();
  assert.equal(await page.locator("#workbench-root").isHidden(),true,
    "Book navigation must close Compare overlay");
  assert.equal(await page.locator("body").evaluate(x=>x.classList.contains("study-workbench-mode")),false);
  await page.locator("#verse-1").click();
  await page.getByRole("button",{name:"Interlinear",exact:true}).click();
  await page.locator("#workbench-root:not([hidden])").waitFor();
  await page.locator("#read-button").click();
  assert.equal(await page.locator("#workbench-root").isHidden(),true,
    "Bible footer must dismiss Interlinear overlay");
  await page.locator("#reference").click();
  await page.locator("#book-list button").filter({hasText:/^3 Maccabees/}).click();
  await page.locator('#chapter-list button[aria-label="3 Maccabees, chapter 1, historical source draft"]').click();
  await page.locator("#chapter-title").getByText("3 Maccabees 1").waitFor();
  await page.locator("#verse-1").waitFor();
  assert.match(await page.locator("#reader-source-disclosure").innerText(),/Supplemental Writings/);
  assert.equal(await page.locator("#save-place").isDisabled(),true,
    "Research drafts must not enter the canonical saved-place ledger");
  await page.locator("#reference").click();
  await page.locator("#book-list button").filter({hasText:/^Genesis$/}).click();
  await page.locator('#chapter-list button[aria-label="Genesis, chapter 1"]').click();
  await page.locator("#chapter-title").getByText("Genesis 1").waitFor();
  assert.equal(await page.locator("#workbench-root").isHidden(),true);
  assert.deepEqual(errors,[],"No uncaught client errors");
  console.log("PASS Release 1 UI: native audio, saved verse, Study/More navigation, fast search, exact verse resume, calendar, all 80 books.");
}finally{await browser.close()}
