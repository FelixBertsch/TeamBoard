/* Pointer interactions on the timeline. Bars: move or resize. Todo cards: drop on a day or person.
   Empty area: drag a range, then type a title and press Enter. All share one `drag` object with a `type`. */
let drag=null,hoverTrack=null;
function showGhost(track,a,b,label,creating=false){const g=track.querySelector('.tl-ghost');if(!g)return;
  const lo=Math.max(Math.min(a,b),T.start),hi=Math.min(Math.max(a,b),T.end),ca=colOf(lo),cb=colOf(hi);
  g.hidden=false;g.classList.toggle('creating',creating);g.style.left=(ca.x+3)+'px';g.style.width=(cb.x+cb.w-ca.x-6)+'px';g.textContent=label}
function hideGhost(track){const g=track?.querySelector('.tl-ghost');if(g){g.hidden=true;g.classList.remove('creating')}}
function spanLabel(a,b){const lo=Math.min(a,b),hi=Math.max(a,b),n=hi-lo+1;return lo===hi?`${WD[wdOf(lo)]} ${dmN(lo)}, 1 Tag`:`${dmN(lo)} bis ${dmN(hi)}, ${n} Tage`}
/* Inline field after drag-to-create. Plain text becomes a topic, as before. A tag turns it into something else for the dragged
   person and range: #urlaub, #krank, #schulung, #abwesend an absence over the range; #ich, #meins, #wartet a todo due on the
   last dragged day ("bis Fr" overrides). With a tag the text goes through parseQuick(), so "@Name" works there too. */
const INLINE_TAG=/(^|\s)#(ich|meins|wartet|urlaub|krank|schulung|abwesend|(zwei)?w(ö|o|oe)chentlich|monatlich|quartalsweise|j(ä|a|ae)hrlich)(?=\s|$)/i;
function inlineParse(raw,pid,lo,hi){
  if(!INLINE_TAG.test(raw))return{type:'topic',title:raw.trim()};
  const r=parseQuick(raw,{personId:pid,kind:'team'});
  return r.type==='absence'?{...r,start:ds(lo),end:ds(hi)}:{...r,due:r.due||ds(hi)}}
function inlineHint(inp){
  const lo=+inp.dataset.lo,hi=+inp.dataset.hi,r=inlineParse(inp.value,inp.dataset.person,lo,hi),span=spanLabel(lo,hi);let s;
  if(r.type==='topic')s=`${span}, Esc bricht ab`;
  else if(r.ambiguous)s=ambiguousText(r);
  else{const p=personOf(r.personId),who=p.id==='me'?'Ich':firstName(p);
    if(r.type==='absence'){const over=S.absences.find(a=>a.personId===r.personId&&a.start<=r.end&&a.end>=r.start);
      s=`Abwesenheit: ${who} ${absPhrase(r.absKind)}, ${span}${r.dropped?', ohne Text':''}${over?`, überschneidet ${absLabel(over.kind)} ${dm(over.start)} bis ${dm(over.end)}`:''}`}
    else s=`${kindLabel(r.kind,p)}, fällig ${dueLabel(r.due)}${r.title?'':', Titel fehlt'}`;
    if(r.unknown)s+=`, „${r.unknown}“ gibt es weder im Team noch bei den Kontakten`}
  inp.nextElementSibling.textContent=s}
