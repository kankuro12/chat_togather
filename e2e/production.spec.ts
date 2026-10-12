import { test,expect } from '@playwright/test';
test('production styles load under content security policy',async({page})=>{
  const errors:string[]=[];page.on('console',event=>{if(event.type()==='error'&&/Content Security Policy|violates.*directive/i.test(event.text()))errors.push(event.text());});
  await page.goto((process.env.E2E_ISOLATED==='1'?'http://127.0.0.1:3101':'http://127.0.0.1:3001'));await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
  expect(await page.locator('.welcome-art').evaluate(el=>getComputedStyle(el).width)).toBe('1280px');expect(errors).toEqual([]);
});
