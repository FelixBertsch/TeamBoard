/* Desktop views: overview, person page, "Meine Planung". todoRow() is shared with the phone views. */
const quickBlock=()=>`<div class="quick">${ic('plus',18)}<input id="quick" type="text" autocomplete="off" spellcheck="false" aria-label="Aufgabe schnell erfassen" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugList"
  placeholder="Aufgabe erfassen, z. B. „@Lena Review Payment-API bis Fr“"><span class="kbd" aria-hidden="true">N</span>
  <div class="qprev" id="qprev">${previewHTML('')}</div></div>`;


/* ----- Todo row (lists) ----- */
function todoRow(t,showPerson){
  const p=personOf(t.personId),late=!t.done&&t.due&&t.due<TODAY,today=!t.done&&t.due===TODAY;
  const away=!t.done&&t.kind==='team'&&t.due&&t.personId!=='me'&&absentOn(t.personId,t.due);
  return`<div class="todo${t.done?' done':''}"><button class="check" data-action="toggle" data-id="${t.id}" aria-pressed="${t.done}" aria-label="${t.done?'Wieder öffnen':'Als erledigt markieren'}">${ic('check',14,3)}</button>
    <span class="todo-body"><button class="todo-title" data-action="edit-todo" data-id="${t.id}">${esc(t.title)}</button><span class="todo-meta">${
    away?`<span class="badge away" title="An diesem Tag ${esc(absPhrase(away.kind))}">${esc(absLabel(away.kind))}</span>`:''}${
    !t.done&&t.repeat?`<span class="badge rep" title="Wiederholt sich, die nächste entsteht beim Abhaken">${ic('repeat',12,2.5)}${esc(repeatLabel(t.repeat))}</span>`:''}${
    withOf(t).length?`<span class="with" title="Beteiligt">${ic('users',14)}<span>${esc(withNames(t))}</span></span>`:''}${
    t.kind==='mine'?'<span class="badge mine">Meins</span>':t.kind==='waiting'?'<span class="badge wait">Wartet</span>':''}${
    showPerson?`<span class="who">${avatar(p,'xs')}<span>${esc(p.id==='me'?'Ich':firstName(p))}</span></span>`:''}</span></span>
    ${t.done?`<span class="due done-at" title="${t.doneAt?'Erledigt am '+esc(longDay(t.doneAt)):'Erledigt, ohne Datum'}">${t.doneAt?ic('check',12,3)+esc(dueLabel(t.doneAt)):''}</span>`
      :`<span class="due${late?' late':today?' today':''}">${t.due?esc(dueLabel(t.due)):''}</span>`}</div>`;
}

