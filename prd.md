# TESTx — Product Requirements Document (MVP)

**Company:** Hubx
**Product:** TESTx — Crowdsourcing Evaluation Platform
**Version:** MVP / Demo
**Date:** 2026-05-13

---

## 1. Overview

TESTx is a crowdsourcing evaluation platform where registered evaluators rate and compare media files (photos, videos, audio, text) through structured tests/surveys. Admins create tests, define targeting criteria, and analyze aggregated results with demographic breakdowns. The platform enforces quality control through speed checks, attention-check questions, and consistency traps.

### 1.1 MVP Goal

Deliver a fully functional demo showcasing the core evaluation loop: admin creates a test with media → evaluators matching demographics are auto-assigned the test → evaluators complete the test → admin views aggregated results with demographic breakdowns. Reward payouts are tracked as points with no real payment integration.

---

## 2. User Roles

| Role | Description |
|------|-------------|
| **Evaluator** | Self-registers, completes demographic profile, takes assigned tests, earns points. |
| **Admin** | Creates and manages tests, uploads media, configures targeting, reviews results, manages platform. |

---

## 3. Authentication & Registration

### 3.1 Authentication Methods
- **Email + Password:** Standard registration with email verification.
- **Google OAuth:** Sign in with Google.
- Both methods available for all users.

### 3.2 Token Management
- JWT stored in **httpOnly secure cookies**.
- Access token (short-lived) + Refresh token (long-lived) pattern.
- CSRF protection via double-submit cookie or SameSite attribute.

### 3.3 Evaluator Registration Flow
1. User visits public sign-up page.
2. Chooses email/password or Google OAuth.
3. Email verification (skip for OAuth).
4. Mandatory onboarding: fill demographic profile (age, gender, location).
5. Account activated → redirected to evaluator dashboard.

### 3.4 Admin Registration
- Admin accounts are **seeded or created manually** (no public admin registration).
- Admin login uses the same auth methods but routes to the admin app.

### 3.5 Sign Out
- Both the evaluator and admin apps expose a visible **Sign Out** control (in the navbar/sidebar user menu).
- Signing out calls `POST /auth/logout`, clears the httpOnly access + refresh cookies, and redirects to the login page.
- After sign out, protected routes are inaccessible until the user logs in again.

---

## 4. Demographic System

### 4.1 MVP Fields (Mandatory for Evaluators)

| Field | Type | Details |
|-------|------|---------|
| Age | Integer | Evaluator selects their **specific age as a number** from a searchable dropdown. Stored directly on the profile. Admin analytics bucket the number into age ranges. |
| Gender | Enum | Male, Female, Other, Prefer not to say. |
| Country | String | Searchable dropdown from the ISO 3166 country list. |
| City | String | Searchable dropdown, filtered by the selected country. |

### 4.2 Future Extension
- Education level, occupation, income bracket, interests, etc.
- Extensible profile schema designed from the start.

---

## 5. Test Structure & Question Types

### 5.1 Test Structure
- A **Test** is a container with metadata and an ordered list of questions.
- Linear order — all evaluators see questions in the same sequence (no branching).
- Each question has its own media attachments, all of the same media type.

### 5.2 Test Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Title | String | Yes | Internal name for admin reference. |
| Description | String | No | Optional instructions shown to evaluator before starting. |
| Status | Enum | Yes | Draft, Active, Paused, Closed. |
| Demographic Filters | JSON | No | Optional targeting rules (age range, gender, location). |
| Response Cap | Integer | No | Max number of responses. Null = unlimited. |
| Time Limit (advisory) | Integer | No | Estimated completion time in minutes. Shown to evaluator as advisory. |
| Min Time Per Question | Integer | Yes | Global default: 60 seconds. Admin can disable (set to 0). |
| Created At | Timestamp | Yes | Auto-generated. |
| Updated At | Timestamp | Yes | Auto-generated. |

### 5.3 Question Types

#### 5.3.1 Single Select
- Evaluator picks exactly **one** option from a list.
- Options can be media files (photos, videos, audio) or text.
- UI: Radio buttons or clickable media cards.

#### 5.3.2 Multi Select
- Evaluator picks **one or more** options.
- Admin configures min/max selections (e.g., "pick 2 to 4").
- UI: Checkboxes or toggleable media cards.

#### 5.3.3 Rating Scale
- Evaluator rates a single media item or concept on a numeric scale.
- Admin configures: scale range (e.g., 1–5, 1–10), label for endpoints (e.g., "Poor" to "Excellent").
- UI: Star rating, slider, or numbered buttons.

#### 5.3.4 Ranking
- Evaluator orders **3–5 options** (media or text) from best to worst (or 1st to Nth by whatever criterion the prompt states).
- Admin configures: number of items (3–5, hard cap of 5) and, optionally, endpoint labels (e.g., "Best" / "Worst").
- Answer is stored as the full ordered list of option IDs (reuses the existing `selectedOptions` array on `Answer` — position in the array **is** the rank, index 0 = best).
- UI: web — a standard drag-to-reorder list. Mobile — see §15.3 for the drag-to-slot interaction.
- Not eligible as a trap-duplicate consistency check or an auto-graded attention check in v1 (comparing permutations for "sameness" or "correctness" is left for a later pass — see §9.3).

> **Note:** There is no free-text/open-ended question type. All questions are structured (single select, multi select, rating, or ranking) so responses can be aggregated. Select-type options may still use plain text as the option label.

### 5.4 Media per Question
- All options within a single question must be the **same media type** (all photos, all videos, etc.).
- Supported types: Image (JPEG, PNG, WebP), Video (MP4, WebM), Audio (MP3, WAV, OGG), Text (plain string).
- One question can have 2–10 media options for selection types, or 3–5 for ranking questions (see §5.3.4).

