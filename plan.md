# TESTx — Development Plan (2-Day Sprint)

**Target:** Fully functional MVP demo in 2 days
**Reference:** [prd.md](prd.md)

---

## Phase 0: Project Scaffolding (Day 1 — First 2 Hours)

### 0.1 Monorepo Setup
- Initialize Turborepo with pnpm workspaces
- Create directory structure:
  ```
  testx/
  ├── apps/evaluator/    (Next.js App Router)
  ├── apps/admin/        (Next.js App Router)
  ├── apps/api/          (Fastify)
  ├── packages/shared/   (types, constants, validation schemas)
  ├── packages/database/ (Prisma schema, seed)
  ├── packages/ui/       (shared shadcn/ui components)
  └── packages/config/   (tsconfig, eslint, tailwind presets)
  ```
- Configure `turbo.json` with build/dev/lint pipelines
- Configure `pnpm-workspace.yaml`
- Set up TypeScript strict mode in shared tsconfig
- Set up ESLint + Prettier config in `packages/config`
- Set up Tailwind CSS config with shadcn/ui for both frontend apps
- Initialize shadcn/ui in `packages/ui` with base components: Button, Input, Card, Dialog, Select, Badge, Table, Avatar, Progress

### 0.2 Database Setup
- Install PostgreSQL locally (or Docker container)
- Create Prisma schema in `packages/database` with **all entities**:
  - `User` (id, email, passwordHash, googleId, role, isVerified, timestamps)
  - `EvaluatorProfile` (id, userId, dateOfBirth, gender, country, city, balance, timestamps)
  - `Test` (id, title, description, status, responseCap, advisoryTimeMin, minTimePerQuestion, demographicFilters, rewardPoints, timestamps)
  - `Question` (id, testId, type, prompt, mediaType, order, config, isAttentionCheck, isTrapDuplicate, trapSourceId, timestamps)
  - `QuestionOption` (id, questionId, label, mediaId, order)
  - `Media` (id, fileName, fileType, mimeType, fileSize, sourceType, sourceUrl, thumbnailUrl, tags, uploadedAt)
  - `TestResponse` (id, testId, userId, isFlagged, flagReasons, pointsEarned, startedAt, completedAt, totalTimeSeconds)
  - `Answer` (id, responseId, questionId, selectedOptions, ratingValue, textValue, timeSpentSeconds)
  - `Template` (id, name, description, structure JSON, isSystem, timestamps)
- Add indexes: `User.email`, `TestResponse(testId, userId)` unique, `Question.testId+order`, `Test.status`
- Run `prisma migrate dev`
- Create seed script with: 1 admin user, sample evaluators, sample test with questions, sample media entries, system templates

### 0.3 Fastify API Bootstrap
- Initialize Fastify app in `apps/api`
- Configure: CORS (allow both frontend origins), cookie parser, rate limiting (`@fastify/rate-limit`), multipart upload (`@fastify/multipart`)
- Set up Prisma client as Fastify plugin (singleton)
- Set up route structure with Fastify's prefix-based registration:
  ```
  /auth/*
  /evaluator/*
  /admin/*
  /media/*
  ```
- Error handling plugin (consistent JSON error responses)
- Request validation with Zod (via `packages/shared` schemas)

### 0.4 Next.js Apps Bootstrap
- Initialize both Next.js apps with App Router
- Configure Tailwind + shadcn/ui (import from `packages/ui`)
- Set up auth context/provider (cookie-based, check `/auth/me` on load)
- Set up API client utility (`fetch` wrapper with cookie credentials)
- Set up layout shells:
  - **Evaluator:** Simple layout with top navbar (logo, balance, profile avatar)
  - **Admin:** Sidebar layout (Dashboard, Tests, Media Library, Users, Templates)
- Environment variables: `API_URL` pointing to Fastify dev server

---

## Phase 1: Authentication System (Day 1 — Hours 2–4)

