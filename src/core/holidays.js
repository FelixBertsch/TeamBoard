/* Public holidays in Germany: the nine nationwide ones plus those of the state chosen under "Feiertage" (setting `region`,
   synced with the data). Fixed dates plus the movable feasts around Easter, computed per year, so there is no data source
   and no yearly update. Sundays are holidays by law anyway and are not listed (Ostersonntag, Pfingstsonntag in Brandenburg).
   Holidays that apply only in some municipalities (Fronleichnam in parts of Sachsen and Thüringen, Mariä Himmelfahrt in
   parts of Bayern, Augsburger Friedensfest) are left out; users add them as own days off.
   Own days off (setting `ownDays`, also synced): days the company gives off on top, e.g. Heiligabend. Entries {date, name},
   date 'MM-DD' every year or 'YYYY-MM-DD' once. They count like holidays everywhere; only labels call them "frei". */
const REGIONS=[['','Nur bundesweite Feiertage'],['BW','Baden-Württemberg'],['BY','Bayern'],['BE','Berlin'],['BB','Brandenburg'],['HB','Bremen'],
  ['HH','Hamburg'],['HE','Hessen'],['MV','Mecklenburg-Vorpommern'],['NI','Niedersachsen'],['NW','Nordrhein-Westfalen'],['RP','Rheinland-Pfalz'],
  ['SL','Saarland'],['SN','Sachsen'],['ST','Sachsen-Anhalt'],['SH','Schleswig-Holstein'],['TH','Thüringen']];
const regionName=r=>(REGIONS.find(x=>x[0]===r)||REGIONS[0])[1];
/* Regional holidays: [states, since year, name, date]. date is 'MM-DD' or a day offset from Easter Sunday. */
const REGIONAL_HOLIDAYS=[
  [['BW','BY','ST'],0,'Heilige Drei Könige','01-06'],
  [['BE'],2019,'Internationaler Frauentag','03-08'],[['MV'],2023,'Internationaler Frauentag','03-08'],
  [['BW','BY','HE','NW','RP','SL'],0,'Fronleichnam',60],
  [['SL'],0,'Mariä Himmelfahrt','08-15'],
  [['TH'],2019,'Weltkindertag','09-20'],
  [['BB','MV','SN','ST','TH'],0,'Reformationstag','10-31'],[['HB','HH','NI','SH'],2018,'Reformationstag','10-31'],
  [['BW','BY','NW','RP','SL'],0,'Allerheiligen','11-01'],
];
function easterSunday(y){ // Gregorian computus (Meeus/Jones/Butcher); returns a day number
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
    i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
  return dn(`${y}-${String(Math.floor(n/31)).padStart(2,'0')}-${String(n%31+1).padStart(2,'0')}`)}
const holYears={},NO_DAYS=[];let holOwn=NO_DAYS;
const ownDays=()=>getSetting('ownDays',NO_DAYS);
/* {dayNumber: name} for one year and the chosen state, cached. legal=true leaves out the own days off. */
function holidaysOf(y,region=getSetting('region',''),legal=false){
  const own=ownDays();if(own!==holOwn){for(const k in holYears)if(!k.endsWith(':L'))delete holYears[k];holOwn=own} // setOwnDays() and sync replace the array
  const key=region+':'+y+(legal?':L':'');if(holYears[key])return holYears[key];
  const e=easterSunday(y),m={},fix=(md,name)=>{m[dn(`${y}-${md}`)]=name};
  fix('01-01','Neujahr');m[e-2]='Karfreitag';m[e+1]='Ostermontag';fix('05-01','Tag der Arbeit');m[e+39]='Christi Himmelfahrt';
  m[e+50]='Pfingstmontag';fix('10-03','Tag der Deutschen Einheit');fix('12-25','1. Weihnachtstag');fix('12-26','2. Weihnachtstag');
  for(const[states,since,name,when]of REGIONAL_HOLIDAYS)if(states.includes(region)&&y>=since){if(typeof when==='number')m[e+when]=name;else fix(when,name)}
  if(region==='SN'){const bb=dn(`${y}-11-22`);m[bb-(wdOf(bb)+4)%7]='Buß- und Bettag'} // Wednesday before 23 November
  if(!legal)for(const{date,name}of own){if(date.length===5){if(!m[dn(`${y}-${date}`)])fix(date,name)}else if(date.startsWith(y+'-')&&!m[dn(date)])m[dn(date)]=name}
  return holYears[key]=m}
/* Name of the holiday on day number n, or null. */
const holidayOn=n=>holidaysOf(new Date(n*DAYMS).getUTCFullYear())[n]||null;
/* True when day number n is free only because of an own day off. */
const isOwnDay=n=>{const y=new Date(n*DAYMS).getUTCFullYear();return!!holidaysOf(y)[n]&&!holidaysOf(y,undefined,true)[n]};
/* Tooltip and label: "Heiligabend, frei" or "Karfreitag, Feiertag". */
const holLabel=n=>{const h=holidayOn(n);return h?`${h}, ${isOwnDay(n)?'frei':'Feiertag'}`:''};
/* Own day off whose date overlaps the given one ('MM-DD' or 'YYYY-MM-DD'), or undefined. */
const ownDayAt=date=>ownDays().find(o=>o.date===date||o.date.slice(-5)===date||date.slice(-5)===o.date);
function setOwnDays(list){setSetting('ownDays',list.sort((a,b)=>a.date.slice(-5).localeCompare(b.date.slice(-5))||a.date.localeCompare(b.date)))}
/* "Hessen" or "Hessen, 2 eigene" for menus and toasts. */
const holidaySummary=()=>{const n=ownDays().length;return regionName(getSetting('region',''))+(n?`, ${n} eigene`:'')};