/* ----- Overview ----- */
function overviewHeadline(){
  const open=S.todos.filter(t=>!t.done&&isActive(t.personId)),late=open.filter(t=>t.due&&t.due<TODAY).length,today=open.filter(t=>t.due===TODAY).length;
  const parts=[];if(late)parts.push(late===1?'Eine Aufgabe ist überfällig':`${late} Aufgaben sind überfällig`);
  if(today)parts.push(today===1?'eine ist heute fällig':`${today} heute fällig`);
  let s=parts.length?cap(parts.join(', '))+'.':'Nichts überfällig, nichts heute fällig.';
  const now=team().map(p=>({p,a:absentOn(p.id,TODAY)})).find(x=>x.a);
  if(now)s+=` ${firstName(now.p)} ist bis ${longDay(now.a.end)} ${absPhrase(now.a.kind)}.`;
  else{const up=S.absences.filter(a=>a.personId!=='me'&&isActive(a.personId)&&a.start>TODAY&&dn(a.start)<=TDN+7).sort((a,b)=>a.start.localeCompare(b.start))[0];
    if(up)s+=` ${firstName(personOf(up.personId))} ist ab ${longDay(up.start)} ${absPhrase(up.kind)}.`}
  return s;
}
const todayOverline=()=>{const d=new Date(TDN*DAYMS),hol=holidayOn(TDN);return`${WDL[d.getUTCDay()]}, ${d.getUTCDate()}. ${MON[d.getUTCMonth()]}, KW ${isoWeek(TDN)}${hol?`, ${hol}`:''}`};
/* Open todos for the current filter, grouped by due date. Used by the desktop overview and the phone's "Heute" view. */
function todoGroups(f){
  const open=S.todos.filter(t=>!t.done&&isActive(t.personId)&&(f==='alle'||(f==='team'&&t.kind==='team'&&t.personId!=='me')||(f==='meine'&&(t.kind==='mine'||t.personId==='me'))||(f==='wartet'&&t.kind==='waiting'))).sort(byDue);
  const we=ds(mondayOf(TDN)+6),ne=ds(mondayOf(TDN)+13),g={late:[],today:[],week:[],next:[],later:[]};
  for(const t of open){if(!t.due)g.later.push(t);else if(t.due<TODAY)g.late.push(t);else if(t.due===TODAY)g.today.push(t);else if(t.due<=we)g.week.push(t);else if(t.due<=ne)g.next.push(t);else g.later.push(t)}
  return{open,g};
}
function todoListHTML(f){
  const{open,g}=todoGroups(f);
  const grp=(k,title,cls='')=>g[k].length?`<div class="grp ${cls}">${title}<span class="n">${g[k].length}</span></div>${g[k].map(t=>todoRow(t,true)).join('')}`:'';
  let list=grp('late','Überfällig','late')+grp('today','Heute')+grp('week','Diese Woche')+grp('next','Nächste Woche');
  if(g.later.length)list+=ui.more?grp('later','Später und ohne Frist'):`<div class="grp"><button class="link-btn" data-action="more">${g.later.length} weitere später oder ohne Frist anzeigen</button></div>`;
  if(!open.length)list=`<p class="empty">Keine offenen Aufgaben in dieser Ansicht. ${isPhone()?'Mit dem Plus unten':'Mit N'} erfasst du die nächste.</p>`;
  return list;
}
function filterTags(){const f=ui.filter,b=(v,l)=>`<button class="tag" data-action="filter" data-v="${v}" aria-pressed="${f===v}">${l}</button>`;
  return`<div class="tags" role="group" aria-label="Filter">${b('alle','Alle')}${b('team','Team')}${b('meine','Meine')}${b('wartet','Wartet auf')}</div>`}
/* Absences of one person and kind that touch, overlap or are apart only by weekends and holidays form one block. People often
   request leave in pieces (14.12. to 15.12., then 16.12. to 18.12.); the data keeps every entry, the overview shows 14.12. to 18.12.
   Input sorted by start; blocks come out sorted by start: {personId, kind, start, end, ids}. */
function absBlocks(list){const out=[];
  for(const a of list){const b=out.findLast(x=>x.personId===a.personId&&x.kind===a.kind);
    if(b){let d=dn(b.end)+1;while(d<dn(a.start)&&!isWorkday(d))d++;if(d>=dn(a.start)){if(a.end>b.end)b.end=a.end;b.ids.push(a.id);continue}}
    out.push({personId:a.personId,kind:a.kind,start:a.start,end:a.end,ids:[a.id]})}
  return out}
/* "Abwesenheiten" on the overview: the next block of every person (running or upcoming), "Mehr anzeigen" lists all future blocks.
   A click opens the block's first entry. */
