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

---

## 4. Demographic System

### 4.1 MVP Fields (Mandatory for Evaluators)

| Field | Type | Details |
|-------|------|---------|
| Date of Birth | Date | Used to compute age. Stored as DOB, age calculated dynamically. |
| Gender | Enum | Male, Female, Other, Prefer not to say. |
| Country | String | Dropdown from ISO 3166 country list. |
| City | String | Free text or autocomplete based on selected country. |

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

#### 5.3.4 Free Text
- Evaluator types an open-ended response.
- Admin configures: optional character limit (min/max).
- UI: Text area.

### 5.4 Media per Question
- All options within a single question must be the **same media type** (all photos, all videos, etc.).
- Supported types: Image (JPEG, PNG, WebP), Video (MP4, WebM), Audio (MP3, WAV, OGG), Text (plain string).
- One question can have 2–10 media options for selection types.

---

## 6. Media Management

### 6.1 Media Library
- Central repository where Admin uploads/imports media before attaching to questions.
- Media items have: file name, type, size, upload date, tags (optional), thumbnail (auto-generated for video/audio).
- Admin can browse, search, filter, and select media from the library when building questions.

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

---

## 8. Evaluator Experience

### 8.1 Dashboard
- **Auto-assigned test:** Prominent "Start Next Test" button. System picks the next eligible test.
- **Points balance** displayed.
- **Withdraw button** with "Coming Soon" label.
- If no tests available: friendly empty state ("No tests available right now. Check back later.").

### 8.2 Test-Taking Flow
1. Evaluator clicks "Start Next Test."
2. System selects the next eligible test (based on demographics, not already taken, within response cap).
3. Test intro screen: title, description, estimated time, number of questions.
4. One question per page with progress bar (e.g., "Question 3 of 12").
5. **Free navigation:** Back and Next buttons. Evaluator can revisit and change answers.
6. **Must complete in one session.** If they leave, progress is lost.
7. Advisory timer shown (estimated time remaining).
8. Final review/submit screen.
9. On submit: show success + points earned.

### 8.3 Responsive Design
- Equal priority for mobile and desktop.
- Media cards adapt: grid on desktop, vertical stack on mobile.
- Touch-friendly controls for mobile (large tap targets for selection).

---

## 9. Quality Control & Anti-Cheat

### 9.1 Minimum Time Per Question
- **Global default:** 60 seconds per question.
- If evaluator spends less than the threshold on a question, that response is **flagged**.
- Admin can **disable** the time check per test (set threshold to 0).
- Time is tracked per question (recorded as `timeSpentSeconds` per answer).

### 9.2 Attention-Check Questions
- **System auto-generated:** Platform inserts questions like "Select the third option" or "Choose the red image" at random positions.
- **Admin manual:** Admin can add custom attention-check questions and mark them as such.
- Attention checks are **not counted** in the evaluator's visible question count.
- Wrong answer on attention check → entire response **flagged**.

### 9.3 Consistency Checks (Trap Questions)
- A question appears again later in the test (duplicate with same options, potentially reordered).
- If the evaluator gives a **different answer** to the duplicate, the response is **flagged**.
- Admin marks which questions should be duplicated as traps when creating the test.
- System can also auto-insert one duplicate if the test has 8+ questions.

### 9.4 Flagging Behavior
- Flagged responses are **excluded from results** (not counted in aggregation).
- Flagged responses **do not earn rewards** (points withheld).
- Evaluator is **not notified** that their response was flagged.
- Admin can see flagged response count per test in the results view.

---

## 10. Reward System

### 10.1 Points Model
- Evaluators earn **points** for valid (non-flagged) test completions.
- Reward amount is **auto-calculated** based on test characteristics:
  - Base formula: `points = (number_of_questions × question_weight) + time_bonus`
  - `question_weight`: varies by type (e.g., media comparison = 2 pts, free text = 3 pts, rating = 1 pt).
  - `time_bonus`: additional points if estimated completion time > 5 minutes.
- Points are displayed as a numeric balance on the evaluator dashboard.

### 10.2 Withdraw / Cash-Out
- "Withdraw" button on the evaluator dashboard.
- Clicking shows a **"Coming Soon"** message with informational text.
- **Post-MVP:** Real payment integration (PayPal, bank transfer, gift cards).

### 10.3 Balance Display
- Evaluator dashboard shows **total accumulated balance** (points).
- No itemized transaction history for MVP.
- **Post-MVP:** Detailed transaction log.

---

## 11. Admin Dashboard & Analytics

### 11.1 Admin Dashboard (Overview)
- **Total Evaluators:** Count of registered evaluators.
- **Active Tests:** Count of tests in Active status.
- **Total Responses:** Count of all submitted responses across all tests.
- **Flagged Responses:** Count of quality-flagged responses.

### 11.2 Test Results View
- Per-question result aggregation:
  - **Selection questions:** Bar/pie chart showing option distribution (e.g., "Photo A: 62%, Photo B: 38%").
  - **Rating questions:** Average score, distribution histogram.
  - **Free text:** List of responses (paginated).
- **Demographic breakdowns:** Filter/segment results by age group, gender, location.
  - Example: "Males 18–25: 70% chose Photo A. Females 26–35: 55% chose Photo B."
- **Response metadata:** Total responses, valid responses, flagged count, average completion time.

### 11.3 User Management (Minimal)
- View list of registered evaluators (name, email, registration date, total tests completed).
- **No ban/edit capability for MVP.**
- **Post-MVP:** Full user management (ban, suspend, view response history).

---

## 12. Technical Architecture

### 12.1 Monorepo Structure (Turborepo + pnpm)

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

### 12.2 Tech Stack Summary

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

### 12.3 API Design

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
| PUT | `/admin/tests/:id/status` | Change test status (activate, pause, close) |
| GET | `/admin/tests/:id/preview` | Get test in preview mode |
| GET | `/admin/tests/:id/results` | Get aggregated results |
| GET | `/admin/tests/:id/results/demographics` | Results segmented by demographics |
| GET | `/admin/media` | List media library |
| POST | `/admin/media/upload` | Direct file upload |
| POST | `/admin/media/import-drive` | Import from Google Drive folder |
| DELETE | `/admin/media/:id` | Remove media from library |
| GET | `/admin/users` | List evaluators |
| GET | `/admin/templates` | List available templates |

### 12.4 Database Schema (Key Entities)

#### Users
```
User {
  id            UUID PK
  email         String UNIQUE
  passwordHash  String?
  googleId      String?
  role          Enum(EVALUATOR, ADMIN)
  isVerified    Boolean
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### Evaluator Profile
```
EvaluatorProfile {
  id          UUID PK
  userId      UUID FK → User
  dateOfBirth Date
  gender      Enum(MALE, FEMALE, OTHER, UNDISCLOSED)
  country     String
  city        String?
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
  type          Enum(SINGLE_SELECT, MULTI_SELECT, RATING, FREE_TEXT)
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
  textValue       String? (for free text type)
  timeSpentSeconds Integer
}
```

### 12.5 Rate Limiting
- Basic rate limiting on all API endpoints.
- Auth endpoints: stricter limits (e.g., 5 requests/minute for login).
- General endpoints: 60 requests/minute per user.
- Implementation: Fastify rate-limit plugin.

---

## 13. MVP Scope — In vs. Out

### In Scope (MVP)
- Evaluator self-registration (email + Google OAuth)
- Mandatory demographic profile (age, gender, country/city)
- Admin test creation with media library
- Google Drive folder import
- 4 question types: single select, multi select, rating, free text
- System-provided templates (skeletons)
- Test lifecycle: Draft → Active → Paused → Closed
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