### 1.1 Backend Auth
- **Password hashing:** bcrypt
- **JWT utilities:** Sign/verify access token (15min) + refresh token (7d)
- **Cookie helpers:** Set/clear httpOnly secure cookies with SameSite=Lax
- **Middleware:** `authenticateUser` — extracts JWT from cookie, attaches `user` to request. `requireRole(role)` — checks user role.
- **Endpoints:**
  - `POST /auth/register` — validate email/password, hash password, create User (role=EVALUATOR), send verification email (mock: just set isVerified=true), set cookies, return user
  - `POST /auth/login` — validate credentials, set cookies, return user
  - `POST /auth/logout` — clear cookies
  - `POST /auth/refresh` — validate refresh token, issue new access token
  - `GET /auth/me` — return current user + profile
  - `GET /auth/google` — redirect to Google OAuth consent screen
  - `GET /auth/google/callback` — exchange code for tokens, find/create user, set cookies, redirect to frontend
- **Google OAuth:** Use `googleapis` package. Configure OAuth2 client with client ID/secret from env.

### 1.2 Frontend Auth (Both Apps)
- **Auth provider/context:** On mount, call `/auth/me`. Store user state. Provide `login()`, `logout()`, `register()` methods.
- **Evaluator app pages:**
  - `/login` — Email/password form + "Sign in with Google" button
  - `/register` — Email/password form + "Sign in with Google" + redirect to onboarding
  - `/onboarding` — Demographic profile form (DOB date picker, gender select, country dropdown, city input). Calls `PUT /evaluator/profile`. Redirects to dashboard on completion.
- **Admin app pages:**
  - `/login` — Same auth UI, but on success check role=ADMIN, redirect to admin dashboard
- **Route guards:** Middleware or layout-level checks. Redirect unauthenticated users to login. Redirect evaluators without profile to onboarding.

### Phase 1 Exit Criteria

Before moving to Phase 2, all of the following must be true:

- [ ] `POST /auth/register` creates a user, sets httpOnly JWT cookies, and returns the user object
- [ ] `POST /auth/login` authenticates correctly and rejects invalid credentials with a 401
- [ ] `GET /auth/me` returns the current user when a valid cookie is present; returns 401 when not
- [ ] `POST /auth/logout` clears cookies and subsequent `/auth/me` returns 401
- [ ] Google OAuth flow completes end-to-end: click "Sign in with Google" → consent → land on evaluator dashboard
- [ ] Unauthenticated evaluator visiting `/dashboard` is redirected to `/login`
- [ ] Evaluator without a demographic profile is redirected to `/onboarding` after login
- [ ] Submitting the onboarding form saves age, gender, country, city and redirects to `/dashboard`
- [ ] Admin logging in to the admin app with role=EVALUATOR credentials is rejected / redirected
- [ ] Rate limit on `POST /auth/login` blocks after 5 rapid requests

---

## Phase 2: Media Library & Google Drive (Day 1 — Hours 4–6)

### 2.1 Media Library Backend
- `POST /admin/media/upload` — Accept multipart file upload. Validate type/size limits. Save file to local `uploads/` directory (or configurable path). Create Media record in DB. Return media object.
- `GET /admin/media` — List all media with pagination, filtering by type, search by filename. Return media list with metadata.
- `DELETE /admin/media/:id` — Soft delete or hard delete media file + DB record.
- `GET /media/:id/file` — **Proxy endpoint** (public, used by evaluator frontend). Serves the actual file. For uploaded files: stream from disk. For Drive files: fetch from Drive API and stream (with caching).

### 2.2 Google Drive Import
- `POST /admin/media/import-drive` — Accept folder URL. Parse folder ID from URL. Use Google Drive API (service account or API key) to list files in folder. For each file: create Media record with `sourceType=GOOGLE_DRIVE`, store Drive file ID in `sourceUrl`. Return imported count + media list.
- Drive file proxy: When `GET /media/:id/file` is called for a Drive-sourced media, fetch file from Drive API using stored file ID, cache locally on first access, serve from cache on subsequent requests.
- **Caching strategy:** File-based cache in `cache/media/` directory keyed by media ID. Check cache first, fetch from Drive on miss.

### 2.3 Admin Media Library UI
- **Media Library page** (`/media`):
  - Grid view of media items with thumbnails (image previews, video/audio icons)
  - Upload button → file picker dialog (accept images, video, audio)
  - "Import from Drive" button → modal with folder URL input → shows import progress → refreshes grid
  - Filter tabs: All, Images, Videos, Audio
  - Search bar (filename search)
  - Delete button per item (with confirmation dialog)
  - Each media card shows: thumbnail, filename, type badge, file size, upload date