---

## 6. Media Management

### 6.1 Media Library
- Central repository where Admin uploads/imports media before attaching to questions.
- Media items have: file name, type, size, upload date, tags (optional), thumbnail (auto-generated for video/audio).
- Admin can browse, search, filter, and select media from the library when building questions.
- **Bulk upload:** Admin can add **multiple files at once** — via a multi-select file picker and via **drag-and-drop** onto the library. Files upload in a batch with per-file progress and validation.

### 6.2 Media Source — Google Drive (MVP)
- Admin pastes a Google Drive folder URL.
- System reads the folder contents and imports file metadata into the media library.
- Files are cached/proxied through the backend.

### 6.3 Media Delivery — Backend Proxy (MVP)
- Backend fetches media from Google Drive and serves it to evaluators.
- Caching layer (in-memory or file-based) to avoid repeated Drive API calls.
- **Post-MVP:** Transition to S3/GCS with signed URLs and CDN (CloudFront/Cloudflare).

### 6.4 Media Limits

| Type | Max File Size | Max Duration |
|------|--------------|-------------|
| Image | 25 MB | N/A |
| Video | 500 MB | 5 minutes |
| Audio | N/A | 10 minutes |

---

## 7. Test Creation Flow (Admin)

### 7.1 Steps
1. **Create Test:** Enter title, description.
2. **Add Questions:** Select question type → attach media from library or upload inline → configure options.
3. **Configure Settings:** Set demographic filters (optional), response cap (optional), time settings.
4. **Preview:** Admin takes the test in preview mode to verify the evaluator experience.
5. **Save as Draft** or **Activate** immediately.

### 7.2 Templates
- System provides built-in skeleton templates for common patterns:
  - **Photo Comparison:** Multi-select with photo options.
  - **Media Rating:** Rating scale applied to a single media item.
  - **Text Survey:** Single/multi-select with text options.
- Templates pre-fill question type, structure, and settings.
- Admin selects a template, then customizes.
- **Post-MVP:** Admin-defined custom templates saved for reuse.

### 7.3 Test Lifecycle

```
Draft → Active → Paused → Active → Closed
         ↓                            ↑
         └──────────────────────────────┘
```

- **Draft:** Editable. Not visible to evaluators.
- **Active:** Accepting responses. Not editable (except pause/close). Visible to eligible evaluators.
- **Paused:** Temporarily stopped. Not visible. Can be reactivated.
- **Closed:** Final. No more responses. Results available. Cannot be reactivated.

**Admin controls on an Active test:**
- **Pause** ("Deactivate") — stops the test from being assigned to new evaluators; can be resumed by reactivating. "Deactivate" is a UI synonym for Pause; there is no separate status.
- **Close** — ends the test permanently; results remain available and it cannot be reactivated.
- Both actions are surfaced as explicit buttons on the test list and test detail views, each with a confirmation step.

---

## 8. Evaluator Experience

### 9.1 Dashboard
- **Auto-assigned test:** Prominent "Start Next Test" button. System picks the next eligible test.
- **Points balance** displayed.
- **Withdraw button** with "Coming Soon" label.
- If no tests available: friendly empty state ("No tests available right now. Check back later.").

### 9.2 Test-Taking Flow
1. Evaluator clicks "Start Next Test."
2. System selects the next eligible test (based on demographics, not already taken, within response cap).
3. Test intro screen: title, description, estimated time, number of questions.
4. One question per page with progress bar (e.g., "Question 3 of 12").
5. **Free navigation:** Back and Next buttons. Evaluator can revisit and change answers.
6. **Must complete in one session.** If they leave, progress is lost.
7. Advisory timer shown (estimated time remaining).
8. Final review/submit screen.
9. On submit: show success + points earned.

### 9.3 Responsive Design
- Equal priority for mobile and desktop.
- Media cards adapt: grid on desktop, vertical stack on mobile.
- Touch-friendly controls for mobile (large tap targets for selection).

---

## 9. Quality Control & Anti-Cheat

### 10.1 Minimum Time Per Question
- **Global default:** 60 seconds per question.
- If evaluator spends less than the threshold on a question, that response is **flagged**.
- Admin can **disable** the time check per test (set threshold to 0).
- Time is tracked per question (recorded as `timeSpentSeconds` per answer).

### 10.2 Attention-Check Questions
- **System auto-generated:** Platform inserts questions like "Select the third option" or "Choose the red image" at random positions.
- **Admin manual:** Admin can add custom attention-check questions and mark them as such.
- Attention checks are **not counted** in the evaluator's visible question count.
- Wrong answer on attention check → entire response **flagged**.

### 10.3 Consistency Checks (Trap Questions)
- A question appears again later in the test (duplicate with same options, potentially reordered).
- If the evaluator gives a **different answer** to the duplicate, the response is **flagged**.
- Admin marks which questions should be duplicated as traps when creating the test.
- System can also auto-insert one duplicate if the test has 8+ questions.
- Applies to single-select and multi-select questions only. Ranking questions are not eligible as trap duplicates in v1 (comparing two permutations for "close enough" sameness is a separate design problem, deferred).

### 10.4 Flagging Behavior
- Flagged responses are **excluded from results** (not counted in aggregation).
- Flagged responses **do not earn rewards** (points withheld).
- Evaluator is **not notified** that their response was flagged.
- Admin can see flagged response count per test in the results view.

---

## 10. Reward System

