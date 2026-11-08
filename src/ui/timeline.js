/* Timeline: one week, two weeks or six weeks (ui.range 'week', 'two', 'six'). Positions only via colOf(), pos(), dayAt().
   Open todos show as cards with a title in columns at least CHIP_MIN wide, otherwise as markers with a hover card (timeline-pop below). */

let T=null;
const RANGE_WEEKS={week:1,two:2,six:6};
const rangeWeeks=()=>RANGE_WEEKS[ui.range]||1;
const rangeStart=()=>mondayOf(TDN)+ui.off*7;
/* Available width = content width of #main minus card border minus label column. #main uses scrollbar-gutter:stable so the width does not jump. */
function tlAvail(){const m=$('#main');if(!m||!m.clientWidth)return Math.max(480,window.innerWidth-400);const cs=getComputedStyle(m);
  return Math.floor(m.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-2-LABEL)}
const WEEKEND=48; // narrow weekend column in one and two weeks; full width if it is today or has todos due
const CHIP_MIN=100; // narrower columns show todo markers instead of cards
/* T.fine: day-level views (one and two weeks): day headers, a click creates a todo. */
function layout(){
  const start=rangeStart(),weeks=rangeWeeks(),days=weeks*7,fine=weeks<=2;
  const avail=Math.max(420,tlAvail());
  const cols=[];let x=0;
  if(fine){const due=new Set(S.todos.filter(t=>!t.done&&t.due).map(t=>t.due));
    const wide=d=>{const w=wdOf(d);return(w>0&&w<6)||d===TDN||due.has(ds(d))};
    const n=[...Array(days).keys()].filter(i=>wide(start+i)).length,dw=Math.max(weeks===1?112:40,Math.floor((avail-(days-n)*WEEKEND)/n));
    for(let i=0;i<days;i++){const w=wide(start+i)?dw:WEEKEND;cols.push({d:start+i,x,w});x+=w}}
  else{const dw=Math.max(18,Math.floor(avail/days));for(let i=0;i<days;i++){cols.push({d:start+i,x,w:dw});x+=dw}}
  T={start,end:start+days-1,cols,width:x,week:weeks===1,fine,weeks};
}
const colOf=d=>T.cols[d-T.start];
function pos(s,e){const a=Math.max(dn(s),T.start),b=Math.min(dn(e),T.end),ca=colOf(a),cb=colOf(b);return{l:ca.x+3,w:Math.max(10,cb.x+cb.w-ca.x-6)}}
function dayAt(track,cx){const x=cx-track.getBoundingClientRect().left;for(const c of T.cols)if(x<c.x+c.w)return c.d;return T.end}
function rangeLabel(){const s=rangeStart(),w=rangeWeeks();
  return w===1?`KW ${isoWeek(s)}, ${fmtRange(s,s+6)}`:`KW ${isoWeek(s)} ${w===2?'und':'bis'} ${isoWeek(s+(w-1)*7)}, ${fmtRange(s,s+w*7-1)}`}
