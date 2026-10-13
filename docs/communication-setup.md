# Calls, push, recording and locations

Web features require HTTPS outside localhost. Voice/video recording is capped at 60 seconds / 15 MB, previewed, then sent explicitly. Location is shared only within the authenticated pair, for 15 minutes or 1 hour, and stops on disconnect, logout, expiry or Stop. No coordinates are stored permanently. Map opens only when tapped.

## Reliable calls across networks

Set `WEBRTC_ICE_SERVERS` in `server/.env` to a JSON array of STUN/TURN servers, including TURN username/credential. Default STUN supports direct connections; a reachable TURN relay is required for restrictive networks. Use HTTPS/WSS and appropriate TURN capacity. Credentials are returned only to signed-in, paired users. Configure short-lived TURN credentials for deployment.

## Firebase Cloud Messaging

Set server environment:

- `FCM_PROJECT_ID`: Firebase project ID.
- `GOOGLE_APPLICATION_CREDENTIALS`: absolute local service-account JSON path; never commit private key.
- `FCM_WEB_CONFIG`: JSON object containing Firebase web app public config.
- `FCM_VAPID_KEY`: Firebase web push public key.

Enable Firebase Cloud Messaging API for the project. Web service worker is built locally; Firebase scripts are bundled rather than loaded from a CDN. Notifications default on after login: web permission is requested when undecided, and granted devices register automatically once paired. A saved explicit opt-out remains off across login/reload. Browser/OS permission still requires the user's approval; browsers that block automatic prompts retain the account notification control. Token belongs to current session. Logout removes registration. Push carries generic messages/call notices, never message content or coordinates. Native/web foreground delivery and ordinary realtime updates use existing authenticated app state. Push is a notification; incoming WebRTC calls require both partners online in the app.

Android: place project `google-services.json` in `client/android/app/`; app ID `com.together.couple` must match.

iOS: add `GoogleService-Info.plist` to `client/ios/App/App/`, include it in the Xcode App target, enable Push Notifications capability, configure APNs authentication key/certificate in Firebase, and enable Remote notifications background mode if needed. Native Firebase plugin is included during sync only when platform config file exists, avoiding an unconfigured iOS startup failure. Run `npm run mobile:sync -w client` after adding config. Native build/push delivery require real devices and platform tooling.

FCM backend can be tested with an injected sender; actual delivery cannot be verified without project credentials.

## Calendars and media

AD/BS switch appears in account menu and date forms. Preference is saved on device; BS dates convert to canonical AD dates before API writes. Conversion uses the library's supported calendar table and rejects invalid dates. Plans retain timezone/DST handling. Memories exclude voice recordings and use compact equal-size thumbnails with a full-size viewer. Choice picker supports multiple images, previews and removal; no image captions.

Use npm 8.3+ (prefer npm 11) so the patched gRPC dependency override is honored. Only Firebase Messaging is bundled on the client; Firestore is not imported.

## Unread and notification behavior

Unread messages survive refresh and device changes. Chat marks through the latest visible message only while focused, visible and at conversation end. Sender sees a double check once partner reads. Other pages show a Chat badge and short notification with an Open action. Background/closed-app FCM uses the existing registered session; each new chat/choice event queues its own alert on every eligible registered device. Presence expires after45 seconds without heartbeat. Reopening restores notification listeners without requesting permission again; temporary registration failures retry after reconnect or returning to the app. Actual FCM delivery needs the configuration above and enabled device/browser permission.

## PWA and Android

Web app includes a standalone manifest, 192/512px icons, maskable icon, Apple touch icon, and install/update actions in the account menu when browser supports them. PWA and FCM share one service worker. Only public JS/CSS/logo/offline assets are cached; authenticated API and media requests are never cached. Offline navigation shows a reconnect page. HTTPS is required outside localhost.

Android launcher icons and launch splash use the same original paired-chat logo. Camera capture runs within the app via getUserMedia; native camera file capture is a fallback. Photos preview before use, compress to WebP, and remain private choice attachments. Android camera/microphone and notification permissions are declared. Set client/public/together-config.json apiUrl to the deployed HTTPS backend before producing a device build. Keep Firebase platform/config credentials as described above. Build: npm run build, npm run mobile:sync -w client, then client/android/gradlew assembleDebug. Release distribution needs your signing key.

## Durable notification worker

