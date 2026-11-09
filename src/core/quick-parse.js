/* Quick capture parser: "@Name Title am 12.11. #ich" for todos, "@Name #urlaub ab 22.12. bis 2.1." for absences. */

/* "12.11." without a year is this year, or next year if that date lies more than 60 days back (December entry for January). */
function mkDate(d,m,y){if(m<1||m>12||d<1||d>31)return null;const yr=y?(y<100?y+2000:y):_now.getFullYear();
  let s=`${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(ds(dn(s))!==s)return null;if(!y&&dn(s)<TDN-60)s=`${yr+1}${s.slice(4)}`;return s}
const MONTHS={jan:1,januar:1,feb:2,februar:2,mar:3,marz:3,maerz:3,apr:4,april:4,mai:5,jun:6,juni:6,jul:7,juli:7,aug:8,august:8,
  sep:9,sept:9,september:9,okt:10,oktober:10,nov:11,november:11,dez:12,dezember:12};
function parseDateWord(w){
  w=w.toLowerCase().replace(/[,;!.]+$/,'');
  if(w==='heute')return TODAY;if(w==='morgen')return ds(TDN+1);if(w==='übermorgen')return ds(TDN+2);
  const map={so:0,sonntag:0,mo:1,montag:1,di:2,dienstag:2,mi:3,mittwoch:3,do:4,donnerstag:4,fr:5,freitag:5,sa:6,samstag:6};
  if(Object.prototype.hasOwnProperty.call(map,w))return ds(TDN+((map[w]-wdOf(TDN)+7)%7));
  const m=w.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/);
  if(m)return mkDate(+m[1],+m[2],m[3]?+m[3]:0);
  return null;
}
/* Takes the first "<keyword> <date>" from t, e.g. "am 12.11.", "bis Fr", "zum 3. Dezember 2027". The date is one word
   (parseDateWord) or day plus month name. Returns {date, t} with the phrase removed, or null. A keyword followed by
   something else ("am Ende") stays in the text. */
function takeDate(t,words){
  const re=new RegExp(`\\s(?:${words})\\s+(?:(\\d{1,2})\\.?\\s*([a-zäöü]+)\\.?(?:\\s+(\\d{4}))?|(\\S+))(?=\\s)`,'gi');let m;
  while((m=re.exec(t))){
    let d=null;
    if(m[2]){const mo=MONTHS[fold(m[2])];if(mo)d=mkDate(+m[1],mo,m[3]?+m[3]:0)}
    else d=parseDateWord(m[4]);
    if(d)return{date:d,t:t.slice(0,m.index)+' '+t.slice(m.index+m[0].length)};
    re.lastIndex=m.index+1;
  }
  return null;
}
/* "heute", "morgen" and "übermorgen" count as due date without a keyword ("Bericht morgen abgeben"). Other dates need
   "am", "bis" or "zum", because titles often contain numbers and weekdays ("Release 4.2", "Termin Freitag absagen"). */
function takeLoneDay(t){const m=t.match(/\s(heute|morgen|übermorgen)[,;!.]?(?=\s)/i);if(!m)return null;
  return{date:parseDateWord(m[1]),t:t.slice(0,m.index)+' '+t.slice(m.index+m[0].length)}}
/* Tags after "#". Todo tags set the todo kind, absence tags turn the entry into an absence. Also offered by the suggestion list. */
const TODO_TAGS={ich:'mine',meins:'mine',wartet:'waiting'};
const ABS_TAGS={urlaub:'Urlaub',krank:'Krank',schulung:'Schulung',abwesend:'Sonstiges'};
/* Repeat tags, keyed by fold() of the word, so "#wöchentlich" and "#wochentlich" both work. */
const REPEAT_TAGS={wochentlich:'w1',woechentlich:'w1',zweiwochentlich:'w2',zweiwoechentlich:'w2',monatlich:'m1',quartalsweise:'m3',jahrlich:'y1',jaehrlich:'y1'};
/* Resolves "@…" at the start of `rest` (text after the @). Full names first ("@Fabian Müller"), then one word that
   starts a first or last name. Returns {len, id} or {len, ambiguous:[people]} or {len, unknown}.
   `pool`: the team without archived people plus contacts; forms pass the already mentioned people as well. */
function matchPerson(rest,pool=mentionable()){
  const fr=fold(rest);
  for(const p of [...pool].sort((a,b)=>b.name.length-a.name.length)){const n=fold(p.name);
    if(fr.startsWith(n)&&/^(\s|$)/.test(rest.slice(n.length)))return{len:n.length,id:p.id}}
  const tok=rest.match(/^[^\s@#]+/)[0],q=fold(tok);
  if(q==='ich'||q==='mich')return{len:tok.length,id:'me'};
  const hits=pool.filter(p=>fold(p.name).split(/\s+/).some(w=>w.startsWith(q)));
  if(hits.length===1)return{len:tok.length,id:hits[0].id};
  if(!hits.length)return{len:tok.length,unknown:tok};
  const exact=hits.filter(p=>fold(p.name).split(/\s+/).includes(q));
  if(exact.length===1)return{len:tok.length,id:exact[0].id};
  return{len:tok.length,ambiguous:exact.length?exact:hits};
}
/* Every "@name" in the text. The first team member (or "@ich") is responsible and leaves the title; contacts and every further
   person are involved (`with`) and stay in the title as plain names: "@ich Folien für @Mark prüfen" is my todo "Folien für Mark
   prüfen" with Mark involved. Unknown names stay as text and are reported in `unknown`. */
function parseMentions(t,personId){
  let i=0,resp=false,unknown=null,ambiguous=null;const ids=[];
  for(;;){const mm=t.slice(i).match(/\s@(?=[^\s@#])/);if(!mm)break;
    const at=i+mm.index,st=at+2,m=matchPerson(t.slice(st)),orig=t.slice(st,st+m.len);
    if(m.id&&!resp&&!isContact(m.id)){personId=m.id;resp=true;t=t.slice(0,at)+' '+t.slice(st+m.len);i=at;continue}
    if(m.id){if(!ids.includes(m.id))ids.push(m.id)}else if(m.ambiguous)ambiguous=ambiguous||m.ambiguous;else unknown=unknown||m.unknown;
    t=t.slice(0,at)+' '+orig+t.slice(st+m.len);i=at+1+orig.length}
  return{t,personId,with:ids.filter(id=>id!==personId),unknown,ambiguous};
}
function parseQuick(raw,c){
  let t=' '+raw+' ',personId=c.personId,kind=c.kind,due=null,absKind=null,mixed=false,repeat='';
  const pm=parseMentions(t,personId),unknown=pm.unknown,ambiguous=pm.ambiguous;t=pm.t;personId=pm.personId;
  let m,half=null;const tag=/\s#(ich|meins|wartet|urlaub|krank|schulung|abwesend|vormittags|nachmittags)(?=\s)/i;
  while((m=t.match(tag))){const w=m[1].toLowerCase();if(ABS_TAGS[w])absKind=ABS_TAGS[w];else if(w==='vormittags'||w==='nachmittags')half=w[0]==='v'?'am':'pm';else{kind=TODO_TAGS[w];mixed=true}t=t.replace(m[0],' ')}
  t=t.replace(/\s#([^\s@#]+)(?=\s)/g,(all,w)=>{const r=REPEAT_TAGS[fold(w)];if(!r)return all;repeat=r;return' '});
  let bis=null;const b=takeDate(t,'bis');if(b){bis=b.date;t=b.t}
  if(absKind){
    let start=null;const a=takeDate(t,'ab|vom|von|am');if(a){start=a.date;t=a.t}
    if(!start){const w=t.trim().split(/\s+/).find(x=>parseDateWord(x));if(w){start=parseDateWord(w);t=t.replace(new RegExp('\\s'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s)'),' ')}}
    start=start||TODAY;let end=bis||start;if(end<start)[start,end]=[end,start];
    let note=t.replace(/\s+/g,' ').trim(),dropped=false;
    if(absKind==='Krank'&&note){dropped=true;note=''} // no further details on sick days
    return{type:'absence',personId,absKind,start,end,note,dropped,mixed,unknown,ambiguous,title:'',half,...(half&&start!==end?{err:HALF_ONE_DAY}:{})};
  }
  due=bis;
  if(!due){const x=takeDate(t,'am|zum')||takeLoneDay(t);if(x){due=x.date;t=x.t}} // without a date a repeating todo starts today (newTodo)
  if(personId==='me')kind='team';
  return{type:'todo',title:t.replace(/\s+/g,' ').trim(),personId,kind,due,with:pm.with,repeat,unknown,ambiguous,...(half?{err:HALF_NO_ABS}:{})};
}
/* #vormittags/#nachmittags: only with an absence tag and for a single day; otherwise `err` and nothing is created. */
const HALF_ONE_DAY='Halbe Tage gibt es nur für einen einzelnen Tag.';
const HALF_NO_ABS='#vormittags und #nachmittags gehen nur zusammen mit #urlaub, #krank, #schulung oder #abwesend.';
const unknownText=n=>`„${n}“ gibt es weder im Team noch bei den Kontakten. Die Vorschlagsliste legt einen Kontakt an.`;
/* Preview line of a todo: kind, due date, repetition, involved people. Shared by quick capture and the phone sheet. */
function todoPreview(r,due){const p=personOf(r.personId),w=withNames(r);
  return`<span><b>${esc(kindLabel(r.kind,p))}</b>${due?`, fällig ${esc(longDay(due))}`:', ohne Frist'}${r.repeat?`, ${esc(repeatLabel(r.repeat).toLowerCase())}`:''}${w?`, mit ${esc(w)}`:''}</span>`}
const ambiguousText=r=>`Mehrere passen: ${r.ambiguous.map(p=>p.name).join(', ')}. Wähl eine Person aus der Liste.`;
const rangeText=(s,e)=>s===e?dueLabel(s):`${dueLabel(s)} bis ${dueLabel(e)}`;
const daysText=n=>n===0.5?'ein halber Arbeitstag':n===1?'1 Arbeitstag':`${String(n).replace('.',',')} Arbeitstage`;
function absPreview(r){
  const p=personOf(r.personId),who=p.id==='me'?'Ich':p.name,half=r.start===r.end?r.half:null;
  const over=S.absences.find(a=>a.personId===r.personId&&a.start<=r.end&&a.end>=r.start&&!(half&&a.half&&a.half!==half)); // morning and afternoon do not overlap
  let s=`<span><b>Abwesenheit: ${esc(who)} ${esc(absPhrase(r.absKind))}</b>, ${esc(rangeText(r.start,r.end))}${half?' '+HALF[half]:''}${(n=>n?`, ${daysText(n)}`:'')(absDays({start:r.start,end:r.end,half}))}</span>`;
  if(r.dropped)s+='<span class="warn">Bei Krankheit wird kein Text gespeichert.</span>';
  if(over)s+=`<span class="warn">Überschneidet ${esc(absLabel(over.kind))} ${dm(over.start)} bis ${dm(over.end)}</span>`;
  if(r.mixed)s+='<span>#ich und #wartet gelten nur für Aufgaben.</span>';
  return s;
}
function previewHTML(raw){
  if(!raw.trim())return`<span>@Name weist zu, weitere @Namen sind beteiligt, „am 12.11.“ oder „bis Fr“ setzt die Frist, #ich macht daraus dein To-do, #wartet ein Nachfassen, #monatlich eine Wiederholung, #urlaub eine Abwesenheit.</span>`;
  const r=parseQuick(raw,ctx());
  if(r.ambiguous)return`<span class="warn">${esc(ambiguousText(r))}</span>`;
  if(r.err)return`<span class="warn">${esc(r.err)}</span>`;
  let s;
  if(r.type==='absence')s=absPreview(r);
  else s=todoPreview(r,r.due||(r.repeat?TODAY:null));
  if(r.unknown)s+=`<span class="warn">${esc(unknownText(r.unknown))}</span>`;
  if(r.type==='absence')s+='<span class="enter">Enter trägt ein</span>';else if(r.title)s+='<span class="enter">Enter legt an</span>';
  return s;
}
/* Creates the absence parsed from quick capture. Returns the toast text. */
function addAbsence(r){
  S.absences.push(newEntry({personId:r.personId,kind:r.absKind,start:r.start,end:r.end,...(r.half&&r.start===r.end?{half:r.half}:{}),...(r.note?{note:r.note}:{})}));save();
  const p=personOf(r.personId);return`${{Urlaub:'Urlaub',Krank:'Krankheit',Schulung:'Schulung'}[r.absKind]||'Abwesenheit'} für ${p.id==='me'?'dich':firstName(p)} eingetragen`;
}
function quickAdd(){const inp=$('#quick');if(!inp)return;closeSuggest();const r=parseQuick(inp.value,ctx());
  if(r.ambiguous||r.err){$('#qprev').innerHTML=previewHTML(inp.value);return}
  if(r.type==='absence'){const msg=addAbsence(r);inp.value='';refocusQuick=true;render();toast(msg,true);return}
  if(!r.title)return;
  newTodo(r);
  inp.value='';save();refocusQuick=true;render();toast(`${kindLabel(r.kind,personOf(r.personId))} angelegt`,true)}
