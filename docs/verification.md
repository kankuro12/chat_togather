# Verification and delivery

## Requirements and evidence

| Requirement | Evidence |
| --- | --- |
| Existing couple/private-app survey | Design spec surveys Between, Paired and Signal with primary links |
| Travel/scheduling analysis | Spec analyzes Wanderlog and TimeTree; extracts itinerary, checklist and shared-calendar patterns |
| Differentiation/privacy/bonding | Spec proposes pair-only media decisions that become plans; no public discovery or automatic tracking |
| Technical requirements/priorities | Spec and implementation plan describe Node/Ionic/Angular/Capacitor, data model, authorization and impact/complexity tiers |
| Exactly one pair | Transactional invite tests reject creator self-join, duplicate pairing and concurrent third-member attempts |
| Live persistent chat | REST history/resend tests, two real socket clients with outsider isolation, two-browser journey |
| Private images/video | Signature validation and unauthorized media tests; real image decoding and generated WebM playback in browser journey |
| Choose/rate images | Backend selection replacement/rating bounds/foreign-option tests; both choice and rating workflows in two browsers |
| Schedules/plans | Backend timezone/range validation, confirmations and reset on edits; browser creates/partner confirms |
| Trips | Backend itinerary bounds/checklist/date edit tests; browser creates itinerary and both browsers observe checklist completion |
| Web/mobile frontend | Angular production build; responsive 390×844 and 1280×720 browser screenshots; Capacitor Android/iOS projects and asset sync |
| Privacy of sessions | Logout disconnect and expiry-before-broadcast tests; server-derived room and resource membership |
| Persistence | Second application instance opens same SQLite file and reads saved chat/trip |
| Deployable web artifact | Production static-serving test proves frontend delivery plus authenticated API and no-store responses |

## Latest completed runs

- `npm test`: 17 tests pass (14 backend integration tests and 3 client validation tests).
- `npm run build`: Angular production build and server TypeScript check pass. Initial web bundle ~671 kB raw / ~181 kB estimated compressed.
- Two-browser journey passed pairing, chat, image decoding, choices, ratings, plan confirmation, trip itinerary/checklists, WebM playback, gallery and session reload; no page exceptions or horizontal overflow.
- Date regression proves November 1–4 remains November 1–4 across rendering. Shared agenda keeps instants and renders user-local times.
- Capacitor sync copied production assets to Android and iOS successfully. iOS CocoaPods/Xcode steps are unavailable on this Windows host.

Screenshots: `artifacts/desktop-home.png`, `artifacts/mobile-home.png`, `artifacts/mobile-trip.png`. Browser tests retain failed traces; earlier red runs represent missing features or regressions verified before their fixes.

## Runtime limits

- No end-to-end encryption. Database/server operators can access content. Production HTTPS and protected storage/backups required.
- No background notifications, calls, booking integrations, route optimization, native biometric lock or offline send queue.
- SQLite is a single-server store. Message history paginates; other screens show bounded recent lists as documented in README.
- Native signed distribution and device privacy behavior require platform/device verification. Generated iOS project is not evidence of a successful iOS build.
- Node 24.3 built-in SQLite prints an experimental API warning. Browser test subprocesses may print color-environment warnings; these do not indicate assertion failures.

## Independent review

Read-only gpt-5.6-luna review identified native HTTP acceptance, socket presence lingering until an expiry poll, and ambiguous daylight-saving times. All three were reproduced by failing tests and fixed: native server addresses require HTTPS, sockets disconnect at exact session expiry, and repeated times require an explicit first/second occurrence. Spring gaps and half-hour transitions are tested too.

A reported concurrent resend race does not occur in this single-process synchronous request handler: the concurrent HTTP retry test proves one row and two successful responses. Multi-process SQLite writes are outside the documented single-server deployment. The reported absent verification document was an observation made before this file was created. No significant confirmed review findings remain after fixes.

Review ran browser tests concurrently with primary verification, causing an output collision. Final browser verification runs exclusively. Minor browser test timing was improved by waiting for source save completion and checking the send response before partner playback.

Final Android debug APK built successfully after production asset sync using installed Gradle 8.14.3, Android SDK and Android Studio JDK 21. Output: `client/android/app/build/outputs/apk/debug/app-debug.apk`. Wrapper distribution download timed out, so cached Gradle was used. No physical-device run or iOS build claimed.

Final browser run: both tests pass, including production login/video and production stylesheet loading under CSP. Angular critical-style inlining disabled to avoid blocked inline stylesheet handlers. Live updates now refresh only changed resources; full journey stays within the existing API request limit. Final 17-test suite and production build pass.

