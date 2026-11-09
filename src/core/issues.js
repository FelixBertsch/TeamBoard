/* "Zu klären": detects overdue topics, main topics whose finish is at risk from absences, todos due on absence days or holidays
   and project assignments ending within three weeks without a follow-up. */

/* Absences of the responsible person put a topic at risk only if it is a main topic (no `side`), still open and not over, and
   an absence touches the end date or the RISK_DAYS workdays before it, or absences cover more than half of the remaining workdays
   (from today or the start). A single day off in the middle of a long topic is no risk. Returns one result per topic with all
   absences that matter: {abs, text}; the text has no title ("Lena ist kurz vor dem Ende im Urlaub (12.11. bis 13.11.)").
   Used by "Zu klären" and the warning flag on the timeline bar. */
const RISK_DAYS=3;
function absRisk(t){
  if(t.side||t.status==='erledigt'||t.end<TODAY)return null;
  const from=t.start>TODAY?t.start:TODAY,list=S.absences.filter(a=>a.personId===t.personId&&a.start<=t.end&&a.end>=from);
  if(!list.length)return null;
  let w=dn(t.end),c=isWorkday(w)?0:-1;while(c<RISK_DAYS&&w>dn(from)){w--;if(isWorkday(w))c++} // first day of the critical phase
  const who=t.personId==='me'?'du bist':`${firstName(personOf(t.personId))} ist`;
  const how=abs=>abs.every(a=>a.kind===abs[0].kind)?absPhrase(abs[0].kind):'abwesend';
  const near=list.filter(a=>dn(a.end)>=w);
  if(near.length)return{abs:near,text:`${who} kurz vor dem Ende ${how(near)} (${near.map(a=>a.start===a.end?dm(a.start):`${dm(a.start)} bis ${dm(a.end)}`).join(', ')})`};
  const off=new Set(),total=workdays(from,t.end);
  for(const a of list)for(let i=Math.max(dn(a.start),dn(from));i<=Math.min(dn(a.end),dn(t.end));i++)if(isWorkday(i))off.add(i);
  return off.size*2>total?{abs:list,text:`${who} an ${off.size} von ${total} Arbeitstagen ${how(list)}`}:null;
}
const topicLate=t=>t.status==='aktiv'&&t.end<TODAY;
function issues(pid){
  const out=[];
  for(const t of S.topics){if((pid&&t.personId!==pid)||!isActive(t.personId))continue;
    if(topicLate(t))out.push({kind:'late',act:'edit-topic',id:t.id,pid:t.personId,text:`${t.title}: Ende ${dm(t.end)} überschritten`});
    const r=absRisk(t);if(r)out.push({kind:'warn',act:'edit-topic',id:t.id,pid:t.personId,text:`${t.title}: ${r.text}`})}
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
