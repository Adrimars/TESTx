# TESTx — Development Plan (Completed)

**Reference:** [prd.md](prd.md)

Phases 0–16 below are all implemented and verified against the codebase (2026-09-08). Only the **Future / Backlog** section at the bottom remains outstanding.

---

## Phase 0: Project Scaffolding
Turborepo monorepo set up (`apps/api` Fastify, `apps/admin` + `apps/evaluator` Next.js, `packages/shared`, `packages/database`, `packages/ui`) with the full Prisma schema (User, EvaluatorProfile, Test, Question, QuestionOption, Media, TestResponse, Answer, Template, Coupon) and seed data.

## Phase 1: Authentication System
Cookie-based JWT auth (register/login/logout/refresh/me) plus Google OAuth, evaluator demographic onboarding, admin login, and route guards on both frontends.

## Phase 2: Media Library & Google Drive
Upload/list/delete media endpoints, a public file proxy, Google Drive folder import with on-disk caching, and an admin Media Library UI with type filters and search.

## Phase 3: Test Creation (Admin)
Full test/question CRUD with drag-to-reorder, auto-calculated reward points, system templates, test preview, and auto-generated attention-check questions on activation.

## Phase 4: Evaluator Test-Taking Flow
Demographic-matched test assignment, full test-taking UI (intro → questions → review → completion), and quality-control checks (speed, attention-check, consistency/trap) gating point rewards.

## Phase 5: Admin Results & Dashboard
Per-question result aggregation with demographic segmentation (gender/age/country), admin dashboard stats, and a read-only user list.

## Phase 6: Enhancements
Sign out, Pause/Close/Reactivate test controls, a live option-choice report for active tests, structured searchable-dropdown age/country/city profile inputs (replacing free-text DOB/city), full removal of the `FREE_TEXT` question type, and bulk/drag-drop media upload.

## Phase 7: Polish, Anti-Cheat Refinement & Testing
Anti-cheat logic refinement, responsive design pass, edge-case handling, demo seed data, and smoke testing ahead of the MVP demo. (Process-only phase, no distinct code artifact.)

## Phase 9: Mobile App — Foundation & Auth
Expo app scaffolded with Bearer-token auth alongside the existing cookie auth; email/Google registration with an 18+ gate; two-step KVKK consent (Aydınlatma Metni + separate açık rıza); profile management with preset avatars; account deletion (store-compliance requirement); device-based multi-account flagging (`isDeviceFlagged`/`registrationDeviceId` on `User`); forced minimum app-version updates.

## Phase 10: Mobile App — Swipe Engine
Gesture-driven card stack covering all question types (2-option swipe, 3+ option tap list, multi-select sub-deck, drag-to-rate, drag-to-rank), with undo and a first-run gesture tutorial.

## Phase 11: Mobile App — Continuous Feed, Progress & Rewards
Seamless cross-test feed with background prefetch, Stories-style progress bar, and an offline-safe submission queue so completed tests aren't lost to connectivity drops.

## Phase 12: Mobile App — Design System
Dark-only design tokens, shared motion/spring presets, component library, iconography, and accessibility (reduced motion, safe-area, touch targets) applied across all mobile screens; also fixed several Phase 10 field-test card bugs.

## Phase 13: Ranking Question Type
Added `RANKING` as a new cross-app question type — DB enum, API permutation validation, admin authoring UI, web drag-to-reorder, mobile drag-to-slot.

## Phase 14: Rewards Catalog
Admin-managed coupon catalog with a mobile Shop screen (browsing only — redemption/spend is deferred, see Backlog).

## Phase 15: Mobile — Rating/Ranking Redesign & Onboarding
Reworked Multi-Select (no forced minimum), visually distinct Rating vs. Ranking targets, photo-scoped dragging with a dedicated answer gutter, direct swap-to-revise for Ranking, and a first-test walkthrough tutorial.

## Phase 16: Mobile — Field-Test Feedback Round 2
Bottom tab navigation (Dashboard/Shop/Profile/Settings) replacing the test-selection list with a single Start button, an optional hobbies field, an 18+ checkbox replacing the unused numeric age field at registration, password confirmation + show/hide, added transition polish, and a fix for a stale cross-account session-token bug in the submission queue.

---

## Development Ports & Local Setup

| Service | Port | URL |
|---------|------|-----|
| Evaluator App | 3000 | http://localhost:3000 |
| Admin App | 3001 | http://localhost:3001 |
| Fastify API | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | localhost:5432 |

