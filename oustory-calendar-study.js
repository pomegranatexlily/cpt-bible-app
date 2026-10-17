"use strict";
/* Oustory Release 3 — calendar-linked Scripture study.
 * Religious dates originate ONLY from the Shabbat Calendar JSON feed.
 * Reading references are suggested editorial study anchors, NOT an approved
 * lectionary, verified feast ruling, automatic Shavuot calculation, or AI.
 * Reading progress stays local to this browser and separate per track/date.
 */
(() => {
  const STORAGE="oustory.calendar.study.v1";
  let request=null, cached=null;
  const el=(tag,text,cls)=>{
    const n=document.createElement(tag);
    if(text!==undefined)n.textContent=text;
    if(cls)n.className=cls;
    return n;
  };
  function load(){
    if(cached)return Promise.resolve(cached);
    if(!request)request=fetch("data/covenant-study.json",{cache:"no-cache"})
      .then(r=>{if(!r.ok)throw Error("Study references unavailable");return r.json()})
      .then(data=>{
        if(data.schema_version!==1||
          data.rules?.lunar_shabbat_days?.join(",")!=="8,15,22,29"||
          data.feasts?.length!==10||data.shabbat?.length!==4)
          throw Error("Study reference edition mismatch");
        cached=data;return data;
      }).catch(e=>{request=null;throw e});
    return request;
  }
  const eventsFor=(track,date)=>[...(track.current_events||[]),...(track.events||[])]
    .filter(e=>e.date===date);
  function groupFor(data,event){
    if(!event||!data)return null;
    if(event.kind==="sabbath"){
      const g=data.shabbat.find(x=>x.day===event.lunar_day);
      return g?{topic:g.topic,readings:g.readings,status:"suggested_study",event}:null;
    }
    if(event.kind==="new_moon")return {...data.new_moon,status:"suggested_study",event};
    if(event.kind==="preparation")return {...data.preparation,status:"suggested_study",event};
    if(event.kind==="feast"&&event.rule_status==="unapproved_draft"){
      const g=data.feasts.find(x=>event.title===x.event||
        event.title.startsWith(x.event+" (Day "));
      return g?{topic:g.topic,readings:g.readings,status:"unapproved_feast_study",event}:null;
    }
    return null;
  }
  function nextSabbath(track,today){
    return [...(track?.current_events||[]),...(track?.events||[])]
      .filter(e=>e.kind==="sabbath"&&e.date>=today)
      .sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
  }
  function format(date){
    return new Date(date+"T12:00:00Z").toLocaleDateString("en-US",{
      timeZone:"UTC",weekday:"short",month:"long",day:"numeric",year:"numeric"
    });
  }
  function progress(){
    try{const j=JSON.parse(localStorage.getItem(STORAGE)||"{}");
      return j&&typeof j==="object"&&!Array.isArray(j)?j:{};
    }catch{return {}}
  }
  function saveProgress(data){
    try{localStorage.setItem(STORAGE,JSON.stringify(data));return true}
    catch{return false}
  }
  function passageKey(trackId,date,ref){
    return trackId+"|"+date+"|"+ref.book+"|"+ref.chapter+":"+ref.verse;
  }
  function readingItems(group,trackId,date,go){
    const wrap=el("section",undefined,"covenant-study-group");
    wrap.append(el("h4",group.topic));
    wrap.append(el("p",group.status==="unapproved_feast_study"?
      "DRAFT feast date: readings offered for research only, not a confirmed observance.":
      "Suggested Scripture readings, not a prescribed Sabbath liturgy.","covenant-study-note"));
    const list=el("div",undefined,"covenant-study-readings");
    for(const ref of group.readings){
      const entry=el("div",undefined,"covenant-study-reading");
      const caption=el("div",undefined,"covenant-study-reading-text");
      const title=ref.book+" "+ref.chapter+":"+ref.verse;
      caption.append(el("strong",title),el("span",ref.label));
      const buttons=el("div",undefined,"covenant-study-actions");
      const read=el("button","Read","covenant-study-read");
      read.type="button";read.setAttribute("aria-label","Read "+title);
      read.onclick=()=>go?.(ref.book,ref.chapter,ref.verse);
      const marker=el("button",undefined,"covenant-study-mark");
      marker.type="button";
      const key=passageKey(trackId,date,ref);
      const sync=()=>{
        const checked=!!progress()[key];
        marker.textContent=checked?"Read ✓":"Mark read";
        marker.setAttribute("aria-pressed",String(checked));
        marker.setAttribute("aria-label",(checked?"Unmark ":"Mark ")+title+" read");
      };
      sync();
      marker.onclick=()=>{
        const state=progress();
        if(state[key])delete state[key];else state[key]=true;
        if(saveProgress(state))sync();
        else marker.textContent="Storage unavailable";
      };
      buttons.append(read,marker);
      entry.append(caption,buttons);
      list.append(entry);
    }
    wrap.append(list);
    return wrap;
  }
  async function renderForDay(target,trackId,date,events,go){
    target.replaceChildren(el("p","Loading study readings…","feature-status"));
    try{
      const data=await load();
      if(!target.isConnected)return;
      const groups=(events||[]).map(e=>groupFor(data,e)).filter(Boolean);
      target.replaceChildren();
      if(!groups.length){
        target.append(el("p","No scheduled reading set for this lunar day. Choose a Shabbat, New Moon, or draft feast to see suggested passages.","feature-status"));
        return;
      }
      target.append(el("h3","Scripture study for this day","covenant-study-heading"));
      for(const group of groups)target.append(readingItems(group,trackId,date,go));
    }catch(e){
      if(target.isConnected)target.replaceChildren(el("p","Study readings unavailable: "+e.message,"feature-status"));
    }
  }
  async function renderNext(target,go,openCalendar,trackId,calendar){
    target.replaceChildren(el("p","Finding the next lunar Shabbat…","feature-status"));
    try{
      const [data,feed]=await Promise.all([
        load(),calendar||window.OustoryCalendar?.loadLive()
      ]);
      if(!target.isConnected)return;
      if(!feed?.tracks?.[trackId])throw Error("Calendar feed unavailable");
      const today=new Date(),day=[today.getFullYear(),
        String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
      const next=nextSabbath(feed.tracks[trackId],day);
      target.replaceChildren();
      if(!next){
        target.append(el("p","No upcoming Shabbat within the published planning horizon.","feature-status"));return;
      }
      target.append(el("p",format(next.date)+" · Lunar Day "+next.lunar_day+
        " · "+(next.status==="supplied"?"Founder-supplied month start":"Projected month"),"feature-status"));
      const group=groupFor(data,next);
      if(group)target.append(readingItems(group,trackId,next.date,go));
      if(openCalendar){
        const btn=el("button","See this day in calendar","feature-action");
        btn.type="button";btn.onclick=()=>openCalendar(next.date,trackId);
        target.append(btn);
      }
    }catch(e){
      if(target.isConnected)target.replaceChildren(el("p","Calendar-linked study unavailable: "+e.message,"feature-status"));
    }
  }
  async function renderOpenQuestions(target,go){
    target.replaceChildren(el("p","Loading calendar research…","feature-status"));
    try{
      const data=await load();if(!target.isConnected)return;
      target.replaceChildren();
      target.append(el("p","No date is assigned to Shavuot until the counting rule is approved. Agricultural and crescent observations also remain unverified.","feature-status"));
      for(const name of ["shavuot","intercalation"]){
        const entry=data.open_questions[name];
        const container=el("section",undefined,"covenant-study-question");
        container.append(el("h4",entry.topic),el("p",entry.status.replaceAll("_"," "),"feature-status"));
        const links=el("div",undefined,"covenant-study-actions");
        for(const ref of entry.readings){
          const btn=el("button",ref.book+" "+ref.chapter+":"+ref.verse,"feature-action");
          btn.type="button";btn.onclick=()=>go(ref.book,ref.chapter,ref.verse);
          links.append(btn);
        }
        container.append(links);target.append(container);
      }
    }catch(e){if(target.isConnected)target.replaceChildren(el("p",e.message,"feature-status"))}
  }
  window.OustoryCalendarStudy={load,groupFor,eventsFor,nextSabbath,renderForDay,renderNext,renderOpenQuestions,passageKey};
})();