### 11.1 Points Model
- Evaluators earn **points** for valid (non-flagged) test completions.
- Reward amount is **auto-calculated** based on test characteristics:
  - Base formula: `points = (number_of_questions × question_weight) + time_bonus`
  - `question_weight`: varies by type (e.g., media comparison = 2 pts, rating = 1 pt).
  - `time_bonus`: additional points if estimated completion time > 5 minutes.
- Points are displayed as a numeric balance on the evaluator dashboard.

### 11.2 Withdraw / Cash-Out
- "Withdraw" button on the evaluator dashboard.
- Clicking shows a **"Coming Soon"** message with informational text.
- **Post-MVP:** Real payment integration (PayPal, bank transfer, gift cards).

### 11.2a Rewards Catalog (Coupons) — Mobile
- A browsable catalog of coupons/rewards evaluators can eventually spend their points on (e.g., "5,000 pts = 50 TL voucher").
- **In scope now:** the catalog itself. Admin manages catalog items (title, image, point cost, description, active/inactive) from the admin panel; the mobile app lists them with the evaluator's current balance shown alongside.
- **Deferred:** the actual redemption/purchase action. Tapping a catalog item's "Redeem" button shows a **"Coming Soon"** state — same pattern as §10.2 Withdraw. No points are deducted, no fulfillment happens, in v1.
- No App Store/Play Store policy issue with this "browsing only" design (`appstore-playstore-compliance-research.md` §4, §9e) — it's a non-monetary, fixed-point-cost catalog, not sweepstakes- or gambling-shaped. One caveat: store-listing screenshots/copy must not depict or describe redemption as functional, or it risks a metadata-accuracy issue unrelated to the rewards policy itself.
- See §15.10 and §16 for the mobile screen's requirements and look, and §11.4 for the admin-side catalog management screen.

### 11.3 Balance Display
- Evaluator dashboard shows **total accumulated balance** (points).
- No itemized transaction history for MVP.
- **Post-MVP:** Detailed transaction log.

---

## 11. Admin Dashboard & Analytics

### 12.1 Admin Dashboard (Overview)
- **Total Evaluators:** Count of registered evaluators.
- **Active Tests:** Count of tests in Active status.
- **Total Responses:** Count of all submitted responses across all tests.
- **Flagged Responses:** Count of quality-flagged responses.

### 12.2 Test Results / Report View
- Available for both **Active tests (live)** and **Closed tests** — admins can watch option choices accumulate in real time, not only after a test closes.
- Per-question result aggregation:
  - **Selection questions:** Bar/pie chart showing option distribution (e.g., "Photo A: 62%, Photo B: 38%").
  - **Rating questions:** Average score, distribution histogram.
- **Option Choice Report:** For each question, shows which options were chosen and how many evaluators picked each one, filterable by demographic segment.
- **Demographic breakdowns:** Filter/segment results by age range, gender, location.
  - Example: "Males 18–25: 70% chose Photo A. Females 26–35: 55% chose Photo B."
- **Response metadata:** Total responses, valid responses, flagged count, average completion time.

### 12.3 User Management (Minimal)
- View list of registered evaluators (name, email, registration date, total tests completed).
- **No ban/edit capability for MVP.**
- **Post-MVP:** Full user management (ban, suspend, view response history).

### 12.4 Rewards Catalog Management (Mobile Coupons)
- New admin screen: CRUD over catalog items (title, image upload, point cost, description, active/inactive toggle, display order).
- No fulfillment/inventory tracking in v1 — this manages what evaluators *see*, not stock or actual coupon codes (see §10.2a).

---

## 12. Technical Architecture

### 13.1 Monorepo Structure (Turborepo + pnpm)

```
testx/
├── apps/
│   ├── evaluator/          # Next.js — Evaluator-facing app
│   ├── admin/              # Next.js — Admin panel
│   └── api/                # Fastify — Backend API
├── packages/
│   ├── shared/             # Shared TypeScript types, constants, utils
│   ├── database/           # Prisma schema, migrations, seed scripts
│   ├── ui/                 # Shared UI components (shadcn/ui based)
│   └── config/             # Shared ESLint, TS config
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 13.2 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| Package Manager | pnpm |
| Frontend (x2) | Next.js (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend API | Fastify |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (httpOnly cookies) + Google OAuth |
| Language | TypeScript (full stack) |
| API Style | REST |
| Media Source | Google Drive API |
| Media Delivery | Backend proxy (MVP) |

### 13.3 API Design

#### Auth Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Email/password registration |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/logout` | Clear session |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | OAuth callback |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |

#### Evaluator Endpoints
| Method | Path | Description |
|--------|------|-------------|
| PUT | `/evaluator/profile` | Update demographic profile |
| GET | `/evaluator/next-test` | Get next auto-assigned test |
| GET | `/evaluator/tests/:id` | Get full test with questions for taking |
| POST | `/evaluator/tests/:id/submit` | Submit test responses |
| GET | `/evaluator/balance` | Get current points balance |

#### Admin Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Dashboard stats |
| CRUD | `/admin/tests` | Create, read, update, delete tests |
| PUT | `/admin/tests/:id/status` | Change test status (activate, pause/deactivate, close) |
| GET | `/admin/tests/:id/report` | Live option-choice report (available while Active and after Closed) |
| GET | `/admin/tests/:id/preview` | Get test in preview mode |
| GET | `/admin/tests/:id/results` | Get aggregated results |
| GET | `/admin/tests/:id/results/demographics` | Results segmented by demographics |
| GET | `/admin/media` | List media library |
| POST | `/admin/media/upload` | Direct file upload — accepts **multiple files** in one request (multi-select or drag-and-drop) |
| POST | `/admin/media/import-drive` | Import from Google Drive folder |
| DELETE | `/admin/media/:id` | Remove media from library |
| GET | `/admin/users` | List evaluators |
| GET | `/admin/templates` | List available templates |

