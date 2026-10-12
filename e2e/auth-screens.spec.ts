import {test,expect} from '@playwright/test';

test('login and signup have separate addresses, layouts, and safe back navigation',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveCount(0);
  await expect(page.getByLabel('Phone number')).toBeVisible();
  await expect(page.getByRole('button',{name:'Phone',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Email',exact:true}).click();
  await page.getByLabel('Password',{exact:true}).fill('temporary-password');
  await page.getByRole('link',{name:'Create account',exact:true}).click();
  await expect(page).toHaveURL(/#signup$/);
  await expect(page.getByLabel('Your name')).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
  await expect(page.getByRole('button',{name:'Sign in tab'})).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Your name')).toHaveCount(0);
  for(const size of [{width:320,height:800},{width:375,height:800},{width:414,height:800},{width:768,height:800},{width:1280,height:720},{width:360,height:640}]){
    await page.setViewportSize(size);
    for(const mode of ['login','signup']){
      await page.goto('/#'+mode);
      await page.getByRole('button',{name:'Phone',exact:true}).click();
      await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await page.locator('.onboarding').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
      await page.screenshot({path:`artifacts/auth-${mode}-${size.width}.png`});
    }
  }
});
