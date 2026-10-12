"use strict";(()=>{var d=["/offline.html","/offline.css","/together-logo.svg"];var Ne="together-shell-development";self.addEventListener("install",e=>e.waitUntil(caches.open(Ne).then(t=>t.addAll(d))));self.addEventListener("activate",e=>e.waitUntil((async()=>{for(let t of await caches.keys())t.startsWith("together-shell-")&&t!==Ne&&await caches.delete(t);await self.clients.claim()})()));self.addEventListener("message",e=>{e.data?.type==="ACTIVATE"&&self.skipWaiting()});self.addEventListener("fetch",e=>{let t=e.request,n=new URL(t.url);if(!(t.method!=="GET"||n.origin!==self.location.origin||n.pathname.startsWith("/api/")||n.pathname.startsWith("/socket.io/"))){if(t.mode==="navigate"){e.respondWith(fetch(t).catch(async()=>await caches.match("/offline.html")||Response.error()));return}d.includes(n.pathname)&&e.respondWith(caches.match(n.pathname).then(r=>r||fetch(t)))}});var xe=()=>{};var Be=function(e){let t=[],n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)===55296&&r+1<e.length&&(e.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(e.charCodeAt(++r)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t},kt=function(e){let t=[],n=0,r=0;for(;n<e.length;){let i=e[n++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){let o=e[n++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){let o=e[n++],s=e[n++],a=e[n++],c=((i&7)<<18|(o&63)<<12|(s&63)<<6|a&63)-65536;t[r++]=String.fromCharCode(55296+(c>>10)),t[r++]=String.fromCharCode(56320+(c&1023))}else{let o=e[n++],s=e[n++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|s&63)}}return t.join("")},Re={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();let n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<e.length;i+=3){let o=e[i],s=i+1<e.length,a=s?e[i+1]:0,c=i+2<e.length,l=c?e[i+2]:0,u=o>>2,k=(o&3)<<4|a>>4,x=(a&15)<<2|l>>6,M=l&63;c||(M=64,s||(x=64)),r.push(n[u],n[k],n[x],n[M])}return r.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray(Be(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):kt(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();let n=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<e.length;){let o=n[e.charAt(i++)],a=i<e.length?n[e.charAt(i)]:0;++i;let l=i<e.length?n[e.charAt(i)]:64;++i;let k=i<e.length?n[e.charAt(i)]:64;if(++i,o==null||a==null||l==null||k==null)throw new G;let x=o<<2|a>>4;if(r.push(x),l!==64){let M=a<<4&240|l>>2;if(r.push(M),k!==64){let Dt=l<<6&192|k;r.push(Dt)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}},G=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},Ot=function(e){let t=Be(e);return Re.encodeByteArray(t,!0)},J=function(e){return Ot(e).replace(/\./g,"")},Le=function(e){try{return Re.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};function Nt(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}var xt=()=>Nt().__FIREBASE_DEFAULTS__,Mt=()=>{if(typeof process>"u"||typeof process.env>"u")return;let e=process.env.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Bt=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let t=e&&Le(e[1]);return t&&JSON.parse(t)},Rt=()=>{try{return xe()||xt()||Mt()||Bt()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}};var Y=()=>{var e;return(e=Rt())===null||e===void 0?void 0:e.config};var B=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,n)=>{this.resolve=t,this.reject=n})}wrapCallback(t){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(n):t(n,r))}}};function R(){try{return typeof indexedDB=="object"}catch{return!1}}function L(){return new Promise((e,t)=>{try{let n=!0,r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),e(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{var o;t(((o=i.error)===null||o===void 0?void 0:o.message)||"")}}catch(n){t(n)}})}var Lt="FirebaseError",m=class e extends Error{constructor(t,n,r){super(n),this.code=t,this.customData=r,this.name=Lt,Object.setPrototypeOf(this,e.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,b.prototype.create)}},b=class{constructor(t,n,r){this.service=t,this.serviceName=n,this.errors=r}create(t,...n){let r=n[0]||{},i=`${this.service}/${t}`,o=this.errors[t],s=o?Pt(o,r):"Error",a=`${this.serviceName}: ${s} (${i}).`;return new m(i,a,r)}};function Pt(e,t){return e.replace(Ft,(n,r)=>{let i=t[r];return i!=null?String(i):`<${r}?>`})}var Ft=/\{\$([^}]+)}/g;function P(e,t){if(e===t)return!0;let n=Object.keys(e),r=Object.keys(t);for(let i of n){if(!r.includes(i))return!1;let o=e[i],s=t[i];if(Me(o)&&Me(s)){if(!P(o,s))return!1}else if(o!==s)return!1}for(let i of r)if(!n.includes(i))return!1;return!0}function Me(e){return e!==null&&typeof e=="object"}var Ii=14400*1e3;function Z(e){return e&&e._delegate?e._delegate:e}var h=class{constructor(t,n,r){this.name=t,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}};var I="[DEFAULT]";var Q=class{constructor(t,n){this.name=t,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){let n=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(n)){let r=new B;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{let i=this.getOrInitializeService({instanceIdentifier:n});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(t){var n;let r=this.normalizeInstanceIdentifier(t?.identifier),i=(n=t?.optional)!==null&&n!==void 0?n:!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(o){if(i)return null;throw o}else{if(i)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if($t(t))try{this.getOrInitializeService({instanceIdentifier:I})}catch{}for(let[n,r]of this.instancesDeferred.entries()){let i=this.normalizeInstanceIdentifier(n);try{let o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=I){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){let t=Array.from(this.instances.values());await Promise.all([...t.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...t.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=I){return this.instances.has(t)}getOptions(t=I){return this.instancesOptions.get(t)||{}}initialize(t={}){let{options:n={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let i=this.getOrInitializeService({instanceIdentifier:r,options:n});for(let[o,s]of this.instancesDeferred.entries()){let a=this.normalizeInstanceIdentifier(o);r===a&&s.resolve(i)}return i}onInit(t,n){var r;let i=this.normalizeInstanceIdentifier(n),o=(r=this.onInitCallbacks.get(i))!==null&&r!==void 0?r:new Set;o.add(t),this.onInitCallbacks.set(i,o);let s=this.instances.get(i);return s&&t(s,i),()=>{o.delete(t)}}invokeOnInitCallbacks(t,n){let r=this.onInitCallbacks.get(n);if(r)for(let i of r)try{i(t,n)}catch{}}getOrInitializeService({instanceIdentifier:t,options:n={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:jt(t),options:n}),this.instances.set(t,r),this.instancesOptions.set(t,n),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=I){return this.component?this.component.multipleInstances?t:I:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};function jt(e){return e===I?void 0:e}function $t(e){return e.instantiationMode==="EAGER"}var F=class{constructor(t){this.name=t,this.providers=new Map}addComponent(t){let n=this.getProvider(t.name);if(n.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);n.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);let n=new Q(t,this);return this.providers.set(t,n),n}getProviders(){return Array.from(this.providers.values())}};var Ht=[],f;(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(f||(f={}));var Vt={debug:f.DEBUG,verbose:f.VERBOSE,info:f.INFO,warn:f.WARN,error:f.ERROR,silent:f.SILENT},Ut=f.INFO,Wt={[f.DEBUG]:"log",[f.VERBOSE]:"log",[f.INFO]:"info",[f.WARN]:"warn",[f.ERROR]:"error"},zt=(e,t,...n)=>{if(t<e.logLevel)return;let r=new Date().toISOString(),i=Wt[t];if(i)console[i](`[${r}]  ${e.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)},j=class{constructor(t){this.name=t,this._logLevel=Ut,this._logHandler=zt,this._userLogHandler=null,Ht.push(this)}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in f))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?Vt[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,f.DEBUG,...t),this._logHandler(this,f.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,f.VERBOSE,...t),this._logHandler(this,f.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,f.INFO,...t),this._logHandler(this,f.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,f.WARN,...t),this._logHandler(this,f.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,f.ERROR,...t),this._logHandler(this,f.ERROR,...t)}};var Kt=(e,t)=>t.some(n=>e instanceof n),Pe,Fe;function qt(){return Pe||(Pe=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Gt(){return Fe||(Fe=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}var je=new WeakMap,ee=new WeakMap,$e=new WeakMap,X=new WeakMap,ne=new WeakMap;function Jt(e){let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("success",o),e.removeEventListener("error",s)},o=()=>{n(g(e.result)),i()},s=()=>{r(e.error),i()};e.addEventListener("success",o),e.addEventListener("error",s)});return t.then(n=>{n instanceof IDBCursor&&je.set(n,e)}).catch(()=>{}),ne.set(t,e),t}function Yt(e){if(ee.has(e))return;let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("complete",o),e.removeEventListener("error",s),e.removeEventListener("abort",s)},o=()=>{n(),i()},s=()=>{r(e.error||new DOMException("AbortError","AbortError")),i()};e.addEventListener("complete",o),e.addEventListener("error",s),e.addEventListener("abort",s)});ee.set(e,t)}var te={get(e,t,n){if(e instanceof IDBTransaction){if(t==="done")return ee.get(e);if(t==="objectStoreNames")return e.objectStoreNames||$e.get(e);if(t==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return g(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};function He(e){te=e(te)}function Zt(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...n){let r=e.call($(this),t,...n);return $e.set(r,t.sort?t.sort():[t]),g(r)}:Gt().includes(e)?function(...t){return e.apply($(this),t),g(je.get(this))}:function(...t){return g(e.apply($(this),t))}}function Qt(e){return typeof e=="function"?Zt(e):(e instanceof IDBTransaction&&Yt(e),Kt(e,qt())?new Proxy(e,te):e)}function g(e){if(e instanceof IDBRequest)return Jt(e);if(X.has(e))return X.get(e);let t=Qt(e);return t!==e&&(X.set(e,t),ne.set(t,e)),t}var $=e=>ne.get(e);function S(e,t,{blocked:n,upgrade:r,blocking:i,terminated:o}={}){let s=indexedDB.open(e,t),a=g(s);return r&&s.addEventListener("upgradeneeded",c=>{r(g(s.result),c.oldVersion,c.newVersion,g(s.transaction),c)}),n&&s.addEventListener("blocked",c=>n(c.oldVersion,c.newVersion,c)),a.then(c=>{o&&c.addEventListener("close",()=>o()),i&&c.addEventListener("versionchange",l=>i(l.oldVersion,l.newVersion,l))}).catch(()=>{}),a}function H(e,{blocked:t}={}){let n=indexedDB.deleteDatabase(e);return t&&n.addEventListener("blocked",r=>t(r.oldVersion,r)),g(n).then(()=>{})}var Xt=["get","getKey","getAll","getAllKeys","count"],en=["put","add","delete","clear"],re=new Map;function Ve(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(re.get(t))return re.get(t);let n=t.replace(/FromIndex$/,""),r=t!==n,i=en.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||Xt.includes(n)))return;let o=async function(s,...a){let c=this.transaction(s,i?"readwrite":"readonly"),l=c.store;return r&&(l=l.index(a.shift())),(await Promise.all([l[n](...a),i&&c.done]))[0]};return re.set(t,o),o}He(e=>({...e,get:(t,n,r)=>Ve(t,n)||e.get(t,n,r),has:(t,n)=>!!Ve(t,n)||e.has(t,n)}));var oe=class{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(tn(n)){let r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}};function tn(e){let t=e.getComponent();return t?.type==="VERSION"}var se="@firebase/app",Ue="0.13.2";var w=new j("@firebase/app"),nn="@firebase/app-compat",rn="@firebase/analytics-compat",on="@firebase/analytics",sn="@firebase/app-check-compat",an="@firebase/app-check",cn="@firebase/auth",un="@firebase/auth-compat",ln="@firebase/database",fn="@firebase/data-connect",dn="@firebase/database-compat",hn="@firebase/functions",pn="@firebase/functions-compat",gn="@firebase/installations",mn="@firebase/installations-compat",bn="@firebase/messaging",wn="@firebase/messaging-compat",yn="@firebase/performance",_n="@firebase/performance-compat",vn="@firebase/remote-config",En="@firebase/remote-config-compat",In="@firebase/storage",Sn="@firebase/storage-compat",Cn="@firebase/firestore",An="@firebase/ai",Dn="@firebase/firestore-compat",Tn="firebase";var ae="[DEFAULT]",kn={[se]:"fire-core",[nn]:"fire-core-compat",[on]:"fire-analytics",[rn]:"fire-analytics-compat",[an]:"fire-app-check",[sn]:"fire-app-check-compat",[cn]:"fire-auth",[un]:"fire-auth-compat",[ln]:"fire-rtdb",[fn]:"fire-data-connect",[dn]:"fire-rtdb-compat",[hn]:"fire-fn",[pn]:"fire-fn-compat",[gn]:"fire-iid",[mn]:"fire-iid-compat",[bn]:"fire-fcm",[wn]:"fire-fcm-compat",[yn]:"fire-perf",[_n]:"fire-perf-compat",[vn]:"fire-rc",[En]:"fire-rc-compat",[In]:"fire-gcs",[Sn]:"fire-gcs-compat",[Cn]:"fire-fst",[Dn]:"fire-fst-compat",[An]:"fire-vertex","fire-js":"fire-js",[Tn]:"fire-js-all"};var V=new Map,On=new Map,ce=new Map;function We(e,t){try{e.container.addComponent(t)}catch(n){w.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function E(e){let t=e.name;if(ce.has(t))return w.debug(`There were multiple attempts to register component ${t}.`),!1;ce.set(t,e);for(let n of V.values())We(n,e);for(let n of On.values())We(n,e);return!0}function N(e,t){let n=e.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}var Nn={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},_=new b("app","Firebase",Nn);var ue=class{constructor(t,n,r){this._isDeleted=!1,this._options=Object.assign({},t),this._config=Object.assign({},n),this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new h("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw _.create("app-deleted",{appName:this._name})}};function de(e,t={}){let n=e;typeof t!="object"&&(t={name:t});let r=Object.assign({name:ae,automaticDataCollectionEnabled:!0},t),i=r.name;if(typeof i!="string"||!i)throw _.create("bad-app-name",{appName:String(i)});if(n||(n=Y()),!n)throw _.create("no-options");let o=V.get(i);if(o){if(P(n,o.options)&&P(r,o.config))return o;throw _.create("duplicate-app",{appName:i})}let s=new F(i);for(let c of ce.values())s.addComponent(c);let a=new ue(n,r,s);return V.set(i,a),a}function he(e=ae){let t=V.get(e);if(!t&&e===ae&&Y())return de();if(!t)throw _.create("no-app",{appName:e});return t}function v(e,t,n){var r;let i=(r=kn[e])!==null&&r!==void 0?r:e;n&&(i+=`-${n}`);let o=i.match(/\s|\//),s=t.match(/\s|\//);if(o||s){let a=[`Unable to register library "${i}" with version "${t}":`];o&&a.push(`library name "${i}" contains illegal characters (whitespace or "/")`),o&&s&&a.push("and"),s&&a.push(`version name "${t}" contains illegal characters (whitespace or "/")`),w.warn(a.join(" "));return}E(new h(`${i}-version`,()=>({library:i,version:t}),"VERSION"))}var xn="firebase-heartbeat-database",Mn=1,O="firebase-heartbeat-store",ie=null;function Ge(){return ie||(ie=S(xn,Mn,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(O)}catch(n){console.warn(n)}}}}).catch(e=>{throw _.create("idb-open",{originalErrorMessage:e.message})})),ie}async function Bn(e){try{let n=(await Ge()).transaction(O),r=await n.objectStore(O).get(Je(e));return await n.done,r}catch(t){if(t instanceof m)w.warn(t.message);else{let n=_.create("idb-get",{originalErrorMessage:t?.message});w.warn(n.message)}}}async function ze(e,t){try{let r=(await Ge()).transaction(O,"readwrite");await r.objectStore(O).put(t,Je(e)),await r.done}catch(n){if(n instanceof m)w.warn(n.message);else{let r=_.create("idb-set",{originalErrorMessage:n?.message});w.warn(r.message)}}}function Je(e){return`${e.name}!${e.options.appId}`}var Rn=1024,Ln=30,le=class{constructor(t){this.container=t,this._heartbeatsCache=null;let n=this.container.getProvider("app").getImmediate();this._storage=new fe(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var t,n;try{let i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=Ke();if(((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)===null||n===void 0?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(s=>s.date===o))return;if(this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats.length>Ln){let s=Fn(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(s,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){w.warn(r)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";let n=Ke(),{heartbeatsToSend:r,unsentEntries:i}=Pn(this._heartbeatsCache.heartbeats),o=J(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=n,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(n){return w.warn(n),""}}};function Ke(){return new Date().toISOString().substring(0,10)}function Pn(e,t=Rn){let n=[],r=e.slice();for(let i of e){let o=n.find(s=>s.agent===i.agent);if(o){if(o.dates.push(i.date),qe(n)>t){o.dates.pop();break}}else if(n.push({agent:i.agent,dates:[i.date]}),qe(n)>t){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}var fe=class{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return R()?L().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let n=await Bn(this.app);return n?.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){var n;if(await this._canUseIndexedDBPromise){let i=await this.read();return ze(this.app,{lastSentHeartbeatDate:(n=t.lastSentHeartbeatDate)!==null&&n!==void 0?n:i.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){var n;if(await this._canUseIndexedDBPromise){let i=await this.read();return ze(this.app,{lastSentHeartbeatDate:(n=t.lastSentHeartbeatDate)!==null&&n!==void 0?n:i.lastSentHeartbeatDate,heartbeats:[...i.heartbeats,...t.heartbeats]})}else return}};function qe(e){return J(JSON.stringify({version:2,heartbeats:e})).length}function Fn(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let r=1;r<e.length;r++)e[r].date<n&&(n=e[r].date,t=r);return t}function jn(e){E(new h("platform-logger",t=>new oe(t),"PRIVATE")),E(new h("heartbeat",t=>new le(t),"PRIVATE")),v(se,Ue,e),v(se,Ue,"esm2017"),v("fire-js","")}jn("");var $n="firebase",Hn="11.10.0";v($n,Hn,"app");var Qe="@firebase/installations",be="0.6.18";var Xe=1e4,et=`w:${be}`,tt="FIS_v2",Vn="https://firebaseinstallations.googleapis.com/v1",Un=3600*1e3,Wn="installations",zn="Installations";var Kn={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},A=new b(Wn,zn,Kn);function nt(e){return e instanceof m&&e.code.includes("request-failed")}function rt({projectId:e}){return`${Vn}/projects/${e}/installations`}function it(e){return{token:e.token,requestStatus:2,expiresIn:Gn(e.expiresIn),creationTime:Date.now()}}async function ot(e,t){let r=(await t.json()).error;return A.create("request-failed",{requestName:e,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function st({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function qn(e,{refreshToken:t}){let n=st(e);return n.append("Authorization",Jn(t)),n}async function at(e){let t=await e();return t.status>=500&&t.status<600?e():t}function Gn(e){return Number(e.replace("s","000"))}function Jn(e){return`${tt} ${e}`}async function Yn({appConfig:e,heartbeatServiceProvider:t},{fid:n}){let r=rt(e),i=st(e),o=t.getImmediate({optional:!0});if(o){let l=await o.getHeartbeatsHeader();l&&i.append("x-firebase-client",l)}let s={fid:n,authVersion:tt,appId:e.appId,sdkVersion:et},a={method:"POST",headers:i,body:JSON.stringify(s)},c=await at(()=>fetch(r,a));if(c.ok){let l=await c.json();return{fid:l.fid||n,registrationStatus:2,refreshToken:l.refreshToken,authToken:it(l.authToken)}}else throw await ot("Create Installation",c)}function ct(e){return new Promise(t=>{setTimeout(t,e)})}function Zn(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}var Qn=/^[cdef][\w-]{21}$/,me="";function Xn(){try{let e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;let n=er(e);return Qn.test(n)?n:me}catch{return me}}function er(e){return Zn(e).substr(0,22)}function W(e){return`${e.appName}!${e.appId}`}var ut=new Map;function lt(e,t){let n=W(e);ft(n,t),tr(n,t)}function ft(e,t){let n=ut.get(e);if(n)for(let r of n)r(t)}function tr(e,t){let n=nr();n&&n.postMessage({key:e,fid:t}),rr()}var C=null;function nr(){return!C&&"BroadcastChannel"in self&&(C=new BroadcastChannel("[Firebase] FID Change"),C.onmessage=e=>{ft(e.data.key,e.data.fid)}),C}function rr(){ut.size===0&&C&&(C.close(),C=null)}var ir="firebase-installations-database",or=1,D="firebase-installations-store",pe=null;function we(){return pe||(pe=S(ir,or,{upgrade:(e,t)=>{t===0&&e.createObjectStore(D)}})),pe}async function U(e,t){let n=W(e),i=(await we()).transaction(D,"readwrite"),o=i.objectStore(D),s=await o.get(n);return await o.put(t,n),await i.done,(!s||s.fid!==t.fid)&&lt(e,t.fid),t}async function dt(e){let t=W(e),r=(await we()).transaction(D,"readwrite");await r.objectStore(D).delete(t),await r.done}async function z(e,t){let n=W(e),i=(await we()).transaction(D,"readwrite"),o=i.objectStore(D),s=await o.get(n),a=t(s);return a===void 0?await o.delete(n):await o.put(a,n),await i.done,a&&(!s||s.fid!==a.fid)&&lt(e,a.fid),a}async function ye(e){let t,n=await z(e.appConfig,r=>{let i=sr(r),o=ar(e,i);return t=o.registrationPromise,o.installationEntry});return n.fid===me?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function sr(e){let t=e||{fid:Xn(),registrationStatus:0};return ht(t)}function ar(e,t){if(t.registrationStatus===0){if(!navigator.onLine){let i=Promise.reject(A.create("app-offline"));return{installationEntry:t,registrationPromise:i}}let n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},r=cr(e,n);return{installationEntry:n,registrationPromise:r}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:ur(e)}:{installationEntry:t}}async function cr(e,t){try{let n=await Yn(e,t);return U(e.appConfig,n)}catch(n){throw nt(n)&&n.customData.serverCode===409?await dt(e.appConfig):await U(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function ur(e){let t=await Ye(e.appConfig);for(;t.registrationStatus===1;)await ct(100),t=await Ye(e.appConfig);if(t.registrationStatus===0){let{installationEntry:n,registrationPromise:r}=await ye(e);return r||n}return t}function Ye(e){return z(e,t=>{if(!t)throw A.create("installation-not-found");return ht(t)})}function ht(e){return lr(e)?{fid:e.fid,registrationStatus:0}:e}function lr(e){return e.registrationStatus===1&&e.registrationTime+Xe<Date.now()}async function fr({appConfig:e,heartbeatServiceProvider:t},n){let r=dr(e,n),i=qn(e,n),o=t.getImmediate({optional:!0});if(o){let l=await o.getHeartbeatsHeader();l&&i.append("x-firebase-client",l)}let s={installation:{sdkVersion:et,appId:e.appId}},a={method:"POST",headers:i,body:JSON.stringify(s)},c=await at(()=>fetch(r,a));if(c.ok){let l=await c.json();return it(l)}else throw await ot("Generate Auth Token",c)}function dr(e,{fid:t}){return`${rt(e)}/${t}/authTokens:generate`}async function _e(e,t=!1){let n,r=await z(e.appConfig,o=>{if(!pt(o))throw A.create("not-registered");let s=o.authToken;if(!t&&gr(s))return o;if(s.requestStatus===1)return n=hr(e,t),o;{if(!navigator.onLine)throw A.create("app-offline");let a=br(o);return n=pr(e,a),a}});return n?await n:r.authToken}async function hr(e,t){let n=await Ze(e.appConfig);for(;n.authToken.requestStatus===1;)await ct(100),n=await Ze(e.appConfig);let r=n.authToken;return r.requestStatus===0?_e(e,t):r}function Ze(e){return z(e,t=>{if(!pt(t))throw A.create("not-registered");let n=t.authToken;return wr(n)?Object.assign(Object.assign({},t),{authToken:{requestStatus:0}}):t})}async function pr(e,t){try{let n=await fr(e,t),r=Object.assign(Object.assign({},t),{authToken:n});return await U(e.appConfig,r),n}catch(n){if(nt(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await dt(e.appConfig);else{let r=Object.assign(Object.assign({},t),{authToken:{requestStatus:0}});await U(e.appConfig,r)}throw n}}function pt(e){return e!==void 0&&e.registrationStatus===2}function gr(e){return e.requestStatus===2&&!mr(e)}function mr(e){let t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+Un}function br(e){let t={requestStatus:1,requestTime:Date.now()};return Object.assign(Object.assign({},e),{authToken:t})}function wr(e){return e.requestStatus===1&&e.requestTime+Xe<Date.now()}async function yr(e){let t=e,{installationEntry:n,registrationPromise:r}=await ye(t);return r?r.catch(console.error):_e(t).catch(console.error),n.fid}async function _r(e,t=!1){let n=e;return await vr(n),(await _e(n,t)).token}async function vr(e){let{registrationPromise:t}=await ye(e);t&&await t}function Er(e){if(!e||!e.options)throw ge("App Configuration");if(!e.name)throw ge("App Name");let t=["projectId","apiKey","appId"];for(let n of t)if(!e.options[n])throw ge(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function ge(e){return A.create("missing-app-config-values",{valueName:e})}var gt="installations",Ir="installations-internal",Sr=e=>{let t=e.getProvider("app").getImmediate(),n=Er(t),r=N(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},Cr=e=>{let t=e.getProvider("app").getImmediate(),n=N(t,gt).getImmediate();return{getId:()=>yr(n),getToken:i=>_r(n,i)}};function Ar(){E(new h(gt,Sr,"PUBLIC")),E(new h(Ir,Cr,"PRIVATE"))}Ar();v(Qe,be);v(Qe,be,"esm2017");var yt="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",Dr="https://fcmregistrations.googleapis.com/v1",_t="FCM_MSG",Tr="google.c.a.c_id",kr=3,Or=1,K;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(K||(K={}));var q;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked"})(q||(q={}));function y(e){let t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Nr(e){let t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),i=new Uint8Array(r.length);for(let o=0;o<r.length;++o)i[o]=r.charCodeAt(o);return i}var ve="fcm_token_details_db",xr=5,mt="fcm_token_object_Store";async function Mr(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(ve))return null;let t=null;return(await S(ve,xr,{upgrade:async(r,i,o,s)=>{var a;if(i<2||!r.objectStoreNames.contains(mt))return;let c=s.objectStore(mt),l=await c.index("fcmSenderId").get(e);if(await c.clear(),!!l){if(i===2){let u=l;if(!u.auth||!u.p256dh||!u.endpoint)return;t={token:u.fcmToken,createTime:(a=u.createTime)!==null&&a!==void 0?a:Date.now(),subscriptionOptions:{auth:u.auth,p256dh:u.p256dh,endpoint:u.endpoint,swScope:u.swScope,vapidKey:typeof u.vapidKey=="string"?u.vapidKey:y(u.vapidKey)}}}else if(i===3){let u=l;t={token:u.fcmToken,createTime:u.createTime,subscriptionOptions:{auth:y(u.auth),p256dh:y(u.p256dh),endpoint:u.endpoint,swScope:u.swScope,vapidKey:y(u.vapidKey)}}}else if(i===4){let u=l;t={token:u.fcmToken,createTime:u.createTime,subscriptionOptions:{auth:y(u.auth),p256dh:y(u.p256dh),endpoint:u.endpoint,swScope:u.swScope,vapidKey:y(u.vapidKey)}}}}}})).close(),await H(ve),await H("fcm_vapid_details_db"),await H("undefined"),Br(t)?t:null}function Br(e){if(!e||!e.subscriptionOptions)return!1;let{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}var Rr="firebase-messaging-database",Lr=1,T="firebase-messaging-store",Ee=null;function Ce(){return Ee||(Ee=S(Rr,Lr,{upgrade:(e,t)=>{t===0&&e.createObjectStore(T)}})),Ee}async function Ae(e){let t=Te(e),r=await(await Ce()).transaction(T).objectStore(T).get(t);if(r)return r;{let i=await Mr(e.appConfig.senderId);if(i)return await De(e,i),i}}async function De(e,t){let n=Te(e),i=(await Ce()).transaction(T,"readwrite");return await i.objectStore(T).put(t,n),await i.done,t}async function Pr(e){let t=Te(e),r=(await Ce()).transaction(T,"readwrite");await r.objectStore(T).delete(t),await r.done}function Te({appConfig:e}){return e.appId}var Fr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},p=new b("messaging","Messaging",Fr);async function jr(e,t){let n=await Oe(e),r=Et(t),i={method:"POST",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(ke(e.appConfig),i)).json()}catch(s){throw p.create("token-subscribe-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw p.create("token-subscribe-failed",{errorInfo:s})}if(!o.token)throw p.create("token-subscribe-no-token");return o.token}async function $r(e,t){let n=await Oe(e),r=Et(t.subscriptionOptions),i={method:"PATCH",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(`${ke(e.appConfig)}/${t.token}`,i)).json()}catch(s){throw p.create("token-update-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw p.create("token-update-failed",{errorInfo:s})}if(!o.token)throw p.create("token-update-no-token");return o.token}async function vt(e,t){let r={method:"DELETE",headers:await Oe(e)};try{let o=await(await fetch(`${ke(e.appConfig)}/${t}`,r)).json();if(o.error){let s=o.error.message;throw p.create("token-unsubscribe-failed",{errorInfo:s})}}catch(i){throw p.create("token-unsubscribe-failed",{errorInfo:i?.toString()})}}function ke({projectId:e}){return`${Dr}/projects/${e}/registrations`}async function Oe({appConfig:e,installations:t}){let n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Et({p256dh:e,auth:t,endpoint:n,vapidKey:r}){let i={web:{endpoint:n,auth:t,p256dh:e}};return r!==yt&&(i.web.applicationPubKey=r),i}var Hr=10080*60*1e3;async function Vr(e){let t=await Wr(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:y(t.getKey("auth")),p256dh:y(t.getKey("p256dh"))},r=await Ae(e.firebaseDependencies);if(r){if(zr(r.subscriptionOptions,n))return Date.now()>=r.createTime+Hr?Ur(e,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await vt(e.firebaseDependencies,r.token)}catch(i){console.warn(i)}return wt(e.firebaseDependencies,n)}else return wt(e.firebaseDependencies,n)}async function bt(e){let t=await Ae(e.firebaseDependencies);t&&(await vt(e.firebaseDependencies,t.token),await Pr(e.firebaseDependencies));let n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function Ur(e,t){try{let n=await $r(e.firebaseDependencies,t),r=Object.assign(Object.assign({},t),{token:n,createTime:Date.now()});return await De(e.firebaseDependencies,r),n}catch(n){throw n}}async function wt(e,t){let r={token:await jr(e,t),createTime:Date.now(),subscriptionOptions:t};return await De(e,r),r.token}async function Wr(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Nr(t)})}function zr(e,t){let n=t.vapidKey===e.vapidKey,r=t.endpoint===e.endpoint,i=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&r&&i&&o}function Kr(e){let t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return qr(t,e),Gr(t,e),Jr(t,e),t}function qr(e,t){if(!t.notification)return;e.notification={};let n=t.notification.title;n&&(e.notification.title=n);let r=t.notification.body;r&&(e.notification.body=r);let i=t.notification.image;i&&(e.notification.image=i);let o=t.notification.icon;o&&(e.notification.icon=o)}function Gr(e,t){t.data&&(e.data=t.data)}function Jr(e,t){var n,r,i,o,s;if(!t.fcmOptions&&!(!((n=t.notification)===null||n===void 0)&&n.click_action))return;e.fcmOptions={};let a=(i=(r=t.fcmOptions)===null||r===void 0?void 0:r.link)!==null&&i!==void 0?i:(o=t.notification)===null||o===void 0?void 0:o.click_action;a&&(e.fcmOptions.link=a);let c=(s=t.fcmOptions)===null||s===void 0?void 0:s.analytics_label;c&&(e.fcmOptions.analyticsLabel=c)}function Yr(e){return typeof e=="object"&&!!e&&Tr in e}function Zr(e){return new Promise(t=>{setTimeout(t,e)})}ni("AzSCbw63g1R0nCw85jG8","Iaya3yLKwmgvh7cF0q4");async function Qr(e,t){let n=Xr(t,await e.firebaseDependencies.installations.getId());ei(e,n,t.productId)}function Xr(e,t){var n,r;let i={};return e.from&&(i.project_number=e.from),e.fcmMessageId&&(i.message_id=e.fcmMessageId),i.instance_id=t,e.notification?i.message_type=K.DISPLAY_NOTIFICATION.toString():i.message_type=K.DATA_MESSAGE.toString(),i.sdk_platform=kr.toString(),i.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),e.collapse_key&&(i.collapse_key=e.collapse_key),i.event=Or.toString(),!((n=e.fcmOptions)===null||n===void 0)&&n.analytics_label&&(i.analytics_label=(r=e.fcmOptions)===null||r===void 0?void 0:r.analytics_label),i}function ei(e,t,n){let r={};r.event_time_ms=Math.floor(Date.now()).toString(),r.source_extension_json_proto3=JSON.stringify({messaging_client_event:t}),n&&(r.compliance_data=ti(n)),e.logEvents.push(r)}function ti(e){return{privacy_context:{prequest:{origin_associated_product_id:e}}}}function ni(e,t){let n=[];for(let r=0;r<e.length;r++)n.push(e.charAt(r)),r<t.length&&n.push(t.charAt(r));return n.join("")}async function ri(e,t){var n,r;let{newSubscription:i}=e;if(!i){await bt(t);return}let o=await Ae(t.firebaseDependencies);await bt(t),t.vapidKey=(r=(n=o?.subscriptionOptions)===null||n===void 0?void 0:n.vapidKey)!==null&&r!==void 0?r:yt,await Vr(t)}async function ii(e,t){let n=ai(e);if(!n)return;t.deliveryMetricsExportedToBigQueryEnabled&&await Qr(t,n);let r=await It();if(ui(r))return li(r,n);if(n.notification&&await fi(si(n)),!!t&&t.onBackgroundMessageHandler){let i=Kr(n);typeof t.onBackgroundMessageHandler=="function"?await t.onBackgroundMessageHandler(i):t.onBackgroundMessageHandler.next(i)}}async function oi(e){var t,n;let r=(n=(t=e.notification)===null||t===void 0?void 0:t.data)===null||n===void 0?void 0:n[_t];if(r){if(e.action)return}else return;e.stopImmediatePropagation(),e.notification.close();let i=di(r);if(!i)return;let o=new URL(i,self.location.href),s=new URL(self.location.origin);if(o.host!==s.host)return;let a=await ci(o);if(a?a=await a.focus():(a=await self.clients.openWindow(i),await Zr(3e3)),!!a)return r.messageType=q.NOTIFICATION_CLICKED,r.isFirebaseMessaging=!0,a.postMessage(r)}function si(e){let t=Object.assign({},e.notification);return t.data={[_t]:e},t}function ai({data:e}){if(!e)return null;try{return e.json()}catch{return null}}async function ci(e){let t=await It();for(let n of t){let r=new URL(n.url,self.location.href);if(e.host===r.host)return n}return null}function ui(e){return e.some(t=>t.visibilityState==="visible"&&!t.url.startsWith("chrome-extension://"))}function li(e,t){t.isFirebaseMessaging=!0,t.messageType=q.PUSH_RECEIVED;for(let n of e)n.postMessage(t)}function It(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function fi(e){var t;let{actions:n}=e,{maxActions:r}=Notification;return n&&r&&n.length>r&&console.warn(`This browser only supports ${r} actions. The remaining actions will not be displayed.`),self.registration.showNotification((t=e.title)!==null&&t!==void 0?t:"",e)}function di(e){var t,n,r;let i=(n=(t=e.fcmOptions)===null||t===void 0?void 0:t.link)!==null&&n!==void 0?n:(r=e.notification)===null||r===void 0?void 0:r.click_action;return i||(Yr(e.data)?self.location.origin:null)}function hi(e){if(!e||!e.options)throw Ie("App Configuration Object");if(!e.name)throw Ie("App Name");let t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(let r of t)if(!n[r])throw Ie(r);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function Ie(e){return p.create("missing-app-config-values",{valueName:e})}var Se=class{constructor(t,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;let i=hi(t);this.firebaseDependencies={app:t,appConfig:i,installations:n,analyticsProvider:r}}_delete(){return Promise.resolve()}};var pi=e=>{let t=new Se(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(ii(n,t))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(ri(n,t))}),self.addEventListener("notificationclick",n=>{n.waitUntil(oi(n))}),t};function gi(){E(new h("messaging-sw",pi,"PUBLIC"))}async function mi(){return R()&&await L()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}function bi(e,t){if(self.document!==void 0)throw p.create("only-available-in-sw");return e.onBackgroundMessageHandler=t,()=>{e.onBackgroundMessageHandler=null}}function St(e=he()){return mi().then(t=>{if(!t)throw p.create("unsupported-browser")},t=>{throw p.create("indexed-db-unsupported")}),N(Z(e),"messaging-sw").getImmediate()}function Ct(e,t){return e=Z(e),bi(e,t)}gi();self.addEventListener("notificationclick",e=>{e.stopImmediatePropagation(),e.notification.close();let t=e.notification.data?.call_id,n=e.action==="decline"?"decline":e.action==="answer"?"answer":"view",r=t?"/#chat?call="+encodeURIComponent(t)+"&action="+n:"/#chat";e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(async i=>{let o=i.find(s=>new URL(s.url).origin===self.location.origin);return o?(await o.navigate(r),o.focus()):self.clients.openWindow(r)}))});var At=JSON.parse(new URL(self.location.href).searchParams.get("config")||"null");if(At){let e=St(de(At));Ct(e,t=>{if(t.data?.kind==="call_cancel")return self.registration.getNotifications({tag:t.data.call_id}).then(n=>n.forEach(r=>r.close()));if(t.data?.kind==="call"){let n=t.data;return Number(n.expires_at)<=Date.now()?Promise.resolve():self.registration.showNotification("Incoming "+(n.call_kind||"audio")+" call",{body:n.caller_name||"Your partner",tag:n.call_id,requireInteraction:!0,actions:[{action:"answer",title:"Answer"},{action:"decline",title:"Decline"}],data:{call_id:n.call_id}})}return t.notification?Promise.resolve():self.registration.showNotification("Together",{body:"New update from your partner.",data:{page:"chat"}})})}})();
/*! Bundled license information:

@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
@firebase/logger/dist/esm/index.esm2017.js:
@firebase/messaging/dist/esm/index.sw.esm2017.js:
@firebase/messaging/dist/esm/index.sw.esm2017.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm2017.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm2017.js:
@firebase/util/dist/index.esm2017.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm2017.js:
@firebase/component/dist/esm/index.esm2017.js:
@firebase/app/dist/esm/index.esm2017.js:
@firebase/app/dist/esm/index.esm2017.js:
@firebase/app/dist/esm/index.esm2017.js:
@firebase/installations/dist/esm/index.esm2017.js:
@firebase/installations/dist/esm/index.esm2017.js:
@firebase/installations/dist/esm/index.esm2017.js:
@firebase/installations/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm2017.js:
firebase/app/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/installations/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/messaging/dist/esm/index.sw.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2018 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
   * in compliance with the License. You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software distributed under the License
   * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
   * or implied. See the License for the specific language governing permissions and limitations under
   * the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
*/