function headHTML(){
  let h='';const hh=56;
  if(T.fine){
    h=T.cols.map(c=>{const w=wdOf(c.d),we=w===0||w===6,td=c.d===TDN,kw=!T.week&&w===1&&c.d!==T.start;
      const hol=holidayOn(c.d);
      if(hol)return`<div class="hc dl hol${kw?' wkb':''}${td?' td':''}" style="left:${c.x}px;width:${c.w}px;top:0;height:${hh}px" title="${esc(hol)}, Feiertag">${c.w<100?`<b>${WD[w]}</b>${dmN(c.d)}`:`<b>${esc(hol)}</b>${WD[w]} ${td?'heute':dmN(c.d)}`}</div>`;
      return`<div class="hc dl${kw?' wkb':''}${we?' we':''}${td?' td':''}" style="left:${c.x}px;width:${c.w}px;top:0;height:${hh}px"><b>${we||c.w<140?WD[w]:WDL[w]}</b>${td?'Heute':dmN(c.d)}${!T.week&&w===1&&c.w>=110?`<i>KW ${isoWeek(c.d)}</i>`:''}</div>`}).join('');
  }else{
    for(let i=0;i<T.weeks;i++){const c=T.cols[i*7];h+=`<div class="hc wk" style="left:${c.x}px;width:${7*c.w}px;top:0;height:30px"><b>KW ${isoWeek(c.d)}</b>${dmN(c.d)}</div>`}
    h+=T.cols.map(c=>{const w=wdOf(c.d),hol=holidayOn(c.d);return`<div class="hc day${w===0||w===6||hol?' we':''}${c.d===TDN?' td':''}" style="left:${c.x}px;width:${c.w}px;top:30px;height:24px"${hol?` title="${esc(hol)}, Feiertag"`:''}><span>${new Date(c.d*DAYMS).getUTCDate()}</span></div>`}).join('');
  }
  return`<div class="tl-head" style="height:${hh}px"><div class="tl-corner"></div><div class="tl-hcols" style="width:${T.width}px;height:${hh}px">${h}</div></div>`;
}
const todoNote=t=>t.kind==='mine'?' (mein To-do)':t.kind==='waiting'?' (wartet)':'';
function chipHTML(t,c,top){
  const late=t.due<TODAY;
  return`<div class="tchip k-${t.kind}${late?' late':''}" data-todo="${t.id}" data-day="${c.d}" data-person="${t.personId}" data-ids="${t.id}" tabindex="0" role="button"
    style="left:${c.x+5}px;top:${top}px;width:${c.w-10}px" aria-label="${esc(t.title)}${todoNote(t)}${late?`, überfällig seit ${dueLabel(t.due)}`:''}"><button class="mini-check" data-action="toggle" data-id="${t.id}" aria-label="Als erledigt markieren">${ic('check',10,3)}</button><span>${esc(t.title)}</span>${late?ic('alert',14):''}</div>`;
}
/* Marker for the todos of one person on one day in a narrow column. One todo: drag and click like a card. Several: the number,
   a click pins the hover card with the list. Its look follows the most urgent todo: overdue, then mine, team, waiting. */
const MARK=24;
function markHTML(list,c,top,pid){
  const late=list.some(t=>t.due<TODAY),k=['mine','team','waiting'].find(k=>list.some(t=>t.kind===k))||'team',n=list.length,size=Math.min(MARK,c.w-6);
  const label=n===1?`${list[0].title}${todoNote(list[0])}${late?`, überfällig seit ${dueLabel(list[0].due)}`:''}`:`${n} Aufgaben am ${dmN(c.d)}${late?', davon überfällig':''}`;
  return`<div class="tmark k-${k}${late?' late':''}${n>1?' multi':''}" ${n===1?`data-todo="${list[0].id}" `:''}data-day="${c.d}" data-person="${pid}" data-ids="${list.map(t=>t.id).join(' ')}" tabindex="0" role="button"
    aria-label="${esc(label)}" style="left:${c.x+(c.w-size)/2}px;top:${top}px;width:${size}px;height:${size}px">${n>1?`<b>${n}</b>`:late?ic('bang',Math.min(14,size-6),3):''}</div>`;
}
/* Active and planned topics alternate between three navy tones so that parallel topics of one person stand apart.
   The tone follows the order of the person's topics by start, so it stays the same while paging. */
function toneMap(){const m={},by={};
  for(const t of S.topics)(by[t.personId]=by[t.personId]||[]).push(t);
  for(const k in by)by[k].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.id.localeCompare(b.id)).forEach((t,i)=>m[t.id]=i%3);
  return m}
