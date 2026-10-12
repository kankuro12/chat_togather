/** All app upload paths share this conversion; original image metadata is stripped. */
export async function compressImage(file:File):Promise<File>{
  if(!file.type.startsWith('image/'))return file;
  if(file.size>40*1024*1024)throw new Error('Choose a photo smaller than 40 MB.');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Photo compression unavailable. Please try another browser.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not compress this photo.')),'image/webp',0.8));
    if(blob.type!=='image/webp')throw new Error('This browser cannot compress photos to WebP. Please update your browser.');
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp',lastModified:file.lastModified});
  }catch(error){if(error instanceof Error&&error.name==='EncodingError')throw new Error('Could not read this photo. Choose another image.');throw error;}
  finally{URL.revokeObjectURL(url);}
}
