import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';

test('Nepal phone accounts pair using QR image and manual confirmation',async({browser})=>{
  test.skip(process.env.E2E_ISOLATED!=='1','Requires isolated phone test mode');
  const first=await browser.newContext(),second=await browser.newContext();
  try{
    const a=await first.newPage(),b=await second.newPage(),suffix=Date.now().toString().slice(-7);
    for(const [page,number,name] of [[a,'980'+suffix,'QR inviter'],[b,'981'+suffix,'QR partner']] as const){
      await page.goto('/#signup');await page.getByLabel('Your name').fill(name);await page.getByLabel('Phone number').fill(number);
      await page.getByRole('button',{name:'Send code',exact:true}).click();await page.getByLabel('Verification code').fill('123456');await page.getByRole('button',{name:'Verify & continue',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Better with you'})).toBeVisible();
    }
    await a.getByRole('button',{name:'Create invitation',exact:true}).click();
    const code=await a.getByTestId('invite-code').innerText();
    await expect(a.getByAltText('Partner invitation QR code')).toBeVisible();
    await mkdir('artifacts',{recursive:true});const qr=await a.getByAltText('Partner invitation QR code').getAttribute('src');await writeFile('artifacts/pairing-qr.png',Buffer.from(qr!.split(',')[1],'base64'));
    for(const width of [320,375,414,768]){await a.setViewportSize({width,height:800});expect(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
    await a.screenshot({path:'artifacts/qr-invitation.png'});
    await b.getByRole('button',{name:'Join',exact:true}).click();
    await b.getByLabel('Partner invitation code').fill(code);await expect(b.getByLabel('Partner invitation code')).toHaveValue(code);
    await b.getByLabel('Partner invitation code').fill('');await b.getByRole('button',{name:'Scan QR code',exact:true}).click();
    await b.locator('input[type=file]').setInputFiles('artifacts/pairing-qr.png');
    await expect(b.getByLabel('Partner invitation code')).toHaveValue(code);await expect(b.locator('dialog')).not.toBeVisible();
    await expect(b.getByRole('heading',{name:'Better with you'})).toBeVisible();
    await b.getByRole('button',{name:'Join your partner',exact:true}).click();
    await expect(b.getByRole('heading',{name:'Better with you'})).toHaveCount(0);
    await expect(a.getByRole('heading',{name:'Better with you'})).toHaveCount(0);
  }finally{await first.close();await second.close();}
});
