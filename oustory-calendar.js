"use strict";
/* Oustory Covenant Calendar — source-faithful Gregorian month GRID.
 * Archive dates are observations from supplied files, not recurrence rules.
 * Future engine integration replaces normalized records, not the interface.
 */
(() => {
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const SOURCE_LABELS={earlier:"Earlier · March start",later:"Later · April start",xalendaria:"Xalendaria archive",lunar2025:"2025 Lunar archive"};
  let archivePromise=null, livePromise=null;
  // Both GitHub Pages projects are published on the same host. For other
  // hostnames, use the canonical cross-site URL (requires standard CORS).
  const LIVE_URL=location.hostname==="pomegranatexlily.github.io"
    ? location.origin+"/shabbat-calendar/calendar.json"
    : "https://pomegranatexlily.github.io/shabbat-calendar/calendar.json";
  function loadLive(){
    if(!livePromise)livePromise=fetch(LIVE_URL,{cache:"no-cache"})
      .then(r=>{if(!r.ok)throw Error("Live engine unavailable");return r.json()})
      .then(j=>{
        if(j.schema_version!==2||!j.tracks?.earlier?.years?.length||!j.tracks?.later?.years?.length)
          throw Error("Live calendar schema invalid");
        return j;
      }).catch(e=>{livePromise=null;throw e});
    return livePromise;
  }
  const liveEvent=e=>({
    start:e.date,end:e.date,subject:e.title,
    type:e.kind==="new_moon"?"new-moon":e.kind==="sabbath"?"sabbath":
         e.kind==="preparation"?"preparation":"feast",
    description:"Israelite year "+e.year+" · Month "+e.month+" · Day "+e.lunar_day,
    source_row:"live",status:e.status,rule_status:e.rule_status,
    track:e.track,year:e.year,month:e.month,lunar_day:e.lunar_day
  });
  const make=(tag,label,cls)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=label;if(cls)e.className=cls;return e};
  const utc=(y,m,d)=>new Date(Date.UTC(y,m,d,12));
  const iso=date=>date.toISOString().slice(0,10);
  const dateObj=s=>utc(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10));
  const monthId=date=>date.getUTCFullYear()*12+date.getUTCMonth();
  const inRange=(date,from,to)=>date>=from&&date<=to;
  const showDate=s=>dateObj(s).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"});
  const typeName={feast:"Feast",sabbath:"Sabbath","new-moon":"New moon",preparation:"Preparation"};
  const category=s=>s.startsWith("Prep /")?"preparation":s==="Weekly Sabbath"?"sabbath":s==="New Moon"?"new-moon":"feast";
  function parseEnglishDate(s,defaultMonth){
    const m=/^(?:([A-Za-z]+)\s+)?(\d{1,2})$/.exec(s.trim());
    if(!m)return null;
    const monthName=m[1]||defaultMonth;
    const month=MONTHS.findIndex(x=>x.toLowerCase()===monthName.toLowerCase());
    if(month<0||+m[2]<1||+m[2]>31)return null;
    const d=utc(2025,month,+m[2]);
    return (d.getUTCMonth()===month)?iso(d):null;
  }
  function lunarFeasts(raw){
    const feasts=[];
    const reg=/(Trumpets|Atonement|Feast of Tabernacles|Feast of Dedication)\s*\(([^)]+)\)/g;
    let m;
    while((m=reg.exec(raw||""))){
      const bits=m[2].split(/\s*-\s*/);
      const first=/^([A-Za-z]+)\s+\d{1,2}$/.exec(bits[0]);
      if(!first||bits.length>2)continue;
      const start=parseEnglishDate(bits[0]);
      const end=bits[1]?parseEnglishDate(bits[1],first[1]):start;
      if(!start||!end||end<start)continue;
      feasts.push({start,end,subject:m[1],type:"feast",description:"Feast dates as written in the 2025 lunar calendar",source_row:raw});
    }
    return feasts;
  }
  function normalize(source){
    if(source.id==="xalendaria"){
      return source.entries.map(e=>({
        start:e.start,end:e.end,subject:e.subject,type:category(e.subject),
        description:e.description,source_row:e.row,prep_reminder_date:e.reminder_enabled?e.reminder_date:null
      }));
    }
    const out=[];
    for(const m of source.entries){
      out.push({start:m.new_moon,end:m.new_moon,subject:"New Moon",type:"new-moon",description:m.lunar_month,source_row:m.row});
      for(const day of m.sabbaths)out.push({start:day,end:day,subject:"Weekly Sabbath",type:"sabbath",description:m.lunar_month,source_row:m.row});
      for(const feast of lunarFeasts(m.feasts_raw))out.push({...feast,source_row:m.row});
    }
    return out;
  }
  function dailyIndex(events){
    const days=new Map();
    for(const event of events){
      let d=dateObj(event.start),last=dateObj(event.end);
      if(last<d)continue;
      for(let n=0;d<=last&&n<45;n++,d=utc(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)){
        const key=iso(d);if(!days.has(key))days.set(key,[]);
        days.get(key).push(event);
      }
    }
    return days;
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
  function getCurrentCivilDate(){
    // Date-only label: local current civil date, never used to calculate
    // religious observances or choose covenant-day boundaries.
    const d=new Date();
    return [d.getFullYear(),d.getMonth(),d.getDate()];
  }
  function bootData(){
    if(!archivePromise){
      archivePromise=fetch("calendar/archive.json").then(r=>{
        if(!r.ok)throw new Error("Calendar archive unavailable");
        return r.json();
      }).then(j=>{
        if(j.schema_version!==1||j.sources?.[0]?.entries?.length!==152||j.sources?.[1]?.entries?.length!==11)throw new Error("Unexpected source calendar format");
        return j;
      }).catch(e=>{archivePromise=null;throw e});
    }
    return archivePromise;
  }
  function render(target,back){
    target.replaceChildren();
    target.append(make("p","Oustory · Covenant dates","feature-eyebrow"),make("h1","Covenant Calendar","feature-title"),make("p","Explore a real month-by-month calendar with your recorded feasts, new moons, Sabbaths, and preparation days.","feature-description"));
    const top=make("div",undefined,"calendar-top");
    const backBtn=make("button","← Home","feature-action");
    backBtn.type="button";backBtn.onclick=()=>back?.();
    top.append(backBtn);target.append(top);
    const notice=make("p","Loading your historical calendars…","calendar-source-notice");target.append(notice);
    const sourceBar=make("div",undefined,"calendar-source-tabs");sourceBar.setAttribute("role","group");sourceBar.setAttribute("aria-label","Calendar source");target.append(sourceBar);
    const nav=make("div",undefined,"calendar-month-nav");
    const previous=make("button","‹","calendar-nav-button");
    previous.type="button";previous.setAttribute("aria-label","Previous month");
    const heading=make("h2",undefined,"calendar-month-heading");heading.id="calendar-month-heading";
    const next=make("button","›","calendar-nav-button");
    next.type="button";next.setAttribute("aria-label","Next month");
    nav.append(previous,heading,next);target.append(nav);
    const quick=make("div",undefined,"calendar-jump");
    const today=make("button","Today","feature-action"),recorded=make("button","Latest recorded","feature-action");
    today.type=recorded.type="button";
    quick.append(today,recorded);target.append(quick);
    const legend=make("div",undefined,"calendar-legend");
    for(const [type,label] of Object.entries(typeName)){
      const item=make("span",undefined,"calendar-legend-item");
      item.append(make("span",undefined,"calendar-dot dot-"+type),document.createTextNode(label));
      legend.append(item);
    }
    target.append(legend);
    const grid=make("div",undefined,"calendar-grid");
    grid.setAttribute("role","group");
    grid.setAttribute("aria-label","Month dates");
    target.append(grid);
    const detail=make("section",undefined,"calendar-details");
    detail.setAttribute("aria-live","polite");target.append(detail);
    const foot=make("p","These are supplied historical calendar entries, not automatically calculated feast dates. No notifications are sent from this view.","feature-status calendar-footer");
    target.append(foot);
    let source="earlier",events=[],days=new Map(),range=null,selected=null,year,month,archive=null,live=null;
    function setSource(sourceId){
      source=sourceId;
      const isLive=source==="earlier"||source==="later";
      if(isLive){
        if(!live?.tracks?.[source])return;
        const track=live.tracks[source];
        events=track.events.map(liveEvent);
        days=dailyIndex(events);
        const first=track.years[0],last=track.years.at(-1);
        range={start:first.start_date,end:iso(utc(...(()=>{const d=dateObj(last.next_start_date);return [d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-1]})()))};
        const anchor=dateObj(first.start_date);year=anchor.getUTCFullYear();month=anchor.getUTCMonth();
        selected=first.start_date;
        notice.textContent=SOURCE_LABELS[source]+" · projected year starts "+showDate(first.start_date)+". New Moons and Shabbats use modeled lunar months. Draft feast dates are not approved observances.";
        recorded.textContent="Year start";
        foot.textContent="Provisional model: not a confirmed crescent, sunset, or agricultural observation. Feast rules are draft only. No notifications are sent.";
      }else{
        const src=archive?.sources.find(s=>s.id===source);
        if(!src)return;
        events=normalize(src);
        days=dailyIndex(events);
        const all=events.flatMap(e=>[e.start,e.end]).sort();
        range={start:all[0],end:all.at(-1)};
        const anchor=dateObj(range.end);year=anchor.getUTCFullYear();month=anchor.getUTCMonth();
        selected=range.end;
        notice.textContent=SOURCE_LABELS[source]+" · recorded "+showDate(range.start)+" – "+showDate(range.end)+". Blank outside this range means the source has no records.";
        recorded.textContent="Latest recorded";
        foot.textContent="Historical source entries. No future dates are extrapolated from these files; no notifications are sent.";
      }
      for(const b of sourceBar.querySelectorAll("button"))b.setAttribute("aria-pressed",String(b.dataset.source===source));
      update();
    }
    function showDay(isoDay){
      const entries=days.get(isoDay)||[];
      detail.replaceChildren();
      const h=make("h3",showDate(isoDay),"calendar-detail-heading");detail.append(h);
      if(!inRange(isoDay,range.start,range.end)){
        detail.append(make("p","Outside this source's recorded dates. Oustory has not calculated any observances for this day.","feature-status"));
      }else if(!entries.length){
        detail.append(make("p","No observance recorded for this date in the selected file. This does not establish that none occurred.","feature-status"));
      }else{
        const list=make("div",undefined,"calendar-detail-list");
        const unique=new Set();
        for(const e of entries){
          const signature=e.subject+"|"+e.start+"|"+e.end;
          if(unique.has(signature))continue;unique.add(signature);
          const item=make("article",undefined,"calendar-detail-item");
          item.classList.add("calendar-type-"+e.type);
          item.append(make("span",typeName[e.type],"calendar-detail-type"),make("h4",e.subject));
          if(e.start!==e.end)item.append(make("p","Recorded: "+showDate(e.start)+" – "+showDate(e.end),"feature-status"));
          if(e.description)item.append(make("p",e.description,"feature-status"));
          item.append(make("p",SOURCE_LABELS[source]+" · source row "+e.source_row,"calendar-provenance"));
          list.append(item);
        }
        detail.append(list);
      }
    }
    function update(){
      const cells=calendarCells(year,month);
      heading.textContent=MONTHS[month]+" "+year;
      grid.replaceChildren();
      for(const d of DAYS)grid.append(make("span",d,"calendar-weekday"));
      const current=getCurrentCivilDate();
      const currentIso=iso(utc(...[current[0],current[1],current[2]]));
      for(const c of cells){
        const eventList=days.get(c.iso)||[];
        const button=make("button",undefined,"calendar-day"+(c.inMonth?"":" outside-month")+(c.iso===selected?" selected":"")+(c.iso===currentIso?" is-today":""));
        button.type="button";button.dataset.date=c.iso;
        button.setAttribute("aria-label",showDate(c.iso)+(eventList.length?", "+eventList.map(e=>e.subject).join(", "):", no recorded observances"));
        button.setAttribute("aria-pressed",String(c.iso===selected));
        button.append(make("span",String(c.day),"calendar-day-number"));
        if(eventList.length){
          const indicators=make("span",undefined,"calendar-day-dots");
          for(const t of ["feast","sabbath","new-moon","preparation"]){
            if(eventList.some(e=>e.type===t))indicators.append(make("span",undefined,"calendar-dot dot-"+t));
          }
          button.append(indicators);
          const highlighted=eventList.find(e=>e.type==="feast")||eventList.find(e=>e.type==="sabbath")||eventList[0];
          button.append(make("span",highlighted.subject.replace(/^Prep \/\s*/,"Prep: "),"calendar-day-summary"));
        }
        button.onclick=()=>{
          if(!c.inMonth){const d=dateObj(c.iso);year=d.getUTCFullYear();month=d.getUTCMonth()}
          selected=c.iso;update();
        };
        grid.append(button);
      }
      showDay(selected??iso(utc(year,month,1)));
    }
    previous.onclick=()=>{const d=utc(year,month-1,1);year=d.getUTCFullYear();month=d.getUTCMonth();selected=iso(d);update()};
    next.onclick=()=>{const d=utc(year,month+1,1);year=d.getUTCFullYear();month=d.getUTCMonth();selected=iso(d);update()};
    today.onclick=()=>{const c=getCurrentCivilDate();year=c[0];month=c[1];selected=iso(utc(...c));update()};
    recorded.onclick=()=>{const d=dateObj(range.end);year=d.getUTCFullYear();month=d.getUTCMonth();selected=range.end;update()};
    let data;
    bootData().then(j=>{
      if(!target.isConnected||target.querySelector(".calendar-grid")!==grid)return;
      data=j;
      for(const s of j.sources){
        const b=make("button",SOURCE_LABELS[s.id],"calendar-source-tab");
        b.type="button";b.dataset.source=s.id;b.onclick=()=>setSource(s.id);
        sourceBar.append(b);
      }
      const issue=make("p","The two files disagree on some dates—for example, the Feast of Trumpets in 2025. Switching sources shows each record on its own terms.","calendar-conflict");
      notice.after(issue);
      setSource(source);
    }).catch(e=>{notice.textContent="Could not load calendar: "+e.message});
  }
  window.OustoryCalendar={render,calendarCells,normalize,lunarFeasts,dailyIndex};
})();
