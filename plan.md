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

## Future / Backlog (Post-Mobile-MVP)

Not scheduled into a phase yet — tracked here so they aren't lost:

- **Push notifications** for new/available tests (Expo Notifications), once there's a signal for when to send them.
- **Coupon redemption/purchase execution** — actually spending points from the Phase 14 catalog (balance deduction, fulfillment/coupon-code delivery, transaction history). The catalog itself already ships; this is only the "spend" action.
- **KVKK consent on web** — Phase 9.3 added it to mobile only; extending the same consent capture to `apps/evaluator`'s registration flow is a follow-up if legal/compliance asks for parity.
- **Smarter quality-control algorithm** (prd.md §15.8): replace the flat per-test `minTimePerQuestion` with a computed per-question minimum (roughly `advisoryTimeMin ÷ 4`, formula TBD), summed per test, invisible to the evaluator. Add repeated-failure tracking (3–4 speed-check or consistency-check failures) as an additional reward-withholding signal on top of the existing single-flag behavior. Needs its own design pass before implementation.

### Legal / Store Compliance (from `kvkk-compliance-research.md` and `appstore-playstore-compliance-research.md`, 2026-08-24)

- **Have the Privacy Notice (Aydınlatma Metni) drafted by legal counsel** — `apps/mobile/src/content/aydinlatmaMetni.ts` is currently a placeholder and hasn't passed legal review.
- **Prepare a separate Privacy Policy + Terms of Use document** — neither exists in the repo yet; required for both KVKK and Apple/Google store rules (the Privacy Notice does not substitute for these).
- **Clarify the legal basis for data transfer to Google** (KVKK Article 9) — since Google OAuth sign-in is a continuous/routine dependency, explicit consent alone may not be sufficient; may need to rely on Google's standard contractual clauses/DPA instead — legal counsel approval required.
- **Clarify VERBİS exemption status** — employee count and annual balance sheet figures are pending; likely exempt at this scale, but not yet confirmed.