---

## Phase 17: Mobile-Web Parity — Core Flow (Auth, Test-Taking, PWA)

> Goal: make `apps/mobile`'s (Expo) native experience run in a browser with exactly the same design and interaction logic — without writing a separate app, producing two outputs (native build + web build) from a SINGLE codebase. This reaches phone users without waiting on store approval; the desktop experience (Phase 19) follows a completely separate, different design.

### 17.1 Expo Web Export Activation
- Add web scripts to `apps/mobile/package.json` (`expo start --web`, `expo export -p web`); verify/update the existing `"web": { "bundler": "metro", "output": "static" }` block in `app.json` as needed.
- `react-native-web` is already a dependency — verify version compatibility with the Expo SDK.
- Take a "bare build" pass of every existing screen (login, register, aydinlatma, profile-onboarding, `(tabs)`/dashboard, feed, etc.) to see what renders on web on the first try and identify what breaks (native-only imports).

### 17.2 Platform-Specific Auth Layer (Cookie vs Bearer/SecureStore)
- Native: the existing Bearer + `expo-secure-store` flow (Phase 9.1/9.3) stays UNTOUCHED.
- Web: reuse `apps/api`'s httpOnly cookie auth from Phase 1 as-is — the web build never stores a token client-side, `expo-secure-store` is never called.
- Split the auth/token file by platform: `*.native.ts` (Bearer + secure-store) / `*.web.ts` (cookie, `credentials: 'include'` fetch). The react-query hook layer stays unchanged — only this low-level file is picked per platform.
- `/auth/google` flow: instead of native's `expo-web-browser` + deep-link return, the web build uses the same `/auth/google` → `/auth/google/callback` browser redirect already used by `apps/evaluator`/`apps/admin`.

### 17.3 Web Port of the Gesture Layer
- `SwipeCard.tsx`, `RankingCard.tsx`, `TapZone.tsx` — which use `react-native-gesture-handler`'s `GestureDetector` — carry known pan-gesture inconsistency risk on web; write `.web.tsx` platform overrides for these that keep the same props/callback interface (using Framer Motion's `drag`/`dragConstraints`/`dragElastic` API).
- Components that only use `react-native-reanimated` (no gesture-handler) — `CardStack.tsx`, `RatingCard.tsx`, `MultiSelectCard.tsx`, `OptionListCard.tsx`, `TwoOptionCard.tsx`, `DragHint.tsx`, `CounterChip.tsx` — are tried unmodified first via reanimated's official web support (worklets fall back to plain JS); handle any issues found individually.
- The shared spring presets in `lib/motion.ts` continue to be used as-is on both native and web.

### 17.4 Device-Based Routing (Same Domain)
- On the same domain, route by User-Agent/viewport: phone browsers get the mobile-web experience (Expo static export), desktop gets `apps/evaluator` (Phase 19).
- Routing can be done via a middleware on the `apps/evaluator` side (rewrite/proxy to the mobile-web static build when mobile is detected); the exact hosting/infrastructure decision is finalized during implementation.
- To guard against misdetection, both experiences carry a manual "Switch to desktop version" / "Switch to mobile version" link.

### 17.5 PWA — Installability
- Add a web manifest + service worker (Serwist): app icon, theme color, standalone display mode.
- `start_url` points to the domain root (device-based routing already sends it to the mobile experience).
- Basic offline behavior: the app shell (HTML/CSS/JS) is precached; API calls stay network-first.
- Push notifications are OUT of scope for this phase (iOS PWA push limitations — see Backlog).

### 17.6 Gracefully Disabling Native-Only Features on Web
- `expo-haptics`: automatic no-op on web.
- `expo-application` (device ID, Phase 9.5): no real device ID exists on web — generate a persistent random UUID in localStorage instead and feed it into the same `isDeviceFlagged` signal (a weaker signal, but the system is already "flag, don't block").
- The `/mobile/min-version` forced-update check (Phase 9.6) is not applied in the web build — web always serves the latest version.

