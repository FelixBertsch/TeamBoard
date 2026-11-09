/* render() rebuilds sidebar and main via innerHTML. It saves text, caret and focus of open fields in #main first and restores them
   afterwards, so input survives resizing, rotation and background sync. To clear a field after submitting, set value='' before render(). */
let refocusQuick=false,lastKey=null,lastW=0;
const fieldKey=el=>el.id||(el.dataset.add?el.dataset.add+':'+(el.dataset.person||''):'');
const mainFields=()=>[...document.querySelectorAll('#main input:not([type=radio]):not([type=checkbox]):not([type=file]),#main textarea')];
function keepFields(){const a=document.activeElement;return mainFields().map(el=>({k:fieldKey(el),v:el.value,f:el===a,s:el.selectionStart,e:el.selectionEnd})).filter(x=>x.k&&(x.v||x.f))}
function restoreFields(list){const els=mainFields();
  for(const x of list){const el=els.find(e=>fieldKey(e)===x.k);if(!el)continue;if(x.v&&!el.value)el.value=x.v;
    if(el.id==='quick'&&el.value)$('#qprev').innerHTML=previewHTML(el.value);
    if(x.f){el.focus({preventScroll:true});try{el.setSelectionRange(x.s,x.e)}catch(e){}}}}
function render(){
  const k=applyLayout();lastKey=k;lastW=window.innerWidth;
  if(Store.mode==='none'){$('#side').innerHTML=k==='phone'?'':brandHTML();$('#main').innerHTML=viewSetup();return}
  const keep=keepFields();
  const r=route();renderSide(r);
  const banner=tourActive()?`<div class="banner">Rundgang mit Beispieldaten. Deine eigenen Daten bleiben unverändert.</div>`
    :Store.mode==='demo'?`<div class="banner">Beispielmodus: Änderungen werden nicht gespeichert.<span class="sp"></span><button class="btn secondary sm" data-action="tour">Rundgang</button><button class="btn accent sm" data-action="leave-demo">Teamboard einrichten</button></div>`
    :Store.outdated?`<div class="banner">Eine neuere Version des Teamboards hat gespeichert. Bis zum Neuladen synchronisiert dieses Fenster nicht, deine Änderungen bleiben auf dem Gerät.<span class="sp"></span><button class="btn accent sm" data-action="reload">Neu laden</button></div>`:'';
  $('#main').innerHTML=r.view==='history'?viewHistory(banner):k==='phone'?(r.view==='overview'?viewToday(banner):r.view==='team'?viewTeam(banner):viewPersonPhone(r.id,banner))
    :(r.view==='person'?viewPerson(r.id,banner):viewOverview(banner));
  placeBoards();restoreFields(keep);restoreGridScroll();
  if(refocusQuick){$('#quick')?.focus();refocusQuick=false}}
