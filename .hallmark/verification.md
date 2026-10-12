# Redesign verification — 2026-10-12

## Delivered scope
- Shell: five destinations, compact desktop navigation, mobile bottom navigation, account menu for refresh/sign out.
- Home: next chronological plan/trip, recent media, one primary chat action; decorative hero and counter shortcuts removed.
- Chat: available-height conversation, stationary composer, separately scrollable choices.
- Plans: planned/completed views, compact rows, notes disclosure, More actions menu.
- Trips: itinerary/packing views, dialog activity editor, compact trip list; decorative banner removed.
- Memories: concise heading and upload action, responsive gallery.
- Auth/pairing: preserved email/phone/social methods, focused forms, invite/join views, compact short-screen spacing.
- Plan/trip optional fields expand on demand. Duplicate modal Cancel buttons removed; close control and Escape preserved.

## Evidence
- npm run build: passed client production build and server TypeScript check.
- npm test: 21 passed; no failures.
- E2E_ISOLATED=1 npx playwright test --reporter=line: 5 passed, 34.9 seconds; no failures.
- Browser flow uses two real paired accounts for messages, images, choice/rating votes, plan creation/confirmation, trips/packing/activities, video playback/gallery, production login, and account-menu sign-out.
- Layout tests: 320,375,414,768,1280 px; no horizontal overflow. Home/chat content fits at height800 and composer stays in view. Real populated desktop1280x720/mobile390x844 flows also pass.
- Auth additionally fits360x640;320x480 form remains reachable by scrolling.
- Dialog screenshots: plan/trip/activity forms and itinerary/packing at all tested widths.
- Computed text contrast: WCAG4.5:1 small text,3:1 large text, checked in rendered app and plan/activity forms.
- Screenshot inspection: narrow/mobile/tablet/desktop, auth, home, chat, plans, itinerary/packing and dialogs. Screenshots in artifacts/.
- Independent read-only code review: no concrete regressions found.
- Capacitor sync passed. Web/Android/iOS index hashes match.

## Hallmark review
Consistent cream/plum tokens, preserved Georgia/SegoeUI, roman headings, named spacing, focus/pressed/disabled/loading/error/success treatments, reduced-motion support, no invented metrics or fake chrome, no decorative enrichment in app screens. Global stylesheet retained with appended Hallmark layer. Shared system in design.md/tokens.css; combined app entry in log.json.

## Limits
Native devices and signed APK/IPA builds not tested; Windows environment lacks CocoaPods/Xcode. Existing social/phone-provider configuration requirements unchanged. Standard development ports unchanged; isolated browser mode uses3101 with separate test database to avoid consuming local auth limits.

## Separate auth screens follow-up
Login uses a centered panel; signup uses the existing split introduction/form on desktop. Both simplify to compact mobile screens. Contextual cross-links replace mode tabs. Hash routes #login/#signup support direct access and browser Back. Screen changes clear password, OTP challenge/code, timer, and stale errors. Patterns researched from official Notion signup (https://app.notion.com/signup) and Slack sign-in help (https://slack.com/help/articles/212681477-Sign-in-to-Slack-Sign-in-to-Slack); existing authentication mechanisms preserved. Auth-specific browser test verified both screens at 320/375/414/768/1280 px and360x640. Production build passed; mobile assets synced.

## Bright palette follow-up
Shared tokens changed to vivid coral primary actions, blush surfaces, teal highlights, and peach date tiles. Dark text preserved. Design exports refreshed. Production build passed. Auth/layout/contrast browser checks passed (2 tests,19.7s), covering320/375/414/768/1280px plus short-screen auth360x640. Avatar lettering uses darker coral after measured contrast failure was corrected. Screenshot review confirmed bright palette across auth/home/chat/plans/trips/memories; no layout or flow changes. Capacitor assets synced; native device testing not performed.

## Login-first entry follow-up
Anonymous root page defaults to login; only #signup selects registration. Hash changes and browser Back use the same default, so signup -> Back -> root returns to login. Create account link opens signup. Signed-in sessions retain normal app access; sign-out returns to login. Production build passed. Root/signup/Back and responsive auth regression test passed (8.7s). Other5 browser tests passed during broader run before correcting the root Back fallback. Mobile assets synced.

Communication update: 26 API/calendar checks and 9 isolated browser tests passed. Calls use simulated microphone/camera; recording upload/playback and location start/stop verified through real API. AD/BS trip round-trip and compact grid tested at 320/375/414/768 widths. Actual in-app UI checked for call controls, More menu and multi-image choice previews. FCM delivery/native hardware/external TURN remain unverified without credentials/devices.

