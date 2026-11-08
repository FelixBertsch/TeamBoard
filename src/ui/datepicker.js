/* Calendar for date fields on laptop and monitor (dateIn() in drawer.js). The native picker of Chrome and Edge follows the browser
   language and cannot be styled, so this one replaces it there; the phone keeps the native picker (isPhone()).
   Popover with position:fixed below the field: German, week starts on Monday, ISO week numbers, "Heute" and "Leeren".
   Keys: arrows move the day, PageUp/PageDown the month, Home/End the week, Enter picks, Esc closes only the calendar.
   Alt+ArrowDown in the date field opens it. Picking writes TT.MM.JJJJ into the field and fires "change" like typing would. */
let dp=null; // {input, btn, el, m: first day of the shown month, f: focused day} (day numbers)
const DP_WD=['Mo','Di','Mi','Do','Fr','Sa','So'];
const ymOf=n=>{const d=new Date(n*DAYMS);return[d.getUTCFullYear(),d.getUTCMonth()]};
const monthStart=(y,m)=>dn(`${y}-${String(m+1).padStart(2,'0')}-01`);
const addMonths=(n,k)=>{const[y,m]=ymOf(n),t=y*12+m+k;return monthStart(Math.floor(t/12),t%12)};
function dpHTML(){
  const[y,m]=ymOf(dp.m),next=addMonths(dp.m,1),iso=parseDeDate(dp.input.value),sel=iso?dn(iso):null,first=mondayOf(dp.m);
  let rows='';
  for(let w=0;w<6;w++){const s=first+w*7;rows+=`<tr><th scope="row" class="dp-kw">${isoWeek(s)}</th>`;
    for(let i=0;i<7;i++){const d=s+i,hol=holidayOn(d),cl=['dp-d'];if(d<dp.m||d>=next)cl.push('out');if(i>4||hol)cl.push('we');if(hol)cl.push('hol');if(d===TDN)cl.push('td');if(d===sel)cl.push('sel');
      rows+=`<td><button type="button" class="${cl.join(' ')}" data-dp="${d}" tabindex="${d===dp.f?0:-1}" aria-label="${longDay(ds(d))}${hol?`, ${esc(hol)}`:''}${d===TDN?', heute':''}"${hol?` title="${esc(hol)}"`:''}${d===sel?' aria-pressed="true"':''}>${new Date(d*DAYMS).getUTCDate()}</button></td>`}
    rows+='</tr>'}
  return`<div class="dp-head"><button type="button" class="icon-btn" data-dp-nav="-1" aria-label="Voriger Monat">${ic('chevL',20)}</button><b aria-live="polite">${MON[m]} ${y}</b>`
    +`<button type="button" class="icon-btn" data-dp-nav="1" aria-label="Nächster Monat">${ic('chevR',20)}</button></div>`
    +`<table class="dp-grid"><thead><tr><th scope="col" class="dp-kw" title="Kalenderwoche">KW</th>${DP_WD.map(d=>`<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
    +`<div class="dp-foot"><button type="button" class="btn ghost sm" data-dp-set="today">Heute</button><button type="button" class="btn ghost sm" data-dp-set="clear">Leeren</button></div>`;
}
function dpDraw(focus){dp.el.innerHTML=dpHTML();if(focus)dp.el.querySelector(`[data-dp="${dp.f}"]`)?.focus({preventScroll:true})}
function dpPlace(){const r=dp.input.closest('.date-in').getBoundingClientRect(),w=dp.el.offsetWidth,h=dp.el.offsetHeight;
  let x=Math.min(Math.max(8,r.right-w),innerWidth-w-8),y=r.bottom+6;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-6);
  dp.el.style.left=x+'px';dp.el.style.top=y+'px'}
function openDp(btn){
  const input=btn.closest('.date-in').querySelector('[data-date]');
  if(dp){const same=dp.input===input;closeDp(false);if(same)return}
  const iso=parseDeDate(input.value),f=iso?dn(iso):TDN;
  const el=document.createElement('div');el.id='dp';el.className='dp';el.setAttribute('role','dialog');el.setAttribute('aria-label','Datum wählen');
  document.body.appendChild(el);
  dp={input,btn,el,m:monthStart(...ymOf(f)),f};btn.setAttribute('aria-expanded','true');
  el.addEventListener('click',dpClick);
  dpDraw(true);dpPlace();
}
function closeDp(refocus=true){if(!dp)return;const{el,btn,input}=dp;dp=null;el.remove();btn.removeAttribute('aria-expanded');if(refocus&&input.isConnected)input.focus({preventScroll:true})}
function dpPick(iso){const input=dp.input;input.value=deDate(iso);closeDp();input.dispatchEvent(new Event('change',{bubbles:true}))}
function dpMove(f){dp.f=f;if(f<dp.m||f>=addMonths(dp.m,1))dp.m=monthStart(...ymOf(f));dpDraw(true)}
function dpClick(e){
  const d=e.target.closest('[data-dp]');if(d){dpPick(ds(+d.dataset.dp));return}
  const n=e.target.closest('[data-dp-nav]');
  if(n){const k=+n.dataset.dpNav,day=new Date(dp.f*DAYMS).getUTCDate();dp.m=addMonths(dp.m,k);
    dp.f=Math.min(dp.m+day-1,addMonths(dp.m,1)-1);dpDraw(false);dp.el.querySelector(`[data-dp-nav="${k}"]`).focus();return}
  const s=e.target.closest('[data-dp-set]');if(!s)return;
  if(s.dataset.dpSet==='today')dpPick(TODAY);
  else{const input=dp.input;input.value='';closeDp();input.dispatchEvent(new Event('change',{bubbles:true}))}
}
/* Called first in the keydown handler of events.js; true = the key was handled here. */
function dpKey(e){
  if(!dp){if(e.altKey&&e.key==='ArrowDown'&&e.target.matches?.('[data-date]')){const b=e.target.closest('.date-in').querySelector('button.date-pick');
    if(b){e.preventDefault();openDp(b);return true}}return false}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDp();return true}
  if(!e.target.closest?.('[data-dp]'))return false;
  const k={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key],wd=(wdOf(dp.f)+6)%7;
  if(k){e.preventDefault();dpMove(dp.f+k);return true}
  if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();const day=new Date(dp.f*DAYMS).getUTCDate(),m=addMonths(dp.m,e.key==='PageUp'?-1:1);
    dp.m=m;dpMove(Math.min(m+day-1,addMonths(m,1)-1));return true}
  if(e.key==='Home'){e.preventDefault();dpMove(dp.f-wd);return true}
  if(e.key==='End'){e.preventDefault();dpMove(dp.f+6-wd);return true}
  return false;
}
document.addEventListener('pointerdown',e=>{if(dp&&!e.target.closest('#dp')&&e.target.closest('.date-pick')!==dp.btn)closeDp(false)},true);
document.addEventListener('focusout',e=>{if(!dp)return;const to=e.relatedTarget;if(to&&!to.closest('#dp')&&to!==dp.btn&&to!==dp.input)closeDp(false)});
document.addEventListener('scroll',e=>{if(dp&&!e.target.closest?.('#dp'))closeDp(false)},true);
window.addEventListener('resize',()=>{if(dp)closeDp(false)});