### Phase 2 Exit Criteria

Before moving to Phase 3, all of the following must be true:

- [ ] `POST /admin/media/upload` accepts an image/video/audio file, saves it, and returns a media record with a valid proxy URL
- [ ] `GET /media/:id/file` serves the file correctly (Content-Type header matches, file loads in browser)
- [ ] Files exceeding size limits are rejected with a clear validation error (413 or 400)
- [ ] `POST /admin/media/import-drive` accepts a valid Google Drive folder URL and creates media records for all supported files in the folder
- [ ] Drive-sourced media is served through the proxy and cached on disk after first access
- [ ] `GET /admin/media` returns a paginated list filterable by type (image/video/audio)
- [ ] `DELETE /admin/media/:id` removes the record and the file (or Drive cache entry)
- [ ] Admin Media Library UI shows uploaded and Drive-imported files as thumbnailed cards
- [ ] Uploading a file via the UI updates the grid without a full page reload
- [ ] An invalid Drive folder URL shows a clear error message in the UI

---

## Phase 3: Test Creation (Admin) (Day 1 — Hours 6–10)

### 3.1 Test CRUD Backend
- `POST /admin/tests` — Create test (title, description). Default status=DRAFT. Auto-calculate reward points (initially 0, recalculated when questions are added).
- `GET /admin/tests` — List tests with pagination, filter by status. Return test list with question count and response count.
- `GET /admin/tests/:id` — Full test details with all questions and options (for editing).
- `PUT /admin/tests/:id` — Update test metadata (title, description, demographicFilters, responseCap, advisoryTimeMin, minTimePerQuestion).
- `DELETE /admin/tests/:id` — Only if status=DRAFT. Hard delete test + questions + options.
- `PUT /admin/tests/:id/status` — Change status. Validate transitions: DRAFT→ACTIVE, ACTIVE→PAUSED, PAUSED→ACTIVE, ACTIVE→CLOSED, PAUSED→CLOSED. On ACTIVE: auto-calculate and set `rewardPoints`.

### 3.2 Question CRUD Backend
- `POST /admin/tests/:id/questions` — Add question to test. Accept: type, prompt, mediaType, config, options (with media IDs or labels), isAttentionCheck, isTrapDuplicate + trapSourceId. Auto-set order.
- `PUT /admin/questions/:id` — Update question details.
- `DELETE /admin/questions/:id` — Remove question and reorder remaining.
- `PUT /admin/tests/:id/questions/reorder` — Accept new order array. Bulk update.

### 3.3 Reward Auto-Calculation
- Implement in `packages/shared/src/rewards.ts`:
  ```
  function calculateTestReward(questions: Question[]): number {
    const weights = { SINGLE_SELECT: 2, MULTI_SELECT: 2, RATING: 1, FREE_TEXT: 3 }
    let points = questions
      .filter(q => !q.isAttentionCheck && !q.isTrapDuplicate)
      .reduce((sum, q) => sum + weights[q.type], 0)
    // Time bonus: if estimated time > 5 min, add 5 extra points
    const estimatedMinutes = questions.length * 0.5
    if (estimatedMinutes > 5) points += 5
    return points
  }
  ```
- Recalculate and save `rewardPoints` on test whenever questions are added/removed/modified.

### 3.4 Templates Backend
- `GET /admin/templates` — Return list of system templates.
- Seed system templates:
  - **Photo Comparison:** 5 single-select questions with IMAGE media type
  - **Media Rating:** 5 rating questions (1–5 scale) with IMAGE media type
  - **Text Survey:** 5 single-select questions with TEXT options
- `POST /admin/tests/from-template/:templateId` — Create a new test pre-filled with the template's question structure. Status=DRAFT.

### 3.5 Test Preview Backend
- `GET /admin/tests/:id/preview` — Returns the test in the same format as `GET /evaluator/tests/:id` (evaluator view). Includes attention checks visibly marked. Does not require test to be ACTIVE.

### 3.6 Admin Test Creation UI
- **Test List page** (`/tests`):
  - Table view: title, status badge (color-coded), question count, response count, created date, actions
  - "Create Test" button → choose "Blank" or select a template
  - Status filter tabs: All, Draft, Active, Paused, Closed
  - Row actions: Edit (draft only), View Results, Change Status, Delete (draft only)

