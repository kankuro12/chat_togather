import {build} from 'esbuild';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const names=(await readdir('www')).filter(name=>/\.(js|css)$/.test(name)&&name!=='firebase-messaging-sw.js');
const assets=[...new Set([...names.map(name=>'/'+name),'/offline.html','/offline.css','/together-logo.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'])];
const hash=createHash('sha256');for(const path of assets.slice().sort())hash.update(await readFile('www'+path));
await build({entryPoints:['src/firebase-worker.ts'],bundle:true,minify:true,format:'iife',outfile:'www/firebase-messaging-sw.js',define:{__PRECACHE__:JSON.stringify(assets),__CACHE_VERSION__:JSON.stringify(hash.digest('hex').slice(0,16))}});
