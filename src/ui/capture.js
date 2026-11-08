/* Capture sheet (phone "+"): type picker for todo, talking point, absence, topic. Todos run through parseQuick(): "@Name" and
   "bis Fr" in the text win over the chips. "#krank", "#urlaub" etc. switch to the absence form, prefilled.
   On a person page the person is preselected (ctx()). */
const CAP_TYPES=[['todo','Aufgabe'],['talk','Punkt'],['absence','Abwesend'],['topic','Thema']];
function dueChoices(){
  const out=[['','Ohne'],[TODAY,'Heute'],[ds(TDN+1),'Morgen']],add=d=>{if(d>TDN+1&&!out.some(o=>o[0]===ds(d)))out.push([ds(d),`${WD[wdOf(d)]} ${dmN(d)}`])};
  add(mondayOf(TDN)+7);let fr=mondayOf(TDN)+4;if(fr<=TDN+1)fr+=7;add(fr);
  return[out[0],...out.slice(1).sort((a,b)=>a[0].localeCompare(b[0]))];
}
function openCapture(type='todo',keep='',preset={}){
  const c=ctx(),pid=c.personId;
  const top=`<div class="seg" role="tablist" aria-label="Was erfassen">${CAP_TYPES.map(([v,l])=>`<button type="button" class="seg-b" role="tab" data-action="cap-type" data-v="${v}" aria-selected="${v===type}">${l}</button>`).join('')}</div>`;
  if(type==='absence')return openAbsence(null,{personId:pid,...preset,top});
  if(type==='topic')return openTopic(null,{personId:pid,top,title:keep});
  if(type==='talk'){
    const tm=team(),tp=pid!=='me'&&tm.some(p=>p.id===pid)?pid:tm[0]?.id;
    openDrawer({title:'Gesprächspunkt notieren',submitLabel:'Notieren',top,capture:'talk',
      body:tm.length?field('Punkt',`<input id="capText" name="text" value="${esc(keep)}" autocomplete="off" enterkeyhint="done" autofocus placeholder="z. B. Feedback zur Präsentation">`)
        +group('Mit',radios('pid',tm.map(p=>[p.id,firstName(p)]),tp)):'<p class="empty">Gesprächspunkte notierst du zu Teammitgliedern. Leg zuerst unter „Mehr“ eine Person an.</p>',
      onSubmit:v=>{const text=(v.text||'').trim();if(!text)return'Bitte gib einen Punkt ein.';if(!v.pid)return'Bitte wähle eine Person.';
        S.talks.push(newEntry({personId:v.pid,text,done:false}));save();toast(`Punkt für ${firstName(personOf(v.pid))} notiert`,true)}});
    return;
  }
  openDrawer({title:'Neue Aufgabe',submitLabel:'Aufgabe anlegen',top,capture:'todo',
    body:field('Aufgabe',`<input id="capText" name="title" value="${esc(keep)}" autocomplete="off" enterkeyhint="done" autofocus placeholder="z. B. Review Payment-API" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugList">`)
      +group('Für',radios('pid',[['me','Ich'],...team().map(p=>[p.id,firstName(p)])],isActive(pid)?pid:'me'))
      +`<div class="kind-g">${group('Art',radios('kind',[['team','Aufgabe der Person'],['mine','Mein To-do'],['waiting','Wartet auf']],c.kind))}</div>`
      +`<div class="due-g">${group('Fällig',radios('due',dueChoices(),''))+field('Anderes Datum',dateIn('dueDate',''))}</div>`
      +'<p class="qprev" id="capPrev" aria-live="polite"></p>',
    onSubmit:v=>{const r=parseQuick(v.title||'',{personId:v.pid||'me',kind:v.kind||'team'});if(r.ambiguous)return ambiguousText(r);
      if(r.type==='absence'){openCapture('absence','',{personId:r.personId,kind:r.absKind,start:r.start,end:r.end,note:r.note});return KEEP_OPEN}
      if(!r.title)return'Bitte gib einen Titel ein.';
      const n=newTodo({...r,due:r.due||v.dueDate||v.due||null});save();
      toast(`${kindLabel(n.kind,personOf(n.personId))} angelegt`,true)}});
  capPreview();
}
function capPreview(){
  const f=$('#dform'),el=$('#capPrev');if(!f||!el)return;const{v}=formValues(f);
  const r=parseQuick(v.title||'',{personId:v.pid||'me',kind:v.kind||'team'}),due=r.due||v.dueDate||v.due||(r.repeat?TODAY:null);
  f.dataset.me=r.personId==='me'?'1':'0';f.dataset.abs=r.type==='absence'?'1':'0';
  const sb=f.querySelector('button[type=submit]');if(sb)sb.textContent=r.type==='absence'?'Weiter':'Aufgabe anlegen';
  const unk=r.unknown?`<span class="warn">${esc(unknownText(r.unknown))}</span>`:'';
  if(r.ambiguous){el.innerHTML=`<span class="warn">${esc(ambiguousText(r))}</span>`;return}
  if(r.type==='absence'){el.innerHTML=absPreview(r)+unk+'<span class="enter">Weiter zum Eintragen</span>';return}
  el.innerHTML=todoPreview(r,due)+unk;
}
