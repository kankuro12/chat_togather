import NepaliDate from 'nepali-date-converter';
const pad=(n:number)=>String(n).padStart(2,'0');
const localDate=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
export function adToBs(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Choose a valid date.');
  const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day);
  if(localDate(date)!==value)throw new Error('Choose a valid date.');
  return new NepaliDate(date).format('YYYY-MM-DD');
}
export function bsToAd(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Enter a BS date as YYYY-MM-DD.');
  const [year,month,day]=value.split('-').map(Number);
  try{const date=new NepaliDate(year,month-1,day);if(date.format('YYYY-MM-DD')!==value)throw new Error();return localDate(date.toJsDate());}
  catch{throw new Error('Choose a valid BS date within the supported calendar range.');}
}
