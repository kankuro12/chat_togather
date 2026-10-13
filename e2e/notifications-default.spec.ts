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
