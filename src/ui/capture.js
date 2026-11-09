/* Capture sheet (phone "+"): one sheet for todo, talking point, absence and topic. The type picker sits in the sheet's head and
   only the form below it changes: the title stays "Neu erfassen", the sheet keeps its height (CSS: .drawer.capSheet), people are
   chips in every type, and what was typed survives a switch (`capSheet`). Todos run through parseQuick(): "@Name" and "bis Fr" in
   the text win over the chips; "#krank", "#urlaub" etc. switch to the absence type, prefilled. On a person page the person is
   preselected (ctx()). Editing an existing entry still opens the full forms in drawer.js. */
const CAP_TYPES=[['todo','Aufgabe'],['talk','Punkt'],['absence','Abwesend'],['topic','Thema']];
let capSheet=null; // open sheet: {type, text, pid, todo:{…}, absence:{…}, topic:{…}} (last values per type); reset by "+"
function dueChoices(){
  const out=[['','Ohne'],[TODAY,'Heute'],[ds(TDN+1),'Morgen']],add=d=>{if(d>TDN+1&&!out.some(o=>o[0]===ds(d)))out.push([ds(d),`${WD[wdOf(d)]} ${dmN(d)}`])};
  add(mondayOf(TDN)+7);let fr=mondayOf(TDN)+4;if(fr<=TDN+1)fr+=7;add(fr);
  return[out[0],...out.slice(1).sort((a,b)=>a[0].localeCompare(b[0]))];
}
/* Absence: start chips (today, tomorrow, next Monday), end chips ("Gleicher Tag", this and next Friday); each with "Anderes Datum". */
function fromChoices(){const out=[[TODAY,'Heute'],[ds(TDN+1),'Morgen']],m=mondayOf(TDN)+7;if(m>TDN+1)out.push([ds(m),`Mo ${dmN(m)}`]);return out}
function toChoices(){const out=[['','Gleicher Tag']];let fr=mondayOf(TDN)+4;if(fr<TDN)fr+=7;
  for(const d of[fr,fr+7])out.push([ds(d),`${WD[wdOf(d)]} ${dmN(d)}`]);return out}
const chipVal=(choices,iso)=>choices.some(c=>c[0]===iso)?iso:null;
/* Values of the open form go into `capSheet`, so switching the type and back keeps them. */
function capKeep(){const f=$('#dform');if(!f||!capSheet?.type)return;const{v}=formValues(f);
  const tx=capSheet.type==='talk'?v.text:capSheet.type==='absence'?null:v.title;if(tx!=null)capSheet.text=tx;
  if(v.pid)capSheet.pid=v.pid;capSheet[capSheet.type]=v}
