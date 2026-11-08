/* Phone views (lay-phone): same data, actions and forms as desktop, but no timeline and no dragging. */
function awayChips(){
  const list=S.absences.filter(a=>a.end>=TODAY&&dn(a.start)<=TDN+7&&isActive(a.personId)).sort((a,b)=>a.start.localeCompare(b.start));
  if(!list.length)return'';
  const wd=s=>`${WD[wdOf(dn(s))]} ${dm(s)}`;
  return`<div class="m-row" role="group" aria-label="Abwesend">${list.map(a=>{const p=personOf(a.personId),now=a.start<=TODAY,n=p.id==='me'?'Ich':firstName(p);
    return`<button class="away${now?'':' soon'}" data-action="edit-absence" data-id="${a.id}">${avatar(p,'sm')}${esc(n)}, ${esc(absLabel(a.kind))} ${now?'bis '+wd(a.end):'ab '+wd(a.start)}</button>`}).join('')}</div>`;
}
function viewToday(banner=''){
  return`${banner}<div class="m-head"><p class="overline">${esc(todayOverline())}</p><h1>Heute</h1><p class="lead">${esc(overviewHeadline())}</p></div>
  ${awayChips()}<div class="m-row">${filterTags()}</div>
  <div class="m-stack">${firstStepsPanel()}<section class="card card-pad" aria-label="Offene Aufgaben">${todoListHTML(ui.filter)}</section>${issuesPanel()}${projectsPanel()}${talkCountPanel()}${absencePanel()}${historyLink()}</div>`;
}
/* 14-day strip: topics as bars on lanes, absences hatched, today highlighted. */
function stripHTML(pid,start){
  const N=14,end=start+N-1,pc=d=>((d-start)/N*100).toFixed(3)+'%',wpc=n=>(n/N*100).toFixed(3)+'%';
  let h='';for(let i=0;i<N;i++){const d=start+i,w=wdOf(d);h+=`<span class="sd${w===0||w===6||holidayOn(d)?' we':''}${d===TDN?' td':''}" style="left:${pc(d)};width:${wpc(1)}"></span>`}
  for(const a of S.absences.filter(a=>a.personId===pid&&dn(a.end)>=start&&dn(a.start)<=end)){const s=Math.max(dn(a.start),start),e=Math.min(dn(a.end),end);
    h+=`<span class="sa" style="left:${pc(s)};width:${wpc(e-s+1)}"></span>`}
  const own=placeLanes(S.topics.filter(t=>t.personId===pid&&dn(t.end)>=start&&dn(t.start)<=end).sort(byStart)),inv=placeLanes(involvedTopics(pid,start,end));
  const bar=(t,top,cls,label,text)=>{const s=Math.max(dn(t.start),start),e=Math.min(dn(t.end),end);
    return`<button class="sb ${cls}" data-action="edit-topic" data-id="${t.id}" style="left:calc(${pc(s)} + 2px);width:calc(${wpc(e-s+1)} - 4px);top:${top}px" aria-label="${esc(label)}, ${dm(t.start)} bis ${dm(t.end)}">${text}</button>`};
  let bars=own.placed.map(({t,l})=>bar(t,4+l*26,t.status,t.title,esc(t.title))).join('');
  bars+=inv.placed.map(({t,l})=>bar(t,4+(own.n+l)*26,`inv${t.status==='erledigt'?' inv-done':''}`,`Beteiligt an ${t.title}, verantwortlich: ${ownerName(t)}`,`${ic('users',12)}<span>${esc(ownerName(t))}: ${esc(t.title)}</span>`)).join('');
  const n=own.n+inv.n;
  return`<div class="strip" style="height:${Math.max(30,8+n*26)}px">${h}${bars}${n?'':'<span class="empty-s">Kein Thema in diesen zwei Wochen</span>'}</div>`;
}
function viewTeam(banner=''){
  const start=mondayOf(TDN),open=S.todos.filter(t=>!t.done),wd=s=>`${WD[wdOf(dn(s))]} ${dm(s)}`;
  const days=Array.from({length:14},(_,i)=>{const d=start+i;return`<span class="${d===TDN?'td':wdOf(d)===1?'wk':''}"><span>${new Date(d*DAYMS).getUTCDate()}</span></span>`}).join('');
  const card=p=>{const me=p.id==='me',a=absentOn(p.id,TODAY),nx=a?null:nextAbsence(p.id);
    const own=open.filter(t=>t.personId===p.id&&(me||t.kind==='team')),late=own.filter(t=>t.due&&t.due<TODAY).length;
    const sub=a?`${absLabel(a.kind)} bis ${wd(a.end)}`:nx&&dn(nx.start)<=TDN+14?`${absLabel(nx.kind)} ab ${wd(nx.start)}`:me?'Meine Planung':(teamLine(p)||'Kein Team');
    return`<section class="card card-pad pcard"><a class="pcard-top" href="${hrefOf(p.id)}">${avatar(p)}<span class="pcard-nm"><b>${esc(me?'Ich':p.name)}</b><small>${a?'<span class="dot"></span>':''}${esc(sub)} · ${own.length} offen</small></span>
      ${late?`<span class="badge late">${ic('alert',12,2.5)}${late} überfällig</span>`:''}${ic('chevR',18)}</a>${stripHTML(p.id,start)}</section>`};
  return`${banner}<div class="m-head"><p class="overline">KW ${isoWeek(start)} und ${isoWeek(start+7)}</p><h1>Team</h1><p class="lead">${esc(fmtRange(start,start+13))}</p></div>
  <div class="tm-days" aria-hidden="true">${days}</div>
  <div class="m-stack">${[ME,...team()].map(card).join('')}
  ${team().length?'':'<p class="empty">Noch kein Teammitglied angelegt. Leg die erste Person hier an.</p>'}
  <button class="btn secondary" data-action="new-person" style="justify-self:start">${ic('userPlus',18)}Person hinzufügen</button></div>`;
}
function viewPersonPhone(id,banner=''){
  const x=personParts(id),p=x.p,isMe=x.isMe,arch=!!p.archived;
  return`${banner}${isMe?'':`<div class="m-top"><a class="m-back" href="#team">${ic('chevL',22,2.5)}Team</a></div>`}
  <div class="m-head"><div class="head-id">${avatar(p,'lg')}<div><p class="overline">${esc(isMe?['Ich',projectLabel('me')].filter(Boolean).join(' · '):arch?`Ausgeschieden am ${dmy(p.archived)}`:(teamLine(p)||'Team'))}</p><h1>${esc(isMe?'Meine Planung':p.name)}</h1></div></div>
    <p class="lead" style="margin-top:12px">${esc(arch?`${firstName(p)} ist nicht mehr im Team. Themen, Aufgaben und Projekte bleiben hier und im Verlauf.`:personHeadline(p))}</p></div>
  <div class="m-actions">${arch?`<button class="btn secondary sm" data-action="restore-person" data-id="${id}">Zurück ins Team</button>`:`${isMe?'':`<button class="btn ghost sm" data-action="edit-person" data-id="${id}">Bearbeiten</button>`}<button class="btn secondary sm" data-action="new-absence" data-person="${id}">Abwesenheit</button><button class="btn secondary sm" data-action="new-topic" data-person="${id}">Thema</button>`}</div>
  <div class="m-stack">${issuesPanel(id)}<section class="card card-pad">${x.tasks}</section>${x.involved}${x.talkPanel}${x.asgPanel}${x.topicsPanel}${x.absPanel}${x.review}</div>`;
}
