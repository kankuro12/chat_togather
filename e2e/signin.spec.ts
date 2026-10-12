import { test,expect } from '@playwright/test';

test('sign-in methods switch, OTP accepts pasted code, normal screens need no scrolling',async({page})=>{
  await page.route('**/api/auth/phone/send',route=>route.fulfill({json:{challenge:'test-challenge',retryAfter:60}}));
  await page.goto('/#signup');
  await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue with Facebook'})).toBeVisible();
  await expect(page.getByText('Server-protected privacy.',{exact:false})).toHaveCount(0);
  for(const size of [{width:1280,height:720},{width:320,height:800},{width:375,height:800},{width:414,height:800},{width:768,height:800},{width:360,height:640}]){
    await page.setViewportSize(size);
    await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeInViewport();
    expect(await page.locator('.onboarding').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    await page.screenshot({path:`artifacts/redesign-auth-${size.width}.png`});
  }
  await page.getByRole('button',{name:'Phone',exact:true}).click();
  await page.getByLabel('Your name').fill('Maya');
  await page.getByLabel('Phone number').fill('9800000000');
  await page.getByRole('button',{name:'Send code',exact:true}).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await expect(page.getByRole('button',{name:'Verify & continue'})).toBeInViewport();
  await page.getByRole('button',{name:'Change number'}).click();
  await expect(page.getByLabel('Phone number')).toHaveValue('9800000000');
  await page.getByRole('button',{name:'Email',exact:true}).click();
  await page.getByRole('link',{name:'Sign in',exact:true}).click();
  await expect(page.getByLabel('Your name')).toHaveCount(0);
});

test('provider errors stay understandable and layout remains accessible on short screens',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.getByRole('alert')).toContainText('Please use email');
  await page.setViewportSize({width:320,height:480});
  await page.getByRole('button',{name:'Send code',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