function openCapture(type='todo',keep=null,preset={}){
  if(!capSheet)capSheet={text:'',pid:ctx().personId};else capKeep();
  if(keep!=null)capSheet.text=keep;capSheet.type=type;
  const c=ctx(),tm=team(),people=[['me','Ich'],...tm.map(p=>[p.id,firstName(p)])],pid=isActive(capSheet.pid)?capSheet.pid:'me',text=esc(capSheet.text||'');
  const head=`<div class="seg cap-seg" role="tablist" aria-label="Was erfassen">${CAP_TYPES.map(([v,l])=>`<button type="button" class="seg-b" role="tab" data-action="cap-type" data-v="${v}" aria-selected="${v===type}">${l}</button>`).join('')}</div>`;
  const base={title:'Neu erfassen',head,capture:type};
  if(type==='absence'){
    const last=capSheet.absence||{},a={pid:preset.personId||last.pid||pid,kind:preset.kind||last.kind||'Urlaub',start:preset.start||last.start||last.startDate||TODAY,
      end:preset.end||last.end||last.endDate||'',note:preset.note??last.note??'',half:preset.half||last.half||''};
    const fc=fromChoices(),tc=toChoices(),sv=chipVal(fc,a.start),ev=a.end&&a.end!==a.start?chipVal(tc,a.end):''; // null: not a chip, the date field holds it
    openDrawer({...base,submitLabel:'Eintragen',
      body:group('Wer',radios('pid',people,a.pid))
        +group('Art',radios('kind',[['Urlaub','Urlaub'],['Krank','Krank'],['Schulung','Schulung'],['Sonstiges','Abwesend']],a.kind))
        +`<div class="cap-date">${group('Von',radios('start',fc,sv))+field('Anderes Datum',dateIn('startDate',sv==null?a.start:''))}</div>`
        +`<div class="cap-date">${group('Bis',radios('end',tc,ev))+field('Anderes Datum',dateIn('endDate',ev==null?a.end:''))}</div>`
        +halfGroup(a.half,!a.end||a.end===a.start)
        +`<div class="abs-note">${field('Notiz',`<input name="note" value="${esc(a.note)}" autocomplete="off" placeholder="z. B. Vertretung durch Lena">`)}</div>`
        +`<p class="d-note abs-sick">Bei Krankheit speichert das Teamboard keine Details. ${CFG.sickVisibleDays} Tage nach dem Ende steht dort nur noch „Abwesend“.</p>`
        +'<p class="qprev" id="capPrev" aria-live="polite"></p>',
      onSubmit:v=>{const r=capAbsence(v);if(r.err)return r.err;
        const note=r.kind==='Krank'?'':(v.note||'').trim();toast(addAbsence({personId:r.personId,absKind:r.kind,start:r.start,end:r.end,half:r.half,...(note?{note}:{})}),true)}});
    capPreview();return;
  }
  if(type==='topic'){
    const last=capSheet.topic||{},t={pid:last.pid||pid,start:last.start||TODAY,end:last.end||ds(TDN+4),status:last.status||'geplant',focus:last.focus||'main',note:last.note||'',with:last.with||''};
    openDrawer({...base,submitLabel:'Thema anlegen',
      body:field('Titel',`<input name="title" value="${text}" autocomplete="off" enterkeyhint="done" autofocus placeholder="z. B. Payment-API v2">`)
        +group('Verantwortlich',radios('pid',people,t.pid))
        +`<div class="two">${field('Start',dateIn('start',t.start,{to:'end'}))}${field('Ende',dateIn('end',t.end,{from:'start'}))}</div>`
        +`<details class="cap-more"><summary>${ic('chevR',18,2.5)}Weitere Angaben</summary>`
        +field('Beteiligt',`<input id="withIn" name="with" value="${esc(t.with)}" autocomplete="off" spellcheck="false" placeholder="@Name, auch mehrere" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugList">`)
        +group('Status',radios('status',[['geplant','Geplant'],['aktiv','Aktiv'],['erledigt','Erledigt']],t.status))
        +group('Fokus',radios('focus',[['main','Hauptthema'],['side','Nebenthema']],t.focus))
        +'<p class="d-note side-note">Bei Nebenthemen meldet „Zu klären“ keine Abwesenheiten.</p>'
        +field('Notiz',`<textarea name="note" rows="3" placeholder="Kontext, Abhängigkeiten, Ansprechpartner">${esc(t.note)}</textarea>`)+'</details>',
      onSubmit:v=>{const title=(v.title||'').trim();if(!title)return'Bitte gib einen Titel ein.';if(!v.start||!v.end)return'Bitte setze Start und Ende.';
        let{start,end}=v;if(end<start)[start,end]=[end,start];const w=parseWith(v.with,null);if(w.err)return w.err;
        const o=newEntry({personId:v.pid||'me',title,start,end,status:v.status||'geplant',note:v.note||''});setWith(o,w.ids);if(v.focus==='side')o.side=true;
        if(o.status==='erledigt')o.doneAt=TODAY;S.topics.push(o);save();toast('Thema angelegt',true)}});
    return;
  }
  if(type==='talk'){
    const tp=pid!=='me'&&tm.some(p=>p.id===pid)?pid:tm[0]?.id;
    openDrawer({...base,submitLabel:'Notieren',
      body:tm.length?field('Punkt',`<input id="capText" name="text" value="${text}" autocomplete="off" enterkeyhint="done" autofocus placeholder="z. B. Feedback zur Präsentation">`)
        +group('Mit',radios('pid',tm.map(p=>[p.id,firstName(p)]),tp)):'<p class="empty">Gesprächspunkte notierst du zu Teammitgliedern. Leg zuerst unter „Mehr“ eine Person an.</p>',
      onSubmit:v=>{const t=(v.text||'').trim();if(!t)return'Bitte gib einen Punkt ein.';if(!v.pid)return'Bitte wähle eine Person.';
        S.talks.push(newEntry({personId:v.pid,text:t,done:false}));save();toast(`Punkt für ${firstName(personOf(v.pid))} notiert`,true)}});
    return;
  }
  const last=capSheet.todo||{};
  openDrawer({...base,submitLabel:'Aufgabe anlegen',
    body:field('Aufgabe',`<input id="capText" name="title" value="${text}" autocomplete="off" enterkeyhint="done" autofocus placeholder="z. B. Review Payment-API" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugList">`)
      +group('Für',radios('pid',people,pid))
      +`<div class="kind-g">${group('Art',radios('kind',[['team','Aufgabe der Person'],['mine','Mein To-do'],['waiting','Wartet auf']],last.kind||c.kind))}</div>`
      +`<div class="due-g cap-date">${group('Fällig',radios('due',dueChoices(),last.dueDate?null:last.due||''))+field('Anderes Datum',dateIn('dueDate',last.dueDate||''))}</div>`
      +'<p class="qprev" id="capPrev" aria-live="polite"></p>',
    onSubmit:v=>{const r=parseQuick(v.title||'',{personId:v.pid||'me',kind:v.kind||'team'});if(r.ambiguous)return ambiguousText(r);if(r.err)return r.err;
      if(r.type==='absence'){capSheet.text='';capSheet.absence=null;openCapture('absence','',{personId:r.personId,kind:r.absKind,start:r.start,end:r.end,note:r.note,half:r.half});capSheet.text='';return KEEP_OPEN}
      if(!r.title)return'Bitte gib einen Titel ein.';
      const n=newTodo({...r,due:r.due||v.dueDate||v.due||null});save();
      toast(`${kindLabel(n.kind,personOf(n.personId))} angelegt`,true)}});
  capPreview();
}
/* Absence from the sheet's values: a chip or "Anderes Datum" for start and end; no end means one day. */
function capAbsence(v){const start=v.startDate||v.start||'';let end=v.endDate||v.end||start;
  if(!start)return{err:'Bitte wähle, ab wann.'};
  if(end<start)return{err:'Das Ende liegt vor dem Beginn. Bitte wähle ein späteres Ende.'};
  return{personId:v.pid||'me',kind:v.kind||'Urlaub',start,end,half:start===end&&HALF[v.half]?v.half:null}}
