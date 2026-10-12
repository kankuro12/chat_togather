export function isChoiceNotification(notification:{tag?:string;data?:unknown}):boolean{
  const data=notification.data as {page?:string;kind?:string;FCM_MSG?:{data?:{page?:string;kind?:string}}}|undefined;
  const payload=data?.FCM_MSG?.data;
  return notification.tag?.startsWith('choice:')===true||data?.page==='choices'||data?.kind==='choice'||payload?.page==='choices'||payload?.kind==='choice';
}
