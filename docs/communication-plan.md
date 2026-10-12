# Communication and compact media

Extend existing paired workspace in place. No route or data deletion.

- Chat header: audio/video calls. Global call panel persists across navigation. WebRTC transports media; authenticated Socket.IO relays only between current pair. Busy, decline, timeout, disconnect and cleanup are explicit. Production networks need configured TURN.
- Chat composer: attachment picker, voice/video recorder with preview, discard and explicit Send; live location sharing with duration and Stop. Share location only while app open; latest coordinates expire and are removed on stop/logout.
- Push: Firebase Admin sends generic partner notifications. Web and Capacitor register per-session device tokens after permission. Logout unregisters token. Configuration lives outside source; no fabricated Firebase credentials.
- Calendar: account AD/BS preference, converted date entry and display in plans/trips. Backend retains canonical Gregorian dates/instants.
- Photos: compact fixed aspect ratio grid, full-size viewer, multi-image selection with previews and labels.

Modify existing chat, API, media, app, models, plans, trips, memories, schema and realtime handlers. Add communication, recorder, calendar, notifications components/services and tests. Append existing styles; preserve locked Hallmark palette.

Verify pair isolation, session expiry, call state transitions, location expiry, media content validation, calendar round trips, browser flows and mobile widths. Firebase delivery and native hardware verification require real project/device configuration.
