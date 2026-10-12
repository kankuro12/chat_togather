declare const self:ServiceWorkerGlobalScope;
declare const __PRECACHE__:string[];
declare const __CACHE_VERSION__:string;
const cacheName='together-shell-'+__CACHE_VERSION__;
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(__PRECACHE__))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('together-shell-')&&key!==cacheName)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')void self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
  if(request.mode==='navigate'){event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')||Response.error()));return;}
  if(__PRECACHE__.includes(url.pathname))event.respondWith(caches.match(url.pathname).then(response=>response||fetch(request)));
});
