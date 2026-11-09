/* History ("Verlauf", #verlauf): completed todos, discussed talking points, finished topics, holidays and trainings,
   project starts and ends, newest first and grouped by calendar week. Same markup on desktop and phone.
   Sick days and other absences are left out on purpose: the board keeps no sick-day history (see expireSick()).
   Also the yearly review panel on person pages (reviewPanel()). */
const HIST_TYPES=[['alle','Alle'],['todo','Aufgaben'],['topic','Themen'],['talk','Gespräche'],['absence','Urlaub und Schulung'],['project','Projekte']];
const HIST_ICONS={todo:'check',talk:'message',topic:'flag',absence:'calendar',project:'briefcase'};

function historyEvents(){
  const ev=[],kindSub={mine:'Mein To-do',waiting:'Wartet auf'};
  for(const t of S.todos)if(t.done)ev.push({type:'todo',day:t.doneAt||null,pid:t.personId,title:t.title,sub:kindSub[t.kind]||'Aufgabe',act:'edit-todo',id:t.id});
  for(const t of S.talks)if(t.done)ev.push({type:'talk',day:t.doneAt||null,pid:t.personId,title:t.text,sub:'Besprochen',act:'edit-talk',id:t.id});
  for(const t of S.topics)if(t.status==='erledigt')ev.push({type:'topic',day:t.doneAt||t.end,pid:t.personId,title:t.title,sub:`Thema ${dm(t.start)} bis ${dm(t.end)}`,act:'edit-topic',id:t.id});
  for(const a of S.absences)if((a.kind==='Urlaub'||a.kind==='Schulung')&&a.start<=TODAY)
    ev.push({type:'absence',day:a.start,pid:a.personId,title:`${a.kind} ${absWhen(a)}`,sub:daysText(absDays(a)),act:'edit-absence',id:a.id});
  for(const a of S.assignments){
    if(a.start<=TODAY)ev.push({type:'project',day:a.start,pid:a.personId,title:`Beginn bei ${a.project}`,sub:a.billable?'Fakturierbar':'Intern',act:'edit-assignment',id:a.id});
    if(a.end&&a.end<=TODAY)ev.push({type:'project',day:a.end,pid:a.personId,title:`Ende bei ${a.project}`,sub:'Projekt beendet',act:'edit-assignment',id:a.id})}
  return ev;
}
const isDoneEvent=e=>e.type==='todo'||e.type==='talk'||e.type==='topic';
/* Completed items (todos, talking points, topics) in the week starting at Monday m. */
const doneInWeek=(ev,m)=>ev.filter(e=>isDoneEvent(e)&&e.day&&dn(e.day)>=m&&dn(e.day)<=m+6).length;

function histRow(e,showWho){
  const p=personOf(e.pid),who=showWho?(p.id==='me'?'Ich':firstName(p)):'';
  return`<button class="hrow" data-action="${e.act}" data-id="${e.id}"><span class="h-ic t-${e.type}">${ic(HIST_ICONS[e.type],16,2.5)}</span>
    <span class="h-body"><span class="h-t">${esc(e.title)}</span><span class="h-s">${[who,e.sub].filter(Boolean).map(esc).join(' · ')}</span></span>
    <span class="h-d">${e.day?esc(`${WD[wdOf(dn(e.day))]} ${dm(e.day)}`):''}</span></button>`;
}
function viewHistory(banner=''){
  const h=ui.hist,q=fold(h.q.trim()),all=historyEvents();
  const nameOf=e=>fold(personOf(e.pid).name);
  const ev=all.filter(e=>(h.type==='alle'||e.type===h.type)&&(!h.pid||e.pid===h.pid)&&(!q||fold(e.title).includes(q)||fold(e.sub).includes(q)||nameOf(e).includes(q)));
  const dated=ev.filter(e=>e.day).sort((a,b)=>b.day.localeCompare(a.day)),undated=ev.filter(e=>!e.day);
  const from=mondayOf(TDN)-7*(h.weeks-1),shown=q?dated:dated.filter(e=>dn(e.day)>=from),older=dated.length-shown.length;
  const weeks=new Map();for(const e of shown){const m=mondayOf(dn(e.day));if(!weeks.has(m))weeks.set(m,[]);weeks.get(m).push(e)}
  const showWho=!h.pid;
  let list=[...weeks].map(([m,es])=>`<div class="grp">KW ${isoWeek(m)} · ${esc(fmtRange(m,m+6))}<span class="n">${es.length}</span></div>${es.map(e=>histRow(e,showWho)).join('')}`).join('');
  if(older)list+=`<div class="grp"><button class="link-btn" data-action="hist-more">Ältere anzeigen</button></div>`;
  else if(undated.length)list+=`<div class="grp">Ohne Datum<span class="n">${undated.length}</span></div>${undated.map(e=>histRow(e,showWho)).join('')}`;
  if(!shown.length&&!undated.length&&!older)list=`<p class="empty">${q||h.pid||h.type!=='alle'?'Nichts gefunden für diese Auswahl.':'Hier erscheint, was erledigt, besprochen oder abgeschlossen ist. Hakst du eine Aufgabe ab, steht sie hier mit Datum.'}</p>`;
  const m=mondayOf(TDN),a=doneInWeek(all,m),b=doneInWeek(all,m-7);
  const lead=`Diese Woche ${a===1?'eins':a} erledigt, letzte Woche ${b===1?'eins':b}. Krankheitstage stehen hier bewusst nicht.`;
  const opt=(v,l)=>`<option value="${v}"${h.pid===v?' selected':''}>${esc(l)}</option>`;
  const controls=`<div class="hist-ctl" data-tour="history"><div class="tags" role="group" aria-label="Art">${HIST_TYPES.map(([v,l])=>`<button class="tag" data-action="hist-type" data-v="${v}" aria-pressed="${h.type===v}">${l}</button>`).join('')}</div>
    <div class="hist-row"><select id="histPerson" class="hist-sel" aria-label="Person">${opt('','Alle Personen')}${opt('me','Ich')}${S.people.map(p=>opt(p.id,p.name+(p.archived?' (ausgeschieden)':''))).join('')}</select>
    <label class="hist-q">${ic('search',18)}<input id="histSearch" type="search" value="${esc(h.q)}" placeholder="Suchen" aria-label="Verlauf durchsuchen" autocomplete="off" enterkeyhint="search"></label></div></div>`;
  const body=`<section class="card card-pad hist">${controls}${list}</section>`;
  if(isPhone())return`${banner}<div class="m-head"><p class="overline">Rückblick</p><h1>Verlauf</h1><p class="lead">${esc(lead)}</p></div><div class="m-stack">${body}</div>`;
  return`<div class="wrap">${banner}<div class="page-head"><div><p class="overline">Rückblick</p><h1>Verlauf</h1><p class="lead">${esc(lead)}</p></div></div>${body}</div>`;
}
/* Phone "Heute": entry to the history. */
function historyLink(){const n=doneInWeek(historyEvents(),mondayOf(TDN));
  return`<a class="card m-link" href="#verlauf">${ic('history',20)}<span>${n?`Diese Woche ${n===1?'eins':n} erledigt`:'Verlauf ansehen'}</span>${ic('chevR',18)}</a>`}

