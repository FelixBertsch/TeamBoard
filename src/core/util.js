/* Basics: constants, day numbers, formatting, small DOM helpers.
   All dates are day numbers in UTC (dn/ds), never Date arithmetic across days. That avoids DST bugs. */

const KEY='teamboard.v1', LANE=36, CH=28;
let LABEL=200; // width of the timeline label column, set by applyLayout()
const WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
const WDL=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYMS=86400000;
const dn=s=>{const [y,m,d]=s.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/DAYMS)};
const ds=n=>new Date(n*DAYMS).toISOString().slice(0,10);
const _now=new Date();
const TDN=Math.round(Date.UTC(_now.getFullYear(),_now.getMonth(),_now.getDate())/DAYMS);
const TODAY=ds(TDN);
const wdOf=n=>new Date(n*DAYMS).getUTCDay();
const mondayOf=n=>n-((wdOf(n)+6)%7);
function isoWeek(n){const d=new Date(n*DAYMS);const k=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-k+3);
  const ft=new Date(Date.UTC(d.getUTCFullYear(),0,4));return 1+Math.round(((d-ft)/DAYMS-3+((ft.getUTCDay()+6)%7))/7)}
const dm=s=>{const d=new Date(dn(s)*DAYMS);return `${d.getUTCDate()}.${d.getUTCMonth()+1}.`};
const dmN=n=>dm(ds(n));
const dmy=s=>dm(s)+s.slice(0,4); // "6.11.2026"
/* Date fields show TT.MM.JJJJ regardless of the browser language (native date inputs follow it, e.g. mm/dd/yyyy). */
const deDate=s=>s?`${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(0,4)}`:''; // "06.11.2026"
function parseDeDate(t){t=(t||'').trim();if(!t)return'';let y,m,d,x;
  if((x=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)))[,y,m,d]=x;
  else if((x=t.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4})?)?$/))){[,d,m,y]=x;y=!y?TODAY.slice(0,4):y.length===2?'20'+y:y}
  else return null;
  const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return ds(dn(iso))===iso?iso:null} // null = invalid
const longDay=s=>`${WDL[wdOf(dn(s))]}, ${dm(s)}`;
function dueLabel(s){const d=dn(s)-TDN;if(d===0)return'heute';if(d===1)return'morgen';if(d===-1)return'gestern';return `${WD[wdOf(dn(s))]} ${dm(s)}`}
function workdays(a,b){let n=0;for(let i=dn(a);i<=dn(b);i++){const w=wdOf(i);if(w>0&&w<6&&!holidayOn(i))n++}return n} // Monday to Friday without holidays
function fmtRange(a,b){const da=new Date(a*DAYMS),db=new Date(b*DAYMS);
  const left=da.getUTCMonth()===db.getUTCMonth()?`${da.getUTCDate()}.`:`${da.getUTCDate()}. ${MON[da.getUTCMonth()]}`;
  return `${left} bis ${db.getUTCDate()}. ${MON[db.getUTCMonth()]}`}
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