function absencePanel(){
  const blocks=absBlocks(S.absences.filter(a=>a.end>=TODAY&&isActive(a.personId)).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)));
  const next=blocks.filter((b,i)=>blocks.findIndex(x=>x.personId===b.personId)===i),more=blocks.length-next.length;
  const row=b=>{const p=personOf(b.personId),now=b.start<=TODAY,n=b.ids.length;
    return`<button class="prow" data-action="edit-absence" data-id="${b.ids[0]}">${avatar(p,'xs')}<span class="pt">${esc(p.id==='me'?'Ich':firstName(p))}, ${esc(absLabel(b.kind))}${n>1?`<span class="pn">, ${n} Einträge</span>`:''}</span><span class="pd">${now?'<span class="dot"></span>bis '+dm(b.end):dm(b.start)+' bis '+dm(b.end)}</span></button>`};
  return`<section class="card card-pad"><div class="panel-head"><h2 class="h4">Abwesenheiten</h2><button class="link-btn" data-action="new-absence">Eintragen</button></div>
    ${blocks.length?(ui.absAll?blocks:next).map(row).join(''):'<p class="empty">Niemand ist abwesend, und es ist keine Abwesenheit geplant.</p>'}
    ${more?`<button type="button" class="link-btn abs-more" data-action="abs-more" aria-expanded="${!!ui.absAll}">${ui.absAll?'Weniger anzeigen':`Mehr anzeigen (${more})`}</button>`:''}</section>`;
}
/* "Projekte heute": who works where, grouped by project; internal assignments marked. */
function projectsPanel(){
  const act=S.assignments.filter(a=>asgActive(a)&&isActive(a.personId)).sort(asgSort),groups=new Map(),tm=team();
  for(const a of act){const k=fold(a.project);if(!groups.has(k))groups.set(k,{name:a.project,list:[]});groups.get(k).list.push(a)}
  const sorted=[...groups.values()].sort((a,b)=>b.list.length-a.list.length||a.name.localeCompare(b.name,'de'));
  const without=tm.filter(p=>!act.some(a=>a.personId===p.id)),billed=tm.filter(p=>act.some(a=>a.personId===p.id&&a.billable)).length;
  const who=a=>{const p=personOf(a.personId);return`<button class="pj-p" data-action="edit-assignment" data-id="${a.id}" title="${esc(p.id==='me'?'Ich':p.name)}, ${esc(a.project)}${a.end?' bis '+dm(a.end):''}">${avatar(p,'xs')}<span>${esc(p.id==='me'?'Ich':firstName(p))}</span>${a.billable?'':'<span class="badge">intern</span>'}</button>`};
  return`<section class="card card-pad" data-tour="projects"><div class="panel-head"><h2 class="h4">Projekte heute</h2><button class="link-btn" data-action="new-assignment">Zuordnen</button></div>
    ${sorted.length?`<p class="pj-kpi">${billed} von ${tm.length} im Team fakturierbar</p>`+sorted.map(g=>`<div class="pj"><div class="pj-name">${esc(g.name)}</div><div class="pj-who">${g.list.map(who).join('')}</div></div>`).join('')
      :'<p class="empty">Noch niemand einem Projekt zugeordnet. „Zuordnen“ trägt ein, wer ab wann für welchen Kunden arbeitet.</p>'}
    ${sorted.length&&without.length?`<p class="pj-none">Ohne Projekt: ${without.map(p=>`<a href="${hrefOf(p.id)}">${esc(firstName(p))}</a>`).join(', ')}</p>`:''}</section>`;
}
const yy=s=>dm(s)+s.slice(2,4); // "1.3.26"
/* Projects of one person: running, planned, finished. */
function assignmentsPanel(id){
  const rank=a=>asgActive(a)?0:a.start>TODAY?1:2;
  const list=S.assignments.filter(a=>a.personId===id).sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?b.start.localeCompare(a.start):a.start.localeCompare(b.start)));
  const st=[['aktiv','Läuft'],['geplant','Geplant'],['erledigt','Beendet']];
  const when=a=>{const r=rank(a);return r===0?(a.end?`bis ${yy(a.end)}`:`seit ${yy(a.start)}`):r===1?`ab ${yy(a.start)}`:`${yy(a.start)} bis ${yy(a.end)}`};
  return`<section class="card card-pad"><div class="panel-head"><h2 class="h4">Projekte</h2><button class="link-btn" data-action="new-assignment" data-person="${id}">Zuordnen</button></div>
    ${list.length?list.map(a=>{const [c,l]=st[rank(a)];return`<button class="prow" data-action="edit-assignment" data-id="${a.id}"><span class="st ${c}">${l}</span><span class="pt">${esc(a.project)}</span><span class="pd">${when(a)}${a.billable?'':' · intern'}</span></button>`}).join('')
      :'<p class="empty">Noch keinem Projekt zugeordnet. „Zuordnen“ trägt Kunde und Zeitraum ein.</p>'}</section>`;
}
function talkCountPanel(){
  const talkCounts=team().map(p=>({p,n:S.talks.filter(t=>t.personId===p.id&&!t.done).length})).filter(x=>x.n);
  return`<section class="card card-pad"><div class="panel-head"><h2 class="h4">Fürs nächste Gespräch</h2></div>
    ${talkCounts.length?talkCounts.map(({p,n})=>`<a class="prow" href="${hrefOf(p.id)}">${avatar(p,'xs')}<span class="pt">${esc(p.name)}</span><span class="pd">${n===1?'ein Punkt':n+' Punkte'}</span></a>`).join(''):'<p class="empty">Noch nichts gesammelt. Punkte notierst du auf der Seite des Mitarbeiters.</p>'}</section>`;
}
function viewOverview(banner=''){
  return`<div class="wrap">${banner}<div class="page-head"><div><p class="overline">${esc(todayOverline())}</p><h1>Übersicht</h1><p class="lead">${esc(overviewHeadline())}</p></div>
    <div class="actions"><button class="btn secondary" data-action="new-absence">Abwesenheit eintragen</button><button class="btn accent" data-action="new-topic">${ic('plus',18,2.5)}Thema anlegen</button></div></div>
  ${firstStepsPanel()}
  ${quickBlock()}
  ${tlSection(['me',...team().map(p=>p.id)])}
  ${team().length?'':`<p class="empty">Noch kein Teammitglied angelegt. Links unter „Person hinzufügen“ legst du die erste Person an.</p>`}
  <div class="split"><section class="card card-pad" data-tour="todos"><div class="sec-head"><h2 class="h4">Offene Aufgaben</h2><span class="sp"></span>${filterTags()}</div>${todoListHTML(ui.filter)}</section>
  <div class="stack">${issuesPanel()}${projectsPanel()}${absencePanel()}${talkCountPanel()}</div></div></div>`;
}

