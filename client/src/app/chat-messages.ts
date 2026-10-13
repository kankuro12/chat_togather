export function mergeMessages<T extends {id:string}>(earlier:T[],latest:T[]):T[]{
  const seen=new Set<string>();
  return [...earlier,...latest].filter(message=>{
    if(seen.has(message.id))return false;
    seen.add(message.id);return true;
  });
}

/** Adds newly fetched messages in server order; returns the same array when nothing is new so views do not re-render. */
export function appendMessages<T extends {id:string;created_at:string}>(current:T[],incoming:T[]):T[]{
  const known=new Set(current.map(message=>message.id));const fresh=incoming.filter(message=>!known.has(message.id));
  if(!fresh.length)return current;
  return [...current,...fresh].sort((a,b)=>a.created_at<b.created_at?-1:a.created_at>b.created_at?1:a.id<b.id?-1:a.id>b.id?1:0);
}