- **Test Editor page** (`/tests/[id]/edit`):
  - Top section: Title input, Description textarea, Settings panel (collapsible):
    - Demographic filters: age range slider, gender multiselect, country multiselect
    - Response cap input (optional)
    - Advisory time input (optional)
    - Min time per question toggle + input (default 60s)
  - Question list (drag-to-reorder with handle icons):
    - Each question card shows: order number, type badge, prompt text, option count, attention/trap badge
    - "Add Question" button → Question editor modal/drawer
  - **Question Editor (modal or inline):**
    - Type selector (single select, multi select, rating, free text)
    - Prompt input (text)
    - Media type selector (for select types): Image, Video, Audio, Text
    - Options list (for select types):
      - If media: "Pick from Library" button opens media picker modal (shows filtered library by selected media type)
      - If text: text inputs for each option
      - Add/remove option buttons
    - Config section (type-specific):
      - Multi select: min selections, max selections
      - Rating: min value, max value, min label, max label
      - Free text: min chars, max chars
    - Attention check toggle
    - Trap duplicate toggle + source question picker
  - Action buttons: Save Draft, Activate Test, Preview Test
  - Preview opens the test in evaluator-like view (new tab or modal)

### 3.7 Auto-Generated Attention Checks
- When admin activates a test, system logic checks if admin has added any attention checks.
- If none, system auto-inserts 1–2 attention check questions:
  - For image-based tests: "Select the image in position [N]" with the same images
  - For text-based tests: "Select option '[exact text]'" 
  - Inserted at random positions (not first or last)
- Store with `isAttentionCheck=true`, auto-generated flag in config JSON

### Phase 3 Exit Criteria

Before moving to Phase 4, all of the following must be true:

- [ ] Admin can create a test from scratch (blank) and from a system template; both land in DRAFT status
- [ ] All 4 question types (single select, multi select, rating, free text) can be added to a test with correct config saved
- [ ] Media options on select-type questions are chosen from the media library and their thumbnails render in the question card
- [ ] Question order can be changed via drag-to-reorder; new order persists after page refresh
- [ ] Attention-check toggle and trap-duplicate toggle save correctly and display the right badge on the question card
- [ ] `PUT /admin/tests/:id/status` correctly enforces state transitions and rejects invalid ones (e.g., CLOSED → ACTIVE returns 400)
- [ ] `rewardPoints` on a test is recalculated automatically when questions are added or removed
- [ ] Admin can preview a DRAFT test and see it rendered exactly as an evaluator would (question by question, one per page)
- [ ] Activating a test with no manually added attention checks auto-inserts at least one system attention-check question
- [ ] Test list shows correct status badges, question count, and response count (0 for new tests)
- [ ] DRAFT tests can be deleted; ACTIVE tests cannot

---

## Phase 4: Evaluator Test-Taking Flow (Day 2 — Hours 0–4)

### 4.1 Test Assignment Backend
- `GET /evaluator/next-test` — Core routing logic:
  1. Get evaluator's demographic profile
  2. Find all ACTIVE tests
  3. Filter: evaluator hasn't already responded (check TestResponse)
  4. Filter: test hasn't reached response cap
  5. Filter: evaluator matches demographic filters (age in range, gender match, location match). If no filters → include.
  6. Sort by: created date (oldest first) — FIFO fairness
  7. Return first match, or `null` if none available
  - Response: test metadata (title, description, question count, advisory time, reward points). NOT the full questions yet.