function capPreview(){
  const f=$('#dform'),el=$('#capPrev');if(!f||!el)return;const{v}=formValues(f);
  if(capSheet?.type==='absence'){const r=capAbsence(v),g=f.querySelector('.half-g');if(g)g.hidden=!!(r.start&&r.end!==r.start);
    el.innerHTML=r.err?`<span class="warn">${esc(r.err)}</span>`:absPreview({personId:r.personId,absKind:r.kind,start:r.start,end:r.end,half:r.half});return}
  const r=parseQuick(v.title||'',{personId:v.pid||'me',kind:v.kind||'team'}),due=r.due||v.dueDate||v.due||(r.repeat?TODAY:null);
  f.dataset.me=r.personId==='me'?'1':'0';f.dataset.abs=r.type==='absence'?'1':'0';
  const sb=f.querySelector('button[type=submit]');if(sb)sb.textContent=r.type==='absence'?'Weiter':'Aufgabe anlegen';
  const unk=r.unknown?`<span class="warn">${esc(unknownText(r.unknown))}</span>`:'';
  if(r.ambiguous){el.innerHTML=`<span class="warn">${esc(ambiguousText(r))}</span>`;return}
  if(r.err){el.innerHTML=`<span class="warn">${esc(r.err)}</span>`;return}
  if(r.type==='absence'){el.innerHTML=absPreview(r)+unk+'<span class="enter">Weiter zu „Abwesend“</span>';return}
  el.innerHTML=todoPreview(r,due)+unk;
}
