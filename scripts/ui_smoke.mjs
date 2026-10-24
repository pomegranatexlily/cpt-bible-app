/* Headless mobile smoke: verify the released app UI, not just source syntax. */
import assert from "node:assert/strict";
import fs from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
// The published reader and Freedom Arkives share a GitHub Pages origin; the
// localhost smoke server does not. Ignore only CSP image warnings for the two
// publisher-owned covers. All other browser errors remain release blockers.
const localOnlyCoverWarning=/^Refused to load the image 'https:\/\/pomegranatexlily\.github\.io\/freedom-arkives\/assets\/covers\/oustory-covenant-bible-volume-(?:i|ii)\.webp' because it violates the following Content Security Policy directive: "img-src 'self' data: blob:"\.\s*$/;
page.on("console",m=>{
  if(m.type()!=="error")return;
  const message=m.text();
  if(localOnlyCoverWarning.test(message))return;
  errors.push(message);
});
// In CI the print PDF is not committed; emulate a real published PDF for discovery.
await page.route("**/assets/oustory-complete-80-book-2026.pdf",route=>
  route.fulfill({status:200,contentType:"application/pdf",body:""}));
fs.mkdirSync("out/ui-smoke",{recursive:true});
try{
  // Browser audio is device-dependent. Mock the native API to test real
  // button wiring/state, not the presence of an audio engine in CI.
  await page.addInitScript(() => {
    window.__oustorySpeech = {spoken:[], cancelled:0};
    class MockUtterance { constructor(text){ this.text=text; this.rate=1; } }
    Object.defineProperty(window,"SpeechSynthesisUtterance",
      {configurable:true,value:MockUtterance});
    // Test native clipboard and share buttons without invoking platform UI.
    window.__verseActions={copied:[],shared:[]};
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
      async writeText(text){window.__verseActions.copied.push(text)}
    }});
    Object.defineProperty(navigator,"share",{configurable:true,value:async payload=>{
      window.__verseActions.shared.push(payload);
    }});
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
  // Cached PWAs previously served the old three-button verse sheet.
  // Verify the HTML requests a newly versioned verse controller and CSS.
  assert.match(await page.locator('script[src^="oustory-features.js"]').getAttribute("src"),/^oustory-features\.js\?v=20261023-nav-v1$/);
  assert.match(await page.locator('script[src^="oustory-reader.js"]').getAttribute("src"),/\?v=20261020-reader-polish$/);
  assert.equal(await page.locator('meta[property="og:image"]').getAttribute("content"),
    "https://pomegranatexlily.github.io/cpt-bible-app/assets/oustory-poster-icon-512.png");
  assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute("content"),"summary");
  assert.match(await page.locator('link[href^="oustory-features.css"]').getAttribute("href"),/\?v=20261023-nav-v1$/);
  assert.match(await page.locator('script[src^="oustory-branding.js"]').getAttribute("src"),/\?v=20261024-edition-escape-v1$/);
  assert.match(await page.locator('link[href^="oustory-branding.css"]').getAttribute("href"),/\?v=20261024-edition-escape-v1$/);

  await page.locator("#nav-home").waitFor({timeout:20000});
  // Navigation uses a shared SVG icon language, keyboard labels, and a clear active state.
  const nav=page.locator(".bottom-dock .dock-button");
  assert.equal(await nav.count(),5);
  assert.deepEqual(await nav.allTextContents(),["Home","Bible","Study","Discover","More"]);
  for(const button of await nav.all()){
    assert.equal(await button.locator("svg.nav-icon[aria-hidden='true']").count(),1);
    assert.ok((await button.getAttribute("aria-label"))?.length);
    assert.ok((await button.evaluate(el=>el.getBoundingClientRect().height))>=44);
  }
  assert.equal(await page.locator(".bottom-dock .nav-symbol").count(),0);
  assert.equal(await page.locator("#nav-home").getAttribute("aria-current"),"page");
  await page.locator("#nav-study").click();
  assert.equal(await page.locator("#nav-study").getAttribute("aria-current"),"page");
  assert.equal(await page.locator("#nav-home").getAttribute("aria-current"),null);
  await page.locator("#nav-home").click();

  assert.equal(await page.locator("#nav-home").getAttribute("aria-current"),"page");
  await page.locator(".feature-title").getByText("The nation's record").waitFor();
  await page.locator(".feature-verse").waitFor();
  // A returning iPhone PWA must refresh its reading when the local day changes.
  const dailyReference=page.locator(".feature-card").first().locator(".feature-status").first();
  await page.waitForFunction(()=>/\d+:\d+/.test(
    document.querySelector(".feature-card .feature-status")?.textContent||""));
  const firstDayReference=await dailyReference.textContent();
  await page.clock.setFixedTime(new Date("2026-10-18T16:00:00Z"));
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(previous=>{
    const ref=document.querySelector(".feature-card .feature-status")?.textContent||"";
    return /\d+:\d+/.test(ref)&&ref!==previous;
  },firstDayReference);
  await page.clock.setFixedTime(new Date("2026-10-17T16:00:00Z"));
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(expected=>
    document.querySelector(".feature-card .feature-status")?.textContent===expected,
    firstDayReference);
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
  // A tap exposes Copy and Share immediately, without opening More.
  const firstVerseText=await page.locator("#verse-panel .verse-text").innerText();
  const verseTools=page.locator("#verse-panel .verse-quick-actions");
  assert.equal(await verseTools.getByRole("button",{name:"Interlinear",exact:true}).count(),0);
  assert.equal(await verseTools.getByRole("button",{name:"Copy verse"}).isVisible(),true);
  assert.equal(await verseTools.getByRole("button",{name:"Share verse"}).isVisible(),true);
  await verseTools.getByRole("button",{name:"Copy verse"}).click();
  const copied=await page.evaluate(()=>window.__verseActions.copied.at(-1));
  assert.equal(copied,firstVerseText+"\n— Genesis 2:1 (Oustory reading edition)");
  assert.match(await page.locator("#verse-feedback").innerText(),/Verse copied/);
  await verseTools.getByRole("button",{name:"Share verse"}).click();
  const shared=await page.evaluate(()=>window.__verseActions.shared.at(-1));
  assert.equal(shared.title,"Genesis 2:1 · Oustory");
  assert.equal(shared.text,copied);
  assert.equal(new URL(shared.url).searchParams.get("book"),"genesis");
  assert.equal(new URL(shared.url).searchParams.get("chapter"),"2");
  assert.equal(new URL(shared.url).searchParams.get("verse"),"1");
  // Prove a new visitor follows the link to the exact chapter and verse,
  // not the previous visitor's saved place or the app Home screen.
  const linkedContext=await browser.newContext({viewport:{width:390,height:844}});
  const linkedPage=await linkedContext.newPage();
  await linkedPage.goto(new URL("./",shared.url).href,{waitUntil:"domcontentloaded"});
  await linkedPage.evaluate(()=>localStorage.setItem("cpt.reader.position",
    JSON.stringify({book:"psalms",chapter:2,verse:3})));
  await linkedPage.goto(shared.url,{waitUntil:"domcontentloaded"});
  await linkedPage.locator("#verse-1").waitFor();
  assert.equal(await linkedPage.locator("#chapter-title").innerText(),"Genesis 2");
  assert.equal(await linkedPage.locator("#read-button").getAttribute("aria-current"),"page");
  assert.deepEqual(await linkedPage.evaluate(()=>window.OustoryReader.getPosition()),
    {book:"genesis",chapter:2,verse:1});
  await linkedContext.close();
  assert.match(await page.locator("#verse-feedback").innerText(),/Verse shared/);
  await page.locator("#verse-panel .verse-more summary").click();
  await page.getByRole("button",{name:"Save verse"}).click();
  const savedVerses=await page.evaluate(()=>JSON.parse(localStorage.getItem("cpt.reader.saved")));
  assert.ok(savedVerses.some(x=>x.book==="genesis"&&x.chapter===2&&x.verse===1),
    "Save Verse must preserve chapter and source verse");
  await page.getByRole("button",{name:"Compare",exact:true}).click();
  await page.locator("#workbench-body .research-pair").waitFor();
  assert.match(await page.locator("#workbench-body .research-column-title").first().innerText(),/CPT · APE/);
  assert.match(await page.locator("#workbench-body .research-column-title").last().innerText(),/1611 KJV/);
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
  // Oustory provides install guidance inside its own app menu; Safari must
  // still perform the native Add to Home Screen operation itself.
  await page.getByRole("button",{name:"Add to Home Screen",exact:true}).click();
  await page.locator("#oustory-install-panel[open]").waitFor();
  assert.match(await page.locator("#oustory-install-instructions").innerText(),/Install app or Add to Home Screen/);
  await page.locator("#oustory-install-panel").getByRole("button",{name:"Copy app link"}).click();
  assert.equal((await page.evaluate(()=>window.__verseActions.copied.at(-1))),"http://127.0.0.1:8765/");
  await page.locator("#oustory-install-panel").getByRole("button",{name:"Close",exact:true}).click();
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
  assert.equal(count,80,"Only the original 80 books must appear");
  assert.equal(await page.locator("#book-list .chapter-picker-title").first().textContent(),"80 Books — Alphanumeric Order");
  // One alphanumeric book list: numeric prefixes 1, 2, 3 first,
  // titles alphabetized within each prefix, followed by A-Z titles.
  const visibleTitles=await page.locator("#book-list button").allTextContents();
  const canonicalTitles=await page.evaluate(()=>window.CPT_BOOKS.map(b=>b.title));
  const collator=new Intl.Collator("en",{numeric:true,sensitivity:"base"});
  assert.deepEqual(visibleTitles,[...canonicalTitles].sort(collator.compare),
    "Every one of the 80 books must appear in natural alphanumeric order");
  assert.equal(visibleTitles[0],"1 Chronicles");
  assert.ok(visibleTitles.indexOf("1 Corinthians")<visibleTitles.indexOf("1 Samuel"));
  assert.ok(visibleTitles.indexOf("1 Samuel")<visibleTitles.indexOf("2 Chronicles"));
  assert.ok(visibleTitles.indexOf("3 John")<visibleTitles.indexOf("Acts"));
  assert.equal(await page.locator("#book-list .chapter-picker-title").count(),1);
  assert.equal(await page.locator("#book-list button").filter({hasText:/Enoch|Jasher|3 Maccabees/}).count(),0);
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
  // Regression: a different book must dismiss a stale Compare / Notes overlay.
  await page.locator("#reference").click();
  await page.locator("#books-panel[open]").waitFor();
  await page.locator("#book-list button").filter({hasText:/^Exodus$/}).click();
  await page.locator('#chapter-list button[aria-label="Exodus, chapter 1"]').click();
  await page.locator("#chapter-title").getByText("Exodus 1").waitFor();
  assert.equal(await page.locator("#workbench-root").isHidden(),true,
    "Book navigation must close Compare overlay");
  assert.equal(await page.locator("body").evaluate(x=>x.classList.contains("study-workbench-mode")),false);
  await page.locator("#verse-1").click();
  await page.getByRole("button",{name:"Notes",exact:true}).click();
  await page.locator("#workbench-root:not([hidden])").waitFor();
  await page.locator("#read-button").click();
  assert.equal(await page.locator("#workbench-root").isHidden(),true,
    "Bible footer must dismiss Notes overlay");
  // Reader must still list only 80 after switching away from study tools.
  await page.locator("#reference").click();
  await page.locator("#books-panel[open]").waitFor();
  assert.equal(await page.locator("#book-list button").count(),80);
  await page.locator("#book-list button").filter({hasText:/^Genesis$/}).click();
  await page.locator('#chapter-list button[aria-label="Genesis, chapter 1"]').click();
  await page.locator("#chapter-title").getByText("Genesis 1").waitFor();
  assert.equal(await page.locator("#workbench-root").isHidden(),true);
  // Regression: on iPhone, scrolling the lengthy About edition sheet must not
  // hide the only exit or trap the reader behind a modal backdrop.
  await page.locator('[data-panel="edition-panel"]').first().click();
  await page.locator("#edition-panel[open]").waitFor();
  const editionState=await page.locator("#edition-panel").evaluate(dialog=>{
    dialog.scrollTop=dialog.scrollHeight;
    const close=dialog.querySelector(".sheet-header [data-close]");
    const sheet=dialog.getBoundingClientRect(),button=close.getBoundingClientRect();
    return {
      scrollTop:dialog.scrollTop,
      closeVisible:button.top>=sheet.top&&button.bottom<=sheet.bottom
    };
  });
  assert.ok(editionState.scrollTop>0,"About edition sheet should be scrollable");
  assert.ok(editionState.closeVisible,"Close control must stay visible after scrolling");
  await page.locator("#edition-panel .sheet-header [data-close]").click();
  await page.locator("#edition-panel[open]").waitFor({state:"hidden"});
  await page.locator('[data-panel="edition-panel"]').first().click();
  await page.locator("#edition-panel[open]").waitFor();
  assert.equal(await page.locator("#edition-panel").evaluate(dialog=>dialog.scrollTop),0,
    "Reopening About edition must start at the header");
  await page.mouse.click(5,5);
  await page.locator("#edition-panel[open]").waitFor({state:"hidden"});
    assert.deepEqual(errors,[],"No uncaught client errors");
  console.log("PASS Release 1 UI: native audio, saved verse, Study/More navigation, fast search, exact verse resume, calendar, all 80 books.");
}finally{await browser.close()}
