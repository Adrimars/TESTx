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
  - `Answer` (id, responseId, questionId, selectedOptions, ratingValue, timeSpentSeconds)
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
    const weights = { SINGLE_SELECT: 2, MULTI_SELECT: 2, RATING: 1 }
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
    - Type selector (single select, multi select, rating)
    - Prompt input (text)
    - Media type selector (for select types): Image, Video, Audio, Text
    - Options list (for select types):
      - If media: "Pick from Library" button opens media picker modal (shows filtered library by selected media type)
      - If text: text inputs for each option
      - Add/remove option buttons
    - Config section (type-specific):
      - Multi select: min selections, max selections
      - Rating: min value, max value, min label, max label
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
- [ ] All 3 question types (single select, multi select, rating) can be added to a test with correct config saved
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
      { "questionId": "uuid", "selectedOptionIds": ["uuid"], "ratingValue": 4, "timeSpentSeconds": 15 }
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
  - "Previous" button (disabled on first question) + "Next" button (disabled if no answer selected)
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
- [ ] `GET /admin/tests/:id/results` returns per-question aggregation: option distribution (%) for select questions, average + distribution for rating questions
- [ ] Attention-check and trap-duplicate questions are excluded from the results aggregation
- [ ] `GET /admin/tests/:id/results/demographics?segmentBy=gender` returns results correctly split by gender segment
- [ ] `GET /admin/tests/:id/results/demographics?segmentBy=ageGroup` correctly groups evaluators into the defined age buckets (18–24, 25–34, etc.)
- [ ] `GET /admin/tests/:id/results/demographics?segmentBy=country` correctly segments by country
- [ ] Results UI renders bar charts for select questions and shows average + histogram for rating questions
- [ ] Switching the demographic segment selector updates all question result cards simultaneously
- [ ] Flagged response count is clearly visible on the results page
- [ ] Users list page shows evaluator table with correct test-completed count and total points

---

## Phase 6: Enhancements — Accounts, Test Control, Structured Inputs & Media UX

> Follow-up iteration after the initial MVP demo. Adds sign out, admin test-control actions, a live report, structured (dropdown) demographic inputs, removal of the free-text question type, and a bulk media upload experience.

### 6.1 Sign Out (Admin + Evaluator)
- Backend: `POST /auth/logout` already clears cookies — reuse as-is.
- Frontend (both apps): add a visible **Sign Out** control in the navbar (evaluator) and sidebar/user menu (admin).
  - On click: call `POST /auth/logout` via the API client, clear client auth state in the auth provider, redirect to `/login`.
  - Ensure protected routes/layout guards reject access immediately after sign out (no stale cached session).

### 6.2 Test Control — Pause/Deactivate & Close (Active Tests)
- Backend: `PUT /admin/tests/:id/status` already supports ACTIVE→PAUSED and ACTIVE→CLOSED. Confirm transition validation and that PAUSED/CLOSED tests are excluded from `GET /evaluator/next-test`.
- Frontend (admin):
  - On the test list rows and the test detail/results view, add explicit **Pause** (labeled "Deactivate") and **Close** buttons for tests in ACTIVE status, plus **Reactivate** for PAUSED.
  - Each action shows a confirmation dialog; Close warns that it is permanent.
  - Reflect the new status badge immediately after the action succeeds.
- Note: "Deactivate" is a UI synonym for Pause — no new status is introduced.

### 6.3 Live Option-Choice Report (Active + Closed)
- Backend: `GET /admin/tests/:id/report` — returns per-question option-choice distribution (which options were chosen and how many evaluators chose each). Reuses the results aggregation but is explicitly allowed while the test is **ACTIVE** (live), not only CLOSED. Excludes flagged responses, attention checks, and trap duplicates. Supports the same demographic `segmentBy` params as results.
- Frontend (admin):
  - Add a **Report** view (or a "Live Report" tab on the results page) reachable for Active and Closed tests.
  - Show per-question option distribution (counts + percentages) with the demographic segment selector.
  - For Active tests, surface a "live" indicator and a manual refresh (or lightweight polling).

### 6.4 Structured Demographic Inputs — Searchable Dropdowns
- **Data model change:** Replace `EvaluatorProfile.dateOfBirth (Date)` with `EvaluatorProfile.age (Integer)`. Add a Prisma migration; backfill existing rows (compute age from any existing DOB data, or set from seed).
- **Age:** Onboarding/profile uses a **searchable dropdown of specific age numbers** (e.g. 13–100). Store the selected number directly. Remove the DOB date picker.
- **Country:** Replace the plain select with a **searchable dropdown** backed by the ISO 3166 country list.
- **City:** Replace the free-text city input with a **searchable dropdown** filtered by the selected country (static city dataset per country, or autocomplete source).
- Update the `PUT /evaluator/profile` payload + Zod validation (`age: number`, remove `dateOfBirth`).
- **Admin analytics:** Age-range bucketing now derives from the `age` integer directly (buckets 18–24, 25–34, 35–44, 45–54, 55+). Demographic filters on tests continue to use an age range.
- Shared: add a reusable searchable-dropdown (combobox) component in `packages/ui`.

### 6.5 Remove the Free-Text Question Type from the Codebase
> Explicit cleanup: delete every remaining free-text/open-ended-response construct across the codebase so only single select, multi select, and rating remain.
- `packages/shared`: remove `FREE_TEXT` from the question-type enum/constants; remove free-text Zod schemas and TypeScript types; remove the `FREE_TEXT` reward weight.
- `packages/database`: remove `FREE_TEXT` from the Prisma `QuestionType` enum and remove `Answer.textValue`; add a migration (drop column + enum value; migrate/delete any existing free-text questions/answers in seed and data).
- `apps/api`: remove free-text branches in submit validation, quality checks, and results aggregation (no more `textValue`, no free-text response list); update reward calculation.
- `apps/admin`: remove the free-text option from the question-type selector and its config UI (char limits); remove the free-text response list from the results UI.
- `apps/evaluator`: remove the free-text textarea rendering and its answer-state handling from the question page and review page.
- Seed data: remove any free-text sample questions/answers.
- Grep the whole repo for `FREE_TEXT` / `textValue` / free-text UI to confirm none remain.

### 6.6 Media Library — Bulk Upload (Multi-File + Drag-and-Drop)
- Backend: `POST /admin/media/upload` accepts **multiple files** in a single multipart request; validate each file's type/size independently and return a per-file result (created records + any per-file errors) rather than failing the whole batch.
- Frontend (admin Media Library):
  - File picker allows **multi-select** (`multiple` attribute).
  - Add a **drag-and-drop** dropzone over the library grid; dropping files queues them for upload.
  - Show a batch upload panel with per-file progress and success/error state; refresh the grid as files complete without a full page reload.

### Phase 6 Exit Criteria

Before moving to Phase 7, all of the following must be true:

- [ ] Both apps show a Sign Out control; clicking it clears cookies, resets auth state, and redirects to `/login`; protected routes are then inaccessible
- [ ] Admin can Pause ("Deactivate") and Close an Active test from the UI with confirmation; a paused test stops appearing in `GET /evaluator/next-test`; a paused test can be Reactivated
- [ ] `GET /admin/tests/:id/report` returns per-option choice distribution for an **Active** test and for a Closed test, excluding flagged/attention/trap responses
- [ ] The admin report view renders live option distributions and updates when segmented by gender / age range / country
- [ ] Onboarding stores a specific `age` integer chosen from a searchable dropdown; `EvaluatorProfile.dateOfBirth` no longer exists and a migration handles existing rows
- [ ] Country and City are searchable dropdowns; City options are filtered by the selected Country
- [ ] Admin age-range segmentation and test age filters work correctly using the stored `age` integer
- [ ] No `FREE_TEXT` question type, `textValue` field, or free-text UI remains anywhere in the repo (verified by grep); the 3 remaining types still work end-to-end
- [ ] Media Library accepts multiple files via multi-select and via drag-and-drop, with per-file progress and per-file validation; the grid refreshes as uploads complete