Focused chat/WebP update: actual in-app full-screen chat verified; 26 API checks pass. Initial route-history regression identified after pairing (#signup versus rendered Home), normalized parent URL before pushing Chat. Focused UI tests cover WebP conversion in all three upload paths and expired-token cleanup.

Final focused-chat verification: 26 API/calendar checks passed; 11 browser flows verified across full suite and targeted rerun after Back fix. WebP content type and smaller file size checked through real API for Chat, Choices and Memories. Initial expired-token cleanup and sign-out without error toast passed. Actual in-app Chat and separate Choices inspected. Android/iOS assets synced; Firebase delivery/TURN/native hardware need deployment configuration/testing.

Phone profile onboarding: new-number login → OTP → persistent name setup → pairing verified in actual browser. Backend blocks pairing until name completion. Returning account retains name and skips setup. 27 backend/calendar checks and targeted phone/profile/QR browser flows verified.

Choice list update: 28 API/calendar tests and all 13 isolated browser flows passed. Compact status rows, separate Add/View/Choose menu, caption-free multiple image picker, carousel browsing with independent selection, and linked share/selection Chat messages verified. Choice uploads and legacy option photos excluded from Memories. Responsive choice layout checked at 320/375/414/768px; screenshot artifacts/choice-list-ui.png reviewed. Authenticated request limits now apply per verified account to avoid shared-IP photo loading failures. Production build and Android/iOS asset sync passed; native hardware not tested.

Chat refinement: production build passed; 29 API/calendar checks and all14 full-app browser flows passed. Final media-width adjustment retested with Chat browser flow. Unread persistence, couple isolation, monotonic reads, session-specific push suppression, another-device eligibility and disconnected delivery verified using injected push sender. Browser checks cover open/dismiss notification, Seen receipt, history scroll retention/latest jump, attachment image/video/audio preview/remove/send, full photo viewer, and real audio/video playback at320/375/414/768/1280px. Call answer/mute/end, voice/video recording and location controls passed existing real-pair tests. Screenshots reviewed at320 and1280px. Firebase configuration absent on running app: actual closed-app FCM delivery and native hardware remain unverified. Android/iOS assets synced.

Click-to-choose update: production build and2 real browser flows passed. Full photo click selects image; carousel thumbnail changes selection; keyboard arrow browsing retains selection; Send choice persists vote and posts linked Chat message. Existing rating flow passed. Android/iOS assets synced.

Choice menu fix: outside pointer click and Escape dismiss Actions; opening Add closes menu. Choice page uses natural page scrolling and nonshrinking rows, removing nested list scrollbar. Production build and real choice flow passed; outside click/Escape and visible overflow checked at320/375/414/768px. Mobile assets synced.

Camera/branding/PWA/Android: full suite16 browser flows and29 API/calendar checks passed. Final camera/notification/mobile-logo changes passed3 targeted auth/camera/PWA browser tests; production build and native asset sync passed. Actual fake-device camera captures WebP, retakes/switches, releases every track, handles permission denial and native-file fallback, clears stale error on successful fallback. Multiple captured images share as private choice media. New original paired-chat mark reviewed on loading/Choices screenshots; launcher192/512px/maskable/Apple icons and Android splash generated. PWA manifest, activation, public-only caching, offline navigation/reconnect verified in browser. Duplicate cache entry initially prevented installation; deduplicated and rerun passed. Notification UI handles unavailable/incomplete configuration and restores state without stale enabled status. Android assembleDebug passed twice, finalpackage35s. Debug APK artifacts/together-debug.apk. Native physical-device install/camera/push not tested; HTTPS backend URL and Firebase configuration remain unset. Gradle initial C-drive download failed; removed only its incomplete111MB file and built using E-drive Gradle/temp folders.

Durable jobs update: SQLite persisted queue with deduplicated device jobs, atomic chat/choice outbox, progress, five-attempt exponential retries, renewable leases and crash recovery. Separate worker and safe status CLI added. Generic queue restart/progress/retry/concurrent-claim tests passed; active/seen/revoked-session delivery behavior and token cleanup verified with injected sender. Backend build and three real browser Chat/Choice/call/media flows passed. Startup without Firebase exits without consuming saved work; actual external FCM delivery remains unverified. Provider event tags reduce duplicate display; at-least-once semantics and future handler checkpoint requirements documented.

Actual localhost3001 browser check after imported Firebase settings: server was stopped and restarted. Separate Chrome test context showed phone-first sign-in, paired Choices and camera fallback UI, no console errors or horizontal overflow. Authenticated config returned200 with web/server/VAPID present, worker activated and standalone manifest. Real isolated browser attempted FCM token registration three times; Notification and Push permissions were granted, but browser subscription returned Registration failed - permission denied, including with background networking enabled. Test sessions revoked, no email/push sent; actual delivery remains unverified. Server left running at3001.

Native incoming-call update: Android CallStyle/ringtone/full-screen-or-heads-up notification, expiring incoming activity, Answer launch/bridge handoff, authenticated background Decline and cancellation dismissal implemented. Offline call invitations stored and revalidated before push; expired/accepted calls skipped. PWA data-only alerts expose Answer/Decline open-to-app actions. Ordinary iOS alerts preserved; PushKit/CallKit not implemented. Firebase Android com.together.couple registration created in existing authorized project and matching ignored google-services.json retrieved. Backend/frontend production build passed;32 API/calendar/job tests and4 browser camera/PWA/call flows passed, including offline recipient reconnect and automatic authenticated WebRTC answer via notification URL. Final native APK build passed with Firebase SDK/google-services and current frontend assets. artifacts/together-debug.apk updated. Local worker started after confirming empty production queue. adb reported no connected devices, so native closed-app FCM/ringing/lock-screen behavior remains unverified. HTTPS device backend URL still unset; Android permissions/force-stop restrictions and server transport restart limits documented.
