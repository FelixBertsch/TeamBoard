/* Onboarding for new users: the "Erste Schritte" card, the holiday region form, the phone setup hint and the guided tour.
   The tour runs on sample data: an empty board has nothing to point at. Started from a connected board it switches to demo
   mode (no sync, nothing written) and returns via Store.resume(), which reloads the cached own data and syncs. */

/* ----- "Erste Schritte": derived from the data, so it ticks itself off on every device ----- */
function firstSteps(){
  const phone=isPhone(),list=[
    [hasSetting('region'),hasSetting('region')?`Feiertage: ${regionName(getSetting('region',''))}`:'Bundesland für Feiertage wählen','region'],
    [S.people.length>0,'Erste Person ins Team aufnehmen','new-person'],
    [S.topics.length>0,'Erstes Thema planen','new-topic'],
    [S.todos.length>0,'Erste Aufgabe erfassen','onb-quick'],
    [hasSetting('phone'),'Auf dem Smartphone einrichten','onb-phone']];
  if(!phone&&FS_OK)list.push([!!Backup.dir,'Sicherungsordner wählen','backup-folder']);
  return list}
function firstStepsPanel(){
  if(Store.mode!=='github'||hasSetting('onboarded'))return'';
  const list=firstSteps(),done=list.filter(x=>x[0]).length;if(done===list.length)return'';
  return`<section class="card card-pad first-steps" data-tour="first"><div class="panel-head"><h2 class="h4">Erste Schritte</h2><span class="fs-n">${done} von ${list.length}</span></div>
    <div class="fs-list">${list.map(([ok,label,act])=>`<button class="prow fs${ok?' ok':''}" data-action="${act}"><span class="fs-c" aria-hidden="true">${ok?ic('check',14,3):''}</span><span class="pt">${esc(label)}</span><span class="sr">${ok?'erledigt':'offen'}</span></button>`).join('')}</div>
    <div class="fs-foot"><button class="link-btn" data-action="tour">Rundgang mit Beispieldaten</button><button class="link-btn" data-action="onb-hide">Ausblenden</button></div></section>`}
function hideFirstSteps(){setSetting('onboarded',TODAY);save();render();toast('Erste Schritte ausgeblendet. Den Rundgang findest du unter „Mehr“.',true)}
/* Marks the data once a phone has connected (step "Auf dem Smartphone einrichten"). No undo step, like applyExpiry(). */
function notePhone(){
  if(Store.mode!=='github'||!/iPhone|Android/.test(navigator.userAgent)||hasSetting('phone'))return;
  setSetting('phone',TODAY);lastSaved=snapshot();Store.changed()}
const appUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');
function phoneHint(){
  showDialog({title:'Auf dem Smartphone einrichten',text:`Öffne <b>${esc(appUrl())}</b> auf dem iPhone in Safari, tippe auf „Teilen“ und dann auf „Zum Home-Bildschirm“.
    Starte das Teamboard danach vom Home-Bildschirm und verbinde es dort mit demselben Token und Passwort. Die App auf dem Home-Bildschirm hat einen eigenen Speicher, deshalb nicht in Safari einrichten.<br><br>
    Auf Android wählst du in Chrome im Menü „Zum Startbildschirm hinzufügen“.`,actions:[{label:'Schließen',kind:'primary'}]})}
function openRegion(){
  const cur=getSetting('region','');
  openDrawer({title:'Feiertage',submitLabel:'Speichern',
    body:field('Bundesland',`<select name="region">${REGIONS.map(([v,l])=>`<option value="${v}"${v===cur?' selected':''}>${esc(l)}</option>`).join('')}</select>`)
      +'<p class="d-note">Feiertage erscheinen in der Zeitleiste wie Wochenenden, zählen nicht als Arbeitstage und landen unter „Zu klären“, wenn eine Aufgabe darauf fällt. Die Auswahl gilt auf allen deinen Geräten.</p>',
    onSubmit:v=>{setSetting('region',v.region||'');save();toast(`Feiertage: ${regionName(v.region||'')}`,true)}})}

