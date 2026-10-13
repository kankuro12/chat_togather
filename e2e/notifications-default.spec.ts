import {test,expect} from '@playwright/test';

test('login requests notifications by default; saved opt-out prevents prompt',async({browser,request,baseURL})=>{
  const response=await request.post('/api/auth/register',{data:{name:'NotifyDefault',email:`notify-default-${Date.now()}@test.invalid`,password:'safe-password-123'}});
  expect(response.status()).toBe(201);const session=await response.json();
  for(const optedOut of [false,true]){
    const context=await browser.newContext({baseURL});
    await context.addInitScript(({token,optedOut})=>{
      localStorage.setItem('together.session',token);
      if(optedOut)localStorage.setItem('together.notifications','off');
      (window as any).permissionRequests=0;
      Object.defineProperty(Notification,'permission',{get:()=> 'default'});
      Notification.requestPermission=async()=>{(window as any).permissionRequests++;return 'denied';};
    },{token:session.token,optedOut});
    try{
      const page=await context.newPage();await page.goto('/');
      await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>(window as any).permissionRequests)).toBe(optedOut?0:1);
      await page.reload();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>(window as any).permissionRequests)).toBe(optedOut?0:1);
    }finally{await context.close();}
  }
});

test('unsuccessful automatic permission request retains manual enable control',async({browser,request,baseURL})=>{
  const stamp=Date.now();
  const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:`${name}-${stamp}@test.invalid`,password:'safe-password-123'}})).json();
  const a=await register('NotifyRetryA'),b=await register('NotifyRetryB');
  const invite=await request.post('/api/pair/invite',{headers:{Authorization:'Bearer '+a.token},data:{}});
  await request.post('/api/pair/join',{headers:{Authorization:'Bearer '+b.token},data:{code:(await invite.json()).code}});
  const context=await browser.newContext({baseURL});
  await context.addInitScript(token=>{
    localStorage.setItem('together.session',token);(window as any).permissionRequests=0;
    Object.defineProperty(Notification,'permission',{get:()=> 'default'});
    Notification.requestPermission=async()=>{(window as any).permissionRequests++;return 'denied';};
  },b.token);
  try{
    const page=await context.newPage();
    await page.route('**/api/communication/config',route=>route.fulfill({json:{notifications:true,firebase:{projectId:'test',apiKey:'test',appId:'test',messagingSenderId:'123'},vapidKey:'test'}}));
    await page.goto('/');await page.getByLabel('Account menu').click();
    const enable=page.getByRole('button',{name:'Enable notifications',exact:true});await expect(enable).toBeEnabled();
    await expect.poll(()=>page.evaluate(()=>(window as any).permissionRequests)).toBe(1);
    await enable.click();await expect.poll(()=>page.evaluate(()=>(window as any).permissionRequests)).toBe(2);
  }finally{await context.close();}
});
