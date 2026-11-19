/* Notes per team member („Notizen“): what the user noticed about a person, with a date and optionally „Positiv“ or „Kritisch“,
   for development talks years later. Nothing else reads them: not the history, the review, "Zu klären", the timeline or the tour.
   Hidden by default. The card on the person page (notesCard()) and the page #notizen-<id> (viewNotes()) show no content, not
   even a count, until „Anzeigen“. The card's input field is there in both states: writing a note reveals nothing. They hide again when the route leaves this person (notesRoute(), on hashchange), after
   CFG.notesHideMinutes without a click or key press, and when the app goes to the background. The reveal lives in `ui.notes`
   only, never in localStorage. The note field is plain text: no suggestion list, no browser autocomplete. */
const NOTE_TONES=[['','Ohne'],['plus','Positiv'],['minus','Kritisch']];
const NOTE_IC={plus:'thumbsUp',minus:'thumbsDown'};
const toneLabel=t=>t==='plus'?'Positiv':t==='minus'?'Kritisch':'Ohne Einordnung';
const notesOf=pid=>S.notes.filter(n=>n.personId===pid);
const noteSort=(a,b)=>a.day.localeCompare(b.day)||(a.createdAt||'').localeCompare(b.createdAt||'');
const notesOpen=pid=>!!pid&&ui.notes.pid===pid;
function showNotes(pid){Object.assign(ui.notes,{pid,at:Date.now(),q:'',tone:'alle',year:null});render()}
function hideNotes(){ui.notes.pid=null;ui.notes.q='';refreshHidden()}
/* Re-renders when notes are still on screen although hidden (a form was open when they hid). */
function refreshHidden(){if(!ui.notes.pid&&$('#main .notes-open')&&!Store.busy())render()}
/* Called on every hashchange before render(): notes stay open only while the route stays with the same person. */
function notesRoute(){const r=route();if(ui.notes.pid&&!((r.view==='person'||r.view==='notes')&&r.id===ui.notes.pid)){ui.notes.pid=null;ui.notes.q=''}}
for(const t of['pointerdown','keydown'])document.addEventListener(t,()=>{if(ui.notes.pid)ui.notes.at=Date.now()},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ui.notes.pid)hideNotes()});
setInterval(()=>{if(ui.notes.pid&&Date.now()-ui.notes.at>CFG.notesHideMinutes*60000)hideNotes();else refreshHidden()},10000);

/* Search: every word of the query must occur, in any order; case, accents and ß do not matter. A word also matches inside a
   longer one ("test" finds "Regressionstest"); from five letters on one typo is forgiven (a letter missing, added, wrong, or two
   swapped). Returns the ranges of `text` to mark, or null. It finds spellings, not meanings. */
const nfold=s=>fold(s).replace(/ß/g,'ss');
function typo1(a,b){if(a===b)return true;const la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false; // edit distance at most 1
  let i=0;while(i<la&&i<lb&&a[i]===b[i])i++;
  if(la===lb)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  return la>lb?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1)}
