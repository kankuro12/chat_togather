import {test,expect} from '@playwright/test';

test('choice badge survives viewing and reload; choice notice opens Choices while reading Chat',async({browser,request,baseURL})=>{
  const stamp=Date.now();
  const register=async(name:string)=>{const response=await request.post('/api/auth/register',{data:{name,email:name+stamp+'@choices-badge.test',password:'safe-password-123'}});expect(response.status()).toBe(201);return response.json();};
  const a=await register('ChoiceSender'),b=await register('ChoiceRecipient');
  const headers={Authorization:'Bearer '+a.token},recipient={Authorization:'Bearer '+b.token};
  const invite=await request.post('/api/pair/invite',{headers,data:{}});expect((await request.post('/api/pair/join',{headers:recipient,data:{code:(await invite.json()).code}})).status()).toBe(200);
  const context=await browser.newContext({baseURL,viewport:{width:375,height:800}});await context.addInitScript(token=>localStorage.setItem('together.session',token),b.token);const page=await context.newPage();
  try{
    const pendingReady=page.waitForResponse(response=>response.url().endsWith('/api/decisions/pending')&&response.status()===200);
    await page.goto('/#home');await pendingReady;await expect(page.getByText('Live',{exact:true})).toBeVisible();
    const choices=page.getByRole('button',{name:'Choices',exact:true}),badge=choices.locator('.unread-badge');await expect(badge).toHaveCount(0);
    const upload=await request.post('/api/media?purpose=choice',{headers,multipart:{file:{name:'choice.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64')}}});expect(upload.status()).toBe(201);const media=(await upload.json()).id;
    const create=async(title:string)=>{const response=await request.post('/api/decisions',{headers,data:{title,mode:'choose',options:[{media_id:media},{media_id:media}]}});expect(response.status()).toBe(201);return response.json();};
    await create('First pending choice');await expect(badge).toHaveText('1');await expect(page.getByText('New choice waiting from your partner.',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Open choices',exact:true}).click();await expect(page.getByRole('heading',{name:'Choices',exact:true})).toBeVisible();await expect(badge).toHaveText('1');
    await page.reload();await expect(badge).toHaveText('1');await expect(page.locator('.notification-notice')).toHaveCount(0);
    await page.getByLabel('Actions for First pending choice').click();await page.getByRole('button',{name:'Choose',exact:true}).click();await page.getByRole('button',{name:'Choose this image',exact:true}).click();await page.getByRole('button',{name:'Send choice',exact:true}).click();await expect(badge).toHaveCount(0);
    await page.getByRole('button',{name:'Chat',exact:true}).click();await page.bringToFront();await expect(page.getByLabel('Message your partner')).toBeVisible();
    await create('Second pending choice');await expect(page.getByText('New choice waiting from your partner.',{exact:true})).toBeVisible();
    await expect.poll(async()=>{const response=await request.get('/api/messages/read-state',{headers:recipient});return (await response.json()).unread;}).toBe(0);
    await page.getByRole('button',{name:'Open choices',exact:true}).click();await expect(badge).toHaveText('1');await expect(page.getByRole('heading',{name:'Choices',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'artifacts/choices-notification-badge.png'});
    await page.route('**/api/decisions/pending',route=>route.fulfill({json:{count:123}}));await page.reload();await expect(badge).toHaveText('99+');
  }finally{await context.close();}
});