---

## Phase 7: Polish, Anti-Cheat Refinement & Testing (Day 2 — Hours 7–10)

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

### Phase 7 Exit Criteria — Demo Ready ✓

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
                                                                  └──→ Phase 4 (Test Taking) ──→ Phase 5 (Results) ──→ Phase 6 (Enhancements) ──→ Phase 7 (Polish)
```

- Phases 2 and 1 can overlap slightly (media backend while auth frontend is finishing)
- Phase 3 (test creation) depends on both auth (admin role) and media (library)
- Phase 4 (test taking) depends on Phase 3 (tests must exist)
- Phase 5 (results) depends on Phase 4 (responses must exist)
- Phase 6 (enhancements) is a follow-up iteration on the working MVP: sign out, test control, live report, structured demographic dropdowns, free-text removal, bulk media upload
- Phase 7 is pure polish and testing

---

## Verification Checklist

- [ ] Admin can log in and see the dashboard with stats
- [ ] Admin can upload media files to the library
- [ ] Admin can upload multiple media files at once via multi-select and drag-and-drop
- [ ] Admin can import media from a Google Drive folder URL
- [ ] Admin can create a test from scratch with multiple question types
- [ ] Admin can create a test from a system template
- [ ] Admin can set demographic filters on a test
- [ ] Admin can preview a test in evaluator view
- [ ] Admin can activate, pause/deactivate, and close a test from explicit UI controls
- [ ] Admin can view the live option-choice report while a test is Active and after it is Closed
- [ ] Admin and evaluator can sign out
- [ ] Evaluator can register with email/password
- [ ] Evaluator can register with Google OAuth
- [ ] Evaluator completes demographic onboarding (specific age + searchable country/city dropdowns)
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

---

## Phase 9: Mobile App — Foundation & Auth

> Scope: see prd.md §15 for the full concept (continuous swipeable feed, per-question-type interactions, reward model, design language). This phase is scaffolding + the one required backend change.

### 9.1 Backend — Bearer Token Auth
- Extend `apps/api/src/middleware/authenticate.ts` (`authenticateUser`) to accept `Authorization: Bearer <token>` as a fallback when `request.cookies.access_token` is absent. Cookie path stays exactly as-is — web apps must be unaffected.
- Update `/auth/register`, `/auth/login`, and `/auth/refresh` (`apps/api/src/routes/auth.ts`) to also return `{ accessToken, refreshToken }` in the JSON body, alongside the existing `setAuthCookies` call.
- No new endpoints needed — `/evaluator/next-test`, `/evaluator/tests/:id`, `/evaluator/tests/:id/submit`, `/evaluator/balance` are reused unchanged from mobile.

### 9.2 Mobile App Scaffolding
- New `apps/mobile` package (Expo, TypeScript), added to `pnpm-workspace.yaml` and `turbo.json`.
- `expo-router` file-based navigation; base screens: splash/auth-check, login, register, profile-onboarding, feed (empty placeholder for now).
- Depend on `packages/shared` for Zod schemas/types (register/login/evaluatorProfile schemas reused as-is).
- `@tanstack/react-query` client wired to the API base URL (env-configurable, mirrors `apps/evaluator`'s API client pattern).

### 9.3 Mobile Auth & Onboarding
- Login/register screens call `/auth/login` / `/auth/register`; store returned `accessToken`/`refreshToken` in `expo-secure-store`; attach `Authorization: Bearer` header on all subsequent requests.
- Silent refresh: on 401, call `/auth/refresh` with the stored refresh token, retry once.
- **Entry screen layout:** email/password and **Google sign-in are equally prominent, both on the first screen** (not Google buried behind an "other options" tap) — reuse the existing `/auth/google` web redirect flow via an in-app browser (`expo-auth-session`/`expo-web-browser`), landing back in the app with tokens.
- **18+ age gate:** registration blocks self-declared ages under 18 (checked against the `age` field collected in profile onboarding, or a separate up-front birthdate/age check before that step). See `kvkk-compliance-research.md` §5 — this sidesteps the unresolved TMK minor-consent question rather than trying to answer it. **This is separate from, and should not be confused with, the store's own age-rating/content questionnaire** (App Store Connect / Google Play IARC) — answer those honestly based on actual app content (likely 4+/9+, since TESTx has no mature content by design), don't force a hard 18+ store rating just because registration itself is gated at 18+ (`appstore-playstore-compliance-research.md` §5, §9c).
- **KVKK — two separate steps (revised, not the old single checkbox), mobile-only:** see `kvkk-compliance-research.md` (full research) and prd.md §15.9 for the reasoning; Kurul İlke Kararı 2026/347 prohibits merging disclosure and consent.
  - Add `aydinlatmaAcknowledgedAt DateTime?` and `acikRizaAcceptedAt DateTime?` to `User` (Prisma migration) — **replaces** the previously planned single `kvkkAcceptedAt` field.
  - Registration flow shows (1) a dedicated Aydınlatma Metni screen — full Article 10 disclosure text, explicitly mentioning Google infrastructure involvement — with a non-consent "read/acknowledged" confirmation, blocking registration until acknowledged; then (2) a **separate, narrowly-labeled açık rıza checkbox**, only if needed at all. Since the avatar is a bundled preset picker (8.4), not a photo upload, the only realistic candidate left is the Google cross-border transfer, pending legal confirmation — don't attach consent to account/demographic data that already rests on contract-performance, per the 2021/389 precedent. If legal review confirms Google's own DPA/standard-contract terms already cover the transfer, v1 may need **no açık rıza checkbox at all** — don't build one speculatively.
  - **Blocker, not just a nice-to-have:** the actual Aydınlatma Metni / Açık Rıza Metni text content doesn't exist yet anywhere in the repo. Drafting it (legal skeleton is in `kvkk-compliance-research.md`) and getting a KVKK-experienced lawyer's sign-off is required before this ships to production, even though the UI/schema work above can proceed in parallel.
  - Web registration is untouched (prd.md §15.11).
- Profile onboarding screen: native form for `evaluatorProfileSchema` fields (age, gender, country, city, etc.), calling `PUT /evaluator/profile` — required before `/evaluator/next-test` will return anything (`PROFILE_REQUIRED`).

### 9.4 Profile & Account Management
- New `User.avatarId Int?` field (Prisma migration) — no upload endpoint, no photo storage. A fixed set of **8–10 preset avatar images** ships as static assets bundled inside the `apps/mobile` app itself (not served from the backend); `avatarId` just records which one the evaluator picked.
- Profile screen: every `EvaluatorProfile` field editable in place (reuses `evaluatorProfileSchema` + `PUT /evaluator/profile`), plus an **avatar picker** — a grid of the 8–10 bundled presets, tap to select, `PUT /users/me` with the chosen `avatarId`.
- Logout: clear `expo-secure-store` tokens, return to the entry screen.

### 9.4a Account Deletion
- **Confirmed hard blocker for both stores** (`appstore-playstore-compliance-research.md` §3, §9a) — Apple Guideline 5.1.1(v) and Google Play's account-deletion policy both require genuine in-app, self-service account deletion the moment an app supports account creation, with no MVP exception and no "email support to delete" carve-out (that carve-out is limited to "highly-regulated industries," which TESTx isn't). Deactivation/sign-out alone does not satisfy either policy. This must land **before** any store submission, not after.
- Backend: a `DELETE /users/me` endpoint that deletes the `User` row (cascades `EvaluatorProfile` — already `onDelete: Cascade` in the schema) and disposes of/anonymizes `TestResponse`/`Answer` history, subject to whatever disclosed retention TESTx keeps for fraud-prevention/legal purposes (both stores explicitly allow disclosed retention exceptions, same as KVKK Article 7/11 — see `kvkk-compliance-research.md` §6).
- Mobile: a "Delete Account" action on the profile screen (discoverable, not buried in a sub-menu three taps deep), with an explicit confirmation step before the irreversible call.
- Google Play additionally requires a **web-reachable deletion request path** outside the app (covers a user who already deleted the app) — a simple hosted form or documented deletion-request page satisfies this; the in-app path remains primary.
- Shared backend endpoint is available to both mobile and web — decide separately whether `apps/evaluator` gets its own "Delete Account" UI entry point (only mobile is store-gated, but the KVKK deletion right applies regardless of platform, so parity is the more coherent long-term move even though not required for this phase's exit criteria).

### 9.5 Device-Based Multi-Account Guard
- A points-for-answers economy is a natural target for one person farming rewards through multiple fake accounts. Web has no defense against this beyond email/Google-ID uniqueness; mobile can do better because a device identity is available.
- At registration, the mobile app sends a stable device identifier (`expo-application`'s installation ID, or a Play Integrity/App Attest attestation token if stronger assurance is needed later) alongside the register call.
- Backend: new `DeviceRegistration` record (`deviceId`, `userId`, `createdAt`) or a `User.registrationDeviceId String?` column (Prisma migration). Registration is not hard-blocked on a repeat device (avoids false positives from shared/family devices) — instead, a repeat-device signup is flagged (e.g., a new `isDeviceFlagged Boolean` on `EvaluatorProfile`, or reuse the existing flagging vocabulary from `qualityService`) for review, same spirit as the existing response-flagging system rather than a hard account block.
- This is v1-scoped as detection/flagging, not prevention — an actual ban/appeal workflow is a follow-up if farming turns out to be a real problem in practice.

### 9.6 Minimum App Version Enforcement (Forced Update)
- Needed because the question-type set grows over time (Ranking now, more later per Phase 13's pattern) — an old app build that doesn't know how to render a new `QuestionType` must not be allowed to silently break or crash mid-feed.
- Backend: a small `GET /mobile/min-version` endpoint (or a static config value) returning the current minimum supported app version.
- Mobile: on launch, compare the running app's version (`expo-application` or `expo-updates` version info) against the minimum; if below it, show a **non-dismissible "update required" screen** with a direct link to the App Store/Play Store listing — no partial/degraded access to the feed. This is the "force update" policy chosen over graceful per-question-type degradation.
- Whenever Phase 13 (or any future phase) ships a new `QuestionType`, bump the enforced minimum version as part of that phase's rollout so older installs are forced to update before they can hit a question type they can't render.

### Phase 9 Exit Criteria
- [ ] A request with only an `Authorization: Bearer` header (no cookie) succeeds against an authenticated endpoint; a request with only the cookie still succeeds unchanged
- [ ] `/auth/login` and `/auth/register` responses include `accessToken`/`refreshToken` in the JSON body in addition to setting cookies
- [ ] Mobile app can register, log in, complete profile onboarding, and reach an authenticated placeholder feed screen
- [ ] Registration is blocked for self-declared ages under 18
- [ ] Registration is blocked until the Aydınlatma Metni is acknowledged (setting `User.aydinlatmaAcknowledgedAt`); the açık rıza checkbox (setting `User.acikRizaAcceptedAt`) is presented as a visibly separate action, not merged with or nested inside the disclosure acknowledgment
- [ ] Registration is **not** blocked by the açık rıza checkbox for any user who declines it, unless that specific consented processing is genuinely required for the account to function (per the 2021/389 precedent in `kvkk-compliance-research.md` §8)
- [ ] Aydınlatma Metni / Açık Rıza Metni text content has been drafted and signed off by a KVKK-experienced lawyer before this phase ships to production (tracked separately from the engineering work, which can proceed against placeholder text)
- [ ] Google sign-in is reachable directly from the entry screen, not nested behind another tap
- [ ] Evaluator can edit every profile field and pick/change a preset avatar after registration; changes persist across app restarts
- [ ] Evaluator can delete their account from the profile screen (with confirmation); `DELETE /users/me` removes the account and cascades associated data per the disclosed retention rule; a deleted account cannot log back in
- [ ] A web-reachable account-deletion request path exists outside the app (Google Play requirement)
- [ ] Logout clears stored tokens and returns to the entry screen; a subsequent app launch requires login again
- [ ] Expired access token triggers a silent refresh via the stored refresh token without logging the user out
- [ ] Web apps (`apps/evaluator`, `apps/admin`) pass their existing auth flows unmodified
- [ ] A registration from a device that already has an account flags the new signup (`isDeviceFlagged` or equivalent) without blocking it
- [ ] An app build below the enforced minimum version shows the non-dismissible update screen and cannot reach the feed; a build at or above it launches normally

---

## Phase 10: Mobile App — Swipe Engine (Per-Question-Type Cards)

### 10.1 Card Primitive
- Shared gesture-driven card component (`react-native-gesture-handler` + `react-native-reanimated`): tracks drag position, exposes directional/target-proximity callbacks, animates fly-away/snap-back and commit transitions.
- Card stack renderer: active card + 1–2 peeking cards behind it, pulled from an in-memory queue of upcoming questions.

### 10.2 Single Select — 2 Options
- Full-screen card, two labeled zones (or implicit left/right meaning shown via option labels/media), swipe right → first option, swipe left → second option, commit on release past a distance/velocity threshold.

### 10.3 Single Select — 3+ Options
- Card rendered without swipe-to-choose; tappable option list docked below (reuse selection styling patterns from `apps/evaluator`'s `OptionShell`, ported to React Native).

### 10.4 Multi Select
- Sub-deck of one card per option; swipe right = include, swipe left = skip; enforce `config.minSelections`/`maxSelections` from the question; sub-deck completion advances the outer feed to the next question.

### 10.5 Rating (Drag-to-Target)
- 5 target pills fixed to the right edge, ordered top(1)→bottom(5). Proximity-based scale-up animation as the dragged card approaches a target. Release-over-target commits that value and advances; release elsewhere springs the card back to center uncommitted.
- **Safe-area constraint:** the target column is laid out inside `react-native-safe-area-context`'s safe area, not raw screen edges — on iOS this keeps the top/bottom-most pills clear of the notch/Dynamic Island and the home-indicator strip; on Android it clears the gesture-navigation bar. Verify on at least one notched iPhone and one gesture-nav Android device, not just a simulator with default insets.

### 10.6 Ranking (Drag-to-Slot)
- **Depends on Phase 13** (Ranking is a new cross-app question type — schema, admin authoring, and web rendering land there; this subsection is the mobile card interaction only).
- Reuses the Rating target-pill component with N slots (3–5) instead of 5, labeled 1→N. Each of the question's options is its own card in a sub-deck (same pattern as Multi Select's sub-deck); the evaluator drags each card, one at a time, onto an open slot.
- Once a slot is filled it is removed as a valid drop target for the remaining cards (query the in-progress placement map before allowing a commit) — this is what makes the ordering strict rather than allowing ties.
- Submits as the full ordered array of option IDs (index 0 = slot 1 = best) into the same `selectedOptionIds` shape the API already accepts — no new answer payload shape needed.

### 10.7 Back / Undo
- One level of recallable history: Back re-surfaces the previous card unanswered; a new swipe/drag replaces its answer; the deck then auto-resumes forward from that point.

### 10.8 First-Run Gesture Tutorial
- Swipe-left/right for Single Select and Multi Select needs no explanation (universal Tinder-style muscle memory), but **drag-to-target** (Rating, Ranking) is a novel gesture most users have never seen — an unexplained first encounter risks confused/careless answers, which directly pollutes the quality-control signal Phase 10.5/10.6 and `qualityService` are trying to protect.
- On the evaluator's first-ever Rating card and first-ever Ranking card (tracked locally, e.g. `hasSeenRatingTutorial`/`hasSeenRankingTutorial` flags in device storage — not server state), overlay a brief animated hint (a ghost card visibly dragging itself to a target, 1-2 seconds, dismissable by starting to drag) before the real interaction becomes active. Does not repeat after the first showing.

### Phase 10 Exit Criteria
- [ ] Each question type (Single Select 2-option, Single Select 3+, Multi Select, Rating, Ranking) renders and can be answered entirely through its designed gesture/tap interaction, driven by real test data from `/evaluator/tests/:id`
- [ ] Multi Select sub-deck respects configured min/max selections before advancing
- [ ] Rating targets visibly enlarge on proximity and commit the correct 1–5 value on release, and stay clear of the device safe area on a notched iPhone and a gesture-nav Android device
- [ ] Ranking slots fill in order, a filled slot rejects further drops, and the submitted order matches what the evaluator placed
- [ ] Back reliably re-shows the previous card and accepts a new answer without corrupting later answers already given
- [ ] Media (image/video/audio) loads and plays correctly inside a card for all `MediaType`s
- [ ] The drag-to-target tutorial overlay shows exactly once per gesture type on a fresh install, then never again

---

## Phase 11: Mobile App — Continuous Feed, Progress & Rewards

### 11.1 Feed Orchestration
- Feed screen owns: current test's question queue, the in-memory answers map (same shape as `apps/evaluator`'s test-session state), and the "questions remaining" counter.
- Background prefetch: when 1–2 questions remain in the current test, call `GET /evaluator/next-test`; if a test is returned, prefetch `GET /evaluator/tests/:id` and its first card's media before the current test's last card is even answered.

### 11.2 Progress Indicator
- Instagram-Stories-style thin segmented bars at the top, one segment per question in the current test; resets when the feed transitions into a new test.

### 11.3 Test Completion & Reward
- On the last answered card: fire `POST /evaluator/tests/:id/submit` with the full collected answers (background, non-blocking), decrement the remaining-questions counter to 0, and show a "test complete — you earned X points" popup using the response's `pointsEarned`.
- If a next test was prefetched, dismiss the popup into a seamless continuation of the feed; otherwise show an empty/"come back later" state.
- Handle `ALREADY_SUBMITTED` / `CAPACITY_REACHED` / `NOT_ELIGIBLE` responses gracefully by skipping to the next prefetch attempt instead of surfacing a raw error mid-feed.

### 11.4 Submission Resilience (Offline-Safe Rewards)
- The whole reward loop hinges on one background `submit` call succeeding at exactly the moment a phone is most likely to have a flaky connection or get backgrounded/killed (end of a session, user moving on). Losing a completed test's answers to a dropped request would cost an honest evaluator their earned points — this needs to be treated as a reliability requirement, not left to a bare `fetch`.
- Persist the in-progress answers map (and the finished-but-not-yet-confirmed-submitted payload) to on-device storage (`expo-sqlite` or `@react-native-async-storage/async-storage`) as the evaluator progresses through a test, not just in memory — so a killed app doesn't lose an almost-finished test either.
- On submit failure (network error, timeout — not a definitive rejection like `ALREADY_SUBMITTED`), keep the payload queued on-device and retry with backoff; also retry once automatically on next app launch if a submission was left pending.
- Only clear the persisted payload once the server confirms success (or a definitive terminal rejection). Show the evaluator an honest "syncing…" state if a submission is still pending rather than falsely declaring completion.

### Phase 11 Exit Criteria
- [ ] Finishing a test's last question submits automatically and shows the correct points-earned popup
- [ ] The next test (if any) begins with no visible loading gap after the completion popup
- [ ] The remaining-questions counter and Stories-style progress bar stay in sync with the actual current test/question at all times, including after Back
- [ ] Reaching the end of all eligible tests shows an empty state instead of erroring
- [ ] Balance shown in the app matches `GET /evaluator/balance` after each completed test
- [ ] Killing the app (or losing network) immediately after finishing a test's last card does not lose the completed answers — the pending submission retries and succeeds once connectivity/app state recovers
- [ ] A submission that's still pending shows an honest "syncing" state rather than a false completion popup

---

## Phase 12: Mobile App — Design System Implementation

> Full spec: prd.md §16 (Mobile Design System). This phase turns that spec into actual tokens/components — it is not a cosmetic pass at the end, it underpins every screen built in Phases 8–10, so token setup (11.1) should land early and get retrofitted, not bolted on last.

### 12.1 Card Interaction Fixes (from Phase 10 field testing)
- **Two-option comparison card only shows half the photo** — `TwoOptionCard` splits the card into two side-by-side halves, each rendering its option's photo through `CardMedia`'s cover crop; at half width most of the image is cropped out and never seen. Selecting/tapping a side should let the evaluator see that option's full, uncropped photo before committing to it.
- **Peeking cards' text clutters the view** — `CardStack` keeps 1–2 upcoming cards visible behind the active one (10.7/prd.md §15.3) at only slightly reduced opacity, and their prompt/caption text stays legible enough to visually mix with the active card's own text. Peeking cards' text should be hidden or dimmed further so only the active card reads clearly.
- **Ranking card gets stuck after the first placement** — `RankingCard` swaps `current` (the option being shown) in place on one persistent `SwipeCard` instance rather than remounting a fresh one per option, unlike `CardStack`, which unmounts a card specifically to reset its drag offset and committed latch (see `CardStack.tsx`'s own comment on this). After the first photo is dragged onto a slot, the next option's card doesn't reliably reset, leaving the rest of the ranking unreachable.
- **Filled ranking slots show only a number, not the photo** — once a card is placed, its slot (`RankSlot`) shows just the rank number. A small thumbnail of the placed photo inside the slot would let the evaluator see their whole ranking at a glance.
- **No way to revise one ranking placement** — the only undo is the outer deck's Back (10.7), which discards the *entire* question's placements, not one card. Tapping a filled slot should pull that card back out for re-placing without losing the other placements.

### 12.2 Design Tokens
- `apps/mobile` theme module encoding prd.md §16.2's color tokens (`surface-base`, `surface-raised`, `surface-overlay`, `border-hairline`, `text-primary`, `text-secondary`, `accent`, `accent-contrast`, `success`, `danger`) and §16.3's type scale, as plain constants or via `nativewind` if adopted in Phase 9.2.
- Dark-only (no light theme in v1, prd.md §16.7) — no theme-switch logic needed yet.

### 12.3 Motion Primitives
- Shared `react-native-reanimated` spring presets matching prd.md §16.4: card-commit fly-off, card-reject snap-back, target-proximity scale curve, popup overshoot — implemented once and reused by every card/target component from Phase 10, not redefined per screen.
- `expo-haptics` tick wired to the Rating/Ranking commit-threshold crossing.
- **Tap-selection feedback for `OptionListCard` (10.3) and the option tiles inside `MultiSelectCard`'s summary state** — picking a tile currently just flips border/background color instantly, with no scale, checkmark, or fade transition. The swipe and drag cards already have motion (highlight opacity, fly-away, proximity scale); the tap-to-select path is the one interaction in the deck with none, and it should use the same spring presets defined above rather than a one-off `Animated.timing` bolted onto that component alone.

### 12.4 Component Library
- Card, target pill, progress-segment bar, counter chip, and empty/error state components per prd.md §16.6 — built as the shared primitives Phases 9–10 consume, so those phases don't each invent their own card/pill styling.

### 12.5 Iconography & Media Treatment
- `lucide-react-native` wired in with 1.5px stroke icons (prd.md §16.5); full-bleed crop (never letterbox) confirmed for image and video cards.

### 12.6 Accessibility & Reduced Motion
- Every gesture-driven interaction (swipe, drag-to-rate, drag-to-rank) gets a tap-based fallback path.
- OS-level Reduce Motion setting collapses every spring from 12.3 to an instant/short fade, verified on both iOS and Android.
- 44×44pt minimum touch target audit across all interactive elements, including target pills at rest size.
- Safe-area audit: the Rating/Ranking target column (9.5/9.6) and any other edge-anchored chrome sit inside `react-native-safe-area-context` insets on every screen, checked against a notched iPhone and a gesture-nav Android device, not just default-inset simulators.

### Phase 12 Exit Criteria
- [ ] The two-option card's full-photo view, the peeking-card text clutter, and the Ranking card's stuck-after-first-placement bug (12.1) are all fixed and re-verified on-device
- [ ] A design/style review confirms no default/unstyled native components remain on any mobile screen (auth, profile, feed, card, rewards, completion)
- [ ] Color and type tokens are defined in one place and consumed everywhere — no ad-hoc hex values or font sizes scattered in screen code
- [ ] Reduced-motion setting produces a usable tap-based fallback for every question type, verified on-device
- [ ] Core interactions (swipe, drag-to-rate, drag-to-rank, undo, completion) use the shared spring presets from §12.3, not one-off animation code

---

## Phase 13: Ranking Question Type (Cross-App Rollout)

> New `QuestionType` value — touches the database, the API, the admin app, and the web evaluator app, not just mobile. Should land before or alongside Phase 10.6, since mobile's ranking card depends on this existing.

### 13.1 Database & Validation
- Add `RANKING` to the `QuestionType` enum (`packages/database/prisma/schema.prisma`) + migration.
- `apps/api/src/routes/evaluator.ts` `validateAnswers()`: for `RANKING`, require `selectedOptionIds` to be a permutation of exactly all of the question's option IDs (same length, no duplicates, every option covered) — reuses the existing array field, no new `Answer` column.
- `PUBLIC_CONFIG_KEYS`/`publicConfig()`: expose whatever ranking-specific config the admin sets (e.g., endpoint labels) the same way `RATING`'s `min`/`max`/labels are exposed today.
- `apps/api/src/services/quality.service.ts`: explicitly exclude `RANKING` from `COMPARABLE_TRAP_TYPES` (already true by construction — just confirm/document — prd.md §9.3).

### 13.2 Admin Authoring UI
- `apps/admin`: new question-type option in the test/question builder — pick 3–5 options (media or text), optional endpoint labels ("Best"/"Worst"). Enforce the 3–5 cap client- and server-side.

### 13.3 Web Evaluator UI
- `apps/evaluator`'s question-taking page (`apps/evaluator/src/app/tests/[id]/question/[n]/page.tsx`): new `RankingQuestion` component, standard drag-to-reorder list (no swipe/target styling needed here — prd.md §5.3.4), wired into `hasAnswer()`/`setAnswer()` alongside the existing three types.

### Phase 13 Exit Criteria
- [ ] Admin can create a test containing a Ranking question with 3–5 options
- [ ] A submitted ranking answer that isn't a full permutation of the question's options is rejected with a 400
- [ ] Web evaluator can complete a Ranking question via drag-to-reorder and submit successfully
- [ ] Mobile evaluator can complete the same Ranking question via drag-to-slot (Phase 10.6) and both clients produce answers in the same stored shape

---

## Phase 14: Rewards Catalog (Admin + Mobile)

> Catalog browsing is in scope now; the actual redemption/purchase action is deferred (prd.md §10.2a, §15.10, §15.11).

### 14.1 Database & Backend
- New `Coupon` model (`packages/database/prisma/schema.prisma`): `title`, `description`, `imageUrl`, `pointsCost`, `isActive`, `displayOrder` + migration.
- Admin CRUD endpoints (`apps/api`): create/update/list/deactivate coupons.
- Evaluator-facing read endpoint: `GET /evaluator/coupons` — active coupons only, ordered by `displayOrder`.

### 14.2 Admin UI
- New admin screen (prd.md §11.4): list + create/edit form for catalog items, image upload reusing the existing media-upload pattern, active/inactive toggle.

### 14.3 Mobile Shop Screen
- New feed-adjacent screen listing catalog items with image, title, point cost, and the evaluator's current balance (`GET /evaluator/balance`) for comparison.
- Tapping an item's redeem action shows a "Coming Soon" state — no balance mutation in v1.
- **Store-listing note** (`appstore-playstore-compliance-research.md` §9e): no policy issue with the "browsing only" design itself, but when store-listing copy/screenshots are written for this feature, don't depict or describe redemption as functional (e.g., a screenshot of tapping "Redeem" should show the "Coming Soon" state, not imply a working purchase) — otherwise it risks an Apple Guideline 2.3 / Google metadata-accuracy issue, unrelated to the rewards/gambling policies themselves.

### Phase 14 Exit Criteria
- [ ] Admin can create, edit, and deactivate catalog items; inactive items don't appear on mobile
- [ ] Mobile Rewards screen lists active items in `displayOrder` with correct images, titles, and point costs
- [ ] Tapping redeem shows "Coming Soon" and does not change the evaluator's balance
- [ ] Evaluator's balance shown on the Rewards screen matches `GET /evaluator/balance`

---

## Phase 15: Mobile App — Rating/Ranking Redesign, Free-Form Multi-Select & First-Test Onboarding

> Field feedback after Phase 12 shipped its design system and gesture fallbacks: Rating and Ranking read as the same component wearing two labels, the answer column sits on top of the photo instead of beside it, Ranking's revise flow needs a shortcut, Multi-Select's min forces a retry-loop nobody asked for, and a first-time evaluator gets no walkthrough at all before their first real test.

### 15.1 Multi-Select: Independent Like/Dislike, No Forced Minimum
- Each option in a Multi-Select sub-deck should be a fully independent "did you like this one or not" decision — swiping through and liking zero, some, or all of them is a complete, valid answer. Nothing about the flow should nudge the evaluator toward a middle-ground count.
- `apps/mobile/src/lib/swipe.ts`'s `advanceSubDeck`: drop the `"reconsider"` step entirely — reaching the end of the queue always completes the question with whatever got included, never re-offers the skipped options to force a minimum. Confirmed safe: `apps/api/src/routes/evaluator.ts`'s `validateAnswers()` never enforced `minSelections` server-side in the first place (only `maxSelections` is checked) — this was a mobile-only UX choice, not a contract the API depends on, so removing it has no server-side follow-up.
- `maxSelections` stays respected where an admin has actually set one (the API does enforce that upper bound, so mobile still has to pre-empt it exactly as `MultiSelectCard.tsx`'s `atMax` guard does today) — the difference is there's no floor, only an optional ceiling.
- Out of scope for this phase: whether `minSelections` should be removed from the admin authoring UI (`apps/admin`) and web evaluator (`apps/evaluator`) entirely, or just stop being treated as a mobile retry-trigger. Decide at implementation time; don't silently change what other apps store/expect from the same config key.

### 15.2 Rating vs. Ranking: Distinct Shapes, Not the Same Component Twice
- Right now `RatingCard`'s pill (`borderRadius: PILL_HEIGHT / 2`, a capsule) and `RankingCard`'s slot (`borderRadius: 12`, a rounded square) already differ slightly, but share the same size, background, border, and column layout closely enough to read as one component reused with different numbers inside.
- Make the shape difference deliberate and legible at a glance: Rating's targets read as **score pills** (the existing capsule shape, kept circular/pill-like — a scale, not a ranking); Ranking's targets read as **rank tags** — a distinct shape (e.g. a flagged/notched tag, or a numbered badge with a corner cut) that visually says "this is a strict order," not "this is a score."
- Keep both still built on the same underlying target-column mechanics (`DropTarget`, `resolveDropTarget`, `targetProximity` in `lib/swipe.ts`) — the shape change is presentational (each component's own pill/slot render), not a rewrite of the drag-to-target math.

### 15.3 Ranking's Column Flips; Rating's Stays, But Reads Unambiguously
- **Ranking only**: reverse the column so slot 1 (best) sits at the **bottom** of the target column and the last slot (worst) sits at the **top** — the opposite of today's top-to-bottom 1→N. `RankingCard`'s `centerY` derivation and the `bestLabel`/`worstLabel` end-label placement both need to flip together, so the labels stay next to the slots they describe.
- **Rating stays top-to-bottom, low-to-high, unchanged** — it is a scale, not a best/worst ordering, and must not start looking like Ranking's new convention just because they sit in similar columns. What does need to improve: right now direction only reads clearly if the admin bothers to set `minLabel`/`maxLabel` (prd.md's own coffee-study seed does, but nothing requires it). Make the "which end is better" direction unambiguous by default — e.g., a persistent low→high visual cue (arrow, gradient, or always-on end labels with sensible defaults like "Low"/"High" when the admin didn't set any) rather than relying entirely on optional admin-authored text.

### 15.4 Drag Scoped to the Photo, Not the Whole Card (Rating & Ranking)
- Currently `SwipeCard` wraps the entire card — prompt text included — in one draggable surface for every question type. For Rating and Ranking specifically, the prompt should be static chrome that never moves; only the photo/media area should be the grabbable, draggable surface.
- Restructure `RatingCard`/`RankingCard` so the prompt (and Ranking's "N of M" status line) render **outside** the `SwipeCard`, with only `CardMedia` and its immediate frame inside the gesture-detecting surface. TwoOptionCard is unaffected — its whole-card swipe is the intended Tinder-style gesture there and wasn't part of this complaint.

### 15.5 A Real Answer Gutter, Not an Overlay on the Photo (Rating & Ranking)
- The target pill/slot column is currently an absolutely-positioned overlay drawn on top of part of the photo (`COLUMN_RIGHT_MARGIN`/`PILL_WIDTH` eating into the card's right edge). Give it dedicated, reserved space instead: the photo should be narrower and the column should sit beside it in real layout space, never covering any part of the image.
- This pairs naturally with 15.4 — once the column has its own space and the drag surface is scoped to just the photo, the two changes together produce the intended layout: fixed prompt on top, draggable photo and static answer column side by side below it.

### 15.6 Ranking: Hold One Placed Card, Swap It With Another Directly
- Today, revising a ranking requires two steps: tap a filled slot to reclaim its card back to "current," then drag or tap it into a (possibly different) slot — see 12.1/12.6. Add a direct shortcut alongside that flow, not instead of it: press and hold an already-placed card's thumbnail and drag it onto a different filled slot to swap the two cards' positions in one motion (e.g. moving "Coffee 1" from slot 2 straight to where "Coffee 4" sits, and "Coffee 4" takes slot 2 in the same gesture) — no need to reclaim first.
- Both paths must produce the same result: reclaim-then-place and hold-and-swap are two ways to reach the same `placements` map, not two different answer shapes.

### 15.7 First-Test Onboarding Tutorial (Instagram-Style, Every Question Type)
- New evaluators currently get no orientation at all before their first real test — the only teaching that exists is `lib/tutorial.ts`'s `useGestureTutorial`, and that's scoped narrowly to the Rating/Ranking drag gesture (10.8/12.1), shown mid-test on first encounter with each of those two types specifically.
- Build a proper first-run walkthrough, shown once before a brand-new evaluator's very first test (tracked on-device, same durable-flag pattern as the existing gesture hints): a short, guided sequence — in the spirit of Instagram's own first-run/story-style tutorials — that demonstrates how to resolve *every* question type the evaluator is about to encounter (swipe-select, tap-list, multi-select swipe, drag-to-rate, drag-to-rank), not just the two gesture-novel ones.
- Decide at implementation time whether this supersedes or wraps the existing per-type `useGestureTutorial` hints, since the two now cover overlapping ground.

### Phase 15 Exit Criteria
- [ ] A Multi-Select question can be completed having liked zero, some, or all options, with no forced re-offering of skipped ones
- [ ] Rating's pills and Ranking's slots are visually distinct shapes at a glance, not the same component with different labels
- [ ] Ranking's column shows slot 1 (best) at the bottom and the last slot (worst) at the top; Rating's column is unchanged and unambiguous about which end is better
- [ ] Dragging a Rating or Ranking card only responds to touches on the photo — the prompt text never moves
- [ ] The answer column sits beside the photo in its own space on Rating and Ranking cards, never overlapping the image
- [ ] Holding a placed Ranking card and dragging it onto another filled slot swaps the two, without first tapping to reclaim
- [ ] A brand-new evaluator sees a first-test walkthrough covering every question type exactly once, before their first real test begins

---

## Phase 16: Mobile App — Field-Test Feedback Round 2 (Navigation, Onboarding & Polish)

> Feedback from a second on-device QA pass, this time against the Phase 15 build and the `phase16-qa` fixture tests (`packages/database/prisma/create-phase16-qa-tests.ts`). Covers a real navigation restructure (tab bar, dropping test-selection in favor of one Start button), two new profile-onboarding pieces (hobbies, an 18+ checkbox replacing a redundant age field), several motion/polish items, and a genuine bug found while testing: a stale cross-account session token.

### 16.1 Ranking Swap: Both Cards Scale Up During the Hold-and-Swap Drag
- `RankingCard.tsx`'s `SwappableThumbnail` (the hold-and-drag-to-swap gesture added in 15.6) currently only moves the held thumbnail (`translateY`) with no scale feedback, and the target slot it passes over has no reaction at all during a swap drag (the existing proximity-scale in `RankSlot`'s `animated` style only reacts to `pointerX`/`pointerY`, which the swap gesture never touches — it reads raw `translationY` instead).
- Add a matching scale-up to both sides while a swap drag is in progress: the held thumbnail grows slightly as it's dragged (driven by `translateY`'s magnitude, same spring curve as `MAX_SLOT_SCALE`'s proximity effect), and the slot currently being crossed over highlights/grows the same way `RankSlot` already does for the drag-to-place gesture. Both settle back to resting scale once the swap commits (or the drag ends over empty space with no swap).
- Reuse `MAX_SLOT_SCALE`/`PROXIMITY_FALLOFF` and the existing spring presets in `lib/motion.ts` rather than inventing new constants — this is the same "grow near a target" language already used elsewhere in this card, just extended to a gesture that didn't have it yet.

### 16.2 Question-to-Question Entrance Transition (Rise + Fade + Scale-In)
- `CardStack.tsx` currently computes each card's peek transform (`scale`, `translateY`, `opacity`) as a plain style object recalculated on every render — when `activeIndex` advances, the next card's depth goes from 1 to 0 and its style snaps instantly to the active position with no animation in between.
- Animate that transition: as a card's `depth` crosses from peeking to active, ease its `scale`/`translateY`/`opacity` from the peek values up to the resting active values (scale 1, translateY 0, opacity 1) instead of snapping — reading as the card rising, fading in, and scaling up into place, building on the position it already peeks from rather than sliding in from off-screen.
- Implementation: convert `CardStack`'s per-slot transform to a `useAnimatedStyle` driven by a shared value that's animated (not just set) on `activeIndex` change, using a new `CARD_ENTRANCE_SPRING` preset in `lib/motion.ts` (same family as the existing `POPUP_ENTRANCE_SPRING`, tuned for a much smaller distance). Respect Reduced Motion the same way every other spring in this file already does (collapse to `REDUCED_MOTION_FADE_MS`).
- Scope: only the question-to-question entrance inside one test. The transition from one test's last card into the next test's first card (Phase 11.3's completion popup → seamless continuation) is unchanged — this item is specifically about consecutive cards within a test's queue.

### 16.3 QA Fixture Fix: "Quick Picks" Multi-Select Had a Cap Its Own Prompt Denied
- `create-phase16-qa-tests.ts`'s "Quick Picks" test, Q3 (`MULTI_SELECT`, "Select any of these that feel calming to you - zero, some, or all is a completely fine answer") sets `config: { maxSelections: 3 }` against 4 options — the prompt promises "all" is a valid answer but the config caps the evaluator at 3, contradicting itself. Root cause of feedback item #3.
- Fix: drop `maxSelections` from that question's config (`config: {}`), so all 4 options can be liked, matching what the prompt already tells the evaluator.
- Not a platform change — `maxSelections` enforcement itself (15.1: "stays respected where an admin has actually set one") is correct and unchanged; this is a one-fixture data correction, not new engineering.

### 16.4 Bottom Tab Navigation: Dashboard / Shop / Profile / Settings
- Replaces the current stack-of-screens-plus-footer-buttons pattern (`home.tsx`'s `styles.footer` row of "Rewards"/"Profile"/"Sign out" buttons, `profile.tsx`'s own in-screen "Sign out"/"Delete account" danger zone) with a persistent bottom tab bar, four tabs:
  - **Dashboard** — today's `home.tsx` content minus the test list (see 16.5): balance card, greeting/status. The single Start button (16.5) lives here.
  - **Shop** — today's `rewards.tsx` content (balance + coupon catalog, prd.md §15.10) moved under this tab, unchanged otherwise.
  - **Profile** — today's `profile.tsx` demographic fields + avatar picker + Save, *minus* the danger zone. Gets the new hobbies field (16.7) and the optional-field labels (16.6).
  - **Settings** — the danger zone split out of `profile.tsx`: Sign out, Delete account (with its existing confirmation flow), and a natural home for anything else account-level added later (app version, legal doc links).
- `apps/mobile`: introduce an `expo-router` `(tabs)` group (`app/(tabs)/_layout.tsx` + `app/(tabs)/dashboard.tsx`, `shop.tsx` (renamed from `rewards.tsx`), `profile.tsx`, `settings.tsx`) for these four; `login.tsx`, `register.tsx`, `profile-onboarding.tsx`, `aydinlatma.tsx`, and `feed.tsx` stay outside the tab group as full-screen stack routes (feed in particular should not show tab chrome while a test is in progress).
- `index.tsx`'s post-auth redirect target becomes `/(tabs)/dashboard` instead of `/home`.

### 16.5 Single "Start" Button Replaces Test Selection
- `home.tsx`'s per-test list (`useAvailableTests`, `TestCard`, individual "Start test" buttons) is removed from the Dashboard tab entirely — matches what prd.md §15.4 already specifies ("the evaluator does not pick a test from a list") but the current implementation contradicts.
- Replace with one prominent **Start** button on the Dashboard tab. Tapping it enters the feed screen (`feed.tsx`), which resolves the next eligible test the same way it already does today (`useNextTest`/`useAvailableTests` + prefetch machinery from Phase 11 is unchanged) and begins the continuous cross-test feed described in Phase 11/prd.md §15.4 — the evaluator no longer sees or picks individual tests, they only ever see "Start."
- If no test is currently eligible, tapping Start shows the existing "nothing available right now" empty state inline (reuse `home.tsx`'s current empty-state copy) rather than entering the feed screen.
- **Explicit exit control inside the feed**: `feed.tsx`/`TestDeck.tsx` gets a visible close/back control (top corner, always reachable) that returns to the Dashboard tab at any point — mid-question or between tests — independent of the OS back gesture. An in-progress test's answers are preserved via the existing `writeInProgressTest`/resume machinery (`submissionQueue.ts`) so exiting mid-test and starting again later resumes rather than restarting, consistent with how resume already works today.

### 16.6 Profile Fields: Label the Actually-Optional Ones
- `evaluatorProfileSchema` (`packages/shared/src/validation/auth.ts`) treats `city`, `nativeLanguage`, and `occupation` as optional (`.optional()`), while `age`, `gender`, `country`, `educationLevel`, `aiExperience`, and `aiFrequency` are required. Today's `profile.tsx`/`profile-onboarding.tsx` only hint at this via a generic `placeholder="Optional"` inside the empty field, easy to miss.
- Update the visible field labels themselves for the three optional fields: `"City"` → `"City (Optional)"`, `"Native language"` → `"Native language (Optional)"`, `"Occupation"` → `"Occupation (Optional)"`, in both `profile.tsx` and `profile-onboarding.tsx`. Required fields' labels are unchanged.

### 16.7 Hobbies: Optional Predecided Multi-Select (Max 5)
- New `EvaluatorProfile.hobbies String[] @default([])` field (`packages/database/prisma/schema.prisma`, same pattern as the existing `foreignLanguages`/`aiUseCases` array fields) + migration.
- `evaluatorProfileSchema`: add `hobbies: z.array(z.string()).max(5).optional().default([])`, validated server-side against a fixed predecided list (new export, e.g. `packages/shared/src/constants.ts`'s `HOBBIES`) so arbitrary free text can't be submitted.
- Proposed predecided list (18 items, open to adjustment): Reading, Cooking & Baking, Gaming, Sports & Fitness, Travel, Photography, Music, Movies & TV, Art & Painting, Gardening, Hiking & Outdoors, Writing, Yoga & Meditation, Board Games & Puzzles, Pets & Animals, DIY & Crafts, Fashion & Style, Technology & Gadgets.
- UI: a tappable chip/tile grid (reuse the multi-select chip styling already used elsewhere in mobile forms where applicable) capped at 5 selections — the 6th tap on a new chip is a no-op until one is deselected, mirroring `MultiSelectCard`'s existing `atMax` guard pattern from Phase 15.1.
- **Optional, not mandatory**: shown as a skippable step in `profile-onboarding.tsx` (a "Skip" affordance, doesn't block reaching the feed) and editable anytime afterward from the Profile tab (16.4).

### 16.8 Registration: 18+ Checkbox Instead of Age Field; Password Confirmation + Show/Hide
- **Age → legal checkbox.** `register.tsx`'s numeric `age` field only ever exists to gate under-18 signups (`mobileRegisterSchema.age.min(MOBILE_MIN_AGE)`, `packages/shared/src/validation/auth.ts:46-50`) — the number itself is never persisted (`apps/api/src/routes/auth.ts`'s `/register/mobile` handler never writes `input.age` to any column). The real demographic age is collected separately and *is* persisted, on `profile-onboarding.tsx` (`EvaluatorProfile.age`). Replace the registration screen's numeric age input with a single checkbox: **"I confirm I am 18 or older."** Unchecked blocks the Continue button, exactly like today's numeric validation does.
  - `mobileRegisterSchema`: replace `age: z.number()...` with `ageConfirmed: z.literal(true, { errorMap: () => ({ message: "You must confirm you are 18 or older to create an account" }) })`. Nothing downstream changes — the field was never persisted, so this is purely a validation-shape change.
  - `profile-onboarding.tsx`'s numeric age field and its own `MOBILE_MIN_AGE` floor check are **unchanged** — that's still where the real `EvaluatorProfile.age` gets collected once.
- **Password confirmation.** `register.tsx` gets a second field, "Confirm password," validated client-side to match `password` before Continue is enabled (mismatch shows an inline error, same pattern as the existing `errors` state object).
- **Show/hide password (eye icon).** A small eye-icon toggle on the right edge of every password field — both fields on `register.tsx`, and the existing single password field on `login.tsx` — flips `secureTextEntry` on the underlying `Field`/`TextInput`. Build as a small reusable addition to the shared `Field` component (`apps/mobile/src/components/Field.tsx`) rather than three separate one-off implementations, since all three password fields need identical behavior.

### 16.9 Ranking Reclaim/Place Transition: Scale + Fade
- `RankingCard.tsx`'s `reclaim()` (tap a filled slot → its card pops back to being the full-size `current` card) and `place()` (drag/tap the current card into a slot → it becomes a small filled-slot thumbnail) both happen with an instant snap today — no transition in either direction.
- Add a simple scale + fade transition on both: on reclaim, the reappearing full card animates in from a slightly smaller/more-transparent state up to full size/opacity; on place, the slot's new thumbnail animates in from slightly larger/more-transparent down to its resting size/opacity. Not a position-matched morph (the thumbnail does not need to visually travel from the exact slot coordinates to the exact card coordinates, or vice versa) — a straightforward scale+fade using the existing `lib/motion.ts` spring presets is sufficient, consistent with 16.2's approach of reusing this file's shared presets rather than one-off animation code.

### 16.10 Fix: Stale Cross-Account Session Token on Submission Retry
- **Root cause of feedback item #10** ("This session token does not belong to this test"). `apps/mobile/src/lib/submissionQueue.ts` stores at most one pending test submission and one in-progress test **globally** — `PENDING_SUBMISSION_KEY`/`IN_PROGRESS_KEY` are fixed AsyncStorage keys, not scoped by user. `session.tsx`'s `signOut()` (line 107-110) only calls `clearTokens()` and resets in-memory user state; it never touches these AsyncStorage records.
- Failure sequence: evaluator A finishes a test, the background submit doesn't confirm before they sign out and evaluator B logs in on the same device; at next app launch, `retryPendingSubmissionOnce()` (fired from `_layout.tsx`) reads evaluator A's leftover pending payload and resubmits it using evaluator B's now-active bearer token. `apps/api/src/routes/evaluator.ts`'s submit handler correctly rejects this — the session token's embedded `userId` (evaluator A) doesn't match the authenticated request's `userId` (evaluator B) — producing exactly this error, harmlessly from the backend's perspective but confusingly from the evaluator's.
- Fix: scope `IN_PROGRESS_KEY`/`PENDING_SUBMISSION_KEY` by the signed-in user's id (e.g. suffix the AsyncStorage key, or namespace the stored JSON by `userId`) **and** have `signOut()` clear any pending/in-progress records that don't belong to the account being signed into next — belt-and-suspenders, since either alone closes the gap, but clearing on sign-out is also just correct hygiene (an abandoned session shouldn't leave silent background work queued). `retryPendingSubmissionOnce()` and `fetchInProgressForTest()` should only ever act on the currently authenticated user's own records.

### Phase 16 Exit Criteria
- [ ] Holding and dragging a placed Ranking card onto another filled slot scales both the held thumbnail and the slot it's crossing, settling back once the swap commits or is abandoned
- [ ] Advancing from one question to the next inside a test animates the incoming card rising, fading in, and scaling up rather than snapping into place; Reduced Motion collapses this to a short fade
- [ ] The "Quick Picks" QA fixture's calming-photos question accepts all 4 options selected, matching its own prompt
- [ ] The app shows a persistent bottom tab bar with Dashboard, Shop, Profile, and Settings; Sign out and Delete account live under Settings, not Profile
- [ ] The Dashboard tab shows balance/status and a single Start button — no list of individual tests to choose from
- [ ] Tapping Start enters the continuous feed at the next eligible test; an explicit in-feed control exits back to the Dashboard tab at any point, mid-test or between tests, without losing progress
- [ ] Profile screen labels read "City (Optional)", "Native language (Optional)", and "Occupation (Optional)"; required fields' labels are unchanged
- [ ] A new evaluator can select up to 5 hobbies from the predecided list during onboarding, can skip the step entirely, and can add/change hobbies later from the Profile tab
- [ ] Registration shows an "I confirm I am 18 or older" checkbox instead of a numeric age field; profile-onboarding's numeric age field is unaffected
- [ ] Registration requires a matching "Confirm password" before proceeding; a mismatch shows an inline error
- [ ] Every password field (register's two, login's one) has a working show/hide eye-icon toggle
- [ ] Reclaiming a placed Ranking card and placing a card into a slot both animate with a scale+fade transition instead of snapping
- [ ] Signing out on a device clears any pending/in-progress test records for that account; a different account signing in afterward never has a prior account's stale submission retried under its session

---

## Future / Backlog (Post-Mobile-MVP)

Not scheduled into the phases above — tracked here so they aren't lost:

- **Push notifications** for new/available tests (Expo Notifications), once there's a signal for when to send them.
- **Coupon redemption/purchase execution** — actually spending points from the Phase 14 catalog (balance deduction, fulfillment/coupon-code delivery, transaction history). The catalog itself ships in Phase 14; this is only the "spend" action.
- **KVKK consent on web** — Phase 9.3 adds it to mobile only; extending the same consent capture to `apps/evaluator`'s registration flow is a follow-up if legal/compliance asks for parity.
- **Smarter quality-control algorithm** (prd.md §15.8): replace the flat per-test `minTimePerQuestion` with a computed per-question minimum (roughly `advisoryTimeMin ÷ 4`, formula TBD), summed per test, invisible to the evaluator. Add repeated-failure tracking (3–4 speed-check or consistency-check failures) as an additional reward-withholding signal on top of the existing single-flag behavior. Needs its own design pass — including how `advisoryTimeMin` is actually derived/used — before implementation.

### Legal / Store Compliance (from `kvkk-compliance-research.md` and `appstore-playstore-compliance-research.md`, 2026-08-24)

- **Have the Privacy Notice (Aydınlatma Metni) drafted by legal counsel** — `apps/mobile/src/content/aydinlatmaMetni.ts` is currently a placeholder and hasn't passed legal review.
- **Prepare a separate Privacy Policy + Terms of Use document** — neither exists in the repo yet; required for both KVKK and Apple/Google store rules (the Privacy Notice does not substitute for these).
- **Clarify the legal basis for data transfer to Google** (KVKK Article 9) — since Google OAuth sign-in is a continuous/routine dependency, explicit consent alone may not be sufficient; may need to rely on Google's standard contractual clauses/DPA instead — legal counsel approval required.
- **Add an account deletion feature** — mandatory for both Apple (5.1.1v) and Google Play submission; currently only sign-out exists. Must be done before store launch.
- **Clarify VERBİS exemption status** — employee count and annual balance sheet figures are pending; likely exempt at this scale, but not yet confirmed.