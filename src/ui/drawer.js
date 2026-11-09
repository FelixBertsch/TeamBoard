/* Drawer with forms: side panel on desktop, bottom sheet on phone (CSS: .lay-phone .drawer). Same markup.
   cfg: title, body, submitLabel (missing: close button only), onSubmit, onDelete, deleteLabel, top (above the form, e.g. type picker in capture). */
let drawerCfg=null,lastFocus=null;
const KEEP_OPEN={}; // onSubmit returns this when it opened another form itself
const field=(label,control)=>`<label class="field"><span class="fl">${label}</span>${control}</label>`;
const group=(label,control)=>`<div class="field" role="group" aria-label="${label}"><span class="fl">${label}</span>${control}</div>`;
const radios=(name,opts,val)=>`<div class="tags">${opts.map(([v,l])=>`<label><input type="radio" name="${name}" value="${v}"${v===val?' checked':''}><span>${esc(l)}</span></label>`).join('')}</div>`;
/* Date field: text input in TT.MM.JJJJ plus a calendar button. Laptop and monitor: the button opens the own calendar (datepicker.js).
   Phone: the button holds a hidden native date input, whose picker iOS shows in the device language; events.js keeps both in sync.
   formValues() converts the text back to ISO. Pairs: link {to:'end'} on the start field, {from:'start'} on the end field; the start's
   calendar then picks the whole range, and an end before a newly set start follows it (events.js). */
const dateIn=(name,iso,link={})=>`<span class="date-in"><input name="${name}" value="${deDate(iso)}" data-date${link.to?` data-to="${link.to}"`:''}${link.from?` data-from="${link.from}"`:''} placeholder="TT.MM.JJJJ" autocomplete="off" spellcheck="false">`
  +(isPhone()?`<span class="date-pick" title="Kalender öffnen">${ic('calendar',18)}<input type="date" tabindex="-1" aria-hidden="true" value="${iso||''}"></span></span>`
    :`<button type="button" class="date-pick" data-action="date-pick" aria-label="Kalender öffnen" aria-haspopup="dialog" title="Kalender öffnen (Alt+Pfeil runter)">${ic('calendar',18)}</button></span>`);
function formValues(f){const v=Object.fromEntries(new FormData(f));let bad=null;
  for(const el of f.querySelectorAll('[data-date]')){const iso=parseDeDate(el.value);if(iso===null){bad=bad||el;v[el.name]=''}else v[el.name]=iso}
  return{v,bad}}