### 4.2 Test Taking Backend
- `GET /evaluator/tests/:id` — Return full test with all questions and options (media URLs resolved via `/media/:id/file`). Validate evaluator is eligible (same checks as next-test). Record `startedAt` timestamp (or the frontend sends it on submit).
- `POST /evaluator/tests/:id/submit` — Accept full response payload:
  ```json
  {
    "startedAt": "ISO timestamp",
    "answers": [
      { "questionId": "uuid", "selectedOptionIds": ["uuid"], "ratingValue": 4, "textValue": "...", "timeSpentSeconds": 15 }
    ]
  }
  ```
  - **Validation:**
    - Evaluator hasn't already submitted for this test
    - All non-attention-check, non-trap questions are answered
    - Selection counts within configured min/max
  - **Quality Control (run in order):**
    1. **Speed check:** For each answer, if `timeSpentSeconds < minTimePerQuestion` and minTimePerQuestion > 0 → add flag reason "SPEED_TOO_FAST"
    2. **Attention check:** For attention-check questions, verify answer matches expected correct answer → if wrong, add "ATTENTION_CHECK_FAILED"
    3. **Consistency check:** For trap duplicate questions, compare answer with the original question's answer → if different, add "CONSISTENCY_FAILED"
    4. If any flag reasons → set `isFlagged=true`
  - **Reward:** If not flagged → set `pointsEarned = test.rewardPoints` and increment evaluator's balance. If flagged → `pointsEarned = 0`.
  - **Save:** Create TestResponse + Answer records.
  - **Return:** Success + points earned (or 0).

### 4.3 Balance Endpoint
- `GET /evaluator/balance` — Return `evaluatorProfile.balance`.

### 4.4 Evaluator Dashboard UI
- **Dashboard page** (`/dashboard` — default after login):
  - Points balance card (prominent, top of page)
  - "Withdraw" button → modal with "Coming Soon — Cash-out will be available soon!"
  - "Start Next Test" button (large, centered, primary CTA)
    - On click: call `GET /evaluator/next-test`
    - If test available → navigate to test intro page
    - If null → show "No tests available right now. Check back later!"
  - Profile summary card (name, demographics) with "Edit Profile" link

### 4.5 Test-Taking UI
- **Test Intro page** (`/tests/[id]`):
  - Test title + description
  - Info cards: number of questions, estimated time, points to earn
  - "Begin Test" button → loads questions, starts timer

- **Question page** (`/tests/[id]/question/[n]`):
  - Progress bar (e.g., "3 / 12") at top
  - Advisory timer (countdown from estimated time, just informational, does not auto-submit)
  - Question prompt (large text)
  - **Single select:** Media grid (2–4 columns desktop, 1–2 mobile) or text radio list. Click to select, highlight selected.
  - **Multi select:** Same as single but checkbox/toggle style. Show selection count ("2 of 3 selected").
  - **Rating:** Star row or numbered button row. Click to set value.
  - **Free text:** Textarea with character counter if limits configured.
  - "Previous" button (disabled on first question) + "Next" button (disabled if no answer selected, except free text)
  - On last question: "Next" becomes "Review & Submit"
  - Track `timeSpentSeconds` per question (JS timer starts when question renders, pauses on navigate away)

- **Review page** (`/tests/[id]/review`):
  - Summary list: each question prompt + selected answer (thumbnail or text)
  - "Change" link per question → navigates back to that question
  - "Submit" button → calls `POST /evaluator/tests/:id/submit`
  - Loading state during submission

- **Completion page:**
  - Success animation/icon
  - "You earned X points!"
  - "Back to Dashboard" button

### 4.6 State Management for Test-Taking
- Use React context or Zustand store scoped to the test-taking session:
  - `answers: Map<questionId, AnswerData>`
  - `currentQuestionIndex: number`
  - `startedAt: Date`
  - `timePerQuestion: Map<questionId, number>`
- All stored in memory (no persistence — must complete in one session)
- On page unload/refresh: show browser confirmation dialog ("You will lose your progress")

### Phase 4 Exit Criteria

Before moving to Phase 5, all of the following must be true:

- [ ] `GET /evaluator/next-test` returns an eligible test for a matching evaluator and `null` for one who doesn't match demographics or has already responded
- [ ] `GET /evaluator/tests/:id` returns the full question list with resolved media proxy URLs; all media renders correctly on the question page
- [ ] Evaluator can navigate forward and backward through questions; previously selected answers are preserved when going back
- [ ] `timeSpentSeconds` is tracked per question on the frontend and included in the submission payload
- [ ] `POST /evaluator/tests/:id/submit` with answers below `minTimePerQuestion` sets `isFlagged=true` and `flagReasons` includes `SPEED_TOO_FAST`
- [ ] A wrong answer on an attention-check question sets `flagReasons` to include `ATTENTION_CHECK_FAILED`
- [ ] A different answer on a trap-duplicate question sets `flagReasons` to include `CONSISTENCY_FAILED`
- [ ] A valid (non-flagged) submission increments the evaluator's `balance` by `test.rewardPoints`
- [ ] A flagged submission sets `pointsEarned = 0` and does not change the evaluator's balance
- [ ] Submitting the same test twice returns a 409 Conflict error
- [ ] The completion screen shows the correct points earned (or 0 for flagged)
- [ ] The evaluator dashboard balance reflects the updated total after a valid submission
- [ ] Refreshing mid-test shows a browser "Leave page?" warning

