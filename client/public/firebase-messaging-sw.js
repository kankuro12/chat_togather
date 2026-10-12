"use strict";(()=>{var d=["/offline.html","/offline.css","/together-logo.svg"];var Ne="together-shell-development";self.addEventListener("install",e=>e.waitUntil(caches.open(Ne).then(t=>t.addAll(d))));self.addEventListener("activate",e=>e.waitUntil((async()=>{for(let t of await caches.keys())t.startsWith("together-shell-")&&t!==Ne&&await caches.delete(t);await self.clients.claim()})()));self.addEventListener("message",e=>{e.data?.type==="ACTIVATE"&&self.skipWaiting()});self.addEventListener("fetch",e=>{let t=e.request,n=new URL(t.url);if(!(t.method!=="GET"||n.origin!==self.location.origin||n.pathname.startsWith("/api/")||n.pathname.startsWith("/socket.io/"))){if(t.mode==="navigate"){e.respondWith(fetch(t).catch(async()=>await caches.match("/offline.html")||Response.error()));return}d.includes(n.pathname)&&e.respondWith(caches.match(n.pathname).then(i=>i||fetch(t)))}});var Me=()=>{};var Be=function(e){let t=[],n=0;for(let i=0;i<e.length;i++){let r=e.charCodeAt(i);r<128?t[n++]=r:r<2048?(t[n++]=r>>6|192,t[n++]=r&63|128):(r&64512)===55296&&i+1<e.length&&(e.charCodeAt(i+1)&64512)===56320?(r=65536+((r&1023)<<10)+(e.charCodeAt(++i)&1023),t[n++]=r>>18|240,t[n++]=r>>12&63|128,t[n++]=r>>6&63|128,t[n++]=r&63|128):(t[n++]=r>>12|224,t[n++]=r>>6&63|128,t[n++]=r&63|128)}return t},Nt=function(e){let t=[],n=0,i=0;for(;n<e.length;){let r=e[n++];if(r<128)t[i++]=String.fromCharCode(r);else if(r>191&&r<224){let o=e[n++];t[i++]=String.fromCharCode((r&31)<<6|o&63)}else if(r>239&&r<365){let o=e[n++],s=e[n++],a=e[n++],c=((r&7)<<18|(o&63)<<12|(s&63)<<6|a&63)-65536;t[i++]=String.fromCharCode(55296+(c>>10)),t[i++]=String.fromCharCode(56320+(c&1023))}else{let o=e[n++],s=e[n++];t[i++]=String.fromCharCode((r&15)<<12|(o&63)<<6|s&63)}}return t.join("")},Re={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();let n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,i=[];for(let r=0;r<e.length;r+=3){let o=e[r],s=r+1<e.length,a=s?e[r+1]:0,c=r+2<e.length,l=c?e[r+2]:0,u=o>>2,k=(o&3)<<4|a>>4,M=(a&15)<<2|l>>6,x=l&63;c||(x=64,s||(M=64)),i.push(n[u],n[k],n[M],n[x])}return i.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray(Be(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):Nt(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();let n=t?this.charToByteMapWebSafe_:this.charToByteMap_,i=[];for(let r=0;r<e.length;){let o=n[e.charAt(r++)],a=r<e.length?n[e.charAt(r)]:0;++r;let l=r<e.length?n[e.charAt(r)]:64;++r;let k=r<e.length?n[e.charAt(r)]:64;if(++r,o==null||a==null||l==null||k==null)throw new G;let M=o<<2|a>>4;if(i.push(M),l!==64){let x=a<<4&240|l>>2;if(i.push(x),k!==64){let kt=l<<6&192|k;i.push(kt)}}}return i},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}},G=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},Mt=function(e){let t=Be(e);return Re.encodeByteArray(t,!0)},J=function(e){return Mt(e).replace(/\./g,"")},Le=function(e){try{return Re.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};function xt(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}var Bt=()=>xt().__FIREBASE_DEFAULTS__,Rt=()=>{if(typeof process>"u"||typeof process.env>"u")return;let e=process.env.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Lt=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let t=e&&Le(e[1]);return t&&JSON.parse(t)},Pt=()=>{try{return Me()||Bt()||Rt()||Lt()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}};var Y=()=>{var e;return(e=Pt())===null||e===void 0?void 0:e.config};var B=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,n)=>{this.resolve=t,this.reject=n})}wrapCallback(t){return(n,i)=>{n?this.reject(n):this.resolve(i),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(n):t(n,i))}}};function R(){try{return typeof indexedDB=="object"}catch{return!1}}function L(){return new Promise((e,t)=>{try{let n=!0,i="validate-browser-context-for-indexeddb-analytics-module",r=self.indexedDB.open(i);r.onsuccess=()=>{r.result.close(),n||self.indexedDB.deleteDatabase(i),e(!0)},r.onupgradeneeded=()=>{n=!1},r.onerror=()=>{var o;t(((o=r.error)===null||o===void 0?void 0:o.message)||"")}}catch(n){t(n)}})}var Ft="FirebaseError",m=class e extends Error{constructor(t,n,i){super(n),this.code=t,this.customData=i,this.name=Ft,Object.setPrototypeOf(this,e.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,b.prototype.create)}},b=class{constructor(t,n,i){this.service=t,this.serviceName=n,this.errors=i}create(t,...n){let i=n[0]||{},r=`${this.service}/${t}`,o=this.errors[t],s=o?$t(o,i):"Error",a=`${this.serviceName}: ${s} (${r}).`;return new m(r,a,i)}};function $t(e,t){return e.replace(jt,(n,i)=>{let r=t[i];return r!=null?String(r):`<${i}?>`})}var jt=/\{\$([^}]+)}/g;function P(e,t){if(e===t)return!0;let n=Object.keys(e),i=Object.keys(t);for(let r of n){if(!i.includes(r))return!1;let o=e[r],s=t[r];if(xe(o)&&xe(s)){if(!P(o,s))return!1}else if(o!==s)return!1}for(let r of i)if(!n.includes(r))return!1;return!0}function xe(e){return e!==null&&typeof e=="object"}var Cr=14400*1e3;function Z(e){return e&&e._delegate?e._delegate:e}var h=class{constructor(t,n,i){this.name=t,this.instanceFactory=n,this.type=i,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}};var S="[DEFAULT]";var Q=class{constructor(t,n){this.name=t,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){let n=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(n)){let i=new B;if(this.instancesDeferred.set(n,i),this.isInitialized(n)||this.shouldAutoInitialize())try{let r=this.getOrInitializeService({instanceIdentifier:n});r&&i.resolve(r)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(t){var n;let i=this.normalizeInstanceIdentifier(t?.identifier),r=(n=t?.optional)!==null&&n!==void 0?n:!1;if(this.isInitialized(i)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:i})}catch(o){if(r)return null;throw o}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(Vt(t))try{this.getOrInitializeService({instanceIdentifier:S})}catch{}for(let[n,i]of this.instancesDeferred.entries()){let r=this.normalizeInstanceIdentifier(n);try{let o=this.getOrInitializeService({instanceIdentifier:r});i.resolve(o)}catch{}}}}clearInstance(t=S){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){let t=Array.from(this.instances.values());await Promise.all([...t.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...t.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=S){return this.instances.has(t)}getOptions(t=S){return this.instancesOptions.get(t)||{}}initialize(t={}){let{options:n={}}=t,i=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(i))throw Error(`${this.name}(${i}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let r=this.getOrInitializeService({instanceIdentifier:i,options:n});for(let[o,s]of this.instancesDeferred.entries()){let a=this.normalizeInstanceIdentifier(o);i===a&&s.resolve(r)}return r}onInit(t,n){var i;let r=this.normalizeInstanceIdentifier(n),o=(i=this.onInitCallbacks.get(r))!==null&&i!==void 0?i:new Set;o.add(t),this.onInitCallbacks.set(r,o);let s=this.instances.get(r);return s&&t(s,r),()=>{o.delete(t)}}invokeOnInitCallbacks(t,n){let i=this.onInitCallbacks.get(n);if(i)for(let r of i)try{r(t,n)}catch{}}getOrInitializeService({instanceIdentifier:t,options:n={}}){let i=this.instances.get(t);if(!i&&this.component&&(i=this.component.instanceFactory(this.container,{instanceIdentifier:Ht(t),options:n}),this.instances.set(t,i),this.instancesOptions.set(t,n),this.invokeOnInitCallbacks(i,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,i)}catch{}return i||null}normalizeInstanceIdentifier(t=S){return this.component?this.component.multipleInstances?t:S:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};function Ht(e){return e===S?void 0:e}function Vt(e){return e.instantiationMode==="EAGER"}var F=class{constructor(t){this.name=t,this.providers=new Map}addComponent(t){let n=this.getProvider(t.name);if(n.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);n.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);let n=new Q(t,this);return this.providers.set(t,n),n}getProviders(){return Array.from(this.providers.values())}};var Ut=[],f;(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(f||(f={}));var Wt={debug:f.DEBUG,verbose:f.VERBOSE,info:f.INFO,warn:f.WARN,error:f.ERROR,silent:f.SILENT},zt=f.INFO,Kt={[f.DEBUG]:"log",[f.VERBOSE]:"log",[f.INFO]:"info",[f.WARN]:"warn",[f.ERROR]:"error"},qt=(e,t,...n)=>{if(t<e.logLevel)return;let i=new Date().toISOString(),r=Kt[t];if(r)console[r](`[${i}]  ${e.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)},$=class{constructor(t){this.name=t,this._logLevel=zt,this._logHandler=qt,this._userLogHandler=null,Ut.push(this)}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in f))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?Wt[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,f.DEBUG,...t),this._logHandler(this,f.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,f.VERBOSE,...t),this._logHandler(this,f.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,f.INFO,...t),this._logHandler(this,f.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,f.WARN,...t),this._logHandler(this,f.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,f.ERROR,...t),this._logHandler(this,f.ERROR,...t)}};var Gt=(e,t)=>t.some(n=>e instanceof n),Pe,Fe;function Jt(){return Pe||(Pe=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Yt(){return Fe||(Fe=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}var $e=new WeakMap,ee=new WeakMap,je=new WeakMap,X=new WeakMap,ne=new WeakMap;function Zt(e){let t=new Promise((n,i)=>{let r=()=>{e.removeEventListener("success",o),e.removeEventListener("error",s)},o=()=>{n(g(e.result)),r()},s=()=>{i(e.error),r()};e.addEventListener("success",o),e.addEventListener("error",s)});return t.then(n=>{n instanceof IDBCursor&&$e.set(n,e)}).catch(()=>{}),ne.set(t,e),t}function Qt(e){if(ee.has(e))return;let t=new Promise((n,i)=>{let r=()=>{e.removeEventListener("complete",o),e.removeEventListener("error",s),e.removeEventListener("abort",s)},o=()=>{n(),r()},s=()=>{i(e.error||new DOMException("AbortError","AbortError")),r()};e.addEventListener("complete",o),e.addEventListener("error",s),e.addEventListener("abort",s)});ee.set(e,t)}var te={get(e,t,n){if(e instanceof IDBTransaction){if(t==="done")return ee.get(e);if(t==="objectStoreNames")return e.objectStoreNames||je.get(e);if(t==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return g(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};function He(e){te=e(te)}function Xt(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...n){let i=e.call(j(this),t,...n);return je.set(i,t.sort?t.sort():[t]),g(i)}:Yt().includes(e)?function(...t){return e.apply(j(this),t),g($e.get(this))}:function(...t){return g(e.apply(j(this),t))}}function en(e){return typeof e=="function"?Xt(e):(e instanceof IDBTransaction&&Qt(e),Gt(e,Jt())?new Proxy(e,te):e)}function g(e){if(e instanceof IDBRequest)return Zt(e);if(X.has(e))return X.get(e);let t=en(e);return t!==e&&(X.set(e,t),ne.set(t,e)),t}var j=e=>ne.get(e);function I(e,t,{blocked:n,upgrade:i,blocking:r,terminated:o}={}){let s=indexedDB.open(e,t),a=g(s);return i&&s.addEventListener("upgradeneeded",c=>{i(g(s.result),c.oldVersion,c.newVersion,g(s.transaction),c)}),n&&s.addEventListener("blocked",c=>n(c.oldVersion,c.newVersion,c)),a.then(c=>{o&&c.addEventListener("close",()=>o()),r&&c.addEventListener("versionchange",l=>r(l.oldVersion,l.newVersion,l))}).catch(()=>{}),a}function H(e,{blocked:t}={}){let n=indexedDB.deleteDatabase(e);return t&&n.addEventListener("blocked",i=>t(i.oldVersion,i)),g(n).then(()=>{})}var tn=["get","getKey","getAll","getAllKeys","count"],nn=["put","add","delete","clear"],ie=new Map;function Ve(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(ie.get(t))return ie.get(t);let n=t.replace(/FromIndex$/,""),i=t!==n,r=nn.includes(n);if(!(n in(i?IDBIndex:IDBObjectStore).prototype)||!(r||tn.includes(n)))return;let o=async function(s,...a){let c=this.transaction(s,r?"readwrite":"readonly"),l=c.store;return i&&(l=l.index(a.shift())),(await Promise.all([l[n](...a),r&&c.done]))[0]};return ie.set(t,o),o}He(e=>({...e,get:(t,n,i)=>Ve(t,n)||e.get(t,n,i),has:(t,n)=>!!Ve(t,n)||e.has(t,n)}));var oe=class{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(rn(n)){let i=n.getImmediate();return`${i.library}/${i.version}`}else return null}).filter(n=>n).join(" ")}};function rn(e){let t=e.getComponent();return t?.type==="VERSION"}var se="@firebase/app",Ue="0.13.2";var w=new $("@firebase/app"),on="@firebase/app-compat",sn="@firebase/analytics-compat",an="@firebase/analytics",cn="@firebase/app-check-compat",ln="@firebase/app-check",un="@firebase/auth",fn="@firebase/auth-compat",dn="@firebase/database",hn="@firebase/data-connect",pn="@firebase/database-compat",gn="@firebase/functions",mn="@firebase/functions-compat",bn="@firebase/installations",wn="@firebase/installations-compat",_n="@firebase/messaging",yn="@firebase/messaging-compat",vn="@firebase/performance",En="@firebase/performance-compat",Sn="@firebase/remote-config",In="@firebase/remote-config-compat",Cn="@firebase/storage",An="@firebase/storage-compat",Dn="@firebase/firestore",Tn="@firebase/ai",kn="@firebase/firestore-compat",On="firebase";var ae="[DEFAULT]",Nn={[se]:"fire-core",[on]:"fire-core-compat",[an]:"fire-analytics",[sn]:"fire-analytics-compat",[ln]:"fire-app-check",[cn]:"fire-app-check-compat",[un]:"fire-auth",[fn]:"fire-auth-compat",[dn]:"fire-rtdb",[hn]:"fire-data-connect",[pn]:"fire-rtdb-compat",[gn]:"fire-fn",[mn]:"fire-fn-compat",[bn]:"fire-iid",[wn]:"fire-iid-compat",[_n]:"fire-fcm",[yn]:"fire-fcm-compat",[vn]:"fire-perf",[En]:"fire-perf-compat",[Sn]:"fire-rc",[In]:"fire-rc-compat",[Cn]:"fire-gcs",[An]:"fire-gcs-compat",[Dn]:"fire-fst",[kn]:"fire-fst-compat",[Tn]:"fire-vertex","fire-js":"fire-js",[On]:"fire-js-all"};var V=new Map,Mn=new Map,ce=new Map;function We(e,t){try{e.container.addComponent(t)}catch(n){w.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function E(e){let t=e.name;if(ce.has(t))return w.debug(`There were multiple attempts to register component ${t}.`),!1;ce.set(t,e);for(let n of V.values())We(n,e);for(let n of Mn.values())We(n,e);return!0}function N(e,t){let n=e.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}var xn={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},y=new b("app","Firebase",xn);var le=class{constructor(t,n,i){this._isDeleted=!1,this._options=Object.assign({},t),this._config=Object.assign({},n),this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=i,this.container.addComponent(new h("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw y.create("app-deleted",{appName:this._name})}};function de(e,t={}){let n=e;typeof t!="object"&&(t={name:t});let i=Object.assign({name:ae,automaticDataCollectionEnabled:!0},t),r=i.name;if(typeof r!="string"||!r)throw y.create("bad-app-name",{appName:String(r)});if(n||(n=Y()),!n)throw y.create("no-options");let o=V.get(r);if(o){if(P(n,o.options)&&P(i,o.config))return o;throw y.create("duplicate-app",{appName:r})}let s=new F(r);for(let c of ce.values())s.addComponent(c);let a=new le(n,i,s);return V.set(r,a),a}function he(e=ae){let t=V.get(e);if(!t&&e===ae&&Y())return de();if(!t)throw y.create("no-app",{appName:e});return t}function v(e,t,n){var i;let r=(i=Nn[e])!==null&&i!==void 0?i:e;n&&(r+=`-${n}`);let o=r.match(/\s|\//),s=t.match(/\s|\//);if(o||s){let a=[`Unable to register library "${r}" with version "${t}":`];o&&a.push(`library name "${r}" contains illegal characters (whitespace or "/")`),o&&s&&a.push("and"),s&&a.push(`version name "${t}" contains illegal characters (whitespace or "/")`),w.warn(a.join(" "));return}E(new h(`${r}-version`,()=>({library:r,version:t}),"VERSION"))}var Bn="firebase-heartbeat-database",Rn=1,O="firebase-heartbeat-store",re=null;function Ge(){return re||(re=I(Bn,Rn,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(O)}catch(n){console.warn(n)}}}}).catch(e=>{throw y.create("idb-open",{originalErrorMessage:e.message})})),re}async function Ln(e){try{let n=(await Ge()).transaction(O),i=await n.objectStore(O).get(Je(e));return await n.done,i}catch(t){if(t instanceof m)w.warn(t.message);else{let n=y.create("idb-get",{originalErrorMessage:t?.message});w.warn(n.message)}}}async function ze(e,t){try{let i=(await Ge()).transaction(O,"readwrite");await i.objectStore(O).put(t,Je(e)),await i.done}catch(n){if(n instanceof m)w.warn(n.message);else{let i=y.create("idb-set",{originalErrorMessage:n?.message});w.warn(i.message)}}}function Je(e){return`${e.name}!${e.options.appId}`}var Pn=1024,Fn=30,ue=class{constructor(t){this.container=t,this._heartbeatsCache=null;let n=this.container.getProvider("app").getImmediate();this._storage=new fe(n),this._heartbeatsCachePromise=this._storage.read().then(i=>(this._heartbeatsCache=i,i))}async triggerHeartbeat(){var t,n;try{let r=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=Ke();if(((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)===null||n===void 0?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(s=>s.date===o))return;if(this._heartbeatsCache.heartbeats.push({date:o,agent:r}),this._heartbeatsCache.heartbeats.length>Fn){let s=jn(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(s,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(i){w.warn(i)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";let n=Ke(),{heartbeatsToSend:i,unsentEntries:r}=$n(this._heartbeatsCache.heartbeats),o=J(JSON.stringify({version:2,heartbeats:i}));return this._heartbeatsCache.lastSentHeartbeatDate=n,r.length>0?(this._heartbeatsCache.heartbeats=r,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(n){return w.warn(n),""}}};function Ke(){return new Date().toISOString().substring(0,10)}function $n(e,t=Pn){let n=[],i=e.slice();for(let r of e){let o=n.find(s=>s.agent===r.agent);if(o){if(o.dates.push(r.date),qe(n)>t){o.dates.pop();break}}else if(n.push({agent:r.agent,dates:[r.date]}),qe(n)>t){n.pop();break}i=i.slice(1)}return{heartbeatsToSend:n,unsentEntries:i}}var fe=class{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return R()?L().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let n=await Ln(this.app);return n?.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){var n;if(await this._canUseIndexedDBPromise){let r=await this.read();return ze(this.app,{lastSentHeartbeatDate:(n=t.lastSentHeartbeatDate)!==null&&n!==void 0?n:r.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){var n;if(await this._canUseIndexedDBPromise){let r=await this.read();return ze(this.app,{lastSentHeartbeatDate:(n=t.lastSentHeartbeatDate)!==null&&n!==void 0?n:r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...t.heartbeats]})}else return}};function qe(e){return J(JSON.stringify({version:2,heartbeats:e})).length}function jn(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let i=1;i<e.length;i++)e[i].date<n&&(n=e[i].date,t=i);return t}function Hn(e){E(new h("platform-logger",t=>new oe(t),"PRIVATE")),E(new h("heartbeat",t=>new ue(t),"PRIVATE")),v(se,Ue,e),v(se,Ue,"esm2017"),v("fire-js","")}Hn("");var Vn="firebase",Un="11.10.0";v(Vn,Un,"app");var Qe="@firebase/installations",be="0.6.18";var Xe=1e4,et=`w:${be}`,tt="FIS_v2",Wn="https://firebaseinstallations.googleapis.com/v1",zn=3600*1e3,Kn="installations",qn="Installations";var Gn={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},A=new b(Kn,qn,Gn);function nt(e){return e instanceof m&&e.code.includes("request-failed")}function it({projectId:e}){return`${Wn}/projects/${e}/installations`}function rt(e){return{token:e.token,requestStatus:2,expiresIn:Yn(e.expiresIn),creationTime:Date.now()}}async function ot(e,t){let i=(await t.json()).error;return A.create("request-failed",{requestName:e,serverCode:i.code,serverMessage:i.message,serverStatus:i.status})}function st({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function Jn(e,{refreshToken:t}){let n=st(e);return n.append("Authorization",Zn(t)),n}async function at(e){let t=await e();return t.status>=500&&t.status<600?e():t}function Yn(e){return Number(e.replace("s","000"))}function Zn(e){return`${tt} ${e}`}async function Qn({appConfig:e,heartbeatServiceProvider:t},{fid:n}){let i=it(e),r=st(e),o=t.getImmediate({optional:!0});if(o){let l=await o.getHeartbeatsHeader();l&&r.append("x-firebase-client",l)}let s={fid:n,authVersion:tt,appId:e.appId,sdkVersion:et},a={method:"POST",headers:r,body:JSON.stringify(s)},c=await at(()=>fetch(i,a));if(c.ok){let l=await c.json();return{fid:l.fid||n,registrationStatus:2,refreshToken:l.refreshToken,authToken:rt(l.authToken)}}else throw await ot("Create Installation",c)}function ct(e){return new Promise(t=>{setTimeout(t,e)})}function Xn(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}var ei=/^[cdef][\w-]{21}$/,me="";function ti(){try{let e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;let n=ni(e);return ei.test(n)?n:me}catch{return me}}function ni(e){return Xn(e).substr(0,22)}function W(e){return`${e.appName}!${e.appId}`}var lt=new Map;function ut(e,t){let n=W(e);ft(n,t),ii(n,t)}function ft(e,t){let n=lt.get(e);if(n)for(let i of n)i(t)}function ii(e,t){let n=ri();n&&n.postMessage({key:e,fid:t}),oi()}var C=null;function ri(){return!C&&"BroadcastChannel"in self&&(C=new BroadcastChannel("[Firebase] FID Change"),C.onmessage=e=>{ft(e.data.key,e.data.fid)}),C}function oi(){lt.size===0&&C&&(C.close(),C=null)}var si="firebase-installations-database",ai=1,D="firebase-installations-store",pe=null;function we(){return pe||(pe=I(si,ai,{upgrade:(e,t)=>{t===0&&e.createObjectStore(D)}})),pe}async function U(e,t){let n=W(e),r=(await we()).transaction(D,"readwrite"),o=r.objectStore(D),s=await o.get(n);return await o.put(t,n),await r.done,(!s||s.fid!==t.fid)&&ut(e,t.fid),t}async function dt(e){let t=W(e),i=(await we()).transaction(D,"readwrite");await i.objectStore(D).delete(t),await i.done}async function z(e,t){let n=W(e),r=(await we()).transaction(D,"readwrite"),o=r.objectStore(D),s=await o.get(n),a=t(s);return a===void 0?await o.delete(n):await o.put(a,n),await r.done,a&&(!s||s.fid!==a.fid)&&ut(e,a.fid),a}async function _e(e){let t,n=await z(e.appConfig,i=>{let r=ci(i),o=li(e,r);return t=o.registrationPromise,o.installationEntry});return n.fid===me?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function ci(e){let t=e||{fid:ti(),registrationStatus:0};return ht(t)}function li(e,t){if(t.registrationStatus===0){if(!navigator.onLine){let r=Promise.reject(A.create("app-offline"));return{installationEntry:t,registrationPromise:r}}let n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},i=ui(e,n);return{installationEntry:n,registrationPromise:i}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:fi(e)}:{installationEntry:t}}async function ui(e,t){try{let n=await Qn(e,t);return U(e.appConfig,n)}catch(n){throw nt(n)&&n.customData.serverCode===409?await dt(e.appConfig):await U(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function fi(e){let t=await Ye(e.appConfig);for(;t.registrationStatus===1;)await ct(100),t=await Ye(e.appConfig);if(t.registrationStatus===0){let{installationEntry:n,registrationPromise:i}=await _e(e);return i||n}return t}function Ye(e){return z(e,t=>{if(!t)throw A.create("installation-not-found");return ht(t)})}function ht(e){return di(e)?{fid:e.fid,registrationStatus:0}:e}function di(e){return e.registrationStatus===1&&e.registrationTime+Xe<Date.now()}async function hi({appConfig:e,heartbeatServiceProvider:t},n){let i=pi(e,n),r=Jn(e,n),o=t.getImmediate({optional:!0});if(o){let l=await o.getHeartbeatsHeader();l&&r.append("x-firebase-client",l)}let s={installation:{sdkVersion:et,appId:e.appId}},a={method:"POST",headers:r,body:JSON.stringify(s)},c=await at(()=>fetch(i,a));if(c.ok){let l=await c.json();return rt(l)}else throw await ot("Generate Auth Token",c)}function pi(e,{fid:t}){return`${it(e)}/${t}/authTokens:generate`}async function ye(e,t=!1){let n,i=await z(e.appConfig,o=>{if(!pt(o))throw A.create("not-registered");let s=o.authToken;if(!t&&bi(s))return o;if(s.requestStatus===1)return n=gi(e,t),o;{if(!navigator.onLine)throw A.create("app-offline");let a=_i(o);return n=mi(e,a),a}});return n?await n:i.authToken}async function gi(e,t){let n=await Ze(e.appConfig);for(;n.authToken.requestStatus===1;)await ct(100),n=await Ze(e.appConfig);let i=n.authToken;return i.requestStatus===0?ye(e,t):i}function Ze(e){return z(e,t=>{if(!pt(t))throw A.create("not-registered");let n=t.authToken;return yi(n)?Object.assign(Object.assign({},t),{authToken:{requestStatus:0}}):t})}async function mi(e,t){try{let n=await hi(e,t),i=Object.assign(Object.assign({},t),{authToken:n});return await U(e.appConfig,i),n}catch(n){if(nt(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await dt(e.appConfig);else{let i=Object.assign(Object.assign({},t),{authToken:{requestStatus:0}});await U(e.appConfig,i)}throw n}}function pt(e){return e!==void 0&&e.registrationStatus===2}function bi(e){return e.requestStatus===2&&!wi(e)}function wi(e){let t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+zn}function _i(e){let t={requestStatus:1,requestTime:Date.now()};return Object.assign(Object.assign({},e),{authToken:t})}function yi(e){return e.requestStatus===1&&e.requestTime+Xe<Date.now()}async function vi(e){let t=e,{installationEntry:n,registrationPromise:i}=await _e(t);return i?i.catch(console.error):ye(t).catch(console.error),n.fid}async function Ei(e,t=!1){let n=e;return await Si(n),(await ye(n,t)).token}async function Si(e){let{registrationPromise:t}=await _e(e);t&&await t}function Ii(e){if(!e||!e.options)throw ge("App Configuration");if(!e.name)throw ge("App Name");let t=["projectId","apiKey","appId"];for(let n of t)if(!e.options[n])throw ge(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function ge(e){return A.create("missing-app-config-values",{valueName:e})}var gt="installations",Ci="installations-internal",Ai=e=>{let t=e.getProvider("app").getImmediate(),n=Ii(t),i=N(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:i,_delete:()=>Promise.resolve()}},Di=e=>{let t=e.getProvider("app").getImmediate(),n=N(t,gt).getImmediate();return{getId:()=>vi(n),getToken:r=>Ei(n,r)}};function Ti(){E(new h(gt,Ai,"PUBLIC")),E(new h(Ci,Di,"PRIVATE"))}Ti();v(Qe,be);v(Qe,be,"esm2017");var _t="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",ki="https://fcmregistrations.googleapis.com/v1",yt="FCM_MSG",Oi="google.c.a.c_id",Ni=3,Mi=1,K;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(K||(K={}));var q;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked"})(q||(q={}));function _(e){let t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function xi(e){let t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),i=atob(n),r=new Uint8Array(i.length);for(let o=0;o<i.length;++o)r[o]=i.charCodeAt(o);return r}var ve="fcm_token_details_db",Bi=5,mt="fcm_token_object_Store";async function Ri(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(ve))return null;let t=null;return(await I(ve,Bi,{upgrade:async(i,r,o,s)=>{var a;if(r<2||!i.objectStoreNames.contains(mt))return;let c=s.objectStore(mt),l=await c.index("fcmSenderId").get(e);if(await c.clear(),!!l){if(r===2){let u=l;if(!u.auth||!u.p256dh||!u.endpoint)return;t={token:u.fcmToken,createTime:(a=u.createTime)!==null&&a!==void 0?a:Date.now(),subscriptionOptions:{auth:u.auth,p256dh:u.p256dh,endpoint:u.endpoint,swScope:u.swScope,vapidKey:typeof u.vapidKey=="string"?u.vapidKey:_(u.vapidKey)}}}else if(r===3){let u=l;t={token:u.fcmToken,createTime:u.createTime,subscriptionOptions:{auth:_(u.auth),p256dh:_(u.p256dh),endpoint:u.endpoint,swScope:u.swScope,vapidKey:_(u.vapidKey)}}}else if(r===4){let u=l;t={token:u.fcmToken,createTime:u.createTime,subscriptionOptions:{auth:_(u.auth),p256dh:_(u.p256dh),endpoint:u.endpoint,swScope:u.swScope,vapidKey:_(u.vapidKey)}}}}}})).close(),await H(ve),await H("fcm_vapid_details_db"),await H("undefined"),Li(t)?t:null}function Li(e){if(!e||!e.subscriptionOptions)return!1;let{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}var Pi="firebase-messaging-database",Fi=1,T="firebase-messaging-store",Ee=null;function Ce(){return Ee||(Ee=I(Pi,Fi,{upgrade:(e,t)=>{t===0&&e.createObjectStore(T)}})),Ee}async function Ae(e){let t=Te(e),i=await(await Ce()).transaction(T).objectStore(T).get(t);if(i)return i;{let r=await Ri(e.appConfig.senderId);if(r)return await De(e,r),r}}async function De(e,t){let n=Te(e),r=(await Ce()).transaction(T,"readwrite");return await r.objectStore(T).put(t,n),await r.done,t}async function $i(e){let t=Te(e),i=(await Ce()).transaction(T,"readwrite");await i.objectStore(T).delete(t),await i.done}function Te({appConfig:e}){return e.appId}var ji={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},p=new b("messaging","Messaging",ji);async function Hi(e,t){let n=await Oe(e),i=Et(t),r={method:"POST",headers:n,body:JSON.stringify(i)},o;try{o=await(await fetch(ke(e.appConfig),r)).json()}catch(s){throw p.create("token-subscribe-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw p.create("token-subscribe-failed",{errorInfo:s})}if(!o.token)throw p.create("token-subscribe-no-token");return o.token}async function Vi(e,t){let n=await Oe(e),i=Et(t.subscriptionOptions),r={method:"PATCH",headers:n,body:JSON.stringify(i)},o;try{o=await(await fetch(`${ke(e.appConfig)}/${t.token}`,r)).json()}catch(s){throw p.create("token-update-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw p.create("token-update-failed",{errorInfo:s})}if(!o.token)throw p.create("token-update-no-token");return o.token}async function vt(e,t){let i={method:"DELETE",headers:await Oe(e)};try{let o=await(await fetch(`${ke(e.appConfig)}/${t}`,i)).json();if(o.error){let s=o.error.message;throw p.create("token-unsubscribe-failed",{errorInfo:s})}}catch(r){throw p.create("token-unsubscribe-failed",{errorInfo:r?.toString()})}}function ke({projectId:e}){return`${ki}/projects/${e}/registrations`}async function Oe({appConfig:e,installations:t}){let n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Et({p256dh:e,auth:t,endpoint:n,vapidKey:i}){let r={web:{endpoint:n,auth:t,p256dh:e}};return i!==_t&&(r.web.applicationPubKey=i),r}var Ui=10080*60*1e3;async function Wi(e){let t=await Ki(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:_(t.getKey("auth")),p256dh:_(t.getKey("p256dh"))},i=await Ae(e.firebaseDependencies);if(i){if(qi(i.subscriptionOptions,n))return Date.now()>=i.createTime+Ui?zi(e,{token:i.token,createTime:Date.now(),subscriptionOptions:n}):i.token;try{await vt(e.firebaseDependencies,i.token)}catch(r){console.warn(r)}return wt(e.firebaseDependencies,n)}else return wt(e.firebaseDependencies,n)}async function bt(e){let t=await Ae(e.firebaseDependencies);t&&(await vt(e.firebaseDependencies,t.token),await $i(e.firebaseDependencies));let n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function zi(e,t){try{let n=await Vi(e.firebaseDependencies,t),i=Object.assign(Object.assign({},t),{token:n,createTime:Date.now()});return await De(e.firebaseDependencies,i),n}catch(n){throw n}}async function wt(e,t){let i={token:await Hi(e,t),createTime:Date.now(),subscriptionOptions:t};return await De(e,i),i.token}async function Ki(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:xi(t)})}function qi(e,t){let n=t.vapidKey===e.vapidKey,i=t.endpoint===e.endpoint,r=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&i&&r&&o}function Gi(e){let t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Ji(t,e),Yi(t,e),Zi(t,e),t}function Ji(e,t){if(!t.notification)return;e.notification={};let n=t.notification.title;n&&(e.notification.title=n);let i=t.notification.body;i&&(e.notification.body=i);let r=t.notification.image;r&&(e.notification.image=r);let o=t.notification.icon;o&&(e.notification.icon=o)}function Yi(e,t){t.data&&(e.data=t.data)}function Zi(e,t){var n,i,r,o,s;if(!t.fcmOptions&&!(!((n=t.notification)===null||n===void 0)&&n.click_action))return;e.fcmOptions={};let a=(r=(i=t.fcmOptions)===null||i===void 0?void 0:i.link)!==null&&r!==void 0?r:(o=t.notification)===null||o===void 0?void 0:o.click_action;a&&(e.fcmOptions.link=a);let c=(s=t.fcmOptions)===null||s===void 0?void 0:s.analytics_label;c&&(e.fcmOptions.analyticsLabel=c)}function Qi(e){return typeof e=="object"&&!!e&&Oi in e}function Xi(e){return new Promise(t=>{setTimeout(t,e)})}rr("AzSCbw63g1R0nCw85jG8","Iaya3yLKwmgvh7cF0q4");async function er(e,t){let n=tr(t,await e.firebaseDependencies.installations.getId());nr(e,n,t.productId)}function tr(e,t){var n,i;let r={};return e.from&&(r.project_number=e.from),e.fcmMessageId&&(r.message_id=e.fcmMessageId),r.instance_id=t,e.notification?r.message_type=K.DISPLAY_NOTIFICATION.toString():r.message_type=K.DATA_MESSAGE.toString(),r.sdk_platform=Ni.toString(),r.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),e.collapse_key&&(r.collapse_key=e.collapse_key),r.event=Mi.toString(),!((n=e.fcmOptions)===null||n===void 0)&&n.analytics_label&&(r.analytics_label=(i=e.fcmOptions)===null||i===void 0?void 0:i.analytics_label),r}function nr(e,t,n){let i={};i.event_time_ms=Math.floor(Date.now()).toString(),i.source_extension_json_proto3=JSON.stringify({messaging_client_event:t}),n&&(i.compliance_data=ir(n)),e.logEvents.push(i)}function ir(e){return{privacy_context:{prequest:{origin_associated_product_id:e}}}}function rr(e,t){let n=[];for(let i=0;i<e.length;i++)n.push(e.charAt(i)),i<t.length&&n.push(t.charAt(i));return n.join("")}async function or(e,t){var n,i;let{newSubscription:r}=e;if(!r){await bt(t);return}let o=await Ae(t.firebaseDependencies);await bt(t),t.vapidKey=(i=(n=o?.subscriptionOptions)===null||n===void 0?void 0:n.vapidKey)!==null&&i!==void 0?i:_t,await Wi(t)}async function sr(e,t){let n=lr(e);if(!n)return;t.deliveryMetricsExportedToBigQueryEnabled&&await er(t,n);let i=await St();if(fr(i))return dr(i,n);if(n.notification&&await hr(cr(n)),!!t&&t.onBackgroundMessageHandler){let r=Gi(n);typeof t.onBackgroundMessageHandler=="function"?await t.onBackgroundMessageHandler(r):t.onBackgroundMessageHandler.next(r)}}async function ar(e){var t,n;let i=(n=(t=e.notification)===null||t===void 0?void 0:t.data)===null||n===void 0?void 0:n[yt];if(i){if(e.action)return}else return;e.stopImmediatePropagation(),e.notification.close();let r=pr(i);if(!r)return;let o=new URL(r,self.location.href),s=new URL(self.location.origin);if(o.host!==s.host)return;let a=await ur(o);if(a?a=await a.focus():(a=await self.clients.openWindow(r),await Xi(3e3)),!!a)return i.messageType=q.NOTIFICATION_CLICKED,i.isFirebaseMessaging=!0,a.postMessage(i)}function cr(e){let t=Object.assign({},e.notification);return t.data={[yt]:e},t}function lr({data:e}){if(!e)return null;try{return e.json()}catch{return null}}async function ur(e){let t=await St();for(let n of t){let i=new URL(n.url,self.location.href);if(e.host===i.host)return n}return null}function fr(e){return e.some(t=>t.visibilityState==="visible"&&!t.url.startsWith("chrome-extension://"))}function dr(e,t){t.isFirebaseMessaging=!0,t.messageType=q.PUSH_RECEIVED;for(let n of e)n.postMessage(t)}function St(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function hr(e){var t;let{actions:n}=e,{maxActions:i}=Notification;return n&&i&&n.length>i&&console.warn(`This browser only supports ${i} actions. The remaining actions will not be displayed.`),self.registration.showNotification((t=e.title)!==null&&t!==void 0?t:"",e)}function pr(e){var t,n,i;let r=(n=(t=e.fcmOptions)===null||t===void 0?void 0:t.link)!==null&&n!==void 0?n:(i=e.notification)===null||i===void 0?void 0:i.click_action;return r||(Qi(e.data)?self.location.origin:null)}function gr(e){if(!e||!e.options)throw Se("App Configuration Object");if(!e.name)throw Se("App Name");let t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(let i of t)if(!n[i])throw Se(i);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function Se(e){return p.create("missing-app-config-values",{valueName:e})}var Ie=class{constructor(t,n,i){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;let r=gr(t);this.firebaseDependencies={app:t,appConfig:r,installations:n,analyticsProvider:i}}_delete(){return Promise.resolve()}};var mr=e=>{let t=new Ie(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(sr(n,t))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(or(n,t))}),self.addEventListener("notificationclick",n=>{n.waitUntil(ar(n))}),t};function br(){E(new h("messaging-sw",mr,"PUBLIC"))}async function wr(){return R()&&await L()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}function _r(e,t){if(self.document!==void 0)throw p.create("only-available-in-sw");return e.onBackgroundMessageHandler=t,()=>{e.onBackgroundMessageHandler=null}}function It(e=he()){return wr().then(t=>{if(!t)throw p.create("unsupported-browser")},t=>{throw p.create("indexed-db-unsupported")}),N(Z(e),"messaging-sw").getImmediate()}function Ct(e,t){return e=Z(e),_r(e,t)}br();function At(e){let t=e.kind==="choice"||e.page==="choices",n=e.event||e.notification_id||e.event_id||e.message_id||e.choice_id||e.client_id||e.id||globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;return{body:t?"New choice waiting from your partner.":"New update from your partner.",tag:`${t?"choice":"chat"}:${n}`,icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",data:{...e,page:e.page||(t?"choices":"chat")}}}function Dt(e){if(!(e.kind!=="call"||!e.call_id||!Number.isFinite(Number(e.expires_at))||Number(e.expires_at)<=Date.now()))return{title:"Incoming "+(e.call_kind||"audio")+" call",options:{body:e.caller_name||"Your partner",tag:e.call_id,icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",requireInteraction:!0,actions:[{action:"answer",title:"Answer"},{action:"decline",title:"Decline"}],data:{...e,page:"chat"}}}}self.addEventListener("notificationclick",e=>{e.stopImmediatePropagation(),e.notification.close();let t=e.notification.data||{},n=t.FCM_MSG?.data||{},i=t.call_id||n.call_id,r=t.page||n.page,o=e.action==="decline"?"decline":e.action==="answer"?"answer":"view",s=i?"/#chat?call="+encodeURIComponent(i)+"&action="+o:r==="choices"?"/#choices":"/#chat";e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(async a=>{let c=a.find(l=>new URL(l.url).origin===self.location.origin);return c?(await c.navigate(s),c.focus()):self.clients.openWindow(s)}))});var Tt=JSON.parse(new URL(self.location.href).searchParams.get("config")||"null");if(Tt){let e=It(de(Tt));Ct(e,t=>{if(t.data?.kind==="call_cancel")return self.registration.getNotifications({tag:t.data.call_id}).then(n=>n.forEach(i=>i.close()));if(t.data?.kind==="call"){let n=Dt(t.data);return n?self.registration.showNotification(n.title,n.options):Promise.resolve()}if(!t.notification){let n=t.data||{};return self.registration.showNotification("Together",At(n))}return Promise.resolve()})}})();
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
