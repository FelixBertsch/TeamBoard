/* Phone views (lay-phone): same data, actions and forms as desktop. Instead of the timeline a team grid (one week upright,
   two weeks sideways) whose topic bars move with hold and drag (drag.js); no resizing and no drag-to-create on the phone. */
function awayChips(){
  const list=S.absences.filter(a=>a.end>=TODAY&&dn(a.start)<=TDN+7&&isActive(a.personId)).sort((a,b)=>a.start.localeCompare(b.start));
  if(!list.length)return'';
  const wd=s=>`${WD[wdOf(dn(s))]} ${dm(s)}`;
  return`<div class="m-row" role="group" aria-label="Abwesend">${list.map(a=>{const p=personOf(a.personId),now=a.start<=TODAY,n=p.id==='me'?'Ich':firstName(p);
    return`<button class="away${now?'':' soon'}" data-action="edit-absence" data-id="${a.id}">${avatar(p,'sm')}${esc(n)}, ${esc(absLabel(a.kind))} ${a.half?(now?'heute':wd(a.start))+' '+HALF[a.half]:now?'bis '+wd(a.end):'ab '+wd(a.start)}</button>`}).join('')}</div>`;
}
/* "Heute": todos due today or overdue, the rest of the list and the other panels fold. Each card shows a summary in its head,
   its open state is a device preference (ui.fold, saved by saveUi()). "Zu klären" opens by itself when a red issue appears
   that was not there when it was folded (ui.redSeen), because red issues must not be hidden. */
function foldCard(key,title,sum,body,extra='',tour=''){const o=!!ui.fold[key];
  return`<section class="card fold${o?' open':''}"${tour?` data-tour="${tour}"`:''}><div class="fold-h"><button type="button" class="fold-t" data-action="fold" data-v="${key}" aria-expanded="${o}">
    <h2 class="h4">${esc(title)}</h2><span class="fold-s">${sum}</span>${ic('chevR',20,2.5)}</button>${o?extra:''}</div>${o?`<div class="fold-b">${body}</div>`:''}</section>`}
function todoListPhone(f){const{open,g}=todoGroups(f);
  if(!open.length)return`<p class="empty">Keine offenen Aufgaben in dieser Ansicht. Mit dem Plus unten erfasst du die nächste.</p>`;
  const grp=(k,title,cls='')=>g[k].length?`<div class="grp ${cls}">${title}<span class="n">${g[k].length}</span></div>${g[k].map(t=>todoRow(t,true)).join('')}`:'';
  const fg=(k,title)=>{if(!g[k].length)return'';const o=!!ui.grp[k];
    return`<button type="button" class="grp-f" data-action="fold-grp" data-v="${k}" aria-expanded="${o}"><span>${title}</span><span class="n">${g[k].length}</span>${ic('chevR',18,2.5)}</button>${o?g[k].map(t=>todoRow(t,true)).join(''):''}`};
  const rest=fg('week','Rest der Woche')+fg('next','Nächste Woche')+fg('later','Später und ohne Frist');
  return grp('late','Überfällig','late')+grp('today','Heute')+(g.late.length+g.today.length?'':'<p class="empty">Heute ist nichts fällig.</p>')+(rest?`<div class="grp-fs">${rest}</div>`:'')}
const redKeys=()=>issues().filter(i=>i.kind==='late').map(i=>i.act+':'+i.id+':'+i.text);
function viewToday(banner=''){
  const{g}=todoGroups(ui.filter),open=issues(),red=redKeys();
  if(red.some(k=>!(ui.redSeen||[]).includes(k)))ui.fold.issues=true;
  const plural=(n,one,many)=>n===1?one:`${n} ${many}`;
  const todoSum=[g.late.length?`<b class="s-late">${g.late.length} überfällig</b>`:'',g.today.length?`${g.today.length} heute`:''].filter(Boolean).join(' · ')||'heute nichts fällig';
  const issSum=red.length?`<b class="s-late">${red.length} dringend</b> · ${open.length} offen`:open.length?`${open.length} offen`:'alles geklärt';
  const now=absenceBlocks().filter(b=>b.start<=TODAY).length,abs=absenceBlocks().length;
  const absSum=now?`${plural(now,'eine Person','Personen')} abwesend`:abs?plural(abs,'eine geplant','geplant'):'niemand';
  const talks=talkCounts().reduce((a,x)=>a+x.n,0);
  return`${banner}<div class="m-head"><p class="overline">${esc(todayOverline())}</p><h1>Heute</h1><p class="lead">${esc(overviewHeadline())}</p></div>
  ${awayChips()}
  <div class="m-stack">${firstStepsPanel()}
  ${foldCard('todos','Aufgaben',todoSum,`<div class="m-row fold-tags">${filterTags()}</div>${todoListPhone(ui.filter)}`,'','todos')}
  ${showIssues()?foldCard('issues','Zu klären',issSum,issuesBody(),issuesToggle(),'issues'):''}
  ${foldCard('abs','Abwesenheiten',absSum,absenceRows(),'<button class="link-btn" data-action="new-absence">Eintragen</button>')}
  ${foldCard('talk','Fürs nächste Gespräch',talks?plural(talks,'ein Punkt','Punkte'):'nichts gesammelt',talkRows())}
  ${historyLink()}</div>`;
}