### 17.7 Scope of the Core Flow (What's IN This Phase)
- Login/Register (email + Google), 18+ confirmation, KVKK Aydınlatma Metni + açık rıza screens (existing mobile components are inherited as-is — this closes the Backlog's "KVKK consent on web" item for mobile-web automatically; desktop gets its own decision in Phase 19).
- Profile onboarding (age, gender, country, city, education, etc. — hobbies EXCLUDED, see Phase 18).
- Continuous feed: Start button, swipe/drag test-taking (all question types), completion screen, point reward.
- Sign out, account deletion.

### Phase 17 Exit Criteria

Before moving to Phase 18, all of the following must be true:

- [ ] `expo export -p web` produces a static build with no errors; every route (login, register, aydinlatma, profile-onboarding, dashboard, feed) opens in a browser without a 404, including deep links/refresh
- [ ] Auth in the web build works via httpOnly cookie; no token is ever written to localStorage/`expo-secure-store`
- [ ] Registering/logging in with Google works end-to-end through the web's existing `/auth/google` redirect flow
- [ ] The web versions of `SwipeCard`, `RankingCard`, and `TapZone` have been tested on a real phone browser (iOS Safari + Android Chrome); gestures feel as smooth as native
- [ ] Rating (drag-to-target) and Ranking (drag-to-slot) questions commit the correct value/order on web
- [ ] Visiting the same domain from desktop opens `apps/evaluator`; visiting from a phone browser opens the mobile-web experience; the manual "switch version" link works both ways
- [ ] PWA manifest + service worker are installed; "Add to Home Screen" works on Safari iOS and Chrome Android and launches in standalone mode
- [ ] KVKK Aydınlatma/açık rıza and the 18+ confirmation screens behave identically to native on web
- [ ] `expo-haptics` silently no-ops, device flagging works via a localStorage UUID on web, and the min-version check is not enforced in the web build
- [ ] An evaluator can register on web, complete onboarding, complete at least one test via swipe/drag, see the completion screen, and have the points reflected in their balance

---

## Phase 18: Mobile-Web Parity — Secondary Features & Full Parity

> Once Phase 17's core flow is verified, port everything else added in mobile Phase 10–16 to web — the goal is for the mobile-web experience to be FULLY identical to native.

### 18.1 Rewards Catalog / Shop
- The Coupon model is already ready on the backend (Phase 14) — port mobile's Shop tab (`shop.tsx`, `coupons.ts`) to the web build, keeping the "Coming Soon" redeem behavior.

### 18.2 Profile — Hobbies & Other Fields
- Phase 16.7's hobbies multi-select (max 5, from the predecided list) works identically on web in the Profile tab.
- Phase 16.6's optional-field labels ("City (Optional)" etc.) are the same on web.

### 18.3 Full Tab Navigation Parity
- Phase 16.4's Dashboard/Shop/Profile/Settings tab structure looks and works identically on web; sign out/delete account under Settings sit in the same place.

### 18.4 Full Port of Motion & Polish Details
- All the fine-grained motion/polish items from Phase 15/16 (card entrance animation, ranking swap scale, reclaim/place scale+fade, first-test tutorial) are verified on web through reanimated's web fallback; complete with Framer Motion equivalents where needed.
- Accessibility: the browser's `prefers-reduced-motion` triggers the same behavior (springs collapsing to a short fade) as the native OS Reduce Motion setting.

### 18.5 Device/Browser Compatibility Sweep
- A general regression sweep verifying the web equivalents of Phase 10–16's exit criteria one by one on Safari iOS and Chrome Android.

### Phase 18 Exit Criteria

Before moving to Phase 19, all of the following must be true:

- [ ] The Shop/rewards screen works on web with balance and catalog items identical to native
- [ ] The hobbies field can be selected, skipped, and changed later on web
- [ ] The four tabs (Dashboard/Shop/Profile/Settings) match native in content and layout on web
- [ ] All of Phase 15/16's motion/polish items work on web, or have been deliberately replaced with a documented, simplified web equivalent
- [ ] With `prefers-reduced-motion` on, every gesture animation on web collapses to a short fade
- [ ] The mobile-web experience has been compared end-to-end side-by-side with native on a real phone and no differences were found

---

## Phase 19: Desktop — Evaluator Redesign

> This phase is fully independent of mobile-web (Phase 17–18): `apps/evaluator`'s existing page-by-page test-taking flow is kept (NO swipe/drag), only the design language (color, typography, motion/transitions) is reapplied from the mobile design system (Phase 12).

### 19.1 Design Token Migration
- Adapt the color palette and type scale from mobile's `theme.ts`/`tokens.ts` for desktop (the dark-only constraint may be relaxed on desktop if needed — decided during implementation).
- Update `apps/evaluator`'s `@testx/ui` with these new tokens; re-skin components like Button/Card/Input/Dialog.

### 19.2 Motion & Transitions
- Add page transitions and button/card hover-focus states in the spirit of mobile's `lib/motion.ts` (using Framer Motion, for the DOM).

### 19.3 Page-by-Page Redesign
- Redesign Login/Register, Onboarding, Dashboard, Test Intro/Question/Review/Completion pages (Phase 4.5) with the new design language — the flow/business logic does NOT change, only the visual language does.

### 19.4 Desktop Side of Device-Based Routing
- Completes the desktop side of Phase 17.4's routing with this new design; the "switch to mobile version" link also lives here.

### Phase 19 Exit Criteria

- [ ] All of `apps/evaluator`'s pages have been redesigned with the new design language (color/typography/motion); the flow and business logic are unchanged
- [ ] A desktop user can complete the test-taking flow end-to-end (page-by-page, no swipe)
- [ ] The "switch to mobile version" link works on the desktop version
- [ ] `apps/admin` is OUT of scope for this phase — only evaluator's user-facing side is redesigned

---

## Phase 20: Notifications (Native Push + Web Push)

> Closes the previously-deferred Backlog item — push notifications were blocked on two things: a defined trigger signal, and (for native) a build pipeline capable of registering real push tokens. This phase resolves both: a concrete signal design, plus the EAS Build setup needed to test native push without submitting to app stores.

### 20.1 Trigger Signal Design
- **New matching test activated**: when an admin transitions a Test to ACTIVE (Phase 3.1's `PUT /admin/tests/:id/status`), a background job resolves evaluators whose profile matches the test's `demographicFilters` (reusing the same eligibility logic as `GET /evaluator/next-test`) and enqueues a notification for each.
- **Re-engagement reminder**: evaluators who haven't completed a test in N days (configurable, e.g. 3–7) get a periodic "tests are waiting for you" reminder via a scheduled job, not per-test.
- Both signals write to a shared notification log so sends are deduplicated (never notify the same evaluator twice for the same test-activation event) and auditable.

### 20.2 Push Token Storage & Dispatch Backend
- New `PushSubscription` Prisma model: `id`, `userId`, `platform` (`IOS`/`ANDROID`/`WEB`), `token` (Expo push token or Web Push subscription JSON), `createdAt`, `lastUsedAt`.
- `POST /users/me/push-subscription` registers/updates a token (called after permission is granted); `DELETE /users/me/push-subscription` removes it on sign-out or permission revocation.
- A dispatch service (`notification.service.ts`) sends via the Expo push API for `IOS`/`ANDROID` tokens and via a Web Push library (VAPID) for `WEB` subscriptions, from the same trigger signal.

### 20.3 Native Push (Expo)
- Requires an **EAS Build** — `expo-notifications` push tokens don't work in Expo Go — used for internal/ad-hoc testing only; this does NOT mean submitting to app stores.
- `apps/mobile`: request notification permission after onboarding (not on first launch, to avoid a cold prompt before the user has a reason to say yes), register the Expo push token, and handle foreground/background notification taps (deep-link into the feed or a specific test).
- iOS needs APNs credentials and Android needs Firebase, both provisioned through EAS's credential management.

### 20.4 Web Push (PWA)
- Builds on Phase 17.5's service worker: add a Web Push subscription flow (VAPID keys) to the mobile-web experience specifically (desktop `apps/evaluator` is out of scope here, matching Phase 19's separate design track).
- iOS Safari web push only works for a PWA already added to the Home Screen, needs a second explicit permission prompt after install, and has no silent/background wake — degrade gracefully (skip it if the PWA isn't installed, and never require it for an exit criterion).
- Android Chrome and desktop Chrome/Edge web push work reliably with no install requirement.

### 20.5 Notification Preferences
- Settings tab gets a simple on/off toggle (same location as sign out/delete account from Phase 16.4); turning it off clears the stored `PushSubscription`.

### Phase 20 Exit Criteria

- [ ] Activating a test notifies all currently-matching evaluators (per `demographicFilters`) within a defined delay; a test with no filter notifies everyone
- [ ] An evaluator who hasn't completed a test within the configured reminder window receives a reminder notification, not duplicated on subsequent runs
- [ ] The same evaluator is never notified twice for the same test-activation event
- [ ] Native push works end-to-end on an EAS internal build on both iOS and Android; tapping a notification deep-links into the feed
- [ ] Web push works end-to-end on Android Chrome and desktop Chrome/Edge for the mobile-web PWA
- [ ] iOS Safari web push works only after the PWA is added to the Home Screen and permission is granted; it is not required for any other exit criterion to pass
- [ ] Turning notifications off in Settings stops further sends and removes the stored subscription
- [ ] Signing out clears the device's push subscription

---

## Future / Backlog (Post-Mobile-MVP)

Not scheduled into a phase yet — tracked here so they aren't lost:

- **Coupon redemption/purchase execution** — actually spending points from the Phase 14 catalog (balance deduction, fulfillment/coupon-code delivery, transaction history). The catalog itself already ships; this is only the "spend" action.
- **KVKK consent on desktop web** — Phase 17 already inherits the mobile KVKK flow for the mobile-web experience automatically (same codebase); `apps/evaluator`'s desktop experience (Phase 19) does not capture KVKK consent — follow-up if legal/compliance asks for parity there.
- **Smarter quality-control algorithm** (prd.md §15.8): replace the flat per-test `minTimePerQuestion` with a computed per-question minimum (roughly `advisoryTimeMin ÷ 4`, formula TBD), summed per test, invisible to the evaluator. Add repeated-failure tracking (3–4 speed-check or consistency-check failures) as an additional reward-withholding signal on top of the existing single-flag behavior. Needs its own design pass before implementation.

### Security & Auth Hardening

- **Password reset ("forgot password") flow** — no endpoint or UI exists anywhere in the product (web or mobile) today; a user who forgets their password has no self-service recovery path. Needs a token-based reset flow (time-limited email link/code) added to `apps/api`'s auth routes plus a UI screen on each client.
- **Real email verification** — `POST /auth/register` currently mocks verification by setting `isVerified=true` immediately (Phase 1.1). Opening registration to the open web (Phase 17) removes the app-store gate that implicitly limited casual abuse; verification should send an actual confirmation email/code and gate `isVerified` on it before that happens.
- **CAPTCHA / bot protection on register and login** (e.g. Cloudflare Turnstile, hCaptcha) — a points-for-answers economy reachable from the open web, with no app-store review gating who can sign up, is a stronger target for scripted mass registration than the native app alone was.

### Production Readiness / Infrastructure

- **Staging & production hosting plan** — today only local dev ports are documented (see the table above); before Phase 17 goes live to real users, decide hosting for `apps/evaluator`/mobile-web (e.g. Vercel), `apps/api` (a Node host), and a managed Postgres instance, plus a staging environment separate from production.
- **Error monitoring & product analytics** — no crash/error reporting (e.g. Sentry) or usage analytics exist yet; both matter more once distribution isn't gated by app-store review.
- **CI + automated testing** — the plan currently relies entirely on manual smoke testing; at minimum, add lint/typecheck/test-on-PR CI and a Playwright e2e suite covering the desktop and mobile-web flows — particularly valuable for Phase 17's gesture-web-port, the highest-risk area for silent regressions.
- **Database backup & retention policy** — no backup schedule or data-retention policy is documented for Postgres, despite the database holding KVKK-governed personal data.

### Smaller Follow-Ups

- **Desktop accessibility (a11y) pass for Phase 19** — mobile got a dedicated accessibility phase (12.6: reduced motion, touch targets, safe area); the desktop redesign has no equivalent keyboard-navigation/screen-reader/contrast checklist yet.
- **Admin audit log** — no record of who paused/closed a test, deleted media, etc.; worth adding once more than one admin account is in regular use.
- **Public marketing/landing page** — there's currently no logged-out page explaining the product before login; worth deciding whether one is needed for the web launch.

### Legal / Store Compliance (from `kvkk-compliance-research.md` and `appstore-playstore-compliance-research.md`, 2026-08-24)

- **Have the Privacy Notice (Aydınlatma Metni) drafted by legal counsel** — `apps/mobile/src/content/aydinlatmaMetni.ts` is currently a placeholder and hasn't passed legal review.
- **Prepare a separate Privacy Policy + Terms of Use document** — neither exists in the repo yet; required for both KVKK and Apple/Google store rules (the Privacy Notice does not substitute for these).
- **Clarify the legal basis for data transfer to Google** (KVKK Article 9) — since Google OAuth sign-in is a continuous/routine dependency, explicit consent alone may not be sufficient; may need to rely on Google's standard contractual clauses/DPA instead — legal counsel approval required.
- **Clarify VERBİS exemption status** — employee count and annual balance sheet figures are pending; likely exempt at this scale, but not yet confirmed.