---

## Phase 5: Admin Results & Dashboard (Day 2 — Hours 4–7)

### 5.1 Results Backend
- `GET /admin/tests/:id/results` — Aggregate results:
  - Total responses, valid (non-flagged) responses, flagged count
  - Average completion time
  - Per-question aggregation:
    - **Single/Multi select:** Count per option, percentage. Example: `[{ optionId, label, count, percentage }]`
    - **Rating:** Average value, min, max, distribution `[{ value: 1, count: 5 }, ...]`
    - **Free text:** Array of text responses (paginated)
  - Skip attention checks and trap duplicates in results

- `GET /admin/tests/:id/results/demographics` — Same aggregation but segmented:
  - Accept query params: `segmentBy=gender` or `segmentBy=ageGroup` or `segmentBy=country`
  - Age groups: 18–24, 25–34, 35–44, 45–54, 55+
  - Return: `{ segments: [{ label: "Male", results: { ...per-question aggregation } }, ...] }`

### 5.2 Dashboard Backend
- `GET /admin/dashboard` — Return:
  - `totalEvaluators`: count of users with role=EVALUATOR
  - `activeTests`: count of tests with status=ACTIVE
  - `totalResponses`: count of all TestResponse records
  - `flaggedResponses`: count of TestResponse where isFlagged=true
  - `recentTests`: last 5 tests with basic info

### 5.3 Admin Dashboard UI
- **Dashboard page** (`/dashboard` — default after login):
  - 4 stat cards in a row: Total Evaluators, Active Tests, Total Responses, Flagged Responses
  - Recent Tests table (last 5): title, status, responses count, created date → click to view

### 5.4 Test Results UI
- **Results page** (`/tests/[id]/results`):
  - Header: test title, status badge, response summary (total / valid / flagged)
  - Average completion time
  - **Per-question results cards:**
    - Selection questions: horizontal bar chart (shadcn/ui + recharts or simple CSS bars) showing option distribution with percentages
    - Rating questions: average score display + distribution bar chart
    - Free text: scrollable list of responses
  - **Demographic segment selector:**
    - Dropdown: "Segment by: None | Gender | Age Group | Country"
    - When selected, each question card splits into segments (e.g., side-by-side bars for Male vs Female)
  - Flagged response count callout

### 5.5 User List UI (Minimal)
- **Users page** (`/users`):
  - Table: name, email, registration date, tests completed (count), total points earned
  - Pagination
  - No actions (view only for MVP)

### Phase 5 Exit Criteria

Before moving to Phase 6, all of the following must be true:

- [ ] `GET /admin/dashboard` returns correct counts for total evaluators, active tests, total responses, and flagged responses
- [ ] Admin dashboard UI renders the 4 stat cards and the recent-tests table with live data
- [ ] `GET /admin/tests/:id/results` returns per-question aggregation: option distribution (%) for select questions, average + distribution for rating questions, response list for free text
- [ ] Attention-check and trap-duplicate questions are excluded from the results aggregation
- [ ] `GET /admin/tests/:id/results/demographics?segmentBy=gender` returns results correctly split by gender segment
- [ ] `GET /admin/tests/:id/results/demographics?segmentBy=ageGroup` correctly groups evaluators into the defined age buckets (18–24, 25–34, etc.)
- [ ] `GET /admin/tests/:id/results/demographics?segmentBy=country` correctly segments by country
- [ ] Results UI renders bar charts for select questions and shows average + histogram for rating questions
- [ ] Switching the demographic segment selector updates all question result cards simultaneously
- [ ] Flagged response count is clearly visible on the results page
- [ ] Users list page shows evaluator table with correct test-completed count and total points

---

## Phase 6: Polish, Anti-Cheat Refinement & Testing (Day 2 — Hours 7–10)

