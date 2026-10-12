export function normalizeServerUrl(value:string,native:boolean){
  const normalized=value.trim().replace(/\/$/,'');
  if(!normalized){if(native)throw new Error('Enter your Together server HTTPS address.');return '';}
  let url:URL;try{url=new URL(normalized);}catch{throw new Error('Enter a valid server address.');}
  if(native&&url.protocol!=='https:')throw new Error('Native apps require an HTTPS backend to protect your private content.');
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTP or HTTPS backend address without credentials, query or fragment.');
  return normalized;
}
