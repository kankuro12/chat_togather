export function localDateTime(value:Date){return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}T${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`;}
function candidates(value:string){
  const date=new Date(value);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!Number.isFinite(date.getTime())||localDateTime(date)!==value)throw new Error('This time does not exist in your local timezone. Choose another time.');
  const offsets=new Set([date.getTimezoneOffset(),new Date(date.getTime()-86400000).getTimezoneOffset(),new Date(date.getTime()+86400000).getTimezoneOffset()]);
  return [...offsets].map(offset=>new Date(date.getTime()+(offset-date.getTimezoneOffset())*60000)).filter(candidate=>localDateTime(candidate)===value).sort((a,b)=>a.getTime()-b.getTime());
}
export function localInstant(value:string,occurrence:'reject'|'earlier'|'later'='reject'){
  const matches=candidates(value);
  if(matches.length>1&&occurrence==='reject')throw new Error('This time occurs twice. Choose the first or second occurrence.');
  return (occurrence==='later'?matches[matches.length-1]:matches[0]).toISOString();
}
export function repeatedLocalTime(value:string){try{return candidates(value).length>1;}catch{return false;}}