/* Team grid: one row per person (me first), one column per workday; weekends are left out, holidays are grey columns.
   Upright it shows one week (ui.toff weeks from now) and a tapped day (ui.tday) is listed below in full. Sideways (lay-land)
   it shows two weeks at a time in a horizontal scroller from TEAM_BACK weeks back to TEAM_AHEAD weeks ahead; render()
   keeps its scroll position (ui.lgX). Bars hold to move (drag.js), a tap opens the topic. Column width comes from CSS (--dw). */
const TEAM_BACK=2,TEAM_AHEAD=12;
/* Column of a day in a grid of workdays starting on Monday `mon`: a weekend start moves to the next Monday, a weekend end to Friday. */
const colStart=(d,mon)=>{const w=Math.floor((d-mon)/7),r=d-mon-7*w;return r>4?w*5+5:w*5+r};
const colEnd=(d,mon)=>{const w=Math.floor((d-mon)/7),r=d-mon-7*w;return w*5+Math.min(r,4)};
const colDay=(i,mon)=>mon+7*Math.floor(i/5)+i%5;
const gx=i=>`calc(var(--dw) * ${i})`;
function gridBar(t,mon,n,top,cls,inner,label){
  const a=colStart(dn(t.start),mon),b=colEnd(dn(t.end),mon);if(b<0||a>n-1||a>b)return'';
  const s=Math.max(a,0),e=Math.min(b,n-1);
  return`<button type="button" class="wg-b ${cls}${a<0?' cut-l':''}${b>n-1?' cut-r':''}" data-action="edit-topic" data-id="${t.id}"${cls.startsWith('inv')?'':' data-move="1"'}
    style="left:calc(${gx(s)} + 2px);width:calc(${gx(e-s+1)} - 4px);top:${top}px" aria-label="${esc(label)}">${inner}</button>`}