const typoIn=(w,f)=>{for(let L=w.length-1;L<=w.length+1;L++)for(let i=0;i+L<=f.length;i++)if(typo1(w,f.slice(i,i+L)))return true;return false};
function noteHits(text,q){
  const words=nfold(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);if(!words.length)return null;
  const toks=[...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(m=>({s:m.index,o:m[0],f:nfold(m[0])})),out=[];
  for(const w of words){let hit=false;
    for(const t of toks){const i=t.f.indexOf(w);
      if(i>=0){hit=true;out.push(t.f.length===t.o.length?[t.s+i,t.s+i+w.length]:[t.s,t.s+t.o.length])}
      else if(w.length>=5&&typoIn(w,t.f)){hit=true;out.push([t.s,t.s+t.o.length])}}
    if(!hit)return null}
  return out}
function markText(text,ranges){if(!ranges?.length)return esc(text);let h='',pos=0;
  for(const[s,e]of[...ranges].sort((a,b)=>a[0]-b[0])){if(e<=pos)continue;const st=Math.max(s,pos);h+=esc(text.slice(pos,st))+'<mark>'+esc(text.slice(st,e))+'</mark>';pos=e}
  return h+esc(text.slice(pos))}

const noteIc=n=>`<span class="h-ic n-ic${n.tone?' on':''}" role="img" aria-label="${toneLabel(n.tone)}" title="${toneLabel(n.tone)}">${ic(NOTE_IC[n.tone]||'note',16,2.25)}</span>`;
const noteRow=(n,day,hits=null)=>`<button class="hrow nrow" data-action="edit-note" data-id="${n.id}">${noteIc(n)}<span class="h-body"><span class="n-t">${markText(n.text,hits)}</span></span><span class="h-d">${esc(day)}</span></button>`;
const hiddenNote=`<p class="empty n-hidden">${ic('eyeOff',18)}<span>Verdeckt, bis du sie anzeigst.</span></p>`;

/* Input in the card, hidden or not: text, optional „Positiv“/„Kritisch“ (kept in ui.notes.draft per person, so a re-render keeps
   it), „Speichern“ or Ctrl+Enter. The note gets today's date; the form of a saved note changes it. render() keeps the text
   (data-add + data-person). */
function noteInput(pid){const t=ui.notes.draft[pid]||'',f=firstName(personOf(pid));
  return`<div class="n-add"><textarea class="n-in" data-add="note" data-person="${pid}" rows="2" placeholder="${isPhone()?'Notiz schreiben':'Notiz schreiben, Strg+Enter speichert'}" aria-label="Notiz zu ${esc(f)} schreiben" autocomplete="off"></textarea>
    <div class="n-add-row"><div class="tags" role="group" aria-label="Einordnung">${['plus','minus'].map(v=>`<button type="button" class="tag" data-action="note-tone" data-person="${pid}" data-v="${v}" aria-pressed="${t===v}">${ic(NOTE_IC[v],16,2.25)}${toneLabel(v)}</button>`).join('')}</div>
    <button type="button" class="btn secondary sm" data-action="note-add" data-person="${pid}">Speichern</button></div></div>`}
/* Saves the card's input as a note of today. The card stays as it is: a hidden card stays hidden, the toast names no text. */
function addNote(pid){const el=$(`#main [data-add=note][data-person="${pid}"]`),text=(el?.value||'').trim();
  if(!text){toast('Bitte schreib zuerst eine Notiz.');el?.focus();return}
  const tone=ui.notes.draft[pid];S.notes.push(newEntry({personId:pid,day:TODAY,text,...(tone?{tone}:{})}));delete ui.notes.draft[pid];
  el.value='';save();render();toast('Notiz gespeichert',true)}
/* Card on the person page: the input, then hidden, or the five latest notes and a link to the overview. */
function notesCard(pid){const open=notesOpen(pid);
  const head=`<div class="panel-head"><h2 class="h4">Notizen</h2><button class="link-btn" data-action="${open?'notes-hide':'notes-show'}" data-person="${pid}">${open?'Verdecken':'Anzeigen'}</button></div>`;
  if(!open)return`<section class="card card-pad ncard">${head}${noteInput(pid)}${hiddenNote}</section>`;
  const list=notesOf(pid).sort(noteSort).reverse(),last=list.slice(0,5),y=TODAY.slice(0,4);
  const rows=last.length?last.map(n=>noteRow(n,n.day.startsWith(y)?dm(n.day):dmy(n.day))).join('')
    :`<p class="empty">Noch keine Notizen zu ${esc(firstName(personOf(pid)))}.</p>`;
  return`<section class="card card-pad ncard notes-open">${head}${noteInput(pid)}<div class="n-list">${rows}</div>
    ${list.length?`<div class="n-foot"><button class="link-btn" data-action="go" data-v="notizen-${pid}">${list.length>last.length?`Alle ${list.length} im Überblick ansehen`:'Im Überblick ansehen'}</button></div>`:''}</section>`;
}

/* "2026: 14 Notizen, davon 8 positiv und 3 kritisch." */
function yearSummary(list,y){const n=list.length,p=list.filter(x=>x.tone==='plus').length,m=list.filter(x=>x.tone==='minus').length;
  if(!n)return`${y}: keine Notizen.`;if(n===1)return`${y}: eine ${p?'positive ':m?'kritische ':''}Notiz.`;
  const parts=[p?`${p} positiv`:'',m?`${m} kritisch`:''].filter(Boolean).join(' und ');return`${y}: ${n} Notizen${parts?`, davon ${parts}`:''}.`}

/* Overview page #notizen-<id>, for the yearly talk: one year at a time from January to December, grouped by month, filter by
   „Positiv“/„Kritisch“, search across all years. Same markup on desktop and phone. */
function viewNotes(pid,banner=''){
  const p=personOf(pid),f=firstName(p),open=notesOpen(pid),phone=isPhone(),n=ui.notes;
  let lead='',body;
  if(!open)body=`<section class="card card-pad n-page">${hiddenNote}<button class="btn secondary" data-action="notes-show" data-person="${pid}">${ic('eye',18)}Anzeigen</button></section>`;
  else{
    const all=notesOf(pid),cur=+TODAY.slice(0,4),years=all.map(x=>+x.day.slice(0,4)),minY=Math.min(cur,...years),maxY=Math.max(cur,...years);
    const y=Math.min(maxY,Math.max(minY,n.year??cur)),q=n.q.trim(),inYear=all.filter(x=>x.day.startsWith(String(y))),hits=new Map();
    let shown=q?all.filter(x=>{const h=noteHits(x.text,q);if(h)hits.set(x.id,h);return!!h}):inYear;
    if(n.tone!=='alle')shown=shown.filter(x=>(x.tone||'')===n.tone);
    shown.sort(noteSort);
    lead=q?`${shown.length===1?'Ein Treffer':`${shown.length} Treffer`} in allen Jahren.`:yearSummary(inYear,y);
    const groups=new Map();for(const x of shown){const k=x.day.slice(0,7);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)}
    let list=[...groups].map(([k,xs])=>`<div class="grp">${MON[+k.slice(5)-1]} ${k.slice(0,4)}<span class="n">${xs.length}</span></div>`
      +xs.map(x=>noteRow(x,`${WD[wdOf(dn(x.day))]} ${dm(x.day)}`,hits.get(x.id))).join('')).join('');
    if(!list)list=`<p class="empty">${!all.length?`Noch keine Notizen zu ${esc(f)}. „Notiz schreiben“ legt die erste an.`
      :q?'Nichts gefunden für diese Suche.':`Aus ${y} gibt es ${n.tone==='plus'?'keine positiven':n.tone==='minus'?'keine kritischen':'keine'} Notizen.`}</p>`;
    const pager=q?'':`<div class="pager n-year"><button class="icon-btn" data-action="notes-year" data-v="-1" aria-label="Vorjahr"${y<=minY?' disabled':''}>${ic('chevL',20)}</button>
      <b>${y}</b><button class="icon-btn" data-action="notes-year" data-v="1" aria-label="Folgejahr"${y>=maxY?' disabled':''}>${ic('chevR',20)}</button></div>`;
    const tags=`<div class="tags" role="group" aria-label="Einordnung">${[['alle','Alle'],['plus','Positiv'],['minus','Kritisch']].map(([v,l])=>`<button class="tag" data-action="notes-tone" data-v="${v}" aria-pressed="${n.tone===v}">${l}</button>`).join('')}</div>`;
    body=`<section class="card card-pad hist n-page notes-open"><div class="hist-ctl"><div class="n-bar">${pager}${tags}</div>
      <label class="hist-q">${ic('search',18)}<input id="notesSearch" type="search" value="${esc(n.q)}" placeholder="In allen Jahren suchen" aria-label="Notizen durchsuchen" autocomplete="off" spellcheck="false" enterkeyhint="search"></label></div>${list}</section>`;
  }
  const acts=open?`<button class="btn secondary${phone?' sm':''}" data-action="notes-hide">${ic('eyeOff',18)}Verdecken</button><button class="btn accent${phone?' sm':''}" data-action="new-note" data-person="${pid}">${ic('plus',18,2.5)}Notiz schreiben</button>`:'';
  if(phone)return`${banner}<div class="m-top"><a class="m-back" href="#ma-${pid}">${ic('chevL',22,2.5)}${esc(f)}</a></div>
    <div class="m-head"><p class="overline">Notizen</p><h1>${esc(p.name)}</h1>${lead?`<p class="lead">${esc(lead)}</p>`:''}</div>${acts?`<div class="m-actions">${acts}</div>`:''}<div class="m-stack">${body}</div>`;
  return`<div class="wrap">${banner}<div class="page-head"><div class="head-id">${avatar(p,'lg')}<div><p class="overline">Notizen</p><h1>${esc(p.name)}</h1></div></div>
    <div class="actions"><button class="btn ghost" data-action="go" data-v="ma-${pid}">Zur Personenseite</button>${acts}</div></div>${lead?`<p class="lead">${esc(lead)}</p>`:''}${body}</div>`;
}