/* ----- Person page and "Meine Planung" ----- */
function personHeadline(p){
  const open=S.todos.filter(t=>!t.done);
  if(p.id==='me'){const own=open.filter(t=>t.personId==='me'),mine=open.filter(t=>t.kind==='mine'&&isActive(t.personId)),wk=own.filter(t=>t.due&&t.due<=ds(mondayOf(TDN)+6)).length;
    let s=own.length?`Du hast ${own.length===1?'eine eigene Aufgabe':own.length+' eigene Aufgaben'} offen${wk?`, ${wk===1?'eine':wk} davon diese Woche fällig`:''}.`:'Du hast keine eigenen Aufgaben offen.';
    if(mine.length)s+=mine.length===1?' Dazu kommt ein To-do zu deinem Team.':` Dazu kommen ${mine.length} To-dos zu deinem Team.`;return s}
  const f=firstName(p),own=open.filter(t=>t.personId===p.id&&t.kind==='team'),k=own.length,l=own.filter(t=>t.due&&t.due<TODAY).length;
  let s=!k?`${f} hat keine offenen Aufgaben.`:`${f} hat ${k===1?'eine offene Aufgabe':k+' offene Aufgaben'}${l?(k===1?', und die ist überfällig':`, ${l===1?'eine':l} davon überfällig`):''}.`;
  const a=nextAbsence(p.id);if(a)s+=a.start<=TODAY?` Bis ${longDay(a.end)} ${absPhrase(a.kind)}.`:` Ab ${longDay(a.start)} ${absPhrase(a.kind)}.`;return s;
}
/* Building blocks of the person page, shared by desktop (viewPerson) and phone (viewPersonPhone). */
function personParts(id){
  const p=personOf(id),isMe=id==='me',f=isMe?'':firstName(p);
  const tabs=isMe?[['team','Eigene Aufgaben',t=>t.personId==='me'],['mine','Zu Mitarbeitern',t=>t.kind==='mine'],['waiting','Wartet auf',t=>t.kind==='waiting']]
    :[['team',isPhone()?'Aufgaben':`Aufgaben von ${f}`,t=>t.personId===id&&t.kind==='team'],['mine','Meine To-dos',t=>t.personId===id&&t.kind==='mine'],['waiting','Wartet auf',t=>t.personId===id&&t.kind==='waiting']];
  if(isMe){const ok=fn=>t=>fn(t)&&isActive(t.personId);for(const x of tabs)if(x[0]!=='team')x[2]=ok(x[2])} // people who left drop out
  const tab=tabs.find(x=>x[0]===(ui.tab[id]||'team'))||tabs[0];
  const items=S.todos.filter(tab[2]),openItems=items.filter(t=>!t.done).sort(byDue),done=items.filter(t=>t.done).sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||'')),showP=isMe&&tab[0]!=='team';
  const tabBtns=tabs.map(([v,l,fn])=>`<button class="tab" role="tab" data-action="tab" data-v="${v}" aria-selected="${tab[0]===v}">${esc(l)}<span class="n">${S.todos.filter(t=>!t.done&&fn(t)).length}</span></button>`).join('');
  let list=openItems.length?openItems.map(t=>todoRow(t,showP)).join(''):`<p class="empty">Nichts offen. ${isPhone()?'Mit dem Plus unten erfassen.':'Oben mit N erfassen, die Aufgabe landet in diesem Reiter.'}</p>`;
  if(done.length)list+=`<div class="grp"><button class="link-btn" data-action="show-done">${ui.showDone?'Erledigte ausblenden':`${done.length} erledigte anzeigen`}</button></div>`
    +(ui.showDone?done.slice(0,10).map(t=>todoRow(t,showP)).join('')+`<div class="grp"><button class="link-btn" data-action="hist-person" data-person="${id}">${isMe?'Alles im Verlauf ansehen':`Alles von ${esc(f)} im Verlauf`}</button></div>`:'');
  let tasks=`<div class="tabs" role="tablist" aria-label="Aufgabenart">${tabBtns}</div>${list}`;
  if(isMe){const fp=forPeople();if(ui.forPid&&!fp.some(x=>x.id===ui.forPid))ui.forPid='';if(fp.length)tasks=forSelect(fp)+(ui.forPid?forList(ui.forPid):tasks)}
  const ord={aktiv:0,geplant:1,erledigt:2};
  const tops=S.topics.filter(t=>t.personId===id).sort((a,b)=>ord[a.status]-ord[b.status]||a.start.localeCompare(b.start));
  const absList=S.absences.filter(a=>a.personId===id&&a.end>=TODAY).sort((a,b)=>a.start.localeCompare(b.start));
  const talks=S.talks.filter(t=>t.personId===id&&!t.done);
  const talkPanel=isMe?'':`<section class="card card-pad" data-tour="talks"><div class="panel-head"><h2 class="h4">Fürs nächste Gespräch</h2></div>
    ${talks.map(t=>`<div class="talk"><button class="check" data-action="talk-done" data-id="${t.id}" aria-label="Als besprochen markieren">${ic('check',14,3)}</button><span>${esc(t.text)}</span><button class="icon-btn" data-action="talk-del" data-id="${t.id}" aria-label="Punkt löschen">${ic('x',16)}</button></div>`).join('')}
    <input class="inline-add" data-add="talk" data-person="${id}" placeholder="Punkt notieren, Enter" aria-label="Gesprächspunkt notieren" enterkeyhint="done" autocomplete="off"></section>`;
  const topicsPanel=`<section class="card card-pad"><div class="panel-head"><h2 class="h4">Themen</h2><button class="link-btn" data-action="new-topic" data-person="${id}">Anlegen</button></div>
      ${tops.length?tops.map(topicRow).join(''):`<p class="empty">Noch keine Themen geplant. ${isPhone()?'„Anlegen“ plant das erste.':'Zieh im Zeitplan über die Tage, die es dauern soll.'}</p>`}</section>`;
  const absPanel=`<section class="card card-pad"><div class="panel-head"><h2 class="h4">Abwesenheiten</h2><button class="link-btn" data-action="new-absence" data-person="${id}">Eintragen</button></div>
      ${absList.length?absList.map(a=>{const n=workdays(a.start,a.end);return`<button class="prow" data-action="edit-absence" data-id="${a.id}"><span class="pt">${esc(absLabel(a.kind))}, ${dm(a.start)} bis ${dm(a.end)}</span><span class="pd">${n===1?'1 Arbeitstag':n+' Arbeitstage'}</span></button>`}).join(''):'<p class="empty">Keine Abwesenheit eingetragen.</p>'}</section>`;
  return{p,isMe,tasks,talkPanel,topicsPanel,absPanel,asgPanel:assignmentsPanel(id),review:reviewPanel(id),involved:isMe?'':involvedPanel(id)};
}
const TOPIC_ST={aktiv:'Aktiv',geplant:'Geplant',erledigt:'Erledigt'};
const topicRow=t=>`<button class="prow" data-action="edit-topic" data-id="${t.id}"><span class="st ${t.status}">${TOPIC_ST[t.status]}</span><span class="pt">${esc(t.title)}${withOf(t).length?`<small class="with-s"> mit ${esc(withNames(t))}</small>`:''}</span><span class="pd">${dm(t.start)} bis ${dm(t.end)}</span></button>`;
/* Person page: open topics and todos of others in which this person is involved (`with`). */
function involvedPanel(id){
  const tops=S.topics.filter(t=>t.status!=='erledigt'&&withOf(t).includes(id)),tds=S.todos.filter(t=>!t.done&&withOf(t).includes(id)).sort(byDue);
  if(!tops.length&&!tds.length)return'';
  const lead=t=>nameShort(personOf(t.personId));
  return`<section class="card card-pad"><div class="panel-head"><h2 class="h4">Beteiligt an</h2></div>
    ${tops.map(t=>`<button class="prow" data-action="edit-topic" data-id="${t.id}"><span class="st ${t.status}">${TOPIC_ST[t.status]}</span><span class="pt">${esc(t.title)}</span><span class="pd">${esc(lead(t))}</span></button>`).join('')}
    ${tds.map(t=>`<button class="prow" data-action="edit-todo" data-id="${t.id}"><span class="pt">${esc(t.title)}</span><span class="pd">${esc(lead(t))}${t.due?', '+esc(dueLabel(t.due)):''}</span></button>`).join('')}</section>`;
}
/* "Meine Planung", filter "Für": my todos and topics that mention a person, plus my to-dos about and waits for that person. */
const forMatch=(t,x)=>(t.personId==='me'||t.kind!=='team')&&(t.personId===x||withOf(t).includes(x));
function forPeople(){const m=new Map(),add=(id,open)=>{if(id==='me')return;const e=m.get(id)||{id,open:0};if(open)e.open++;m.set(id,e)};
  for(const t of S.todos)if(t.personId==='me'||t.kind!=='team')for(const id of new Set([t.personId,...withOf(t)]))add(id,!t.done);
  for(const t of S.topics)if(t.personId==='me')for(const id of withOf(t))add(id,t.status!=='erledigt');
  return[...m.values()].sort((a,b)=>b.open-a.open||personOf(a.id).name.localeCompare(personOf(b.id).name,'de'))}
