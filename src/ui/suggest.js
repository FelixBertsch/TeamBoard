/* Suggestion list for "@" (team, contacts) and "#" (tags) in the quick capture field (#quick), the phone sheet (#capText) and the
   "Beteiligt" field of the forms (#withIn, "@" only). For an unknown name "@" offers to create a contact.
   only "#" in the inline field of drag-to-create (#tlNew), whose list floats (position fixed) because the timeline clips.
   ARIA combobox: the field keeps focus, ↑/↓ move, Tab and Enter take the marked entry, Esc closes the list.
   The list closes when the token is already complete, so Enter then submits as usual. */
const TAG_HELP=[['ich','Mein To-do zur Person'],['wartet','Wartet auf die Person'],['urlaub','Abwesenheit: Urlaub'],
  ['krank','Abwesenheit: krank, ohne Details'],['schulung','Abwesenheit: Schulung'],['abwesend','Abwesenheit ohne Grund'],
  ['wöchentlich','Aufgabe jede Woche'],['zweiwöchentlich','Aufgabe alle 2 Wochen'],['monatlich','Aufgabe jeden Monat'],
  ['quartalsweise','Aufgabe jedes Quartal'],['jährlich','Aufgabe jedes Jahr']];
let sug=null; // {input, from, to, items, i}

/* The "@…" or "#…" token around the caret, or null. */
function suggestToken(inp){
  const v=inp.value,c=inp.selectionStart??v.length,m=v.slice(0,c).match(/(^|\s)([@#])([^\s@#]*)$/);if(!m)return null;
  const tail=v.slice(c).match(/^[^\s@#]*/)[0];
  return{sym:m[2],q:m[3]+tail,from:c-m[3].length-1,to:c+tail.length};
}
function suggestItems(sym,q){
  const f=fold(q);
  if(sym==='#')return TAG_HELP.filter(([t])=>fold(t).startsWith(f)).map(([t,d])=>({ins:'#'+t,label:'#'+t,sub:d}));
  const pool=mentionable();
  const out=pool.map(p=>{const w=fold(p.name).split(/\s+/);return{p,r:!f||w[0].startsWith(f)?0:w.slice(1).some(x=>x.startsWith(f))?1:-1}})
    .filter(x=>x.r>=0).sort((a,b)=>a.r-b.r||a.p.name.localeCompare(b.p.name,'de'))
    .map(({p})=>({ins:'@'+mentionText(p),label:p.name,sub:isContact(p.id)?'Kontakt':teamLine(p),p}));
  if(f&&('ich'.startsWith(f)||'mich'.startsWith(f)))out.push({ins:'@ich',label:'Ich',sub:'Meine Planung',p:ME});
  if(f.length>=2&&!out.length) // nobody matches: offer a new contact
    out.push({ins:'@'+cap(q),label:`„${cap(q)}“ als Kontakt anlegen`,sub:'Person außerhalb des Teams',create:cap(q)});
  return out;
}
function updateSuggest(inp){
  const tk=suggestToken(inp);let items=tk&&!(inp.id==='tlNew'&&tk.sym==='@')&&!(inp.id==='withIn'&&tk.sym==='#')?suggestItems(tk.sym,tk.q):[];
  if(items.length===1&&!items[0].create&&fold(items[0].ins)===fold(tk.sym+tk.q))items=[]; // already complete
  if(!items.length){closeSuggest();return}
  const keep=sug&&sug.input===inp&&sug.items[sug.i]?sug.items[sug.i].ins:null;
  sug={input:inp,from:tk.from,to:tk.to,items,i:Math.max(0,items.findIndex(x=>x.ins===keep))};
  drawSuggest();
}
function drawSuggest(){
  const {input,items,i}=sug;let ul=$('#sugList');
  if(!ul){ul=document.createElement('ul');ul.id='sugList';ul.className='sug';ul.setAttribute('role','listbox');ul.setAttribute('aria-label','Vorschläge');
    if(input.id==='tlNew'){ul.classList.add('sug-float');document.body.appendChild(ul)}else input.after(ul)}
  ul.innerHTML=items.map((x,k)=>`<li id="sug-${k}" role="option" data-i="${k}" aria-selected="${k===i}">${x.p?avatar(x.p,'xs'):`<span class="sug-tag">${ic(x.create?'userPlus':'hash',14)}</span>`}<span class="sug-t"><b>${esc(x.label)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:''}</span></li>`).join('');
  input.setAttribute('aria-expanded','true');input.setAttribute('aria-activedescendant','sug-'+i);
  if(input.id==='tlNew'){const r=input.getBoundingClientRect(),below=innerHeight-r.bottom>ul.offsetHeight+40; // timeline clips, so position fixed
    ul.style.left=r.left+'px';ul.style.top=below?(r.bottom+30)+'px':'';ul.style.bottom=below?'':(innerHeight-r.top+6)+'px'}
  ul.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});
}
function closeSuggest(){if(!sug&&!$('#sugList'))return;const inp=sug?.input;sug=null;$('#sugList')?.remove();
  if(inp){inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant')}}
function moveSuggest(d){sug.i=(sug.i+d+sug.items.length)%sug.items.length;drawSuggest()}
function pickSuggest(k=sug.i){
  const {input,from,to,items}=sug,x=items[k],v=input.value,rest=v.slice(to),gap=/^\s/.test(rest)?'':' ';
  if(x.create){S.contacts.push(newEntry({id:'k'+uid(),name:x.create}));save();toast(`${x.create} als Kontakt angelegt. Den vollen Namen trägst du unter „Kontakte“ nach.`)}
  input.value=v.slice(0,from)+x.ins+gap+rest;const c=from+x.ins.length+1;input.setSelectionRange(c,c);
  closeSuggest();input.focus({preventScroll:true});fieldChanged(input);
}
/* Keys while the list is open. Returns true if the key was handled. */
function suggestKey(e){
  if(!sug||e.target!==sug.input)return false;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();moveSuggest(e.key==='ArrowDown'?1:-1);return true}
  if(e.key==='Tab'||e.key==='Enter'){if(e.shiftKey||e.isComposing)return false;e.preventDefault();pickSuggest();return true}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSuggest();return true}
  return false;
}
/* Live preview below the field after any change. */
function fieldChanged(inp){if(inp.id==='quick')$('#qprev').innerHTML=previewHTML(inp.value);else if(inp.id==='tlNew')inlineHint(inp);else if(inp.id==='capText')capPreview()}
const suggestField=el=>el&&(el.id==='quick'||el.id==='capText'||el.id==='tlNew'||el.id==='withIn');
