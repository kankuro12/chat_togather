# Together: proposed couple app design

Status: approved by user; implemented and verified; native device/iOS build limits documented. Research checked 2026-10-11.

## Intent and success

Build a Node backend and Ionic Angular frontend shared by web, Android, and iOS. Each account belongs to at most one active couple; each couple contains exactly two members once paired. Its only chat is that couple's room. Either partner can upload clothes or other options, and the other can choose one or rate options. Both can create trips, schedules, and plans.

Current workspace contains documentation for an older React/MySQL office chat, but no corresponding source. Those documents do not establish implemented functionality. This design creates a new app and replaces setup instructions when implementation finishes.

## Market survey

| Product | Relevant published features | Product implication |
| --- | --- | --- |
| [Between](https://between.us/) | Private couple chat, photos/videos/notes, anniversaries, shared calendar, voice calls | Couple-only membership and memories form the baseline |
| [Paired](https://www.paired.com/) | Daily check-ins, questions, expert-led quizzes and games | Optional daily connection prompts can support bonding without competing for attention |
| [Signal](https://signal.org/) | End-to-end encrypted messaging and private voice/video communication | Privacy claims must distinguish access control from end-to-end encryption |
| [Wanderlog](https://wanderlog.com/) | Collaborative itineraries, maps, reservations, budgets, packing checklists | Start with dated itinerary items and checklists; map optimization and booking imports add considerable scope |
| [TimeTree](https://timetreeapp.com/intl/en) | Shared calendars, invitations, filtering, scheduling communication | A shared agenda plus partner confirmation addresses everyday coordination |

These are a feature survey, not an exhaustive audit or a claim of market novelty. Our differentiator is the combined workflow: media decision in chat becomes a shared plan or trip item, inside one pair's space.

## Approaches

1. Recommended: one Node service, SQLite persistence, Socket.IO, Ionic Angular plus Capacitor. Fast local setup, transactional pairing, modest deployment cost. Single service initially; PostgreSQL migration needed for distributed writes.
2. Node plus PostgreSQL and object storage immediately. Better deployment scaling, more local infrastructure and operational work.
3. Hosted realtime/database service behind Node. Faster managed infrastructure, added vendor dependence and more complex enforcement across services.

## Scope and priorities

| Priority | Feature | Impact | Complexity |
| --- | --- | --- | --- |
| P0 | Registration/login/logout and single-use partner invitations | Essential | Medium |
| P0 | Strict pair authorization for HTTP, sockets, and media | Essential | High |
| P0 | Persistent live text chat, typing and reconnect history | High | Medium |
| P0 | Private image/video uploads and shared gallery | High | Medium |
| P0 | Decision cards: 2–6 image options, choose one or rate 1–5 | High; requested differentiator | Medium |
| P0 | Shared agenda, dated plans, edit/delete and completion | High | Medium |
| P0 | Trips with destination, dates, itinerary and checklist | High | Medium |
| P0 | Responsive Ionic web frontend and Capacitor mobile projects | Essential | Medium |
| P1 | Anniversary profile and optional daily prompt | Medium | Low |
| P1 | Export couple data, account deletion and unpairing | High | Medium |
| P2 | Background push reminders and native biometric lock | High | High |
| P2 | End-to-end encryption with device key recovery | High | Very high |
| P2 | Maps, booking imports, route optimization and calls | Medium | High |

First implementation delivers P0; P1/P2 remain a documented roadmap. Mobile means usable responsive frontend and native packaging configuration; signed store releases require signing credentials and platform build environments.

## User experience

Working name: Together. Warm cream background, plum navigation, coral accents, rounded cards, readable typography. Desktop has compact navigation and room for chat plus upcoming plans; mobile uses bottom tabs: Home, Chat, Plans, Trips, Memories. Empty states offer relevant actions instead of fabricated partner activity.

Onboarding: create account, create an invitation or enter partner code, wait until partner accepts. Unpaired accounts cannot use couple resources. No user directory or discovery. Either partner can create a decision. Choice mode stores one replaceable selection per member; rating mode stores one replaceable integer score per option/member. Results show who chose or rated; this is collaborative, not anonymous polling.

Agenda stores UTC instants and an IANA timezone for rendering. Trips use destination-local date ranges and itinerary items. Plan confirmation records each partner's response; editing time clears prior confirmation. A decision can be linked to a new plan explicitly, without silently generating events.

## Architecture and data

Server: Node TypeScript, Express REST, Socket.IO for pair-scoped updates, SQLite with migrations. Client: standalone Angular components, Ionic components, Angular HTTP service, Socket.IO client, Capacitor configuration. Separate server and client packages with root scripts.

Tables: users, sessions, couples, memberships, invitations, messages, media, decisions, decision_options, decision_votes, plans, plan_responses, trips, itinerary_items, checklist_items. All couple resources carry couple_id. The authenticated identity determines couple_id; never trust a submitted couple_id. Membership uniqueness and invite consumption are transactional. A third member and already-paired accounts cannot join.

REST areas: auth, pair, messages/history, media, decisions/votes, plans/responses, trips/itinerary/checklists. Socket authentication validates the same session as REST; join only the server-selected couple room. Writes persist before emitting. Reconnect refetches state; client-generated message identifiers prevent duplicate resend. Validation errors display actionable text; unauthorized/expired sessions return to login.

## Privacy and reliability

Passwords hashed with a suitable slow password hash. Opaque expiring sessions, logout revocation, throttled auth/invite endpoints, configured origin allowlist, bounded request sizes. Media reads require authenticated membership and never use public static upload URLs. Validate actual file signatures, supported MIME types and upload sizes; use generated file identifiers. Avoid logging message bodies and credentials.

TLS is required on public deployment. This first version has server-enforced privacy, not end-to-end encryption: server operators can access persisted content. Do not advertise E2EE. No automatic location tracking or public sharing. Production backup encryption, monitoring, account recovery and retention policies need deployment decisions.

## Verification and acceptance

Backend integration tests cover two independent couples, rejected third membership, simultaneous invitation redemption, unauthorized history/media/decision/trip access, expired sessions, validation, vote replacement, persistence and socket isolation. Real-time test uses two clients to verify a persisted message reaches only the correct room.

Frontend production build and component checks verify onboarding, empty states, form validation and decision selection. Browser walkthrough verifies two real accounts pair, chat updates in both sessions, images appear, partner chooses/rates, plans and trip checklists synchronize. Check narrow viewport, keyboard access and visible error handling. Native projects may be generated; native runtime testing must be reported separately if SDKs are unavailable.

## Proposed implementation sequence

1. Workspace packages, migrations, authentication and atomic pairing.
2. Couple-scoped REST, sockets, upload access and integration tests.
3. Ionic shell, onboarding, live chat and gallery.
4. Decision creation/voting, plans and trips connected to real APIs.
5. Cross-session/browser verification, mobile packaging, updated setup docs.

User approved design and all workspace actions. Execution plan: ../plans/2026-10-11-together.md. Evidence: ../../verification.md.

