/** Calendar-day helpers shared by Home and the Us tab (kept separate so Home does not load the Us page). */
export const localDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const dayNumber=(day:string)=>Math.round(Date.parse(day+'T00:00:00Z')/86400000);
/** Same rule as the server: yearly dates come round every year; Feb 29 falls on Feb 28 otherwise. */
export function nextOccurrence(date:string,today:string,yearly:boolean){
  if(!yearly)return date>=today?date:null;
  const [,m,d]=date.split('-').map(Number);const year=Number(today.slice(0,4));
  for(const y of [year,year+1]){const leap=(y%4===0&&y%100!==0)||y%400===0;const candidate=`${y}-${String(m).padStart(2,'0')}-${String(m===2&&d===29&&!leap?28:d).padStart(2,'0')}`;if(candidate>=today)return candidate;}
  return null;
}
/** "2 years, 3 months, 5 days" between two calendar days. */
export function together(start:string,today:string){
  const [y1,m1,d1]=start.split('-').map(Number),[y2,m2,d2]=today.split('-').map(Number);
  let years=y2-y1,months=m2-m1,days=d2-d1;
  if(days<0){months--;days+=new Date(Date.UTC(y2,m2-1,0)).getUTCDate();}
  if(months<0){years--;months+=12;}
  if(years<0)return '';
  const part=(n:number,word:string)=>n?`${n} ${word}${n===1?'':'s'}`:'';
  return [part(years,'year'),part(months,'month'),part(days,'day')].filter(Boolean).join(', ')||'Starting today';
}
