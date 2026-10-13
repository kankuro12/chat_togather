export type Facing='user'|'environment';
export const otherFacing=(facing:Facing):Facing=>facing==='user'?'environment':'user';

/** True when switching cameras makes sense. Before camera permission browsers hide the real count,
 *  so touch devices (phones, tablets) are assumed to have front and back cameras. */
export async function canSwitchCamera(){
  try{
    const cameras=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');
    if(cameras.length>1)return true;
    const unknown=cameras.every(camera=>!camera.label);
    return unknown&&matchMedia('(pointer:coarse)').matches;
  }catch{return false;}
}
