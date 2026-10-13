import {test,expect} from '@playwright/test';

test('reply to a message, see choice answers as replies, and opt in to lock-screen previews',async({browser,request,baseURL})=>{
  const stamp=Date.now();
  const register=async(name:string)=>(await request.post('/api/auth/register',{data:{name,email:name+stamp+'@replies.test',password:'safe-password-123'}})).json();
  const a=await register('ReplyA'),b=await register('ReplyB');
  const as=(user:any)=>({Authorization:'Bearer '+user.token});
  const invite=await request.post('/api/pair/invite',{headers:as(a),data:{}});
  await request.post('/api/pair/join',{headers:as(b),data:{code:(await invite.json()).code}});
  await request.post('/api/messages',{headers:as(a),data:{text:'Movie tonight?',client_id:'movie'}});

  const context=await browser.newContext({baseURL,viewport:{width:375,height:760}});
  await context.addInitScript(token=>localStorage.setItem('together.session',token),b.token);
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#chat');
  const original=page.locator('.message').filter({has:page.locator('.bubble > p',{hasText:/^Movie tonight\?$/})});
  await original.getByRole('button',{name:'Reply',exact:true}).click();
  await expect(page.locator('.reply-preview')).toContainText('Replying to ReplyA');await expect(page.locator('.reply-preview')).toContainText('Movie tonight?');
  await expect(page.getByLabel('Message your partner')).toBeFocused();
  await page.getByLabel('Message your partner').fill('Yes, at 7!');await page.getByRole('button',{name:'Send message',exact:true}).click();
  const reply=page.locator('.message',{hasText:'Yes, at 7!'});
  await expect(reply.locator('.message-quote')).toContainText('ReplyA');await expect(reply.locator('.message-quote')).toContainText('Movie tonight?');
  await expect(page.locator('.reply-preview')).toHaveCount(0);
  await reply.locator('.message-quote').click();await expect(original).toHaveClass(/flash/);

  // Phones: swiping a message to the right starts a reply; a vertical drag (scrolling) does not.
  const swipe=(dx:number,dy:number)=>original.evaluate((el,[dx,dy])=>{const box=el.getBoundingClientRect(),x=box.left+20,y=box.top+20;
    const touch=(cx:number,cy:number)=>new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent('touchstart',{touches:[touch(x,y)],bubbles:true}));
    for(let i=1;i<=6;i++)el.dispatchEvent(new TouchEvent('touchmove',{touches:[touch(x+dx*i/6,y+dy*i/6)],bubbles:true}));
    el.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true}));},[dx,dy]);
  await swipe(0,90);await expect(page.locator('.reply-preview')).toHaveCount(0);
  await swipe(80,4);await expect(page.locator('.reply-preview')).toContainText('Movie tonight?');await page.getByRole('button',{name:'Cancel reply'}).click();
  // Cancelling a reply sends a plain message.
  await original.getByRole('button',{name:'Reply',exact:true}).click();await page.getByRole('button',{name:'Cancel reply'}).click();
  await page.getByLabel('Message your partner').fill('Plain one');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.locator('.message',{hasText:'Plain one'}).locator('.message-quote')).toHaveCount(0);

  // A choice answer shows as a reply to the message that shared the choice.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');
  const upload=await (await request.post('/api/media?purpose=choice',{headers:as(a),multipart:{file:{name:'c.png',mimeType:'image/png',buffer:png}}})).json();
  const choice=await (await request.post('/api/decisions',{headers:as(a),data:{title:'Which cafe?',mode:'choose',options:[{media_id:upload.id},{media_id:upload.id}]}})).json();
  await request.post('/api/decisions/'+choice.id+'/vote',{headers:as(b),data:{option_id:choice.options[1].id}});
  const answer=page.locator('.message').filter({has:page.locator('.chat-choice-answer')});
  await expect(answer.locator('.message-quote')).toContainText('New choice: Which cafe?');
  // Only the chosen image and the choice title are shown, not every option.
  await expect(answer.locator('.chat-choice-answer img')).toHaveCount(1);await expect(answer.locator('.chat-choice-thumbnails')).toHaveCount(0);
  await expect(answer.locator('.bubble > p')).toHaveText('Which cafe?');
  await page.screenshot({path:'artifacts/chat-replies-375.png'});

  // Lock-screen previews start off and can be turned on from the account menu.
  await page.getByRole('button',{name:'Back to app',exact:true}).click();await page.getByLabel('Account menu').click();
  const previews=page.getByLabel('Show names and message text on lock screen');await expect(previews).not.toBeChecked();
  await previews.check();await expect.poll(async()=>(await (await request.get('/api/notifications/settings',{headers:as(b)})).json()).previews).toBe(true);
  expect(errors).toEqual([]);await context.close();
});
