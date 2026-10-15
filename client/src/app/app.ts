import { Component, HostListener, inject, signal } from '@angular/core';
import { IonApp, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { heartOutline, homeOutline, chatbubblesOutline, calendarOutline, compassOutline, imagesOutline, logOutOutline, arrowForwardOutline, arrowBackOutline, addOutline, closeOutline, attachOutline, arrowUpOutline, hourglassOutline, createOutline, trashOutline, timeOutline, locationOutline, mapOutline, bagHandleOutline, refreshOutline, callOutline, videocamOutline, micOutline, notificationsOutline, checkmarkDoneOutline, checkmarkOutline, arrowDownOutline, playOutline, micOffOutline, videocamOffOutline, cameraOutline, arrowUndoOutline, cameraReverseOutline, thumbsUpOutline, ellipsisHorizontal, searchOutline, pinOutline, copyOutline, eyeOutline, eyeOffOutline, cloudOfflineOutline, alertCircleOutline, call, videocam, mic, micOff, videocamOff, cameraReverse, chevronDownOutline, albumsOutline, listOutline, giftOutline, play, volumeHigh, gameControllerOutline, brushOutline } from 'ionicons/icons';
import { CallPanel } from './call-panel';
import {Pwa} from './pwa';
import { Notifications } from './notifications';
import { CalendarSwitch } from './calendar';
import { Api } from './api';
import { Outbox } from './outbox';
import { ShareSheet } from './share-sheet';
import { NudgeOverlay } from './nudge-overlay';
import { ShareInbox } from './share';
import { AuthPage } from './auth-page';
import { HomePage } from './home-page';
import { ChatPage } from './chat-page';
import { PlansPage } from './plans-page';
import { TripsPage } from './trips-page';
import { MemoriesPage } from './memories-page';
import { UsPage } from './us-page';
import { GamesPage } from './games-page';
import { StatusReporter } from './status';
import { WidgetSync } from './widget-sync';
@Component({selector:'app-root',standalone:true,imports:[IonApp,IonIcon,IonSpinner,AuthPage,HomePage,ChatPage,PlansPage,TripsPage,MemoriesPage,UsPage,GamesPage,CallPanel,ShareSheet,NudgeOverlay,CalendarSwitch],template:`
<ion-app>
@if(api.booting()){<div class="loading-screen"><img class="brand-logo" src="together-logo.svg" alt="" width="40" height="40"><h1>Together</h1><ion-spinner name="dots" aria-label="Loading"></ion-spinner><p>Opening your space…</p></div>}
@else if(!api.pair()){@defer(on immediate){<auth-page></auth-page>}}
@else if(tab()==='chat'){<main class="chat-fullscreen" id="main-content">@defer(on immediate){<chat-page (close)="closeChat()" (plan)="makePlan($event)"></chat-page>}</main>}
@else{<div class="app-shell"><aside class="sidebar"><a class="brand" href="#home" (click)="go('home')"><img class="brand-logo" src="together-logo.svg" alt="" width="40" height="40">Together<span class="brand-dot">•</span></a><div class="couple-summary"><span class="avatar small plum">{{api.user()?.name?.charAt(0)}}</span><span>{{api.user()?.name}} & {{api.partner()?.name}}</span></div><nav aria-label="Main navigation">@for(item of navigation;track item.id){<button [attr.aria-label]="item.label" [class.desktop-only]="item.desktopOnly" [class.active]="tab()===item.id" [attr.aria-current]="tab()===item.id?'page':null" (click)="go(item.id)"><ion-icon [name]="item.icon"></ion-icon><span>{{item.label}}</span>@if(item.id==='chat'&&api.unread()){<span class="unread-badge" aria-label="Unread messages">{{api.unread()>99?'99+':api.unread()}}</span>}@if(item.id==='choices'&&api.pendingChoices()){<span class="unread-badge" aria-label="Pending choices">{{api.pendingChoices()>99?'99+':api.pendingChoices()}}</span>}@if(tab()===item.id){<span class="nav-active-dot"></span>}</button>}</nav></aside>
<div class="workspace"><header class="topbar"><span class="mobile-brand"><img class="brand-logo" src="together-logo.svg" alt="" width="28" height="28">Together</span><div class="topbar-right"><span class="connection" [class.offline]="!api.connected()"><i></i>{{api.connected()?'Live':'Reconnecting'}}</span><details class="account-menu"><summary aria-label="Account menu"><span class="avatar small plum">{{api.user()?.name?.charAt(0)}}</span></summary><div class="account-options"><strong>{{api.user()?.name}}</strong>@if(pwa.available()){<button (click)="pwa.install()" [disabled]="pwa.working()">Install Together</button>}@if(pwa.updateReady()){<button (click)="pwa.update()">Update Together</button>}<calendar-switch></calendar-switch><div class="notification-settings"><button (click)="notifications.toggle()" [disabled]="notifications.working()||(!notifications.registered()&&!notifications.available())"><ion-icon name="notifications-outline"></ion-icon>{{notifications.working()?'Updating…':notifications.registered()?'Turn off push':'Enable notifications'}}</button><p role="status">{{notifications.status()}}</p><label class="notification-preview"><input type="checkbox" [checked]="notifications.previews()" (change)="notifications.setPreviews($any($event.target).checked)">Show names and message text on lock screen</label>@if(notifications.nativeAndroid&&!notifications.fullScreen()){<button (click)="notifications.callSettings()">Enable incoming call screen</button>}</div><button [disabled]="api.busy()" (click)="refresh()"><ion-icon name="refresh-outline"></ion-icon>Refresh</button><button [disabled]="api.busy()" (click)="logout()"><ion-icon name="log-out-outline"></ion-icon>Sign out</button></div></details></div></header><main [class.chat-active]="tab()==='chat'" class="page-content" id="main-content">@switch(tab()){@case('home'){<home-page (navigate)="go($event)"></home-page>}@case('choices'){@defer(on immediate){<chat-page section="choices" (plan)="makePlan($event)"></chat-page>}}@case('plans'){<button type="button" class="text-button back-home" aria-label="Back to Home" (click)="go('home')"><ion-icon name="arrow-back-outline"></ion-icon>Home</button>@defer(on immediate){<plans-page [fromDecision]="decisionId()"></plans-page>}}@case('trips'){<button type="button" class="text-button back-home" aria-label="Back to Home" (click)="go('home')"><ion-icon name="arrow-back-outline"></ion-icon>Home</button>@defer(on immediate){<trips-page></trips-page>}}@case('us'){@defer(on immediate){<us-page></us-page>}}@case('games'){@defer(on immediate){<games-page></games-page>}}@case('memories'){@defer(on immediate){<memories-page></memories-page>}}}</main></div></div>}
<call-panel></call-panel><share-sheet (navigate)="go($event)"></share-sheet><nudge-overlay></nudge-overlay>@if(notifications.notice()){<div class="notification-notice" role="status"><ion-icon [name]="notifications.noticePage()==='choices'?'thumbs-up-outline':'chatbubbles-outline'"></ion-icon><span>{{notifications.notice()}}</span><button class="icon-button" [attr.aria-label]="notifications.noticePage()==='choices'?'Open choices':'Open unread chat'" (click)="openUnread()"><ion-icon name="arrow-forward-outline"></ion-icon></button><button class="icon-button" aria-label="Dismiss notification" (click)="notifications.notice.set('')"><ion-icon name="close-outline"></ion-icon></button></div>}
@if(pwa.updateReady()&&!updateDismissed()){<div class="notification-notice" role="status"><ion-icon name="arrow-down-outline"></ion-icon><span>A new version is ready.</span><button class="primary small" (click)="updateApp()">Update app</button><button class="icon-button" aria-label="Dismiss update" (click)="updateDismissed.set(true)"><ion-icon name="close-outline"></ion-icon></button></div>}
@if(api.error()){<div class="error-toast" role="alert"><ion-icon name="heart-outline"></ion-icon><span>{{api.error()}}</span><button class="icon-button" aria-label="Dismiss error" (click)="api.error.set('')"><ion-icon name="close-outline"></ion-icon></button></div>}
</ion-app>`})
export class App {
  pwa=inject(Pwa);notifications=inject(Notifications);api=inject(Api);
  /** Started with the app so queued messages send even when the chat screen is not open. */
  private outbox=inject(Outbox);
  /** Started with the app so content shared from other apps is picked up straight away. */
  private shareInbox=inject(ShareInbox);
  /** Keeps local time, battery and (if shared) distance up to date for the partner. */
  private statusReporter=inject(StatusReporter);private widgetSync=inject(WidgetSync);tab=signal('home');decisionId=signal<string|null>(null);updateDismissed=signal(false);
  private chatPrevious:string|null=null;
  navigation:{id:string;label:string;icon:string;desktopOnly?:boolean}[]=[{id:'home',label:'Home',icon:'home-outline'},{id:'chat',label:'Chat',icon:'chatbubbles-outline'},{id:'us',label:'Us',icon:'heart-outline'},{id:'games',label:'Games',icon:'game-controller-outline'},{id:'choices',label:'Choices',icon:'thumbs-up-outline'},{id:'plans',label:'Plans',icon:'calendar-outline',desktopOnly:true},{id:'trips',label:'Trips',icon:'compass-outline',desktopOnly:true},{id:'memories',label:'Memories',icon:'images-outline'}];
  constructor(){(window as Window&{togetherBack?:()=>boolean}).togetherBack=()=>this.back();addIcons({heartOutline,homeOutline,chatbubblesOutline,calendarOutline,compassOutline,imagesOutline,logOutOutline,arrowForwardOutline,arrowBackOutline,addOutline,closeOutline,attachOutline,arrowUpOutline,hourglassOutline,createOutline,trashOutline,timeOutline,locationOutline,mapOutline,bagHandleOutline,refreshOutline,callOutline,videocamOutline,micOutline,notificationsOutline,checkmarkDoneOutline,checkmarkOutline,arrowDownOutline,playOutline,micOffOutline,videocamOffOutline,cameraOutline,arrowUndoOutline,cameraReverseOutline,thumbsUpOutline,ellipsisHorizontal,searchOutline,pinOutline,copyOutline,eyeOutline,eyeOffOutline,cloudOfflineOutline,alertCircleOutline,call,videocam,mic,micOff,videocamOff,cameraReverse,chevronDownOutline,albumsOutline,listOutline,giftOutline,play,volumeHigh,gameControllerOutline,brushOutline});const initial=location.hash.slice(1).split('?')[0];if(this.navigation.some(n=>n.id===initial))this.tab.set(initial);window.addEventListener('hashchange',()=>{const page=location.hash.slice(1).split('?')[0];if(this.navigation.some(n=>n.id===page)){this.decisionId.set(null);this.tab.set(page);if(page!=='chat')this.chatPrevious=null;}});}
  go(page:string){if(page==='chat'&&this.tab()!=='chat'){this.chatPrevious=this.tab();history.replaceState(null,'',`#${this.tab()}`);history.pushState(null,'','#chat');}else history.replaceState(null,'',`#${page}`);this.decisionId.set(null);this.tab.set(page);setTimeout(()=>document.querySelector('.page-content')?.scrollTo(0,0),0);}
  openUnread(){const page=this.notifications.noticePage();this.notifications.notice.set('');if(page!=='chat'){this.go(page);return;}this.go('chat');window.dispatchEvent(new Event('together:latest'));}
  closeChat(){if(this.chatPrevious){const previous=this.chatPrevious;this.chatPrevious=null;this.tab.set(previous);history.back();}else this.go('home');}
  makePlan(id:string){this.go('plans');this.decisionId.set(id);}
  @HostListener('document:pointerdown',['$event']) closeMenus(event:PointerEvent){for(const menu of Array.from(document.querySelectorAll<HTMLDetailsElement>('details.account-menu[open]')))if(!menu.contains(event.target as Node))menu.open=false;}
  @HostListener('document:keydown.escape') escapeMenus(){for(const menu of Array.from(document.querySelectorAll<HTMLDetailsElement>('details.account-menu[open]')))menu.open=false;}
  /** Android back button: close what is on top, then step back a screen; returns false on Home so the app goes to the background. */
  back():boolean{
    const dialog=Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).pop();if(dialog){dialog.close();return true;}
    const menu=document.querySelector<HTMLDetailsElement>('details[open]');if(menu){menu.open=false;return true;}
    // Screens with their own inner step (call screen, chat search, an open trip) handle it first.
    const event=new CustomEvent('together:back',{cancelable:true});window.dispatchEvent(event);if(event.defaultPrevented)return true;
    if(this.tab()==='chat'){this.closeChat();return true;}
    if(this.tab()!=='home'){this.go('home');return true;}
    return false;
  }
  logout(){void this.api.action(async()=>{await this.api.logout();this.go('home');});}
  refresh(){void this.api.action(()=>this.api.reload());}
  updateApp(){this.updateDismissed.set(true);this.pwa.update();}
}
