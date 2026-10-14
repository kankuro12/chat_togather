import {test,expect,type Page} from '@playwright/test';

async function pair(request:any,label:string){
  const stamp=Date.now();const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@'+label+'.test',password:'safe-password-123'}})).json();
  const a=await register('Asha'),b=await register('Bikash');const invite=await request.post('/api/pair/invite',{headers:{Authorization:'Bearer '+a.token},data:{}});
  await request.post('/api/pair/join',{headers:{Authorization:'Bearer '+b.token},data:{code:(await invite.json()).code}});return {a,b};
}
/** What Android's share sheet does for an installed web app: POST the shared content to the share target. */
async function shareFromAnotherApp(page:Page,fields:{title?:string;text?:string;url?:string;image?:boolean}){
  await page.evaluate(async fields=>{
    const form=document.createElement('form');form.method='POST';form.action='/share-target';form.enctype='multipart/form-data';
    for(const name of ['title','text','url'] as const)if(fields[name]){const input=document.createElement('input');input.name=name;input.value=fields[name]!;form.append(input);}
    if(fields.image){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#d68b7d';ctx.fillRect(0,0,64,64);
      const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));const input=document.createElement('input');input.type='file';input.name='media';
      const data=new DataTransfer();data.items.add(new File([blob],'sunset.png',{type:'image/png'}));input.files=data.files;form.append(input);}
    document.body.append(form);form.submit();
  },fields);
}

test('share with Together: from another app into the chat, memories and wishlist',async({browser,request,baseURL})=>{
  const {a,b}=await pair(request,'share');
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844}});await context.addInitScript(t=>localStorage.setItem('together.session',t),a.token);
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/#home');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:20000}).toBe(true);
    // A photo with a caption goes straight to the chat.
    await shareFromAnotherApp(page,{text:'Look at this sunset',image:true});
    const sheet=page.getByRole('dialog',{name:'Share with Together'});await expect(sheet).toBeVisible();
    await expect(sheet.locator('.share-preview img')).toHaveCount(1);await expect(sheet.locator('.share-text')).toHaveText('Look at this sunset');
    await sheet.getByLabel('Add a message').fill('For you ❤️');await page.screenshot({path:'artifacts/share-sheet-390.png'});
    await sheet.getByRole('button',{name:'Send to Bikash'}).click();
    await expect(page.locator('.chat-window')).toBeVisible();const sent=page.locator('.message',{hasText:'Look at this sunset'});
    await expect(sent.locator('.bubble > p')).toHaveText('For you ❤️\nLook at this sunset');await expect(sent.locator('media-view img')).toBeVisible({timeout:15000});
    const history=await (await request.get('/api/messages',{headers:{Authorization:'Bearer '+b.token}})).json();expect(history.some((m:any)=>m.media_mime?.startsWith('image/')&&m.text.includes('sunset'))).toBe(true);
    // A link from a shop becomes a wish.
    await page.getByRole('button',{name:'Back to app',exact:true}).click();
    await shareFromAnotherApp(page,{title:'Pashmina shawl',url:'https://example.com/shawl'});
    await expect(sheet.getByRole('button',{name:'Save to Memories'})).toHaveCount(0);await sheet.getByRole('button',{name:'Add to wishlist'}).click();
    await expect(page.getByRole('heading',{name:'Us',exact:true})).toBeVisible();await expect(page.locator('.wish-list li',{hasText:'Pashmina shawl'})).toContainText('example.com');
    // A photo saved to Memories.
    await shareFromAnotherApp(page,{image:true});await sheet.getByRole('button',{name:'Save to Memories'}).click();
    await expect(page.getByRole('heading',{name:'Memories',exact:true})).toBeVisible();await expect(page.locator('.memory-card')).toHaveCount(2,{timeout:15000});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('Android back button steps back through the app instead of closing it',async({browser,request,baseURL})=>{
  const {a}=await pair(request,'back');
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844}});await context.addInitScript(t=>localStorage.setItem('together.session',t),a.token);
  const page=await context.newPage();await page.goto('/#home');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
  const back=()=>page.evaluate(()=>(window as any).togetherBack());
  try{
    expect(await back(),'on Home the app goes to the background').toBe(false);
    await page.getByRole('button',{name:'Plan a trip'}).click();await expect(page.getByRole('heading',{name:'Trips',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'New trip',exact:true}).click();await expect(page.locator('dialog[open]')).toHaveCount(1);
    expect(await back()).toBe(true);await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Trips',exact:true})).toBeVisible();
    expect(await back()).toBe(true);await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Chat',exact:true}).click();await page.getByRole('button',{name:'Search messages'}).click();await expect(page.getByLabel('Search messages')).toBeVisible();
    expect(await back()).toBe(true);await expect(page.locator('.chat-search')).toHaveCount(0);await expect(page.locator('.chat-window')).toBeVisible();
    expect(await back()).toBe(true);await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
    await page.getByLabel('Account menu').click();expect(await back()).toBe(true);await expect(page.locator('details[open]')).toHaveCount(0);
    expect(await back()).toBe(false);
  }finally{await context.close();}
});