function inlineCreate(track,a,b){
  hideGhost(track);const lo=Math.min(a,b),hi=Math.max(a,b),pid=track.dataset.person;
  const x=pos(ds(lo),ds(hi)),el=document.createElement('div');
  el.className='tl-new';el.style.left=x.l+'px';el.style.width=Math.max(x.w,260)+'px';const bars=[...track.querySelectorAll('.bar')].filter(b=>{const l=parseFloat(b.style.left),w=parseFloat(b.style.width);return l<x.l+Math.max(x.w,260)&&l+w>x.l});
  el.style.top=(bars.length?Math.max(...bars.map(b=>b.offsetTop))+LANE:10)+'px';
  el.innerHTML=`<input id="tlNew" data-lo="${lo}" data-hi="${hi}" data-person="${esc(pid)}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugList"
    aria-label="Neues Thema, mit # eine Abwesenheit oder ein To-do" placeholder="Titel des Themas, # für Abwesenheit oder To-do"><small>${esc(spanLabel(lo,hi))}, Esc bricht ab</small>`;
  track.appendChild(el);const inp=el.querySelector('input');let done=false;
  const finish=commit=>{if(done)return;const r=inlineParse(inp.value,pid,lo,hi);
    if(commit&&(r.ambiguous||(r.type==='todo'&&!r.title))&&document.activeElement===inp)return; // Enter: keep the field until it is fixed
    done=true;closeSuggest();
    if(!commit||r.ambiguous){el.remove();return}
    if(r.type==='absence'){const msg=addAbsence(r);render();toast(msg,true);return}
    if(r.type==='todo'&&r.title){newTodo(r);save();render();
      toast(`${kindLabel(r.kind,personOf(r.personId))} angelegt, fällig ${dueLabel(r.due)}`,true);return}
    if(r.type==='topic'&&r.title){S.topics.push(newEntry({personId:pid,title:r.title,start:ds(lo),end:ds(hi),status:lo<=TDN&&hi>=TDN?'aktiv':'geplant',note:''}));save();render();
      toast(`Thema angelegt: ${dmN(lo)} bis ${dmN(hi)}`,true);return}
    el.remove()};
  inp.addEventListener('keydown',ev=>{if(sug&&sug.input===inp)return; // the open suggestion list takes the keys (events.js)
    if(ev.key==='Enter'){ev.preventDefault();finish(true)}else if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();finish(false)}});
  inp.addEventListener('blur',()=>finish(true));
  setTimeout(()=>inp.focus(),0);
}
document.addEventListener('pointerdown',e=>{
  const pending=document.querySelector('.tl-new input');
  if(pending&&!e.target.closest('.tl-new')){pending.blur();suppressUntil=Date.now()+300;return}
  if(e.button!==0||e.target.closest('.mini-check,.tl-new,.abs-label,.wbar'))return;
  const chip=e.target.closest('.tchip,.tmark[data-todo]');
  if(!chip&&e.target.closest('.tmark'))return; // several todos: a click pins the list (events.js)
  if(chip){const t=S.todos.find(x=>x.id===chip.dataset.todo);if(!t)return;
    drag={type:'todo',t,el:chip,x0:e.clientX,y0:e.clientY,moved:false,snap:snapshot()};chip.setPointerCapture(e.pointerId);e.preventDefault();return}
  const bar=e.target.closest('.bar');
  if(bar){const t=S.topics.find(x=>x.id===bar.dataset.id);if(!t)return;const track=bar.parentElement;
    drag={type:'bar',t,el:bar,track,mode:e.target.classList.contains('h-l')?'l':e.target.classList.contains('h-r')?'r':'m',
      d0:dayAt(track,e.clientX),x0:e.clientX,s0:dn(t.start),e0:dn(t.end),moved:false,snap:snapshot()};
    bar.setPointerCapture(e.pointerId);e.preventDefault();return}
  const track=e.target.closest('.tl-track');
  if(track&&e.pointerType!=='touch'){drag={type:'create',track,x0:e.clientX,y0:e.clientY,d0:dayAt(track,e.clientX),moved:false};track.setPointerCapture(e.pointerId);e.preventDefault()}
});
document.addEventListener('pointermove',e=>{
  if(drag){
    const dx=e.clientX-drag.x0,dy=drag.type==='todo'?e.clientY-drag.y0:0;
    if(!drag.moved&&Math.hypot(dx,dy)<6)return;if(!drag.moved)hidePop();drag.moved=true;
    if(drag.type==='create'){const d=dayAt(drag.track,e.clientX);drag.d1=d;showGhost(drag.track,drag.d0,d,spanLabel(drag.d0,d),true);return}
    drag.el.classList.add('dragging');
    if(drag.type==='todo'){
      drag.el.style.transform=`translate(${dx}px,${dy}px)`;
      const under=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tl-track');
      if(drag.over&&drag.over!==under)hideGhost(drag.over);drag.over=under;
      if(under){const day=dayAt(under,e.clientX),p=personOf(under.dataset.person);showGhost(under,day,day,`${p.id==='me'?'Ich':firstName(p)}, ${WD[wdOf(day)]} ${dmN(day)}`);drag.day=day}
      return;
    }
    const k=dayAt(drag.track,e.clientX)-drag.d0;let s=drag.s0,en=drag.e0;
    if(drag.mode==='m'){s+=k;en+=k}else if(drag.mode==='l')s=Math.min(drag.s0+k,drag.e0);else en=Math.max(drag.e0+k,drag.s0);
    drag.t.start=ds(s);drag.t.end=ds(en);
    if(en>=T.start&&s<=T.end){const x=pos(drag.t.start,drag.t.end);drag.el.style.left=x.l+'px';drag.el.style.width=x.w+'px'}
    drag.el.querySelector('.bar-t').textContent=`${dm(drag.t.start)} bis ${dm(drag.t.end)}`;return;
  }
  const track=e.target.closest?.('.tl-track');
  if(hoverTrack&&hoverTrack!==track)hideGhost(hoverTrack);hoverTrack=track;
  if(track){if(e.target.closest('.bar,.wbar,.tchip,.tmark,.abs-label,.tl-new')||track.querySelector('.tl-new')){hideGhost(track);return}
    const day=dayAt(track,e.clientX);T.fine?showGhost(track,day,day,'Klick: Aufgabe, ziehen: Thema'):showGhost(track,day,Math.min(day+4,T.end),'Klick oder ziehen: Thema')}
});
document.addEventListener('pointerup',()=>{
  if(!drag)return;const d=drag;drag=null;
  if(d.type==='create'){if(d.moved){suppressUntil=Date.now()+300;inlineCreate(d.track,d.d0,d.d1??d.d0)}else hideGhost(d.track);return}
  suppressUntil=Date.now()+300;
  if(d.type==='todo'){
    if(!d.moved){openTodo(d.t.id);return}
    if(d.over&&d.day!=null){const pid=d.over.dataset.person,changedP=pid!==d.t.personId;d.t.due=ds(d.day);d.t.personId=pid;if(pid==='me')d.t.kind='team';setWith(d.t,withOf(d.t));save();render();
      const p=personOf(pid);toast(changedP?`An ${p.id==='me'?'mich':firstName(p)} übergeben, fällig ${WD[wdOf(d.day)]} ${dmN(d.day)}`:`Verschoben auf ${WD[wdOf(d.day)]} ${dmN(d.day)}`,true)}
    else render();
    return;
  }
  if(d.moved){save();render();toast(`${d.t.title}: ${dm(d.t.start)} bis ${dm(d.t.end)}`,true)}else openTopic(d.t.id);
});
document.addEventListener('pointercancel',()=>{if(!drag)return;const d=drag;drag=null;if(d.snap)S=JSON.parse(d.snap);render()});
/* Hover card of todo cards and markers (showPop()/hidePop() in timeline.js): hover with a short delay, keyboard focus, closes on leaving, outside click or scroll. */
let hoverTimer=0;
document.addEventListener('pointerover',e=>{if(e.pointerType==='touch'||drag)return;
  const m=e.target.closest?.('.tmark,.tchip');
  if(m){clearTimeout(hoverTimer);if(pop?.mark===m){clearTimeout(pop.timer);return}
    hoverTimer=setTimeout(()=>{if(!drag&&m.isConnected)showPop(m)},m.classList.contains('tchip')?HOVER_CHIP_MS:HOVER_MS);return}
  if(e.target.closest?.('#tlPop')){clearTimeout(pop?.timer);return}});
document.addEventListener('pointerout',e=>{if(e.pointerType==='touch')return;
  const from=e.target.closest?.('.tmark,.tchip,#tlPop');if(!from)return;const to=e.relatedTarget?.closest?.('.tmark,.tchip,#tlPop');if(to===from)return;
  clearTimeout(hoverTimer);if(to&&(to.id==='tlPop'||to===pop?.mark))return;hidePopSoon()});
document.addEventListener('focusin',e=>{const m=e.target.closest?.('.tmark,.tchip');if(m)showPop(m);
  else if(pop&&!e.target.closest?.('#tlPop'))hidePop()});
document.addEventListener('pointerdown',e=>{if(pop&&!e.target.closest('#tlPop')&&e.target.closest('.tmark,.tchip')!==pop.mark)hidePop()},true);
document.addEventListener('scroll',e=>{if(pop&&!e.target.closest?.('#tlPop'))hidePop()},true);