function barHTML(t,l,tone=0){
  const x=pos(t.start,t.end),late=topicLate(t),ov=overlapAbs(t);
  const note=late?' Ende überschritten.':ov?` Überschneidet ${ov.kind} ${dm(ov.start)} bis ${dm(ov.end)}.`:'';
  return`<div class="bar ${t.status} tone-${tone}" data-id="${t.id}" tabindex="0" role="button" style="left:${x.l}px;width:${x.w}px;top:${10+l*LANE}px"
    title="${esc(t.title)}: ${dm(t.start)} bis ${dm(t.end)}.${withOf(t).length?` Mit ${esc(withNames(t))}.`:''}${note}"><span class="h h-l"></span>${late?`<span class="flag late">${ic('alert',14,2.5)}</span>`:ov?`<span class="flag warn">${ic('alert',14,2.5)}</span>`:''}<span class="bar-t">${esc(t.title)}</span><span class="h h-r"></span></div>`;
}
function timeline(ids){
  layout();hidePop();
  const bg=T.cols.map((c,i)=>{const w=wdOf(c.d),cl=['col'];if(i===0)cl.push('first');if(T.fine)cl.push('dl');if(w===1&&!T.week)cl.push('wk');
    if(w===0||w===6||holidayOn(c.d))cl.push('we');if(c.d===TDN)cl.push('td');return`<div class="${cl.join(' ')}" style="left:${c.x}px;width:${c.w}px"></div>`}).join('');
  const todayIn=TDN>=T.start&&TDN<=T.end,tones=toneMap();
  let rows='';
  for(const id of ids){
    const p=personOf(id);
    const tops=S.topics.filter(t=>t.personId===id&&dn(t.end)>=T.start&&dn(t.start)<=T.end).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
    const lanes=[];const placed=tops.map(t=>{let l=lanes.findIndex(e=>e<dn(t.start));if(l<0){l=lanes.length;lanes.push(0)}lanes[l]=dn(t.end);return{t,l}});
    const byDay={};
    for(const t of S.todos){if(t.done||t.personId!==id||!t.due)continue;let d=dn(t.due);if(d<TDN&&todayIn)d=TDN;if(d<T.start||d>T.end)continue;(byDay[d]=byDay[d]||[]).push(t)}
    let chips='',stack=0;const top0=10+lanes.length*LANE;
    for(const d in byDay){const list=byDay[d].sort(byDue),c=colOf(+d);
      if(c.w>=CHIP_MIN){stack=Math.max(stack,list.length);list.forEach((t,i)=>{chips+=chipHTML(t,c,top0+i*CH)})}
      else{stack=Math.max(stack,1);chips+=markHTML(list,c,top0+2,id)}}
    const h=Math.max(T.fine?80:68,10+lanes.length*LANE+stack*CH+26);
    const abs=S.absences.filter(a=>a.personId===id&&dn(a.end)>=T.start&&dn(a.start)<=T.end);
    const proj=projectLabel(id,S.assignments.filter(a=>a.personId===id&&asgOverlaps(a,ds(T.start),ds(T.end))).sort(asgSort));
    rows+=`<div class="tl-row" style="height:${h}px"><a class="tl-label" href="${hrefOf(id)}">${avatar(p,'sm')}<span class="ln"><span>${esc(p.id==='me'?'Ich':p.name)}</span>${proj?`<small>${esc(proj)}</small>`:''}</span></a>
      <div class="tl-track" data-person="${id}" style="width:${T.width}px">${bg}
      ${abs.map(a=>{const x=pos(a.start,a.end);return`<div class="abs" style="left:${x.l-3}px;width:${x.w+6}px"><button class="abs-label" data-action="edit-absence" data-id="${a.id}" title="${esc(absLabel(a.kind))}, ${dm(a.start)} bis ${dm(a.end)}">${esc(absLabel(a.kind))}</button></div>`}).join('')}
      ${placed.map(({t,l})=>barHTML(t,l,tones[t.id])).join('')}${chips}<div class="tl-ghost" hidden></div></div></div>`;
  }
  return`<div class="tl"><div class="tl-grid" style="width:${LABEL+T.width}px;--label:${LABEL}px">${headHTML()}${rows}</div></div>`;
}
function tlSection(ids){
  const r=rangeWeeks(),fine=r<=2;
  const legend=`<span><i class="sw aktiv"></i>Aktiv</span><span><i class="sw geplant"></i>Geplant</span><span><i class="sw erledigt"></i>Erledigt</span><span><i class="sw off"></i>Abwesend</span><span><i class="sw mine"></i>Mein To-do</span>`;
  const btn=(v,l)=>`<button class="tag" data-action="range" data-v="${v}" aria-pressed="${ui.range===v}">${l}</button>`;
  return`<section class="card tl-card" data-tour="timeline"><div class="tl-top">
    <div class="sec-head"><div class="tags" role="group" aria-label="Zeitraum">${btn('week','Woche')}${btn('two','2 Wochen')}${btn('six','6 Wochen')}</div>
      <div class="pager"><button class="icon-btn" data-action="tl-prev" aria-label="Zurück">${ic('chevL',20)}</button><button class="btn ghost sm" data-action="tl-today">Heute</button><button class="icon-btn" data-action="tl-next" aria-label="Vor">${ic('chevR',20)}</button></div>
      <h2 class="h4">${esc(rangeLabel())}</h2><span class="sp"></span><div class="legend">${legend}</div></div></div>
    ${timeline(ids)}</section>
    <p class="tl-hint">${fine?'Klick in einen Tag legt eine Aufgabe an, Ziehen über mehrere Tage ein Thema. Aufgaben ziehst du auf einen anderen Tag oder zu einer anderen Person; Überfälliges sammelt sich bei heute. Maus über einer Aufgabe zeigt die Details.'
      :'Ziehen über freie Fläche legt ein Thema für genau diesen Zeitraum an, ein Klick eins mit fünf Tagen. Balken ziehen verschiebt, an den Enden ziehen ändert die Dauer. Punkte sind Aufgaben: Maus darüber zeigt die Details, ein Klick öffnet sie.'}</p>`;
}

