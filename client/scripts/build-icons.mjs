// Renders every app icon and splash image from the single logo artwork below.
// Run from client/: node scripts/build-icons.mjs [--preview out.png]
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

const ACCENT='#df0048',CREAM='#fffaf5',MINT='#b9f4e3';
// Two chat bubbles with a heart where they overlap, on a 512 grid.
const BUBBLE_A='M264 146H184c-36 0-60 24-60 60v35c0 36 24 60 60 60h18l-13 35 51-35h24c36 0 60-24 60-60v-35c0-36-24-60-60-60Z';
const BUBBLE_B='M248 211h80c36 0 60 24 60 60v35c0 36-24 60-60 60h-18l13 35-51-35h-24c-36 0-60-24-60-60v-35c0-36 24-60 60-60Z';
const BUBBLE_A_TOP='M264 146c36 0 60 24 60 60v35';
const HEART='M256 300C256 300 212 274 212 243C212 228 223 217 237 217C246 217 252 222 256 229C260 222 266 217 275 217C289 217 300 228 300 243C300 274 256 300 256 300Z';
const art=(scale=1)=>`<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
<path d="${BUBBLE_A}" fill="none" stroke="${CREAM}" stroke-width="24" stroke-linejoin="round"/>
<path d="${BUBBLE_B}" fill="none" stroke="${MINT}" stroke-width="24" stroke-linejoin="round"/>
<path d="${BUBBLE_A_TOP}" fill="none" stroke="${CREAM}" stroke-width="24" stroke-linecap="round"/>
<path d="${HEART}" fill="${CREAM}" stroke="${ACCENT}" stroke-width="18" stroke-linejoin="round" paint-order="stroke"/></g>`;
const svg=(body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;
export const logo=svg(`<rect width="512" height="512" rx="112" fill="${ACCENT}"/>${art()}`);
const square=(scale)=>svg(`<rect width="512" height="512" fill="${ACCENT}"/>${art(scale)}`);
const round=svg(`<circle cx="256" cy="256" r="256" fill="${ACCENT}"/>${art(0.92)}`);
const foreground=svg(art());

const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();
async function render(markup,width,height,path,background='transparent'){
  await page.setViewportSize({width,height});
  await page.setContent(`<html><body style="margin:0;background:${background};display:grid;place-items:center;width:${width}px;height:${height}px">${markup}</body></html>`);
  await mkdir(dirname(path),{recursive:true});await writeFile(path,await page.screenshot({omitBackground:background==='transparent'}));
}
const sized=(markup,size)=>markup.replace('<svg ',`<svg width="${size}" height="${size}" `);
const preview=process.argv.indexOf('--preview');
if(preview>0){
  await render(`<div style="display:flex;gap:24px;align-items:center">${sized(logo,192)}${sized(round,120)}${sized(logo,48)}${sized(logo,24)}</div>`,520,240,process.argv[preview+1],'#f4eeee');
}else{
  await writeFile('public/together-logo.svg',logo+'\n');
  for(const size of [180,192,512])await render(sized(logo,size),size,size,`public/icons/icon-${size}.png`);
  await render(sized(square(0.78),512),512,512,'public/icons/maskable-512.png');
  await render(sized(square(1),1024),1024,1024,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  const res='android/app/src/main/res';
  for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
    await render(sized(logo,size),size,size,`${res}/mipmap-${density}/ic_launcher.png`);
    await render(sized(round,size),size,size,`${res}/mipmap-${density}/ic_launcher_round.png`);
    await render(sized(foreground,size*2.25),size*2.25,size*2.25,`${res}/mipmap-${density}/ic_launcher_foreground.png`);
  }
  const splash=async(width,height,path)=>render(sized(logo,Math.round(Math.min(width,height)*0.28)),width,height,path,CREAM);
  for(const [folder,w,h] of [['drawable',480,320],['drawable-land-mdpi',480,320],['drawable-land-hdpi',800,480],['drawable-land-xhdpi',1280,720],['drawable-land-xxhdpi',1600,960],['drawable-land-xxxhdpi',1920,1280],['drawable-port-mdpi',320,480],['drawable-port-hdpi',480,800],['drawable-port-xhdpi',720,1280],['drawable-port-xxhdpi',960,1600],['drawable-port-xxxhdpi',1280,1920]])await splash(w,h,`${res}/${folder}/splash.png`);
  for(const name of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'])await splash(2732,2732,'ios/App/App/Assets.xcassets/Splash.imageset/'+name);
}
await browser.close();
