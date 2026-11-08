/* Sidebar: full sidebar (monitor), icon bar (laptop) or bottom tab bar (phone). */

/* Logo on navy: full logo in the sidebar, symbol only in the icon bar (CSS picks one). */
const brandHTML=()=>'<div class="brand"><img class="brand-logo" src="assets/brand/logo-dark.svg" alt="Teamboard" width="198" height="30">'
  +'<img class="brand-mark" src="assets/brand/symbol-dark.svg" alt="Teamboard" width="40" height="30"></div>';

/* Keyboard shortcuts, listed in the sidebar footer and in "Mehr". Keep in step with the keyboard handler in events.js. */
const MORE_SUB=()=>Store.mode==='demo'?'Feiertage und Rundgang':'Kontakte und Sicherung';
const KEYS=[[['N'],'Aufgabe erfassen'],[['W','2','6'],'Zeitraum wechseln'],[['Strg','Z'],'Rückgängig']];
const keysHTML=()=>`<dl class="keys">${KEYS.map(([k,l])=>`<dt>${k.map(x=>`<kbd>${x}</kbd>`).join('')}</dt><dd>${l}</dd>`).join('')}</dl>`;

function renderSide(r){
  const open=S.todos.filter(t=>!t.done);
  const meCount=open.filter(t=>t.personId==='me'||(t.kind==='mine'&&isActive(t.personId))).length;
  const cur=id=>(r.view==='person'&&r.id===id)?' aria-current="page"':'';
  if(isPhone()){const on=c=>c?' aria-current="page"':'',team=r.view==='team'||(r.view==='person'&&r.id!=='me');
    $('#side').innerHTML=`<a class="tab-i" href="#uebersicht" aria-label="Heute"${on(r.view==='overview')}>${ic('sun',24)}<span>Heute</span></a>
      <a class="tab-i" href="#team" aria-label="Team"${on(team)}>${ic('users',24)}<span>Team</span></a>
      <button class="tab-plus" data-action="capture" aria-label="Neu erfassen">${ic('plus',28,2.5)}</button>
      <a class="tab-i" href="#ich" aria-label="Meine Planung"${cur('me')}>${ic('user',24)}<span>Ich</span>${meCount?`<span class="cnt">${meCount}</span>`:''}</a>
      <button class="tab-i" data-action="more-menu" aria-label="Mehr">${ic('more',24,2.5)}<span>Mehr</span></button>`;return}
  let h=`${brandHTML()}
  <a class="nav" href="#uebersicht" title="Übersicht"${r.view==='overview'||r.view==='team'?' aria-current="page"':''}><span class="nav-icon">${ic('grid',16)}</span><span class="nm"><b>Übersicht</b><small>Ganzes Team</small></span></a>
  <a class="nav" href="#ich" title="Meine Planung"${cur('me')}>${avatar(ME)}<span class="nm"><b>Meine Planung</b><small>Eigene Aufgaben und To-dos</small></span>${meCount?`<span class="cnt">${meCount}</span>`:''}</a>
  <a class="nav" href="#verlauf" title="Verlauf"${r.view==='history'?' aria-current="page"':''}><span class="nav-icon">${ic('history',16)}</span><span class="nm"><b>Verlauf</b><small>Erledigtes, Urlaub, Projekte</small></span></a>
  <div class="side-label">Team</div>`;
  for(const p of team()){const a=absentOn(p.id,TODAY),n=open.filter(t=>t.personId===p.id&&t.kind==='team').length;
    h+=`<a class="nav" href="${hrefOf(p.id)}" title="${esc(p.name)}${a?`, ${esc(absLabel(a.kind))} bis ${dm(a.end)}`:projectLabel(p.id)?`, ${esc(projectLabel(p.id))}`:''}"${cur(p.id)}>${avatar(p)}${a?'<span class="adot"></span>':''}<span class="nm"><b>${esc(p.name)}</b>
      <small>${a?`<span class="dot"></span>${esc(absLabel(a.kind))} bis ${dm(a.end)}`:esc(teamLine(p)||'Kein Team')}</small></span>${n?`<span class="cnt">${n}</span>`:''}</a>`}
  h+=`<button class="nav add" data-action="new-person" title="Person hinzufügen" aria-label="Person hinzufügen"><span class="nav-icon">${ic('userPlus',16)}</span><span class="nm"><b>Person hinzufügen</b></span></button>
  <div class="side-low" data-tour="more">
  <button class="nav more-btn" data-action="more-menu" title="Mehr: Kontakte, Sicherung, Feiertage, Rundgang" aria-label="Mehr"><span class="nav-icon">${ic('more',16,2.5)}</span><span class="nm"><b>Mehr</b><small>${MORE_SUB()}</small></span></button>
  <div class="side-foot">${keysHTML()}${syncHTML()}</div></div>`;
  $('#side').innerHTML=h;
}