/* ----- Tour ----- */
/* Steps per layout. sel: CSS selectors, the first visible one is highlighted; without sel the card sits in the middle. */
const TOUR={
  desktop:[
    {hash:'uebersicht',title:'Willkommen im Teamboard',text:'Der Rundgang zeigt dir Schritt für Schritt, wie das Board funktioniert. Er läuft auf Beispieldaten, deine eigenen Daten bleiben unberührt. Pfeiltasten blättern, Esc beendet.'},
    {hash:'uebersicht',sel:['[data-tour=timeline]'],title:'Die Zeitleiste',text:'Jede Person hat eine Zeile. Themen sind Balken über mehrere Tage, Abwesenheiten schraffiert, Aufgaben stehen am Tag ihrer Frist. Zieh mit der Maus über freie Tage, um ein Thema anzulegen, und schieb Balken oder zieh sie länger. Ein Klick auf einen Tag legt eine Aufgabe an. W, 2 und 6 wechseln zwischen einer, zwei und sechs Wochen.'},
    {hash:'uebersicht',sel:['.quick'],title:'Schnellerfassung',text:'Die Taste N springt hierher. Schreib einfach los: „@Lena Angebot prüfen bis Fr“. @ wählt die verantwortliche Person, weitere @-Namen sind beteiligt. „bis“, „am“ oder „zum“ setzt die Frist, auch „morgen“ oder „12. Dezember“. Unter dem Feld siehst du vorher, was entsteht.'},
    {hash:'uebersicht',sel:['.quick'],title:'Kürzel mit #',text:'#ich macht daraus dein eigenes To-do zu einer Person, #wartet etwas, worauf du wartest. #wöchentlich, #monatlich oder #quartalsweise lassen eine Aufgabe wiederkehren. #urlaub, #krank und #schulung tragen eine Abwesenheit ein, etwa „@Jonas #urlaub ab 22.12. bis 2.1.“.'},
    {hash:'uebersicht',sel:['[data-tour=todos]'],title:'Offene Aufgaben',text:'Alles Offene nach Frist sortiert, Überfälliges zuerst. Es gibt drei Arten: Aufgaben deines Teams, deine To-dos zu einer Person („Meins“) und Dinge, auf die du wartest („Wartet“). Die Filter oben trennen sie. Der Haken erledigt, ein Klick auf den Titel öffnet die Details.'},
    {hash:'uebersicht',sel:['[data-tour=issues]'],title:'Zu klären',text:'Hier sammelt das Board, was nicht zusammenpasst: überfällige Themen, Aufgaben am Urlaubstag oder Feiertag, Projekte, die bald ohne Anschluss enden. Ein Klick öffnet den Eintrag, der Haken daneben markiert einen gelben Hinweis als geklärt.'},
    {hash:'uebersicht',sel:['[data-tour=projects]'],title:'Projekte und Abwesenheiten',text:'„Projekte heute“ zeigt, wer gerade bei welchem Kunden ist und wie viele fakturierbar arbeiten. Einsätze haben einen Zeitraum, so bleibt nachvollziehbar, wer wann wo war. Darunter steht die nächste Abwesenheit jeder Person, gestückelte Einträge zusammengefasst; „Mehr anzeigen“ zeigt alle.'},
    {hash:'ma-lena',sel:['[data-tour=talks]'],title:'Die Seite einer Person',text:'Ein Klick auf einen Namen öffnet seine Seite mit Aufgaben, Themen, Projekten und Abwesenheiten. „Fürs nächste Gespräch“ sammelt deine Punkte fürs nächste 1:1, darunter steht der Jahresrückblick.'},
    {hash:'ich',sel:['[data-tour=tasks]'],title:'Meine Planung',text:'Deine eigenen Aufgaben, deine To-dos zu Mitarbeitern und alles, worauf du wartest. Der Filter „Für“ zeigt alles zu einer Person, auch zu Kontakten außerhalb des Teams, praktisch vor einem Jour fixe.'},
    {hash:'verlauf',sel:['[data-tour=history]'],title:'Verlauf',text:'Was erledigt, besprochen oder abgeschlossen ist, Woche für Woche, mit Suche und Filter nach Person und Art. Krankheitstage stehen hier bewusst nicht.'},
    {hash:'uebersicht',sel:['[data-tour=more]'],title:'Mehr, Kürzel und Sync',text:'Unten siehst du, ob alles synchronisiert ist, und die wichtigsten Tastenkürzel. Unter „Mehr“ findest du Kontakte außerhalb des Teams, Sicherungen, den Sicherungsordner, die Feiertage deines Bundeslands und diesen Rundgang.'},
    {hash:'uebersicht',title:'Jetzt dein Board',text:'',end:true}],
  phone:[
    {hash:'uebersicht',title:'Willkommen im Teamboard',text:'Der Rundgang zeigt dir Schritt für Schritt, wie das Teamboard auf dem Smartphone funktioniert. Er läuft auf Beispieldaten, deine eigenen Daten bleiben unberührt.'},
    {hash:'uebersicht',sel:['.m-head'],title:'Heute',text:'Was ansteht, Überfälliges zuerst. Darunter siehst du, wer gerade fehlt, was zu klären ist und wer an welchem Projekt arbeitet.'},
    {hash:'uebersicht',sel:['.tab-plus'],title:'Erfassen',text:'Das Plus erfasst Aufgaben, Themen, Abwesenheiten und Gesprächspunkte. Schreib einfach: „@Lena Angebot prüfen bis Fr“. Mit #urlaub oder #krank wird daraus eine Abwesenheit, mit #monatlich eine wiederkehrende Aufgabe.'},
    {hash:'uebersicht',sel:['.tab-i[href="#team"]'],title:'Team',text:'Das ganze Team auf zwei Wochen: Themen und Abwesenheiten je Person, dazu die Zahl offener Aufgaben.'},
    {hash:'ma-lena',sel:['[data-tour=talks]'],title:'Die Seite einer Person',text:'Tipp auf eine Person öffnet ihre Seite. „Fürs nächste Gespräch“ sammelt deine Punkte fürs nächste 1:1, darunter Projekte, Themen und Abwesenheiten.'},
    {hash:'uebersicht',sel:['.tab-i[href="#ich"]'],title:'Meine Planung',text:'Deine eigenen Aufgaben, deine To-dos zu Mitarbeitern und alles, worauf du wartest.'},
    {hash:'uebersicht',sel:['.tab-i[data-action=more-menu]'],title:'Mehr',text:'Verlauf, Kontakte, Feiertage, Sicherung und dieser Rundgang. Die Planung mit Zeitleiste machst du am besten am Rechner, das Smartphone ist zum Nachschauen und schnellen Erfassen.'},
    {hash:'uebersicht',title:'Jetzt dein Board',text:'',end:true}]};
