/* "Zu klären": detects overdue topics, topics overlapping absences, todos due on absence days or holidays and project assignments
   ending within three weeks without a follow-up. */

const overlapAbs=t=>t.status!=='erledigt'&&S.absences.find(a=>a.personId===t.personId&&a.start<=t.end&&a.end>=t.start);
const topicLate=t=>t.status==='aktiv'&&t.end<TODAY;
function issues(pid){
  const out=[];
  for(const t of S.topics){if((pid&&t.personId!==pid)||!isActive(t.personId))continue;
    if(topicLate(t))out.push({kind:'late',act:'edit-topic',id:t.id,pid:t.personId,text:`${t.title}: Ende ${dm(t.end)} überschritten`});
    const a=overlapAbs(t);if(a&&t.end>=TODAY)out.push({kind:'warn',act:'edit-topic',id:t.id,pid:t.personId,text:`${t.title} läuft in ${absLabel(a.kind)} ${dm(a.start)} bis ${dm(a.end)}`})}
  for(const t of S.todos){if(t.done||t.kind!=='team'||!t.due||t.personId==='me'||t.due<TODAY||(pid&&t.personId!==pid)||!isActive(t.personId))continue;
    const a=absentOn(t.personId,t.due);if(a)out.push({kind:'warn',act:'edit-todo',id:t.id,pid:t.personId,text:`${t.title}: fällig ${dueLabel(t.due)}, dann ${absPhrase(a.kind)}`})}
  for(const t of S.todos){if(t.done||!t.due||t.due<TODAY||(pid&&t.personId!==pid)||!isActive(t.personId))continue;
    const h=holidayOn(dn(t.due));if(h)out.push({kind:'warn',act:'edit-todo',id:t.id,pid:t.personId,text:`${t.title}: fällig ${dueLabel(t.due)}, das ist ein Feiertag (${h})`})}
  for(const a of S.assignments){if(!a.end||a.end<TODAY||dn(a.end)>TDN+21||(pid&&a.personId!==pid)||a.personId==='me'||!isActive(a.personId))continue;
    const next=ds(dn(a.end)+1);if(S.assignments.some(b=>b!==a&&b.personId===a.personId&&asgActive(b,next)))continue;
    out.push({kind:'warn',act:'edit-assignment',id:a.id,pid:a.personId,text:`${a.project}: Einsatz von ${firstName(personOf(a.personId))} endet ${a.end===TODAY?'heute':'am '+dm(a.end)}, danach ist nichts geplant`})}
  return out;
}
function issuesPanel(pid){
  const list=issues(pid);if(!list.length)return'';
  return`<section class="card card-pad" data-tour="issues"><div class="panel-head"><h2 class="h4">Zu klären</h2></div>
    ${list.map(i=>{const p=personOf(i.pid);return`<button class="prow issue" data-action="${i.act}" data-id="${i.id}">${pid?'':avatar(p,'xs')}<span class="pt">${esc(i.text)}</span>${i.kind==='late'?ic('alert',16).replace('class="ic"','class="ic late"'):ic('alert',16).replace('class="ic"','class="ic warn"')}</button>`}).join('')}</section>`;
}
