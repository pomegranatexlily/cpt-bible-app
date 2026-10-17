"use strict";
/* Covenant calendar archives: no computed future feast dates or reminder claims. */
(() => {
 let cached=null;
 const fmt=s=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}).format(new Date(s+'T12:00:00Z'));
 const node=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(cls)e.className=cls;return e};
 const cat=s=>s.startsWith('Prep /')?'preparation':s==='Weekly Sabbath'?'sabbath':s==='New Moon'?'new-moon':'feast';
 function adjacent(a,b){const d=new Date(a+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)===b}
 function groupEvents(list){
  const byName=new Map(),groups=[];
  for(const e of list){if(!byName.has(e.subject))byName.set(e.subject,[]);byName.get(e.subject).push(e)}
  for(const [name,events] of byName){let g=null;for(const e of events.sort((a,b)=>a.start.localeCompare(b.start))){
   if(g&&adjacent(g.end,e.start)){g.end=e.start;g.count++}
   else {g={subject:name,start:e.start,end:e.end,count:1,description:e.description};groups.push(g)}
  }}
  return groups.sort((a,b)=>a.start.localeCompare(b.start)||a.subject.localeCompare(b.subject));
 }
 function render(target,back){
  target.replaceChildren();
  target.append(node('p','Oustory · historical calendar','feature-eyebrow'),node('h1','Covenant calendar','feature-title'),node('p','Feasts, new moons, Sabbaths, and preparation days in your uploaded records.','feature-description'));
  const top=node('div',undefined,'calendar-actions'),backButton=node('button','← Home','feature-action');backButton.onclick=()=>back?.();top.append(backButton);target.append(top);
  const warning=node('section',undefined,'feature-card calendar-warning');warning.append(node('h2','Archived dates, not a current calendar'),node('p','These two sources cover 2025 through early 2026. The remaining dates in 2026 and future feast dates have not been supplied; no new dates, sunset times, or reminders are calculated.'));target.append(warning);
  const panel=node('section',undefined,'feature-card');panel.append(node('h2','Select your source'));
  const selector=node('div',undefined,'calendar-actions');
  const xa=node('button','Xalendaria · 152 events','feature-action primary'),lu=node('button','2025 Lunar · 11 months','feature-action');selector.append(xa,lu);panel.append(selector);
  panel.append(node('p','Source difference: Trumpets is August 22, 2025 in Xalendaria, but September 22, 2025 in the lunar file. Both remain separate until you determine which rules to use.','feature-status calendar-conflict'));target.append(panel);
  const results=node('div',undefined,'calendar-results');target.append(results);
  let source='xalendaria',filter='feast';
  function refresh(){
   xa.classList.toggle('primary',source==='xalendaria');lu.classList.toggle('primary',source==='lunar2025');results.replaceChildren();
   if(!cached){results.append(node('p','Loading calendar…','feature-status'));return}
   const data=cached.sources.find(s=>s.id===source);
   results.append(node('h2',data.file,'calendar-section-title'),node('p',data.notes,'feature-status'));
   if(source==='xalendaria'){
    const choice=node('label','Show: ','calendar-filter'),select=node('select');
    for(const [id,label] of [['feast','Feast days'],['new-moon','New moons'],['sabbath','Weekly Sabbaths'],['preparation','Preparation days'],['all','All entries']]){let opt=node('option',label);opt.value=id;select.append(opt)}
    select.value=filter;select.onchange=()=>{filter=select.value;refresh()};choice.append(select);results.append(choice);
    const grouped=groupEvents(data.entries.filter(e=>filter==='all'||cat(e.subject)===filter));
    results.append(node('p',grouped.length+' dated observances or intervals','feature-status'));
    const list=node('div',undefined,'calendar-entry-list');for(const e of grouped){
     const card=node('article',undefined,'feature-card calendar-entry');card.append(node('h3',e.subject),node('p',fmt(e.start)+(e.end===e.start?'':' – '+fmt(e.end)),'calendar-date'));
     if(e.count>1)card.append(node('p',e.count+' consecutive source entries','feature-status'));
     if(e.description)card.append(node('p',e.description,'feature-status'));list.append(card);
    }results.append(list);
   }else{
    for(const m of data.entries){const card=node('article',undefined,'feature-card calendar-entry');card.append(node('h3',m.lunar_month),node('p','New moon: '+fmt(m.new_moon),'calendar-date'),node('p','Sabbaths: '+m.sabbaths.map(fmt).join(', '),'feature-status'));
      if(m.feasts_raw)card.append(node('p','Feasts/Observances: '+m.feasts_raw,'calendar-feasts'));results.append(card);
    }
   }
   results.append(node('p','Dates reproduced from the selected user-supplied record. No astronomical validation, calendar rule selection, or push reminder service has been performed.','feature-status'));
  }
  xa.onclick=()=>{source='xalendaria';refresh()};lu.onclick=()=>{source='lunar2025';refresh()};refresh();
  const load=cached?Promise.resolve(cached):fetch('calendar/archive.json').then(r=>{if(!r.ok)throw Error('Calendar not found');return r.json()}).then(j=>{if(j.schema_version!==1||j.sources?.[0]?.entries?.length!==152||j.sources?.[1]?.entries?.length!==11)throw Error('Incorrect calendar archive');cached=j;return j});
  load.then(()=>{if(target.isConnected&&target.querySelector('.calendar-results')===results)refresh()}).catch(e=>results.replaceChildren(node('p','Calendar unavailable: '+e.message,'feature-status')));
 }
 window.OustoryCalendar={render,groupEvents};
})();
