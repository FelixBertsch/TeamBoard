/* Data model, demo data, undo stack, UI state, person helpers and routing. */

const ME={id:'me',name:'Ich',team:''};
function demo(){
  const m=mondayOf(TDN),d=k=>ds(m+k);
  const t=k=>{if(k<=0){let n=TDN+k;while(wdOf(n)===0||wdOf(n)===6)n--;return ds(n)}let n=TDN,c=0;while(c<k){n++;if(wdOf(n)!==0&&wdOf(n)!==6)c++}return ds(n)}; // working days from today
  const people=[{id:'lena',name:'Lena Hoffmann',team:'Plattform'},{id:'jonas',name:'Jonas Weber',team:'Kundenportal'},
    {id:'aylin',name:'Aylin Demir',team:'Plattform'},{id:'tobias',name:'Tobias Krüger',team:'Kundenportal'},
    {id:'mira',name:'Mira Schulz',team:'Qualität'}];
  const contacts=[{id:'kmark',name:'Mark Becker'},{id:'kthomas',name:'Thomas Wagner'}];
  const tp=(personId,title,s,e,status,note='')=>({id:uid(),personId,title,start:d(s),end:d(e),status,note});
  const topics=[tp('me','Budget 2027 abstimmen',-14,-3,'erledigt'),tp('me','Quartalsplanung Q1',-7,11,'aktiv'),
    tp('me','Recruiting Senior Backend',7,32,'geplant'),
    {...tp('lena','Payment-API v2',-14,11,'aktiv','Go-live mit Partnerbank geplant, Lasttests durch Mira vorher.'),with:['mira']},
    tp('lena','Migration auf PostgreSQL 17',14,39,'geplant'),tp('jonas','Redesign Kundenportal',-7,4,'aktiv'),
    tp('jonas','Barrierefreiheit Formulare',10,30,'geplant'),tp('aylin','Kubernetes-Upgrade Produktion',-3,9,'aktiv'),
    tp('aylin','Monitoring mit Grafana',14,30,'geplant'),tp('tobias','Rechnungsexport DATEV',-10,2,'aktiv'),
    tp('tobias','Mandantenfähigkeit',7,35,'geplant'),tp('mira','Testautomatisierung Checkout',-14,1,'erledigt'),
    tp('mira','Lasttests Payment-API',9,20,'geplant')];
  const ab=(personId,kind,s,e)=>({id:uid(),personId,kind,start:d(s),end:d(e)});
  const absences=[ab('mira','Urlaub',2,8),ab('jonas','Urlaub',7,11),ab('aylin','Schulung',16,17),ab('tobias','Krank',TDN-m,TDN-m+1),
    ab('lena','Urlaub',-35,-31),ab('aylin','Schulung',-21,-20)];
  const td=(personId,kind,title,k,done=false)=>({id:uid(),personId,kind,title,due:k===null?null:t(k),done,note:''});
  const dd=(personId,kind,title,due,doneAgo)=>({...td(personId,kind,title,due,true),doneAt:ds(TDN-doneAgo)}); // completed todo
  const todos=[
    td('me','team','Bewerbungen sichten',0),td('me','team','Reporting an die Geschäftsführung',4),
    td('me','team','Zielvereinbarungen 2027 entwerfen',7),td('me','team','Teamevent im Dezember planen',null),
    td('me','team','1:1 mit Lena',1),td('me','team','Budget-Freigabe Cloud',2),
    td('lena','team','Code-Review Auth-Modul',-1),td('lena','team','API-Doku für Partner aktualisieren',5),
    td('lena','team','Rate-Limiting testen',null),dd('lena','team','Sprint-Review vorbereiten',-3,3),
    td('lena','mine','Feedback zur Probezeit vorbereiten',3),td('lena','waiting','Aufwandsschätzung Migration',2),
    td('lena','team','Partner-Sandbox freischalten',1),
    td('jonas','team','Bug #412: Login unter Safari',-2),td('jonas','team','Designsystem-Komponenten abnehmen lassen',0),
    td('jonas','team','Abstimmung mit der UX-Agentur',2),td('jonas','mine','Urlaubsvertretung klären',1),
    td('jonas','team','Übergabe an Tobias',0),
    td('aylin','team','Wartungsfenster ankündigen',3),td('aylin','team','Zertifikate erneuern',12),
    td('aylin','waiting','Kostenaufstellung Cloud',4),td('aylin','team','Staging auf 1.31 heben',1),
    td('tobias','team','DATEV-Export abschließen',-1),td('tobias','team','Mandanten-Konzept skizzieren',9),
    td('tobias','mine','Weiterbildungsbudget freigeben',6),td('tobias','team','Steuerberater-Feedback einarbeiten',3),
    td('mira','team','Testfälle für Lasttest definieren',10),td('mira','mine','Jahresgespräch nach Rückkehr terminieren',4),
    dd('me','team','Personalplanung 2027 abgeben',-1,1),dd('jonas','team','Styleguide überarbeiten',-2,2),dd('aylin','team','Backup-Konzept prüfen',-6,5),
    dd('tobias','team','Schnittstelle zu Lexware testen',-9,8),dd('lena','waiting','Zugang zur Partner-API',-10,9),dd('mira','team','Regressionstests Release 4.2',-15,14),
    dd('me','team','Quartalsbericht Q3',-20,19),dd('jonas','team','Kundenportal Prototyp',-25,24),
    {...td('me','team','Foliendeck für Mark prüfen',2),with:['kmark']},{...td('me','team','Budgetzahlen für Thomas aufbereiten',6),with:['kthomas']},
    {...dd('me','team','Agenda Jour fixe mit Thomas',-5,5),with:['kthomas']}];
  const tz=todos.find(x=>x.title==='Reporting an die Geschäftsführung');Object.assign(tz,{repeat:'m1',series:'demorep',anchor:tz.due});
  const tk=(personId,text,doneAgo=null)=>({id:uid(),personId,text,done:doneAgo!==null,...(doneAgo!==null?{doneAt:ds(TDN-doneAgo)}:{})});
  const talks=[tk('lena','Wunsch nach mehr Architektur-Verantwortung'),tk('lena','Probezeit-Feedback'),
    tk('jonas','Überstunden im Oktober'),tk('tobias','Interesse an der Teamlead-Rolle'),tk('mira','Budget für ein Lasttest-Tool'),
    tk('jonas','Ziele für das zweite Halbjahr',6),tk('aylin','Zertifizierung Kubernetes',13)];
  const as=(personId,project,s,e,billable=true)=>({id:uid(),personId,project,start:ds(TDN+s),end:e===null?null:ds(TDN+e),billable,note:''});
  const assignments=[as('lena','Kranich Versicherung',-210,null),as('jonas','Stadtwerke Elmstadt',-120,18),as('aylin','Kranich Versicherung',-60,null),
    as('aylin','Interne Plattform',-60,null,false),as('tobias','Lotsen Logistik',-300,-31),as('tobias','Kanzlei Berg',-30,90)];
  return{people,contacts,topics,absences,todos,talks,assignments,settings:[{id:'region',value:'NW'}],acks:[]};
}
const empty=()=>({people:[],contacts:[],topics:[],absences:[],todos:[],talks:[],assignments:[],settings:[],acks:[]});
const DATA_VERSION=2;
/* New entries carry createdAt (ISO timestamp) for a later search and for sorting; older entries have none. */
const newEntry=o=>({id:uid(),...o,createdAt:new Date().toISOString()});
/* Every save() pushes the previous state onto the undo stack; Ctrl+Z and the toast's undo button pop it. */
const undoStack=[];let lastSaved=null;
function save(){const now=JSON.stringify(S);if(lastSaved!==null&&lastSaved!==now){undoStack.push(lastSaved);if(undoStack.length>CFG.undoSteps)undoStack.shift()}lastSaved=now;Store.changed()}
function undo(){if(!undoStack.length){toast('Nichts mehr rückgängig zu machen');return}const prev=undoStack.pop();S=JSON.parse(prev);lastSaved=prev;Store.changed();
  if(location.hash.startsWith('#ma-')&&!S.people.some(p=>'#ma-'+p.id===location.hash))location.hash='uebersicht';render();toast('Rückgängig gemacht')}
