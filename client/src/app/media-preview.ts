/** Small preview made on the sender's device so chats can show a thumbnail and length without downloading the real file. */
export type MediaPreview={thumb?:Blob;duration?:number;width?:number;height?:number};
const THUMB_SIZE=320;

export async function createPreview(file:File):Promise<MediaPreview>{
  const url=URL.createObjectURL(file);
  try{
    const work=file.type.startsWith('image/')?imagePreview(url):file.type.startsWith('video/')?videoPreview(url):file.type.startsWith('audio/')?audioPreview(url):Promise.resolve({});
    // A preview is a nicety; never block sending on a codec the browser cannot decode.
    return await Promise.race([work,new Promise<MediaPreview>(resolve=>setTimeout(()=>resolve({}),8000))]);
  }catch{return {};}
  finally{URL.revokeObjectURL(url);}
}

async function imagePreview(url:string):Promise<MediaPreview>{
  const image=new Image();image.src=url;await image.decode();
  return {thumb:await thumbnail(image,image.naturalWidth,image.naturalHeight),width:image.naturalWidth,height:image.naturalHeight};
}

async function videoPreview(url:string):Promise<MediaPreview>{
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=url;
  try{
    await once(video,'loadeddata');
    const duration=await knownDuration(video);
    video.currentTime=Math.min(1,duration?duration/10:0);await once(video,'seeked');
    return {thumb:await thumbnail(video,video.videoWidth,video.videoHeight),duration,width:video.videoWidth||undefined,height:video.videoHeight||undefined};
  }finally{video.removeAttribute('src');video.load();}
}

async function audioPreview(url:string):Promise<MediaPreview>{
  const audio=document.createElement('audio');audio.preload='metadata';audio.src=url;
  try{await once(audio,'loadedmetadata');return {duration:await knownDuration(audio)};}
  finally{audio.removeAttribute('src');audio.load();}
}

/** MediaRecorder WebM files report Infinity until the browser has scanned to the end. */
async function knownDuration(media:HTMLMediaElement){
  if(!Number.isFinite(media.duration)){media.currentTime=1e101;while(!Number.isFinite(media.duration))await once(media,'durationchange');media.currentTime=0;}
  return media.duration>0?media.duration:undefined;
}

async function thumbnail(source:CanvasImageSource,width:number,height:number){
  if(!width||!height)return undefined;
  const scale=Math.min(1,THUMB_SIZE/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  canvas.getContext('2d')?.drawImage(source,0,0,canvas.width,canvas.height);
  const encode=(type:string)=>new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,0.7));
  // Safari falls back to PNG for WebP; JPEG keeps the preview small there.
  const webp=await encode('image/webp');return webp?.type==='image/webp'?webp:(await encode('image/jpeg'))||undefined;
}

function once(target:HTMLMediaElement,event:string){
  return new Promise<void>((resolve,reject)=>{
    const done=()=>{target.removeEventListener(event,done);target.removeEventListener('error',fail);resolve();};
    const fail=()=>{target.removeEventListener(event,done);target.removeEventListener('error',fail);reject(new Error('Could not read this media.'));};
    target.addEventListener(event,done);target.addEventListener('error',fail);
  });
}
