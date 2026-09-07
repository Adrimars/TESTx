# TESTx — Scalability & Optimization Audit

Scope: `apps/api`, `apps/admin`, `apps/evaluator`, `apps/mobile`, `packages/database`, `packages/shared`. Framed around a single question: **if usage suddenly grew to a large scale (many concurrent users, high request volume), what would break or need to change?**

Report only — no code has been modified.

---

## 1) Optimization Summary

**Current health:** the codebase is correct and clean for the scale it was built for (an MVP demo + early rollout), but almost none of it was built with pagination, caching, or concurrency-safety as a first-class concern. Aggregation is done in application memory rather than in SQL in the two hottest read paths (results, next-test matching). Two of the three web apps (`apps/admin`, `apps/evaluator`) don't use a query cache at all. One area — the Google Drive media cache — has an actual concurrency bug today, not just a future scaling risk.

**Top 3 highest-impact improvements:**
1. **Move results aggregation into SQL** (`getTestResults`/`getTestResultsByDemographic` in `results.service.ts`) instead of loading every `TestResponse` + `Answer` (+ `User`/`EvaluatorProfile` for the demographic variant) into Node memory. This is the single biggest scale cliff — a popular test with thousands of responses can turn one page load into a multi-second, memory-heavy query.
2. **Fix the Drive media cache's missing concurrency guard** (`drive.service.ts`'s `streamFile`). This is a correctness bug *today*: concurrent requests for the same uncached file race on the same temp file path, risking a corrupted cache file served to everyone afterward. It just hasn't been hit yet because concurrent cold-cache access hasn't happened at scale.
3. **Make the API stateless-scale-ready before scaling it**: the rate limiter uses `@fastify/rate-limit`'s default in-memory store, and Prisma has no configured connection pool limit / PgBouncer. Neither is a problem at one instance — both silently break the moment there's more than one API process, which is the literal premise of "large scale."

**Biggest risk if nothing changes:** the app keeps working perfectly in the small-cohort shape it was demoed in, right up until one of two thresholds is crossed — a single test accumulates a few thousand responses (results page becomes slow/memory-heavy or times out), or the API is ever run as more than one process (rate limiting silently multiplies allowed abuse per instance, and connection pools can exhaust Postgres). Both failures are sudden, not gradual.

---

## 2) Findings (Prioritized)