function saveUi(){try{localStorage.setItem(KEY+'.ui',JSON.stringify({range:ui.range,fold:ui.fold,redSeen:ui.redSeen}))}catch(e){}}
const snapshot=()=>JSON.stringify(S);
/* Clears the undo stack, e.g. after loading a new state from another device. */
function resetUndo(){undoStack.length=0;lastSaved=snapshot()}
/* Accepts any parsed data file and returns exactly the lists empty() knows, in that order.
   Lists this version does not know are passed through unchanged, so an older app never drops data added by a newer one.
   Data written by a newer version (higher `version`) throws an error with `newer: true`: this app must not interpret or
   overwrite it (Store stops syncing until reload).
   Migrations: version 1 stored the team of a person as `role`; since version 2 it is `team`. */
function normalize(o){const d=empty();if(!o||typeof o!=='object')throw new Error('Keine Teamboard-Daten');
  if(+o.version>DATA_VERSION)throw Object.assign(new Error('Diese Daten stammen von einer neueren Version des Teamboards. Lade die Seite neu.'),{newer:true});
  for(const k of Object.keys(d))d[k]=Array.isArray(o[k])?o[k]:[];
  for(const k of Object.keys(o))if(!(k in d)&&Array.isArray(o[k]))d[k]=o[k];
  for(const p of d.people)if(p&&'role' in p){if(p.team===undefined)p.team=p.role||'';delete p.role}
  return d}
