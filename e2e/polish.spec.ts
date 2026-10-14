import {test,expect} from '@playwright/test';

test('menus close on outside tap, memories upload one by one, reactions are round, close buttons are icons',async({browser,request,baseURL})=>{
  const stamp=Date.now();const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@polish.test',password:'safe-password-123'}})).json();
  const a=await register('Asha'),b=await register('Bikash');const invite=await request.post('/api/pair/invite',{headers:{Authorization:'Bearer '+a.token},data:{}});
  await request.post('/api/pair/join',{headers:{Authorization:'Bearer '+b.token},data:{code:(await invite.json()).code}});
  await request.post('/api/messages',{headers:{Authorization:'Bearer '+b.token},data:{text:'Hello there',client_id:'polish-hello'}});
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844}});await context.addInitScript(t=>localStorage.setItem('together.session',t),a.token);
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/#home');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
    // The profile menu closes when tapping outside it.
    await page.getByLabel('Account menu').click();await expect(page.locator('details.account-menu[open]')).toHaveCount(1);
    await page.getByRole('heading',{name:'Home',exact:true}).click();await expect(page.locator('details.account-menu[open]')).toHaveCount(0);
    // Several memories at once, uploaded strictly one after another.
    let active=0,peak=0;await page.route('**/api/media?purpose=memory',async route=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,300));await route.continue();active--;});
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');
    const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(16036,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
    await page.getByRole('button',{name:'Memories',exact:true}).click();
    await page.getByLabel('Add memories',{exact:true}).setInputFiles([{name:'one.png',mimeType:'image/png',buffer:png},{name:'two.png',mimeType:'image/png',buffer:png},{name:'voice.wav',mimeType:'audio/wav',buffer:wav}]);
    await expect(page.locator('.upload-progress')).toContainText('of 3');await expect(page.locator('.memory-card')).toHaveCount(3,{timeout:20000});
    expect(peak,'never more than one upload at a time').toBe(1);await expect(page.locator('.memory-card.audio-memory')).toHaveCount(1);await expect(page.locator('.page-heading p')).toHaveText('2 photos & videos · 1 voice memory');
    // The memory viewer closes with an icon button.
    await page.locator('.memory-open').first().click();const close=page.getByRole('button',{name:'Close memory'});await expect(close.locator('ion-icon')).toHaveCount(1);await expect(close).toHaveText('');await close.click();
    // Media seen once stays on the device: it is in the media cache after viewing.
    await expect.poll(()=>page.evaluate(async()=>{let count=0;for(const name of await caches.keys())if(name.startsWith('together-media-'))count+=(await (await caches.open(name)).keys()).length;return count;})).toBeGreaterThan(0);
    // Reaction choices are perfect circles.
    await page.getByRole('button',{name:'Chat',exact:true}).click();const hello=page.locator('.message',{hasText:'Hello there'});await hello.hover();await hello.getByRole('button',{name:'Message actions'}).click();
    for(const box of await page.locator('.reaction-picker button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})))expect(box[0]).toBe(box[1]);
    await page.getByRole('button',{name:'React ❤️'}).click();const chip=hello.locator('.reaction');const size=await chip.evaluate(el=>{const r=el.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];});expect(size[0]).toBe(size[1]);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