/* Responsible person: "Ich" and the current team. A person who left stays selectable on her own old entries. */
const personOptions=sel=>{const list=[ME,...team()];if(sel&&!list.some(p=>p.id===sel))list.push(personOf(sel));
  return list.map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${esc(p.id==='me'?'Ich':p.name+(p.archived?' (ausgeschieden)':''))}</option>`).join('')};
/* "Beteiligt" field: "@Name" tokens with the suggestion list (suggest.js), resolved on submit by parseWith(). */
const withText=t=>withOf(t).map(id=>'@'+mentionText(personOf(id))).join(' ');
const withField=t=>field('Beteiligt',`<input id="withIn" name="with" value="${esc(withText(t))}${withOf(t).length?' ':''}" autocomplete="off" spellcheck="false" placeholder="@Name, auch mehrere"
  role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugList">`)+'<p class="d-note">Nur zur Info, verantwortlich bleibt die Person oben. Kontakte außerhalb des Teams legst du in der Vorschlagsliste an.</p>';
function parseWith(text,t){
  const pool=[...new Map([...mentionable(),...withOf(t||{}).map(personOf)].map(p=>[p.id,p])).values()],ids=[],s=' '+(text||'')+' ';let i=0;
  for(;;){const mm=s.slice(i).match(/\s@(?=[^\s@#])/);if(!mm)break;const st=i+mm.index+2,m=matchPerson(s.slice(st),pool);
    if(m.ambiguous)return{err:ambiguousText(m)};if(!m.id)return{err:unknownText(m.unknown)};if(!ids.includes(m.id))ids.push(m.id);i=st+m.len}
  return{ids}}
function setWith(o,ids){const w=ids.filter(id=>id!==o.personId);if(w.length)o.with=w;else delete o.with}
function openDrawer(cfg){drawerCfg=cfg;const wasOpen=document.body.classList.contains('drawer-open');if(!wasOpen)lastFocus=document.activeElement;
  $('#drawer').innerHTML=`<form id="dform" novalidate><header class="d-head"><h3>${esc(cfg.title)}</h3><button type="button" class="icon-btn" data-action="close-drawer" aria-label="Schließen">${ic('x',20)}</button></header>
    <div class="d-body">${cfg.top||''}${cfg.body}<p class="d-err" role="alert"></p></div><footer class="d-foot">${cfg.onDelete?`<button type="button" class="btn danger sm" data-action="delete">${esc(cfg.deleteLabel||'Löschen')}</button>`:''}
    <span class="sp"></span>${cfg.submitLabel?`<button type="button" class="btn ghost" data-action="close-drawer">Abbrechen</button><button type="submit" class="btn primary">${esc(cfg.submitLabel)}</button>`
      :'<button type="button" class="btn secondary" data-action="close-drawer">Schließen</button>'}</footer></form>`;
  document.body.classList.add('drawer-open');
  // focus [autofocus] synchronously: iOS Safari only opens the keyboard inside the tap gesture
  const af=$('#drawer [autofocus]');if(af){af.focus({preventScroll:true});return}
  if(isPhone()){$('#drawer').focus({preventScroll:true});return}
  setTimeout(()=>$('#drawer input:not([type=radio]):not([type=checkbox]), #drawer select')?.focus(),60)}
function closeDrawer(restore=true){closeDp(false);if(!document.body.classList.contains('drawer-open'))return;document.body.classList.remove('drawer-open');drawerCfg=null;
  if(restore&&lastFocus&&document.contains(lastFocus))lastFocus.focus({preventScroll:true});
  else if($('#drawer').contains(document.activeElement))document.activeElement.blur()} // keys must not land in the hidden form
function openTopic(id,preset={}){
  const ex=id?S.topics.find(x=>x.id===id):null;
  const t=ex||{personId:preset.personId||'me',title:preset.title||'',start:preset.start||TODAY,end:preset.end||ds(TDN+4),status:'geplant',note:''};
  openDrawer({title:ex?'Thema bearbeiten':'Neues Thema',submitLabel:ex?'Speichern':'Thema anlegen',top:preset.top,
    body:field('Titel',`<input name="title" value="${esc(t.title)}" autocomplete="off" placeholder="z. B. Payment-API v2"${preset.top?' autofocus enterkeyhint="done"':''}>`)+field('Verantwortlich',`<select name="personId">${personOptions(t.personId)}</select>`)
      +withField(t)
      +`<div class="two">${field('Start',dateIn('start',t.start,{to:'end'}))}${field('Ende',dateIn('end',t.end,{from:'start'}))}</div>`
      +group('Status',radios('status',[['geplant','Geplant'],['aktiv','Aktiv'],['erledigt','Erledigt']],t.status))
      +group('Fokus',radios('focus',[['main','Hauptthema'],['side','Nebenthema']],t.side?'side':'main'))
      +'<p class="d-note side-note">Bei Nebenthemen meldet „Zu klären“ keine Abwesenheiten.</p>'
      +`<div class="topic-done">${field('Erledigt am',dateIn('doneAt',t.doneAt||(t.status==='erledigt'?'':TODAY)))}</div>`
      +field('Notiz',`<textarea name="note" rows="4" placeholder="Kontext, Abhängigkeiten, Ansprechpartner">${esc(t.note)}</textarea>`),
    onSubmit:v=>{let{title,personId,start,end,status,note}=v;title=(title||'').trim();if(!title)return'Bitte gib einen Titel ein.';if(!start||!end)return'Bitte setze Start und Ende.';if(end<start)[start,end]=[end,start];
      const w=parseWith(v.with,ex);if(w.err)return w.err;
      const was=ex?.status==='erledigt',doneAt=status!=='erledigt'?null:v.doneAt||(was?ex.doneAt:TODAY);
      const o=ex||newEntry({});Object.assign(o,{title,personId,start,end,status,note});setWith(o,w.ids);if(v.focus==='side')o.side=true;else delete o.side;if(doneAt)o.doneAt=doneAt;else delete o.doneAt;
      if(!ex)S.topics.push(o);save();toast(ex?'Thema gespeichert':'Thema angelegt',true)},
    onDelete:ex?()=>{S.topics=S.topics.filter(x=>x.id!==id);save();toast('Thema gelöscht',true)}:null});
}
function openAbsence(id,preset={}){
  const ex=id?S.absences.find(x=>x.id===id):null;
  const a=ex||{personId:preset.personId||'me',kind:preset.kind||'Urlaub',start:preset.start||TODAY,end:preset.end||preset.start||TODAY,note:preset.note||''};
  openDrawer({title:ex?'Abwesenheit bearbeiten':'Abwesenheit eintragen',submitLabel:ex?'Speichern':'Eintragen',top:preset.top,
    body:field('Person',`<select name="personId">${personOptions(a.personId)}</select>`)+group('Art',radios('kind',[['Urlaub','Urlaub'],['Krank','Krank'],['Schulung','Schulung'],['Sonstiges','Abwesend']],a.kind))
      +`<div class="two">${field('Von',dateIn('start',a.start,{to:'end'}))}${field('Bis',dateIn('end',a.end,{from:'start'}))}</div>`
      +`<div class="abs-note">${field('Notiz',`<input name="note" value="${esc(a.note)}" autocomplete="off" placeholder="z. B. Vertretung durch Lena">`)}</div>`
      +`<p class="d-note abs-sick">Bei Krankheit speichert das Teamboard keine Details. ${CFG.sickVisibleDays} Tage nach dem Ende steht dort nur noch „Abwesend“.</p>`,
    onSubmit:v=>{let{personId,kind,start,end}=v;if(!start||!end)return'Bitte setze Von und Bis.';if(end<start)[start,end]=[end,start];
      const note=kind==='Krank'?'':(v.note||'').trim(),data={personId,kind,start,end,...(note?{note}:{})};
      if(ex){Object.assign(ex,data);if(!note)delete ex.note}else S.absences.push(newEntry(data));save();toast(ex?'Abwesenheit gespeichert':'Abwesenheit eingetragen',true)},
    onDelete:ex?()=>{S.absences=S.absences.filter(x=>x.id!==id);save();toast('Abwesenheit gelöscht',true)}:null});
}
/* Project assignment: person on a project from start to end (empty = open), billable or internal. */
function openAssignment(id,preset={}){
  const ex=id?S.assignments.find(x=>x.id===id):null;
  const a=ex||{personId:preset.personId||'me',project:'',start:TODAY,end:null,billable:true,note:''};
  openDrawer({title:ex?'Projekt bearbeiten':'Projekt zuordnen',submitLabel:ex?'Speichern':'Zuordnen',assignment:ex?'edit':'new',
    body:field('Projekt',`<input name="project" value="${esc(a.project)}" list="projNames" autocomplete="off" placeholder="Kunde, z. B. Kranich Versicherung"><datalist id="projNames">${projectNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`)
      +field('Person',`<select name="personId">${personOptions(a.personId)}</select>`)
      +`<div class="two">${field('Start',dateIn('start',a.start,{to:'end'}))}${field('Ende',dateIn('end',a.end,{from:'start'}))}</div>`
      +'<p class="d-note">Ohne Ende läuft das Projekt, bis du eins einträgst.</p>'
      +group('Fakturierbar',radios('billable',[['ja','Ja'],['nein','Nein, intern']],a.billable?'ja':'nein'))
      +field('Notiz',`<textarea name="note" rows="3" placeholder="Rolle im Projekt, Ansprechpartner">${esc(a.note)}</textarea>`),
    onSubmit:v=>{const project=(v.project||'').trim();if(!project)return'Bitte gib ein Projekt ein.';if(!v.start)return'Bitte setze den Start.';
      let start=v.start,end=v.end||null;if(end&&end<start)[start,end]=[end,start];
      const data={personId:v.personId,project,start,end,billable:v.billable!=='nein',note:v.note||''};
      if(ex)Object.assign(ex,data);else S.assignments.push(newEntry(data));save();
      toast(ex?'Projekt gespeichert':`${project} für ${data.personId==='me'?'dich':firstName(personOf(data.personId))} eingetragen`,true)},
    onDelete:ex?()=>{S.assignments=S.assignments.filter(x=>x.id!==id);save();toast('Projektzuordnung gelöscht',true)}:null});
}
function openTalk(id){
  const t=S.talks.find(x=>x.id===id);if(!t)return;
  openDrawer({title:'Gesprächspunkt',submitLabel:'Speichern',
    body:field('Punkt',`<input name="text" value="${esc(t.text)}" autocomplete="off">`)
      +`<div class="done-g"><label class="cb"><input type="checkbox" name="done"${t.done?' checked':''}> Besprochen</label>${field('Besprochen am',dateIn('doneAt',t.doneAt||(t.done?'':TODAY)))}</div>`,
    onSubmit:v=>{const text=(v.text||'').trim();if(!text)return'Bitte gib einen Punkt ein.';const was=t.done;
      t.text=text;t.done=!!v.done;const d=t.done?v.doneAt||(was?t.doneAt:TODAY):null;if(d)t.doneAt=d;else delete t.doneAt;save();toast('Punkt gespeichert',true)},
    onDelete:()=>{S.talks=S.talks.filter(x=>x.id!==id);save();toast('Punkt gelöscht',true)}});
}
function openTodo(id,preset={}){
  const ex=id?S.todos.find(x=>x.id===id):null;
  const t=ex||{title:'',personId:preset.personId||'me',kind:'team',due:preset.due||null,note:'',done:false};
  openDrawer({title:ex?'Aufgabe bearbeiten':'Neue Aufgabe',submitLabel:ex?'Speichern':'Aufgabe anlegen',
    body:field('Titel',`<input name="title" value="${esc(t.title)}" autocomplete="off">`)+field('Verantwortlich',`<select name="personId">${personOptions(t.personId)}</select>`)
      +group('Art',radios('kind',[['team','Aufgabe der Person'],['mine','Mein To-do'],['waiting','Wartet auf']],t.kind))
      +`<p class="d-note">Bei „Ich“ als Person zählt es immer als eigene Aufgabe.</p>`
      +withField(t)
      +field('Fällig',dateIn('due',t.due))
      +group('Wiederholen',radios('repeat',REPEATS,t.repeat||''))
      +'<p class="d-note rep-note">Hakst du die Aufgabe ab, legt das Teamboard die nächste an. Fällt ein Termin auf ein Wochenende oder einen Feiertag, rückt er auf den Arbeitstag davor.</p>'
      +field('Notiz',`<textarea name="note" rows="4">${esc(t.note)}</textarea>`)
      +(ex?`<div class="done-g"><label class="cb"><input type="checkbox" name="done"${t.done?' checked':''}> Erledigt</label>${field('Erledigt am',dateIn('doneAt',t.doneAt||(t.done?'':TODAY)))}</div>`:''),
    onSubmit:v=>{const title=(v.title||'').trim();if(!title)return'Bitte gib einen Titel ein.';
      const w=parseWith(v.with,ex);if(w.err)return w.err;
      const repeat=v.repeat||'',due=v.due||null;if(repeat&&!due)return'Für eine Wiederholung braucht die Aufgabe eine Frist.';
      const kind=v.personId==='me'?'team':v.kind;
      if(!ex){const n=newTodo({title,personId:v.personId,kind,due,note:v.note||'',with:w.ids,repeat});save();toast(`${kindLabel(n.kind,personOf(n.personId))} angelegt`,true);return}
      const was=ex.done;Object.assign(ex,{title,personId:v.personId,kind,due,note:v.note||''});setWith(ex,w.ids);
      if(!repeat){delete ex.repeat;delete ex.anchor}
      else if(repeat!==ex.repeat){Object.assign(ex,{repeat,series:ex.series||uid(),anchor:due})} // a new rhythm starts at this due date
      let next=null;
      if(v.done&&!was)next=completeTodo(ex,v.doneAt||TODAY);else if(!v.done&&was)reopenTodo(ex);else if(v.done)ex.doneAt=v.doneAt||ex.doneAt||TODAY;
      save();toast(next?`Erledigt. Nächste fällig ${dueLabel(next.due)}`:'Aufgabe gespeichert',true)},
    onDelete:ex?()=>{S.todos=S.todos.filter(x=>x.id!==id);save();toast(ex.repeat&&!ex.done?'Aufgabe gelöscht, die Wiederholung endet':'Aufgabe gelöscht',true)}:null});
}
/* Team member. "Entfernen" archives the person (`archived` = date): she leaves the team views, but her topics, todos,
   absences and projects stay for the history and the yearly review. Running assignments end today, planned ones go. */
function openPerson(id){
  const ex=id?S.people.find(p=>p.id===id):null;
  let info='';
  if(ex&&!ex.archived){const f=firstName(ex),nt=S.todos.filter(t=>!t.done&&t.personId===id&&t.kind==='team').length,np=S.topics.filter(t=>t.personId===id&&t.status!=='erledigt').length;
    const open=[nt?(nt===1?'eine Aufgabe':nt+' Aufgaben'):'',np?(np===1?'ein Thema':np+' Themen'):''].filter(Boolean).join(' und ');
    info=`<p class="d-note">„Entfernen“ nimmt ${esc(f)} aus dem Team. Themen, Aufgaben, Urlaube und Projekte bleiben im Verlauf und im Rückblick.${open?` Offen sind noch ${open}; gib sie vorher jemand anderem, wenn sie weiterlaufen.`:''}</p>`}
  openDrawer({title:ex?'Mitarbeiter bearbeiten':'Mitarbeiter hinzufügen',submitLabel:ex?'Speichern':'Hinzufügen',deleteLabel:'Entfernen',
    body:field('Name',`<input name="name" value="${esc(ex?.name)}" autocomplete="off" placeholder="Vor- und Nachname">`)
      +field('Team',`<input name="team" value="${esc(ex?.team)}" list="teamNames" autocomplete="off" placeholder="z. B. BT Management"><datalist id="teamNames">${teamNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`)+info,
    onSubmit:v=>{const name=(v.name||'').trim(),tm=(v.team||'').trim();if(!name)return'Bitte gib einen Namen ein.';
      if(ex){ex.name=name;ex.team=tm;save();toast('Gespeichert',true)}
      else{const p=newEntry({id:'p'+uid(),name,team:tm});S.people.push(p);save();location.hash='ma-'+p.id;toast(`${firstName(p)} hinzugefügt`,true)}},
    onDelete:ex&&!ex.archived?()=>{archivePerson(ex);save();location.hash='uebersicht';toast(`${ex.name} entfernt. Die Einträge bleiben im Verlauf.`,true)}:null});
}
function archivePerson(p){p.archived=TODAY;
  S.assignments=S.assignments.filter(a=>a.personId!==p.id||a.start<=TODAY);
  for(const a of S.assignments)if(a.personId===p.id&&(!a.end||a.end>TODAY))a.end=TODAY}

/* Contacts: people outside the team (boss, colleagues). They have no row, page or absences; "@" mentions them in topics and
   todos, and "Meine Planung" filters by them. "Entfernen" archives, so old mentions keep their name. */
function openContacts(){
  const list=S.contacts.filter(k=>!k.archived).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  const open=id=>S.todos.filter(t=>!t.done&&withOf(t).includes(id)).length;
  openDrawer({title:'Kontakte',submitLabel:'Hinzufügen',
    body:'<p class="d-note" style="margin-top:0">Personen außerhalb deines Teams, zum Beispiel deine Führungskraft. Du erwähnst sie mit @ in Aufgaben und Themen und filterst in „Meine Planung“ danach.</p>'
      +`<div class="more-list">${list.map(k=>{const n=open(k.id);return`<button type="button" class="prow" data-action="edit-contact" data-id="${k.id}">${avatar(k,'xs')}<span class="pt">${esc(k.name)}</span><span class="pd">${n?(n===1?'1 offen':n+' offen'):''}</span></button>`}).join('')
        ||'<p class="empty">Noch keine Kontakte. Gib unten einen Namen ein oder tippe @Name in einer Aufgabe.</p>'}</div>`
      +field('Neuer Kontakt',`<input name="name" autocomplete="off" placeholder="Vor- und Nachname">`),
    onSubmit:v=>{const name=(v.name||'').trim();if(!name)return'Bitte gib einen Namen ein.';
      if(mentionable().some(p=>fold(p.name)===fold(name)))return`${name} gibt es schon.`;
      S.contacts.push(newEntry({id:'k'+uid(),name}));save();openContacts();toast(`${name} als Kontakt angelegt`,true);return KEEP_OPEN}});
}
function openContact(id){
  const k=S.contacts.find(x=>x.id===id);if(!k)return;
  openDrawer({title:'Kontakt bearbeiten',submitLabel:'Speichern',deleteLabel:'Entfernen',
    body:field('Name',`<input name="name" value="${esc(k.name)}" autocomplete="off">`)
      +'<p class="d-note">„Entfernen“ nimmt den Kontakt aus der Vorschlagsliste. Aufgaben und Themen, in denen er erwähnt ist, behalten den Namen.</p>',
    onSubmit:v=>{const name=(v.name||'').trim();if(!name)return'Bitte gib einen Namen ein.';k.name=name;save();openContacts();toast('Gespeichert',true);return KEEP_OPEN},
    onDelete:()=>{k.archived=TODAY;save();openContacts();toast(`${k.name} entfernt`,true)}});
}

/* "Mehr": sync status, backups, connection, add person, contacts. Reached from the phone tab bar and the laptop icon bar. */
function openMore(){
  const row=(act,icon,label)=>`<button type="button" class="prow" data-action="${act}">${ic(icon,18)}<span class="pt">${label}</span></button>`;
  const rows=`<button type="button" class="prow" data-action="go" data-v="verlauf">${ic('history',18)}<span class="pt">Verlauf</span></button>`
    +row('new-person','userPlus','Person hinzufügen')+row('contacts','contact','Kontakte')+storageActions().map(a=>row(...a)).join('');
  openDrawer({title:'Mehr',body:`<div class="more-sync">${syncHTML(true).replace(' id="syncState"','')}</div><div class="more-list">${rows}</div>
    ${isPhone()?'':`<div class="more-keys">${keysHTML()}</div>`}`});
}