/* Settings that travel with the data (synced to every device): entries {id, value} in `S.settings`, merged per id like
   every other list. Known ids: `region` (state for holidays, '' = nationwide only), `phone` (date a phone first connected),
   `onboarded` (date the "Erste Schritte" card was hidden). Device-only preferences stay in localStorage. */
const getSetting=(id,def=null)=>{const x=(S.settings||[]).find(s=>s.id===id);return x?x.value:def};
const hasSetting=id=>(S.settings||[]).some(s=>s.id===id);
function setSetting(id,value){const x=S.settings.find(s=>s.id===id);if(x)x.value=value;else S.settings.push({id,value})}
let S=empty();
lastSaved=JSON.stringify(S);
const ui={boards:{},keepIss:{},showAcked:false,absAll:false,filter:'alle',tab:{},forPid:'',off:0,range:['week','two','six'].includes(CFG.defaultView)?CFG.defaultView:'week',more:false,showDone:false,
  hist:{type:'alle',pid:'',q:'',weeks:8},year:{}, // hist: filters of the history view; year: review year per person
  fold:{todos:true,issues:true,abs:false,talk:false},redSeen:[],grp:{}, // phone "Heute": open cards, red issues seen when folding, open todo groups
  toff:0,tday:null,lgX:null}; // phone team grid: week offset and tapped day upright, scroll position sideways
try{const u=JSON.parse(localStorage.getItem(KEY+'.ui')||'{}');if(['week','two','six'].includes(u.range))ui.range=u.range;
  if(u.fold&&typeof u.fold==='object')Object.assign(ui.fold,u.fold);if(Array.isArray(u.redSeen))ui.redSeen=u.redSeen}catch(e){}

/* People: `S.people` is the team, including people who left (`archived` = date). `S.contacts` are people outside the team
   (boss, colleagues): never responsible for an entry, only mentioned in `with`. */