let tour=null; // {steps, i, back: mode before the tour, hash}
const tourActive=()=>!!tour;
function tourSeen(){try{return JSON.parse(localStorage.getItem(KEY+'.tour')||'{}')}catch(e){return{}}}
function markTourSeen(k){try{localStorage.setItem(KEY+'.tour',JSON.stringify({...tourSeen(),[k]:true}))}catch(e){}}
/* After the first connection on a device: offer the tour once per layout. */
function offerTour(){
  const k=isPhone()?'phone':'desktop';if(tourSeen()[k])return;markTourSeen(k);
  showDialog({title:'Willkommen im Teamboard',text:'Ein kurzer Rundgang mit Beispieldaten zeigt dir die wichtigsten Funktionen. Deine eigenen Daten bleiben dabei unberührt.',
    actions:[{label:'Später',kind:'ghost'},{label:'Rundgang starten',kind:'primary',run:startTour}]})}

async function startTour(){
  if(tour)return;
  closeDrawer(false);closeDialog();hidePop();
  const k=isPhone()?'phone':'desktop';markTourSeen(k);
  tour={steps:TOUR[k],i:0,back:Store.mode,hash:location.hash};
  if(Store.mode==='github'){
    if(Store.dirty)await Store.push(true);
    clearTimeout(Store.timer);Store.mode='demo';S=demo();expireSick();resetUndo();
  }
  ui.filter='alle';ui.off=0;
  const el=document.createElement('div');el.id='tour';el.className='tour';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','tourT');
  el.innerHTML='<div class="tour-hole"></div><div class="tour-card" tabindex="-1"></div>';document.body.appendChild(el);
  document.documentElement.classList.add('touring');
  render();await tourStep(0)}

async function endTour(){
  if(!tour)return;const t=tour;tour=null;
  $('#tour')?.remove();document.documentElement.classList.remove('touring');
  if(t.back==='github'){location.hash=t.hash||'uebersicht';await Store.resume(Store.gh);toast('Zurück auf deinem Board')}
  else{location.hash=t.hash||'uebersicht';render()}}

const nextHash=()=>new Promise(r=>{const done=()=>{window.removeEventListener('hashchange',done);setTimeout(r,30)};window.addEventListener('hashchange',done);setTimeout(done,400)});
async function tourStep(i){
  if(!tour)return;tour.i=Math.max(0,Math.min(i,tour.steps.length-1));const st=tour.steps[tour.i];
  if(st.hash&&location.hash!=='#'+st.hash){const w=nextHash();location.hash=st.hash;await w}
  if(!tour)return;
  const n=tour.steps.length,last=tour.i===n-1,own=tour.back==='github';
  const text=st.end?(own?'Zurück auf deinem Board hilft dir die Karte „Erste Schritte“: Bundesland wählen, Team anlegen, das erste Thema planen. Den Rundgang findest du jederzeit unter „Mehr“.'
    :'Das waren die Beispieldaten. Wenn du das Teamboard mit eigenen Daten nutzen willst, richte es mit deinem GitHub-Konto ein. Den Rundgang findest du jederzeit unter „Mehr“.'):st.text;
  $('#tour .tour-card').innerHTML=`<p class="overline">Rundgang · ${tour.i+1} von ${n}</p><h3 id="tourT">${esc(st.title)}</h3><p>${esc(text)}</p>
    <div class="actions">${last?'':'<button class="btn ghost sm" data-tour="end">Beenden</button>'}<span class="sp"></span>${tour.i?'<button class="btn secondary sm" data-tour="back">Zurück</button>':''}
    <button class="btn primary sm" data-tour="next">${last?(own?'Zu meinem Board':'Rundgang beenden'):tour.i?'Weiter':'Los geht’s'}</button></div>`;
  tourScroll(tourTarget(st));tourPlace();$('#tour [data-tour=next]')?.focus({preventScroll:true})}