/* Hover card for todo cards and markers in every view (position:fixed, because the timeline clips). Shows the full title, kind, due date
   and the start of the note. Opens on hover after HOVER_MS (cards HOVER_CHIP_MS, so moving across the board stays calm) and on keyboard
   focus; beside a card so the cards below stay visible, below a marker. A click on a marker with several todos pins it until a click
   outside or Esc. Entries open the todo. */
const HOVER_MS=150,HOVER_CHIP_MS=350;
let pop=null; // {el, mark, pinned, timer}
function popHTML(mark){
  const d=+mark.dataset.day,ids=mark.dataset.ids.split(' '),list=S.todos.filter(t=>ids.includes(t.id)).sort(byDue),p=personOf(mark.dataset.person);
  const items=list.map(t=>{const late=t.due<TODAY;
    return`<li><button type="button" class="tp-i k-${t.kind}${late?' late':''}" data-action="edit-todo" data-id="${t.id}"><span class="tp-dot"></span><span class="tp-t"><b>${esc(t.title)}</b>
      <small>${esc(kindLabel(t.kind,p))}${withOf(t).length?`, mit ${esc(withNames(t))}`:''}${t.repeat?`, ${esc(repeatLabel(t.repeat).toLowerCase())}`:''}, ${late?`überfällig seit ${esc(dueLabel(t.due))}`:`fällig ${esc(dueLabel(t.due))}`}</small>${t.note?`<span class="tp-n">${esc(t.note)}</span>`:''}</span></button></li>`}).join('');
  return`<div class="tp-head"><b>${esc(d===TDN?'Heute':longDay(ds(d)))}</b><span>${list.length===1?'1 Aufgabe':`${list.length} Aufgaben`}</span></div><ul>${items}</ul>`;
}
function showPop(mark,pinned=false){
  clearTimeout(pop?.timer);
  if(pop?.mark===mark){if(pinned)pop.pinned=true;return}
  hidePop();
  const el=document.createElement('div');el.id='tlPop';el.className='tpop';el.setAttribute('role','dialog');el.setAttribute('aria-label','Aufgaben');
  el.innerHTML=popHTML(mark);document.body.appendChild(el);
  const r=mark.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;let x,y;
  if(mark.classList.contains('tchip')){x=r.right+8;if(x+w>innerWidth-8)x=Math.max(8,r.left-w-8);y=Math.min(Math.max(8,r.top-14),innerHeight-h-8)}
  else{x=Math.min(Math.max(8,r.left+r.width/2-w/2),innerWidth-w-8);y=r.bottom+8;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-8)}
  el.style.left=x+'px';el.style.top=y+'px';
  pop={el,mark,pinned,timer:0};mark.setAttribute('aria-expanded','true')}
function hidePop(){if(!pop)return;clearTimeout(pop.timer);pop.el.remove();pop.mark.removeAttribute('aria-expanded');pop=null}
function hidePopSoon(){if(!pop||pop.pinned)return;clearTimeout(pop.timer);pop.timer=setTimeout(hidePop,120)}