const personOf=id=>id==='me'?ME:(S.people.find(p=>p.id===id)||S.contacts.find(k=>k.id===id)||{id,name:'Gelöscht',team:''});
const team=()=>S.people.filter(p=>!p.archived);
const isActive=pid=>pid==='me'||S.people.some(p=>p.id===pid&&!p.archived);
const isContact=id=>S.contacts.some(k=>k.id===id);
/* Everyone "@" can address: the team without archived people, plus contacts. */
const mentionable=()=>[...team(),...S.contacts.filter(k=>!k.archived)];
/* People involved in a topic or todo besides the responsible person, as ids (team members, contacts or "me"). */
const withOf=t=>(t.with||[]).filter(id=>id!==t.personId);
const nameShort=p=>p.id==='me'?'Ich':firstName(p);
const withNames=t=>withOf(t).map(id=>nameShort(personOf(id))).join(', ');
const teamNames=()=>[...new Set(S.people.map(p=>p.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
/* Lower case without accents, for matching names: fold('Krüger') === 'kruger'. */
const fold=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const firstWord=p=>p.name.split(/\s+/)[0];
const sharesFirstName=p=>!!p.id&&p.id!=='me'&&mentionable().some(q=>q.id!==p.id&&fold(firstWord(q))===fold(firstWord(p)));
/* Short display name: "Lena", or "Fabian M." if two people share the first name. */
function firstName(p){const f=firstWord(p);if(!sharesFirstName(p))return f;const last=p.name.split(/\s+/).slice(1).join(' ');return last?`${f} ${last[0].toUpperCase()}.`:f}
/* Text inserted after "@" by the suggestion list: first name if unique, else the full name (parseQuick matches full names). */
const mentionText=p=>p.id==='me'?'ich':sharesFirstName(p)?p.name:firstWord(p);
const initials=p=>p.id==='me'?'Ich':p.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const avatar=(p,size='')=>`<span class="av ${size} ${p.id==='me'?'me':''}" aria-hidden="true">${esc(initials(p))}</span>`;
const hrefOf=id=>id==='me'?'#ich':'#ma-'+id;
const absentOn=(pid,day)=>S.absences.find(a=>a.personId===pid&&a.start<=day&&a.end>=day);
const nextAbsence=pid=>S.absences.filter(a=>a.personId===pid&&a.end>=TODAY).sort((a,b)=>a.start.localeCompare(b.start))[0];
const absPhrase=k=>({Urlaub:'im Urlaub',Krank:'krank',Schulung:'in der Schulung'}[k]||'abwesend');
/* Absence kind as displayed. The stored value "Sonstiges" reads "Abwesend". */
const absLabel=k=>k==='Sonstiges'?'Abwesend':k;
/* Sick days are shown only while current: CFG.sickVisibleDays after the end a "Krank" absence becomes "Sonstiges"
   (displayed "Abwesend") and loses its note. Same result on every device, so merging sees no conflict. */
function expireSick(){const lim=ds(TDN-CFG.sickVisibleDays);let n=0;
  for(const a of S.absences)if(a.kind==='Krank'&&a.end<lim){a.kind='Sonstiges';delete a.note;n++}return n}
/* Applies expireSick() to a freshly loaded state without an undo step; Store.changed() commits it. */
function applyExpiry(){if(!expireSick())return false;lastSaved=snapshot();Store.changed();return true}

/* Project assignments: a person works on a project from start to end (null = open), billable or internal. */
const asgActive=(a,day=TODAY)=>a.start<=day&&(!a.end||a.end>=day);
const asgOverlaps=(a,from,to)=>a.start<=to&&(!a.end||a.end>=from);
const asgSort=(a,b)=>(b.billable?1:0)-(a.billable?1:0)||a.start.localeCompare(b.start);
const currentAssignments=(pid,day=TODAY)=>S.assignments.filter(a=>a.personId===pid&&asgActive(a,day)).sort(asgSort);
/* "Kranich Versicherung" or "Kranich Versicherung +1" for several current projects; '' without one. */
function projectLabel(pid,list=currentAssignments(pid)){return list.length?list[0].project+(list.length>1?` +${list.length-1}`:''):''}
/* Second line under a name: "Plattform · Kranich Versicherung" (team and current project). */
const teamLine=p=>[p.id==='me'?'':p.team,projectLabel(p.id)].filter(Boolean).join(' · ');
const projectNames=()=>[...new Set(S.assignments.map(a=>a.project))].sort((a,b)=>a.localeCompare(b,'de'));
function kindLabel(kind,p){if(p.id==='me')return'Eigene Aufgabe';const f=firstName(p);
  return kind==='mine'?`Mein To-do zu ${f}`:kind==='waiting'?`Wartet auf ${f}`:`Aufgabe von ${f}`}
const byDue=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title);

/* Creates a todo. `kind` is always 'team' for "me" (same rule in parseQuick, openTodo and dragging). */
function newTodo(o){
  const t=newEntry({personId:o.personId,kind:o.personId==='me'?'team':o.kind||'team',title:o.title,due:o.due||null,done:false,note:o.note||''});
  const w=[...new Set(o.with||[])].filter(id=>id!==t.personId);if(w.length)t.with=w;
  if(o.repeat){t.due=t.due||TODAY;Object.assign(t,{repeat:o.repeat,series:uid(),anchor:t.due})}
  S.todos.push(t);return t}

/* Recurring todos. `repeat` is the rhythm, `anchor` the first planned date of the series, `series` links its instances.
   Only one instance is open: completing it creates the next one. Planned dates are anchor + k × rhythm (months keep the
   anchor's day, clamped to the month's end), so the rhythm never drifts. A planned date on a weekend or holiday moves to the
   working day before. The next instance is the first one after the completed one's due date and after today, so finishing
   late builds no backlog. Its id comes from series and date, so completing on two devices offline merges into one. */
const REPEATS=[['','Nie'],['w1','Wöchentlich'],['w2','Alle 2 Wochen'],['m1','Monatlich'],['m3','Quartalsweise'],['y1','Jährlich']];
const repeatLabel=r=>(REPEATS.find(x=>x[0]===r)||['',''])[1];
function addMonthsIso(iso,m){const y=+iso.slice(0,4),mo=+iso.slice(5,7)-1+m,d=+iso.slice(8,10),ny=y+Math.floor(mo/12),nm=((mo%12)+12)%12;
  const last=new Date(Date.UTC(ny,nm+1,0)).getUTCDate();return`${ny}-${String(nm+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
function plannedAt(anchor,rep,k){const n=+rep.slice(1);return rep[0]==='w'?ds(dn(anchor)+7*n*k):addMonthsIso(anchor,(rep[0]==='y'?12:1)*n*k)}
const workdayBefore=n=>{while(wdOf(n)===0||wdOf(n)===6||holidayOn(n))n--;return n};
function nextDue(t){const after=Math.max(dn(t.due),TDN),a=t.anchor||t.due;
  for(let k=0;k<5000;k++){const d=workdayBefore(dn(plannedAt(a,t.repeat,k)));if(d>after)return ds(d)}return null}
/* Marks a todo done; for a recurring one also creates the next instance and returns it. */
function completeTodo(t,doneAt=TODAY){
  t.done=true;t.doneAt=doneAt||TODAY;if(!t.repeat||!t.due)return null;
  const due=nextDue(t);if(!due)return null;const id=`${t.series}-${due.replace(/-/g,'')}`;
  const ex=S.todos.find(x=>x.id===id);if(ex)return ex;
  const n={id,personId:t.personId,kind:t.kind,title:t.title,due,done:false,note:t.note||'',...(t.with?.length?{with:[...t.with]}:{}),
    repeat:t.repeat,series:t.series,anchor:t.anchor||t.due,createdAt:new Date().toISOString()};
  S.todos.push(n);return n}
/* Reopens a todo; for a recurring one removes the open follow-up instance again. */
function reopenTodo(t){t.done=false;delete t.doneAt;
  if(t.repeat&&t.series)S.todos=S.todos.filter(x=>!(x.series===t.series&&x!==t&&!x.done&&x.due>t.due))}

function route(){const h=location.hash.slice(1);if(h==='ich')return{view:'person',id:'me'};if(h==='team')return{view:'team'};if(h==='verlauf')return{view:'history'};
  if(h.startsWith('ma-')){const id=h.slice(3);if(S.people.some(p=>p.id===id))return{view:'person',id}}return{view:'overview'}}
function ctx(){const r=route();if(r.view!=='person'||r.id==='me')return{personId:'me',kind:'team'};return{personId:r.id,kind:ui.tab[r.id]||'team'}}
