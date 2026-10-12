import {test,expect} from '@playwright/test';

test('loading history keeps current messages at same screen position',async({browser,request,baseURL})=>{
  const stamp=Date.now();
  const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@history.test',password:'safe-password-123'}})).json();
  const a=await register('HistoryA'),b=await register('HistoryB');
  const invite=await request.post('/api/pair/invite',{headers:{Authorization:'Bearer '+a.token},data:{}});
  await request.post('/api/pair/join',{headers:{Authorization:'Bearer '+b.token},data:{code:(await invite.json()).code}});
  const messages=Array.from({length:150},(_,i)=>({id:crypto.randomUUID(),user_id:a.user.id,text:'History message '+i,sender_name:'HistoryA',created_at:new Date(1700000000000+i*1000).toISOString()}));
  const context=await browser.newContext({baseURL,viewport:{width:375,height:800}});
  await context.addInitScript(token=>localStorage.setItem('together.session',token),b.token);
  const page=await context.newPage();
  await page.route('**/api/messages?before=*',route=>route.fulfill({json:messages.slice(0,50)}));
  await page.route('**/api/messages',route=>route.request().method()==='GET'?route.fulfill({json:messages.slice(50)}):route.continue());
  try{
    await page.goto('/#chat');await expect(page.locator('.message')).toHaveCount(100);
    const conversation=page.locator('.conversation');
    await conversation.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
    const anchor=page.locator('.message').filter({hasText:'History message 50'});
    const before=(await anchor.boundingBox())!.y;
    await page.getByRole('button',{name:'Load earlier messages'}).click();
    await expect(page.locator('.message')).toHaveCount(150);
    await expect.poll(async()=>Math.abs((await anchor.boundingBox())!.y-before)).toBeLessThan(3);
  }finally{await context.close();}
});