/* Form for a note: text, „Einordnung“ (none, „Positiv“, „Kritisch“) and the day it happened. */
function openNote(id,preset={}){
  const ex=id?S.notes.find(x=>x.id===id):null;if(id&&!ex)return;
  const pid=ex?ex.personId:preset.personId,n=ex||{day:TODAY,text:'',tone:''};
  openDrawer({title:ex?'Notiz bearbeiten':`Notiz zu ${firstName(personOf(pid))}`,submitLabel:'Speichern',
    body:field('Notiz',`<textarea name="text" rows="6" autocomplete="off"${ex?'':' autofocus'}>${esc(n.text)}</textarea>`)
      +group('Einordnung',radios('tone',NOTE_TONES,n.tone||''))+field('Datum',dateIn('day',n.day)),
    onSubmit:v=>{const text=(v.text||'').trim();if(!text)return'Bitte schreib eine Notiz.';if(!v.day)return'Bitte gib ein Datum ein.';
      const o=ex||newEntry({personId:pid});Object.assign(o,{day:v.day,text});if(v.tone)o.tone=v.tone;else delete o.tone;if(!ex)S.notes.push(o);
      ui.notes.year=+v.day.slice(0,4);save();toast('Notiz gespeichert',true)},
    onDelete:ex?()=>{S.notes=S.notes.filter(x=>x.id!==id);save();toast('Notiz gelöscht',true)}:null});
}
