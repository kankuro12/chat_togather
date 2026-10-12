export function mergeMessages<T extends {id:string}>(earlier:T[],latest:T[]):T[]{
  const seen=new Set<string>();
  return [...earlier,...latest].filter(message=>{
    if(seen.has(message.id))return false;
    seen.add(message.id);return true;
  });
}
