import { bootstrapApplication } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { App } from './app/app';
bootstrapApplication(App,{providers:[provideIonicAngular({mode:'md'})]}).catch(console.error);
