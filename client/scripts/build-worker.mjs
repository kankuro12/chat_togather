import {build} from 'esbuild';
await build({entryPoints:['src/firebase-worker.ts'],bundle:true,minify:true,format:'iife',outfile:'public/firebase-messaging-sw.js',define:{__PRECACHE__:JSON.stringify(['/offline.html','/offline.css','/together-logo.svg']),__CACHE_VERSION__:JSON.stringify('development')}});
