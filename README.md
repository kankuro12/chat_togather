# Together

Private space for one paired couple: live chat, images/videos, image choices and ratings, shared plans, trip itineraries and packing lists.

**Stack:** Node 24.3+ / Express / Socket.IO / SQLite; Ionic 8 / Angular 20 / Capacitor 7 for web, Android and iOS. No database service required.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:4200. Create two accounts in separate browsers or browser profiles. One creates an invitation; the other enters its code. Invitations expire after 24 hours and admit one partner. The creator's page updates automatically.

No demo login or seeded private content. Browser tests create their own local accounts.

## Phone and social sign-in

Copy `server/.env.example` to `server/.env`. Email sign-in works without external credentials. Phone sign-in uses Twilio Verify: configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`; select a six-digit code in the Verify service. Enable SMS destinations in Twilio and verify recipients when using a trial account.

For local phone testing, set `PHONE_TEST_MODE=true` in `server/.env`; request a code, then enter `123456`. No SMS or Twilio credentials needed. Challenges still expire, allow five attempts, and are single-use. Test mode is ignored when `NODE_ENV=production`. Local development currently enables this flag.

Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` from your provider applications. Register exact callbacks `${PUBLIC_URL}/api/auth/oauth/google/callback` and `${PUBLIC_URL}/api/auth/oauth/facebook/callback`. Set `PUBLIC_URL` to the API origin and `APP_URL` to the web origin, add the web origin to `ALLOWED_ORIGINS`, and use HTTPS in production. Facebook apps need live mode and any required review for public users. `FACEBOOK_GRAPH_VERSION` is configurable. Use the same hostname (localhost or 127.0.0.1) for both origins locally so the callback cookie stays on the same site.

Phone, Google, Facebook, and email identities remain separate accounts; matching email text never merges existing couples. Return with the same sign-in method to keep your shared space. Codes expire after ten minutes, allow five attempts, and are single-use. SMS sends are limited by IP and phone number, with a one-minute resend delay. OAuth callbacks bind to a browser cookie; one-use handoff tickets require the initiating browser's verifier.

For native builds, set `apiUrl` in `client/public/together-config.json` to your HTTPS API before building/syncing Capacitor. No server-address field appears in onboarding. Social redirects are implemented for web; native provider handoff requires platform browser/deep-link integration before shipping native social login.

Design system: `design.md` and `tokens.css`. Bright coral/blush/teal surfaces, compact task-first screens, completed-plan filtering, itinerary/packing tabs, activity dialogs, and viewport-sized chat.

## Included

- Registration, password hashing, expiring/revocable sessions, transactional pairing.
- Persistent live chat with typing, presence, reconnect history and duplicate resend protection.
- Authenticated JPEG/PNG/WebP/GIF/MP4/WebM uploads, 15 MB per file; shared gallery and chat playback.
- Decisions with 2–6 images: choose one or rate each 1–5; named responses visible to both partners.
- Shared plans: location, notes, local time display, confirmations, edit/delete and completion. Time edits clear confirmations.
- Create a plan from a decision.
- Trips: destination, dates, dated activities, editable itinerary and synchronized packing checklist.
- Responsive Ionic UI and generated Capacitor Android/iOS projects.

## Production web

```sh
npm run build
npm start
```

API serves compiled frontend at http://localhost:3001. Public deployment requires HTTPS; reverse-proxy `/api` and `/socket.io` including WebSocket upgrades. Set `HOST=0.0.0.0` only when exposing service through your deployment network. Protect `server/data` and backups.

Optional `server/.env` (see `server/.env.example`): port, host, database file, allowed origins. Origins must be exact comma-separated values. Keep native origins for packaged apps.

## Mobile

```sh
npm run build -w client
npm run mobile:sync -w client
npm run mobile:android -w client
```

Android source: `client/android`. iOS source: `client/ios`; open with 
pm run mobile:ios -w client` on a Mac with Xcode and CocoaPods. Configure your deployed HTTPS API in `client/public/together-config.json` before building native apps. Include `https://localhost` (Android) and `capacitor://localhost` (iOS) in allowed origins. Device localhost is not your computer.

Signed APK/IPA releases and physical-device testing require Android SDK/JDK or macOS/Xcode, signing credentials and a deployed backend. Native source generation is separate from native runtime verification.

## Verify

```sh
npm test
npm run test:e2e
npm run build
```

Browser tests use installed Google Chrome (`channel: chrome`), start API and frontend if needed, and exercise two independent browser contexts including one mobile viewport. Screenshots: `artifacts/`; failed traces: `test-results/`.

Research, priorities and architecture: `docs/superpowers/specs/2026-10-11-couple-app-design.md`. Execution plan: `docs/superpowers/plans/2026-10-11-together.md`. Evidence and limits: `docs/verification.md`.

## Privacy and limits

Only authenticated members can read/write their couple resources and media. Server operators can access stored content; **not end-to-end encrypted**. No public directory or location tracking. Sessions live in browser/WebView local storage; use trusted devices and HTTPS. Android backup disabled.

SQLite targets one server. Latest 100 messages load with older-history pagination. Gallery shows latest 200 files, decisions latest 100, plans latest 500 and trips latest 200; records remain on disk. Storage/backups and lifecycle policies remain deployment responsibilities. No background push, calls, booking imports or route optimization. Offline sending is not implemented; failed sends retain text for retry.

Older office-chat documents in `docs/legacy` are historical and do not describe this app.

Android debug APK built in this workspace: `client/android/app/build/outputs/apk/debug/app-debug.apk`. Built with Android SDK, Android Studio JDK 21 and installed Gradle 8.14.3. Configure a deployed HTTPS backend inside app before native use. iOS project synced; iOS compilation and physical-device tests remain pending.




Phone login accepts 10-digit Nepal mobile numbers (e.g. `9800000000`); the API stores canonical `+977` numbers. Pair invitations can be copied manually or scanned from a QR using camera/image upload. Camera access is requested only after tapping Use camera; manual entry remains available. Native camera permissions are declared for Android/iOS.

Calls, voice/video messages, foreground live location, compact image grids and AD/BS date entry are available. Firebase push and production TURN setup: [communication setup](docs/communication-setup.md). FCM remains unavailable until project credentials are configured. Native devices and external-network calls require deployment testing.

Every image uploaded through Chat, Choices or Memories converts to WebP before transfer (80% quality, maximum 1600px long edge). Photo metadata is stripped. Animated sources become still images. Audio/video files retain original format. Chat opens full-screen at #chat; Choices is a separate #choices page.

New phone users who enter through Sign in finish name setup after OTP verification. Setup survives reloads and must finish before pairing; returning named users skip it.

Choice images stay out of Memories. Choices appear in a compact status list; image thumbnails open a carousel. Choose an image, then Send choice to post selection to Chat. Sharing new choices also posts a linked Chat message. Image captions are optional in API and omitted from UI. Repeated identical votes and retried creates do not duplicate Chat entries.