### 6.1 Anti-Cheat Refinements
- Verify speed check logic works correctly with the 60-second default
- Verify attention check auto-generation inserts reasonable questions
- Verify duplicate trap detection compares answers correctly (handle option reordering)
- Test edge cases: evaluator skips back and changes answer on trap question → should compare final answers

### 6.2 Responsive Design Pass
- Test evaluator app on mobile viewport (375px, 390px, 414px widths)
- Ensure media grids collapse to 1–2 columns on mobile
- Ensure touch targets are ≥ 44px
- Test admin app at tablet+ widths (admin is desktop-primary, but should not break on tablet)

### 6.3 Error Handling & Edge Cases
- Handle: test reaches response cap while evaluator is mid-test → graceful error on submit
- Handle: test status changes to PAUSED/CLOSED while evaluator is mid-test → error on submit with message
- Handle: Google Drive folder URL is invalid → clear error message
- Handle: media file too large on upload → validation error before upload
- Handle: duplicate email registration → clear error
- Handle: expired JWT → auto-refresh flow, or redirect to login

### 6.4 Seed Data for Demo
- Enhance seed script with realistic demo data:
  - 3 sample tests (1 active with photo comparison, 1 active with rating, 1 closed with results)
  - 10–20 sample media items (placeholder images)
  - 5–10 sample evaluator accounts with varied demographics
  - 20–50 sample responses for the closed test (to demonstrate results/analytics)
  - Pre-calculated results to show demographic breakdowns

### 6.5 Smoke Testing
- Full flow test: Admin login → create test → add questions with media → activate → Evaluator login → complete test → check results
- Auth flow: register → login → logout → Google OAuth
- Quality control: submit too-fast responses → verify flagging
- Edge: no available tests → verify empty state
- Edge: submit after response cap → verify rejection

### Phase 6 Exit Criteria — Demo Ready ✓

The MVP demo is shippable when all of the following pass:

**Full End-to-End Flow**
- [ ] Admin login → create test from template → add questions with media from library → set demographic filter → activate → preview confirms evaluator experience looks correct
- [ ] Evaluator register (email) → onboarding → dashboard → start next test → complete all questions → submit → see points earned → balance updates
- [ ] Evaluator register (Google OAuth) → same flow above completes without errors
- [ ] Second evaluator with non-matching demographics does NOT receive the filtered test
- [ ] Admin results page shows correct aggregation and demographic breakdown for all submitted responses

**Quality Control Verification**
- [ ] Submitting a test where answers are given in < 60 seconds total results in a flagged, 0-point response
- [ ] Wrong answer on any attention-check question results in a flagged, 0-point response
- [ ] Different answer on a trap-duplicate question results in a flagged, 0-point response
- [ ] Flagged responses do not appear in the admin aggregated result counts

**Edge Cases**
- [ ] Evaluator attempting to submit a test they already completed receives a 409 error
- [ ] Evaluator with no matching tests sees the "No tests available" empty state
- [ ] Test reaching its response cap stops appearing in `GET /evaluator/next-test`
- [ ] Admin can pause an active test; no new evaluators can start it while paused; admin can reactivate it

**UI & Responsiveness**
- [ ] Evaluator app is fully usable on a 390px-wide mobile screen (no horizontal scroll, no truncated buttons)
- [ ] Media images render correctly in question option grids on both mobile and desktop
- [ ] Admin panel is fully usable at 1280px desktop width

**Stability**
- [ ] No unhandled promise rejections or console errors during the full demo flow
- [ ] Expired access token is automatically refreshed without the user being logged out
- [ ] Invalid Drive folder URL shows a user-facing error, not a 500 stack trace

---

## Development Ports & Local Setup

| Service | Port | URL |
|---------|------|-----|
| Evaluator App | 3000 | http://localhost:3000 |
| Admin App | 3001 | http://localhost:3001 |
| Fastify API | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | localhost:5432 |

---

## File Structure Reference

### Key Files to Create

