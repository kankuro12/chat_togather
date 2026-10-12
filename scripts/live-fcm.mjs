import {chromium,request} from '@playwright/test';
import {io} from 'socket.io-client';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const web=process.env.LIVE_WEB_URL||'https://togather.dairyco.com.np';
const apiURL=process.env.LIVE_API_URL||'https://api.togather.dairyco.com.np';
const api=await request.newContext({baseURL:apiURL});
const report={web,started:new Date().toISOString(),users:[],checks:[]};
let context,sender,recipient,socket;
const auth=user=>({Authorization:'Bearer '+user.token});
const check=(name,result)=>{report.checks.push({name,...result});console.log(name,JSON.stringify(result));};
async function json(response){assert.ok(response.ok(),`API status ${response.status()}: ${await response.text()}`);return response.json();}
async function notifications(){
  const worker=context.serviceWorkers().find(worker=>worker.url().includes('firebase-messaging-sw.js?config='));
  assert.ok(worker,'Firebase-configured service worker missing');
  return worker.evaluate(async()=> (await self.registration.getNotifications()).map(n=>({title:n.title,body:n.body,tag:n.tag,data:n.data,actions:n.actions.map(a=>a.action)})));
}
async function waitForNotification(tag){
  const until=Date.now()+60000;
  while(Date.now()<until){const all=await notifications();const found=all.find(n=>n.tag===tag);if(found)return found;await new Promise(resolve=>setTimeout(resolve,1000));}
  console.log('notification-audit',JSON.stringify((await notifications()).map(n=>({title:n.title,tag:n.tag}))));
  throw new Error('No background notification for '+tag+' within 60 seconds');
}
try{
  for(const name of ['FCMLiveSender','FCMLiveRecipient']){
    const user=await json(await api.post('/api/auth/register',{data:{name,email:`${name.toLowerCase()}-${randomUUID()}@example.com`,password:randomBytes(24).toString('hex')}}));
    report.users.push(user.user.id);if(!sender)sender=user;else recipient=user;
  }
  const invite=await json(await api.post('/api/pair/invite',{headers:auth(sender),data:{}}));
  await json(await api.post('/api/pair/join',{headers:auth(recipient),data:{code:invite.code}}));
  const config=await json(await api.get('/api/communication/config',{headers:auth(recipient)}));
  assert.ok(config.notifications&&config.firebase&&config.vapidKey,'Server push config incomplete');
  check('server-config',{notifications:true,project:config.firebase.projectId});
  context=await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(),'together-live-fcm-')),{channel:'chrome',headless:process.env.LIVE_HEADLESS==='1',permissions:['notifications'],ignoreDefaultArgs:['--disable-background-networking'],args:['--no-first-run']});
  await context.addInitScript(token=>localStorage.setItem('together.session',token),recipient.token);
  const page=await context.newPage();
  page.on('console',message=>{if(message.type()==='error')console.log('browser-error',message.text());});
  page.on('pageerror',error=>console.log('page-error',error.message));
  await page.goto(web);await page.getByLabel('Account menu').click();
  await page.getByRole('button',{name:'Enable notifications',exact:true}).click();
  await page.getByRole('button',{name:'Turn off push',exact:true}).waitFor({timeout:90000});
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration('/');await registration.showNotification('Together notification permission check',{tag:'live-permission-check'});const notifications=await registration.getNotifications({tag:'live-permission-check'});if(!notifications.length)throw new Error('Browser cannot display notifications');notifications.forEach(n=>n.close());});
  check('registration',{permission:await page.evaluate(()=>Notification.permission),worker:(await notifications(),context.serviceWorkers().find(w=>w.url().includes('?config='))?'configured':'missing')});
  await page.close();
  assert.equal(context.pages().filter(p=>p.url().startsWith(web)).length,0);
  check('pwa-closed',{originTabs:0,sessionStillSignedIn:true});
  for(let i=1;i<=2;i++){
    const message=await json(await api.post('/api/messages',{headers:auth(sender),data:{text:'FCM delivery check '+i,client_id:randomUUID()}}));
    const notification=await waitForNotification('chat:'+message.id);
    check('chat-'+i,{event:message.id,tag:notification.tag,title:notification.title});
  }
  assert.ok((await notifications()).filter(n=>n.data.kind==='message'||n.data.FCM_MSG?.data?.kind==='message').length>=2,'Chat alerts collapsed');
  const upload=await json(await api.post('/api/media?purpose=choice',{headers:auth(sender),multipart:{file:{name:'fcm-check.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64')}}}));
  for(let i=1;i<=2;i++){
    const choice=await json(await api.post('/api/decisions',{headers:auth(sender),data:{title:'FCM choice check '+i,mode:'choose',options:[{media_id:upload.id},{media_id:upload.id}]}}));
    const notification=await waitForNotification('choice:'+choice.id);
    check('choice-'+i,{event:choice.id,tag:notification.tag,title:notification.title});
  }
  assert.equal((await notifications()).filter(n=>n.tag.startsWith('choice:')).length,2,'Choice alerts collapsed');
  socket=io(apiURL,{auth:{token:sender.token},transports:['websocket']});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const emit=(event,data)=>new Promise((resolve,reject)=>socket.timeout(10000).emit(event,data,(error,result)=>error?reject(error):result?.ok?resolve(result):reject(new Error(result?.error||event+' failed'))));
  for(const kind of ['audio','video']){
    const call=await emit('call:start',{kind});const notification=await waitForNotification(call.id);
    assert.ok(notification.actions.includes('answer')&&notification.actions.includes('decline'));
    check(kind+'-call',{event:call.id,title:notification.title,actions:notification.actions});
    if(kind==='audio'&&process.env.LIVE_SCREENSHOT==='1'){
      await mkdir('artifacts',{recursive:true});execFileSync('scrot',['--overwrite','artifacts/live-fcm-notifications.png']);
      report.screenshot='artifacts/live-fcm-notifications.png';
    }
    await json(await api.post('/api/communication/calls/'+call.id+'/decline',{headers:auth(recipient),data:{}}));
    const until=Date.now()+15000;while((await notifications()).some(n=>n.tag===call.id)&&Date.now()<until)await new Promise(r=>setTimeout(r,500));
    assert.ok(!(await notifications()).some(n=>n.tag===call.id),'Canceled call notification remains');
    check(kind+'-cancel',{removed:true});
  }
  report.passed=true;
}catch(error){report.passed=false;report.error=error.message;console.error('LIVE FCM FAILED:',error.message);process.exitCode=1;}
finally{
  // Revoke test registrations only after delivery assertions, never during their wait.
  if(recipient)await api.delete('/api/notifications/token',{headers:auth(recipient)}).catch(()=>{});
  socket?.disconnect();
  for(const user of [sender,recipient].filter(Boolean))await api.post('/api/auth/logout',{headers:auth(user),data:{}}).catch(()=>{});
  await context?.close();await api.dispose();
  report.finished=new Date().toISOString();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/live-fcm-result.json',JSON.stringify(report,null,2));
  console.log('LIVE FCM',report.passed?'PASSED':'FAILED','report: artifacts/live-fcm-result.json');
}
