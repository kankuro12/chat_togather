import { Component, HostListener, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { Api } from './api';
import QRCode from 'qrcode';
import { QrScanner } from './qr-scanner';
@Component({selector:'auth-page',standalone:true,imports:[FormsModule,IonIcon,IonSpinner,QrScanner],template:`
<div class="onboarding" [class.login-screen]="!api.user() && mode()==='login'" [class.signup-screen]="!api.user() && mode()==='register'">
  <section class="welcome-art"><div class="brand"><img class="brand-logo" src="together-logo.svg" alt="" width="40" height="40">Together</div><div class="welcome-copy"><h1>Together, every day.</h1><p>Chat, make plans, and keep your memories in one private space.</p></div></section>
  <section class="auth-content">
    @if(!api.user()) {
      <div class="auth-inner"><h2>{{mode()==='register'?'Create account':'Sign in'}}</h2>
      <div class="auth-methods" aria-label="Sign-in method"><button type="button" [class.active]="method()==='phone'" [attr.aria-pressed]="method()==='phone'" (click)="changeMethod('phone')">Phone</button><button type="button" [class.active]="method()==='email'" [attr.aria-pressed]="method()==='email'" (click)="changeMethod('email')">Email</button></div>
      @if(method()==='email'){
      <form [attr.aria-busy]="api.busy()" (ngSubmit)="submit()">@if(mode()==='register'){<label>Your name<input name="name" [(ngModel)]="name" autocomplete="given-name" required maxlength="60" placeholder="Name"></label>}
        <label>Email address<input name="email" [(ngModel)]="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
        <label>Password<input name="password" [(ngModel)]="password" type="password" [attr.autocomplete]="mode()==='register'?'new-password':'current-password'" required [minlength]="mode()==='register'?10:1" maxlength="128" placeholder="Password"></label>@if(mode()==='register'){<p class="phone-hint">At least 10 characters.</p>}
        <button class="primary wide" type="submit" [disabled]="api.busy()">@if(api.busy()){<ion-spinner name="dots"></ion-spinner>}@else{ {{mode()==='register'?'Create account':'Sign in'}} <ion-icon name="arrow-forward-outline"></ion-icon>}</button>
      </form>
      }@else if(!challenge()){
        <form [attr.aria-busy]="api.busy()" (ngSubmit)="sendCode()">@if(mode()==='register'){<label>Your name<input name="phone-name" [(ngModel)]="name" autocomplete="given-name" required maxlength="60" placeholder="What should we call you?"></label>}
        <label>Phone number<input name="phone" [(ngModel)]="phone" type="tel" autocomplete="tel" required maxlength="20" placeholder="9800000000"></label><p class="phone-hint">We'll text you a code.</p><button class="primary wide" type="submit" [disabled]="api.busy()">@if(api.busy()){<ion-spinner name="dots"></ion-spinner>}@else{Send code <ion-icon name="arrow-forward-outline"></ion-icon>}</button></form>
      }@else{
        <form [attr.aria-busy]="api.busy()" (ngSubmit)="verifyCode()"><p class="phone-hint" role="status">Code sent to {{sentPhone()}}</p><label>Verification code<input name="otp" [(ngModel)]="otp" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{4,10}" maxlength="10" placeholder="Enter your code"></label><button class="primary wide" type="submit" [disabled]="api.busy()">@if(api.busy()){<ion-spinner name="dots"></ion-spinner>}@else{Verify & continue <ion-icon name="arrow-forward-outline"></ion-icon>}</button></form><div class="otp-actions"><button class="text-button" type="button" (click)="changeNumber()" [disabled]="api.busy()">Change number</button><button class="text-button" type="button" (click)="sendCode()" [disabled]="api.busy()||remaining()>0">{{remaining()>0?'Resend in '+remaining()+'s':'Resend code'}}</button></div>
      }
      <div class="divider auth-divider"><span>or continue with</span></div>
      <div class="social-signin"><button class="social-button" type="button" (click)="social('google')" [disabled]="api.busy()" aria-label="Continue with Google"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.3l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14.1a6 6 0 0 1 0-4.2V7.3H3.1a10 10 0 0 0 0 9.4Z"/><path fill="#EA4335" d="M12 5.8c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.3l3.3 2.6A6 6 0 0 1 12 5.8Z"/></svg>Google</button><button class="social-button facebook" type="button" (click)="social('facebook')" [disabled]="api.busy()" aria-label="Continue with Facebook"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.8v-8.3H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.2l-.5 3.5h-2.7v8.3A12 12 0 0 0 24 12Z"/></svg>Facebook</button></div>
      <p class="auth-switch">@if(mode()==='register'){Already have an account? <a href="#login">Sign in</a>}@else{New to Together? <a href="#signup">Create account</a>}</p></div>
    } @else if(api.user()?.needsProfile){
      <div class="auth-inner"><h2>What should we call you?</h2><p>Add your name for your shared space.</p><form [attr.aria-busy]="api.busy()" (ngSubmit)="saveProfile()"><label>Your name<input name="profile-name" [(ngModel)]="profileName" autocomplete="given-name" required maxlength="60" placeholder="Your name"></label><button class="primary wide" type="submit" [disabled]="api.busy()||!profileName.trim()">Continue <ion-icon name="arrow-forward-outline"></ion-icon></button></form><button class="text-button" type="button" (click)="signOut()">Sign out</button></div>
    } @else {
      <div class="auth-inner"><h2>Better with you</h2><p>Invite your partner or scan their QR.</p>
      <div class="segmented pair-tabs"><button [class.active]="pairMode()==='invite'" [attr.aria-pressed]="pairMode()==='invite'" (click)="pairMode.set('invite')">Invite</button><button [class.active]="pairMode()==='join'" [attr.aria-pressed]="pairMode()==='join'" (click)="pairMode.set('join')">Join</button></div>@if(pairMode()==='invite'){
      @if(!code()){<button class="primary wide" (click)="invite()" [disabled]="api.busy()">Create invitation <ion-icon name="arrow-forward-outline"></ion-icon></button>}
      @if(code()){<div class="invitation">@if(qr()){<img class="invitation-qr" [src]="qr()" alt="Partner invitation QR code">}<strong data-testid="invite-code">{{code()}}</strong><small>Single use · expires in 24 hours</small><button class="text-button" (click)="copy()">{{copied()?'Copied!':'Copy code'}}</button></div>}
      } @else {
      <button type="button" class="primary wide" (click)="scanner.open()">Scan QR code</button><p class="fineprint">or enter code manually</p><form [attr.aria-busy]="api.busy()" (ngSubmit)="join()"><label>Partner invitation code<input name="code" [(ngModel)]="joinCode" required maxlength="32" autocomplete="off" placeholder="Paste their code here"></label><button class="secondary wide" type="submit" [disabled]="api.busy()">Join your partner</button></form>
      }<p class="fineprint">Updates automatically when your partner joins.</p><button class="text-button" (click)="signOut()">Sign out</button></div>
    }
  </section>
</div><qr-scanner (scanned)="joinCode=$event"></qr-scanner>`})
export class AuthPage {
  @ViewChild(QrScanner) scanner!:QrScanner;
  profileName='';
  saveProfile(){void this.api.action(async()=>{await this.api.request('/auth/profile',{name:this.profileName},'PATCH');await this.api.me();});}
  qr=signal('');
  pairMode=signal<'invite'|'join'>('invite');
  api=inject(Api);mode=signal<'register'|'login'>(location.hash==='#signup'?'register':'login');method=signal<'email'|'phone'>('phone');name='';email='';password='';phone='';otp='';challenge=signal('');sentPhone=signal('');remaining=signal(0);private timer?:ReturnType<typeof setInterval>;code=signal('');joinCode='';copied=signal(false);
  @HostListener('window:hashchange') syncRoute(){
    if(this.api.user())return;
    const next=location.hash==='#signup'?'register':'login';
    if(next===this.mode())return;
    this.mode.set(next);this.password='';this.otp='';this.challenge.set('');this.sentPhone.set('');this.remaining.set(0);clearInterval(this.timer);this.api.error.set('');
  }
  submit(){void this.api.action(async()=>{await this.api.authenticate(this.mode(),{name:this.name,email:this.email,password:this.password});this.password='';});}
  social(provider:'google'|'facebook'){void this.api.action(()=>this.api.social(provider));}
  changeMethod(method:'email'|'phone'){this.method.set(method);this.api.error.set('');}
  changeNumber(){this.challenge.set('');this.otp='';}
  sendCode(){void this.api.action(async()=>{const phone=this.phone.replace(/[\s()-]/g,'');const sent=await this.api.request('/auth/phone/send',{phone,...(this.mode()==='register'?{name:this.name}:{})});this.challenge.set(sent.challenge);this.sentPhone.set(phone);this.otp='';this.remaining.set(sent.retryAfter);clearInterval(this.timer);const until=Date.now()+sent.retryAfter*1000;this.timer=setInterval(()=>{this.remaining.set(Math.max(0,Math.ceil((until-Date.now())/1000)));if(!this.remaining())clearInterval(this.timer);},1000);});}
  verifyCode(){void this.api.action(async()=>{await this.api.acceptSession(await this.api.request('/auth/phone/verify',{challenge:this.challenge(),code:this.otp}));this.otp='';this.challenge.set('');});}
  ngOnDestroy(){clearInterval(this.timer);}
  invite(){void this.api.action(async()=>{const invitation=await this.api.request('/pair/invite',{});this.qr.set(await QRCode.toDataURL(invitation.code,{width:224,margin:4,errorCorrectionLevel:'M'}));this.code.set(invitation.code);this.copied.set(false);});}
  join(){void this.api.action(async()=>{await this.api.request('/pair/join',{code:this.joinCode});await this.api.me();});}
  copy(){void this.api.action(async()=>{await navigator.clipboard.writeText(this.code());this.copied.set(true);});}
  signOut(){void this.api.action(async()=>{await this.api.logout();this.code.set('');this.qr.set('');this.joinCode='';this.copied.set(false);this.pairMode.set('invite');this.profileName='';this.name='';this.email='';this.password='';this.phone='';this.changeNumber();this.remaining.set(0);clearInterval(this.timer);this.mode.set('login');location.hash='login';});}
}
