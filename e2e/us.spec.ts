import {test,expect} from '@playwright/test';

test('Us tab: thinking of you, daily question, dates, lists, secret wishlist and love notes',async({browser,request,baseURL})=>{
  test.setTimeout(120000);
  const stamp=Date.now();
  const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@us.test',password:'safe-password-123'}})).json();
  const a=await register('Asha'),b=await register('Bikash');const as=(u:any)=>({Authorization:'Bearer '+u.token});
  const invite=await request.post('/api/pair/invite',{headers:as(a),data:{}});await request.post('/api/pair/join',{headers:as(b),data:{code:(await invite.json()).code}});
  const open=async(user:any,width=375)=>{const context=await browser.newContext({baseURL,viewport:{width,height:812}});await context.addInitScript(t=>localStorage.setItem('together.session',t),user.token);const page=await context.newPage();await page.goto('/#home');await page.getByRole('button',{name:'Us',exact:true}).click();await expect(page.getByRole('heading',{name:'Us',exact:true})).toBeVisible();return {context,page};};
  const A=await open(a),B=await open(b);const errors:string[]=[];for(const p of [A.page,B.page])p.on('pageerror',e=>errors.push(e.message));
  try{
    // Thinking of you shows on the partner's screen at once.
    await A.page.getByRole('button',{name:'Thinking of you'}).click();await expect(A.page.getByRole('button',{name:'Sent!'})).toBeVisible();
    const overlay=B.page.getByRole('alertdialog',{name:'Asha is thinking of you'});await expect(overlay).toBeVisible();await expect(overlay.locator('.nudge-hearts span').first()).toBeAttached();await B.page.screenshot({path:'artifacts/nudge-overlay-375.png'});await overlay.click();await expect(overlay).toHaveCount(0);await expect(B.page.locator('.nudge-note')).toContainText('Asha thought of you');

    // Daily question: Bikash only sees Asha's answer after sharing his own.
    await expect(A.page.locator('.question-text')).toHaveText((await B.page.locator('.question-text').innerText()).trim());
    await A.page.getByLabel('Your answer').fill('Your laugh at breakfast');await A.page.getByRole('button',{name:'Share answer'}).click();
    await expect(B.page.getByText('Asha answered. Share yours to see it.')).toBeVisible();await expect(B.page.getByText('Your laugh at breakfast')).toHaveCount(0);
    await B.page.getByLabel('Your answer').fill('Momo night');await B.page.getByRole('button',{name:'Share answer'}).click();
    await expect(B.page.locator('.answer',{hasText:'Asha'})).toContainText('Your laugh at breakfast');await expect(A.page.locator('.answer',{hasText:'Bikash'})).toContainText('Momo night');

    // Special dates with countdown and "together for".
    // Dates, lists and wishes live under Plans.
    for(const p of [A.page,B.page])await p.getByRole('tab',{name:'Plans',exact:true}).click();
    await A.page.getByRole('button',{name:'Add special date'}).click();const dialog=A.page.getByRole('dialog',{name:'New special date'});
    await expect(dialog.getByLabel('What is it?')).toHaveValue('together');await dialog.getByLabel('Title').fill('Our first date');
    const today=new Date();const started=new Date(Date.UTC(today.getFullYear()-2,today.getMonth(),today.getDate()));await dialog.getByLabel('Date').fill(started.toISOString().slice(0,10));await dialog.getByRole('button',{name:'Save'}).click();
    await expect(A.page.locator('.us-heading p')).toHaveText('Together for 2 years');await expect(A.page.locator('.special-date',{hasText:'Our first date'}).locator('.countdown')).toHaveText('Today 🎉');
    await expect(B.page.locator('.us-heading p')).toHaveText('Together for 2 years');

    // Shared list ticks off on both phones.
    // Add items straight away: the first one creates the list.
    for(const item of ['Milk','Rice']){const input=A.page.getByPlaceholder('Add an item, e.g. Milk');await input.fill(item);await input.press('Enter');await expect(A.page.locator('.check-list li',{hasText:item})).toBeVisible();}
    await expect(B.page.locator('.check-list li')).toHaveCount(2);await B.page.getByLabel('Milk',{exact:true}).check();
    await expect(A.page.locator('.check-list li.done')).toHaveText('Milk');await A.page.getByRole('button',{name:'Clear 1 done'}).click();await expect(B.page.locator('.check-list li')).toHaveCount(1);

    // Secret wishlist: Bikash claims, Asha never sees it.
    await A.page.getByLabel('Wish',{exact:true}).fill('Pashmina shawl');await A.page.getByLabel('Link (optional)').fill('https://example.com/shawl');await A.page.getByRole('button',{name:'Add wish'}).click();
    await B.page.getByRole('tab',{name:'Asha’s'}).click();const wish=B.page.locator('.wish-list li',{hasText:'Pashmina shawl'});await wish.getByRole('button',{name:'I’ll get this'}).click();await expect(wish).toContainText('You’re getting this');
    await A.page.reload();await A.page.getByRole('button',{name:'Us',exact:true}).click();await expect(A.page.locator('.wish-list li',{hasText:'Pashmina shawl'})).toBeVisible();await expect(A.page.getByText(/getting this/)).toHaveCount(0);

    // A love note stays completely hidden from Bikash until it opens.
    const later=new Date(Date.now()+3*86400000);const local=new Date(later.getTime()-later.getTimezoneOffset()*60000).toISOString().slice(0,16);
    for(const p of [A.page,B.page])await p.getByRole('tab',{name:'Notes',exact:true}).click();
    await A.page.getByLabel('Love note',{exact:true}).fill('Open this on our trip ❤️');await A.page.getByLabel('Opens on').fill(local);await A.page.getByRole('button',{name:'Seal note'}).click();
    await expect(A.page.locator('.us-notes .note-list')).toContainText('Open this on our trip');
    await expect(B.page.locator('.us-notes .note-list')).toContainText('Seal a note for');await expect(B.page.getByText('Open this on our trip')).toHaveCount(0);await expect(B.page.locator('.us-notes .note-list li.sealed')).toHaveCount(0);
    await B.page.screenshot({path:'artifacts/us-375.png',fullPage:true});

    // Home shows what's next for the two of you.
    await B.page.getByRole('button',{name:'Home',exact:true}).click();await expect(B.page.locator('.home-agenda')).toContainText('Our first date');await expect(B.page.locator('.home-agenda')).toContainText('Together for 2 years');
    // The seven-item bottom bar still fits a small phone.
    await B.page.setViewportSize({width:320,height:700});expect(await B.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const tops=new Set<number>();for(const name of ['Home','Chat','Us','Games','Choices','Memories']){const box=await B.page.getByRole('button',{name,exact:true}).boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);tops.add(Math.round(box!.y));}
    expect(tops.size,'the tabs sit in one row').toBe(1);
    // Plans and Trips moved from the phone bar to Home, with a way back.
    for(const name of ['Plans','Trips'])await expect(B.page.getByRole('button',{name,exact:true})).toBeHidden();
    await B.page.getByRole('button',{name:'Plan a trip'}).click();await expect(B.page.getByRole('heading',{name:'Trips',exact:true})).toBeVisible();await B.page.locator('.back-home').click();
    await B.page.getByRole('button',{name:'Make a plan'}).click();await expect(B.page.getByRole('heading',{name:'Plans',exact:true})).toBeVisible();await B.page.screenshot({path:'artifacts/plans-from-home-320.png'});await B.page.locator('.back-home').click();await expect(B.page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
    await B.page.screenshot({path:'artifacts/us-home-320.png'});
    const wide=await open(b,1280);await wide.page.screenshot({path:'artifacts/us-1280.png',fullPage:true});await wide.context.close();
    expect(errors).toEqual([]);
  }finally{await A.context.close();await B.context.close();}
});
