import {test,expect} from '@playwright/test';

test('chat shows all six choice thumbnails and opens the clicked image on mobile',async({browser,request,baseURL})=>{
  const stamp=Date.now(),register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@chat-thumbnails.test',password:'safe-password-123'}})).json();
  const a=await register('ThumbnailSender'),b=await register('ThumbnailRecipient'),headers={Authorization:'Bearer '+a.token},recipient={Authorization:'Bearer '+b.token};
  const invite=await request.post('/api/pair/invite',{headers,data:{}});expect((await request.post('/api/pair/join',{headers:recipient,data:{code:(await invite.json()).code}})).status()).toBe(200);
  const upload=await request.post('/api/media?purpose=choice',{headers,multipart:{file:{name:'choice.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64')}}});expect(upload.status()).toBe(201);const media=(await upload.json()).id;
  const choice=await request.post('/api/decisions',{headers,data:{title:'All six images',mode:'choose',options:Array.from({length:6},()=>({media_id:media}))}});expect(choice.status()).toBe(201);
  const context=await browser.newContext({baseURL,viewport:{width:320,height:800}});await context.addInitScript(token=>localStorage.setItem('together.session',token),b.token);const page=await context.newPage();
  try{
    await page.goto('/#chat');const message=page.locator('.message').filter({hasText:'New choice: All six images'});
    await expect(message.locator('.chat-choice-image')).toHaveCount(6);await expect(message.locator('.chat-choice-image img')).toHaveCount(6);
    // The thumbnails open the choice themselves, so there is no separate "View choice" button.
    await expect(message.getByRole('button',{name:'View choice',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'More message options'}).click();
    for(const name of ['Voice message','Video message','Live location']){
      const control=page.getByRole('button',{name,exact:true});await expect(control).toHaveText('');await expect(control.locator('ion-icon')).toHaveCount(1);
      const size=await control.boundingBox();expect(size!.width).toBeGreaterThanOrEqual(44);expect(size!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button',{name:'More message options'}).click();
    for(const width of [320,375,768]){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const grid=message.locator('.chat-choice-thumbnails');expect(await grid.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
    await message.getByRole('button',{name:'Open choice image 6',exact:true}).click();await expect(page.locator('.choice-carousel').getByText('6 / 6',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close choice viewer',exact:true}).click();
    await message.getByRole('button',{name:'Open choice image 2',exact:true}).click();await expect(page.locator('.choice-carousel').getByText('2 / 6',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close choice viewer',exact:true}).click();await page.setViewportSize({width:375,height:800});await page.screenshot({path:'artifacts/chat-choice-thumbnails.png'});
  }finally{await context.close();}
});