API saves one push job per eligible registered recipient device after committing chat/choice messages. Stable event IDs deduplicate queued jobs. Run API and npm run worker -w server as separate supervised services using the same MySQL connection and STORAGE_DRIVER settings. Worker needs FCM_PROJECT_ID and application-default Firebase credentials; without these it exits without consuming saved jobs. npm run jobs -w server shows counts, attempts, progress and recent errors without device tokens. MySQL and Redis writes are separate from message transactions; a crash during enqueue can leave a message without its notification job.

Jobs retain state/progress across restarts. Atomic leases permit multiple workers without simultaneous claims; leases last60 seconds and refresh every10 seconds during a task. Crashed claims become available again. Failed delivery retries up to5 attempts with exponential delay, then remains failed for inspection. Invalid or signed-out device registrations are skipped/removed. Reading Chat or answering a choice does not discard its queued event. Expired calls never ring. Every send, skip and failure logs its outcome without device tokens; a completed job means processed, including deliberate skips. Android/web notification tags reuse event ID to reduce duplicate displays. Delivery is at least once: a crash after external send but before acknowledgment can repeat a notification; future non-push handlers must implement their own idempotency and checkpoint/resume using saved payload/progress. No private message contents are included in jobs or push text.

This queue handles deferred work; active calls and browser location capture still need connected devices. Restarting the server cannot restore a live camera, microphone or location stream. MySQL/Redis queues support workers sharing their backend. Optional SQLite queue deployment needs a shared local disk. Retain/inspect failed jobs; no automatic destructive cleanup is performed.

Firebase also accepts FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY with FCM_PROJECT_ID as an alternative to application-default credentials. Escaped newlines in environment private keys are normalized. Test SMTP keys are stored in server/.env for future mail delivery; current app does not send emails. Imported mail/Firebase settings came from the existing Dairy app without modifying it. Android Firebase configuration must match com.together.couple; no google-services.json was available in that source project. Together Android registration was subsequently created in the same Firebase project and its matching configuration downloaded to the ignored Android app file.

## Closed-app incoming calls

Android uses a high-priority data-only FCM invitation, native CallStyle notification and optional lock-screen activity. Answer launches Together, validates the still-ringing invitation through authenticated API, reconnects Socket.IO and negotiates WebRTC. Decline cancels locally and sends an authenticated HTTPS request without opening the app. Invitations expire after45 seconds; queued expired/accepted invitations do not ring. Cancellation removes notifications on other devices. Native full-screen permission is surfaced in account settings; disabled permission falls back to heads-up notifications. Enable Android notifications, configure com.together.couple google-services.json and deployed HTTPS API URL, and run notification worker. Android force-stop/settings restrictions can prevent push until app reopened. Active media is established in foreground after Answer, not before user consent. Server transport restart ends active/ringing invitations.

PWA can receive a push call alert with Answer/Decline actions where supported. Actions open the app to authenticate and accept/decline; unsupported browsers can tap alert then use in-app controls. Browser service workers cannot maintain WebRTC media or reliably ring while browser/OS suspends them. This is not a native telephony integration.

iOS currently retains ordinary call alerts and in-app WebRTC. True iOS closed-app calls require PushKit VoIP tokens, CallKit reporting, APNs VoIP credentials/entitlements and device testing; these are not included in this Android implementation.

Live browser push test: `node scripts/live-fcm.mjs` creates a dedicated test pair, grants notification permission in a separate regular Chrome profile, closes every PWA tab without signing out, and verifies two separate chat alerts, two choice alerts, audio/video incoming-call actions and cancellation. Test sessions are revoked only after assertions. Report: `artifacts/live-fcm-result.json`. Browser must remain running; private browsing, browser force-stop or OS restrictions can prevent push. OS notification permission must also allow Chrome; browser permission alone does not prove a notification appeared.

For a Linux test server with Google Chrome, Xvfb, Dunst and optional Scrot installed, run a separate notification desktop. The test fixture disables OS-level duplicate grouping and notification timeouts so alerts can be counted independently:

```sh
xvfb-run -a -s '-screen 0 1280x1024x24' dbus-run-session -- sh -c '
  dunst -conf scripts/live-fcm-dunstrc & daemon=$!
  LIVE_SCREENSHOT=1 node scripts/live-fcm.mjs
  result=$?
  kill "$daemon"
  exit "$result"
'
```

Actual deployed Chrome test passed: two chat alerts, two choice alerts, audio/video call alerts with actions, and cancellation removal. Screenshot: `artifacts/live-fcm-notifications.png`. Native Android/iOS device delivery still requires separate device testing.