/* Scrolls the target to the top when the card fits below it, so target and card are both visible; else to the center. */
function tourScroll(el){
  if(!el||getComputedStyle(el).position==='fixed'||el.closest('#side'))return;
  const ch=$('#tour .tour-card').offsetHeight,h=el.getBoundingClientRect().height;
  if(h+ch+56>innerHeight){el.scrollIntoView({block:'start'});return}
  el.scrollIntoView({block:'start'});let sp=el.parentElement;
  while(sp&&sp!==document.body&&!(/(auto|scroll)/.test(getComputedStyle(sp).overflowY)&&sp.scrollHeight>sp.clientHeight))sp=sp.parentElement;
  (sp&&sp!==document.body?sp:document.scrollingElement).scrollBy(0,-24)}
function tourTarget(st){
  for(const s of st.sel||[]){const el=$(s);if(el&&el.getClientRects().length&&el.getBoundingClientRect().width>0)return el}return null}
/* Positions the highlight over the target and the card next to it (phone: above or below, desktop: the first side with room). */
function tourPlace(){
  if(!tour)return;const st=tour.steps[tour.i],el=tourTarget(st),hole=$('#tour .tour-hole'),card=$('#tour .tour-card');
  const W=innerWidth,H=innerHeight,cw=card.offsetWidth,ch=card.offsetHeight,g=16;
  $('#tour').classList.toggle('center',!el);
  if(!el){hole.style.cssText='';card.style.left=Math.max(g,(W-cw)/2)+'px';card.style.top=Math.max(g,(H-ch)/2)+'px';return}
  const r=el.getBoundingClientRect(),p=8,x=Math.max(4,r.left-p),y=Math.max(4,r.top-p),w=Math.min(W-4,r.right+p)-x,h=Math.min(H-4,r.bottom+p)-y;
  hole.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${Math.min(28,h/2)}px`;
  let cx,cy;
  if(isPhone()&&(y+h+g+ch<=H-g||y-g-ch>=g)){cx=(W-cw)/2;cy=y+h+g+ch<=H-g?y+h+g:y-g-ch}
  else if(y+h+g+ch<=H-g){cx=x;cy=y+h+g}
  else if(y-g-ch>=g){cx=x;cy=y-g-ch}
  else if(x+w+g+cw<=W-g){cx=x+w+g;cy=y}
  else if(x-g-cw>=g){cx=x-g-cw;cy=y}
  else{cx=W-cw-24;cy=H-ch-24} // target fills the screen: card in the corner, on top of it
  card.style.left=Math.max(g,Math.min(cx,W-cw-g))+'px';card.style.top=Math.max(g,Math.min(cy,H-ch-g))+'px'}
document.addEventListener('click',e=>{const b=e.target.closest('#tour [data-tour]');if(!b||!tour)return;const a=b.dataset.tour;
  if(a==='end')endTour();else if(a==='back')tourStep(tour.i-1);else if(tour.i===tour.steps.length-1)endTour();else tourStep(tour.i+1)});
window.addEventListener('keydown',e=>{if(!tour)return;
  if(e.key==='Escape'){e.preventDefault();endTour()}
  else if(e.key==='ArrowRight'){e.preventDefault();if(tour.i<tour.steps.length-1)tourStep(tour.i+1)}
  else if(e.key==='ArrowLeft'){e.preventDefault();tourStep(tour.i-1)}
  else if(e.key==='Tab'){const bs=[...document.querySelectorAll('#tour .tour-card button')];if(!bs.length)return;e.preventDefault();
    const k=bs.indexOf(document.activeElement);bs[(k+(e.shiftKey?-1:1)+bs.length)%bs.length].focus()}
  else if(e.key!=='Enter'&&e.key!==' ')e.preventDefault();
  e.stopImmediatePropagation()},true);
let tourRz=0;const tourReflow=()=>{if(!tour)return;cancelAnimationFrame(tourRz);tourRz=requestAnimationFrame(tourPlace)};
window.addEventListener('resize',tourReflow);document.addEventListener('scroll',tourReflow,true);