### Finding 1 — Drive media cache has no concurrency guard (race condition)
- **Category:** Concurrency / Reliability
- **Severity:** Critical
- **Impact:** Data correctness (risk of a corrupted cache file served to all future viewers), plus wasted Drive API calls under load
- **Evidence:** `apps/api/src/services/drive.service.ts:119-174` (`streamFile`). On a cache miss, every concurrent request independently does `fsPromises.access(cachePath)` → catch → `drive.files.get(...)` → writes to the **same** `tempPath = \`${cachePath}.tmp\`` via `fs.createWriteStream(tempPath)`, then `fs.rename(tempPath, cachePath, () => {})`. There is no lock, no in-flight-request map keyed by `media.id`, and no dedup.
- **Why it's inefficient:** N simultaneous requests for the same uncached file (e.g. many evaluators loading the first question of a newly-activated test at once) each independently call the Drive API and each write to the identical temp file path — concurrent writers can interleave/truncate each other's stream, and multiple `rename` calls race to finalize the same destination. Each requester still gets their own piped stream so they may not notice individually, but the cache file left on disk afterward can be corrupted or truncated, and every *subsequent* request served from that cache silently gets bad data until someone notices and deletes it.
- **Recommended fix:** keep an in-memory `Map<mediaId, Promise<void>>` of in-flight fetch-and-cache operations; concurrent requests for the same `media.id` await the same promise instead of starting their own Drive fetch. Write to a unique per-request temp path (e.g. include a random suffix or `process.pid`) and only the winning writer renames into place.
- **Tradeoffs / Risks:** the in-flight map only dedups within a single process — if/when the API runs as multiple instances, the same race can still occur across processes (see Finding 3's connection/pooling context — this is the same "needs a shared coordination point" theme). A cross-process fix would need a distributed lock (e.g. `SELECT ... FOR UPDATE` on the `Media` row, or a Redis lock) — not needed until the API is horizontally scaled, but worth flagging now since it's the same file.
- **Expected impact estimate:** eliminates a real (if rare today) data-corruption bug; becomes near-certain to trigger under the "large scale" premise of this audit (new/popular test → many simultaneous cold-cache hits).
- **Removal Safety:** Safe — purely additive (a dedup map), doesn't change the streaming behavior for callers.
- **Reuse Scope:** local file (`drive.service.ts`).

### Finding 2 — Rate limiting uses the default in-memory store
- **Category:** Reliability / Security / Cost
- **Severity:** Critical (specifically for the "large scale" scenario)
- **Impact:** Correctness of abuse protection under horizontal scaling
- **Evidence:** `apps/api/src/plugins/rate-limit.ts` (full file): `app.register(rateLimit, { max: 60, timeWindow: "1 minute" })` — no `store` option, no Redis/ioredis dependency anywhere in the repo (confirmed via grep on `apps/api/package.json` and root `package.json`). No Dockerfile/docker-compose/PM2/cluster config exists either, confirming a single-process assumption today.
- **Why it's inefficient:** the in-memory store keeps its counters local to one process. The moment the API runs as more than one instance (which "large scale" implies), each instance enforces `60/min` independently — a client hitting N instances (via a load balancer) effectively gets `60 × N` requests/min, silently multiplying the allowed rate on exactly the endpoints (`/auth/login`, `/auth/register`) this was meant to protect.
- **Recommended fix:** switch to a shared store (`@fastify/rate-limit`'s Redis-backed store via `ioredis`) before ever running more than one API instance. This also gives a natural home for future rate-limited paths (e.g. `/auth/register` CAPTCHA-adjacent hardening from `plan.md`'s Backlog).
- **Tradeoffs / Risks:** adds a Redis dependency (new infra to provision/monitor) where none exists today; small added latency per request for the Redis round-trip.
- **Expected impact estimate:** the difference between rate limiting actually working and silently not working at N instances — not a gradual improvement, a correctness fix.
- **Removal Safety:** Needs Verification (behavior change under load — test with k6/autocannon against 2+ local instances before shipping).
- **Reuse Scope:** service-wide (one plugin, all routes).

### Finding 3 — No DB connection pool configuration; no PgBouncer
- **Category:** DB / Concurrency
- **Severity:** High
- **Impact:** Availability — risk of exhausting Postgres's `max_connections` under horizontal scaling
- **Evidence:** `packages/database/prisma/schema.prisma:5-8` — plain `datasource db { provider = "postgresql", url = env("DATABASE_URL") }`, no `connection_limit`/`pool_timeout` params. `apps/api/src/plugins/prisma.ts` (full file) creates one `PrismaClient` per process (correctly, as a singleton) but with no explicit pool size — Prisma's default (`num_physical_cpus * 2 + 1`) applies per process, unconfigured.
- **Why it's inefficient:** with a single process this is invisible. The classic failure (confirmed against current Prisma/Postgres guidance) is N processes × Prisma's default pool each → total connections can exceed Postgres's configured `max_connections` (often 100 by default), causing new connections to be refused across the whole app, not just the newest instance.
- **Recommended fix:** before running more than one API instance, either (a) put PgBouncer (transaction mode) between the API and Postgres and set a small explicit `connection_limit` per instance in `DATABASE_URL`, or (b) use a managed pooler (e.g. Prisma Accelerate, or the hosting provider's built-in pooler if using something like Supabase/Neon).
- **Tradeoffs / Risks:** PgBouncer in transaction mode disallows some Postgres features (prepared statements across pooled connections, session-level settings) — verify none of the current queries rely on session state.
- **Expected impact estimate:** prevents a full-app outage mode (connection exhaustion) that would otherwise appear abruptly the first time the API scales past one instance.
- **Removal Safety:** Needs Verification (infra change, needs a load test against the pooled setup).
- **Reuse Scope:** service-wide.

### Finding 4 — Results aggregation is done entirely in application memory
- **Category:** DB / Memory
- **Severity:** High
- **Impact:** Latency and memory usage of `GET /admin/tests/:id/results` and `.../results/demographics`, proportional to total responses × answers (× users for the demographic variant)
- **Evidence:** `apps/api/src/services/results.service.ts:220-277`. `getTestResults` loads the test with `include: { questions: ..., responses: { include: { answers: true } } }` — i.e. every `TestResponse` and every `Answer` for the test in one nested query — then `aggregateQuestions`/`aggregateQuestion` (lines 81-203) loop over all of it in JS with `Map`s to build option counts / rating distributions / ranking positions. `getTestResultsByDemographic` does the same plus eager-loads `user.evaluatorProfile` for every response and re-runs the JS aggregation once per demographic segment.
- **Why it's inefficient:** no `groupBy`/aggregate SQL, no pagination, no limit. For a test with a few thousand responses and several questions, this materializes a large nested object graph in Node memory on every single page load (there's no cache — see Finding 9) and the demographic variant multiplies that work by segment count.
- **Recommended fix:** rewrite the per-question aggregation as SQL (`prisma.answer.groupBy({ by: ["questionId", ...], _count: true })` for select-type questions, `_avg`/`_count` for ratings) so Postgres does the counting instead of Node. For the demographic variant, either join `EvaluatorProfile` into the `groupBy` or run one grouped query per segment dimension.
- **Tradeoffs / Risks:** `groupBy` on JSON-shaped answer fields (`selectedOptions` is likely an array/JSON column) may need a raw SQL query (`prisma.$queryRaw`) rather than the typed `groupBy` API if selections are stored as an array rather than one row per selected option — worth checking the `Answer` schema shape before committing to an approach.
- **Expected impact estimate:** likely converts an O(total answers) in-memory operation into an O(distinct question × option) query result — often orders of magnitude smaller for popular tests.
- **Removal Safety:** Needs Verification (must preserve the exact aggregation semantics — attention-check/trap-question exclusion, flagged-response exclusion — that the current JS code implements).
- **Reuse Scope:** module (`results.service.ts`), consumed by both results endpoints.

### Finding 5 — `/next-test` and `/available-tests` fetch and filter unbounded in JS
- **Category:** DB / Algorithm
- **Severity:** High
- **Impact:** Latency of the evaluator's most frequently-hit endpoint (called on every feed transition and every mobile prefetch)
- **Evidence:** `apps/api/src/routes/evaluator.ts:302-341` — fetches **all** `ACTIVE` tests (`prisma.test.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } })`, no `take`) plus **all** of the caller's historical `TestResponse` rows (no limit), then loops in JS calling `matchesDemographics()` per test until one matches. `/available-tests` (lines 350-388) repeats the identical pattern, and its own code comment notes "no cap on how many come back."
- **Why it's inefficient:** demographic matching happens in JS because `Test.demographicFilters` is an untyped `Json?` column with no supporting index on the `EvaluatorProfile` fields it's compared against (`age`, `gender`, `country`, `city` — none indexed, per the schema audit). This scales linearly with (a) total ACTIVE tests and (b) the calling evaluator's total lifetime response count — both of which grow as the product succeeds, on the single most frequently-called endpoint in the system (called every feed prefetch, per Phase 11).
- **Recommended fix:** shorter-term, add a reasonable `take` limit to both queries (most evaluators won't need to scan hundreds of active tests to find one match) and consider caching the "already responded" test-ID set per user for the session rather than refetching it on every call. Longer-term, if `demographicFilters` moves to a more structured/typed shape, push the matching into the `WHERE` clause with supporting indexes on `EvaluatorProfile`.
- **Tradeoffs / Risks:** a `take` limit changes matching semantics slightly (oldest-N instead of all) — acceptable given the existing FIFO-fairness ordering by `createdAt`, but worth confirming with the product owner.
- **Expected impact estimate:** medium-term reduces per-call work from O(all active tests + all lifetime responses) to a bounded query; the full SQL-pushdown fix is larger but removes the scaling ceiling entirely.
- **Removal Safety:** Likely Safe for the `take` limit; Needs Verification for the SQL-pushdown rewrite (must exactly preserve current matching semantics).
- **Reuse Scope:** module (`evaluator.ts`), two near-identical code paths — also a **Reuse Opportunity**: `/next-test` and `/available-tests` duplicate the same fetch-and-filter logic and should share one underlying function.

### Finding 6 — Admin Media Library & Test list have no real pagination (hardcoded `page=1&limit=50`)
- **Category:** Frontend / Algorithm
- **Severity:** High
- **Impact:** Functional, not just slow — data becomes unreachable through the UI past the 50th item
- **Evidence:** `apps/admin/src/app/media/page.tsx:101-119` and `apps/admin/src/app/tests/page.tsx:36-50` both hardcode `page: "1"`, `limit: "50"` with no page-state, no "load more," and (for the tests list) `data.total` isn't even read. Contrast with `apps/admin/src/app/users/page.tsx:23,32-46,101-125`, which **does** implement real pagination (`PAGE_SIZE = 25`, page state, Previous/Next controls) — proof the pattern exists in the codebase already, just not applied consistently.
- **Why it's inefficient:** once a media library or test list exceeds 50 items, older/other items are simply never fetched or shown — no error, just silent data loss from the user's perspective. This isn't a "slow at scale" issue, it's a "broken at scale" issue, and will start happening well before "very large scale" — any moderately active admin will cross 50 media items or 50 tests quickly.
- **Recommended fix:** apply the exact pagination pattern already used in `users/page.tsx` to both the media library and the test list.
- **Tradeoffs / Risks:** none significant — this is copying an existing, working in-repo pattern.
- **Expected impact estimate:** restores access to 100% of data instead of the first 50 items.
- **Removal Safety:** Safe.
- **Reuse Scope:** local file each, but should extract the shared pagination-state/controls pattern from `users/page.tsx` into a reusable hook/component (**Reuse Opportunity**) instead of copy-pasting a third time.

### Finding 7 — No image resizing/thumbnail pipeline; every client always loads full-resolution originals
- **Category:** Network / Cost
- **Severity:** High
- **Impact:** Bandwidth and load time, multiplied across every media view on every client (mobile cards, evaluator question pages, admin grid and results)
- **Evidence:** `apps/api/src/services/media.service.ts:116` — `const thumbnailUrl = fileType === "IMAGE" ? \`/media/${id}/file\` : null;` — the "thumbnail" is literally the same URL as the full original; no `sharp` or any resizing dependency exists in `apps/api`. Every consumer confirmed to request the same full-resolution URL: `apps/mobile/src/components/cards/CardMedia.tsx:42-67` (`Image` with no explicit dimensions), `apps/evaluator/.../question/[n]/page.tsx:50-102` (`<img>`, no `srcset`/`sizes`), `apps/admin/src/components/results-view.tsx` and `apps/admin/src/app/media/page.tsx:46-63` (grid thumbnails at CSS-only sizing).
- **Why it's inefficient:** a media-centric product (this app's entire evaluator experience is looking at images/video) serving full-resolution originals to every small thumbnail and mobile card multiplies bandwidth cost and load time by however oversized the originals are relative to their display size — this compounds directly with user count and media library size, and hits mobile users (on cellular) hardest.
- **Recommended fix:** add a resizing step (e.g. `sharp`) to `media.service.ts` that generates and caches a small thumbnail variant alongside the original on upload/import, and point `thumbnailUrl` at it; keep the full-resolution proxy for the actual test-taking view if genuinely needed at full size, or add a `?size=` query param to `/media/:id/file` with cached size variants.
- **Tradeoffs / Risks:** adds `sharp` as a new dependency (native bindings — verify it builds cleanly in the deployment environment) and adds one more thing the Drive-import cache path needs to produce; needs cache-key design (per Finding 1/10, extend the same cache-directory approach with a size suffix).
- **Expected impact estimate:** typically a 5-20x reduction in bytes transferred for thumbnail-sized views, depending on original image dimensions — a large, broadly-felt win.
- **Removal Safety:** Needs Verification (new dependency, new cache-file naming scheme).
- **Reuse Scope:** service-wide (`media.service.ts`), benefits every client.

### Finding 8 — Submission retry backoff has no jitter (synchronized retry storms)
- **Category:** Reliability / Concurrency
- **Severity:** High
- **Impact:** Risk of a synchronized burst of `/evaluator/tests/:id/submit` requests hitting the API at the same instants across many devices
- **Evidence:** `apps/mobile/src/lib/submissionQueue.ts:204` — `const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 240_000];`, applied in a plain `for` loop with `await sleep(RETRY_DELAYS_MS[attempt - 1])` (lines 213-230) — no randomization anywhere in the file. Separately, `retryPendingSubmissionOnce` (lines 247-259) fires once at every app launch.
- **Why it's inefficient:** every device affected by the same event (a regional network blip, or a mass app relaunch — which the new Phase 20 push-notification feature will directly cause, since a notification blast is designed to bring many users back into the app at once) retries at the exact same fixed offsets. At small scale this is invisible; at large scale it produces a predictable, recurring load spike on the submit endpoint timed to exactly 5s/15s/30s/... after whatever event triggered it.
- **Recommended fix:** add jitter to `RETRY_DELAYS_MS` (e.g. `delay * (0.5 + Math.random())`) and to the app-launch retry.
- **Tradeoffs / Risks:** none meaningful — jitter is a strict improvement here.
- **Expected impact estimate:** smooths a sharp, synchronized load spike into a spread-out one — directly relevant once Phase 20 (notifications) ships, since that feature is explicitly designed to bring many users back simultaneously.
- **Removal Safety:** Safe.
- **Reuse Scope:** local file (`submissionQueue.ts`).

### Finding 9 — `apps/admin` and `apps/evaluator` don't use a query cache at all
- **Category:** Frontend / Caching
- **Severity:** Medium
- **Impact:** Every navigation/mount refetches from scratch; no request dedup
- **Evidence:** grep for `@tanstack/react-query` across `apps/admin` and `apps/evaluator` returns zero matches — both use plain `fetch`/`useEffect`/`useState` (e.g. `apps/admin/src/app/tests/[id]/results/page.tsx:25-35`). `apps/mobile` already uses react-query with sane defaults (`apps/mobile/src/lib/queryClient.ts:4-37`, `staleTime: 30_000`).
- **Why it's inefficient:** no caching between navigations (going to the results page, away, and back refetches the entire payload every time), no automatic request dedup if the same data is needed by two components at once, and no shared retry/error handling — everything is hand-rolled per page.
- **Recommended fix:** adopt `@tanstack/react-query` in `apps/admin`/`apps/evaluator`, mirroring the mobile app's existing `queryClient.ts` conventions.
- **Tradeoffs / Risks:** a real but mechanical migration across every data-fetching page in both apps — not risky, just a chunk of work.
- **Expected impact estimate:** reduces redundant fetches significantly for any admin/evaluator session with normal back-and-forth navigation; also a **Reuse Opportunity** (three apps currently have three different data-fetching conventions for the same kind of work).
- **Removal Safety:** Likely Safe (additive; existing `fetch` calls can be wrapped incrementally).
- **Reuse Scope:** service-wide across two apps.

### Finding 10 — Drive media cache has no eviction or size limit
- **Category:** I/O / Cost
- **Severity:** Medium
- **Impact:** Unbounded disk growth on the API host
- **Evidence:** `apps/api/src/services/media.service.ts` / `drive.service.ts` — cache directory defaults to `./cache/media` (`getCacheDir()`), one file per distinct `media.id` ever served, removed only when that specific `Media` row is explicitly deleted via the admin delete-media flow (`deleteMedia()`, `media.service.ts:158-174`). No max-size, no LRU eviction, no TTL.
- **Why it's inefficient:** as the media library and Drive-imported content grow (and are never proactively deleted), the cache directory grows monotonically — fine for a while, but an eventual disk-exhaustion risk with no built-in alarm before it happens.
- **Recommended fix:** add a simple size-capped LRU eviction pass (e.g. a periodic job that checks total cache directory size and evicts least-recently-accessed files above a configured threshold), or move the cache to a managed object store with its own lifecycle rules (e.g. S3 + a bucket lifecycle policy) if/when infrastructure work happens (see `plan.md` Backlog's "Production Readiness / Infrastructure" section).
- **Tradeoffs / Risks:** eviction adds complexity; an object-store move is a bigger infra change, best batched with the broader hosting decision already tracked in the Backlog.
- **Expected impact estimate:** removes a slow-burn but eventually hard-stop failure mode (disk full).
- **Removal Safety:** Needs Verification.
- **Reuse Scope:** local file/module (`media.service.ts`, `drive.service.ts`).

### Finding 11 — A handful of foreign-key columns and one composite have no supporting index
- **Category:** DB
- **Severity:** Medium
- **Impact:** Slower lookups/joins on the affected columns as row counts grow
- **Evidence:** `packages/database/prisma/schema.prisma` — `MobileAuthCode.userId` (no index), `Question.trapSourceId` (self-relation FK, no index), `QuestionOption.mediaId` (no index), and `Media.sourceUrl` (no index, despite `drive.service.ts:97`'s `prisma.media.findFirst({ where: { sourceUrl: file.id } })` per-file de-dupe lookup during every Drive import). Also, `Test` only has `@@index([status])`, not a composite `[status, createdAt]`, despite `/next-test`'s `WHERE status = 'ACTIVE' ORDER BY createdAt ASC` (Finding 5).
- **Why it's inefficient:** each is a full/partial scan candidate as its table grows — `Media.sourceUrl` in particular is checked once per file on every Drive folder import, so large Drive folders imported repeatedly will feel this first.
- **Recommended fix:** add `@@index([userId])` to `MobileAuthCode`, `@@index([trapSourceId])` to `Question`, `@@index([mediaId])` to `QuestionOption`, `@@index([sourceUrl])` to `Media`, and consider `@@index([status, createdAt])` on `Test` (can replace the standalone `status` index).
- **Tradeoffs / Risks:** each new index has a small write-amplification cost — negligible for these tables' write patterns (none are hot-write tables).
- **Expected impact estimate:** low effort, meaningful long-tail improvement as these tables grow; a Prisma migration is a small, safe change.
- **Removal Safety:** Safe.
- **Reuse Scope:** local (schema-level, no application code changes needed).

### Finding 12 — Live report polling has no backoff/jitter and no shared cache across viewers
- **Category:** Network / Caching
- **Severity:** Medium
- **Impact:** Redundant load on `/admin/tests/:id/report` proportional to concurrent admin viewers of the same test
- **Evidence:** `apps/admin/src/app/tests/[id]/report/page.tsx:13,28,59-76` — `REFRESH_INTERVAL_MS = 30_000`, `setInterval` firing `fetchAll` (up to 2 full-report fetches per tick if segmented) while the test is Active, for as long as the tab stays open — no cap on simultaneous viewers, no shared/deduped fetch across them.
- **Why it's inefficient:** each open browser tab polls independently; N admins watching the same popular live test multiplies identical report queries by N every 30s. Low severity today (admin headcount is presumably small), but worth fixing before it becomes a larger org's habit.
- **Recommended fix:** either lengthen the interval with visibility-based pausing (stop polling when the tab isn't focused, per the Page Visibility API), or move to a shared cache/short server-side TTL on the report endpoint so concurrent identical requests within a small window are served from one computed result.
- **Tradeoffs / Risks:** a server-side cache adds a small staleness window to an explicitly "live" feature — acceptable if kept short (a few seconds).
- **Expected impact estimate:** scales the feature's cost with distinct *tests being watched* rather than with *viewer count* — meaningful once more than a couple of admins use it simultaneously.
- **Removal Safety:** Likely Safe.
- **Reuse Scope:** local file, or service-wide if a general short-TTL response cache is added.

### Finding 13 — Inconsistent `loading="lazy"` / missing `width`/`height` on `<img>` tags
- **Category:** Frontend
- **Severity:** Low
- **Impact:** Minor — unnecessary eager image loads in a couple of spots, and layout shift since no dimensions are reserved
- **Evidence:** `apps/evaluator/.../question/[n]/page.tsx`'s `OptionMedia` has `loading="lazy"` but no `width`/`height`; `QuestionMediaPanel` in the same file has neither `loading="lazy"` nor dimensions; `apps/admin/src/components/results-view.tsx`'s three `<img>` usages have neither. `apps/admin/src/app/media/page.tsx`'s `MediaThumbnail` is the one consistent example (`loading="lazy"` present).
- **Why it's inefficient:** minor bandwidth waste from a few eager-loaded off-screen images, and cumulative layout shift (CLS) from unreserved image space — a UX/Core-Web-Vitals concern more than a backend scale concern.
- **Recommended fix:** add `loading="lazy"` and explicit `width`/`height` (or an aspect-ratio CSS box, which `OptionMedia` already partially does via `aspect-video`) consistently across all three files, matching `MediaThumbnail`'s existing pattern.
- **Tradeoffs / Risks:** none.
- **Expected impact estimate:** small, but free — bundle with Finding 7's thumbnail work since both touch the same `<img>` call sites.
- **Removal Safety:** Safe.
- **Reuse Scope:** local, three files.

### Finding 14 — Forward-looking note: the planned Notification dispatch (Phase 20) needs a distributed-safe job pattern from day one
- **Category:** Concurrency / Reliability
- **Severity:** Low (not yet built — a design note, not a bug)
- **Impact:** Would prevent duplicate-send bugs once the API runs as more than one instance
- **Evidence:** N/A — this is about the design discussed for `plan.md`'s Phase 20 (a Postgres-table-based job/polling approach, explicitly chosen over a Redis queue for simplicity at current scale).
- **Why it matters:** if the dispatch job is ever run from more than one process/instance (which the rest of this audit assumes will eventually happen), two instances polling the same "pending notifications" table naively can both pick up and send the same row, double-notifying a user — the same class of bug as Finding 1's cache race, just in a not-yet-built feature.
- **Recommended fix:** when implementing Phase 20's dispatch polling query, use `SELECT ... FOR UPDATE SKIP LOCKED` (a standard Postgres pattern for exactly this "multiple workers claim rows from one queue table safely" case) instead of a plain `SELECT` + separate `UPDATE`.
- **Tradeoffs / Risks:** none — this is the same amount of code either way, just written correctly from the start.
- **Expected impact estimate:** avoids a bug class before it ships, rather than fixing it retroactively.
- **Removal Safety:** N/A (not yet implemented).
- **Reuse Scope:** N/A.

---

## 3) Quick Wins (Do First)

Ordered by effort-to-impact ratio:

1. **Finding 6** — copy `users/page.tsx`'s existing pagination pattern onto the Media Library and Test list. Small, mechanical, and fixes a real data-loss-from-the-UI bug.
2. **Finding 8** — add jitter to `RETRY_DELAYS_MS`. One-line-scale change, no risk.
3. **Finding 11** — add the four missing indexes + the `Test` composite index as one Prisma migration. Zero application-code changes.
4. **Finding 13** — add `loading="lazy"`/dimensions to the remaining `<img>` tags. Free, no risk.
5. **Finding 1** — add the in-flight-request map to `drive.service.ts`. Small, localized, fixes an active correctness bug.

## 4) Deeper Optimizations (Do Next)

1. **Finding 4** — rewrite results aggregation as SQL `groupBy`/raw queries. The highest-effort, highest-payoff item; needs careful semantic-preservation testing (attention-check/trap exclusion, flagged-response exclusion).
2. **Finding 5** — push demographic matching toward the database once `demographicFilters`' shape allows it; short-term, just add `take` limits.
3. **Finding 7** — add an image-resizing pipeline (`sharp`) and thumbnail variants.
4. **Finding 9** — adopt `@tanstack/react-query` in `apps/admin`/`apps/evaluator`.
5. **Finding 2 + 3** — Redis-backed rate limiting + PgBouncer/pool configuration. These two should land together, before the API is ever deployed as more than one instance — treat "more than one API instance" as a hard gate on shipping both.
6. **Finding 10** — cache eviction or a move to object storage, likely bundled with the broader hosting decision already tracked in `plan.md`'s Backlog.

## 5) Validation Plan

- **Benchmarks:** load-test `/admin/tests/:id/results` and `/admin/tests/:id/results/demographics` against a seeded test with a large synthetic response count (e.g. 10,000+ responses) before and after Finding 4's SQL rewrite — compare response time and API process memory (RSS) under load.
- **Concurrency test:** for Finding 1, fire N (e.g. 20) simultaneous cold requests for the same uncached Drive-sourced `media.id` against a test/staging environment and verify (a) only one Drive API call is made, (b) the resulting cache file is byte-identical to the source, across repeated runs.
- **Rate-limit test (Finding 2):** run 2+ local API instances behind a simple round-robin proxy and confirm the shared store enforces the combined limit correctly, versus the current in-memory store visibly allowing `60 × instance count`.
- **Connection pool test (Finding 3):** with PgBouncer/pool limits configured, run N API instances and confirm total Postgres connections stay under `max_connections` under sustained load (e.g. via `autocannon`/`k6`).
- **Pagination correctness (Finding 6):** seed 60+ media items and 60+ tests in a test environment; verify all items are reachable through the paginated UI, not just the first 50.
- **Metrics to compare before/after:** p50/p95/p99 latency on the results and next-test endpoints, API process memory under sustained load, total bytes transferred per test-taking session (before/after Finding 7), and count of Drive API calls per cold-cache burst (before/after Finding 1).

## 6) Optimized Code / Patch (Proposals Only — Not Applied)

**Finding 1 — Drive cache in-flight dedup (sketch):**
```ts
const inFlight = new Map<string, Promise<void>>();

async function ensureCached(media: Media): Promise<string> {
  const cachePath = getCachePath(media);
  if (await exists(cachePath)) return cachePath;

  const existing = inFlight.get(media.id);
  if (existing) { await existing; return cachePath; }

  const task = fetchAndCache(media, cachePath).finally(() => inFlight.delete(media.id));
  inFlight.set(media.id, task);
  await task;
  return cachePath;
}
```
`fetchAndCache` would write to a per-call unique temp path (e.g. `${cachePath}.${randomUUID()}.tmp`) and rename only on success, so a failed fetch never clobbers a good cache file.

**Finding 8 — jittered backoff (sketch):**
```ts
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 240_000];
const jittered = (ms: number) => ms * (0.5 + Math.random()); // ±50% spread
// use: await sleep(jittered(RETRY_DELAYS_MS[attempt - 1]))
```

**Finding 4 — results aggregation direction (sketch, exact query depends on `Answer`'s selection shape):**
```ts
const optionCounts = await prisma.answer.groupBy({
  by: ["questionId", /* selected option column or a join table */],
  where: { question: { testId }, response: { isFlagged: false } },
  _count: true,
});
```
This replaces loading every `Answer` row and counting in JS with one grouped aggregate query per test — the exact shape depends on whether `selectedOptions` is a scalar array column (would need `unnest`/raw SQL) or a relational join table.

These are directional sketches to guide implementation, not final code — actual attention-check/trap-question exclusion logic and exact Prisma capabilities against the current schema need to be re-verified when implementing.
