import {test,expect,Page} from '@playwright/test';

async function checkContrast(page:Page){
  const failures=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;
    const rgba=(color:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);};
    const luminance=(color:number[])=>color.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    return Array.from(document.querySelectorAll('h1,h2,h3,p,span,small,strong,label,button,summary,input,select,textarea')).flatMap(el=>{
      const style=getComputedStyle(el),box=el.getBoundingClientRect();
      if(!box.width||!box.height||style.visibility==='hidden'||Number(style.opacity)<1||el.matches(':disabled')||!Array.from(el.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())&&!el.matches('input,select,textarea'))return [];
      let bg=rgba(style.backgroundColor),ancestor=el.parentElement;
      while(bg[3]<255&&ancestor){const next=rgba(getComputedStyle(ancestor).backgroundColor);const alpha=bg[3]/255,under=next[3]/255,out=alpha+under*(1-alpha);bg=[...bg.slice(0,3).map((v,i)=>out?(v*alpha+next[i]*under*(1-alpha))/out:0),out*255];ancestor=ancestor.parentElement;}
      const text=luminance(rgba(style.color)),paper=luminance(bg),ratio=(Math.max(text,paper)+.05)/(Math.min(text,paper)+.05),large=parseFloat(style.fontSize)>=24||parseFloat(style.fontSize)>=18&&Number(style.fontWeight)>=700;
      return ratio<(large?3:4.5)?[{text:el.textContent?.trim().slice(0,50),ratio:Math.round(ratio*100)/100,color:style.color,background:bg}]:[];
    });
  });
  expect(failures).toEqual([]);
}


test('compact app keeps tasks visible and secondary forms on demand',async({page})=>{
  const plans=[{id:'planned',title:'Dinner',notes:'Bring a jacket',location:'Lake',start_at:'2026-11-02T18:00:00Z',end_at:'2026-11-02T19:00:00Z',timezone:'UTC',status:'planned',decision_id:null,responses:[]},{id:'done',title:'Past picnic',notes:'',location:'',start_at:'2026-10-01T18:00:00Z',end_at:'2026-10-01T19:00:00Z',timezone:'UTC',status:'done',decision_id:null,responses:[]}];
  const trip={id:'trip',title:'Weekend away',destination:'Pokhara',start_date:'2026-11-01',end_date:'2026-11-04',notes:'',itinerary:[],checklist:[{id:'camera',title:'Camera',done:false}]};
  await page.addInitScript(()=>localStorage.setItem('together.session','layout-test'));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path==='/api/auth/me'?{user:{id:'maya',name:'Maya',email:'maya@example.com'},pair:{id:'pair',members:[{id:'maya',name:'Maya'},{id:'alex',name:'Alex'}]}}:path==='/api/plans'?plans:path==='/api/trips'?[trip]:[];
    return route.fulfill({json:data});
  });
  await page.goto('/#plans');
  await expect(page.getByRole('button',{name:'Completed',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Past picnic'})).toHaveCount(0);
  await page.getByRole('button',{name:'Completed',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Past picnic'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Dinner',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Trips',exact:true}).click();
  await page.getByRole('button',{name:'Open Weekend away'}).click();
  await expect(page.getByLabel('Activity title')).toBeHidden();
  await page.getByRole('button',{name:'Add activity',exact:true}).click();
  await expect(page.getByLabel('Activity title')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Packing',exact:true}).click();
  await expect(page.getByLabel('Camera',{exact:true})).toBeVisible();
  for(const width of [320,375,414,768,1280]){
    await page.setViewportSize({width,height:800});
    for(const name of ['Home','Chat','Choices','Plans','Trips','Memories']){
      if(await page.getByRole('button',{name:'Back to app',exact:true}).count())await page.getByRole('button',{name:'Back to app',exact:true}).click();// Plans and Trips are not in the phone bottom bar; they open from Home.
      if(await page.getByRole('button',{name,exact:true}).isVisible())await page.getByRole('button',{name,exact:true}).click();else await page.evaluate(page=>location.hash=page,name.toLowerCase());
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(name==='Home'||name==='Chat')expect(await page.locator('.chat-fullscreen,.page-content').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
      if(name==='Chat')await expect(page.getByLabel('Message your partner')).toBeInViewport();
      if(name==='Plans'){
        await page.getByRole('button',{name:'New plan',exact:true}).click();
        await checkContrast(page);
        await expect(page.getByLabel('Plan title')).toBeVisible();
        await page.screenshot({path:`artifacts/redesign-plan-form-${width}.png`});
        await page.keyboard.press('Escape');
        await page.getByLabel('More actions for Dinner').click();
        await expect(page.getByRole('button',{name:'Edit Dinner'})).toBeVisible();
        await page.getByRole('button',{name:'Edit Dinner'}).click();
        await expect(page.getByLabel('Plan title')).toHaveValue('Dinner');
        await page.keyboard.press('Escape');
        await page.getByLabel('More actions for Dinner').click();
      }
      if(name==='Trips'){
        await page.getByRole('button',{name:'New trip',exact:true}).click();
        await page.screenshot({path:`artifacts/redesign-trip-form-${width}.png`});
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Open Weekend away'}).click();
        await page.screenshot({path:`artifacts/redesign-itinerary-${width}.png`});
        await page.getByRole('button',{name:'Add activity',exact:true}).click();
        await checkContrast(page);
        await page.screenshot({path:`artifacts/redesign-activity-form-${width}.png`});
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Packing',exact:true}).click();
        await page.screenshot({path:`artifacts/redesign-packing-${width}.png`});
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await checkContrast(page);
      await page.screenshot({path:`artifacts/redesign-${name.toLowerCase()}-${width}.png`});
    }
  }
});
