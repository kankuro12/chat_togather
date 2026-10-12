# Together design

Approved whole-app redesign: fewer steps, less scrolling, concise labels. Preserve authentication, pairing, chat, choices, scheduling, trips, uploads, and server validation.

## Genre
Modern-minimal with bright coral primary actions, blush surfaces, teal secondary highlights, and peach date tiles. Dark ink keeps text readable.

## Macrostructure family
- App: compact Workbench; navigation, short heading, task content. Home is a next-action dashboard.
- Signup: two-column introduction and focused form on desktop; compact brand rail on mobile.
- Login: centered form panel on blush, small centered wordmark, no introduction. Separate #login and #signup screens linked by contextual text links.
- Content: gallery and dense lists; no decorative heroes or banners.

## Typography
Existing Georgia display, Segoe UI body, monospace invitation code. Roman headings.

## Spacing and motion
4-point named scale from tokens.css. No entrance animation. Button press feedback only. Reduced motion disables movement.

## Flows
- Five persistent navigation destinations; mobile bottom bar. Account menu holds refresh and sign out.
- Home shows next plan, next trip, recent memories, and one chat action.
- Chat uses available viewport; only message history scrolls. Choices remain a separate view.
- Plans default to planned items; Completed view keeps history accessible. Optional notes expand inside rows; edit, delete, and completion live in More. Plan location/notes and trip notes expand on demand.
- Trips separate itinerary and packing. Activity editor opens in a dialog, never below the entire itinerary.
- Auth preserves every sign-in method. Phone is selected by default and listed first; email is the secondary method. Phone/email form comes first, followed by the social divider and Google/Facebook buttons; account-switch link stays last. Login is the default entry screen. Create account opens signup; sign out returns to login. Mode tabs removed; login/signup have separate addresses and browser Back support. Switching screens clears passwords, OTP challenges, timers, and stale errors. Pairing switches between invite and join instead of stacking both forms.
- All labels remain accessible; errors and timezone information stay visible.

## CTA voice
Short verb + object. One primary create action per list. Secondary actions reveal details.

## Shared rules
Same fonts, tokens, buttons, fields, focus rings, heading rhythm. App screens have no decorative enrichment. No production files deleted. Mobile verified at 320, 375, 414, 768 px plus desktop.

## Exports

### tokens.css
```css
:root {
  --color-warm-paper: oklch(94% 0.07 65);
  --color-highlight-paper: oklch(93% 0.06 175);
  --color-highlight: oklch(39% 0.08 175);
  --color-paper: oklch(99% 0.008 60);
  --color-paper-2: oklch(97% 0.019 15);
  --color-paper-3: oklch(93% 0.045 15);
  --color-ink: oklch(28% 0.03 325);
  --color-ink-2: oklch(38% 0.03 325);
  --color-muted: oklch(46% 0.025 325);
  --color-rule: oklch(87% 0.027 15);
  --color-accent: oklch(55% 0.22 15);
  --color-accent-hover: oklch(49% 0.20 15);
  --color-accent-ink: oklch(99% 0.004 60);
  --color-focus: oklch(46% 0.20 265);
  --color-success: oklch(39% 0.10 160);
  --color-success-paper: oklch(94% 0.04 160);
  --color-error: oklch(43% 0.17 30);
  --color-error-paper: oklch(96% 0.03 30);
  --color-backdrop: oklch(25% 0.03 325 / 0.45);
  --font-display: Georgia, "Times New Roman", serif;
  --font-body: "Segoe UI", Arial, sans-serif;
  --font-outlier: ui-monospace, monospace;
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5rem;
  --text-display: clamp(1.75rem, 2vw + 1rem, 2.25rem);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 120ms;
  --dur-short: 180ms;
  --radius-card: 12px;
  --radius-input: 8px;
  --radius-pill: 999px;
  --rule-fine: 1px;
}
```

