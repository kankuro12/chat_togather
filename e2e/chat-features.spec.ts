import {test,expect,type Page} from '@playwright/test';

test('reactions, pins, edit, delete, search, view once, voice waveform and the offline outbox',async({browser,request,baseURL})=>{
  test.setTimeout(120000);
  const stamp=Date.now();
  const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@chatfeatures.test',password:'safe-password-123'}})).json();
  const a=await register('Asha'),b=await register('Bikash');const as=(u:any)=>({Authorization:'Bearer '+u.token});
  const invite=await request.post('/api/pair/invite',{headers:as(a),data:{}});await request.post('/api/pair/join',{headers:as(b),data:{code:(await invite.json()).code}});
  for(const text of ['Movie tonight?','Wifi: tea-garden'])await request.post('/api/messages',{headers:as(a),data:{text,client_id:crypto.randomUUID()}});
  const open=async(user:any)=>{const context=await browser.newContext({baseURL,viewport:{width:430,height:860}});await context.addInitScript(t=>localStorage.setItem('together.session',t),user.token);const page=await context.newPage();await page.goto('/#chat');return {context,page};};
  const A=await open(a),B=await open(b);const errors:string[]=[];for(const p of [A.page,B.page])p.on('pageerror',e=>errors.push(e.message));
  const bubble=(page:Page,text:string|RegExp)=>page.locator('.message').filter({has:page.locator('.bubble > p',{hasText:text})});
  const actions=async(page:Page,text:string)=>{const m=bubble(page,text);await m.hover();await m.getByRole('button',{name:'Message actions'}).click();return page.getByRole('dialog',{name:'Message actions'});};
  const send=async(page:Page,text:string)=>{await page.getByLabel('Message your partner').fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();};
  try{
    // Reactions show live on both phones.
    await (await actions(B.page,'Movie tonight?')).getByRole('button',{name:'React ❤️'}).click();
    await expect(bubble(B.page,'Movie tonight?').locator('.reaction.own')).toHaveText('❤️');
    await expect(bubble(A.page,'Movie tonight?').locator('.reaction')).toHaveText('❤️');
    await bubble(A.page,'Movie tonight?').locator('.reaction').click();
    await expect(bubble(B.page,'Movie tonight?').locator('.reaction')).toHaveText('❤️2');

    // Pin to the top of the chat.
    await (await actions(B.page,'Wifi: tea-garden')).getByRole('button',{name:'Pin to top'}).click();
    await expect(A.page.locator('.pinned-bar')).toContainText('Wifi: tea-garden');await expect(B.page.locator('.pinned-bar')).toContainText('Wifi: tea-garden');

    // Edit your own message.
    await send(B.page,'See you at sevn');await expect(bubble(B.page,'See you at sevn')).toBeVisible();
    await (await actions(B.page,'See you at sevn')).getByRole('button',{name:'Edit'}).click();
    await expect(B.page.locator('.edit-preview')).toContainText('Editing message');await B.page.getByLabel('Message your partner').fill('See you at seven');await B.page.getByRole('button',{name:'Save changes'}).click();
    await expect(bubble(A.page,'See you at seven').locator('small')).toContainText('edited');await expect(bubble(A.page,'See you at sevn')).toHaveCount(0);
    // Only your own messages can be edited or deleted.
    await expect((await actions(B.page,'Movie tonight?')).getByRole('button',{name:'Edit'})).toHaveCount(0);await B.page.keyboard.press('Escape');

    // Delete needs a second tap and shows for both.
    await send(B.page,'Oops wrong chat');const sheet=await actions(B.page,'Oops wrong chat');await sheet.getByRole('button',{name:'Delete'}).click();await sheet.getByRole('button',{name:'Tap again to delete for both of you'}).click();
    await expect(A.page.locator('.message-deleted')).toHaveText('This message was deleted');await expect(A.page.getByText('Oops wrong chat')).toHaveCount(0);

    // Search jumps to the message.
    await A.page.getByRole('button',{name:'Search messages'}).click();await A.page.getByLabel('Search messages').fill('TEA-gar');
    await A.page.locator('.search-result',{hasText:'Wifi: tea-garden'}).click();await expect(bubble(A.page,'Wifi: tea-garden')).toHaveClass(/flash/);
    await A.page.getByRole('button',{name:'Search messages'}).click();await A.page.getByLabel('Search messages').fill('zzzz');await expect(A.page.getByText('No messages found.')).toBeVisible();await A.page.getByRole('button',{name:'Close search'}).click();

    // View-once photo opens exactly once.
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');
    await B.page.getByLabel('Attach image or video').setInputFiles({name:'secret.png',mimeType:'image/png',buffer:png});await B.page.getByLabel('View once').check();await B.page.getByRole('button',{name:'Send message',exact:true}).click();
    await expect(B.page.locator('.view-once')).toContainText('Not opened yet');
    const once=A.page.locator('.view-once');await expect(once).toContainText('Tap to view once');await once.click();
    const viewer=A.page.getByRole('dialog',{name:'View-once photo'});await expect(viewer.locator('img')).toBeVisible();await viewer.getByRole('button',{name:'Close photo'}).click();
    await expect(once).toContainText('Photo opened');await expect(once).toBeDisabled();await expect(B.page.locator('.view-once')).toContainText('Opened');
    await expect(A.page.locator('.message').filter({has:A.page.locator('.view-once')}).locator('img')).toHaveCount(0);

    // Voice messages show their waveform before downloading, then offer playback speed.
    const wav=Buffer.alloc(32044);wav.write('RIFF');wav.writeUInt32LE(32036,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
    for(let i=44;i<wav.length;i+=2)wav.writeInt16LE(Math.round(Math.sin(i/30)*8000*((i/wav.length)+0.2)),i);
    await B.page.getByLabel('Attach image or video').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wav});await B.page.getByRole('button',{name:'Send message',exact:true}).click();
    const voice=A.page.locator('.media-audio');await expect(voice.locator('.media-bars i')).toHaveCount(48);await expect(voice).toContainText('0:01');
    await voice.click();const speed=A.page.locator('.media-speed');await expect(speed).toHaveText('1×');await speed.click();await expect(speed).toHaveText('1.5×');
    expect(await A.page.locator('.media-audio-player audio').evaluate((el:HTMLAudioElement)=>el.playbackRate)).toBe(1.5);

    // Offline: the message waits, then sends by itself when the connection returns.
    await B.context.setOffline(true);await send(B.page,'Sent from the tunnel');
    await expect(B.page.locator('.message.pending')).toContainText('Waiting for connection');
    // Restart the app while offline: the queued text survives and is sent once back online.
    await B.page.reload().catch(()=>{});await B.context.setOffline(false);await B.page.goto('/?reopen=1#home');
    await expect(bubble(A.page,'Sent from the tunnel')).toBeVisible({timeout:20000});await B.page.getByRole('button',{name:'Chat',exact:true}).click();await expect(B.page.locator('.message.pending')).toHaveCount(0);
    await expect(bubble(B.page,'Sent from the tunnel')).toHaveCount(1);
    await B.page.screenshot({path:'artifacts/chat-features-430.png'});
    expect(errors).toEqual([]);
  }finally{await A.context.close();await B.context.close();}
});
