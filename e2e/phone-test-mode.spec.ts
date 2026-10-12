import {test,expect} from '@playwright/test';

test('phone test mode signs in with 123456 through the real API',async({page})=>{
  test.skip(process.env.E2E_ISOLATED!=='1','Requires isolated test server with phone test mode enabled');
  await page.goto('/#signup');
  await page.getByRole('button',{name:'Phone',exact:true}).click();
  await page.getByLabel('Your name').fill('OTP tester');
  await page.getByLabel('Phone number').fill('98'+Date.now().toString().slice(-8));
  await page.getByRole('button',{name:'Send code',exact:true}).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button',{name:'Verify & continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Better with you',exact:true})).toBeVisible();
});
