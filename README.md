# Together

Private space for one paired couple: live chat, images/videos, image choices and ratings, shared plans, trip itineraries and packing lists.

**Stack:** Node 24.3+ / Express / Socket.IO / MySQL; Ionic 8 / Angular 20 / Capacitor 7 for web, Android and iOS. MySQL 8.0+ required; SQLite remains available for local tests and imports.

## Run locally

Configure the MySQL connection below and create its database, then:

```sh
npm install
npm run dev
```

Open http://localhost:4200. Create two accounts in separate browsers or browser profiles. One creates an invitation; the other enters its code. Invitations expire after 24 hours and admit one partner. The creator's page updates automatically.

No demo login or seeded private content. Browser tests create their own local accounts.

## Phone and social sign-in

Copy `server/.env.example` to `server/.env`. Email sign-in works without external credentials. Phone sign-in uses Twilio Verify: configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`; select a six-digit code in the Verify service. Enable SMS destinations in Twilio and verify recipients when using a trial account.

For phone testing, set `PHONE_TEST_MODE=true` in `server/.env` and restart the API; request a code, then enter `123456`. Works with `NODE_ENV=production`; no SMS or Twilio credentials needed. Challenges still expire, allow five attempts, and are single-use. While enabled, anyone can sign in as any phone number. Set `PHONE_TEST_MODE=false` after testing. Local development currently enables this flag.

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

API trusts exactly one reverse proxy for client IPs. Keep API reachable only through that proxy in production; the proxy must overwrite forwarded IP, host, and protocol headers. Adjust `trust proxy` in `server/src/app.ts` if deployment uses a different proxy topology.

Optional `server/.env` (see `server/.env.example`): port, host, database file, allowed origins. Origins must be exact comma-separated values. Keep native origins for packaged apps.

Configure MySQL in `server/.env` before starting API or worker:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=together
DB_USERNAME=together
DB_PASSWORD=your-password
```

Create an empty database with `CREATE DATABASE together CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;` and grant the configured user access. Startup creates application tables. Optional `DATABASE_URL=mysql://user:password@host:3306/together` overrides connection fields. Use the same database configuration for API, worker, and job-status commands. `DB_CONNECTION=sqlite` with `DB_PATH=data/together.db` enables the local SQLite backend.

To import existing SQLite data: stop API and worker, back up `server/data`, configure an empty MySQL database, then run `npm run migrate:sqlite -w server` (optional source path: `npm run migrate:sqlite -w server -- data/together.db`). Import preserves IDs, sessions, pending database jobs, and upload references. It leaves the source file unchanged, refuses a nonempty target, and rolls back on failure. Keep `server/data/uploads` available; media files stay on disk. Restart API and worker after import. Redis data remains in its configured Redis instance.

Sessions and background jobs share one storage toggle in `server/.env`:

```dotenv
STORAGE_DRIVER=db
# Use STORAGE_DRIVER=redis to store sessions and jobs in Redis.
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=together
```

`db` (default) stores sessions and jobs in the configured application database; `redis` uses Redis 6.2+ and BullMQ. Application records and push device registrations always stay in the application database. Keep the same database and storage settings for API, worker (`npm run worker -w server`), and job status (`npm run jobs -w server`). Restart API and worker after changing settings. Each storage backend keeps its own sessions and pending jobs; switching storage backends does not move them. Drain pending jobs before switching. Enable Redis persistence and use a `noeviction` policy to retain sessions and jobs across Redis restarts. Use a distinct `REDIS_PREFIX` for each deployment.

Run Redis integration tests with `TEST_REDIS_URL` set to a test Redis instance; tests use isolated key prefixes and remove only their own keys.

Run MySQL integration tests with `TEST_MYSQL_URL` set to a connection URL whose user can create/drop test databases. Tests create isolated `together_test_*` databases and remove only those databases.

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

API keeps active calls and location state in memory; media stays on disk. Run one API instance unless shared media and realtime coordination are added. Multiple workers can use the same MySQL or Redis queue. Latest 100 messages load with older-history pagination. Gallery shows latest 200 files, decisions latest 100, plans latest 500 and trips latest 200; records remain on disk. Storage/backups and lifecycle policies remain deployment responsibilities. Offline sending is not implemented; failed sends retain text for retry.

Older office-chat documents in `docs/legacy` are historical and do not describe this app.

Android debug APK built in this workspace: `client/android/app/build/outputs/apk/debug/app-debug.apk`. Built with Android SDK, Android Studio JDK 21 and installed Gradle 8.14.3. Configure a deployed HTTPS backend inside app before native use. iOS project synced; iOS compilation and physical-device tests remain pending.




Phone login accepts 10-digit Nepal mobile numbers (e.g. `9800000000`); the API stores canonical `+977` numbers. Pair invitations can be copied manually or scanned from a QR using camera/image upload. Camera access is requested only after tapping Use camera; manual entry remains available. Native camera permissions are declared for Android/iOS.

Calls, voice/video messages, foreground live location, compact image grids and AD/BS date entry are available. Firebase push and production TURN setup: [communication setup](docs/communication-setup.md). FCM remains unavailable until project credentials are configured. Native devices and external-network calls require deployment testing.

Every image uploaded through Chat, Choices or Memories converts to WebP before transfer (80% quality, maximum 1600px long edge). Photo metadata is stripped. Animated sources become still images. Audio/video files retain original format. Chat opens full-screen at #chat; Choices is a separate #choices page.

New phone users who enter through Sign in finish name setup after OTP verification. Setup survives reloads and must finish before pairing; returning named users skip it.

Choice images stay out of Memories. Choices appear in a compact status list; image thumbnails open a carousel. Choose an image, then Send choice to post selection to Chat. Sharing new choices also posts a linked Chat message. Image captions are optional in API and omitted from UI. Repeated identical votes and retried creates do not duplicate Chat entries.

Choices has its own notification and pending-count badge. The badge counts your partner's choices awaiting your answer, including entries beyond the displayed list. Viewing Choices or reading Chat does not clear it. Choosing one image clears a choose request; rating every image clears a rating request. New-choice alerts open Choices, remain available while reading Chat, and each new event receives its own push alert even if answered before delivery. Background push uses the existing Firebase setup.
