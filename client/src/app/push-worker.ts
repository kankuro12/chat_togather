let pending:Promise<unknown>=Promise.resolve();

// Serialize shell and push registration so shell startup cannot replace Firebase config.
export function registerPushWorker(container:ServiceWorkerContainer,script?:string):Promise<ServiceWorkerRegistration>{
  const next=pending.then(async()=>{
    const existing=await container.getRegistration('/');
    if(!script&&existing){void existing.update().catch(()=>{});return existing;}
    return container.register(script||'/firebase-messaging-sw.js',{scope:'/'});
  });
  pending=next.catch(()=>{});return next;
}

export async function activatePushWorker(registration:ServiceWorkerRegistration):Promise<void>{
  const worker=registration.installing||registration.waiting;
  if(!worker)return;
  worker.postMessage({type:'ACTIVATE'});
  if(worker.state==='activated')return;
  await new Promise<void>((resolve,reject)=>{
    const finish=()=>{clearTimeout(timeout);worker.removeEventListener('statechange',changed);};
    const changed=()=>{if(worker.state==='activated'){finish();resolve();}else if(worker.state==='redundant'){finish();reject(new Error('Notification setup failed. Refresh and try again.'));}};
    const timeout=setTimeout(()=>{finish();reject(new Error('Notification setup timed out. Refresh and try again.'));},20000);
    worker.addEventListener('statechange',changed);changed();
  });
}