### 13.4 Database Schema (Key Entities)

#### Users
```
User {
  id            UUID PK
  email         String UNIQUE
  passwordHash  String?
  googleId      String?
  role          Enum(EVALUATOR, ADMIN)
  isVerified    Boolean
  avatarId      Int?     // NEW — index into a fixed set of 8-10 preset avatars bundled with the mobile app; no upload, no user photo data
  aydinlatmaAcknowledgedAt DateTime?  // NEW — Article 10 disclosure notice acknowledged (not consent); set at mobile registration
  acikRizaAcceptedAt      DateTime?  // NEW — explicit consent, only for whatever specific processing actually needs it (e.g. the Google cross-border transfer, pending legal confirmation); null if not applicable to this user
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### Evaluator Profile
```
EvaluatorProfile {
  id          UUID PK
  userId      UUID FK → User
  age         Integer (specific age selected by the evaluator)
  gender      Enum(MALE, FEMALE, OTHER, UNDISCLOSED)
  country     String
  city        String?
  hobbies     String[] (NEW — up to 5, chosen from a predecided list; optional)
  balance     Integer (points, default 0)
  createdAt   DateTime
  updatedAt   DateTime
}
```

#### Test
```
Test {
  id                UUID PK
  title             String
  description       String?
  status            Enum(DRAFT, ACTIVE, PAUSED, CLOSED)
  responseCap       Integer?
  advisoryTimeMin   Integer?
  minTimePerQuestion Integer (default 60, 0 = disabled)
  demographicFilters JSON?
  rewardPoints      Integer (auto-calculated)
  createdAt         DateTime
  updatedAt         DateTime
}
```

#### Question
```
Question {
  id            UUID PK
  testId        UUID FK → Test
  type          Enum(SINGLE_SELECT, MULTI_SELECT, RATING, RANKING)
  prompt        String
  mediaType     Enum(IMAGE, VIDEO, AUDIO, TEXT)?
  order         Integer
  config        JSON (min/max selections, scale range, char limits, etc.)
  isAttentionCheck  Boolean (default false)
  isTrapDuplicate   Boolean (default false)
  trapSourceId      UUID? FK → Question (original question this is a duplicate of)
  createdAt     DateTime
}
```

#### Question Option
```
QuestionOption {
  id          UUID PK
  questionId  UUID FK → Question
  label       String?
  mediaId     UUID? FK → Media
  order       Integer
}
```

#### Media
```
Media {
  id            UUID PK
  fileName      String
  fileType      Enum(IMAGE, VIDEO, AUDIO)
  mimeType      String
  fileSize      Integer (bytes)
  sourceType    Enum(UPLOAD, GOOGLE_DRIVE)
  sourceUrl     String?
  thumbnailUrl  String?
  tags          String[]
  uploadedAt    DateTime
}
```

#### Test Response
```
TestResponse {
  id            UUID PK
  testId        UUID FK → Test
  userId        UUID FK → User
  isFlagged     Boolean (default false)
  flagReasons   String[]
  pointsEarned  Integer
  startedAt     DateTime
  completedAt   DateTime
  totalTimeSeconds Integer
}
```

#### Answer
```
Answer {
  id              UUID PK
  responseId      UUID FK → TestResponse
  questionId      UUID FK → Question
  selectedOptions UUID[] (FK → QuestionOption, for select types)
  ratingValue     Integer? (for rating type)
  timeSpentSeconds Integer
}
```

#### Coupon (NEW — Rewards Catalog)
```
Coupon {
  id            UUID PK
  title         String
  description   String?
  imageUrl      String?
  pointsCost    Integer
  isActive      Boolean (default true)
  displayOrder  Integer
  createdAt     DateTime
  updatedAt     DateTime
}
```

### 13.5 Rate Limiting
- Basic rate limiting on all API endpoints.
- Auth endpoints: stricter limits (e.g., 5 requests/minute for login).
- General endpoints: 60 requests/minute per user.
- Implementation: Fastify rate-limit plugin.

---

## 13. MVP Scope — In vs. Out

### In Scope (MVP)
- Evaluator self-registration (email + Google OAuth)
- Sign out for both evaluator and admin apps
- Mandatory demographic profile (specific age via dropdown, gender, searchable country/city dropdowns)
- Admin test creation with media library
- Google Drive folder import
- Bulk media upload: multi-file select + drag-and-drop
- 4 question types: single select, multi select, rating, ranking (no free-text/open-ended type)
- System-provided templates (skeletons)
- Test lifecycle: Draft → Active → Paused → Closed, with explicit Pause/Deactivate and Close controls on active tests
- Live option-choice report viewable while a test is Active and after it is Closed
- Auto-assign next test to evaluator
- One question per page, free navigation, must complete in one session
- Anti-cheat: speed check, attention checks (auto + manual), duplicate trap questions
- Flag + exclude invalid responses, withhold rewards
- Points-based reward system (auto-calculated, no real payout)
- Admin dashboard with overview stats
- Test results with aggregation + demographic breakdowns
- Admin test preview mode
- Backend media proxy
- Responsive design (mobile + desktop equal priority)
- Basic rate limiting
- JWT httpOnly cookie auth

### Out of Scope (Post-MVP)
- Real payment/withdrawal integration
- Coupon redemption/purchase execution (catalog browsing is in scope, see §10.2a — spending points on an item is not)
- S3/GCS storage + CDN delivery
- Email/push notifications
- Detailed transaction history
- Advanced anti-cheat (behavioral analysis, ML-based detection)
- Admin-defined custom templates
- Conditional branching / skip logic
- Test cloning
- Full user management (ban/suspend)
- Detailed evaluator profiles (education, income, etc.)
- Redis caching layer
- i18n / multi-language support
- OAuth connect for Google Drive (browse files in-app)
- Quota-based demographic targeting
- CSV/Excel export of raw results

---

## 14. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Architecture | Production-ready from day one. Scalable design even for MVP. |
| Response Time | API responses < 500ms for standard endpoints. |
| Media Load | Media proxy should cache aggressively. First load < 3s for images. |
| Security | OWASP Top 10 compliance. Input validation on all endpoints. CSRF protection. |
| Code Quality | TypeScript strict mode. Shared types across apps. Linting (ESLint) + formatting (Prettier). |
| Testing | Unit tests for anti-cheat logic and reward calculation. Integration tests for auth flow. |
| Accessibility | WCAG 2.1 AA for evaluator-facing UI. |

---

## 15. Mobile App (Evaluator) — Swipe Experience

### 15.1 Vision & Scope
- A native mobile app for **evaluators only** (admin remains web-only). Reframes test-taking as a continuous, social-media-style swipeable feed instead of a paginated question-by-question flow.
- Same test/question/media data model, same admin panel, same test pool as the web evaluator app — mobile is a new presentation and interaction layer on the existing backend, not a separate content system. An admin creates one test; it can be taken on web or mobile.

### 15.2 Platform & Tech Stack
- **React Native + Expo** (managed workflow), TypeScript, added as a new `apps/mobile` package in the existing pnpm/Turborepo workspace. Targets iOS and Android from one codebase.
- Shares `packages/shared` (Zod schemas, types, constants) with the web apps and API. `packages/ui` (Tailwind/web components) is not reusable as-is; mobile gets its own component set (optionally via `nativewind` to keep the same design-token vocabulary).
- Navigation: `expo-router`.
- Gestures/animation: `react-native-gesture-handler` + `react-native-reanimated` for swipe/drag card mechanics.
- Media: `expo-image` (caching, preloading) and `expo-av`/`expo-video` for video/audio cards.
- Auth token storage: `expo-secure-store`.
- Data fetching/caching: `@tanstack/react-query` against the existing Fastify API.
- Distribution: App Store + Google Play; OTA updates via Expo for JS-only changes.

### 15.3 Per-Question-Type Interaction Design
- **Single Select — 2 options:** Full-screen card; swipe right = first option, swipe left = second option (A/B comparison).
- **Single Select — 3+ options:** Swipe can't express more than two directions reliably. The card is shown with a tappable option list docked below it instead of swipe-to-choose.
- **Multi Select:** Each option becomes its own card in a mini sub-deck (rather than one grid screen as on web). Swipe right = include, swipe left = skip. Respects the question's configured min/max selections; the sub-deck advances to the next question once exhausted.
- **Rating:** The card is dragged toward one of 5 targets stacked vertically on the **right edge** of the screen, ordered top→bottom as **1→5**. Targets are small dots/pills that enlarge as the dragged card approaches (magnetic proximity feedback) and reveal their number once large enough. Releasing over a target commits that rating immediately and advances to the next card.
- **Ranking (3–5 items):** Same drag-to-slot mechanic as Rating, reused for consistency: N numbered slots (1→N, best→worst) are stacked on the right edge; each item is its own card, dragged one at a time onto an open slot. Once a slot is filled it's no longer a valid drop target for the remaining cards, so the interaction self-enforces a strict ordering. The question completes once every item has been placed.
- **Cross-cutting:**
  - A visible Back control recalls the previous card in its unanswered state; the evaluator swipes/drags again to give a new answer, then the deck resumes forward automatically. One step of recallable history is sufficient for v1.
  - The active card shows 1–2 next cards peeking behind it (Tinder-style stack depth) to reinforce the continuous-feed feel.
  - **First-run gesture tutorial:** swipe-left/right needs no explanation, but drag-to-target (Rating/Ranking) is a novel gesture. The evaluator's first-ever Rating card and first-ever Ranking card show a brief one-time animated hint before the interaction becomes active, tracked locally on-device (not server state) so it never repeats. Unexplained novel gestures risk confused/careless answers, which directly undermines §15.8's quality signal.
  - **Safe area:** the right-edge target column (Rating/Ranking) is laid out inside the device's safe area, not raw screen edges — clear of the iPhone notch/Dynamic Island and home-indicator strip, and of the Android gesture-navigation bar. See §16.7.
- **Known issues from Phase 10 field testing, to fix in Phase 12 (see plan.md §12.1):**
  - The two-option comparison card only shows about half of each photo (the card is split into two side-by-side halves, each cropped to fit) — the evaluator needs a way to see an option's full photo, not just the cropped half, before choosing it.
  - The next-card peeking behind the active one (previous bullet) keeps its prompt/caption text legible enough to visually mix with the active card's own text, reading as cluttered rather than a clean stack.
  - The Ranking card gets stuck after its first photo is dragged onto a slot — the next photo in the sub-deck doesn't reliably take over the card, leaving the rest of the ranking unreachable. Filled slots also show only a rank number, not the photo that was placed there, and there's no way to revise a single placement short of the outer Back control discarding the whole ranking.
- **Known issues from Phase 15 field testing, to fix in Phase 16 (see plan.md §16.1–16.2, §16.9):**
  - Ranking's hold-and-swap gesture (15.6) only animates the card being held; the slot it's dragged over has no proximity/scale reaction the way drag-to-place already does elsewhere in the same card.
  - Advancing from one question to the next has no transition — the incoming card snaps straight from its peeking position to active with no motion.
  - Reclaiming a placed Ranking card (tap a filled slot) and placing a card into a slot both snap instantly with no transition in either direction.

### 15.4 Feed Structure — Continuous Cross-Test Feed
- The evaluator does not pick a test from a list; cards from the current test keep coming until it's finished, TikTok-feed style. Entry is a single **Start** button on the Dashboard tab (§15.9a) — tapping it resolves and enters the next eligible test directly, with no test-picking screen in between (plan.md Phase 16.5). An explicit exit control inside the feed returns to the Dashboard at any point, mid-test or between tests, without losing in-progress answers.
- A small counter (top-left) shows how many questions remain before the current test's reward is earned; each answered card decrements it via a small popup.
- Shortly before the current test's last question, the client calls `GET /evaluator/next-test` in the background and, if one is returned, prefetches it (`GET /evaluator/tests/:id` + its first media) so the feed can continue into it with no loading gap.
- When the counter reaches zero: a "test complete — you earned X points" popup appears, then the feed continues seamlessly into the prefetched next test, or ends with an empty/"come back later" state if none is available.
- Progress within the current test is shown as **Instagram-Stories-style thin segmented bars** across the top, one segment per question, resetting when a new test begins.

### 15.5 Reward Model
- Rewards stay **test-based, not per-card**, matching the existing backend: `POST /evaluator/tests/:id/submit` fires once, in the background, as the test's last card is answered (answers are collected client-side across the swipe session as today), and the completion popup shows the returned `pointsEarned`.
- No per-card point feedback in v1 — the "questions remaining" counter is the only mid-test feedback signal. Points redemption (coupons/shop) is a future phase, not v1 (see §15.9).
- **Submission resilience:** since the whole reward loop hinges on one background `submit` call succeeding at the exact moment a phone is most likely to drop connection or get backgrounded, answers (and a finished-but-unconfirmed submission) are persisted on-device as the evaluator progresses, not just held in memory. A failed submit retries with backoff, including on next app launch, and the persisted payload is only cleared once the server confirms success. An evaluator never silently loses earned points to a dropped connection.

### 15.6 Visual Design Language
- Dark-first, calm/premium personality (Linear/Arc/Things reference) carrying a deliberately energetic accent color independent of the web app's indigo brand, with pronounced, characterful motion on the core swipe/drag/rating interactions. This is deep enough to warrant its own section — see **§16 Mobile Design System** for the full palette, typography, motion, and component spec.

### 15.7 Authentication
- The existing API only authenticates via httpOnly cookies (`access_token` / `refresh_token`), which a React Native client cannot rely on the way a browser does.
- `authenticateUser` middleware is extended to also accept an `Authorization: Bearer <token>` header, in addition to the cookie (cookie path unchanged — web apps unaffected).
- `/auth/login`, `/auth/register`, and `/auth/refresh` additionally return the access/refresh tokens in the JSON body (on top of setting cookies) so the mobile app can store them in `expo-secure-store` and drive its own refresh cycle.

### 15.8 Quality Control on Mobile
- Attention checks, trap-duplicate consistency checks, and the session-speed check run **unchanged, server-side** (`qualityService.runChecks`) — they operate on submitted answers and timings, not on the UI that produced them.
- `minTimePerQuestion` is configured per test as today; for swipe-paced tests it needs a much smaller value than the current 60s default, or the speed check fires on every honest completion.
- **Planned (future) refinement, not required for v1:** replace the flat per-test `minTimePerQuestion` with a computed per-question minimum (roughly `advisoryTimeMin ÷ 4`, exact formula still TBD) summed into the test's total minimum time — invisible to the evaluator, evaluated only server-side. Repeated speed-check failures (3–4 times) and/or a consistency/trap-check failure would withhold that test's reward. Needs its own design pass before implementation.
- **Device-based multi-account guard:** a points-for-answers economy invites farming via multiple fake accounts, which web can't detect beyond email/Google-ID uniqueness. Mobile registration additionally sends a device identifier; a repeat-device signup is flagged for review (not hard-blocked, to avoid false positives on shared/family devices) rather than silently trusted. See plan.md Phase 9.5.

### 15.8a Forced Update on New Question Types
- The question-type set grows over time (Ranking now, more later). An old app build that doesn't know how to render a new `QuestionType` must never silently break or crash mid-feed. On launch, the app checks a server-provided minimum supported version; a build below it sees a non-dismissible update screen linking to the store, with no partial access to the feed. Whenever a new question type ships, the enforced minimum version is bumped as part of that rollout. See plan.md Phase 9.6.

### 15.9 Auth Screens & Account / Profile
- **Entry screen:** classic email/password login + register, with **Google sign-in surfaced as a primary, equally-prominent option** (not buried) — front-loading it now avoids a disruptive migration later. Reuses the existing `/auth/google` web OAuth flow via an in-app browser (`expo-web-browser`/`expo-auth-session`), landing back in the app authenticated.
- **Registration:** email/password or Google, followed by the demographic profile-onboarding step (existing `evaluatorProfileSchema` fields). Requires an **18+ age gate** — a self-declared **"I confirm I am 18 or older" checkbox** at registration (not a numeric age field; the number was never persisted from this step anyway, so a boolean confirmation replaces it — plan.md Phase 16.8), sidestepping the unresolved Turkish Civil Code question of whether a minor can validly consent rather than trying to answer it (see `kvkk-compliance-research.md` §5). The actual demographic `age` integer is collected once, separately, during profile-onboarding (unaffected by this change). This in-app gate is independent of the store's own age-rating/content questionnaire (App Store Connect / Google Play IARC) — those should be answered honestly based on actual app content, which has no mature themes by design and should land well below an 18+ store rating (`appstore-playstore-compliance-research.md` §5).
- **Password confirmation & visibility:** registration requires a matching "Confirm password" field, and every password field (both on registration, plus login's) has a show/hide eye-icon toggle (plan.md Phase 16.8).
- **KVKK — two separate steps, not one checkbox** (revised after `kvkk-compliance-research.md`; supersedes the earlier single-checkbox plan). Kurul İlke Kararı 2026/347 (18.02.2026) explicitly prohibits merging or nesting the disclosure notice and the consent action:
  1. **Aydınlatma Metni acknowledgment** — a dedicated screen showing the full Article 10 disclosure text (identity of the veri sorumlusu, processing purposes, who data may be transferred to and why — explicitly including that account data may be processed via Google LLC infrastructure — collection method/legal basis, and Article 11 rights). This is **not phrased as consent or approval**; it's a read confirmation, shown before or during registration, recorded as `User.aydinlatmaAcknowledgedAt`.
  2. **Açık rıza checkbox — separate, narrowly scoped, and only where actually needed.** Per the research, most of TESTx's processing (account creation, the demographic profile needed for test matching) plausibly rests on Article 5(2)(c) contract-performance and should **not** be wrapped in a consent checkbox — bundling consent onto data that doesn't need it is itself the violation the Kurul fined in kararı 2021/389. Since the avatar is now a **preset picker, not a photo upload** (no user photographic data collected — see below), the one remaining realistic candidate for an actual açık rıza checkbox is, pending legal confirmation, the **cross-border transfer to Google** (unresolved — see the note below). It's plausible v1 needs no açık rıza checkbox at all if that question resolves in TESTx's favor; don't build one speculatively. Recorded as `User.acikRizaAcceptedAt` when applicable (see §12.4).
  - Scoped to mobile registration only for v1, web is untouched unless asked for separately.
  - **Open item, needs counsel before shipping:** whether Google OAuth/Drive's use requires its own açık rıza under Article 9(6)(a) is unresolved — the research found no Kurul decision covering third-party use of Google's infrastructure, and OAuth login is a continuous/routine dependency, not the "occasional/rare" transfer Article 9(6)'s exceptions are meant for. See `kvkk-compliance-research.md` §4.
  - **Not yet drafted:** the actual Aydınlatma Metni and Açık Rıza Metni content, plus a general Gizlilik Politikası / Kullanım Şartları — none of these exist in the repo yet. This research gives the legal skeleton; final text needs a KVKK-experienced lawyer's sign-off before launch.
- **Profile screen:** every `EvaluatorProfile` field is editable post-registration (age, gender, country, city, languages, occupation, education, AI-usage fields, **hobbies — see below**) via `PUT /evaluator/profile`, plus an **avatar picker** — no photo upload; the evaluator chooses one of **8–10 preset avatar images bundled with the app** (illustrated/generic, not user photos). Stored as `User.avatarId` (a small integer/key identifying which bundled preset was chosen, see §12.4), not a URL — there is no upload endpoint and no user-submitted photographic data at all. Fields that are actually optional in `evaluatorProfileSchema` (city, native language, occupation) are labeled as such in the UI (e.g. "City (Optional)"), not just hinted via placeholder text (plan.md Phase 16.6).
- **Hobbies (NEW, optional):** a predecided list the evaluator picks up to 5 from (plan.md Phase 16.7) — shown as a skippable step during profile-onboarding and editable anytime afterward from the Profile tab. Not used for demographic test-filtering in v1; purely a profile field.
- **Logout:** standard, clears the stored `expo-secure-store` tokens and returns to the entry screen. Reachable from the **Settings** tab (see §15.9a), not the Profile screen — separating "edit who I am" from "account-level actions."
- **Account deletion (required for store submission, not optional):** Apple Guideline 5.1.1(v) and Google Play's account-deletion policy both mandate genuine in-app, self-service account deletion the moment an app supports account creation — deactivation/sign-out alone does not satisfy either, and there is no MVP exception (`appstore-playstore-compliance-research.md` §3). A discoverable "Delete Account" action, with confirmation, calls a `DELETE /users/me` backend endpoint; Google Play additionally requires a web-reachable deletion-request path outside the app. This is a hard pre-submission blocker, not a nice-to-have. Lives under the **Settings** tab (see §15.9a), alongside sign out.

### 15.9a Navigation — Bottom Tab Bar
- Four persistent tabs, replacing the earlier ad hoc stack-of-screens-plus-footer-buttons pattern (plan.md Phase 16.4):
  - **Dashboard** — balance/status and the single Start button (§15.4).
  - **Shop** — the rewards/coupon catalog (§15.10).
  - **Profile** — demographic fields, avatar picker, hobbies.
  - **Settings** — sign out, delete account, and any future account-level actions.
- Auth screens, onboarding, and the feed itself are not part of the tab bar — the feed in particular hides tab chrome while a test is in progress.

### 15.10 Rewards / Shop Screen
- A screen listing the admin-managed coupon catalog (§10.2a / §11.4): card grid or list, each item showing image, title, point cost, and the evaluator's current balance for comparison.
- Tapping an item's redeem action shows a **"Coming Soon"** state (mirrors the existing Withdraw pattern in §10.2) — no points move in v1.

### 15.11 Explicitly Deferred (Future Phases)
- Push notifications for new/available tests (Expo Notifications).
- The actual coupon redemption/purchase action (catalog browsing itself is in scope — see §15.10 and §10.2a).
- The smarter per-question minimum-time algorithm described in §15.8.
- KVKK consent on the web registration flow (mobile-only for v1, per explicit decision).

---

## 16. Mobile Design System

> Opened as its own section because the mobile app is explicitly not meant to look like a generic/default React Native app. Values below are a concrete starting point, not fixed in stone — tune freely, but keep the *system* (one accent, restrained neutrals, deliberate motion) intact.

### 16.1 Design Personality
- Calm/premium base (Linear, Arc, Things reference) — restrained neutral surfaces, generous negative space, thin 1px hairlines instead of heavy borders/shadows — carrying one deliberately energetic, mobile-specific accent color used sparingly. Reads as premium at rest, alive in motion.
- Deliberately distinct from the web app's indigo brand identity (§15.2, §15.6) — the mobile app earns its own mark rather than inheriting the web one.

### 16.2 Color Palette (starting point — tunable)
Dark-first; no light theme in v1 (§16.7).

| Token | Value | Usage |
|---|---|---|
| `surface-base` | `#0B0B0E` | App background — near-black graphite, not pure black (avoids OLED smear during fast motion) |
| `surface-raised` | `#17171C` | Cards, sheets, modals |
| `surface-overlay` | `#1F1F26` | Popups, target pills at rest |
| `border-hairline` | `#2A2A31` | 1px dividers, static chrome edges (cards themselves stay borderless — see §16.6) |
| `text-primary` | `#F5F5F7` | Prompts, primary content |
| `text-secondary` | `#9B9BA6` | Meta, counters, secondary labels |
| `accent` | `#FF5A36` (vivid coral/flame) | Primary CTA, armed target highlight, progress-bar fill, brand accent |
| `accent-contrast` | `#0B0B0E` | Text/icons drawn on top of `accent` |
| `success` | `#33C481` | Right-swipe / "include" confirmation flash |
| `danger` | `#FF4D6A` | Left-swipe / "skip" confirmation flash |

