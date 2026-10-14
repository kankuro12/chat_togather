declare const self:ServiceWorkerGlobalScope;
declare const __PRECACHE__:string[];
declare const __CACHE_VERSION__:string;
const cacheName='together-shell-'+__CACHE_VERSION__;
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(__PRECACHE__))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('together-shell-')&&key!==cacheName)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')void self.skipWaiting();});
/** "Share with Together" from the phone's share sheet: keep what was shared, then open the app to choose where it goes. */
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='POST'||url.origin!==self.location.origin||url.pathname!=='/share-target')return;
  event.respondWith((async()=>{
    const form=await event.request.formData();const cache=await caches.open('together-share');for(const key of await cache.keys())await cache.delete(key);
    const text=[...new Set(['title','text','url'].map(name=>form.get(name)).filter((value):value is string=>typeof value==='string'&&!!value.trim()).map(value=>value.trim()))].join('\n');
    const files=form.getAll('media').filter((value):value is File=>value instanceof File&&value.size>0).slice(0,10);
    await cache.put('/share/meta',new Response(JSON.stringify({text,files:files.map(file=>({name:file.name,type:file.type}))})));
    for(const [index,file] of files.entries())await cache.put('/share/file/'+index,new Response(file,{headers:{'content-type':file.type||'application/octet-stream'}}));
    return Response.redirect('/#share',303);
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
  if(request.mode==='navigate'){event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')||Response.error()));return;}
  if(__PRECACHE__.includes(url.pathname))event.respondWith(caches.match(url.pathname).then(response=>response||fetch(request)));
});