const forSelect=fp=>`<label class="for-sel"><span class="fl">Für</span><select id="forPerson" aria-label="Nach Person filtern"><option value="">Alle Personen</option>${
  fp.map(x=>`<option value="${x.id}"${x.id===ui.forPid?' selected':''}>${esc(personOf(x.id).name)}${x.open?` (${x.open} offen)`:''}</option>`).join('')}</select></label>`;
function forList(x){
  const f=nameShort(personOf(x)),items=S.todos.filter(t=>forMatch(t,x)),open=items.filter(t=>!t.done).sort(byDue),done=items.filter(t=>t.done).sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||''));
  const tops=S.topics.filter(t=>t.personId==='me'&&withOf(t).includes(x)),ot=tops.filter(t=>t.status!=='erledigt'),dt=tops.filter(t=>t.status==='erledigt');
  let h=open.length||ot.length?ot.map(topicRow).join('')+open.map(t=>todoRow(t,false)).join(''):`<p class="empty">Für ${esc(f)} ist nichts offen.</p>`;
  const nd=done.length+dt.length;
  if(nd)h+=`<div class="grp"><button class="link-btn" data-action="show-done">${ui.showDone?'Erledigte ausblenden':`${nd===1?'1 erledigte':nd+' erledigte'} anzeigen`}</button></div>`
    +(ui.showDone?dt.map(topicRow).join('')+done.map(t=>todoRow(t,false)).join(''):'');
  return h;
}
function viewPerson(id,banner=''){
  const x=personParts(id),p=x.p,isMe=x.isMe;
  const arch=!!p.archived;
  return`<div class="wrap">${banner}<div class="page-head"><div class="head-id">${avatar(p,'lg')}<div><p class="overline">${esc(isMe?['Meine Planung',projectLabel('me')].filter(Boolean).join(' · '):arch?`Ausgeschieden am ${dmy(p.archived)}`:(teamLine(p)||'Team'))}</p><h1>${esc(isMe?'Meine Planung':p.name)}</h1></div></div>
    <div class="actions">${arch?`<button class="btn secondary" data-action="restore-person" data-id="${id}">Zurück ins Team</button>`:`${isMe?'':`<button class="btn ghost" data-action="edit-person" data-id="${id}">Bearbeiten</button>`}
    <button class="btn secondary" data-action="new-absence" data-person="${id}">Abwesenheit eintragen</button><button class="btn accent" data-action="new-topic" data-person="${id}">${ic('plus',18,2.5)}Thema anlegen</button>`}</div></div>
  <p class="lead">${esc(arch?`${firstName(p)} ist nicht mehr im Team. Themen, Aufgaben und Projekte bleiben hier und im Verlauf.`:personHeadline(p))}</p>
  ${arch?'':quickBlock()}
  ${tlSection([id])}
  <div class="split"><section class="card card-pad" data-tour="tasks">${x.tasks}</section>
  <div class="stack">${issuesPanel(id)}${x.involved}${x.talkPanel}${x.asgPanel}${x.topicsPanel}${x.absPanel}${x.review}</div></div></div>`;
}
