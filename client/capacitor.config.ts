import type { CapacitorConfig } from '@capacitor/cli';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
// Firebase's iOS plugin auto-initializes on launch; include only after configuration exists.
const config:CapacitorConfig={appId:'com.together.couple',appName:'Together',webDir:'www',server:{androidScheme:'https'},ios:{includePlugins:existsSync(resolve(__dirname,'ios/App/App/GoogleService-Info.plist'))?['@capacitor-firebase/messaging']:[]},android:{includePlugins:['@capacitor-firebase/messaging']}};
export default config;