### Tailwind v4 @theme
```css
@theme {
  --color-warm-paper: oklch(94% 0.07 65);
  --color-highlight-paper: oklch(93% 0.06 175);
  --color-highlight: oklch(39% 0.08 175);
  --color-paper: oklch(99% 0.008 60);
  --color-paper-2: oklch(97% 0.019 15);
  --color-paper-3: oklch(93% 0.045 15);
  --color-ink: oklch(28% 0.03 325);
  --color-ink-2: oklch(38% 0.03 325);
  --color-muted: oklch(46% 0.025 325);
  --color-rule: oklch(87% 0.027 15);
  --color-accent: oklch(55% 0.22 15);
  --color-accent-hover: oklch(49% 0.20 15);
  --color-accent-ink: oklch(99% 0.004 60);
  --color-focus: oklch(46% 0.20 265);
  --color-success: oklch(39% 0.10 160);
  --color-success-paper: oklch(94% 0.04 160);
  --color-error: oklch(43% 0.17 30);
  --color-error-paper: oklch(96% 0.03 30);
  --color-backdrop: oklch(25% 0.03 325 / 0.45);
  --font-display: Georgia, "Times New Roman", serif;
  --font-body: "Segoe UI", Arial, sans-serif;
  --font-outlier: ui-monospace, monospace;
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5rem;
  --text-display: clamp(1.75rem, 2vw + 1rem, 2.25rem);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 120ms;
  --dur-short: 180ms;
  --radius-card: 12px;
  --radius-input: 8px;
  --radius-pill: 999px;
  --rule-fine: 1px;
}
```

### DTCG tokens.json
```json
{
  "color-warm-paper": {
    "$value": "oklch(94% 0.07 65)",
    "$type": "color"
  },
  "color-highlight-paper": {
    "$value": "oklch(93% 0.06 175)",
    "$type": "color"
  },
  "color-highlight": {
    "$value": "oklch(39% 0.08 175)",
    "$type": "color"
  },
  "color-paper": {
    "$value": "oklch(99% 0.008 60)",
    "$type": "color"
  },
  "color-paper-2": {
    "$value": "oklch(97% 0.019 15)",
    "$type": "color"
  },
  "color-paper-3": {
    "$value": "oklch(93% 0.045 15)",
    "$type": "color"
  },
  "color-ink": {
    "$value": "oklch(28% 0.03 325)",
    "$type": "color"
  },
  "color-ink-2": {
    "$value": "oklch(38% 0.03 325)",
    "$type": "color"
  },
  "color-muted": {
    "$value": "oklch(46% 0.025 325)",
    "$type": "color"
  },
  "color-rule": {
    "$value": "oklch(87% 0.027 15)",
    "$type": "color"
  },
  "color-accent": {
    "$value": "oklch(55% 0.22 15)",
    "$type": "color"
  },
  "color-accent-hover": {
    "$value": "oklch(49% 0.20 15)",
    "$type": "color"
  },
  "color-accent-ink": {
    "$value": "oklch(99% 0.004 60)",
    "$type": "color"
  },
  "color-focus": {
    "$value": "oklch(46% 0.20 265)",
    "$type": "color"
  },
  "color-success": {
    "$value": "oklch(39% 0.10 160)",
    "$type": "color"
  },
  "color-success-paper": {
    "$value": "oklch(94% 0.04 160)",
    "$type": "color"
  },
  "color-error": {
    "$value": "oklch(43% 0.17 30)",
    "$type": "color"
  },
  "color-error-paper": {
    "$value": "oklch(96% 0.03 30)",
    "$type": "color"
  },
  "color-backdrop": {
    "$value": "oklch(25% 0.03 325 / 0.45)",
    "$type": "color"
  },
  "font-display": {
    "$value": "Georgia, \"Times New Roman\", serif",
    "$type": "fontFamily"
  },
  "font-body": {
    "$value": "\"Segoe UI\", Arial, sans-serif",
    "$type": "fontFamily"
  },
  "font-outlier": {
    "$value": "ui-monospace, monospace",
    "$type": "fontFamily"
  },
  "space-3xs": {
    "$value": "0.25rem",
    "$type": "dimension"
  },
  "space-2xs": {
    "$value": "0.5rem",
    "$type": "dimension"
  },
  "space-xs": {
    "$value": "0.75rem",
    "$type": "dimension"
  },
  "space-sm": {
    "$value": "1rem",
    "$type": "dimension"
  },
  "space-md": {
    "$value": "1.5rem",
    "$type": "dimension"
  },
  "space-lg": {
    "$value": "2rem",
    "$type": "dimension"
  },
  "space-xl": {
    "$value": "3rem",
    "$type": "dimension"
  },
  "text-xs": {
    "$value": "0.75rem",
    "$type": "dimension"
  },
  "text-sm": {
    "$value": "0.875rem",
    "$type": "dimension"
  },
  "text-md": {
    "$value": "1rem",
    "$type": "dimension"
  },
  "text-lg": {
    "$value": "1.25rem",
    "$type": "dimension"
  },
  "text-xl": {
    "$value": "1.5rem",
    "$type": "dimension"
  },
  "text-display": {
    "$value": "clamp(1.75rem, 2vw + 1rem, 2.25rem)",
    "$type": "dimension"
  },
  "ease-out": {
    "$value": "cubic-bezier(0.16, 1, 0.3, 1)",
    "$type": "string"
  },
  "ease-in": {
    "$value": "cubic-bezier(0.7, 0, 0.84, 0)",
    "$type": "string"
  },
  "ease-in-out": {
    "$value": "cubic-bezier(0.65, 0, 0.35, 1)",
    "$type": "string"
  },
  "dur-micro": {
    "$value": "120ms",
    "$type": "duration"
  },
  "dur-short": {
    "$value": "180ms",
    "$type": "duration"
  },
  "radius-card": {
    "$value": "12px",
    "$type": "dimension"
  },
  "radius-input": {
    "$value": "8px",
    "$type": "dimension"
  },
  "radius-pill": {
    "$value": "999px",
    "$type": "dimension"
  },
  "rule-fine": {
    "$value": "1px",
    "$type": "dimension"
  }
}
```