function gridRows(mon,n,sel,people){
  const last=colDay(n-1,mon),tones=toneMap();
  const cols=Array.from({length:n},(_,i)=>{const d=colDay(i,mon);
    return`<span class="wg-c${d===TDN?' td':''}${d===sel?' sel':''}${holidayOn(d)?' hol':''}${i%5===0?' mo':''}" style="left:${gx(i)};width:${gx(1)}"></span>`}).join('');
  return people.map(p=>{
    const own=placeLanes(S.topics.filter(t=>t.personId===p.id&&dn(t.end)>=mon&&dn(t.start)<=last&&colStart(dn(t.start),mon)<=colEnd(dn(t.end),mon)).sort(byStart));
    const inv=placeLanes(involvedTopics(p.id,mon,last).filter(t=>colStart(dn(t.start),mon)<=colEnd(dn(t.end),mon)));
    const abs=S.absences.filter(a=>a.personId===p.id&&dn(a.end)>=mon&&dn(a.start)<=last).map(a=>{const s=Math.max(colStart(dn(a.start),mon),0),e=Math.min(colEnd(dn(a.end),mon),n-1);
      return s>e?'':`<span class="wg-a${a.half?' half':''}" style="left:${gx(s+(a.half==='pm'?0.5:0))};width:${gx(a.half?0.5:e-s+1)}"${a.half?` title="${esc(absLabel(a.kind))} ${HALF[a.half]}"`:''}><span>${esc(absLabel(a.kind))}</span></span>`}).join('');
    let bars=own.placed.map(({t,l})=>gridBar(t,mon,n,6+l*30,`${t.status} tone-${tones[t.id]}`,`<span>${esc(t.title)}</span>`,`${t.title}, ${dm(t.start)} bis ${dm(t.end)}. Gedrückt halten zum Verschieben.`)).join('');
    bars+=inv.placed.map(({t,l})=>gridBar(t,mon,n,6+own.n*30+l*26,`inv${t.status==='erledigt'?' inv-done':''}`,`${ic('users',12)}<span>${esc(ownerName(t))}: ${esc(t.title)}</span>`,`Beteiligt an ${t.title}, verantwortlich: ${ownerName(t)}`)).join('');
    const h=Math.max(44,12+own.n*30+inv.n*26+(abs?16:0)),name=p.id==='me'?'Meine Planung':p.name;
    return`<div class="wg-r"><a class="wg-who" href="${hrefOf(p.id)}" aria-label="${esc(name)}" title="${esc(name)}">${avatar(p,'sm')}</a><div class="wg-t" style="height:${h}px">${cols}${abs}${bars}${own.n+inv.n?'':'<span class="wg-free">kein Thema</span>'}</div></div>`}).join('');
}
function viewTeam(banner=''){
  const people=[ME,...team()];
  if(isLand())return teamLand(banner,people);
  const mon=mondayOf(TDN)+7*ui.toff,fri=mon+4;let sel=ui.tday;
  if(sel==null||sel<mon||sel>fri)sel=TDN>=mon&&TDN<=fri?TDN:mon;
  const head=Array.from({length:5},(_,i)=>{const d=mon+i,hol=holidayOn(d);
    return`<button type="button" class="wg-d${d===sel?' sel':''}${d===TDN?' td':''}" data-action="team-day" data-v="${d}" aria-pressed="${d===sel}" aria-label="${WDL[wdOf(d)]}, ${dmN(d)}${hol?', '+esc(hol):''}"><small>${WD[wdOf(d)]}</small><b>${new Date(d*DAYMS).getUTCDate()}</b></button>`}).join('');
  return`${banner}<div class="m-head"><p class="overline">Team</p><h1>Wer macht was</h1></div>
  <div class="wk-nav"><button type="button" class="icon-btn" data-action="team-week" data-v="-1" aria-label="Vorige Woche">${ic('chevL',22,2.5)}</button>
    <div class="wk-l"><b>KW ${isoWeek(mon)}</b><span>${esc(fmtRange(mon,fri))}</span></div>
    ${ui.toff?`<button type="button" class="tag" data-action="team-week" data-v="0">Heute</button>`:''}<button type="button" class="icon-btn" data-action="team-week" data-v="1" aria-label="Nächste Woche">${ic('chevR',22,2.5)}</button></div>
  <section class="card wg" data-tour="team-grid" data-mon="${mon}" data-n="5"><div class="wg-in"><div class="wg-r wg-h"><span class="wg-who"></span><div class="wg-hd">${head}</div></div>${gridRows(mon,5,sel,people)}</div></section>
  <p class="wg-hint">Tipp auf einen Tag zeigt ihn unten. Ein Thema gedrückt halten und ziehen verschiebt es. Quer gedreht siehst du zwei Wochen.</p>
  ${dayList(sel,people)}
  ${team().length?'':'<p class="empty">Noch kein Teammitglied angelegt. Leg die erste Person hier an.</p>'}
  <button class="btn secondary" data-action="new-person" style="justify-self:start;margin-top:16px">${ic('userPlus',18)}Person hinzufügen</button>`;
}
/* The selected day in words: per person project, topics with their end, involvement, absence, todos due. Absent people last. */
function dayList(d,people){
  const day=ds(d),open=S.todos.filter(t=>!t.done),tones=toneMap();
  const mine=(t,p)=>t.personId===p.id&&(p.id==='me'||t.kind==='team');
  const row=p=>{const a=absentOn(p.id,day),proj=p.id==='me'?'Meine Planung':projectLabel(p.id,currentAssignments(p.id,day))||'Ohne Projekt';
    const own=S.topics.filter(t=>t.personId===p.id&&t.start<=day&&t.end>=day).sort(byStart),inv=S.topics.filter(t=>withOf(t).includes(p.id)&&t.start<=day&&t.end>=day).sort(byStart);
    const due=open.filter(t=>mine(t,p)&&t.due===day).length,late=d===TDN?open.filter(t=>mine(t,p)&&t.due&&t.due<TODAY).length:0;
    const chip=t=>`<button type="button" class="dt ${t.status} tone-${tones[t.id]}" data-action="edit-topic" data-id="${t.id}"><span class="dt-t">${esc(t.title)}</span><small>${t.status==='geplant'?'geplant, ':t.status==='erledigt'?'erledigt, ':''}bis ${esc(WD[wdOf(dn(t.end))]+' '+dm(t.end))}</small></button>`;
    const ichip=t=>`<button type="button" class="dt inv" data-action="edit-topic" data-id="${t.id}">${ic('users',14)}<span class="dt-t">mit ${esc(ownerName(t))}: ${esc(t.title)}</span></button>`;
    const meta=(a?`<span class="badge away">${esc(absLabel(a.kind))} ${a.half?HALF[a.half]:'bis '+esc(WD[wdOf(dn(a.end))]+' '+dm(a.end))}</span>`:'')
      +(due?`<span class="dd-due">${due===1?'eine Aufgabe fällig':due+' Aufgaben fällig'}</span>`:'')+(late?`<span class="badge late">${ic('alert',12,2.5)}${late} überfällig</span>`:'');
    return{a,html:`<div class="dd${a&&!a.half?' off':''}"><a class="dd-who" href="${hrefOf(p.id)}">${avatar(p,'sm')}<span class="dd-nm"><b>${esc(p.id==='me'?'Ich':p.name)}</b><small>${esc(proj)}</small></span>${ic('chevR',18)}</a>
      ${meta?`<div class="dd-meta">${meta}</div>`:''}<div class="dd-items">${own.map(chip).join('')}${inv.map(ichip).join('')}${own.length+inv.length?'':'<span class="dd-free">Kein Thema geplant</span>'}</div></div>`}};
  const rows=people.map(row),hol=holidayOn(d);
  return`<section class="card card-pad dday" aria-live="polite"><div class="panel-head"><h2 class="h4">${d===TDN?'Heute, ':''}${esc(WDL[wdOf(d)])}, ${esc(dmN(d))}</h2></div>
    ${hol?`<p class="dd-hol">${esc(holLabel(d))}</p>`:''}${rows.filter(r=>!r.a).map(r=>r.html).join('')}${rows.filter(r=>r.a).map(r=>r.html).join('')}</section>`;
}
function teamLand(banner,people){
  const mon=mondayOf(TDN)-7*TEAM_BACK,W=TEAM_BACK+1+TEAM_AHEAD,n=W*5;
  const weeks=Array.from({length:W},(_,w)=>{const m=mon+7*w;
    return`<span class="lg-wk${m===mondayOf(TDN)?' now':''}" style="left:${gx(w*5)};width:${gx(5)}"><span><b>KW ${isoWeek(m)}</b> ${esc(fmtRange(m,m+4))}</span></span>`}).join('');
  const head=Array.from({length:n},(_,i)=>{const d=colDay(i,mon);
    return`<span class="lg-d${d===TDN?' td':''}${i%5===0?' mo':''}${holidayOn(d)?' hol':''}" style="left:${gx(i)};width:${gx(1)}"><small>${WD[wdOf(d)]}</small><b>${new Date(d*DAYMS).getUTCDate()}</b></span>`}).join('');
  return`${banner}<section class="card wg wg-land" data-mon="${mon}" data-n="${n}" aria-label="Team, ${W} Wochen"><div class="wg-in" style="--cols:${n}"><div class="wg-r wg-h"><span class="wg-who"></span><div class="wg-t lg-ht">${weeks}${head}</div></div>${gridRows(mon,n,null,people)}</div></section>
  <p class="wg-hint">Wischen blättert durch die Wochen, gedrückt halten verschiebt ein Thema. Hochkant gedreht siehst du die Tagesliste und die Leiste.</p>`;
}
/* Scroll position of the sideways grid: kept across render(), starts at the current week. */
function restoreGridScroll(){const g=$('#main .wg-land');if(!g)return;
  if(ui.lgX==null){const now=g.querySelector('.lg-wk.now');ui.lgX=now?now.offsetLeft:0}
  g.scrollLeft=ui.lgX}
