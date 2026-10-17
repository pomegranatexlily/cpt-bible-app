"use strict";
/* Oustory: a single practical Covenant Calendar showing the current month,
 * two parallel year-start cycles, and the next Shabbat. Historical source
 * archives remain in the repo for research but NEVER appear in this UI.
 * Live dates come exclusively from Shabbat Calendar's shared JSON feed.
 */
(() => {
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const TRACKS={earlier:"Early Start",later:"Late Start"};
  const typeName={feast:"Feast (draft)",sabbath:"Shabbat","new-moon":"New Moon",preparation:"Preparation"};
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
  const utc=(y,m,d)=>new Date(Date.UTC(y,m,d,12));
  const iso=date=>date.toISOString().slice(0,10);
  const dateObj=s=>utc(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10));
  const fmt=s=>dateObj(s).toLocaleDateString("en-US",{timeZone:"UTC",month:"long",day:"numeric",year:"numeric"});
  const dayName=s=>dateObj(s).toLocaleDateString("en-US",{timeZone:"UTC",weekday:"long"});
  const todayIso=()=>{const d=new Date();return iso(utc(d.getFullYear(),d.getMonth(),d.getDate()))};
  const LIVE_URL=typeof location!=="undefined"&&location.hostname==="pomegranatexlily.github.io"
    ?location.origin+"/shabbat-calendar/calendar.json"
    :"https://pomegranatexlily.github.io/shabbat-calendar/calendar.json";
  let feedPromise=null;
  const TRACK_KEY="oustory.calendar.track";
  function rememberedTrack(){
    try{return localStorage.getItem(TRACK_KEY)==="later"?"later":"earlier"}catch{return "earlier"}
  }
  function rememberTrack(track){try{localStorage.setItem(TRACK_KEY,track)}catch{}}

  function loadLive(){
    if(!feedPromise)feedPromise=fetch(LIVE_URL,{cache:"no-cache"}).then(r=>{
      if(!r.ok)throw new Error("Calendar feed unavailable");
      return r.json();
    }).then(data=>{
      if(data.schema_version!==2||!data.tracks?.earlier?.years?.length||!data.tracks?.later?.years?.length)
        throw new Error("Unexpected calendar data");
      return data;
    }).catch(e=>{feedPromise=null;throw e});
    return feedPromise;
  }
  const typeOf=e=>e.kind==="new_moon"?"new-moon":e.kind==="sabbath"?"sabbath":
                 e.kind==="preparation"?"preparation":"feast";
  function mapEvents(track){
    const byDay=new Map();
    for(const event of [...(track.current_events||[]),...track.events]){
      if(!byDay.has(event.date))byDay.set(event.date,[]);
      byDay.get(event.date).push(event);
    }
    return byDay;
  }
  function monthAt(track,day){
    return [...(track.current_months||[]),...track.months]
      .find(m=>m.start<=day&&m.end>=day);
  }
  function shabbatAfter(track,today){
    return [...(track.current_events||[]),...track.events]
      .filter(e=>e.kind==="sabbath"&&e.date>=today)
      .sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
  }
  function calendarCells(year,month){
    const first=utc(year,month,1),offset=first.getUTCDay();
    const length=utc(year,month+1,0).getUTCDate();
    const rows=Math.ceil((offset+length)/7);
    return Array.from({length:rows*7},(_,i)=>{
      const d=utc(year,month,1-offset+i);
      return {iso:iso(d),day:d.getUTCDate(),inMonth:d.getUTCMonth()===month};
    });
  }
  // Archive parsing utilities remain exported solely for the historical
  // integrity tests. No file names or archived source choices are shown.
  function lunarFeasts(raw){
    const out=[];
    const reg=/(Trumpets|Atonement|Feast of Tabernacles|Feast of Dedication)\s*\(([^)]+)\)/g;
    let m;
    function parse(val,defaultMonth){
      const match=/^(?:([A-Za-z]+)\s+)?(\d{1,2})$/.exec(val.trim());
      if(!match)return null;
      const mon=MONTHS.findIndex(x=>x.toLowerCase()===(match[1]||defaultMonth||"").toLowerCase());
      const d=utc(2025,mon,+match[2]);
      return mon>=0&&d.getUTCMonth()===mon?iso(d):null;
    }
    while((m=reg.exec(raw||""))){
      const parts=m[2].split(/\s*-\s*/);
      const month=/^([A-Za-z]+)\s+\d{1,2}$/.exec(parts[0]);
      if(!month||parts.length>2)continue;
      const start=parse(parts[0]);
      const end=parts[1]?parse(parts[1],month[1]):start;
      if(start&&end&&end>=start)out.push({start,end,subject:m[1],type:"feast",description:"Feast listed in archived lunar source"});
    }
    return out;
  }
  function normalize(source){
    if(source.id==="xalendaria")return source.entries.map(e=>({
      start:e.start,end:e.end,subject:e.subject,
      type:e.subject.startsWith("Prep /")?"preparation":e.subject==="Weekly Sabbath"?"sabbath":e.subject==="New Moon"?"new-moon":"feast",
      source_row:e.row,description:e.description
    }));
    return source.entries.flatMap(m=>[
      {start:m.new_moon,end:m.new_moon,subject:"New Moon",type:"new-moon"},
      ...m.sabbaths.map(day=>({start:day,end:day,subject:"Weekly Sabbath",type:"sabbath"})),
      ...lunarFeasts(m.feasts_raw)
    ]);
  }
  function dailyIndex(events){
    const map=new Map();
    for(const e of events){
      const first=dateObj(e.start),last=dateObj(e.end);
      for(let d=first,n=0;d<=last&&n<45;n++,d=utc(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)){
        const key=iso(d);
        if(!map.has(key))map.set(key,[]);
        map.get(key).push(e);
      }
    }
    return map;
  }

  function render(target,back,go){
    target.replaceChildren();
    target.append(make("p","Oustory · Covenant time","feature-eyebrow"),
      make("h1","Covenant Calendar","feature-title"),
      make("p","Your current lunar month, Shabbats, New Moons, and upcoming observances.","feature-description"));
    const backBtn=make("button","← Home","feature-action");
    backBtn.type="button";backBtn.onclick=()=>back?.();
    const actions=make("div",undefined,"calendar-top");actions.append(backBtn);target.append(actions);
    const notice=make("p","Loading calendar…","calendar-source-notice");target.append(notice);
    const upNext=make("button",undefined,"calendar-next");
    upNext.type="button";upNext.setAttribute("aria-label","Go to next Shabbat");upNext.hidden=true;
    target.append(upNext);
    const sourceBar=make("div",undefined,"calendar-source-tabs");
    sourceBar.setAttribute("role","group");sourceBar.setAttribute("aria-label","Choose year-start calendar");
    for(const [id,label] of Object.entries(TRACKS)){
      const b=make("button",label,"calendar-source-tab");b.type="button";b.dataset.source=id;
      b.setAttribute("aria-pressed",String(id==="earlier"));sourceBar.append(b);
    }
    target.append(sourceBar);
    const explanation=make("p","Both choices follow the same lunar dates. They differ in which spring New Moon begins the religious year.","calendar-track-help");
    target.append(explanation);
    const nav=make("div",undefined,"calendar-month-nav");
    const previous=make("button","‹","calendar-nav-button");
    previous.type="button";previous.setAttribute("aria-label","Previous month");
    const heading=make("h2","Loading…","calendar-month-heading");
    const next=make("button","›","calendar-nav-button");
    next.type="button";next.setAttribute("aria-label","Next month");
    nav.append(previous,heading,next);target.append(nav);
    const quick=make("div",undefined,"calendar-jump");
    const today=make("button","Today","feature-action");
    const newYear=make("button","Next New Year","feature-action");
    for(const b of [today,newYear])b.type="button";
    quick.append(today,newYear);target.append(quick);
    const legend=make("div",undefined,"calendar-legend");
    for(const [type,label] of Object.entries(typeName)){
      const item=make("span",undefined,"calendar-legend-item");
      item.append(make("span",undefined,"calendar-dot dot-"+type),document.createTextNode(label));
      legend.append(item);
    }
    target.append(legend);
    const grid=make("div",undefined,"calendar-grid");
    grid.setAttribute("role","group");grid.setAttribute("aria-label","Month dates");
    target.append(grid);
    const detail=make("section",undefined,"calendar-details");
    detail.setAttribute("aria-live","polite");target.append(detail);
    const dayStudy=make("section",undefined,"calendar-study");target.append(dayStudy);
    const verification=make("details",undefined,"calendar-verification");
    verification.append(make("summary","Calendar verification and open decisions"));
    target.append(verification);
    const footer=make("p","Calendar dates use supplied lunar month starts and modeled future months. Draft feasts are not approved dates. Sunset timing is not calculated.","feature-status calendar-footer");
    target.append(footer);

    let data=null,source=rememberedTrack(),year=0,month=0,selected=null,days=new Map();
    function active(){return data?.tracks[source]}
    function jump(day){
      const d=dateObj(day);year=d.getUTCFullYear();month=d.getUTCMonth();selected=day;update();
    }
    function renderNext(){
      const event=shabbatAfter(active(),todayIso());
      upNext.replaceChildren();
      upNext.hidden=!event;
      if(!event)return;
      upNext.append(make("span","UP NEXT · SHABBAT","calendar-next-eyebrow"));
      upNext.append(make("strong",dayName(event.date)+", "+fmt(event.date),"calendar-next-date"));
      upNext.append(make("span","Lunar Day "+event.lunar_day+
        (event.source==="user_supplied_month_start"?" · From supplied New Moon":" · Projected"),"calendar-next-note"));
      upNext.onclick=()=>jump(event.date);
    }
    function renderDay(){
      const events=days.get(selected)||[];
      const lunar=monthAt(active(),selected);
      detail.replaceChildren(make("h3",fmt(selected),"calendar-detail-heading"));
      if(lunar){
        const n=Math.round((dateObj(selected)-dateObj(lunar.start))/86400000)+1;
        detail.append(make("p",lunar.month?
          "Israelite year "+lunar.year+" · Month "+lunar.month+
          (lunar.is_thirteenth?" (13th month)":"")+" · Day "+n:
          "Lunar Day "+n+" · New Moon "+fmt(lunar.start),"calendar-lunar-context"));
      }else{
        detail.append(make("p","No lunar month is supplied or projected for this date.","feature-status"));
      }
      if(!events.length&&lunar)detail.append(make("p","No marked observance for this lunar day.","feature-status"));
      const list=make("div",undefined,"calendar-detail-list");
      for(const event of events){
        const kind=typeOf(event),item=make("article",undefined,"calendar-detail-item calendar-type-"+kind);
        const marker=event.rule_status==="unapproved_draft"?"DRAFT FEAST · NOT APPROVED":
          event.status==="projected"?typeName[kind]+" · PROJECTED":typeName[kind]+" · SUPPLIED MONTH";
        item.append(make("span",marker,"calendar-detail-type"),make("h4",event.title));
        item.append(make("p",(event.month?"Month "+event.month+" · ":"")+
          "Lunar Day "+event.lunar_day,"feature-status"));
        if(event.rule_status==="unapproved_draft")item.append(make("p","Tentative mapping; not a confirmed feast date.","feature-status"));
        list.append(item);
      }
      detail.append(list);
      window.OustoryCalendarStudy?.renderForDay(dayStudy,source,selected,events,go);
    }
    function renderVerification(){
      verification.replaceChildren(make("summary","Calendar verification and open decisions"));
      const a=data?.verification;
      if(!a||a.version!==1){
        verification.append(make("p","Published calendar audit unavailable. No independently observed lunar or agricultural dates are implied.","feature-status"));
        return;
      }
      verification.append(make("p","Arithmetic checked: "+a.checks?.lunar_months_checked+
        " lunar month spans, "+a.checks?.year_span_classifications_checked+
        " seasonal-year classifications across two tracks.","feature-status"));
      verification.append(make("p","Mathematical validation does not establish actual crescent sightings, local sunset boundaries, Abib, or approved feast dates.","feature-status"));
      const labels=[
        ["local_crescent_visibility","Crescent visibility"],
        ["Abib_or_agricultural_evidence","Abib / agriculture"],
        ["annual_feast_rule_approval","Feast rules"],
        ["intercalation_policy","Thirteenth-month policy"],
        ["Shavuot_counting","Shavuot counting"],
        ["local_sunset_boundaries","Sunset boundaries"],
        ["makeup_rules","Makeup observances"]
      ];
      const list=make("ul");
      for(const [key,label] of labels)
        list.append(make("li",label+": "+String(a.unresolved?.[key]??"not verified").replaceAll("_"," ")));
      verification.append(list);
    }
    function update(){
      if(!data)return;
      const track=active();
      days=mapEvents(track);
      heading.textContent=MONTHS[month]+" "+year;
      for(const b of sourceBar.querySelectorAll("button"))b.setAttribute("aria-pressed",String(b.dataset.source===source));
      const firstYear=track.years[0];
      notice.textContent="Year-start options · "+TRACKS[source]+": "+fmt(firstYear.start_date)+" in 2027. Current lunar Shabbats remain the same on both.";
      grid.replaceChildren();
      for(const d of DAYS)grid.append(make("span",d,"calendar-weekday"));
      for(const c of calendarCells(year,month)){
        const events=days.get(c.iso)||[];
        const lunar=monthAt(track,c.iso);
        const b=make("button",undefined,"calendar-day"+(c.inMonth?"":" outside-month")+
          (c.iso===selected?" selected":"")+(c.iso===todayIso()?" is-today":""));
        b.type="button";b.dataset.date=c.iso;b.setAttribute("aria-pressed",String(c.iso===selected));
        b.append(make("span",String(c.day),"calendar-day-number"));
        let dNum=null;
        if(lunar){
          dNum=Math.round((dateObj(c.iso)-dateObj(lunar.start))/86400000)+1;
          b.append(make("span",lunar.month?"M"+lunar.month+" · "+dNum:"Day "+dNum,"calendar-day-lunar"));
        }
        b.setAttribute("aria-label",fmt(c.iso)+(dNum?", lunar day "+dNum:"")+
          (events.length?", "+events.map(e=>e.title).join(", "):""));
        if(events.length){
          const dots=make("span",undefined,"calendar-day-dots");
          for(const kind of ["feast","sabbath","new-moon","preparation"]){
            if(events.some(e=>typeOf(e)===kind))dots.append(make("span",undefined,"calendar-dot dot-"+kind));
          }
          b.append(dots);
          const primary=events.find(e=>e.kind==="sabbath")||events.find(e=>e.kind==="feast")||events[0];
          b.append(make("span",primary.title,"calendar-day-summary"));
        }
        b.onclick=()=>jump(c.iso);
        grid.append(b);
      }
      renderNext();
      renderDay();
    }
    for(const b of sourceBar.querySelectorAll("button")){
      b.onclick=()=>{
        if(!data)return;
        source=b.dataset.source;
        rememberTrack(source);
        // Changing religious years must NEVER move the Gregorian day.
        update();
      };
    }
    previous.onclick=()=>jump(iso(utc(year,month-1,1)));
    next.onclick=()=>jump(iso(utc(year,month+1,1)));
    today.onclick=()=>jump(todayIso());
    newYear.onclick=()=>{
      if(!data)return;
      const candidate=active().years.find(y=>y.start_date>=selected)||active().years.at(-1);
      jump(candidate.start_date);
    };
    loadLive().then(j=>{
      if(!target.isConnected||target.querySelector(".calendar-grid")!==grid)return;
      data=j;
      renderVerification();
      const event=shabbatAfter(active(),todayIso());
      jump(event?.date||todayIso());
    }).catch(e=>{
      notice.textContent="Current calendar unavailable. Try again.";
      const retry=make("button","Retry calendar","feature-action");
      retry.type="button";retry.onclick=()=>render(target,back);
      detail.replaceChildren(make("p","The lunar calendar could not be loaded.","feature-status"),retry);
    });
  }
  window.OustoryCalendar={render,loadLive,rememberedTrack,calendarCells,normalize,lunarFeasts,dailyIndex};
})();
