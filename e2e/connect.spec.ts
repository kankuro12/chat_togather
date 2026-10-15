import {test,expect,type Page} from '@playwright/test';

test('Us: mood, touch, distance, moments, packs, know-me, quizzes, journal; Games: live tic-tac-toe',async({browser,request,baseURL})=>{
  test.setTimeout(240000);
  const stamp=Date.now();const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@connect.test',password:'safe-password-123'}})).json();
  const a=await register('Asha'),b=await register('Bikash');const invite=await request.post('/api/pair/invite',{headers:{Authorization:'Bearer '+a.token},data:{}});
  await request.post('/api/pair/join',{headers:{Authorization:'Bearer '+b.token},data:{code:(await invite.json()).code}});
  const open=async(user:any,where:{latitude:number;longitude:number})=>{const context=await browser.newContext({baseURL,viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{...where,accuracy:50}});await context.addInitScript(t=>localStorage.setItem('together.session',t),user.token);const page=await context.newPage();await page.goto('/#us');await expect(page.getByRole('heading',{name:'Us',exact:true})).toBeVisible();return {context,page};};
  const A=await open(a,{latitude:27.7172,longitude:85.324}),B=await open(b,{latitude:28.2096,longitude:83.9856});const errors:string[]=[];for(const p of [A.page,B.page])p.on('pageerror',e=>errors.push(e.message));
  const tab=(page:Page,name:string)=>page.getByRole('tab',{name,exact:true}).click();
  try{
    // Mood
    await tab(A.page,'Today');await tab(B.page,'Today');
    await A.page.getByRole('radio',{name:'Happy'}).click();await expect(B.page.locator('.mood-partner')).toContainText('Asha feels happy');
    // Distance (both opt in) and local time
    for(const p of [A.page,B.page])await p.getByLabel('Share how far apart we are').check();
    await B.page.reload();await tab(B.page,'Today');await expect(B.page.locator('.status-tile',{hasText:'apart'})).toContainText(/1[45]\d km/,{timeout:15000});
    await expect(B.page.locator('.status-tile',{hasText:'their time'})).toContainText(/\d/);
    // Touch: both hold the heart at the same time
    await A.page.getByRole('button',{name:'Hold to touch'}).hover();await A.page.mouse.down();
    await expect(B.page.locator('.touch-status')).toContainText('Asha is holding the heart');
    await B.page.getByRole('button',{name:'Hold to touch'}).hover();await B.page.mouse.down();
    await expect(A.page.locator('.touch-status')).toHaveText('You are touching 💞');await expect(B.page.locator('.touch-heart')).toHaveClass(/together/);
    await A.page.mouse.up();await B.page.mouse.up();await expect(B.page.locator('.touch-heart')).not.toHaveClass(/together/);
    // Moment: a drawing
    await A.page.getByRole('button',{name:'Draw'}).click();const canvas=A.page.getByLabel('Drawing area');const box=(await canvas.boundingBox())!;
    await A.page.mouse.move(box.x+40,box.y+40);await A.page.mouse.down();await A.page.mouse.move(box.x+200,box.y+160,{steps:8});await A.page.mouse.up();
    await A.page.getByLabel('Caption (optional)').fill('Miss you');await A.page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(B.page.locator('.moment-view figcaption')).toContainText('From Asha · Miss you');await expect(B.page.locator('.moment-view img')).toBeVisible({timeout:15000});
    await B.page.screenshot({path:'artifacts/us-today-390.png',fullPage:true});
    // Play: a pack question answered by both, the know-me game and a quiz
    await tab(A.page,'Play');await tab(B.page,'Play');
    await A.page.getByLabel('Your answer to this pack question').fill('Feeling heard');await A.page.getByRole('button',{name:'Answer',exact:true}).click();
    await expect(B.page.getByText('Asha answered. Share yours to see it.')).toBeVisible();await B.page.getByLabel('Your answer to this pack question').fill('Long talks');await B.page.getByRole('button',{name:'Answer',exact:true}).click();
    await B.page.getByText('Your answers so far').click();await expect(B.page.locator('.question-history')).toContainText('Feeling heard');
    const aboutMe=A.page.locator('.know-round.mine');const pick=await aboutMe.locator('.know-options button').nth(1).innerText();await aboutMe.locator('.know-options button').nth(1).click();
    const guessRound=B.page.locator('.know-round').filter({hasText:'Asha:'});await guessRound.getByRole('button',{name:pick,exact:true}).click();
    await expect(B.page.locator('.know-result')).toHaveText('Correct! 🎉');
    await A.page.getByRole('button',{name:'Take quiz'}).first().click();for(let i=0;i<10;i++)await A.page.locator('section:has(#quiz-title) .know-options button').first().click();
    await expect(B.page.locator('.quiz-result').first()).toContainText('Words');
    await B.page.screenshot({path:'artifacts/us-play-390.png',fullPage:true});
    // Notes: gratitude is shared
    await tab(A.page,'Notes');await tab(B.page,'Notes');await A.page.getByLabel('Gratitude note').fill('Thank you for the tea');await A.page.getByRole('button',{name:'Share with Bikash'}).click();
    await expect(B.page.locator('us-journal .note-list')).toContainText('Thank you for the tea');
    // Games: a live game of tic-tac-toe
    for(const p of [A.page,B.page])await p.getByRole('button',{name:'Games',exact:true}).click();
    await A.page.locator('.game-card',{hasText:'Tic-tac-toe'}).getByRole('button').click();
    await expect(B.page.locator('.game-row.turn')).toHaveCount(0);await B.page.locator('.game-card',{hasText:'Tic-tac-toe'}).getByRole('button',{name:'Continue'}).click();
    const move=async(p:Page,square:number)=>{await p.getByRole('gridcell',{name:new RegExp(`^Square ${square}, empty`)}).click();};
    await move(A.page,1);await expect(B.page.locator('.game-status')).toHaveText('Your turn');await move(B.page,4);await move(A.page,2);await move(B.page,5);await move(A.page,3);
    await expect(A.page.locator('.game-status')).toHaveText('You won! 🏆');await expect(B.page.locator('.game-status')).toHaveText('Asha won');
    await B.page.screenshot({path:'artifacts/games-390.png'});
    await B.page.getByRole('button',{name:'Rematch'}).click();await expect(B.page.locator('.game-status')).toHaveText('Your turn');
    expect(errors).toEqual([]);
  }finally{await A.context.close();await B.context.close();}
});