### shadcn/ui CSS variables
```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --muted: var(--color-paper-2);
  --muted-foreground: var(--color-muted);
  --border: var(--color-rule);
  --input: var(--color-rule);
  --ring: var(--color-focus);
  --radius: var(--radius-input);
}
```

## Nepal phone and pairing
Phone uses a 10-digit Nepal mobile number; server normalizes +977. Pairing offers a high-contrast invitation QR, image/camera scan, and manual code with explicit join confirmation. QR uses machine-readable black/white; surrounding UI uses locked tokens.

## Communication and media
Chat carries icon-only audio/video call controls beside presence, and a compact More menu for voice/video recording and live location. Recording requires explicit start, preview and send; live location has duration and Stop. Calls use a global panel with answer/end/mute/camera controls. Memory grid uses uniform compact thumbnails and full-size viewer. Choice picker supports multi-select, previews and removal. AD/BS is a device preference in account menu and date forms.

## Focused chat and compressed photos
Chat opens as a full-viewport panel with Back, partner presence, calls and composer; app navigation stays outside. Choices has its own #choices page. Photo uploads share one WebP encoder (80% quality, up to 1600px long edge) before any upload; animated sources become still images. Expired sign-in clears stale state and says: You’re signed out. Sign in to continue.

## Choice workflow
Choices use compact rows with waiting/chosen/rating status, 44px preview targets and chosen-image summaries. Add is separate from View/Choose actions. Creation has one multi-image picker, tiny previews and removal; no image captions. Viewer provides carousel/swipe/keyboard navigation, a distinct chosen-image marker and explicit Send. Sharing a choice and sending a selection create linked Chat messages. Choice images are private attachments and excluded from Memories, including draft uploads.

Chat refinement: icon controls for calls and composer, compact Voice/Video/Location menu, image/video/audio attachment previews, tap-to-open photos and native inline playback. Durable unread counts and Seen indicators share couple-scoped read watermarks. Only focused visible Chat at latest messages marks reads and suppresses push for that session; browsing history retains position. Latest button returns to conversation end. Notifications open Chat and clear while reading; no content in push previews.

Choice image interaction: list thumbnail opens carousel. Tapping full photo or a carousel thumbnail selects it, with chosen border/check; arrows browse without replacing selection. Send choice explicitly submits and creates linked Chat message.

Brand refresh: original paired conversation mark, cream/teal strokes on coral tile, shared in loading/auth/sidebar, install icons and Android launch splash. Choices creation separates Camera and Choose images; camera offers live preview, capture/retake/switch/use and native-file fallback. Notification settings expose availability, blocked permissions and on/off state. PWA installation/update stays in account menu; private content is never cached offline.

Android incoming calls use system CallStyle notifications, expiring native incoming screen and explicit Answer/Decline. PWA call alerts open authenticated Chat for media; no promise of OS-level browser ringing. Account settings expose Android full-screen permission when needed. iOS keeps standard alerts pending a separate PushKit/CallKit implementation.
