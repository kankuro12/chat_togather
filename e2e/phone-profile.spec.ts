import {test,expect} from '@playwright/test';
test('new number entering login gets persistent name setup after OTP',async({page})=>{
  test.skip(process.env.E2E_ISOLATED!=='1','Needs isolated phone test mode');
  const phone='982'+Date.now().toString().slice(-7);await page.goto('/#login');
  await expect(page.getByLabel('Your name')).toHaveCount(0);await page.getByLabel('Phone number').fill(phone);await page.getByRole('button',{name:'Send code',exact:true}).click();await page.getByLabel('Verification code').fill('123456');await page.getByRole('button',{name:'Verify & continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'What should we call you?'})).toBeVisible();await expect(page.getByRole('button',{name:'Create invitation'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();
  await page.reload();await expect(page.getByLabel('Your name')).toBeVisible();await page.getByLabel('Your name').fill('Sita');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Better with you'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Better with you'})).toBeVisible();
});