```
apps/api/
├── src/
│   ├── index.ts                    # Fastify entry point
│   ├── plugins/
│   │   ├── prisma.ts               # Prisma client plugin
│   │   ├── auth.ts                 # JWT + cookie utilities
│   │   └── rate-limit.ts           # Rate limiting config
│   ├── middleware/
│   │   ├── authenticate.ts         # JWT verification middleware
│   │   └── requireRole.ts          # Role-based access
│   ├── routes/
│   │   ├── auth.ts                 # Auth endpoints
│   │   ├── evaluator.ts            # Evaluator endpoints
│   │   ├── admin/
│   │   │   ├── dashboard.ts
│   │   │   ├── tests.ts
│   │   │   ├── questions.ts
│   │   │   ├── media.ts
│   │   │   ├── users.ts
│   │   │   └── templates.ts
│   │   └── media.ts                # Public media proxy
│   └── services/
│       ├── auth.service.ts         # Auth business logic
│       ├── test.service.ts         # Test CRUD + assignment logic
│       ├── quality.service.ts      # Anti-cheat checks
│       ├── reward.service.ts       # Reward calculation
│       ├── media.service.ts        # Media management + Drive
│       └── drive.service.ts        # Google Drive API client

apps/evaluator/
├── src/app/
│   ├── layout.tsx                  # Root layout with auth provider
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── onboarding/page.tsx         # Demographic profile form
│   ├── dashboard/page.tsx          # Main evaluator dashboard
│   └── tests/[id]/
│       ├── page.tsx                # Test intro
│       ├── question/[n]/page.tsx   # Question view
│       └── review/page.tsx         # Review & submit

apps/admin/
├── src/app/
│   ├── layout.tsx                  # Sidebar layout with auth
│   ├── (auth)/login/page.tsx
│   ├── dashboard/page.tsx          # Admin dashboard
│   ├── tests/
│   │   ├── page.tsx                # Test list
│   │   ├── [id]/edit/page.tsx      # Test editor
│   │   ├── [id]/results/page.tsx   # Test results
│   │   └── [id]/preview/page.tsx   # Test preview
│   ├── media/page.tsx              # Media library
│   └── users/page.tsx              # User list

packages/shared/src/
├── types/                          # Shared TypeScript types
│   ├── user.ts
│   ├── test.ts
│   ├── question.ts
│   ├── media.ts
│   └── response.ts
├── validation/                     # Zod schemas
│   ├── auth.ts
│   ├── test.ts
│   └── question.ts
├── constants.ts                    # Enums, defaults
└── rewards.ts                      # Reward calculation logic

packages/database/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── src/index.ts                    # Prisma client export
```

---

## Critical Path & Dependencies

```
Phase 0 (Scaffolding) ──→ Phase 1 (Auth) ──→ Phase 2 (Media) ──┐
                                                                  ├──→ Phase 3 (Test Creation)
                                                                  │         │
                                                                  │         ▼
                                                                  └──→ Phase 4 (Test Taking) ──→ Phase 5 (Results) ──→ Phase 6 (Polish)
```

- Phases 2 and 1 can overlap slightly (media backend while auth frontend is finishing)
- Phase 3 (test creation) depends on both auth (admin role) and media (library)
- Phase 4 (test taking) depends on Phase 3 (tests must exist)
- Phase 5 (results) depends on Phase 4 (responses must exist)
- Phase 6 is pure polish and testing

---

## Verification Checklist

- [ ] Admin can log in and see the dashboard with stats
- [ ] Admin can upload media files to the library
- [ ] Admin can import media from a Google Drive folder URL
- [ ] Admin can create a test from scratch with multiple question types
- [ ] Admin can create a test from a system template
- [ ] Admin can set demographic filters on a test
- [ ] Admin can preview a test in evaluator view
- [ ] Admin can activate, pause, and close a test
- [ ] Evaluator can register with email/password
- [ ] Evaluator can register with Google OAuth
- [ ] Evaluator completes demographic onboarding
- [ ] Evaluator sees "Start Next Test" and gets auto-assigned an eligible test
- [ ] Evaluator can navigate forward/backward through questions
- [ ] Evaluator can submit a test and see points earned
- [ ] Evaluator with non-matching demographics does NOT see filtered tests
- [ ] Speed-check flags responses completed too quickly
- [ ] Attention-check flags incorrect answers
- [ ] Duplicate trap flags inconsistent answers
- [ ] Flagged responses are excluded from results and earn 0 points
- [ ] Admin results page shows per-question aggregation
- [ ] Admin results page shows demographic breakdown
- [ ] Responsive: evaluator app works on mobile
- [ ] Rate limiting prevents auth endpoint abuse