document.addEventListener('scroll',e=>{if(e.target.classList?.contains('wg-land'))ui.lgX=e.target.scrollLeft},true);
function viewPersonPhone(id,banner=''){
  const x=personParts(id),p=x.p,isMe=x.isMe,arch=!!p.archived;
  return`${banner}${isMe?'':`<div class="m-top"><a class="m-back" href="#team">${ic('chevL',22,2.5)}Team</a></div>`}
  <div class="m-head"><div class="head-id">${avatar(p,'lg')}<div><p class="overline">${esc(isMe?['Ich',projectLabel('me')].filter(Boolean).join(' · '):arch?`Ausgeschieden am ${dmy(p.archived)}`:(teamLine(p)||'Team'))}</p><h1>${esc(isMe?'Meine Planung':p.name)}</h1></div></div>
    <p class="lead" style="margin-top:12px">${esc(arch?`${firstName(p)} ist nicht mehr im Team. Themen, Aufgaben und Projekte bleiben hier und im Verlauf.`:personHeadline(p))}</p></div>
  <div class="m-actions">${arch?`<button class="btn secondary sm" data-action="restore-person" data-id="${id}">Zurück ins Team</button>`:`${isMe?'':`<button class="btn ghost sm" data-action="edit-person" data-id="${id}">Bearbeiten</button>`}<button class="btn secondary sm" data-action="new-absence" data-person="${id}">Abwesenheit</button><button class="btn secondary sm" data-action="new-topic" data-person="${id}">Thema</button>`}</div>
  <div class="m-stack">${issuesPanel(id)}<section class="card card-pad">${x.tasks}</section>${x.involved}${x.talkPanel}${x.asgPanel}${x.topicsPanel}${x.absPanel}${x.review}</div>`;
}