/* Yearly review on the person page: projects, holidays and trainings in working days, completed items. No sick days. */
function reviewPanel(id){
  const cur=+TODAY.slice(0,4),y=ui.year[id]||cur,from=`${y}-01-01`,to=`${y}-12-31`,inY=s=>!!s&&s.startsWith(String(y));
  const clip=a=>absDays(a,from,to);
  const projs=S.assignments.filter(a=>a.personId===id&&asgOverlaps(a,from,to)).sort((a,b)=>a.start.localeCompare(b.start));
  const absRow=(kind,label)=>{const list=S.absences.filter(a=>a.personId===id&&a.kind===kind&&a.start<=to&&a.end>=from).sort((a,b)=>a.start.localeCompare(b.start));
    const n=list.reduce((s,a)=>s+clip(a),0);
    return list.length?`<details class="rv"><summary><span class="rv-l">${label}</span><span class="rv-v">${daysText(n)}</span>${ic('chevR',16)}</summary>${list.map(a=>`<button class="prow" data-action="edit-absence" data-id="${a.id}"><span class="pt">${esc(absWhen(a))}</span><span class="pd">${daysText(clip(a))}</span></button>`).join('')}</details>`
      :`<div class="rv"><span class="rv-l">${label}</span><span class="rv-v">keine</span></div>`};
  const todos=S.todos.filter(t=>t.personId===id&&t.done&&inY(t.doneAt)).length,talks=S.talks.filter(t=>t.personId===id&&t.done&&inY(t.doneAt)).length;
  const done=[todos?`${todos} ${todos===1?'Aufgabe':'Aufgaben'}`:'',talks?`${talks} ${talks===1?'Gesprächspunkt':'Gesprächspunkte'}`:''].filter(Boolean).join(', ')||'nichts mit Datum';
  return`<section class="card card-pad review"><div class="panel-head"><h2 class="h4">Rückblick ${y}</h2>
    <div class="pager"><button class="icon-btn" data-action="year" data-person="${id}" data-v="-1" aria-label="Vorjahr">${ic('chevL',20)}</button><button class="icon-btn" data-action="year" data-person="${id}" data-v="1" aria-label="Folgejahr"${y>=cur?' disabled':''}>${ic('chevR',20)}</button></div></div>
    <div class="rv rv-p"><span class="rv-l">Projekte</span><span class="rv-v">${projs.length?projs.map(a=>`<button class="link-btn rv-pj" data-action="edit-assignment" data-id="${a.id}">${esc(a.project)}</button><small>${a.end?`${yy(a.start)} bis ${yy(a.end)}`:`seit ${yy(a.start)}`}${a.billable?'':', intern'}</small>`).join(''):'keine'}</span></div>
    ${absRow('Urlaub','Urlaub')}${absRow('Schulung','Schulung')}
    <div class="rv"><span class="rv-l">Erledigt</span><span class="rv-v">${done}</span></div>
    <div class="rv-foot"><button class="link-btn" data-action="hist-person" data-person="${id}">Im Verlauf ansehen</button></div></section>`;
}