Rationale: one saturated accent against near-black neutrals is the same formula Arc/Linear use for "premium but alive." `success`/`danger` get their own hues, distinct from `accent`, so swipe direction never depends on remembering "accent = good."

### 16.3 Typography
- **System fonts only** — SF Pro (iOS) / Roboto (Android) via React Native defaults, no custom font loading, per your decision.
- Type scale (echoes the web app's existing scale in `packages/config/tailwind/preset.ts` so both identities share a rhythm despite different fonts):

| Role | Size / Line-height | Weight |
|---|---|---|
| Prompt / question title | 22 / 28 | 700 |
| Section label | 15 / 20 | 600 |
| Body / option label | 15 / 22 | 500 |
| Meta / counter (uppercase, +0.04em tracking) | 12 / 16 | 600 |
| Stat (points, big numbers, tabular figures) | 28 / 32 | 700 |

### 16.4 Motion Language
"Belirgin ve karakterli" (pronounced and characterful) — motion is a primary trait here, not decoration.
- Spring-based (`react-native-reanimated` `withSpring`), never linear/ease timing, for every gesture-driven transition.
- **Card commit** (swipe/drag past threshold): fast fly-off in the release direction (~220ms), slight rotation scaled to drag velocity.
- **Card reject** (released short of threshold): spring back to center with a small overshoot.
- **Rating/Ranking target proximity:** pill scales continuously from ~0.6× to ~1.15× as the card approaches, plus a light haptic tick (`expo-haptics`) at the exact moment it crosses the commit threshold.
- **Test-complete popup:** scale + fade in with spring overshoot; a small pulse on the points number.
- Every spring above collapses to an instant/short fade under Reduced Motion (§16.7) — motion is never the *only* carrier of a state change.

### 16.5 Iconography & Imagery
- Line icons, 1.5px stroke, matching the hairline weight used elsewhere. Same icon family as the web apps (`lucide-react` → `lucide-react-native`) for visual continuity where icons are shared (back, close, check).
- Media (photo/video) is always full-bleed within its card — crop, don't shrink — to keep the feed feeling continuous rather than boxed.

### 16.6 Component Patterns
- **Card:** 20px rounded corners, no border; elevation via a soft dark shadow only. Cards float — hairlines are reserved for static chrome, never the card itself.
- **Target pill (Rating/Ranking):** `surface-overlay` at rest; `accent` border + fill once "armed" (card within capture radius); its number fades in only once the pill is large enough to read.
- **Progress segments:** 2px bars, `surface-overlay` track, `accent` fill, 2px gaps.
- **Counter chip (top-left):** `surface-raised` pill, `text-secondary` label + `text-primary` number, quick scale-pulse on decrement.
- **Empty / error states:** accent-tinted line icon + `text-secondary` copy, custom-built — never a bare native `Alert`.

### 16.7 Accessibility & Constraints
- Dark-only in v1 (explicit scope decision — no light theme; revisit later if requested).
- Minimum 44×44pt touch target on every tappable element, including target pills at rest size.
- Every swipe/drag interaction has a tap-based fallback (Phase 12, plan.md) — full functionality stays reachable without any gesture, both for accessibility and for the OS-level "Reduce Motion" setting.
- `text-primary`/`text-secondary` against `surface-base`/`surface-raised` meet WCAG AA at their defined sizes.
- All edge-anchored chrome (the Rating/Ranking target column in particular) respects the device safe area (`react-native-safe-area-context`) — verified on a notched iPhone and a gesture-nav Android device, not just default-inset simulators.
