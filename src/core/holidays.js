/* Public holidays in Germany: the nine nationwide ones plus those of the state chosen under "Feiertage" (setting `region`,
   synced with the data). Fixed dates plus the movable feasts around Easter, computed per year, so there is no data source
   and no yearly update. Sundays are holidays by law anyway and are not listed (Ostersonntag, Pfingstsonntag in Brandenburg).
   Holidays that apply only in some municipalities (Fronleichnam in parts of Sachsen and Thüringen, Mariä Himmelfahrt in
   parts of Bayern, Augsburger Friedensfest) are left out; add them via CFG.extraHolidays. */
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
const holYears={};
/* {dayNumber: name} for one year and the chosen state, cached. */
function holidaysOf(y,region=getSetting('region','')){
  const key=region+':'+y;if(holYears[key])return holYears[key];
  const e=easterSunday(y),m={},fix=(md,name)=>{m[dn(`${y}-${md}`)]=name};
  fix('01-01','Neujahr');m[e-2]='Karfreitag';m[e+1]='Ostermontag';fix('05-01','Tag der Arbeit');m[e+39]='Christi Himmelfahrt';
  m[e+50]='Pfingstmontag';fix('10-03','Tag der Deutschen Einheit');fix('12-25','1. Weihnachtstag');fix('12-26','2. Weihnachtstag');
  for(const[states,since,name,when]of REGIONAL_HOLIDAYS)if(states.includes(region)&&y>=since){if(typeof when==='number')m[e+when]=name;else fix(when,name)}
  if(region==='SN'){const bb=dn(`${y}-11-22`);m[bb-(wdOf(bb)+4)%7]='Buß- und Bettag'} // Wednesday before 23 November
  for(const[k,name]of Object.entries(CFG.extraHolidays||{})){if(/^\d\d-\d\d$/.test(k))fix(k,name);else if(k.startsWith(y+'-'))m[dn(k)]=name}
  return holYears[key]=m}
/* Name of the holiday on day number n, or null. */
const holidayOn=n=>holidaysOf(new Date(n*DAYMS).getUTCFullYear())[n]||null;
