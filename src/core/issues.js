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
/* Acknowledged warnings ("Als geklärt markieren"): S.acks entries {id, sig, items, at}. A yellow issue carries `ack` (stable id),
   `sig` (the date it hangs on) and `items` (the absences behind it). The entry hides it while sig is unchanged and its items are a
   subset of the acknowledged ones: it returns when the end or due date moves or a new absence joins in, not when an absence drops
   out because it is over. Red issues (late) carry no `ack` and cannot be acknowledged. */
const absKey=a=>`${a.id}:${a.start}:${a.end}`;
const isAcked=i=>{const a=i.ack&&(S.acks||[]).find(x=>x.id===i.ack);return!!a&&a.sig===i.sig&&(i.items||[]).every(x=>(a.items||[]).includes(x))};
/* Absence risk of a topic as a yellow issue, or null; null as well once acknowledged (the timeline flag uses this too). */
function topicWarn(t,all=false){const r=absRisk(t);if(!r)return null;
  const i={kind:'warn',act:'edit-topic',id:t.id,pid:t.personId,text:`${t.title}: ${r.text}`,risk:r.text,ack:'abs-'+t.id,sig:t.end,items:r.abs.map(absKey)};
  return all||!isAcked(i)?i:null}
/* Every issue including acknowledged ones; issues() leaves those out. */
function allIssues(pid){
  const out=[];
  for(const t of S.topics){if((pid&&t.personId!==pid)||!isActive(t.personId))continue;
    if(topicLate(t))out.push({kind:'late',act:'edit-topic',id:t.id,pid:t.personId,text:`${t.title}: Ende ${dm(t.end)} überschritten`});
    const w=topicWarn(t,true);if(w)out.push(w)}
  for(const t of S.todos){if(t.done||t.kind!=='team'||!t.due||t.personId==='me'||t.due<TODAY||(pid&&t.personId!==pid)||!isActive(t.personId))continue;
    const a=absentOn(t.personId,t.due);if(a)out.push({kind:'warn',act:'edit-todo',id:t.id,pid:t.personId,text:`${t.title}: fällig ${dueLabel(t.due)}, dann ${absPhrase(a.kind)}`,ack:'tabs-'+t.id,sig:t.due,items:[absKey(a)]})}
  for(const t of S.todos){if(t.done||!t.due||t.due<TODAY||(pid&&t.personId!==pid)||!isActive(t.personId))continue;
    const h=holidayOn(dn(t.due));if(h)out.push({kind:'warn',act:'edit-todo',id:t.id,pid:t.personId,text:`${t.title}: fällig ${dueLabel(t.due)}, das ist ein Feiertag (${h})`,ack:'thol-'+t.id,sig:t.due})}
  for(const a of S.assignments){if(!a.end||a.end<TODAY||dn(a.end)>TDN+21||(pid&&a.personId!==pid)||a.personId==='me'||!isActive(a.personId))continue;
    const next=ds(dn(a.end)+1);if(S.assignments.some(b=>b!==a&&b.personId===a.personId&&asgActive(b,next)))continue;
    out.push({kind:'warn',act:'edit-assignment',id:a.id,pid:a.personId,text:`${a.project}: Einsatz von ${firstName(personOf(a.personId))} endet ${a.end===TODAY?'heute':'am '+dm(a.end)}, danach ist nichts geplant`,ack:'asg-'+a.id,sig:a.end})}
  return out;
}
const issues=pid=>allIssues(pid).filter(i=>!isAcked(i));
/* Acknowledge an issue by its ack id; drops entries whose issue no longer exists, so the list does not grow. Caller saves. */
function ackIssue(ack){const all=allIssues(),i=all.find(x=>x.ack===ack);if(!i)return false;
  S.acks=(S.acks||[]).filter(a=>a.id!==ack&&all.some(x=>x.ack===a.id));S.acks.push({id:ack,sig:i.sig,items:i.items||[],at:TODAY});return true}
/* Panel: open issues with a check button on yellow ones; "n geklärte anzeigen" lists acknowledged ones muted, to bring them back. */
function issuesPanel(pid){
  const all=allIssues(pid),open=all.filter(i=>!isAcked(i)),done=all.filter(isAcked);if(!all.length)return'';
  const row=i=>{const p=personOf(i.pid),acked=isAcked(i);
    return`<div class="prow issue${acked?' acked':''}"><button type="button" class="issue-open" data-action="${i.act}" data-id="${i.id}">${pid?'':avatar(p,'xs')}<span class="pt">${esc(i.text)}</span>${acked?'':ic('alert',16).replace('class="ic"',`class="ic ${i.kind}"`)}</button>`
      +(acked?`<button type="button" class="link-btn" data-action="unack-issue" data-id="${i.ack}">Wieder anzeigen</button>`
        :i.ack?`<button type="button" class="icon-btn ack" data-action="ack-issue" data-id="${i.ack}" aria-label="Als geklärt markieren: ${esc(i.text)}" title="Als geklärt markieren">${ic('check',18)}</button>`:'<span class="ack-sp" aria-hidden="true"></span>')+'</div>'};
  return`<section class="card card-pad" data-tour="issues"><div class="panel-head"><h2 class="h4">Zu klären</h2>${done.length?`<button type="button" class="link-btn" data-action="show-acked" aria-expanded="${!!ui.showAcked}">${ui.showAcked?'Geklärte ausblenden':done.length===1?'1 geklärte anzeigen':`${done.length} geklärte anzeigen`}</button>`:''}</div>
    ${open.length?open.map(row).join(''):'<p class="empty">Alles geklärt.</p>'}${ui.showAcked?done.map(row).join(''):''}</section>`;
}
